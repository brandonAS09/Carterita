import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { usuarioDe } from '../http/auth.js';
import { ApiError, noEncontrado } from '../http/errors.js';
import { deKey, hoyDe } from '../http/fechas.js';
import { addDaysToKey } from '../domain/dateUtils.js';
import { getConversionFactor, round2 } from '../domain/currencyUtils.js';
import { calculateSmartBudget } from '../domain/smartBudgetCalculator.js';
import {
  cicloVigente,
  finDeCiclo,
  presupuestoPublico,
  totalExcedentesMovidos,
  totalGastado,
} from '../services/presupuesto.js';

const monto = z.number({ error: 'Ingresa un monto válido.' }).positive('Ingresa un monto mayor a 0.').max(99_999_999);
const tasa = z.number().positive('Tipo de cambio inválido.').max(10_000);
const tipoCiclo = z.enum(['Diario', 'Semanal', 'Mensual'], { error: 'Ciclo inválido.' });
const moneda = z.enum(['MXN', 'USD'], { error: 'Moneda inválida.' });

const crearSchema = z.object({ montoBase: monto, tipoCiclo, moneda });
const editarSchema = z.object({ montoBase: monto, tipoCiclo, moneda, tipoCambioUsd: tasa.optional() });

const zonaDe = async (usuarioId: number) =>
  (await prisma.usuario.findUnique({ where: { id: usuarioId }, select: { zonaHoraria: true } }))?.zonaHoraria ??
  'America/Tijuana';

export const presupuestoRouter = Router();

presupuestoRouter.get('/presupuesto', async (req, res) => {
  const usuarioId = usuarioDe(req);
  const presupuesto = await cicloVigente(usuarioId, hoyDe(req, await zonaDe(usuarioId)));
  if (!presupuesto) throw noEncontrado('El presupuesto');
  res.json({ presupuesto });
});

// Onboarding (F01): el ciclo inicia hoy
presupuestoRouter.post('/presupuesto', async (req, res) => {
  const usuarioId = usuarioDe(req);
  const datos = crearSchema.parse(req.body);
  const hoy = hoyDe(req, await zonaDe(usuarioId));
  if (await prisma.presupuesto.findUnique({ where: { usuarioId } })) {
    throw new ApiError(409, 'YA_EXISTE', 'Ya tienes un presupuesto configurado.');
  }
  const creado = await prisma.presupuesto.create({
    data: {
      usuarioId,
      montoBase: round2(datos.montoBase),
      tipoCiclo: datos.tipoCiclo,
      moneda: datos.moneda,
      fechaInicio: deKey(hoy),
      fechaFin: deKey(finDeCiclo(hoy, datos.tipoCiclo)),
    },
  });
  res.status(201).json({ presupuesto: presupuestoPublico(creado) });
});

/**
 * Edición (S1.1-06): solo monto = el ciclo sigue; cambio de ciclo = inicia hoy;
 * cambio de moneda = se convierten gastos, metas personales y aportes del usuario. Todo o nada.
 */
presupuestoRouter.put('/presupuesto', async (req, res) => {
  const usuarioId = usuarioDe(req);
  const datos = editarSchema.parse(req.body);
  const hoy = hoyDe(req, await zonaDe(usuarioId));
  const actual = await prisma.presupuesto.findUnique({ where: { usuarioId } });
  if (!actual) throw noEncontrado('El presupuesto');

  const cambiaMoneda = datos.moneda !== actual.moneda;
  if (cambiaMoneda && !datos.tipoCambioUsd) {
    throw new ApiError(400, 'VALIDACION', 'Tipo de cambio inválido.', 'tipoCambioUsd');
  }
  const cambiaCiclo = datos.tipoCiclo !== actual.tipoCiclo;
  const inicio = cambiaCiclo ? hoy : actual.fechaInicio.toISOString().slice(0, 10);

  const actualizado = await prisma.$transaction(async (tx) => {
    if (cambiaMoneda) {
      const factor = getConversionFactor(actual.moneda, datos.moneda, datos.tipoCambioUsd!);
      // GREATEST evita que un monto muy pequeño quede en 0 al convertir
      await tx.$executeRaw`UPDATE "Transaccion" SET monto = GREATEST(ROUND(monto * ${factor}, 2), 0.01) WHERE "usuarioId" = ${usuarioId}`;
      await tx.$executeRaw`UPDATE "MetaAhorro" SET "montoObjetivo" = GREATEST(ROUND("montoObjetivo" * ${factor}, 2), 0.01), "montoAcumulado" = ROUND("montoAcumulado" * ${factor}, 2) WHERE "usuarioId" = ${usuarioId}`;
      await tx.$executeRaw`UPDATE "AporteMeta" a SET monto = GREATEST(ROUND(a.monto * ${factor}, 2), 0.01) FROM "MetaAhorro" m WHERE a."metaId" = m.id AND m."usuarioId" = ${usuarioId}`;
    }
    return tx.presupuesto.update({
      where: { id: actual.id },
      data: {
        montoBase: round2(datos.montoBase),
        tipoCiclo: datos.tipoCiclo,
        moneda: datos.moneda,
        fechaInicio: deKey(inicio),
        fechaFin: cambiaCiclo ? deKey(finDeCiclo(inicio, datos.tipoCiclo)) : actual.fechaFin,
        ...(cambiaMoneda && { tipoCambioUsd: datos.tipoCambioUsd }),
      },
    });
  });
  res.json({ presupuesto: presupuestoPublico(actualizado) });
});

// D1 (F03): la tasa capturada al dictar un monto en otra moneda
presupuestoRouter.put('/presupuesto/tipo-cambio', async (req, res) => {
  const usuarioId = usuarioDe(req);
  const { tipoCambioUsd } = z.object({ tipoCambioUsd: tasa }).parse(req.body);
  const { count } = await prisma.presupuesto.updateMany({ where: { usuarioId }, data: { tipoCambioUsd } });
  if (count === 0) throw noEncontrado('El presupuesto');
  res.status(204).end();
});

/** F06: resumen de Inicio en una sola llamada. */
presupuestoRouter.get('/resumen/hoy', async (req, res) => {
  const usuarioId = usuarioDe(req);
  const hoy = hoyDe(req, await zonaDe(usuarioId));
  const presupuesto = await cicloVigente(usuarioId, hoy);
  if (!presupuesto) throw noEncontrado('El presupuesto');

  const [gastadoAntesDeHoy, gastadoHoy, aportadoEnCiclo] = await Promise.all([
    totalGastado(usuarioId, presupuesto.fecha_inicio, addDaysToKey(hoy, -1)),
    totalGastado(usuarioId, hoy, hoy),
    totalExcedentesMovidos(usuarioId, presupuesto.fecha_inicio, presupuesto.fecha_fin),
  ]);
  const r = calculateSmartBudget({
    montoBase: presupuesto.monto_base,
    fechaInicio: presupuesto.fecha_inicio,
    fechaFin: presupuesto.fecha_fin,
    hoy,
    gastadoAntesDeHoy,
    gastadoHoy,
    aportadoEnCiclo,
  });
  res.json({
    resumen: {
      ...r,
      limiteBase: round2(r.limiteBase),
      limiteHoy: round2(r.limiteHoy),
      disponibleHoy: round2(r.disponibleHoy),
      saldoCiclo: round2(r.saldoCiclo),
      saldoRestanteCiclo: round2(r.saldoRestanteCiclo),
      presupuesto,
      gastadoHoy: round2(gastadoHoy),
    },
  });
});
