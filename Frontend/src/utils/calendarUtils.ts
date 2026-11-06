import { diffInDays } from './dateUtils';

export interface CalendarDay {
  key: string; // 'YYYY-MM-DD'
  day: number;
  isFuture: boolean;
}

const pad = (n: number) => n.toString().padStart(2, '0');

/**
 * Semanas de un mes para el selector de fecha (D21), de lunes a domingo.
 * `month` va de 1 a 12. Los huecos antes y después del mes son null.
 */
export const buildMonthGrid = (year: number, month: number, hoy: string): (CalendarDay | null)[][] => {
  const daysInMonth = new Date(year, month, 0).getDate();
  const leadingBlanks = (new Date(year, month - 1, 1).getDay() + 6) % 7; // lunes = 0

  const cells: (CalendarDay | null)[] = Array.from({ length: leadingBlanks }, () => null);
  for (let day = 1; day <= daysInMonth; day++) {
    const key = `${year}-${pad(month)}-${pad(day)}`;
    cells.push({ key, day, isFuture: diffInDays(key, hoy) < 0 });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (CalendarDay | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
};

/** Mes anterior o siguiente, cruzando de año si hace falta. */
export const shiftMonth = (year: number, month: number, delta: number): { year: number; month: number } => {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
};

/** Solo se puede avanzar hasta el mes de hoy: los días futuros no se eligen. */
export const canGoToNextMonth = (year: number, month: number, hoy: string): boolean => {
  const [hoyYear, hoyMonth] = hoy.split('-').map(Number);
  return year < hoyYear || (year === hoyYear && month < hoyMonth);
};
