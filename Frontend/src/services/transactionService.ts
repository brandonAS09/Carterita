import { getDb } from '../database/initDb';
import { getLocalDayRangeISO } from '../utils/dateUtils';

export interface Categoria {
  id: number;
  nombre: string;
  icono: string;
}

export interface Transaccion {
  id: number;
  usuario_id: number;
  monto: number;
  fecha: string;
  concepto: string;
  categoria_id: number | null;
  categoria_nombre?: string;
  origen_registro: 'Manual' | 'Voz' | 'OCR';
}

export const transactionService = {
  // Obtener gastos de HOY para un usuario dado
  getTodayTransactions: async (userId: number): Promise<Transaccion[]> => {
    const db = await getDb();
    // Rango del día LOCAL expresado en ISO UTC (las fechas se guardan con toISOString)
    const { start, end } = getLocalDayRangeISO();

    const rows = await db.getAllAsync<Transaccion>(
      `SELECT t.*, c.nombre AS categoria_nombre
       FROM Transaccion t
       LEFT JOIN Categoria c ON t.categoria_id = c.id
       WHERE t.usuario_id = ? AND t.fecha >= ? AND t.fecha < ?
       ORDER BY t.fecha DESC`,
      [userId, start, end]
    );
    return rows;
  },

  // Sumar el total gastado hoy
  getTodayTotal: async (userId: number): Promise<number> => {
    const db = await getDb();
    const { start, end } = getLocalDayRangeISO();

    const result = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(monto), 0) AS total
       FROM Transaccion
       WHERE usuario_id = ? AND fecha >= ? AND fecha < ?`,
      [userId, start, end]
    );
    return result?.total ?? 0;
  },

  // Obtener todas las categorías disponibles
  getAllCategories: async (): Promise<Categoria[]> => {
    const db = await getDb();
    return await db.getAllAsync<Categoria>('SELECT * FROM Categoria ORDER BY nombre ASC');
  },

  // Registrar un nuevo gasto (F02)
  addTransaction: async (
    userId: number,
    monto: number,
    concepto: string,
    categoriaId: number | null
  ): Promise<Transaccion> => {
    const db = await getDb();
    const fecha = new Date().toISOString();

    const result = await db.runAsync(
      `INSERT INTO Transaccion (usuario_id, monto, fecha, concepto, categoria_id, origen_registro)
       VALUES (?, ?, ?, ?, ?, 'Manual')`,
      [userId, monto, fecha, concepto.trim(), categoriaId]
    );

    return {
      id: result.lastInsertRowId,
      usuario_id: userId,
      monto,
      fecha,
      concepto: concepto.trim(),
      categoria_id: categoriaId,
      origen_registro: 'Manual',
    };
  },
};
