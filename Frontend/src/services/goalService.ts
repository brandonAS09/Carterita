import { api, conIdempotencia } from '../api/client';
import { GoalProgress, TipoAporte } from '../utils/goalCalculator';

/** F07 - Metas de Ahorro (personales y de grupo, S8-02). */

export interface AportePorPersona {
  usuario_id: number;
  nombre: string;
  total: number;
  es_miembro: boolean;
}

export interface MetaAhorro {
  id: number;
  usuario_id: number | null;
  grupo_id: number | null;
  creada_por_id: number;
  nombre: string;
  monto_objetivo: number;
  monto_acumulado: number;
  icono: string | null;
  fecha_limite: string | null; // 'YYYY-MM-DD'
  aportes_por_persona: AportePorPersona[];
  retiros: { usuario_id: number; nombre: string; monto: number; fecha: string }[];
}

export type MetaView = MetaAhorro & GoalProgress;

export interface NewGoal {
  nombre: string;
  montoObjetivo: number;
  icono: string;
  fechaLimite: string | null;
  grupoId?: number | null;
}

export interface YesterdaySurplus {
  fecha: string;
  monto: number;
  movido: { monto: number; metaNombre: string } | null;
}

export interface ContributionOutcome {
  aportado: number;
  completada: boolean;
  meta: MetaView;
}

export const goalService = {
  getGoals: async (_userId: number): Promise<MetaView[]> => (await api<{ metas: MetaView[] }>('/metas')).metas,

  createGoal: async (_userId: number, goal: NewGoal): Promise<MetaView> =>
    (await api<{ meta: MetaView }>('/metas', { method: 'POST', body: { ...goal, nombre: goal.nombre.trim() } })).meta,

  /** Los aportes se eliminan en cascada; los excedentes regresan al saldo del ciclo. */
  deleteGoal: async (_userId: number, metaId: number): Promise<void> => {
    await api(`/metas/${metaId}`, { method: 'DELETE' });
  },

  /** El servidor valida el monto, impide mover dos veces el excedente de un día y no duplica reintentos. */
  addContribution: async (
    userId: number,
    metaId: number,
    monto: number,
    tipo: TipoAporte,
    fechaOrigen: string | null = null
  ): Promise<ContributionOutcome> => {
    const body = { monto, tipo, fechaOrigen };
    return conIdempotencia(`aporte|${userId}|${metaId}|${JSON.stringify(body)}`, (clienteId) =>
      api<ContributionOutcome>(`/metas/${metaId}/aportes`, { method: 'POST', body: { ...body, clienteId } })
    );
  },

  getYesterdaySurplus: async (_userId: number): Promise<YesterdaySurplus | null> =>
    (await api<{ excedente: YesterdaySurplus | null }>('/metas/excedente-ayer')).excedente,
};
