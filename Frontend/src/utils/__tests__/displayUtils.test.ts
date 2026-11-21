import { describe, test, expect } from '@jest/globals';
import { parseAmountInput, parseRateInput, speakAmount } from '../currencyUtils';
import { formatDayLabel } from '../dateUtils';

describe('speakAmount', () => {
  test.each([
    [320, 'MXN', '320 pesos'],
    [1, 'MXN', '1 peso'],
    [320.5, 'MXN', '320 pesos con 50 centavos'],
    [0.01, 'MXN', '0 pesos con 1 centavo'],
    [-40, 'MXN', '40 pesos'],
    [20, 'USD', '20 dólares'],
    [1, 'USD', '1 dólar'],
    [19.99, 'MXN', '19 pesos con 99 centavos'],
  ])('%d %s', (monto, moneda, esperado) => {
    expect(speakAmount(monto, moneda)).toBe(esperado);
  });
});

describe('formatDayLabel', () => {
  const HOY = '2026-11-04';
  test('hoy', () => expect(formatDayLabel(HOY, HOY)).toBe('Hoy'));
  test('ayer', () => expect(formatDayLabel('2026-11-03', HOY)).toBe('Ayer'));
  test('ayer cruzando de mes', () => expect(formatDayLabel('2026-10-31', '2026-11-01')).toBe('Ayer'));
  test('otro día muestra la fecha', () => expect(formatDayLabel('2026-11-02', HOY)).toMatch(/^2 de noviembre$/));
});

describe('parseAmountInput (casos límite de la rúbrica)', () => {
  test('acepta montos normales y con comas de miles', () => {
    expect(parseAmountInput('85')).toBe(85);
    expect(parseAmountInput('1,250.5')).toBe(1250.5);
    expect(parseAmountInput(' 99.99 ')).toBe(99.99);
  });
  test('rechaza texto, negativos, más de 2 decimales y montos enormes', () => {
    for (const malo of ['', 'abc', '12abc', '-50', '1.234', '1e5', '100000000']) {
      expect(parseAmountInput(malo)).toBeNaN();
    }
  });
  test('el tipo de cambio admite 4 decimales', () => {
    expect(parseRateInput('17.2345')).toBe(17.2345);
    expect(parseRateInput('17.23456')).toBeNaN();
  });
});
