import { api } from '../api/client';
import type { AportePorPersona, MetaView } from './goalService';

/** Sprint 8: grupos para ahorrar y gastar en conjunto (D36 a D43). */

export type RolGrupo = 'Admin' | 'Miembro';

export interface GrupoResumen {
  id: number;
  nombre: string;
  rol: RolGrupo;
  miembros: number;
  metas: number;
}

export interface GastoDelGrupo {
  id: number;
  usuario_id: number;
  nombre_usuario: string;
  monto: number;
  concepto: string;
  fecha: string;
  fecha_local: string;
  categoria_nombre?: string;
  categoria_icono?: string;
}

export interface GrupoDetalle {
  id: number;
  nombre: string;
  mi_rol: RolGrupo;
  miembros: { usuario_id: number; nombre: string; rol: RolGrupo; unido_en: string }[];
  invitacion: { codigo: string; expira_en: string } | null;
  metas: MetaView[];
  gastos: {
    desde: string;
    hasta: string;
    total: number;
    por_miembro: (AportePorPersona & { porcentaje: number })[];
    lista: GastoDelGrupo[];
  };
}

export const groupService = {
  getGroups: async (): Promise<GrupoResumen[]> => (await api<{ grupos: GrupoResumen[] }>('/grupos')).grupos,

  getGroup: async (id: number): Promise<GrupoDetalle> => (await api<{ grupo: GrupoDetalle }>(`/grupos/${id}`)).grupo,

  createGroup: async (nombre: string): Promise<{ id: number; nombre: string }> =>
    (await api<{ grupo: { id: number; nombre: string } }>('/grupos', { method: 'POST', body: { nombre: nombre.trim() } }))
      .grupo,

  joinGroup: async (codigo: string): Promise<{ id: number; nombre: string }> =>
    (await api<{ grupo: { id: number; nombre: string } }>('/grupos/unirse', {
      method: 'POST',
      body: { codigo: codigo.trim().toUpperCase() },
    })).grupo,

  newCode: async (id: number) =>
    (await api<{ invitacion: GrupoDetalle['invitacion'] }>(`/grupos/${id}/codigo`, { method: 'POST' })).invitacion,

  /** D43: quien sale decide si retira lo que aportó a las metas del grupo. */
  leaveGroup: async (id: number, retirarAportes: boolean): Promise<void> => {
    await api(`/grupos/${id}/salir`, { method: 'POST', body: { retirarAportes } });
  },

  removeMember: async (id: number, usuarioId: number): Promise<void> => {
    await api(`/grupos/${id}/miembros/${usuarioId}`, { method: 'DELETE' });
  },
};
