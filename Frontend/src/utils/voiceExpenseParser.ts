import type { Moneda } from './currencyUtils';

/**
 * F03 - Parser heurístico local de gastos dictados por voz (español de México).
 *
 * Función pura: recibe la transcripción del reconocedor y devuelve monto, moneda,
 * concepto y categoría sugerida. No usa red ni BD, por eso se prueba 100 % con Jest.
 *
 *   parseVoiceExpense('Gasté 85 pesos en gasolina', 'MXN')
 *   → { monto: 85, moneda: 'MXN', concepto: 'Gasolina', categoria: 'Transporte', confianza: 'alta', ... }
 */

export type Confianza = 'alta' | 'media' | 'baja';

export interface ParsedVoiceExpense {
  transcripcion: string;
  monto: number | null;
  moneda: Moneda;
  /** true si la moneda se mencionó explícitamente ("pesos", "dólares"…). */
  monedaDetectada: boolean;
  concepto: string;
  /** Nombre exacto de la categoría en la BD, o null si no se reconoció. */
  categoria: string | null;
  confianza: Confianza;
}

// ─────────────────────────────────────────────
// Diccionarios (todas las claves normalizadas: minúsculas y sin acentos)
// ─────────────────────────────────────────────

const WORD_NUMBERS: Record<string, number> = {
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15,
  dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22, veintitres: 23, veinticuatro: 24,
  veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
  treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
  cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300,
  cuatrocientos: 400, cuatrocientas: 400, quinientos: 500, quinientas: 500, seiscientos: 600,
  seiscientas: 600, setecientos: 700, setecientas: 700, ochocientos: 800, ochocientas: 800,
  novecientos: 900, novecientas: 900,
};

/** "un/una/uno" solos casi siempre son artículos ("un café"), no montos. */
const ARTICLE_NUMBERS = new Set(['un', 'una', 'uno']);
const MULTIPLIERS: Record<string, number> = { mil: 1_000, millon: 1_000_000, millones: 1_000_000 };

const CURRENCY_WORDS: Record<string, Moneda> = {
  peso: 'MXN', pesos: 'MXN', pesito: 'MXN', pesitos: 'MXN', varo: 'MXN', varos: 'MXN',
  baro: 'MXN', baros: 'MXN', mxn: 'MXN',
  dolar: 'USD', dolares: 'USD', dolarcito: 'USD', dolarcitos: 'USD', dls: 'USD', dlls: 'USD', usd: 'USD',
};
const CENTS_WORDS = new Set(['centavo', 'centavos']);

/** Palabras que suelen ir justo antes del monto ("de 30", "fueron 450", "gasté 85"). */
const AMOUNT_TRIGGERS = new Set([
  'de', 'del', 'por', 'en', 'fueron', 'fue', 'son', 'costo', 'costaron', 'cuesta', 'salio',
  'gaste', 'pague', 'compre', 'puse', 'total', 'gastamos', 'pagamos', 'como',
]);

/** Verbos y muletillas que se eliminan del concepto en cualquier posición. */
const FILLER_WORDS = new Set([
  'gaste', 'gastamos', 'gastar', 'gasto', 'compre', 'compramos', 'comprar', 'pague', 'pagamos', 'pagar',
  'pedi', 'pedimos', 'puse', 'costo', 'costaron', 'cuesta', 'salio', 'fueron', 'fue', 'son', 'es', 'era',
  'me', 'acabo', 'acabe', 'aproximadamente', 'como',
]);

/** Conectores que se recortan solo en los extremos del concepto ("en gasolina" → "gasolina"). */
const EDGE_WORDS = new Set([
  'en', 'de', 'del', 'por', 'para', 'un', 'una', 'uno', 'unos', 'unas', 'el', 'la', 'los', 'las', 'lo',
  'le', 'al', 'a', 'y', 'con', 'mi', 'mis', 'hoy', 'ahorita', 'ya', 'que', 'total',
]);

/** Palabras clave → nombre de categoría (debe coincidir con la tabla Categoria). */
const CATEGORY_MULTIWORD: [string, string][] = [
  ['uber eats', 'Comida'],
  ['didi food', 'Comida'],
  ['mercado libre', 'Compras'],
];

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Comida: [
    'taco', 'comida', 'cafe', 'desayuno', 'almuerzo', 'cena', 'pizza', 'hamburguesa', 'torta', 'oxxo',
    'restaurante', 'refresco', 'antojo', 'super', 'mandado', 'despensa', 'tortilla', 'pan', 'helado',
    'botana', 'sushi', 'pollo', 'elote', 'galleta', 'dulce', 'lonche', 'comer', 'snack', 'fruta',
  ],
  Transporte: [
    'uber', 'didi', 'gasolina', 'taxi', 'camion', 'pasaje', 'estacionamiento', 'caseta', 'metro',
    'autobus', 'transporte', 'peaje', 'llanta', 'mecanico', 'cabify', 'gasolinera',
  ],
  Entretenimiento: [
    'cine', 'netflix', 'spotify', 'concierto', 'videojuego', 'juego', 'fiesta', 'bar', 'antro',
    'disney', 'hbo', 'teatro', 'cerveza', 'cheve', 'boliche', 'karaoke', 'museo',
  ],
  Salud: [
    'farmacia', 'medicina', 'medicamento', 'doctor', 'medico', 'consulta', 'dentista', 'gimnasio',
    'gym', 'vitamina', 'hospital', 'pastilla', 'analisis', 'laboratorio',
  ],
  Compras: [
    'ropa', 'zapato', 'tenis', 'amazon', 'regalo', 'celular', 'playera', 'pantalon', 'shein',
    'audifono', 'sudadera', 'chamarra', 'mochila', 'perfume', 'maquillaje',
  ],
  'Educación': [
    'libro', 'copia', 'curso', 'colegiatura', 'util', 'inscripcion', 'cuaderno', 'escuela',
    'universidad', 'impresion', 'papeleria', 'examen',
  ],
  Servicios: [
    'luz', 'agua', 'internet', 'telefono', 'recarga', 'renta', 'gas', 'cable', 'predial',
    'lavanderia', 'plan',
  ],
};

const KEYWORD_TO_CATEGORY = new Map<string, string>();
for (const [categoria, words] of Object.entries(CATEGORY_KEYWORDS)) {
  for (const w of words) KEYWORD_TO_CATEGORY.set(w, categoria);
}

/** Frases para `contextualStrings` del reconocedor (mejoran la precisión de estas palabras). */
export const VOICE_CONTEXTUAL_STRINGS = [
  'pesos', 'dólares', 'varos', 'centavos', 'Uber', 'Didi', 'Oxxo', 'Netflix', 'Spotify', 'Amazon',
  'Mercado Libre', 'gasolina', 'farmacia', 'colegiatura', 'despensa',
];

// ─────────────────────────────────────────────
// Tokenización
// ─────────────────────────────────────────────

interface Token {
  raw: string;   // texto original (con acentos) para armar el concepto
  norm: string;  // normalizado para comparar
  num?: number;  // valor si el token es una cifra con dígitos
}

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const parseDigits = (s: string): number | undefined => {
  if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(s)) return parseFloat(s.replace(/,/g, '')); // 1,200.50
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return parseFloat(s.replace(/\./g, ''));           // 1.200
  if (/^\d+([.,]\d{1,2})?$/.test(s)) return parseFloat(s.replace(',', '.'));             // 85 · 85.50 · 85,50
  return undefined;
};

const tokenize = (text: string): Token[] =>
  text
    .replace(/\$/g, ' $ ')
    .split(/\s+/)
    .map((piece) => piece.replace(/^[^\p{L}\p{N}$]+|[^\p{L}\p{N}$]+$/gu, ''))
    .filter(Boolean)
    .map((raw) => {
      const num = parseDigits(raw);
      return { raw, norm: normalize(raw), ...(num !== undefined ? { num } : {}) };
    });

// ─────────────────────────────────────────────
// Lectura de cifras ("dos mil quinientos", "cuarenta y cinco", "2 mil", "85.50")
// ─────────────────────────────────────────────

interface NumberSpan {
  value: number;
  end: number;          // índice exclusivo del último token de la cifra
  articleOnly: boolean; // la cifra es solo "un/una/uno"
}

/**
 * Lee una cifra que inicia en `i`. Cada pieza debe ser de menor orden que la anterior
 * (ciento → veinte → …), así "dos tres" no se suma como 5.
 */
const readNumber = (tokens: Token[], i: number): NumberSpan | null => {
  let total = 0;
  let current = 0;
  let limit = Infinity;   // la siguiente pieza debe ser menor que esto
  let lastMult = Infinity;
  let lastPiece = 0;
  let articleOnly = true;
  let j = i;

  while (j < tokens.length) {
    const t = tokens[j];

    if (t.num !== undefined) {
      // Dígitos: al inicio, o tras "mil" ("2 mil 500")
      const afterMultiplier = j > i && current === 0 && total > 0 && t.num < lastMult;
      if (j !== i && !afterMultiplier) break;
      current += t.num;
      lastPiece = t.num;
      limit = 1;
      articleOnly = false;
      j++;
      continue;
    }

    const mult = MULTIPLIERS[t.norm];
    if (mult !== undefined) {
      if (mult >= lastMult) break;
      if (mult === 1_000_000) total = (total + (current || 1)) * mult;
      else total += (current || 1) * mult;
      current = 0;
      limit = Infinity;
      lastMult = mult;
      articleOnly = false;
      j++;
      continue;
    }

    // "cuarenta y cinco": la "y" solo une decenas redondas con unidades
    if (t.norm === 'y' && current > 0) {
      const next = tokens[j + 1];
      const nextValue = next ? WORD_NUMBERS[next.norm] : undefined;
      const isRoundTens = lastPiece >= 30 && lastPiece <= 90 && lastPiece % 10 === 0;
      if (isRoundTens && nextValue !== undefined && nextValue >= 1 && nextValue <= 9) {
        j++;
        continue;
      }
      break;
    }

    const v = WORD_NUMBERS[t.norm];
    if (v !== undefined && v < limit) {
      current += v;
      lastPiece = v;
      if (!ARTICLE_NUMBERS.has(t.norm)) articleOnly = false;
      limit = v >= 100 ? 100 : v >= 30 && v % 10 === 0 ? 10 : 1;
      j++;
      continue;
    }
    break;
  }

  if (j === i) return null;
  return { value: total + current, end: j, articleOnly };
};

// ─────────────────────────────────────────────
// Candidatos a monto
// ─────────────────────────────────────────────

interface AmountCandidate {
  value: number;
  start: number;          // índice del primer token a eliminar del concepto (incluye "$")
  end: number;            // exclusivo; incluye moneda y centavos
  currency: Moneda | null;
  score: number;
}

const isContentWord = (t: Token | undefined) =>
  !!t &&
  /^[a-zñ]+$/.test(t.norm) &&
  !EDGE_WORDS.has(t.norm) &&
  !FILLER_WORDS.has(t.norm) &&
  !CURRENCY_WORDS[t.norm] &&
  WORD_NUMBERS[t.norm] === undefined &&
  MULTIPLIERS[t.norm] === undefined;

const findCandidates = (tokens: Token[]): AmountCandidate[] => {
  const candidates: AmountCandidate[] = [];
  let i = 0;

  while (i < tokens.length) {
    const span = readNumber(tokens, i);
    if (!span) {
      i++;
      continue;
    }

    let value = span.value;
    let k = span.end;

    // Moneda inmediatamente después ("85 pesos")
    let currency: Moneda | null = CURRENCY_WORDS[tokens[k]?.norm] ?? null;
    if (currency) k++;

    // Centavos: "85 con 50", "veinte pesos con cincuenta centavos", "veinte y medio"
    if (tokens[k]?.norm === 'con') {
      const cents = readNumber(tokens, k + 1);
      if (cents && cents.value > 0 && cents.value < 100) {
        value += cents.value / 100;
        k = cents.end;
        if (CENTS_WORDS.has(tokens[k]?.norm)) k++;
      }
    } else if (tokens[k]?.norm === 'y' && tokens[k + 1]?.norm === 'medio') {
      value += 0.5;
      k += 2;
    }

    // Moneda después de los centavos ("veinte con cincuenta pesos")
    if (!currency && CURRENCY_WORDS[tokens[k]?.norm]) {
      currency = CURRENCY_WORDS[tokens[k].norm];
      k++;
    }

    const hasDollarSign = tokens[i - 1]?.norm === '$';
    const start = hasDollarSign ? i - 1 : i;

    // "un café" → artículo, no monto (salvo "un peso", "un dólar")
    const discard = (span.articleOnly && !currency) || value <= 0;
    if (!discard) {
      const prev = tokens[start - 1];
      let score = 0;
      if (currency || hasDollarSign) score += 4;                 // pegado a una moneda
      if (prev && AMOUNT_TRIGGERS.has(prev.norm)) score += 2;    // "de 30", "fueron 450"
      if (!currency && isContentWord(tokens[k])) score -= 3;     // "2 tacos" → cantidad, no monto
      candidates.push({ value: Math.round(value * 100) / 100, start, end: k, currency, score });
    }

    i = Math.max(k, i + 1);
  }
  return candidates;
};

/** Mayor puntaje; en empate, la última cifra mencionada. */
const pickBest = (candidates: AmountCandidate[]): AmountCandidate | null =>
  candidates.reduce<AmountCandidate | null>(
    (best, c) => (best === null || c.score >= best.score ? c : best),
    null
  );

// ─────────────────────────────────────────────
// Categoría y concepto
// ─────────────────────────────────────────────

const singularForms = (w: string) => {
  const forms = [w];
  if (w.endsWith('es')) forms.push(w.slice(0, -2));
  if (w.endsWith('s')) forms.push(w.slice(0, -1));
  return forms;
};

const detectCategory = (tokens: Token[]): string | null => {
  const joined = ` ${tokens.map((t) => t.norm).join(' ')} `;
  for (const [phrase, categoria] of CATEGORY_MULTIWORD) {
    if (joined.includes(` ${phrase} `)) return categoria;
  }
  // Primera palabra clave en orden de aparición
  for (const t of tokens) {
    for (const form of singularForms(t.norm)) {
      const categoria = KEYWORD_TO_CATEGORY.get(form);
      if (categoria) return categoria;
    }
  }
  return null;
};

const MAX_CONCEPTO = 80;

const buildConcept = (tokens: Token[], amount: AmountCandidate | null): string => {
  let kept = tokens.filter(
    (t, idx) =>
      !(amount && idx >= amount.start && idx < amount.end) &&
      !FILLER_WORDS.has(t.norm) &&
      !CURRENCY_WORDS[t.norm] &&
      t.norm !== '$'
  );
  while (kept.length && EDGE_WORDS.has(kept[0].norm)) kept = kept.slice(1);
  while (kept.length && EDGE_WORDS.has(kept[kept.length - 1].norm)) kept = kept.slice(0, -1);

  const text = kept.map((t) => t.raw).join(' ').slice(0, MAX_CONCEPTO).trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
};

// ─────────────────────────────────────────────
// API pública
// ─────────────────────────────────────────────

export const parseVoiceExpense = (transcripcion: string, monedaPresupuesto: Moneda): ParsedVoiceExpense => {
  const tokens = tokenize(transcripcion ?? '');
  const best = pickBest(findCandidates(tokens));

  const mentionedCurrency =
    best?.currency ?? tokens.map((t) => CURRENCY_WORDS[t.norm]).find((c): c is Moneda => !!c) ?? null;

  const categoria = detectCategory(tokens);
  const concepto = buildConcept(tokens, best) || categoria || 'Gasto por voz';
  const monto = best?.value ?? null;

  return {
    transcripcion,
    monto,
    moneda: mentionedCurrency ?? monedaPresupuesto,
    monedaDetectada: mentionedCurrency !== null,
    concepto,
    categoria,
    confianza: monto === null ? 'baja' : categoria ? 'alta' : 'media',
  };
};
