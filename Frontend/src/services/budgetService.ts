import { getDb, cycleLengthInDays } from '../database/initDb';
import { addDaysToKey, toLocalDateKey } from '../utils/dateUtils';

export type TipoCiclo = 'Diario' | 'Semanal' | 'Mensual';

export interface Presupuesto {
  id: number;
  usuario_id: number;
  monto_base: number;
  tipo_ciclo: TipoCiclo;
  moneda: string;
  fecha_inicio: string; // 'YYYY-MM-DD' local
  fecha_fin: string;    // 'YYYY-MM-DD' local, inclusiva
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

  // Crear o actualizar la configuración de presupuesto
  createOrUpdateBudget: async (
    userId: number,
    montoBase: number,
    tipoCiclo: TipoCiclo,
    moneda: string = 'MXN'
  ): Promise<Presupuesto> => {
    const db = await getDb();
    const fechaInicio = toLocalDateKey();
    const fechaFin = budgetService.calculateCycleEnd(fechaInicio, tipoCiclo);

    const existing = await budgetService.getBudgetByUserId(userId);

    if (existing) {
      await db.runAsync(
        'UPDATE Presupuesto SET monto_base = ?, tipo_ciclo = ?, moneda = ?, fecha_inicio = ?, fecha_fin = ? WHERE id = ?',
        [montoBase, tipoCiclo, moneda, fechaInicio, fechaFin, existing.id]
      );
      return {
        ...existing,
        monto_base: montoBase,
        tipo_ciclo: tipoCiclo,
        moneda,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
      };
    } else {
      const result = await db.runAsync(
        'INSERT INTO Presupuesto (usuario_id, monto_base, tipo_ciclo, moneda, fecha_inicio, fecha_fin) VALUES (?, ?, ?, ?, ?, ?)',
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
      };
    }
  },

  // Último día (inclusivo) del ciclo: Diario = mismo día, Semanal = +6, Mensual = +29
  calculateCycleEnd: (fechaInicio: string, tipoCiclo: TipoCiclo): string =>
    addDaysToKey(fechaInicio, cycleLengthInDays(tipoCiclo) - 1),

  // Cálculo preliminar (estático) del límite diario según el ciclo elegido
  calculateDailyLimit: (montoBase: number, tipoCiclo: TipoCiclo): number => {
    if (montoBase <= 0 || isNaN(montoBase)) return 0;
    return montoBase / cycleLengthInDays(tipoCiclo);
  }
};
