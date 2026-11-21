import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { ApiError } from './errors.js';

const VIGENCIA = '30d'; // D32

export interface Sesion {
  usuarioId: number;
}

declare module 'express-serve-static-core' {
  interface Request {
    sesion?: Sesion;
  }
}

export const firmarToken = (usuarioId: number) =>
  jwt.sign({ sub: String(usuarioId) }, config.jwtSecret, { expiresIn: VIGENCIA, algorithm: 'HS256' });

const sesionExpirada = () => new ApiError(401, 'SESION_EXPIRADA', 'Tu sesión expiró. Vuelve a iniciar sesión.');

/** Exige `Authorization: Bearer <token>` válido y deja el usuario en `req.sesion`. */
export const requiereSesion: RequestHandler = (req, _res, next) => {
  const [tipo, token] = (req.headers.authorization ?? '').split(' ');
  if (tipo !== 'Bearer' || !token) return next(sesionExpirada());
  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    const usuarioId = Number(typeof payload === 'object' ? payload.sub : NaN);
    if (!Number.isInteger(usuarioId) || usuarioId <= 0) return next(sesionExpirada());
    req.sesion = { usuarioId };
    next();
  } catch {
    next(sesionExpirada());
  }
};

/** Id del usuario autenticado; solo se usa en rutas protegidas por `requiereSesion`. */
export const usuarioDe = (req: { sesion?: Sesion }) => {
  if (!req.sesion) throw sesionExpirada();
  return req.sesion.usuarioId;
};
