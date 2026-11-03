import { getDb, cycleLengthInDays } from '../database/initDb';
import { addDaysToKey, toLocalDateKey } from '../utils/dateUtils';
import { resolveCurrentCycle } from '../utils/smartBudgetCalculator';
import { Moneda, getConversionFactor } from '../utils/currencyUtils';

export type TipoCiclo = 'Diario' | 'Semanal' | 'Mensual';

export interface Presupuesto {
  id: number;
  usuario_id: number;
  monto_base: number;
  tipo_ciclo: TipoCiclo;
  moneda: Moneda;
  fecha_inicio: string; // 'YYYY-MM-DD' local
  fecha_fin: string;    // 'YYYY-MM-DD' local, inclusiva
  tipo_cambio_usd: number | null; // última tasa usada: 1 USD = X MXN
}

export interface BudgetChanges {
  montoBase: number; // ya expresado en la moneda destino
  tipoCiclo: TipoCiclo;
  moneda: Moneda;
  tipoCambioUsd?: number; // obligatorio si cambia la moneda
}

export const budgetService = {
  // Obtener el presupuesto actual del usuario
  getBudgetByUserId: async (userId: number): Promise<Presupuesto | null> => {
    const db = await getDb();
    const budget = await db.getFirstAsync<Presupuesto>(
      'SELECT * FROM Presupuesto WHERE usuario_id = ? ORDER BY id DESC LIMIT 1',
      [userId]
    );
    return budget || null;
  },

  /**
   * F06: renovación automática. Si el ciclo terminó, avanza a ciclos contiguos
   * (mismo monto y tipo) hasta cubrir hoy y lo persiste.
   */
  ensureCurrentCycle: async (userId: number): Promise<Presupuesto | null> => {
    const budget = await budgetService.getBudgetByUserId(userId);
    if (!budget) return null;

    const fechaFinActual =
      budget.fecha_fin ?? budgetService.calculateCycleEnd(budget.fecha_inicio, budget.tipo_ciclo);
    const ciclo = resolveCurrentCycle(
      { fechaInicio: budget.fecha_inicio, fechaFin: fechaFinActual },
      toLocalDateKey()
    );
    if (!ciclo.renovado) return { ...budget, fecha_fin: fechaFinActual };

    const db = await getDb();
    await db.runAsync('UPDATE Presupuesto SET fecha_inicio = ?, fecha_fin = ? WHERE id = ?', [
      ciclo.fechaInicio,
      ciclo.fechaFin,
      budget.id,
    ]);
    return { ...budget, fecha_inicio: ciclo.fechaInicio, fecha_fin: ciclo.fechaFin };
  },

  // Onboarding (F01): primer presupuesto del usuario, el ciclo inicia hoy
  createBudget: async (
    userId: number,
    montoBase: number,
    tipoCiclo: TipoCiclo,
    moneda: Moneda
  ): Promise<Presupuesto> => {
    const db = await getDb();
    const fechaInicio = toLocalDateKey();
    const fechaFin = budgetService.calculateCycleEnd(fechaInicio, tipoCiclo);

    const result = await db.runAsync(
      `INSERT INTO Presupuesto (usuario_id, monto_base, tipo_ciclo, moneda, fecha_inicio, fecha_fin)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, montoBase, tipoCiclo, moneda, fechaInicio, fechaFin]
    );
    return {
      id: result.lastInsertRowId,
      usuario_id: userId,
      monto_base: montoBase,
      tipo_ciclo: tipoCiclo,
      moneda,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      tipo_cambio_usd: null,
    };
  },

  /**
   * Edición de presupuesto (S1.1-06). Reglas:
   *  - Solo monto:      el ciclo continúa (mismas fechas).
   *  - Moneda:          se convierten TODOS los montos del usuario (gastos y metas) con la tasa capturada.
   *  - Tipo de ciclo:   inicia un ciclo nuevo hoy; los gastos de días anteriores dejan de contar.
   * Todo ocurre en una sola transacción: si algo falla, no se aplica nada.
   */
  updateBudget: async (userId: number, changes: BudgetChanges): Promise<Presupuesto> => {
    const db = await getDb();
    const current = await budgetService.getBudgetByUserId(userId);
    if (!current) throw new Error('No existe un presupuesto para editar.');

    const currencyChanged = changes.moneda !== current.moneda;
    const tasa = changes.tipoCambioUsd;
    if (currencyChanged && !(tasa !== undefined && tasa > 0 && isFinite(tasa))) {
      throw new Error('Tipo de cambio inválido.');
    }

    const cycleChanged = changes.tipoCiclo !== current.tipo_ciclo;
    const fechaInicio = cycleChanged ? toLocalDateKey() : current.fecha_inicio;
    const fechaFin = cycleChanged
      ? budgetService.calculateCycleEnd(fechaInicio, changes.tipoCiclo)
      : current.fecha_fin ?? budgetService.calculateCycleEnd(current.fecha_inicio, current.tipo_ciclo);
    const tipoCambioUsd = currencyChanged ? tasa! : current.tipo_cambio_usd;

    await db.withTransactionAsync(async () => {
      if (currencyChanged) {
        // monto_base no se convierte aquí: el formulario ya envía el valor en la moneda destino.
        const factor = getConversionFactor(current.moneda, changes.moneda, tasa!);
        await db.runAsync(
          'UPDATE Transaccion SET monto = ROUND(monto * ?, 2) WHERE usuario_id = ?',
          [factor, userId]
        );
        await db.runAsync(
          `UPDATE MetaAhorro
           SET monto_objetivo = ROUND(monto_objetivo * ?, 2),
               monto_acumulado = ROUND(monto_acumulado * ?, 2)
           WHERE usuario_id = ?`,
          [factor, factor, userId]
        );
        await db.runAsync(
          'UPDATE AporteMeta SET monto = ROUND(monto * ?, 2) WHERE usuario_id = ?',
          [factor, userId]
        );
      }

      await db.runAsync(
        `UPDATE Presupuesto
         SET monto_base = ?, tipo_ciclo = ?, moneda = ?, fecha_inicio = ?, fecha_fin = ?, tipo_cambio_usd = ?
         WHERE id = ?`,
        [changes.montoBase, changes.tipoCiclo, changes.moneda, fechaInicio, fechaFin, tipoCambioUsd, current.id]
      );
    });

    return {
      ...current,
      monto_base: changes.montoBase,
      tipo_ciclo: changes.tipoCiclo,
      moneda: changes.moneda,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      tipo_cambio_usd: tipoCambioUsd,
    };
  },

  // D1 (F03): guarda la tasa capturada al dictar un monto en otra moneda
  setExchangeRate: async (userId: number, tipoCambioUsd: number): Promise<void> => {
    if (!(tipoCambioUsd > 0 && isFinite(tipoCambioUsd))) throw new Error('Tipo de cambio inválido.');
    const db = await getDb();
    await db.runAsync('UPDATE Presupuesto SET tipo_cambio_usd = ? WHERE usuario_id = ?', [
      tipoCambioUsd,
      userId,
    ]);
  },

  // Último día (inclusivo) del ciclo: Diario = mismo día, Semanal = +6, Mensual = +29
  calculateCycleEnd: (fechaInicio: string, tipoCiclo: TipoCiclo): string =>
    addDaysToKey(fechaInicio, cycleLengthInDays(tipoCiclo) - 1),

  // Cálculo preliminar (estático) del límite diario según el ciclo elegido
  calculateDailyLimit: (montoBase: number, tipoCiclo: TipoCiclo): number => {
    if (montoBase <= 0 || isNaN(montoBase)) return 0;
    return montoBase / cycleLengthInDays(tipoCiclo);
  },
};
