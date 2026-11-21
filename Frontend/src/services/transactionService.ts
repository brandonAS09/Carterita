import { api, ApiError, conIdempotencia } from '../api/client';
import { round2 } from '../utils/currencyUtils';
import { getLocalNoonISO, toLocalDateKey } from '../utils/dateUtils';

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
  fecha_local?: string;
  concepto: string;
  categoria_id: number | null;
  categoria_nombre?: string;
  categoria_icono?: string;
  origen_registro: OrigenRegistro;
  grupo_id?: number | null;
}

export type OrigenRegistro = 'Manual' | 'Voz' | 'OCR';

export interface TransactionChanges {
  monto: number;
  concepto: string;
  categoriaId: number | null;
  fechaKey?: string;
}

type Lista = { gastos: Transaccion[] };

const listar = async (params: Record<string, string | number> = {}) => {
  const query = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
  return (await api<Lista>(`/gastos${query ? `?${query}` : ''}`)).gastos;
};

const sumar = (gastos: Transaccion[]) => round2(gastos.reduce((s, g) => s + g.monto, 0));

let categoriasEnMemoria: Categoria[] | null = null;

/** Las categorías aprendidas (F09) las guarda el servidor al crear o editar un gasto. */
export const transactionService = {
  getTodayTransactions: async (_userId: number): Promise<Transaccion[]> => {
    const hoy = toLocalDateKey();
    return listar({ desde: hoy, hasta: hoy });
  },

  getRecentTransactions: async (_userId: number, limit: number): Promise<Transaccion[]> => listar({ limite: limit }),

  getAllTransactions: async (_userId: number): Promise<Transaccion[]> => listar(),

  /** null si no existe o es de otra cuenta (p. ej. se borró desde otro teléfono). */
  getTransactionById: async (_userId: number, id: number): Promise<Transaccion | null> => {
    try {
      return (await api<{ gasto: Transaccion }>(`/gastos/${id}`)).gasto;
    } catch (error) {
      if (error instanceof ApiError && error.tipo === 'NoEncontrado') return null;
      throw error;
    }
  },

  getTransactionsBetween: async (_userId: number, fromKey: string, toKey: string): Promise<Transaccion[]> =>
    listar({ desde: fromKey, hasta: toKey }),

  getTodayTotal: async (userId: number): Promise<number> => sumar(await transactionService.getTodayTransactions(userId)),

  getCycleTotal: async (_userId: number, fechaInicio: string, fechaFin: string): Promise<number> =>
    fechaInicio > fechaFin ? 0 : sumar(await listar({ desde: fechaInicio, hasta: fechaFin })),

  /** Las categorías casi nunca cambian: se piden una vez por sesión. */
  getAllCategories: async (): Promise<Categoria[]> => {
    if (!categoriasEnMemoria) categoriasEnMemoria = (await api<{ categorias: Categoria[] }>('/categorias')).categorias;
    return categoriasEnMemoria;
  },

  /** F02. `fechaKey`: día local si no es de hoy (F04). `grupoId`: gasto compartido (S8-03). */
  addTransaction: async (
    userId: number,
    monto: number,
    concepto: string,
    categoriaId: number | null,
    origen: OrigenRegistro = 'Manual',
    fechaKey?: string,
    grupoId: number | null = null
  ): Promise<Transaccion> => {
    const dia = fechaKey ?? toLocalDateKey();
    const body = { monto: round2(monto), concepto: concepto.trim(), categoriaId, origen, fechaKey: dia, grupoId };
    const huella = `gasto|${userId}|${JSON.stringify(body)}`;
    return conIdempotencia(huella, async (clienteId) =>
      // El instante va fuera de la huella: un reintento de "hoy" debe reconocerse como el mismo gasto
      (await api<{ gasto: Transaccion }>('/gastos', {
        method: 'POST',
        body: { ...body, clienteId, fecha: fechaKey ? getLocalNoonISO(fechaKey) : new Date().toISOString() },
      })).gasto
    );
  },

  // F08.1: sin `fechaKey` se conserva la fecha y hora original; el origen nunca cambia
  updateTransaction: async (_userId: number, id: number, changes: TransactionChanges): Promise<void> => {
    await api(`/gastos/${id}`, {
      method: 'PATCH',
      body: {
        ...changes,
        monto: round2(changes.monto),
        concepto: changes.concepto.trim(),
        ...(changes.fechaKey && { fecha: getLocalNoonISO(changes.fechaKey) }),
      },
    });
  },

  deleteTransaction: async (_userId: number, id: number): Promise<void> => {
    try {
      await api(`/gastos/${id}`, { method: 'DELETE' });
    } catch (error) {
      // Si ya no existe (borrado desde otro teléfono o en un intento anterior), el resultado es el mismo
      if (!(error instanceof ApiError && error.tipo === 'NoEncontrado')) throw error;
    }
  },
};
