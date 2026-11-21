import { prisma } from '../db.js';
import { addDaysToKey } from '../domain/dateUtils.js';
import { resolveCurrentCycle } from '../domain/smartBudgetCalculator.js';
import { aKey, deKey } from '../http/fechas.js';
import type { Presupuesto, TipoCiclo } from '../generated/prisma/client.js';

const DIAS_POR_CICLO: Record<TipoCiclo, number> = { Diario: 1, Semanal: 7, Mensual: 30 };

export const finDeCiclo = (inicio: string, tipo: TipoCiclo) => addDaysToKey(inicio, DIAS_POR_CICLO[tipo] - 1);

/** Forma que ya usa la app (snake_case, montos como número, fechas 'YYYY-MM-DD'). */
export const presupuestoPublico = (p: Presupuesto) => ({
  id: p.id,
  usuario_id: p.usuarioId,
  monto_base: Number(p.montoBase),
  tipo_ciclo: p.tipoCiclo,
  moneda: p.moneda,
  fecha_inicio: aKey(p.fechaInicio),
  fecha_fin: aKey(p.fechaFin),
  tipo_cambio_usd: p.tipoCambioUsd === null ? null : Number(p.tipoCambioUsd),
});

export type PresupuestoPublico = ReturnType<typeof presupuestoPublico>;

/** F06: si el ciclo ya terminó, avanza a ciclos contiguos hasta cubrir `hoy` y lo guarda. */
export const cicloVigente = async (usuarioId: number, hoy: string): Promise<PresupuestoPublico | null> => {
  const presupuesto = await prisma.presupuesto.findUnique({ where: { usuarioId } });
  if (!presupuesto) return null;
  const actual = presupuestoPublico(presupuesto);
  const ciclo = resolveCurrentCycle({ fechaInicio: actual.fecha_inicio, fechaFin: actual.fecha_fin }, hoy);
  if (!ciclo.renovado) return actual;

  const renovado = await prisma.presupuesto.update({
    where: { id: presupuesto.id },
    data: { fechaInicio: deKey(ciclo.fechaInicio), fechaFin: deKey(ciclo.fechaFin) },
  });
  return presupuestoPublico(renovado);
};

/** Total gastado por el usuario entre dos días locales, ambos inclusivos. */
export const totalGastado = async (usuarioId: number, desde: string, hasta: string) => {
  if (desde > hasta) return 0;
  const { _sum } = await prisma.transaccion.aggregate({
    where: { usuarioId, fechaLocal: { gte: deKey(desde), lte: deKey(hasta) } },
    _sum: { monto: true },
  });
  return Number(_sum.monto ?? 0);
};

/** Excedentes que el usuario movió a metas, por día de origen dentro del rango (F06/F07). */
export const totalExcedentesMovidos = async (usuarioId: number, desde: string, hasta: string) => {
  if (desde > hasta) return 0;
  const { _sum } = await prisma.aporteMeta.aggregate({
    where: { usuarioId, tipo: 'Excedente', fechaOrigen: { gte: deKey(desde), lte: deKey(hasta) } },
    _sum: { monto: true },
  });
  return Number(_sum.monto ?? 0);
};
