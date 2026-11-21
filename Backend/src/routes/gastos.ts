import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { usuarioDe } from '../http/auth.js';
import { ApiError, noEncontrado } from '../http/errors.js';
import { aKey, deKey, fechaKey, hoyDe } from '../http/fechas.js';
import { normalizeConceptKey } from '../domain/categoryLearning.js';
import { round2 } from '../domain/currencyUtils.js';
import type { Prisma } from '../generated/prisma/client.js';

const incluir = { categoria: true } satisfies Prisma.TransaccionInclude;
type GastoConCategoria = Prisma.TransaccionGetPayload<{ include: typeof incluir }>;

/** Forma que ya usa la app. */
export const gastoPublico = (t: GastoConCategoria) => ({
  id: t.id,
  usuario_id: t.usuarioId,
  monto: Number(t.monto),
  fecha: t.fecha.toISOString(),
  fecha_local: aKey(t.fechaLocal),
  concepto: t.concepto,
  categoria_id: t.categoriaId,
  categoria_nombre: t.categoria?.nombre,
  categoria_icono: t.categoria?.icono,
  origen_registro: t.origen,
  grupo_id: t.grupoId,
});

const monto = z
  .number({ error: 'Ingresa un monto válido.' })
  .positive('Ingresa un monto mayor a 0.')
  .max(99_999_999, 'El monto es demasiado grande.');
const concepto = z.string().trim().min(2, 'El concepto debe tener al menos 2 caracteres.').max(60, 'El concepto es demasiado largo.');
const categoriaId = z.number().int().positive().nullable();

const crearSchema = z.object({
  monto,
  concepto,
  categoriaId,
  origen: z.enum(['Manual', 'Voz', 'OCR']).default('Manual'),
  fechaKey,
  clienteId: z.string().min(8).max(64), // D34
  grupoId: z.number().int().positive().nullable().optional(),
});

const editarSchema = z.object({ monto, concepto, categoriaId, fechaKey: fechaKey.optional() });

const listarSchema = z.object({
  desde: fechaKey.optional(),
  hasta: fechaKey.optional(),
  limite: z.coerce.number().int().min(1).max(500).optional(),
});

/** Mediodía UTC del día elegido: el instante siempre cae en ese día para la app. */
const instanteDe = (key: string, hoy: string) => (key === hoy ? new Date() : new Date(`${key}T12:00:00Z`));

const validarCategoria = async (id: number | null) => {
  if (id !== null && !(await prisma.categoria.findUnique({ where: { id } }))) {
    throw new ApiError(400, 'VALIDACION', 'La categoría no existe.', 'categoriaId');
  }
};

/** S8-03: solo se puede compartir con un grupo del que se es miembro. */
const validarGrupo = async (usuarioId: number, grupoId: number | null | undefined) => {
  if (grupoId == null) return;
  const miembro = await prisma.miembroGrupo.findUnique({ where: { grupoId_usuarioId: { grupoId, usuarioId } } });
  if (!miembro) throw new ApiError(400, 'VALIDACION', 'No perteneces a ese grupo.', 'grupoId');
};

/** F09: la elección más reciente gana. Aprender nunca impide guardar el gasto. */
const recordarCategoria = async (usuarioId: number, texto: string, categoria: number | null) => {
  const clave = normalizeConceptKey(texto);
  if (!clave || categoria === null) return;
  try {
    await prisma.preferenciaCategoria.upsert({
      where: { usuarioId_clave: { usuarioId, clave } },
      create: { usuarioId, clave, categoriaId: categoria },
      update: { categoriaId: categoria, usos: { increment: 1 } },
    });
  } catch (error) {
    console.error('No se pudo recordar la categoría:', error);
  }
};

export const gastosRouter = Router();

gastosRouter.get('/gastos', async (req, res) => {
  const usuarioId = usuarioDe(req);
  const { desde, hasta, limite } = listarSchema.parse(req.query);
  const gastos = await prisma.transaccion.findMany({
    where: {
      usuarioId,
      ...((desde || hasta) && {
        fechaLocal: { ...(desde && { gte: deKey(desde) }), ...(hasta && { lte: deKey(hasta) }) },
      }),
    },
    include: incluir,
    orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
    take: limite,
  });
  res.json({ gastos: gastos.map(gastoPublico) });
});

gastosRouter.get('/gastos/:id', async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const gasto = await prisma.transaccion.findFirst({ where: { id, usuarioId: usuarioDe(req) }, include: incluir });
  if (!gasto) throw noEncontrado('Este gasto');
  res.json({ gasto: gastoPublico(gasto) });
});

gastosRouter.post('/gastos', async (req, res) => {
  const usuarioId = usuarioDe(req);
  const datos = crearSchema.parse(req.body);

  // D34: si este guardado ya llegó antes, se regresa el mismo gasto sin duplicarlo
  const previo = await prisma.transaccion.findUnique({
    where: { usuarioId_clienteId: { usuarioId, clienteId: datos.clienteId } },
    include: incluir,
  });
  if (previo) {
    res.status(200).json({ gasto: gastoPublico(previo) });
    return;
  }

  const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
  const hoy = hoyDe(req, usuario.zonaHoraria);
  if (datos.fechaKey > hoy) throw new ApiError(400, 'VALIDACION', 'La fecha no puede ser futura.', 'fechaKey');
  await validarCategoria(datos.categoriaId);
  await validarGrupo(usuarioId, datos.grupoId);

  const gasto = await prisma.transaccion.create({
    data: {
      usuarioId,
      monto: round2(datos.monto),
      concepto: datos.concepto,
      categoriaId: datos.categoriaId,
      origen: datos.origen,
      fecha: instanteDe(datos.fechaKey, hoy),
      fechaLocal: deKey(datos.fechaKey),
      clienteId: datos.clienteId,
      grupoId: datos.grupoId ?? null,
    },
    include: incluir,
  });
  await recordarCategoria(usuarioId, datos.concepto, datos.categoriaId);
  res.status(201).json({ gasto: gastoPublico(gasto) });
});

// F08.1: sin fechaKey se conserva la fecha y hora original; el origen nunca cambia
gastosRouter.patch('/gastos/:id', async (req, res) => {
  const usuarioId = usuarioDe(req);
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const datos = editarSchema.parse(req.body);
  const actual = await prisma.transaccion.findFirst({ where: { id, usuarioId } });
  if (!actual) throw noEncontrado('Este gasto');

  const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
  const hoy = hoyDe(req, usuario.zonaHoraria);
  if (datos.fechaKey && datos.fechaKey > hoy) {
    throw new ApiError(400, 'VALIDACION', 'La fecha no puede ser futura.', 'fechaKey');
  }
  await validarCategoria(datos.categoriaId);

  const cambiaFecha = datos.fechaKey && datos.fechaKey !== aKey(actual.fechaLocal);
  const gasto = await prisma.transaccion.update({
    where: { id },
    data: {
      monto: round2(datos.monto),
      concepto: datos.concepto,
      categoriaId: datos.categoriaId,
      ...(cambiaFecha && { fecha: new Date(`${datos.fechaKey}T12:00:00Z`), fechaLocal: deKey(datos.fechaKey!) }),
    },
    include: incluir,
  });
  await recordarCategoria(usuarioId, datos.concepto, datos.categoriaId);
  res.json({ gasto: gastoPublico(gasto) });
});

gastosRouter.delete('/gastos/:id', async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const { count } = await prisma.transaccion.deleteMany({ where: { id, usuarioId: usuarioDe(req) } });
  if (count === 0) throw noEncontrado('Este gasto');
  res.status(204).end();
});

gastosRouter.get('/categorias', async (_req, res) => {
  const categorias = await prisma.categoria.findMany({ orderBy: { nombre: 'asc' } });
  res.json({ categorias: categorias.map(({ id, nombre, icono }) => ({ id, nombre, icono })) });
});

/** F09: categoría aprendida para un concepto, o null. */
gastosRouter.get('/categorias/aprendida', async (req, res) => {
  const { concepto: texto } = z.object({ concepto: z.string().max(200) }).parse(req.query);
  const clave = normalizeConceptKey(texto);
  const preferencia = clave
    ? await prisma.preferenciaCategoria.findUnique({
        where: { usuarioId_clave: { usuarioId: usuarioDe(req), clave } },
        include: { categoria: true },
      })
    : null;
  res.json({ nombre: preferencia?.categoria.nombre ?? null });
});
