import { describe, test, expect } from '@jest/globals';
import { calculateDaySurplus, computeContribution, daysUntilDeadline, getGoalProgress } from '../goalCalculator';

// Semanal $1,400 (límite base $200/día), del 2 al 8 de noviembre
const semanal = { montoBase: 1400, fechaInicio: '2026-11-02', fechaFin: '2026-11-08' };

describe('calculateDaySurplus (excedente de ayer)', () => {
  test('ahorro: límite 200, gastó 50 → excedente 150', () => {
    expect(calculateDaySurplus({ ...semanal, hoy: '2026-11-02', gastadoAntesDeHoy: 0, gastadoHoy: 50, aportadoEnCiclo: 0 })).toBe(150);
  });

  test('sobregasto → excedente 0 (nunca negativo)', () => {
    expect(calculateDaySurplus({ ...semanal, hoy: '2026-11-02', gastadoAntesDeHoy: 0, gastadoHoy: 260, aportadoEnCiclo: 0 })).toBe(0);
  });

  test('usa el límite inteligente del día (no el base)', () => {
    // día 2: antes gastó 50 → límite 225; gastó 25 → excedente 200
    expect(calculateDaySurplus({ ...semanal, hoy: '2026-11-03', gastadoAntesDeHoy: 50, gastadoHoy: 25, aportadoEnCiclo: 0 })).toBe(200);
  });

  test('excedentes movidos antes reducen el límite del día', () => {
    // día 2: gastó 50 el día 1 y movió 150 a una meta → límite 200; gastó 25 → excedente 175
    expect(calculateDaySurplus({ ...semanal, hoy: '2026-11-03', gastadoAntesDeHoy: 50, gastadoHoy: 25, aportadoEnCiclo: 150 })).toBe(175);
  });
});

describe('computeContribution', () => {
  test('abono válido', () => {
    expect(computeContribution(500, 3000, 'Abono')).toEqual({ ok: true, aportado: 500, completa: false });
  });

  test('Escenario 6: abono mayor a lo que falta se rechaza', () => {
    expect(computeContribution(500, 200, 'Abono')).toEqual({ ok: false, error: 'excede-restante', restante: 200 });
  });

  test('abono exacto completa la meta', () => {
    expect(computeContribution(200, 200, 'Abono')).toEqual({ ok: true, aportado: 200, completa: true });
  });

  test('excedente mayor a lo que falta: solo mueve lo necesario', () => {
    expect(computeContribution(150, 100, 'Excedente')).toEqual({ ok: true, aportado: 100, completa: true });
  });

  test('Escenario 4: meta completada no recibe aportes', () => {
    expect(computeContribution(50, 0, 'Excedente')).toMatchObject({ ok: false, error: 'meta-completada' });
  });

  test('monto inválido', () => {
    expect(computeContribution(0, 100, 'Abono')).toMatchObject({ ok: false, error: 'monto-invalido' });
    expect(computeContribution(NaN, 100, 'Abono')).toMatchObject({ ok: false, error: 'monto-invalido' });
  });

  test('redondea a centavos', () => {
    expect(computeContribution(10.005, 100, 'Abono')).toMatchObject({ ok: true, aportado: 10.01 });
  });
});

describe('getGoalProgress', () => {
  test('progreso parcial', () => {
    expect(getGoalProgress(3000, 750)).toEqual({ restante: 2250, progreso: 0.25, completada: false });
  });
  test('completada', () => {
    expect(getGoalProgress(3000, 3000)).toEqual({ restante: 0, progreso: 1, completada: true });
  });
  test('el progreso nunca pasa de 100 %', () => {
    expect(getGoalProgress(100, 150).progreso).toBe(1);
  });
});

describe('daysUntilDeadline', () => {
  test('sin fecha', () => expect(daysUntilDeadline(null, '2026-11-03')).toBeNull());
  test('faltan 30 días', () => expect(daysUntilDeadline('2026-12-03', '2026-11-03')).toBe(30));
  test('vencida', () => expect(daysUntilDeadline('2026-11-01', '2026-11-03')).toBe(-2));
});
