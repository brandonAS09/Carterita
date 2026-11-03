import { initDatabase } from '../database/initDb';

export type TipoCiclo = 'Diario' | 'Semanal' | 'Mensual';

export interface Presupuesto {
  id: number;
  usuario_id: number;
  monto_base: number;
  tipo_ciclo: TipoCiclo;
  moneda: string;
  fecha_inicio: string;
}

export const budgetService = {
  getDb: async () => {
    return await initDatabase();
  },

  // Obtener el presupuesto actual del usuario
  getBudgetByUserId: async (userId: number): Promise<Presupuesto | null> => {
    const db = await budgetService.getDb();
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
    const db = await budgetService.getDb();
    const fechaInicio = new Date().toISOString();

    const existing = await budgetService.getBudgetByUserId(userId);

    if (existing) {
      await db.runAsync(
        'UPDATE Presupuesto SET monto_base = ?, tipo_ciclo = ?, moneda = ?, fecha_inicio = ? WHERE id = ?',
        [montoBase, tipoCiclo, moneda, fechaInicio, existing.id]
      );
      return {
        ...existing,
        monto_base: montoBase,
        tipo_ciclo: tipoCiclo,
        moneda,
        fecha_inicio: fechaInicio,
      };
    } else {
      const result = await db.runAsync(
        'INSERT INTO Presupuesto (usuario_id, monto_base, tipo_ciclo, moneda, fecha_inicio) VALUES (?, ?, ?, ?, ?)',
        [userId, montoBase, tipoCiclo, moneda, fechaInicio]
      );
      return {
        id: result.lastInsertRowId,
        usuario_id: userId,
        monto_base: montoBase,
        tipo_ciclo: tipoCiclo,
        moneda,
        fecha_inicio: fechaInicio,
      };
    }
  },

  // Cálculo preliminar del límite diario según el ciclo elegido
  calculateDailyLimit: (montoBase: number, tipoCiclo: TipoCiclo): number => {
    if (montoBase <= 0 || isNaN(montoBase)) return 0;
    switch (tipoCiclo) {
      case 'Diario':
        return montoBase;
      case 'Semanal':
        return montoBase / 7;
      case 'Mensual':
        return montoBase / 30;
      default:
        return montoBase;
    }
  }
};
