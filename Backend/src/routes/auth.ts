import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db.js';
import { firmarToken, requiereSesion, usuarioDe } from '../http/auth.js';
import { ApiError, noEncontrado } from '../http/errors.js';
import { crearLimite } from '../http/limiteIntentos.js';

const COSTO_BCRYPT = 10;

// Mismas reglas que la pantalla de Login
const email = z.string().trim().toLowerCase().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Escribe un correo válido.');
const password = z.string().min(6, 'La contraseña debe tener al menos 6 caracteres.').max(72, 'La contraseña es demasiado larga.');
const zonaHoraria = z
  .string()
  .refine((zona) => {
    try {
      new Intl.DateTimeFormat('es-MX', { timeZone: zona });
      return true;
    } catch {
      return false;
    }
  }, 'Zona horaria inválida.')
  .optional();

const registroSchema = z.object({
  nombre: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres.').max(60, 'El nombre es demasiado largo.'),
  email,
  password,
  zonaHoraria,
});

const loginSchema = z.object({ email, password: z.string().min(1, 'Escribe tu contraseña.'), zonaHoraria });

const limiteLogin = crearLimite(5, 60_000, 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.');

const usuarioPublico = (u: { id: number; nombre: string; email: string; zonaHoraria: string }) => ({
  id: u.id,
  nombre: u.nombre,
  email: u.email,
  zonaHoraria: u.zonaHoraria,
});

export const authRouter = Router();

authRouter.post('/registro', async (req, res) => {
  const datos = registroSchema.parse(req.body);
  const existente = await prisma.usuario.findUnique({ where: { email: datos.email } });
  if (existente) throw new ApiError(409, 'CORREO_REGISTRADO', 'El correo electrónico ya se encuentra registrado.', 'email');

  const usuario = await prisma.usuario.create({
    data: {
      nombre: datos.nombre,
      email: datos.email,
      passwordHash: await bcrypt.hash(datos.password, COSTO_BCRYPT),
      ...(datos.zonaHoraria && { zonaHoraria: datos.zonaHoraria }),
    },
  });
  res.status(201).json({ token: firmarToken(usuario.id), usuario: usuarioPublico(usuario) });
});

authRouter.post('/login', async (req, res) => {
  const datos = loginSchema.parse(req.body);
  const clave = `${datos.email}|${req.ip}`;
  limiteLogin.revisar(clave);

  const usuario = await prisma.usuario.findUnique({ where: { email: datos.email } });
  if (!usuario || !(await bcrypt.compare(datos.password, usuario.passwordHash))) {
    limiteLogin.registrar(clave);
    throw new ApiError(401, 'CREDENCIALES', 'Correo o contraseña incorrectos.');
  }
  limiteLogin.limpiar(clave);

  // La zona horaria se actualiza en cada login por si el usuario viajó o cambió de teléfono (D30)
  const actualizado =
    datos.zonaHoraria && datos.zonaHoraria !== usuario.zonaHoraria
      ? await prisma.usuario.update({ where: { id: usuario.id }, data: { zonaHoraria: datos.zonaHoraria } })
      : usuario;
  res.json({ token: firmarToken(usuario.id), usuario: usuarioPublico(actualizado) });
});

authRouter.get('/yo', requiereSesion, async (req, res) => {
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioDe(req) } });
  if (!usuario) throw noEncontrado('El usuario');
  res.json({ usuario: usuarioPublico(usuario) });
});
