import { describe, test, expect } from '@jest/globals';
import { buildMonthGrid, canGoToNextMonth, shiftMonth } from '../calendarUtils';
import { normalizeConceptKey, pickSuggestedCategory } from '../categoryLearning';

describe('buildMonthGrid', () => {
  test('noviembre de 2026 empieza en domingo: seis huecos antes del día 1', () => {
    const weeks = buildMonthGrid(2026, 11, '2026-11-06');
    expect(weeks[0].slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(weeks[0][6]?.key).toBe('2026-11-01');
    expect(weeks.flat().filter(Boolean)).toHaveLength(30);
    weeks.forEach((week) => expect(week).toHaveLength(7));
  });

  test('febrero bisiesto', () => {
    expect(buildMonthGrid(2028, 2, '2030-01-01').flat().filter(Boolean)).toHaveLength(29);
  });

  test('marca los días futuros', () => {
    const days = buildMonthGrid(2026, 11, '2026-11-06').flat();
    expect(days.find((d) => d?.day === 6)?.isFuture).toBe(false);
    expect(days.find((d) => d?.day === 7)?.isFuture).toBe(true);
  });
});

describe('navegación de meses', () => {
  test('cruza de año en ambos sentidos', () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2027, 1, -1)).toEqual({ year: 2026, month: 12 });
  });

  test('no avanza más allá del mes actual', () => {
    expect(canGoToNextMonth(2026, 11, '2026-11-06')).toBe(false);
    expect(canGoToNextMonth(2026, 10, '2026-11-06')).toBe(true);
    expect(canGoToNextMonth(2025, 12, '2026-01-06')).toBe(true);
  });
});

describe('normalizeConceptKey (D23)', () => {
  test.each([
    ['Abarrotes Lupita', 'abarrotes lupita'],
    ['  abarrotes   LUPITA. ', 'abarrotes lupita'],
    ['Café', 'cafe'],
    ['7-Eleven', '7 eleven'],
    ['***', ''],
  ])('%s', (concepto, clave) => {
    expect(normalizeConceptKey(concepto)).toBe(clave);
  });

  test('"Café" y "Cafetería Luna" son claves distintas', () => {
    expect(normalizeConceptKey('Café')).not.toBe(normalizeConceptKey('Cafetería Luna'));
  });
});

describe('pickSuggestedCategory', () => {
  test('Escenario 8: lo aprendido gana al diccionario', () => {
    expect(pickSuggestedCategory('Comida', 'Servicios')).toBe('Comida');
  });
  test('sin aprendizaje usa el diccionario', () => {
    expect(pickSuggestedCategory(null, 'Servicios')).toBe('Servicios');
  });
  test('sin ninguno, no sugiere', () => {
    expect(pickSuggestedCategory(null, null)).toBeNull();
  });
});
