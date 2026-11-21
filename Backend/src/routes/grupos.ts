import { randomInt, randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { usuarioDe } from '../http/auth.js';
import { ApiError, noEncontrado } from '../http/errors.js';
import { aKey, deKey, fechaKey, hoyDe } from '../http/fechas.js';
import { round2 } from '../domain/currencyUtils.js';
import { incluirMeta, metaPublica } from '../services/metas.js';
import { Prisma } from '../generated/prisma/client.js';

const MAX_MIEMBROS = 6; // D37
const VIGENCIA_CODIGO_MS = 48 * 60 * 60 * 1000;
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sin O/0, I/1/L

const nuevoCodigo = () => Array.from({ length: 6 }, () => ALFABETO[randomInt(ALFABETO.length)]).join('');
const idSchema = z.coerce.number().int().positive();
const nombreSchema = z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres.').max(40, 'El nombre es demasiado largo.');

/** Membresía del usuario o 404 (no se revela si el grupo existe). */
const miMembresia = async (grupoId: number, usuarioId: number) => {
  const membresia = await prisma.miembroGrupo.findUnique({ where: { grupoId_usuarioId: { grupoId, usuarioId } } });
  if (!membresia) throw noEncontrado('El grupo');
  return membresia;
};

/** Crea o reemplaza el código (el anterior deja de servir). Reintenta si choca con otro. */
const generarInvitacion = async (tx: Prisma.TransactionClient, grupoId: number) => {
  for (let intento = 0; intento < 5; intento++) {
    try {
      const datos = { codigo: nuevoCodigo(), expiraEn: new Date(Date.now() + VIGENCIA_CODIGO_MS) };
      return await tx.invitacionGrupo.upsert({ where: { grupoId }, create: { grupoId, ...datos }, update: datos });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
    }
  }
  throw new ApiError(500, 'SERVIDOR', 'No se pudo generar el código. Inténtalo de nuevo.');
};

const invitacionPublica = (inv: { codigo: string; expiraEn: Date } | null) =>
  inv && inv.expiraEn > new Date() ? { codigo: inv.codigo, expira_en: inv.expiraEn.toISOString() } : null;

export const gruposRouter = Router();

gruposRouter.get('/grupos', async (req, res) => {
  const usuarioId = usuarioDe(req);
  const membresias = await prisma.miembroGrupo.findMany({
    where: { usuarioId },
    include: { grupo: { include: { _count: { select: { miembros: true, metas: true } } } } },
    orderBy: { unidoEn: 'asc' },
  });
  res.json({
    grupos: membresias.map(({ grupo, rol }) => ({
      id: grupo.id,
      nombre: grupo.nombre,
      rol,
      miembros: grupo._count.miembros,
      metas: grupo._count.metas,
    })),
  });
});

gruposRouter.post('/grupos', async (req, res) => {
  const usuarioId = usuarioDe(req);
  const { nombre } = z.object({ nombre: nombreSchema }).parse(req.body);
  const grupo = await prisma.$transaction(async (tx) => {
    const creado = await tx.grupo.create({ data: { nombre, miembros: { create: { usuarioId, rol: 'Admin' } } } });
    await generarInvitacion(tx, creado.id);
    return creado;
  });
  res.status(201).json({ grupo: { id: grupo.id, nombre: grupo.nombre } });
});

/** Detalle: miembros, metas compartidas, código vigente y gastos compartidos del período (S8-03). */
gruposRouter.get('/grupos/:id', async (req, res) => {
  const usuarioId = usuarioDe(req);
  const grupoId = idSchema.parse(req.params.id);
  const yo = await miMembresia(grupoId, usuarioId);
  const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
  const hoy = hoyDe(req, usuario.zonaHoraria);
  const { desde, hasta } = z
    .object({ desde: fechaKey.default(`${hoy.slice(0, 7)}-01`), hasta: fechaKey.default(hoy) })
    .parse(req.query);

  const [grupo, gastos] = await Promise.all([
    prisma.grupo.findUniqueOrThrow({
      where: { id: grupoId },
      include: {
        miembros: { include: { usuario: { select: { id: true, nombre: true } } }, orderBy: { unidoEn: 'asc' } },
        metas: { include: incluirMeta, orderBy: { id: 'desc' } },
        invitacion: true,
      },
    }),
    prisma.transaccion.findMany({
      where: { grupoId, fechaLocal: { gte: deKey(desde), lte: deKey(hasta) } },
      include: { categoria: true, usuario: { select: { nombre: true } } },
      orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
    }),
  ]);

  const miembrosActuales = new Set(grupo.miembros.map((m) => m.usuarioId));
  const totalGrupo = round2(gastos.reduce((suma, g) => suma + Number(g.monto), 0));
  const porMiembro = new Map<number, { usuario_id: number; nombre: string; total: number; es_miembro: boolean }>();
  for (const gasto of gastos) {
    const actual = porMiembro.get(gasto.usuarioId) ?? {
      usuario_id: gasto.usuarioId,
      nombre: gasto.usuario.nombre,
      total: 0,
      es_miembro: miembrosActuales.has(gasto.usuarioId),
    };
    actual.total = round2(actual.total + Number(gasto.monto));
    porMiembro.set(gasto.usuarioId, actual);
  }

  res.json({
    grupo: {
      id: grupo.id,
      nombre: grupo.nombre,
      mi_rol: yo.rol,
      miembros: grupo.miembros.map((m) => ({
        usuario_id: m.usuarioId,
        nombre: m.usuario.nombre,
        rol: m.rol,
        unido_en: m.unidoEn.toISOString(),
      })),
      invitacion: invitacionPublica(grupo.invitacion),
      metas: grupo.metas.map(metaPublica),
      gastos: {
        desde,
        hasta,
        total: totalGrupo,
        por_miembro: [...porMiembro.values()]
          .sort((a, b) => b.total - a.total)
          .map((p) => ({ ...p, porcentaje: totalGrupo > 0 ? Math.round((p.total / totalGrupo) * 100) : 0 })),
        lista: gastos.map((g) => ({
          id: g.id,
          usuario_id: g.usuarioId,
          nombre_usuario: g.usuario.nombre,
          monto: Number(g.monto),
          concepto: g.concepto,
          fecha: g.fecha.toISOString(),
          fecha_local: aKey(g.fechaLocal),
          categoria_nombre: g.categoria?.nombre,
          categoria_icono: g.categoria?.icono,
        })),
      },
    },
  });
});

gruposRouter.post('/grupos/unirse', async (req, res) => {
  const usuarioId = usuarioDe(req);
  const { codigo } = z
    .object({ codigo: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{6}$/, 'El código tiene 6 caracteres.') })
    .parse(req.body);

  const invitacion = await prisma.invitacionGrupo.findUnique({
    where: { codigo },
    include: { grupo: { include: { _count: { select: { miembros: true } } } } },
  });
  if (!invitacion) throw new ApiError(404, 'CODIGO_INVALIDO', 'Ese código no existe. Revisa que esté bien escrito.', 'codigo');
  if (invitacion.expiraEn <= new Date()) {
    throw new ApiError(400, 'CODIGO_VENCIDO', 'Ese código ya venció. Pide uno nuevo al administrador del grupo.', 'codigo');
  }
  const yaEsMiembro = await prisma.miembroGrupo.findUnique({
    where: { grupoId_usuarioId: { grupoId: invitacion.grupoId, usuarioId } },
  });
  if (yaEsMiembro) throw new ApiError(409, 'YA_ES_MIEMBRO', 'Ya eres miembro de este grupo.', 'codigo');
  if (invitacion.grupo._count.miembros >= MAX_MIEMBROS) {
    throw new ApiError(409, 'GRUPO_LLENO', `El grupo ya tiene ${MAX_MIEMBROS} miembros.`, 'codigo');
  }

  await prisma.miembroGrupo.create({ data: { grupoId: invitacion.grupoId, usuarioId } });
  res.status(201).json({ grupo: { id: invitacion.grupo.id, nombre: invitacion.grupo.nombre } });
});

/** Nuevo código; el anterior deja de servir. Solo el admin. */
gruposRouter.post('/grupos/:id/codigo', async (req, res) => {
  const grupoId = idSchema.parse(req.params.id);
  const yo = await miMembresia(grupoId, usuarioDe(req));
  if (yo.rol !== 'Admin') throw new ApiError(403, 'SIN_PERMISO', 'Solo el administrador puede generar códigos.');
  const invitacion = await prisma.$transaction((tx) => generarInvitacion(tx, grupoId));
  res.json({ invitacion: invitacionPublica(invitacion) });
});

/**
 * Salir (D43): quien sale elige si retira lo que aportó. Si era el último admin, el más antiguo
 * pasa a ser admin; si era el último miembro, el grupo y sus metas se borran.
 */
gruposRouter.post('/grupos/:id/salir', async (req, res) => {
  const usuarioId = usuarioDe(req);
  const grupoId = idSchema.parse(req.params.id);
  const { retirarAportes } = z.object({ retirarAportes: z.boolean().default(false) }).parse(req.body ?? {});
  const yo = await miMembresia(grupoId, usuarioId);

  await prisma.$transaction(async (tx) => {
    if (retirarAportes) {
      const metas = await tx.metaAhorro.findMany({ where: { grupoId }, select: { id: true } });
      for (const { id } of metas) {
        await tx.$queryRaw`SELECT id FROM "MetaAhorro" WHERE id = ${id} FOR UPDATE`;
        const aportes = await tx.aporteMeta.findMany({ where: { metaId: id, usuarioId } });
        const neto = round2(aportes.reduce((s, a) => s + (a.tipo === 'Retiro' ? -1 : 1) * Number(a.monto), 0));
        const meta = await tx.metaAhorro.findUniqueOrThrow({ where: { id } });
        const retiro = Math.min(neto, Number(meta.montoAcumulado)); // R26: nunca debajo de 0
        if (retiro <= 0) continue;
        await tx.aporteMeta.create({ data: { metaId: id, usuarioId, monto: retiro, tipo: 'Retiro', clienteId: randomUUID() } });
        await tx.metaAhorro.update({ where: { id }, data: { montoAcumulado: { decrement: retiro } } });
      }
    }

    await tx.miembroGrupo.delete({ where: { grupoId_usuarioId: { grupoId, usuarioId } } });
    const restantes = await tx.miembroGrupo.findMany({ where: { grupoId }, orderBy: { unidoEn: 'asc' } });
    if (restantes.length === 0) {
      await tx.grupo.delete({ where: { id: grupoId } });
    } else if (yo.rol === 'Admin' && !restantes.some((m) => m.rol === 'Admin')) {
      await tx.miembroGrupo.update({
        where: { grupoId_usuarioId: { grupoId, usuarioId: restantes[0].usuarioId } },
        data: { rol: 'Admin' },
      });
    }
  });
  res.status(204).end();
});

/** El admin quita a un miembro; sus aportes se quedan (D43). */
gruposRouter.delete('/grupos/:id/miembros/:usuarioId', async (req, res) => {
  const usuarioId = usuarioDe(req);
  const grupoId = idSchema.parse(req.params.id);
  const otro = idSchema.parse(req.params.usuarioId);
  const yo = await miMembresia(grupoId, usuarioId);
  if (yo.rol !== 'Admin') throw new ApiError(403, 'SIN_PERMISO', 'Solo el administrador puede quitar miembros.');
  if (otro === usuarioId) throw new ApiError(400, 'VALIDACION', 'Para salir del grupo usa "Salir del grupo".');
  const { count } = await prisma.miembroGrupo.deleteMany({ where: { grupoId, usuarioId: otro } });
  if (count === 0) throw noEncontrado('Ese miembro');
  res.status(204).end();
});
