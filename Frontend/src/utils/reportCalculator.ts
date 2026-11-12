import { CATEGORY_CHART_SLOTS } from '../theme/theme';
import { round2 } from './currencyUtils';
import { addDaysToKey, diffInDays, toLocalDateKey } from './dateUtils';

/** F10 - Reportes. Funciones puras: reciben los gastos ya consultados y no tocan la BD. */

export type PeriodKey = 'cycle' | 'previous' | 'last7' | 'last30';

export interface ReportPeriod {
  key: PeriodKey;
  label: string;
  from: string; // 'YYYY-MM-DD', inclusivo
  to: string;
  prevFrom: string; // período anterior del mismo largo, para comparar
  prevTo: string;
  /** Es un período de ciclo: tiene sentido mostrar el límite diario base como referencia. */
  isCycle: boolean;
}

export interface ReportRow {
  monto: number;
  fecha: string; // ISO UTC
  categoria_id: number | null;
  categoria_nombre?: string | null;
  categoria_icono?: string | null;
}

export interface CategoryTotal {
  id: number | null;
  nombre: string;
  icono: string | null;
  total: number;
  pct: number;
}

export interface DayTotal {
  day: string;
  total: number;
}

export interface Report {
  total: number;
  /** null si no hay gastos en el período anterior: evita un "100 % más" engañoso. */
  changePct: number | null;
  categories: CategoryTotal[];
  days: DayTotal[];
  insights: string[];
}

export interface DonutSlice {
  key: string;
  label: string;
  total: number;
  /** Lugar en la paleta; null usa el gris neutro. */
  slot: number | null;
}

const SIN_CATEGORIA = 'Sin categoría';
const MAX_INSIGHTS = 2;
const MAX_NAMED_SLICES = 6;
const MIN_NOTABLE_CHANGE_PCT = 10;

const lastDaysPeriod = (key: PeriodKey, label: string, days: number, hoy: string): ReportPeriod => {
  const from = addDaysToKey(hoy, -(days - 1));
  return {
    key,
    label,
    from,
    to: hoy,
    prevFrom: addDaysToKey(from, -days),
    prevTo: addDaysToKey(from, -1),
    isCycle: false,
  };
};

/** D24: con ciclo diario, un período de ciclo tendría un solo día. */
export const getReportPeriods = (tipoCiclo: string, fechaInicio: string, fechaFin: string, hoy: string): ReportPeriod[] => {
  const last30 = lastDaysPeriod('last30', 'Últimos 30 días', 30, hoy);
  if (tipoCiclo === 'Diario') return [lastDaysPeriod('last7', 'Últimos 7 días', 7, hoy), last30];

  const duracion = diffInDays(fechaInicio, fechaFin) + 1;
  const transcurridos = diffInDays(fechaInicio, hoy) + 1;
  const inicioAnterior = addDaysToKey(fechaInicio, -duracion);

  return [
    {
      key: 'cycle',
      label: 'Este ciclo',
      from: fechaInicio,
      to: hoy,
      // Se compara contra los mismos días del ciclo anterior, no contra el ciclo completo
      prevFrom: inicioAnterior,
      prevTo: addDaysToKey(inicioAnterior, transcurridos - 1),
      isCycle: true,
    },
    {
      key: 'previous',
      label: 'Ciclo anterior',
      from: inicioAnterior,
      to: addDaysToKey(fechaInicio, -1),
      prevFrom: addDaysToKey(inicioAnterior, -duracion),
      prevTo: addDaysToKey(inicioAnterior, -1),
      isCycle: true,
    },
    last30,
  ];
};

const totalsByCategory = (rows: ReportRow[]): Map<number | null, { nombre: string; icono: string | null; total: number }> => {
  const map = new Map<number | null, { nombre: string; icono: string | null; total: number }>();
  for (const row of rows) {
    const entry = map.get(row.categoria_id) ?? {
      nombre: row.categoria_nombre ?? SIN_CATEGORIA,
      icono: row.categoria_icono ?? null,
      total: 0,
    };
    entry.total += row.monto;
    map.set(row.categoria_id, entry);
  }
  return map;
};

const sumRows = (rows: ReportRow[]) => round2(rows.reduce((sum, row) => sum + row.monto, 0));

const buildInsights = (categories: CategoryTotal[], previous: ReportRow[]): string[] => {
  const insights: string[] = [];

  const top = categories[0];
  if (top && categories.length > 1 && top.id !== null) {
    insights.push(`${top.nombre} es tu mayor gasto: ${top.pct} %`);
  }

  // El cambio más notable contra el período anterior, solo con base de comparación
  const prevTotals = totalsByCategory(previous);
  let notable: { nombre: string; change: number } | null = null;
  for (const category of categories) {
    const prev = prevTotals.get(category.id)?.total;
    if (!prev || category.id === null) continue;
    const change = Math.round(((category.total - prev) / prev) * 100);
    if (Math.abs(change) >= MIN_NOTABLE_CHANGE_PCT && (!notable || Math.abs(change) > Math.abs(notable.change))) {
      notable = { nombre: category.nombre, change };
    }
  }
  if (notable) {
    insights.push(
      `Gastaste ${Math.abs(notable.change)} % ${notable.change > 0 ? 'más' : 'menos'} en ${notable.nombre} que en el período anterior`
    );
  }

  return insights.slice(0, MAX_INSIGHTS);
};

export const buildReport = (rows: ReportRow[], previous: ReportRow[], period: Pick<ReportPeriod, 'from' | 'to'>): Report => {
  const total = sumRows(rows);
  const prevTotal = sumRows(previous);

  const categories: CategoryTotal[] = [...totalsByCategory(rows).entries()]
    .map(([id, entry]) => ({
      id,
      nombre: entry.nombre,
      icono: entry.icono,
      total: round2(entry.total),
      pct: total > 0 ? Math.round((entry.total / total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  const dayTotals = new Map<string, number>();
  for (const row of rows) {
    const day = toLocalDateKey(new Date(row.fecha));
    dayTotals.set(day, (dayTotals.get(day) ?? 0) + row.monto);
  }
  const days: DayTotal[] = [];
  for (let day = period.from; diffInDays(day, period.to) >= 0; day = addDaysToKey(day, 1)) {
    days.push({ day, total: round2(dayTotals.get(day) ?? 0) });
  }

  return {
    total,
    changePct: prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : null,
    categories,
    days,
    insights: buildInsights(categories, previous),
  };
};

/**
 * Rebanadas de la dona: hasta 6 categorías con color propio, en orden fijo de la paleta para que
 * cada categoría conserve su color. Lo demás, incluidas "Otros" y "Sin categoría", va en "Resto".
 */
export const buildDonutSlices = (categories: CategoryTotal[]): DonutSlice[] => {
  const named: DonutSlice[] = [];
  let rest = 0;

  categories.forEach((category, index) => {
    const slot = CATEGORY_CHART_SLOTS[category.nombre];
    if (slot !== undefined && index < MAX_NAMED_SLICES) {
      named.push({ key: category.nombre, label: category.nombre, total: category.total, slot });
    } else {
      rest += category.total;
    }
  });

  named.sort((a, b) => (a.slot as number) - (b.slot as number));
  return rest > 0 ? [...named, { key: 'resto', label: 'Resto', total: round2(rest), slot: null }] : named;
};
