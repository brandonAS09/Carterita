import { getDb } from '../database/initDb';
import { budgetService } from './budgetService';
import { transactionService } from './transactionService';
import { addDaysToKey, toLocalDateKey } from '../utils/dateUtils';
import { round2 } from '../utils/currencyUtils';
import {
  GoalProgress,
  TipoAporte,
  calculateDaySurplus,
  computeContribution,
  getGoalProgress,
} from '../utils/goalCalculator';

/** F07 - Metas de Ahorro Gamificadas. */

export interface MetaAhorro {
  id: number;
  usuario_id: number;
  nombre: string;
  monto_objetivo: number;
  monto_acumulado: number;
  icono: string | null;
  fecha_limite: string | null; // 'YYYY-MM-DD'
}

export type MetaView = MetaAhorro & GoalProgress;

export interface NewGoal {
  nombre: string;
  montoObjetivo: number;
  icono: string;
  fechaLimite: string | null;
}

export interface YesterdaySurplus {
  fecha: string;          // día del excedente ('YYYY-MM-DD')
  monto: number;          // excedente calculado (0 si no hubo)
  movido: { monto: number; metaNombre: string } | null;
}

export interface ContributionOutcome {
  aportado: number;
  completada: boolean;
  meta: MetaView;
}

const toView = (m: MetaAhorro): MetaView => ({ ...m, ...getGoalProgress(m.monto_objetivo, m.monto_acumulado) });

const ERROR_MESSAGES = {
  'meta-completada': 'Esta meta ya está completada.',
  'monto-invalido': 'Ingresa un monto mayor a 0.',
  'excede-restante': 'El monto supera lo que falta para completar la meta.',
} as const;

export const goalService = {
  getGoals: async (userId: number): Promise<MetaView[]> => {
    const db = await getDb();
    const rows = await db.getAllAsync<MetaAhorro>(
      `SELECT * FROM MetaAhorro WHERE usuario_id = ?
       ORDER BY (monto_acumulado >= monto_objetivo) ASC, id DESC`,
      [userId]
    );
    return rows.map(toView);
  },

  createGoal: async (userId: number, goal: NewGoal): Promise<MetaView> => {
    const nombre = goal.nombre.trim();
    if (nombre.length < 1 || !(goal.montoObjetivo > 0)) throw new Error('Datos de la meta inválidos.');
    const db = await getDb();
    const montoObjetivo = round2(goal.montoObjetivo);
    const result = await db.runAsync(
      `INSERT INTO MetaAhorro (usuario_id, nombre, monto_objetivo, monto_acumulado, icono, fecha_limite)
       VALUES (?, ?, ?, 0, ?, ?)`,
      [userId, nombre, montoObjetivo, goal.icono, goal.fechaLimite]
    );
    return toView({
      id: result.lastInsertRowId,
      usuario_id: userId,
      nombre,
      monto_objetivo: montoObjetivo,
      monto_acumulado: 0,
      icono: goal.icono,
      fecha_limite: goal.fechaLimite,
    });
  },

  /** Escenario 7: los aportes se eliminan en cascada; los excedentes regresan al saldo del ciclo. */
  deleteGoal: async (userId: number, metaId: number): Promise<void> => {
    const db = await getDb();
    await db.runAsync('DELETE FROM MetaAhorro WHERE id = ? AND usuario_id = ?', [metaId, userId]);
  },

  /**
   * Registra un aporte (excedente o abono) en una transacción SQLite.
   * El índice único de AporteMeta impide mover dos veces el excedente del mismo día.
   */
  addContribution: async (
    userId: number,
    metaId: number,
    monto: number,
    tipo: TipoAporte,
    fechaOrigen: string | null = null
  ): Promise<ContributionOutcome> => {
    const db = await getDb();
    let outcome: ContributionOutcome | null = null;

    try {
      await db.withTransactionAsync(async () => {
        const meta = await db.getFirstAsync<MetaAhorro>(
          'SELECT * FROM MetaAhorro WHERE id = ? AND usuario_id = ?',
          [metaId, userId]
        );
        if (!meta) throw new Error('La meta no existe.');

        const { restante } = getGoalProgress(meta.monto_objetivo, meta.monto_acumulado);
        const result = computeContribution(monto, restante, tipo);
        if (!result.ok) throw new Error(ERROR_MESSAGES[result.error]);

        await db.runAsync(
          `INSERT INTO AporteMeta (meta_id, usuario_id, monto, fecha, tipo, fecha_origen)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [metaId, userId, result.aportado, new Date().toISOString(), tipo, fechaOrigen]
        );
        const nuevoAcumulado = round2(meta.monto_acumulado + result.aportado);
        await db.runAsync('UPDATE MetaAhorro SET monto_acumulado = ? WHERE id = ?', [nuevoAcumulado, metaId]);

        outcome = {
          aportado: result.aportado,
          completada: result.completa,
          meta: toView({ ...meta, monto_acumulado: nuevoAcumulado }),
        };
      });
    } catch (error: any) {
      if (String(error?.message ?? '').includes('UNIQUE')) {
        throw new Error('El excedente de ese día ya fue movido a una meta.');
      }
      throw error;
    }
    return outcome!;
  },

  /** Total de excedentes movidos a metas cuyo día de origen está en el rango (F06). */
  getSurplusContributionsBetween: async (userId: number, desde: string, hasta: string): Promise<number> => {
    if (desde > hasta) return 0;
    const db = await getDb();
    const row = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(monto), 0) AS total FROM AporteMeta
       WHERE usuario_id = ? AND tipo = 'Excedente' AND fecha_origen >= ? AND fecha_origen <= ?`,
      [userId, desde, hasta]
    );
    return row?.total ?? 0;
  },

  /**
   * Excedente de ayer (Escenario 2). Solo existe si ayer pertenece al ciclo actual (D5).
   */
  getYesterdaySurplus: async (userId: number): Promise<YesterdaySurplus | null> => {
    const budget = await budgetService.ensureCurrentCycle(userId);
    if (!budget) return null;

    const ayer = addDaysToKey(toLocalDateKey(), -1);
    if (ayer < budget.fecha_inicio) return null;

    const db = await getDb();
    const movido = await db.getFirstAsync<{ monto: number; metaNombre: string }>(
      `SELECT a.monto AS monto, m.nombre AS metaNombre
       FROM AporteMeta a JOIN MetaAhorro m ON m.id = a.meta_id
       WHERE a.usuario_id = ? AND a.tipo = 'Excedente' AND a.fecha_origen = ?`,
      [userId, ayer]
    );

    const antesDeAyer = addDaysToKey(ayer, -1);
    const [gastadoAntes, gastadoAyer, aportadoAntes] = await Promise.all([
      transactionService.getCycleTotal(userId, budget.fecha_inicio, antesDeAyer),
      transactionService.getCycleTotal(userId, ayer, ayer),
      goalService.getSurplusContributionsBetween(userId, budget.fecha_inicio, antesDeAyer),
    ]);

    const monto = calculateDaySurplus({
      montoBase: budget.monto_base,
      fechaInicio: budget.fecha_inicio,
      fechaFin: budget.fecha_fin,
      hoy: ayer,
      gastadoAntesDeHoy: gastadoAntes,
      gastadoHoy: gastadoAyer,
      aportadoEnCiclo: aportadoAntes,
    });

    return { fecha: ayer, monto, movido: movido ?? null };
  },
};
