import { describe, test, expect } from '@jest/globals';
import { filterTransactions, groupByDay } from '../historyUtils';

const noonOf = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).toISOString();

const ITEMS = [
  { id: 1, fecha: noonOf(2026, 11, 4), concepto: 'Café', categoria_id: 1 },
  { id: 2, fecha: noonOf(2026, 11, 4), concepto: 'Gasolina', categoria_id: 2 },
  { id: 3, fecha: noonOf(2026, 11, 2), concepto: 'Cafetería', categoria_id: 1 },
  { id: 4, fecha: noonOf(2026, 11, 1), concepto: 'Sin categoría', categoria_id: null },
];

const ids = (items: { id: number }[]) => items.map((i) => i.id);

describe('filterTransactions', () => {
  test('sin filtros devuelve todo', () => expect(ids(filterTransactions(ITEMS, '', null))).toEqual([1, 2, 3, 4]));
  test('busca sin distinguir acentos', () => expect(ids(filterTransactions(ITEMS, 'cafe', null))).toEqual([1, 3]));
  test('busca sin distinguir mayúsculas', () => expect(ids(filterTransactions(ITEMS, 'GASO', null))).toEqual([2]));
  test('ignora espacios alrededor', () => expect(ids(filterTransactions(ITEMS, '  gaso ', null))).toEqual([2]));
  test('filtra por categoría', () => expect(ids(filterTransactions(ITEMS, '', 1))).toEqual([1, 3]));
  test('combina búsqueda y categoría', () => expect(ids(filterTransactions(ITEMS, 'cafeteria', 1))).toEqual([3]));
  test('sin coincidencias', () => expect(filterTransactions(ITEMS, 'zzz', null)).toEqual([]));
});

describe('groupByDay', () => {
  test('agrupa por día conservando el orden', () => {
    const groups = groupByDay(ITEMS);
    expect(groups.map((g) => g.day)).toEqual(['2026-11-04', '2026-11-02', '2026-11-01']);
    expect(ids(groups[0].items)).toEqual([1, 2]);
  });
  test('lista vacía', () => expect(groupByDay([])).toEqual([]));
});
