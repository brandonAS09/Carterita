import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { usuarioDe } from '../http/auth.js';
import { ApiError, noEncontrado } from '../http/errors.js';
import { aKey, deKey, fechaKey, hoyDe } from '../http/fechas.js';
import { addDaysToKey } from '../domain/dateUtils.js';
import { round2 } from '../domain/currencyUtils.js';
import { calculateDaySurplus, computeContribution, getGoalProgress } from '../domain/goalCalculator.js';
import { cicloVigente, totalExcedentesMovidos, totalGastado } from '../services/presupuesto.js';
import { buscarMeta, incluirMeta, metaPublica } from '../services/metas.js';
import { Prisma } from '../generated/prisma/client.js';

const crearSchema = z.object({
  nombre: z.string().trim().min(1, 'Escribe un nombre para la meta.').max(40, 'El nombre es demasiado largo.'),
  montoObjetivo: z.number({ error: 'Ingresa un monto válido.' }).positive('Ingresa un monto mayor a 0.').max(99_999_999),
  icono: z.string().max(40).nullable().optional(),
  fechaLimite: fechaKey.nullable().optional(),
  grupoId: z.number().int().positive().nullable().optional(), // S8-02: meta del grupo
});

const aporteSchema = z.object({
  monto: z.number({ error: 'Ingresa un monto válido.' }),
  tipo: z.enum(['Excedente', 'Abono']),
  fechaOrigen: fechaKey.nullable().optional(),
  clienteId: z.string().min(8).max(64), // D34
});

const ERRORES = {
  'meta-completada': 'Esta meta ya está completada.',
  'monto-invalido': 'Ingresa un monto mayor a 0.',
  'excede-restante': 'El monto supera lo que falta para completar la meta.',
} as const;

const idSchema = z.coerce.number().int().positive();

export const metasRouter = Router();

// Metas personales; las del grupo se ven dentro del grupo
metasRouter.get('/metas', async (req, res) => {
  const metas = await prisma.metaAhorro.findMany({
    where: { usuarioId: usuarioDe(req) },
    include: incluirMeta,
    orderBy: { id: 'desc' },
  });
  const vistas = metas.map(metaPublica);
  // Las completadas van al final, como en la versión local
  res.json({ metas: [...vistas.filter((m) => !m.completada), ...vistas.filter((m) => m.completada)] });
});

metasRouter.post('/metas', async (req, res) => {
  const usuarioId = usuarioDe(req);
  const datos = crearSchema.parse(req.body);
  if (datos.grupoId) {
    const miembro = await prisma.miembroGrupo.findUnique({
      where: { grupoId_usuarioId: { grupoId: datos.grupoId, usuarioId } },
    });
    if (!miembro) throw noEncontrado('El grupo');
  }
  const meta = await prisma.metaAhorro.create({
    data: {
      nombre: datos.nombre,
      montoObjetivo: round2(datos.montoObjetivo),
      icono: datos.icono ?? null,
      fechaLimite: datos.fechaLimite ? deKey(datos.fechaLimite) : null,
      creadaPorId: usuarioId,
      ...(datos.grupoId ? { grupoId: datos.grupoId } : { usuarioId }),
    },
    include: incluirMeta,
  });
  res.status(201).json({ meta: metaPublica(meta) });
});

/** Personal: su dueño. De grupo: el admin o quien la creó. Los aportes se borran en cascada. */
metasRouter.delete('/metas/:id', async (req, res) => {
  const usuarioId = usuarioDe(req);
  const meta = await buscarMeta(idSchema.parse(req.params.id), usuarioId);
  if (!meta) throw noEncontrado('La meta');
  if (meta.grupoId !== null && meta.creadaPorId !== usuarioId) {
    const yo = await prisma.miembroGrupo.findUnique({
      where: { grupoId_usuarioId: { grupoId: meta.grupoId, usuarioId } },
    });
    if (yo?.rol !== 'Admin') {
      throw new ApiError(403, 'SIN_PERMISO', 'Solo el administrador o quien creó la meta puede borrarla.');
    }
  }
  await prisma.metaAhorro.delete({ where: { id: meta.id } });
  res.status(204).end();
});

/**
 * Aporte (excedente o abono) en una transacción con bloqueo de la fila de la meta:
 * dos aportes simultáneos de un grupo no pueden pasarse del objetivo (R21).
 */
metasRouter.post('/metas/:id/aportes', async (req, res) => {
  const usuarioId = usuarioDe(req);
  const metaId = idSchema.parse(req.params.id);
  const datos = aporteSchema.parse(req.body);
  if (datos.tipo === 'Excedente' && !datos.fechaOrigen) {
    throw new ApiError(400, 'VALIDACION', 'Falta el día del excedente.', 'fechaOrigen');
  }

  const previo = await prisma.aporteMeta.findUnique({
    where: { usuarioId_clienteId: { usuarioId, clienteId: datos.clienteId } },
  });
  if (previo) {
    const meta = await buscarMeta(previo.metaId, usuarioId);
    if (!meta) throw noEncontrado('La meta');
    const vista = metaPublica(meta);
    res.json({ aportado: Number(previo.monto), completada: vista.completada, meta: vista });
    return;
  }

  try {
    const aportado = await prisma.$transaction(async (tx) => {
      const meta = await tx.metaAhorro.findFirst({
        where: { id: metaId, OR: [{ usuarioId }, { grupo: { miembros: { some: { usuarioId } } } }] },
      });
      if (!meta) throw noEncontrado('La meta');
      await tx.$queryRaw`SELECT id FROM "MetaAhorro" WHERE id = ${metaId} FOR UPDATE`;
      const fresca = await tx.metaAhorro.findUniqueOrThrow({ where: { id: metaId } });

      const { restante } = getGoalProgress(Number(fresca.montoObjetivo), Number(fresca.montoAcumulado));
      const resultado = computeContribution(datos.monto, restante, datos.tipo);
      if (!resultado.ok) throw new ApiError(400, 'APORTE_INVALIDO', ERRORES[resultado.error], 'monto');

      await tx.aporteMeta.create({
        data: {
          metaId,
          usuarioId,
          monto: resultado.aportado,
          tipo: datos.tipo,
          fechaOrigen: datos.fechaOrigen ? deKey(datos.fechaOrigen) : null,
          clienteId: datos.clienteId,
        },
      });
      await tx.metaAhorro.update({ where: { id: metaId }, data: { montoAcumulado: { increment: resultado.aportado } } });
      return resultado.aportado;
    });

    const meta = metaPublica((await buscarMeta(metaId, usuarioId))!);
    res.status(201).json({ aportado, completada: meta.completada, meta });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      // Doble toque: el mismo aporte llegó dos veces al mismo tiempo; se regresa el que se guardó
      const mismo = await prisma.aporteMeta.findUnique({
        where: { usuarioId_clienteId: { usuarioId, clienteId: datos.clienteId } },
      });
      if (mismo) {
        const vista = metaPublica((await buscarMeta(metaId, usuarioId))!);
        res.json({ aportado: Number(mismo.monto), completada: vista.completada, meta: vista });
        return;
      }
      throw new ApiError(409, 'EXCEDENTE_MOVIDO', 'El excedente de ese día ya fue movido a una meta.');
    }
    throw error;
  }
});

/** Excedente de ayer (F07, Escenario 2): solo si ayer pertenece al ciclo actual (D5). */
metasRouter.get('/metas/excedente-ayer', async (req, res) => {
  const usuarioId = usuarioDe(req);
  const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
  const hoy = hoyDe(req, usuario.zonaHoraria);
  const presupuesto = await cicloVigente(usuarioId, hoy);
  const ayer = addDaysToKey(hoy, -1);
  if (!presupuesto || ayer < presupuesto.fecha_inicio) {
    res.json({ excedente: null });
    return;
  }

  const movido = await prisma.aporteMeta.findFirst({
    where: { usuarioId, tipo: 'Excedente', fechaOrigen: deKey(ayer) },
    include: { meta: { select: { nombre: true } } },
  });
  const antesDeAyer = addDaysToKey(ayer, -1);
  const [gastadoAntes, gastadoAyer, aportadoAntes] = await Promise.all([
    totalGastado(usuarioId, presupuesto.fecha_inicio, antesDeAyer),
    totalGastado(usuarioId, ayer, ayer),
    totalExcedentesMovidos(usuarioId, presupuesto.fecha_inicio, antesDeAyer),
  ]);
  const monto = calculateDaySurplus({
    montoBase: presupuesto.monto_base,
    fechaInicio: presupuesto.fecha_inicio,
    fechaFin: presupuesto.fecha_fin,
    hoy: ayer,
    gastadoAntesDeHoy: gastadoAntes,
    gastadoHoy: gastadoAyer,
    aportadoEnCiclo: aportadoAntes,
  });
  res.json({
    excedente: {
      fecha: aKey(deKey(ayer)),
      monto,
      movido: movido ? { monto: Number(movido.monto), metaNombre: movido.meta.nombre } : null,
    },
  });
});
