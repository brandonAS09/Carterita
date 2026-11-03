import { budgetService, Presupuesto } from './budgetService';
import { transactionService } from './transactionService';
import { goalService } from './goalService';
import { calculateSmartBudget, SmartBudgetResult } from '../utils/smartBudgetCalculator';
import { addDaysToKey, toLocalDateKey } from '../utils/dateUtils';
import { round2 } from '../utils/currencyUtils';

export interface TodayBudgetSummary extends SmartBudgetResult {
  presupuesto: Presupuesto;
  gastadoHoy: number;
}

/** F06: orquesta BD + calculador puro para obtener el resumen del día. */
export const smartBudgetService = {
  getTodaySummary: async (userId: number): Promise<TodayBudgetSummary | null> => {
    const presupuesto = await budgetService.ensureCurrentCycle(userId);
    if (!presupuesto) return null;

    const hoy = toLocalDateKey();
    const [gastadoAntesDeHoy, gastadoHoy, aportadoEnCiclo] = await Promise.all([
      // Si hoy es el primer día, el rango queda vacío y el total es 0
      transactionService.getCycleTotal(userId, presupuesto.fecha_inicio, addDaysToKey(hoy, -1)),
      transactionService.getTodayTotal(userId),
      // F07: excedentes movidos a metas cuentan como dinero ya usado del ciclo
      goalService.getSurplusContributionsBetween(userId, presupuesto.fecha_inicio, presupuesto.fecha_fin),
    ]);

    const result = calculateSmartBudget({
      montoBase: presupuesto.monto_base,
      fechaInicio: presupuesto.fecha_inicio,
      fechaFin: presupuesto.fecha_fin,
      hoy,
      gastadoAntesDeHoy,
      gastadoHoy,
      aportadoEnCiclo,
    });

    // Redondeo a centavos para evitar mostrar "-$0.00" por residuos de punto flotante
    return {
      ...result,
      limiteBase: round2(result.limiteBase),
      limiteHoy: round2(result.limiteHoy),
      disponibleHoy: round2(result.disponibleHoy),
      saldoCiclo: round2(result.saldoCiclo),
      saldoRestanteCiclo: round2(result.saldoRestanteCiclo),
      presupuesto,
      gastadoHoy: round2(gastadoHoy),
    };
  },
};
