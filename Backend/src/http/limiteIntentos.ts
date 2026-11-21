import { ApiError } from './errors.js';

/**
 * Límite simple en memoria: N intentos por clave en una ventana de tiempo.
 * Suficiente para una sola instancia del servidor (plan gratuito de Render).
 */
export const crearLimite = (maximo: number, ventanaMs: number, mensaje: string) => {
  const registros = new Map<string, number[]>();

  return {
    revisar(clave: string, ahora = Date.now()) {
      const recientes = (registros.get(clave) ?? []).filter((t) => ahora - t < ventanaMs);
      registros.set(clave, recientes);
      if (recientes.length >= maximo) throw new ApiError(429, 'DEMASIADOS_INTENTOS', mensaje);
    },
    registrar(clave: string, ahora = Date.now()) {
      registros.set(clave, [...(registros.get(clave) ?? []), ahora]);
    },
    limpiar(clave: string) {
      registros.delete(clave);
    },
  };
};
