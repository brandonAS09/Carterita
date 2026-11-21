import type { ErrorRequestHandler, RequestHandler } from 'express';
import { z } from 'zod';
import { Prisma } from '../generated/prisma/client.js';

/** Error con código y mensaje en español que la app puede mostrar tal cual. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    message: string,
    readonly campo?: string
  ) {
    super(message);
  }
}

export const noEncontrado = (que = 'El recurso') => new ApiError(404, 'NO_ENCONTRADO', `${que} no existe.`);

export const rutaNoEncontrada: RequestHandler = (_req, _res, next) => next(noEncontrado('La ruta'));

/** Formato único de error: { error: { codigo, mensaje, campo? } } */
export const manejarErrores: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ApiError) {
    res.status(error.status).json({ error: { codigo: error.codigo, mensaje: error.message, campo: error.campo } });
    return;
  }
  if (error instanceof z.ZodError) {
    const issue = error.issues[0];
    res.status(400).json({
      error: { codigo: 'VALIDACION', mensaje: issue?.message ?? 'Datos inválidos.', campo: issue?.path.join('.') },
    });
    return;
  }
  // JSON mal formado o cuerpo demasiado grande (los pone express.json)
  if (error?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { codigo: 'JSON_INVALIDO', mensaje: 'El cuerpo de la petición no es JSON válido.' } });
    return;
  }
  if (error?.type === 'entity.too.large') {
    res.status(413).json({ error: { codigo: 'MUY_GRANDE', mensaje: 'La petición es demasiado grande.' } });
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
    res.status(404).json({ error: { codigo: 'NO_ENCONTRADO', mensaje: 'El recurso no existe.' } });
    return;
  }
  console.error('Error no controlado:', error);
  res.status(500).json({ error: { codigo: 'SERVIDOR', mensaje: 'Ocurrió un error en el servidor. Inténtalo de nuevo.' } });
};
