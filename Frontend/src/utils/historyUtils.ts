import { toLocalDateKey } from './dateUtils';

interface HistoryItem {
  fecha: string;
  concepto: string;
  categoria_id: number | null;
}

const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

/** Búsqueda por concepto (sin distinguir mayúsculas ni acentos) y filtro por categoría. */
export const filterTransactions = <T extends HistoryItem>(items: T[], query: string, categoriaId: number | null): T[] => {
  const needle = normalize(query);
  return items.filter(
    (item) =>
      (categoriaId === null || item.categoria_id === categoriaId) && (!needle || normalize(item.concepto).includes(needle))
  );
};

/** Agrupa por día local, conservando el orden en que llegan los movimientos. */
export const groupByDay = <T extends Pick<HistoryItem, 'fecha'>>(items: T[]): { day: string; items: T[] }[] => {
  const groups: { day: string; items: T[] }[] = [];
  for (const item of items) {
    const day = toLocalDateKey(new Date(item.fecha));
    const last = groups[groups.length - 1];
    if (last?.day === day) last.items.push(item);
    else groups.push({ day, items: [item] });
  }
  return groups;
};
