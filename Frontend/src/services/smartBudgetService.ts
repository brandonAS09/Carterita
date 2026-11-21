import { api, ApiError } from '../api/client';
import type { Presupuesto } from './budgetService';
import type { SmartBudgetResult } from '../utils/smartBudgetCalculator';

export interface TodayBudgetSummary extends SmartBudgetResult {
  presupuesto: Presupuesto;
  gastadoHoy: number;
}

/** F06: el servidor calcula el resumen del día con la fecha local del teléfono. */
export const smartBudgetService = {
  getTodaySummary: async (_userId: number): Promise<TodayBudgetSummary | null> => {
    try {
      return (await api<{ resumen: TodayBudgetSummary }>('/resumen/hoy')).resumen;
    } catch (error) {
      if (error instanceof ApiError && error.tipo === 'NoEncontrado') return null;
      throw error;
    }
  },
};
