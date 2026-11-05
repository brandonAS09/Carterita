import { suggestCategory, type Confianza } from './voiceExpenseParser';
import { addDaysToKey, diffInDays } from './dateUtils';

/**
 * F04 - Parser local de tickets (español de México).
 *
 * Función pura: recibe las líneas del OCR con su posición y devuelve total, comercio,
 * fecha y categoría. No usa red ni BD, por eso se prueba 100 % con Jest.
 */

export interface ReceiptLine {
  text: string;
  frame: { left: number; top: number; width: number; height: number };
}

export interface ParsedReceipt {
  /** null si no hay una palabra clave confiable: el monto no se pre-llena (D10). */
  total: number | null;
  /** Montos para sugerir cuando no hay total, de mayor a menor. */
  candidatos: number[];
  comercio: string | null;
  /** 'YYYY-MM-DD'; nunca es futura. */
  fecha: string | null;
  /** Nombre exacto de la categoría en la BD, o null si no se reconoció. */
  categoria: string | null;
  confianza: Confianza;
}

interface Row {
  raw: string;
  /** Texto sin montos, en mayúsculas y sin acentos ni puntos, para buscar palabras clave. */
  label: string;
  amounts: number[];
}

const MAX_CANDIDATOS = 4;
const MAX_AMOUNT = 10_000_000; // más que esto es un código de barras o un folio
const MAX_COMERCIO = 80;
const HEADER_ROWS = 8;
const TOTAL_LOOKAHEAD_ROWS = 2;
const ROW_OVERLAP_FACTOR = 0.6;

// ─────────────────────────────────────────────
// Reconstrucción de renglones
// ─────────────────────────────────────────────

const centerY = (l: ReceiptLine) => l.frame.top + l.frame.height / 2;

/** Agrupa líneas cuyo centro vertical coincide, para unir "TOTAL" con "$100.00" en otra columna. */
const groupIntoRows = (lines: ReceiptLine[]): ReceiptLine[][] => {
  const sorted = lines.filter((l) => l.text.trim()).sort((a, b) => centerY(a) - centerY(b));
  const rows: ReceiptLine[][] = [];

  for (const line of sorted) {
    const row = rows[rows.length - 1];
    const sameRow =
      row &&
      Math.abs(centerY(line) - centerY(row[0])) < Math.min(line.frame.height, row[0].frame.height) * ROW_OVERLAP_FACTOR;
    if (sameRow) row.push(line);
    else rows.push([line]);
  }
  return rows.map((row) => row.sort((a, b) => a.frame.left - b.frame.left));
};

// ─────────────────────────────────────────────
// Montos
// ─────────────────────────────────────────────

/**
 * Solo cifras con 2 decimales, para no confundir fechas, teléfonos ni folios. El separador de
 * miles no admite espacios: en "2 100.00" el 2 es la cantidad del artículo, no parte del monto.
 */
const AMOUNT_REGEX = /(?<![\d.,/:\-])(\d{1,3}(?:[.,]\d{3})+|\d+)\s?[.,]\s?(\d{2})(?![\d%]|\s%|[.,/\-]\d)/g;

/** Corrige la letra O leída en lugar de un cero dentro de una cifra ("1O0.00", "85.O0"). */
const fixOcrDigits = (text: string) => text.replace(/\d[\dOo.,]*/g, (cifra) => cifra.replace(/[Oo]/g, '0'));

const extractAmounts = (text: string): { amounts: number[]; withoutAmounts: string } => {
  const amounts: number[] = [];
  const withoutAmounts = fixOcrDigits(text).replace(AMOUNT_REGEX, (_match, whole: string, cents: string) => {
    const value = parseFloat(`${whole.replace(/[.,]/g, '')}.${cents}`);
    if (value > 0 && value < MAX_AMOUNT) amounts.push(value);
    return ' ';
  });
  return { amounts, withoutAmounts };
};

const normalizeLabel = (text: string) =>
  text
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\./g, '')
    .replace(/T[O0]TA[L1I]/g, 'TOTAL')
    .replace(/\s+/g, ' ')
    .trim();

// ─────────────────────────────────────────────
// Selección del total
// ─────────────────────────────────────────────

/** Renglones que nunca son el total: desglose, forma de pago, otra moneda o encabezado de columnas. */
const EXCLUDED_ROW =
  /SUB[ -]?TOTAL|\bIVA\b|\bIEPS\b|IMPUESTO|DESCUENTO|AHORRO|\bARTS?\b|ARTICULOS?|CAMBIO|EFECTIVO|PAGO CON|RECIBIDO|TARJETA|\bVISA\b|MASTERCARD|\bDEBITO\b|\bCREDITO\b|SALDO|MONEDERO|PUNTOS|SUGERIDA|\bUSD\b|\bDLLS?\b|DOLARES|\bCANT\b|CANTIDAD|DESCRIPCION|PRECIO/;

const TIER_TIP = 4;
const TIER_STRONG = 3;
const TIER_TOTAL = 2;
const TIER_WEAK = 1;

const totalTier = (label: string): number => {
  if (EXCLUDED_ROW.test(label) && !/TOTAL CON PROPINA/.test(label)) return 0;
  if (/TOTAL CON PROPINA/.test(label)) return TIER_TIP;
  if (/TOTAL A PAGAR|IMPORTE TOTAL|TOTAL MN\b|TOTAL MXN|VENTA TOTAL|TOTAL VENTA|GRAN TOTAL|TOTAL NETO|TOTAL PAGADO/.test(label)) {
    return TIER_STRONG;
  }
  if (/\bTOTAL\b/.test(label)) return TIER_TOTAL;
  if (/\bIMPORTE\b|\bA PAGAR\b|\bPOR PAGAR\b/.test(label)) return TIER_WEAK;
  return 0;
};

/** Mayor prioridad; a igual prioridad gana el monto en su propio renglón y luego el más abajo. */
const findTotal = (rows: Row[]): number | null => {
  let best: { score: number; value: number } | null = null;

  rows.forEach((row, index) => {
    const tier = totalTier(row.label);
    if (!tier) return;

    let value: number | undefined;
    let ownRow = true;
    if (row.amounts.length) {
      value = row.amounts[row.amounts.length - 1];
    } else if (tier >= TIER_TOTAL) {
      // "TOTAL" sin monto: el primer monto de los renglones siguientes, salvo que sea de otro concepto
      ownRow = false;
      for (const next of rows.slice(index + 1, index + 1 + TOTAL_LOOKAHEAD_ROWS)) {
        if (EXCLUDED_ROW.test(next.label)) break;
        if (next.amounts.length) {
          value = next.amounts[0];
          break;
        }
      }
    }
    if (value === undefined) return;

    const score = tier * 2 + (ownRow ? 1 : 0);
    if (!best || score >= best.score) best = { score, value };
  });

  return best ? (best as { value: number }).value : null;
};

/** Montos para sugerir: excluye desglose y forma de pago, salvo que no haya otros. */
const findCandidates = (rows: Row[]): number[] => {
  const usable = rows.filter((r) => !EXCLUDED_ROW.test(r.label)).flatMap((r) => r.amounts);
  const source = usable.length ? usable : rows.flatMap((r) => r.amounts);
  return [...new Set(source)].sort((a, b) => b - a).slice(0, MAX_CANDIDATOS);
};

// ─────────────────────────────────────────────
// Comercio
// ─────────────────────────────────────────────

const NOT_MERCHANT =
  /\bRFC\b|\bCALLE\b|\bAV\b|\bAVE\b|AVENIDA|\bBLVD\b|BOULEVARD|\bCOL\b|COLONIA|\bCP\b|\bTEL\b|TELEFONO|\bNUM\b|\bNO\b|TICKET|FACTURA|RECIBO|\bNOTA\b|FOLIO|FECHA|\bHORA\b|CAJA|CAJERO|SUCURSAL|BIENVENIDO|\bMEX\b|MEXICO|EXPEDIDO|REGIMEN|\bCOPIA\b/;

const LEGAL_SUFFIX = /[,\s]+S\.?\s?A\.?(\s*(P\.?\s?I\.?\s*)?DE\s+C\.?\s?V\.?)?\.?\s*$/i;

const findMerchant = (rows: Row[]): string | null => {
  for (const row of rows.slice(0, HEADER_ROWS)) {
    const text = row.raw.replace(LEGAL_SUFFIX, '').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').trim();
    const letters = text.match(/\p{L}/gu)?.length ?? 0;
    const compact = text.replace(/\s/g, '').length;
    if (letters < 3 || letters / compact < 0.6) continue;
    if (row.amounts.length || NOT_MERCHANT.test(normalizeLabel(text))) continue;
    return text.slice(0, MAX_COMERCIO).trim();
  }
  return null;
};

// ─────────────────────────────────────────────
// Fecha
// ─────────────────────────────────────────────

const MONTHS: Record<string, number> = {
  ENE: 1, ENERO: 1, FEB: 2, FEBRERO: 2, MAR: 3, MARZO: 3, ABR: 4, ABRIL: 4, MAY: 5, MAYO: 5, JUN: 6, JUNIO: 6,
  JUL: 7, JULIO: 7, AGO: 8, AGOSTO: 8, SEP: 9, SEPT: 9, SEPTIEMBRE: 9, OCT: 10, OCTUBRE: 10, NOV: 11, NOVIEMBRE: 11,
  DIC: 12, DICIEMBRE: 12,
};

const pad = (n: number) => n.toString().padStart(2, '0');

const toDateKey = (year: number, month: number, day: number): string | null => {
  const y = year < 100 ? 2000 + year : year;
  const d = new Date(y, month - 1, day);
  if (d.getFullYear() !== y || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return `${y}-${pad(month)}-${pad(day)}`;
};

const NUMERIC_YMD = /(?<!\d)(\d{4})[/.\-](\d{1,2})[/.\-](\d{1,2})(?!\d)/;
const NUMERIC_DMY = /(?<![\d/.\-])(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4}|\d{2})(?![\d/.\-])/;
const TEXT_DMY = /(?<!\d)(\d{1,2})[\s/.\-]*(?:DE\s+)?([A-Z]{3,10})\.?[\s/.\-]*(?:DE\s+|DEL\s+)?(\d{4}|\d{2})(?!\d)/;

const dateFromText = (text: string): string | null => {
  const upper = text.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  let m = upper.match(NUMERIC_YMD);
  if (m) return toDateKey(+m[1], +m[2], +m[3]);

  m = upper.match(NUMERIC_DMY);
  if (m) return toDateKey(+m[3], +m[2], +m[1]) ?? toDateKey(+m[3], +m[1], +m[2]); // dd/mm, o mm/dd si no es válida

  m = upper.match(TEXT_DMY);
  if (m && MONTHS[m[2]]) return toDateKey(+m[3], MONTHS[m[2]], +m[1]);

  return null;
};

/** Primera fecha válida que no sea futura; tiene preferencia el renglón que dice "FECHA". */
const findDate = (rows: Row[], hoy: string): string | null => {
  const ordered = [...rows.filter((r) => /FECHA/.test(r.label)), ...rows.filter((r) => !/FECHA/.test(r.label))];
  for (const row of ordered) {
    const key = dateFromText(row.raw);
    if (key && diffInDays(key, hoy) >= 0) return key;
  }
  return null;
};

/** D9: la fecha del ticket se ofrece solo si es anterior a hoy y cae dentro del ciclo actual. */
export const isTicketDateUsable = (fecha: string | null, hoy: string, fechaInicioCiclo: string): fecha is string =>
  !!fecha && diffInDays(fecha, addDaysToKey(hoy, -1)) >= 0 && diffInDays(fechaInicioCiclo, fecha) >= 0;

// ─────────────────────────────────────────────
// Categoría
// ─────────────────────────────────────────────

/** Comercios comunes de México; se revisan en orden, por eso "OXXO GAS" va antes que "OXXO". */
const MERCHANT_CATEGORIES: [RegExp, string][] = [
  [/OXXO GAS|PEMEX|GASOLINERA|SERVICIO GASOLINERO|\bARCO\b|\bSHELL\b|\bMOBIL\b|\bG500\b|ESTACIONAMIENTO|AUTOZONE/, 'Transporte'],
  [/FARMACIA|BENAVIDES|\bSIMILARES\b|SAN PABLO/, 'Salud'],
  [/CINEPOLIS|CINEMEX/, 'Entretenimiento'],
  [/\bCFE\b|TELMEX|TELCEL|\bIZZI\b|TOTALPLAY/, 'Servicios'],
  [/PAPELERIA|LIBRERIA|GANDHI/, 'Educación'],
  [/LIVERPOOL|COPPEL|\bSEARS\b|SUBURBIA|ELEKTRA|PALACIO DE HIERRO|\bZARA\b|HOME DEPOT|MINISO/, 'Compras'],
  [
    /OXXO|7[ -]?ELEVEN|CIRCLE K|\bKIOSKO\b|WALMART|WAL-MART|AURRERA|SORIANA|CHEDRAUI|LA COMER\b|CALIMAX|SMART ?& ?FINAL|COSTCO|\bSAMS\b|SAM'S|\bHEB\b|H-E-B|STARBUCKS|MCDONALD|BURGER KING|\bKFC\b|DOMINO|LITTLE CAESARS|SUBWAY|\bVIPS\b|\bTOKS\b|TAQUERIA|RESTAURANTE|CAFETERIA|PANADERIA/,
    'Comida',
  ],
];

const findCategory = (rows: Row[], comercio: string | null): string | null => {
  const header = rows.slice(0, HEADER_ROWS).map((r) => r.label).join(' | ');
  for (const [pattern, categoria] of MERCHANT_CATEGORIES) {
    if (pattern.test(header)) return categoria;
  }
  // Solo el comercio: en el resto del ticket "TELEFONO" o "AGUA" darían categorías equivocadas
  return comercio ? suggestCategory(comercio) : null;
};

// ─────────────────────────────────────────────
// API pública
// ─────────────────────────────────────────────

export const parseReceipt = (lines: ReceiptLine[], hoy: string): ParsedReceipt => {
  const rows: Row[] = groupIntoRows(lines).map((row) => {
    const raw = row.map((l) => l.text.trim()).join(' ');
    const { amounts, withoutAmounts } = extractAmounts(raw);
    return { raw, label: normalizeLabel(withoutAmounts), amounts };
  });

  const total = findTotal(rows);
  const candidatos = findCandidates(rows);
  const comercio = findMerchant(rows);

  return {
    total,
    candidatos,
    comercio,
    fecha: findDate(rows, hoy),
    categoria: findCategory(rows, comercio),
    confianza: total !== null ? 'alta' : candidatos.length ? 'media' : 'baja',
  };
};
