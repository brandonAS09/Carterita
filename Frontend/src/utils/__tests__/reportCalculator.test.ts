import { describe, test, expect } from '@jest/globals';
import { buildDonutSlices, buildReport, CategoryTotal, getReportPeriods, ReportRow } from '../reportCalculator';

const noon = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12).toISOString();
};

const row = (monto: number, day: string, id: number | null = 1, nombre: string | null = 'Comida'): ReportRow => ({
  monto,
  fecha: noon(day),
  categoria_id: id,
  categoria_nombre: nombre,
  categoria_icono: null,
});

const PERIOD = { from: '2026-11-01', to: '2026-11-03' };

describe('getReportPeriods', () => {
  test('ciclo semanal a mitad de ciclo', () => {
    const [cycle, previous, last30] = getReportPeriods('Semanal', '2026-11-02', '2026-11-08', '2026-11-04');
    expect(cycle).toMatchObject({ from: '2026-11-02', to: '2026-11-04', prevFrom: '2026-10-26', prevTo: '2026-10-28', isCycle: true });
    expect(previous).toMatchObject({ from: '2026-10-26', to: '2026-11-01', prevFrom: '2026-10-19', prevTo: '2026-10-25' });
    expect(last30).toMatchObject({ from: '2026-10-06', to: '2026-11-04', isCycle: false });
  });

  test('cruza de año', () => {
    const [cycle] = getReportPeriods('Mensual', '2027-01-01', '2027-01-30', '2027-01-02');
    expect(cycle.prevFrom).toBe('2026-12-02');
    expect(cycle.prevTo).toBe('2026-12-03');
  });

  test('D24: ciclo diario usa 7 y 30 días', () => {
    const periods = getReportPeriods('Diario', '2026-11-04', '2026-11-04', '2026-11-04');
    expect(periods.map((p) => p.key)).toEqual(['last7', 'last30']);
    expect(periods[0]).toMatchObject({ from: '2026-10-29', prevFrom: '2026-10-22', prevTo: '2026-10-28' });
  });
});

describe('buildReport', () => {
  test('Escenario 9: los totales por categoría suman el total', () => {
    const report = buildReport(
      [row(100, '2026-11-01'), row(50.5, '2026-11-02', 2, 'Transporte'), row(49.5, '2026-11-02', null, null)],
      [],
      PERIOD
    );
    expect(report.total).toBe(200);
    expect(report.categories.reduce((sum, c) => sum + c.total, 0)).toBe(200);
    expect(report.categories.map((c) => [c.nombre, c.pct])).toEqual([
      ['Comida', 50],
      ['Transporte', 25],
      ['Sin categoría', 25],
    ]);
  });

  test('incluye todos los días del período, también los que no tienen gastos', () => {
    const report = buildReport([row(10, '2026-11-02')], [], PERIOD);
    expect(report.days).toEqual([
      { day: '2026-11-01', total: 0 },
      { day: '2026-11-02', total: 10 },
      { day: '2026-11-03', total: 0 },
    ]);
  });

  test('Escenario 10: sin gastos', () => {
    const report = buildReport([], [], PERIOD);
    expect(report).toMatchObject({ total: 0, changePct: null, categories: [], insights: [] });
  });

  test('compara con el período anterior', () => {
    expect(buildReport([row(120, '2026-11-01')], [row(100, '2026-10-20')], PERIOD).changePct).toBe(20);
    expect(buildReport([row(50, '2026-11-01')], [row(100, '2026-10-20')], PERIOD).changePct).toBe(-50);
  });

  test('sin gastos en el período anterior no hay comparación', () => {
    expect(buildReport([row(120, '2026-11-01')], [], PERIOD).changePct).toBeNull();
  });
});

describe('hallazgos', () => {
  test('mayor gasto y cambio notable', () => {
    const report = buildReport(
      [row(120, '2026-11-01'), row(80, '2026-11-02', 2, 'Transporte')],
      [row(100, '2026-10-20')],
      PERIOD
    );
    expect(report.insights).toEqual([
      'Comida es tu mayor gasto: 60 %',
      'Gastaste 20 % más en Comida que en el período anterior',
    ]);
  });

  test('una sola categoría no es un hallazgo', () => {
    expect(buildReport([row(100, '2026-11-01')], [], PERIOD).insights).toEqual([]);
  });

  test('un cambio pequeño no se menciona', () => {
    const report = buildReport([row(105, '2026-11-01')], [row(100, '2026-10-20')], PERIOD);
    expect(report.insights).toEqual([]);
  });

  test('una categoría nueva no se compara', () => {
    const report = buildReport(
      [row(100, '2026-11-01', 2, 'Transporte'), row(10, '2026-11-01')],
      [row(10, '2026-10-20')],
      PERIOD
    );
    expect(report.insights).toEqual(['Transporte es tu mayor gasto: 91 %']);
  });

  test('"Sin categoría" no se presenta como mayor gasto', () => {
    const report = buildReport([row(100, '2026-11-01', null, null), row(10, '2026-11-01')], [], PERIOD);
    expect(report.insights).toEqual([]);
  });

  test('menciona una baja', () => {
    const report = buildReport([row(50, '2026-11-01')], [row(100, '2026-10-20')], PERIOD);
    expect(report.insights).toEqual(['Gastaste 50 % menos en Comida que en el período anterior']);
  });
});

describe('buildDonutSlices', () => {
  const category = (nombre: string, total: number, id: number | null = 1): CategoryTotal => ({
    id,
    nombre,
    icono: null,
    total,
    pct: 0,
  });

  test('cada categoría conserva su color y el orden sigue la paleta, no el monto', () => {
    const slices = buildDonutSlices([category('Salud', 300), category('Comida', 100)]);
    expect(slices.map((s) => [s.label, s.slot])).toEqual([
      ['Comida', 0],
      ['Salud', 3],
    ]);
  });

  test('"Otros" y "Sin categoría" van en "Resto" con color neutro', () => {
    const slices = buildDonutSlices([category('Comida', 100), category('Otros', 20), category('Sin categoría', 30, null)]);
    expect(slices[1]).toEqual({ key: 'resto', label: 'Resto', total: 50, slot: null });
  });

  test('más de 6 categorías se agrupan', () => {
    const slices = buildDonutSlices([
      category('Comida', 70),
      category('Transporte', 60),
      category('Entretenimiento', 50),
      category('Salud', 40),
      category('Compras', 30),
      category('Educación', 20),
      category('Servicios', 10),
    ]);
    expect(slices).toHaveLength(7);
    expect(slices[6]).toEqual({ key: 'resto', label: 'Resto', total: 10, slot: null });
    expect(slices.reduce((sum, s) => sum + s.total, 0)).toBe(280);
  });

  test('sin categorías no hay rebanadas', () => {
    expect(buildDonutSlices([])).toEqual([]);
  });
});
