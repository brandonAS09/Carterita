import { describe, test, expect } from '@jest/globals';
import { parseVoiceExpense } from '../voiceExpenseParser';

type Expected = {
  monto: number | null;
  concepto?: string;
  categoria?: string | null;
  moneda?: 'MXN' | 'USD';
};

const cases = (title: string, rows: [string, Expected][]) =>
  describe(title, () => {
    test.each(rows)('%s', (frase, expected) => {
      const r = parseVoiceExpense(frase, 'MXN');
      expect(r.monto).toBe(expected.monto);
      if (expected.concepto !== undefined) expect(r.concepto).toBe(expected.concepto);
      if (expected.categoria !== undefined) expect(r.categoria).toBe(expected.categoria);
      if (expected.moneda !== undefined) expect(r.moneda).toBe(expected.moneda);
    });
  });

// ── Escenarios del Sprint2_Specs ──
cases('Criterios de aceptación F03', [
  ['Gasté 85 pesos en gasolina', { monto: 85, concepto: 'Gasolina', categoria: 'Transporte', moneda: 'MXN' }],
  ['Me costó ciento veinte con cincuenta la comida', { monto: 120.5, concepto: 'Comida', categoria: 'Comida' }],
  ['Compré 2 tacos de 30 pesos', { monto: 30, concepto: '2 tacos', categoria: 'Comida' }],
  ['Hola buen día', { monto: null, categoria: null }],
  ['Compré un café de 45 pesos', { monto: 45, concepto: 'Café', categoria: 'Comida' }],
]);

cases('Montos con dígitos', [
  ['Compré un café por 60 pesos', { monto: 60, concepto: 'Café', categoria: 'Comida' }],
  ['Gasté $85 en el cine', { monto: 85, concepto: 'Cine', categoria: 'Entretenimiento' }],
  ['Uber al aeropuerto 230', { monto: 230, concepto: 'Uber al aeropuerto', categoria: 'Transporte' }],
  ['Pagué la luz, fueron 450 pesos', { monto: 450, concepto: 'Luz', categoria: 'Servicios' }],
  ['Gasté 1,200 en ropa', { monto: 1200, concepto: 'Ropa', categoria: 'Compras' }],
  ['Compré tenis de 1.200', { monto: 1200, concepto: 'Tenis', categoria: 'Compras' }],
  ['85.50 en la farmacia', { monto: 85.5, concepto: 'Farmacia', categoria: 'Salud' }],
  ['Gasté 85,50 en medicina', { monto: 85.5, concepto: 'Medicina', categoria: 'Salud' }],
  ['Netflix 199', { monto: 199, concepto: 'Netflix', categoria: 'Entretenimiento' }],
  ['Recarga de 100', { monto: 100, concepto: 'Recarga', categoria: 'Servicios' }],
  ['Pagué el internet 499', { monto: 499, concepto: 'Internet', categoria: 'Servicios' }],
  ['La cena costó 450', { monto: 450, concepto: 'Cena', categoria: 'Comida' }],
  ['Me gasté 75 pesos en un libro', { monto: 75, concepto: 'Libro', categoria: 'Educación' }],
  ['Pagué 2 mil de renta', { monto: 2000, concepto: 'Renta', categoria: 'Servicios' }],
  ['Pagué 450 del internet', { monto: 450, concepto: 'Internet', categoria: 'Servicios' }],
]);

cases('Montos en palabras', [
  ['Gasté cuarenta y cinco en el oxxo', { monto: 45, concepto: 'Oxxo', categoria: 'Comida' }],
  ['Doscientos cincuenta y cinco pesos de despensa', { monto: 255, concepto: 'Despensa', categoria: 'Comida' }],
  ['Mil quinientos de colegiatura', { monto: 1500, concepto: 'Colegiatura', categoria: 'Educación' }],
  ['Dos mil quinientos pesos de renta', { monto: 2500, concepto: 'Renta', categoria: 'Servicios' }],
  ['Gasté dos mil trescientos cincuenta en la colegiatura', { monto: 2350, categoria: 'Educación' }],
  ['Gasté cien pesos en el gimnasio', { monto: 100, concepto: 'Gimnasio', categoria: 'Salud' }],
  ['Didi a la universidad por ochenta pesos', { monto: 80, concepto: 'Didi a la universidad', categoria: 'Transporte' }],
  ['Gasté noventa y nueve en Spotify', { monto: 99, concepto: 'Spotify', categoria: 'Entretenimiento' }],
  ['Veintitrés pesos de pan', { monto: 23, concepto: 'Pan', categoria: 'Comida' }],
  ['Trescientos en el cine con mis amigos', { monto: 300, concepto: 'Cine con mis amigos', categoria: 'Entretenimiento' }],
  ['Gasté mil pesos', { monto: 1000, concepto: 'Gasto por voz', categoria: null }],
  ['Quince pesos de copias', { monto: 15, concepto: 'Copias', categoria: 'Educación' }],
]);

cases('Centavos y fracciones', [
  ['Veinte pesos con cincuenta centavos de copias', { monto: 20.5, concepto: 'Copias', categoria: 'Educación' }],
  ['Gasté veinte y medio en un refresco', { monto: 20.5, concepto: 'Refresco', categoria: 'Comida' }],
  ['85 con 50 de gasolina', { monto: 85.5, concepto: 'Gasolina', categoria: 'Transporte' }],
  ['Treinta con cincuenta pesos de pan', { monto: 30.5, concepto: 'Pan', categoria: 'Comida' }],
]);

cases('Expresiones coloquiales', [
  ['Le puse 300 varos de gasolina', { monto: 300, concepto: 'Gasolina', categoria: 'Transporte', moneda: 'MXN' }],
  ['100 baros en el súper', { monto: 100, concepto: 'Súper', categoria: 'Comida' }],
  ['Una cerveza de 40', { monto: 40, concepto: 'Cerveza', categoria: 'Entretenimiento' }],
  ['Un peso de chicle', { monto: 1, concepto: 'Chicle', categoria: null }],
  ['Acabo de gastar 50 en tacos', { monto: 50, concepto: 'Tacos', categoria: 'Comida' }],
]);

cases('Varias cifras en la frase', [
  ['Gasté 50 en 2 tacos', { monto: 50, concepto: '2 tacos', categoria: 'Comida' }],
  ['Dos cafés en 90', { monto: 90, concepto: 'Dos cafés', categoria: 'Comida' }],
  ['Compré 3 kilos de tortillas por 60 pesos', { monto: 60, concepto: '3 kilos de tortillas', categoria: 'Comida' }],
  ['Compré 2 cuadernos de 35 pesos', { monto: 35, concepto: '2 cuadernos', categoria: 'Educación' }],
]);

cases('Categorías especiales y multipalabra', [
  ['Uber Eats de 230', { monto: 230, concepto: 'Uber Eats', categoria: 'Comida' }],
  ['Pedí en Mercado Libre unos audífonos de 350', { monto: 350, concepto: 'Mercado Libre unos audífonos', categoria: 'Compras' }],
  ['Consulta con el dentista 600 pesos', { monto: 600, concepto: 'Consulta con el dentista', categoria: 'Salud' }],
]);

cases('Sin monto válido', [
  ['Gasté 0 pesos', { monto: null }],
  ['Fui al cine con mis amigos', { monto: null, categoria: 'Entretenimiento' }],
  ['', { monto: null, concepto: 'Gasto por voz' }],
]);

describe('Moneda (D1)', () => {
  test('dólares con presupuesto en MXN', () => {
    const r = parseVoiceExpense('Gasté 20 dólares en Amazon', 'MXN');
    expect(r).toMatchObject({ monto: 20, moneda: 'USD', monedaDetectada: true, concepto: 'Amazon', categoria: 'Compras' });
  });

  test('abreviatura dls', () => {
    const r = parseVoiceExpense('Pagué 15 dls de Spotify', 'MXN');
    expect(r).toMatchObject({ monto: 15, moneda: 'USD', concepto: 'Spotify' });
  });

  test('pesos con presupuesto en USD', () => {
    const r = parseVoiceExpense('Gasté 300 pesos en comida', 'USD');
    expect(r).toMatchObject({ monto: 300, moneda: 'MXN', monedaDetectada: true });
  });

  test('sin moneda mencionada → moneda del presupuesto', () => {
    const r = parseVoiceExpense('Gasté 20 en tacos', 'USD');
    expect(r).toMatchObject({ monto: 20, moneda: 'USD', monedaDetectada: false });
  });
});

describe('Robustez del texto', () => {
  test('sin acentos ni mayúsculas (salida típica del reconocedor)', () => {
    expect(parseVoiceExpense('gaste ochenta y cinco pesos en gasolina', 'MXN')).toMatchObject({
      monto: 85, concepto: 'Gasolina', categoria: 'Transporte',
    });
  });

  test('signos de puntuación', () => {
    expect(parseVoiceExpense('¡Gasté 120 pesos en pizza!', 'MXN')).toMatchObject({
      monto: 120, concepto: 'Pizza', categoria: 'Comida',
    });
  });

  test('concepto limitado a 80 caracteres', () => {
    const r = parseVoiceExpense(`Gasté 50 en ${'muchas cosas '.repeat(20)}`, 'MXN');
    expect(r.concepto.length).toBeLessThanOrEqual(80);
  });
});

describe('Confianza', () => {
  test('alta: monto + categoría', () => {
    expect(parseVoiceExpense('Gasté 85 en gasolina', 'MXN').confianza).toBe('alta');
  });
  test('media: solo monto', () => {
    expect(parseVoiceExpense('Gasté 85 en cosas', 'MXN').confianza).toBe('media');
  });
  test('baja: sin monto', () => {
    expect(parseVoiceExpense('Hola buen día', 'MXN').confianza).toBe('baja');
  });
});
