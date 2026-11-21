import { prisma } from '../db.js';
import { getGoalProgress } from '../domain/goalCalculator.js';
import { aKey } from '../http/fechas.js';
import type { Prisma } from '../generated/prisma/client.js';

export const incluirMeta = {
  aportes: { include: { usuario: { select: { id: true, nombre: true } } }, orderBy: { fecha: 'desc' } },
  grupo: { include: { miembros: { select: { usuarioId: true } } } },
} satisfies Prisma.MetaAhorroInclude;

export type MetaCompleta = Prisma.MetaAhorroGetPayload<{ include: typeof incluirMeta }>;

/**
 * Forma que ya usa la app + datos de grupo (S8-02): cuánto lleva cada persona y los retiros (D43).
 */
export const metaPublica = (m: MetaCompleta) => {
  const objetivo = Number(m.montoObjetivo);
  const acumulado = Number(m.montoAcumulado);
  const miembrosActuales = new Set(m.grupo?.miembros.map((x) => x.usuarioId) ?? []);

  const porPersona = new Map<number, { usuario_id: number; nombre: string; total: number; es_miembro: boolean }>();
  for (const aporte of m.aportes) {
    const signo = aporte.tipo === 'Retiro' ? -1 : 1;
    const actual = porPersona.get(aporte.usuarioId) ?? {
      usuario_id: aporte.usuarioId,
      nombre: aporte.usuario.nombre,
      total: 0,
      es_miembro: m.grupoId === null || miembrosActuales.has(aporte.usuarioId),
    };
    actual.total = Math.round((actual.total + signo * Number(aporte.monto)) * 100) / 100;
    porPersona.set(aporte.usuarioId, actual);
  }

  return {
    id: m.id,
    usuario_id: m.usuarioId,
    grupo_id: m.grupoId,
    creada_por_id: m.creadaPorId,
    nombre: m.nombre,
    monto_objetivo: objetivo,
    monto_acumulado: acumulado,
    icono: m.icono,
    fecha_limite: m.fechaLimite ? aKey(m.fechaLimite) : null,
    ...getGoalProgress(objetivo, acumulado),
    aportes_por_persona: [...porPersona.values()].filter((p) => p.total > 0).sort((a, b) => b.total - a.total),
    retiros: m.aportes
      .filter((a) => a.tipo === 'Retiro')
      .map((a) => ({ usuario_id: a.usuarioId, nombre: a.usuario.nombre, monto: Number(a.monto), fecha: a.fecha.toISOString() })),
  };
};

/** Condición de acceso: meta propia o de un grupo del que el usuario es miembro. */
export const metaAccesible = (usuarioId: number): Prisma.MetaAhorroWhereInput => ({
  OR: [{ usuarioId }, { grupo: { miembros: { some: { usuarioId } } } }],
});

export const buscarMeta = (id: number, usuarioId: number) =>
  prisma.metaAhorro.findFirst({ where: { id, ...metaAccesible(usuarioId) }, include: incluirMeta });
