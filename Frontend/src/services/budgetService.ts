import { api, ApiError } from '../api/client';
import { addDaysToKey } from '../utils/dateUtils';
import { Moneda } from '../utils/currencyUtils';

export type TipoCiclo = 'Diario' | 'Semanal' | 'Mensual';

export interface Presupuesto {
  id: number;
  usuario_id: number;
  monto_base: number;
  tipo_ciclo: TipoCiclo;
  moneda: Moneda;
  fecha_inicio: string; // 'YYYY-MM-DD' local
  fecha_fin: string; // 'YYYY-MM-DD' local, inclusiva
  tipo_cambio_usd: number | null; // última tasa usada: 1 USD = X MXN
}

export interface BudgetChanges {
  montoBase: number; // ya expresado en la moneda destino
  tipoCiclo: TipoCiclo;
  moneda: Moneda;
  tipoCambioUsd?: number; // obligatorio si cambia la moneda
}

const DIAS_POR_CICLO: Record<TipoCiclo, number> = { Diario: 1, Semanal: 7, Mensual: 30 };

/** Sin presupuesto el servidor responde 404: para la app eso es "todavía no lo configura". */
const presupuestoONull = async (): Promise<Presupuesto | null> => {
  try {
    return (await api<{ presupuesto: Presupuesto }>('/presupuesto')).presupuesto;
  } catch (error) {
    if (error instanceof ApiError && error.tipo === 'NoEncontrado') return null;
    throw error;
  }
};

/**
 * El `userId` se conserva en las firmas para no cambiar las pantallas;
 * el servidor identifica al usuario por su token.
 */
export const budgetService = {
  getBudgetByUserId: async (_userId: number): Promise<Presupuesto | null> => presupuestoONull(),

  /** F06: el servidor renueva el ciclo si ya terminó. */
  ensureCurrentCycle: async (_userId: number): Promise<Presupuesto | null> => presupuestoONull(),

  createBudget: async (_userId: number, montoBase: number, tipoCiclo: TipoCiclo, moneda: Moneda): Promise<Presupuesto> =>
    (await api<{ presupuesto: Presupuesto }>('/presupuesto', { method: 'POST', body: { montoBase, tipoCiclo, moneda } }))
      .presupuesto,

  /** S1.1-06: el servidor aplica todo en una transacción (incluida la conversión de moneda). */
  updateBudget: async (_userId: number, changes: BudgetChanges): Promise<Presupuesto> =>
    (await api<{ presupuesto: Presupuesto }>('/presupuesto', { method: 'PUT', body: changes })).presupuesto,

  setExchangeRate: async (_userId: number, tipoCambioUsd: number): Promise<void> => {
    await api('/presupuesto/tipo-cambio', { method: 'PUT', body: { tipoCambioUsd } });
  },

  // Último día (inclusivo) del ciclo: Diario = mismo día, Semanal = +6, Mensual = +29
  calculateCycleEnd: (fechaInicio: string, tipoCiclo: TipoCiclo): string =>
    addDaysToKey(fechaInicio, DIAS_POR_CICLO[tipoCiclo] - 1),

  // Cálculo preliminar (estático) del límite diario según el ciclo elegido
  calculateDailyLimit: (montoBase: number, tipoCiclo: TipoCiclo): number => {
    if (montoBase <= 0 || isNaN(montoBase)) return 0;
    return montoBase / DIAS_POR_CICLO[tipoCiclo];
  },
};
