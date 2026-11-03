import { describe, test, expect } from '@jest/globals';
import { calculateSmartBudget, resolveCurrentCycle } from '../smartBudgetCalculator';

// Ciclo semanal de $1,400 → límite base $200/día (ejemplo del Sprint2_Specs)
const semanal = { montoBase: 1400, fechaInicio: '2026-11-02', fechaFin: '2026-11-08' };

describe('calculateSmartBudget (F06)', () => {
  test('Escenario 5: primer día del ciclo → límite = base, sin ajuste', () => {
    const r = calculateSmartBudget({ ...semanal, hoy: '2026-11-02', gastadoAntesDeHoy: 0, gastadoHoy: 0, aportadoEnCiclo: 0 });
    expect(r.limiteBase).toBeCloseTo(200);
    expect(r.limiteHoy).toBeCloseTo(200);
    expect(r.diasRestantes).toBe(7);
    expect(r.ajuste).toBe('ninguno');
  });

  test('Escenario 1: ayer gastó $50 de $200 → hoy sube a $225', () => {
    const r = calculateSmartBudget({ ...semanal, hoy: '2026-11-03', gastadoAntesDeHoy: 50, gastadoHoy: 0, aportadoEnCiclo: 0 });
    expect(r.limiteHoy).toBeCloseTo(225);
    expect(r.diasRestantes).toBe(6);
    expect(r.ajuste).toBe('alza');
  });

  test('Escenario 2: ayer gastó $500 de $200 → hoy baja a $150', () => {
    const r = calculateSmartBudget({ ...semanal, hoy: '2026-11-03', gastadoAntesDeHoy: 500, gastadoHoy: 0, aportadoEnCiclo: 0 });
    expect(r.limiteHoy).toBeCloseTo(150);
    expect(r.ajuste).toBe('baja');
    expect(r.cicloAgotado).toBe(false);
  });

  test('gastar exactamente el límite no genera mensaje de ajuste', () => {
    const r = calculateSmartBudget({ ...semanal, hoy: '2026-11-04', gastadoAntesDeHoy: 400, gastadoHoy: 0, aportadoEnCiclo: 0 });
    expect(r.limiteHoy).toBeCloseTo(200);
    expect(r.ajuste).toBe('ninguno');
  });

  test('los gastos de hoy reducen el disponible pero no el límite de hoy', () => {
    const r = calculateSmartBudget({ ...semanal, hoy: '2026-11-03', gastadoAntesDeHoy: 200, gastadoHoy: 80, aportadoEnCiclo: 0 });
    expect(r.limiteHoy).toBeCloseTo(200);
    expect(r.disponibleHoy).toBeCloseTo(120);
    expect(r.saldoRestanteCiclo).toBeCloseTo(1120);
  });

  test('disponible negativo cuando hoy se excede el límite', () => {
    const r = calculateSmartBudget({ ...semanal, hoy: '2026-11-03', gastadoAntesDeHoy: 200, gastadoHoy: 260, aportadoEnCiclo: 0 });
    expect(r.disponibleHoy).toBeCloseTo(-60);
  });

  test('Escenario 3: saldo agotado → límite 0 y fecha de renovación', () => {
    const r = calculateSmartBudget({ ...semanal, hoy: '2026-11-05', gastadoAntesDeHoy: 1500, gastadoHoy: 0, aportadoEnCiclo: 0 });
    expect(r.limiteHoy).toBe(0);
    expect(r.cicloAgotado).toBe(true);
    expect(r.fechaRenovacion).toBe('2026-11-09');
  });

  test('último día del ciclo: todo el saldo restante está disponible hoy', () => {
    const r = calculateSmartBudget({ ...semanal, hoy: '2026-11-08', gastadoAntesDeHoy: 1000, gastadoHoy: 0, aportadoEnCiclo: 0 });
    expect(r.diasRestantes).toBe(1);
    expect(r.limiteHoy).toBeCloseTo(400);
  });

  test('aportes a metas (F07) se descuentan del saldo del ciclo', () => {
    const r = calculateSmartBudget({ ...semanal, hoy: '2026-11-03', gastadoAntesDeHoy: 50, gastadoHoy: 0, aportadoEnCiclo: 150 });
    expect(r.limiteHoy).toBeCloseTo(200); // el excedente se fue a la meta, no sube el límite
    expect(r.ajuste).toBe('ninguno');
  });

  test('ciclo diario: límite siempre igual al monto base', () => {
    const r = calculateSmartBudget({ montoBase: 300, fechaInicio: '2026-11-03', fechaFin: '2026-11-03', hoy: '2026-11-03', gastadoAntesDeHoy: 0, gastadoHoy: 100, aportadoEnCiclo: 0 });
    expect(r.limiteHoy).toBe(300);
    expect(r.disponibleHoy).toBe(200);
  });

  test('ciclo mensual a través del cambio de horario (inicio de noviembre)', () => {
    const r = calculateSmartBudget({ montoBase: 6000, fechaInicio: '2026-10-25', fechaFin: '2026-11-23', hoy: '2026-11-02', gastadoAntesDeHoy: 1600, gastadoHoy: 0, aportadoEnCiclo: 0 });
    expect(r.diasRestantes).toBe(22);
    expect(r.limiteHoy).toBeCloseTo(4400 / 22);
  });
});

describe('resolveCurrentCycle (renovación automática)', () => {
  const ciclo = { fechaInicio: '2026-11-02', fechaFin: '2026-11-08' };

  test('ciclo vigente no cambia', () => {
    expect(resolveCurrentCycle(ciclo, '2026-11-08')).toEqual({ ...ciclo, renovado: false });
  });

  test('Escenario 4: el ciclo terminó ayer → nuevo ciclo inicia hoy', () => {
    expect(resolveCurrentCycle(ciclo, '2026-11-09')).toEqual({ fechaInicio: '2026-11-09', fechaFin: '2026-11-15', renovado: true });
  });

  test('varios ciclos sin abrir la app → calendario continuo', () => {
    // 3 semanas después: 09-15, 16-22, 23-29 → hoy (25) cae en el tercero
    expect(resolveCurrentCycle(ciclo, '2026-11-25')).toEqual({ fechaInicio: '2026-11-23', fechaFin: '2026-11-29', renovado: true });
  });

  test('último día exacto de un ciclo renovado', () => {
    expect(resolveCurrentCycle(ciclo, '2026-11-15')).toEqual({ fechaInicio: '2026-11-09', fechaFin: '2026-11-15', renovado: true });
  });

  test('ciclo diario: avanza al día de hoy', () => {
    expect(resolveCurrentCycle({ fechaInicio: '2026-11-01', fechaFin: '2026-11-01' }, '2026-11-03')).toEqual({ fechaInicio: '2026-11-03', fechaFin: '2026-11-03', renovado: true });
  });

  test('ciclo mensual (30 días) cruzando fin de año', () => {
    expect(resolveCurrentCycle({ fechaInicio: '2026-12-01', fechaFin: '2026-12-30' }, '2027-01-05')).toEqual({ fechaInicio: '2026-12-31', fechaFin: '2027-01-29', renovado: true });
  });
});
