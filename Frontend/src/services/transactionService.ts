import { getDb } from '../database/initDb';
import { categoryPreferenceService } from './categoryPreferenceService';
import { getLocalDayRangeISO, getLocalNoonISO, getLocalRangeISOForKeys } from '../utils/dateUtils';

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
  categoria_icono?: string;
  origen_registro: OrigenRegistro;
}

export type OrigenRegistro = 'Manual' | 'Voz' | 'OCR';

export interface TransactionChanges {
  monto: number;
  concepto: string;
  categoriaId: number | null;
  fechaKey?: string;
}

/** F09: aprender nunca debe impedir que el gasto se guarde. */
const rememberCategory = async (userId: number, concepto: string, categoriaId: number | null) => {
  try {
    await categoryPreferenceService.remember(userId, concepto, categoriaId);
  } catch (error) {
    console.error('Error al recordar la categoría:', error);
  }
};

export const transactionService = {
  // Obtener gastos de HOY para un usuario dado
  getTodayTransactions: async (userId: number): Promise<Transaccion[]> => {
    const db = await getDb();
    // Rango del día LOCAL expresado en ISO UTC (las fechas se guardan con toISOString)
    const { start, end } = getLocalDayRangeISO();

    const rows = await db.getAllAsync<Transaccion>(
      `SELECT t.*, c.nombre AS categoria_nombre, c.icono AS categoria_icono
       FROM Transaccion t
       LEFT JOIN Categoria c ON t.categoria_id = c.id
       WHERE t.usuario_id = ? AND t.fecha >= ? AND t.fecha < ?
       ORDER BY t.fecha DESC`,
      [userId, start, end]
    );
    return rows;
  },

  // Últimos gastos del usuario, del más reciente al más antiguo (Inicio)
  getRecentTransactions: async (userId: number, limit: number): Promise<Transaccion[]> => {
    const db = await getDb();
    return db.getAllAsync<Transaccion>(
      `SELECT t.*, c.nombre AS categoria_nombre, c.icono AS categoria_icono
       FROM Transaccion t
       LEFT JOIN Categoria c ON t.categoria_id = c.id
       WHERE t.usuario_id = ?
       ORDER BY t.fecha DESC
       LIMIT ?`,
      [userId, limit]
    );
  },

  // Todos los gastos del usuario, del más reciente al más antiguo (Historial)
  getAllTransactions: async (userId: number): Promise<Transaccion[]> => {
    const db = await getDb();
    return db.getAllAsync<Transaccion>(
      `SELECT t.*, c.nombre AS categoria_nombre, c.icono AS categoria_icono
       FROM Transaccion t
       LEFT JOIN Categoria c ON t.categoria_id = c.id
       WHERE t.usuario_id = ?
       ORDER BY t.fecha DESC`,
      [userId]
    );
  },

  // Un gasto del usuario, o null si no existe o es de otra cuenta
  getTransactionById: async (userId: number, id: number): Promise<Transaccion | null> => {
    const db = await getDb();
    return db.getFirstAsync<Transaccion>(
      `SELECT t.*, c.nombre AS categoria_nombre, c.icono AS categoria_icono
       FROM Transaccion t
       LEFT JOIN Categoria c ON t.categoria_id = c.id
       WHERE t.id = ? AND t.usuario_id = ?`,
      [id, userId]
    );
  },

  // Gastos de un rango de días locales, ambos inclusivos (Reportes)
  getTransactionsBetween: async (userId: number, fromKey: string, toKey: string): Promise<Transaccion[]> => {
    const db = await getDb();
    const { start, end } = getLocalRangeISOForKeys(fromKey, toKey);
    return db.getAllAsync<Transaccion>(
      `SELECT t.*, c.nombre AS categoria_nombre, c.icono AS categoria_icono
       FROM Transaccion t
       LEFT JOIN Categoria c ON t.categoria_id = c.id
       WHERE t.usuario_id = ? AND t.fecha >= ? AND t.fecha < ?
       ORDER BY t.fecha DESC`,
      [userId, start, end]
    );
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

  // Total gastado en un ciclo (fechas 'YYYY-MM-DD' locales, fin inclusivo)
  getCycleTotal: async (userId: number, fechaInicio: string, fechaFin: string): Promise<number> => {
    const db = await getDb();
    const { start, end } = getLocalRangeISOForKeys(fechaInicio, fechaFin);

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

  // Registrar un nuevo gasto (F02). `fechaKey`: día local 'YYYY-MM-DD' si no es de hoy (F04, D9)
  addTransaction: async (
    userId: number,
    monto: number,
    concepto: string,
    categoriaId: number | null,
    origen: OrigenRegistro = 'Manual',
    fechaKey?: string
  ): Promise<Transaccion> => {
    const db = await getDb();
    const fecha = fechaKey ? getLocalNoonISO(fechaKey) : new Date().toISOString();

    const result = await db.runAsync(
      `INSERT INTO Transaccion (usuario_id, monto, fecha, concepto, categoria_id, origen_registro)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, monto, fecha, concepto.trim(), categoriaId, origen]
    );
    await rememberCategory(userId, concepto, categoriaId);

    return {
      id: result.lastInsertRowId,
      usuario_id: userId,
      monto,
      fecha,
      concepto: concepto.trim(),
      categoria_id: categoriaId,
      origen_registro: origen,
    };
  },

  // F08.1: corregir un gasto. Sin `fechaKey` se conserva la fecha y hora original; el origen nunca cambia
  updateTransaction: async (userId: number, id: number, changes: TransactionChanges): Promise<void> => {
    const db = await getDb();
    const { monto, concepto, categoriaId, fechaKey } = changes;
    const result = fechaKey
      ? await db.runAsync(
          'UPDATE Transaccion SET monto = ?, concepto = ?, categoria_id = ?, fecha = ? WHERE id = ? AND usuario_id = ?',
          [monto, concepto.trim(), categoriaId, getLocalNoonISO(fechaKey), id, userId]
        )
      : await db.runAsync(
          'UPDATE Transaccion SET monto = ?, concepto = ?, categoria_id = ? WHERE id = ? AND usuario_id = ?',
          [monto, concepto.trim(), categoriaId, id, userId]
        );
    if (result.changes > 0) await rememberCategory(userId, concepto, categoriaId);
  },

  // F08.1: eliminar un gasto
  deleteTransaction: async (userId: number, id: number): Promise<void> => {
    const db = await getDb();
    await db.runAsync('DELETE FROM Transaccion WHERE id = ? AND usuario_id = ?', [id, userId]);
  },
};
