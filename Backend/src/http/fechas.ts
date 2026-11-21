import type { Request } from 'express';
import { z } from 'zod';

/** 'YYYY-MM-DD' válido (también rechaza días inexistentes como 2026-02-30). */
export const fechaKey = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida.')
  .refine((key) => {
    const fecha = new Date(`${key}T00:00:00Z`);
    return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === key;
  }, 'Fecha inválida.');

/** Día de hoy en una zona horaria IANA. */
export const hoyEnZona = (zonaHoraria: string, ahora = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: zonaHoraria, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    ahora
  );

/**
 * "Hoy" del usuario (D30): el teléfono lo manda en `X-Fecha-Local`; si falta o es inválido,
 * se calcula con la zona horaria guardada. Solo afecta los cálculos de sus propios datos.
 */
export const hoyDe = (req: Request, zonaHoraria: string) => {
  const enviada = fechaKey.safeParse(req.header('x-fecha-local'));
  return enviada.success ? enviada.data : hoyEnZona(zonaHoraria);
};

/** Columna DATE de Prisma (medianoche UTC) ↔ 'YYYY-MM-DD'. */
export const aKey = (fecha: Date) => fecha.toISOString().slice(0, 10);
export const deKey = (key: string) => new Date(`${key}T00:00:00Z`);
