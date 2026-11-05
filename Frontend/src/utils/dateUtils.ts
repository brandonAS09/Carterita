/**
 * Utilidades de fecha basadas en la ZONA HORARIA LOCAL del dispositivo.
 *
 * Las transacciones se guardan como ISO UTC (`toISOString()`), pero "hoy" para el
 * usuario es su día local. Nunca usar `toISOString().split('T')[0]` para obtener
 * el día: en UTC-7/-8 los gastos de la tarde caerían en el día siguiente.
 */

const pad = (n: number) => n.toString().padStart(2, '0');

/** Fecha local en formato 'YYYY-MM-DD'. */
export const toLocalDateKey = (date: Date = new Date()): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Convierte 'YYYY-MM-DD' (o un ISO completo) a un Date a medianoche local. */
export const parseDateKey = (value: string): Date => {
  // Un ISO completo (con hora) se interpreta como instante y se lleva a su día local.
  if (value.length > 10) {
    const d = new Date(value);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** Suma (o resta) días a una fecha 'YYYY-MM-DD' y devuelve otra 'YYYY-MM-DD'. */
export const addDaysToKey = (dateKey: string, days: number): string => {
  const d = parseDateKey(dateKey);
  d.setDate(d.getDate() + days);
  return toLocalDateKey(d);
};

/** Días calendario entre dos fechas 'YYYY-MM-DD' (to - from). Inmune a cambios de horario. */
export const diffInDays = (fromKey: string, toKey: string): number => {
  const a = parseDateKey(fromKey);
  const b = parseDateKey(toKey);
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcB - utcA) / 86_400_000);
};

/**
 * Rango [start, end) en ISO UTC que cubre del inicio del día local `fromKey`
 * al final del día local `toKey` (inclusivo). Útil para totales de un ciclo.
 */
export const getLocalRangeISOForKeys = (fromKey: string, toKey: string): { start: string; end: string } => ({
  start: parseDateKey(fromKey).toISOString(),
  end: parseDateKey(addDaysToKey(toKey, 1)).toISOString(),
});

/** Fecha legible en español, como "3 de noviembre". */
export const formatLongDate = (dateKey: string): string =>
  parseDateKey(dateKey).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' });

/** Encabezado de un grupo de movimientos: "Hoy", "Ayer" o "3 de noviembre". */
export const formatDayLabel = (dateKey: string, hoy: string = toLocalDateKey()): string => {
  const dias = diffInDays(dateKey, hoy);
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Ayer';
  return formatLongDate(dateKey);
};

/** Mediodía local de una fecha 'YYYY-MM-DD' en ISO UTC: queda en ese día sin importar la zona horaria. */
export const getLocalNoonISO = (dateKey: string): string => {
  const d = parseDateKey(dateKey);
  d.setHours(12);
  return d.toISOString();
};

/**
 * Rango [start, end) en ISO UTC que cubre el día local completo.
 * Sirve para consultar columnas guardadas con `toISOString()`:
 *   WHERE fecha >= :start AND fecha < :end
 */
export const getLocalDayRangeISO = (date: Date = new Date()): { start: string; end: string } => {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
};
