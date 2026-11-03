import { calculateSmartBudget, SmartBudgetInput } from './smartBudgetCalculator';
import { diffInDays } from './dateUtils';
import { round2 } from './currencyUtils';

/**
 * F07 - Cálculos puros de metas de ahorro (probados con Jest).
 */

export type TipoAporte = 'Excedente' | 'Abono';

export interface GoalProgress {
  restante: number;   // lo que falta para completar (>= 0)
  progreso: number;   // 0..1
  completada: boolean;
}

export const getGoalProgress = (montoObjetivo: number, montoAcumulado: number): GoalProgress => {
  const restante = Math.max(0, round2(montoObjetivo - montoAcumulado));
  return {
    restante,
    progreso: montoObjetivo > 0 ? Math.min(1, Math.max(0, montoAcumulado / montoObjetivo)) : 0,
    completada: montoObjetivo > 0 && restante <= 0,
  };
};

/**
 * Excedente de un día = límite inteligente de ese día − lo gastado ese día (solo si es positivo).
 * `input.hoy` es el día evaluado (normalmente "ayer"); `aportadoEnCiclo` son los excedentes
 * movidos de días ANTERIORES a ese día.
 */
export const calculateDaySurplus = (input: SmartBudgetInput): number =>
  Math.max(0, round2(calculateSmartBudget(input).disponibleHoy));

export type ContributionResult =
  | { ok: true; aportado: number; completa: boolean }
  | { ok: false; error: 'meta-completada' | 'monto-invalido' | 'excede-restante'; restante: number };

/**
 * Reglas de aporte:
 *  - Excedente: se mueve hasta lo que falta; el resto se queda en el presupuesto.
 *  - Abono: no puede superar lo que falta (Escenario 6).
 */
export const computeContribution = (monto: number, restante: number, tipo: TipoAporte): ContributionResult => {
  if (restante <= 0) return { ok: false, error: 'meta-completada', restante: 0 };
  if (!(monto > 0) || !isFinite(monto)) return { ok: false, error: 'monto-invalido', restante };
  const montoRedondeado = round2(monto);
  if (tipo === 'Abono' && montoRedondeado > restante) return { ok: false, error: 'excede-restante', restante };
  const aportado = Math.min(montoRedondeado, restante);
  return { ok: true, aportado, completa: round2(restante - aportado) <= 0 };
};

/** Días hasta la fecha límite (negativo si ya venció); null si no hay fecha. */
export const daysUntilDeadline = (fechaLimite: string | null, hoy: string): number | null =>
  fechaLimite ? diffInDays(hoy, fechaLimite) : null;
