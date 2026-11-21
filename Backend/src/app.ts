import express from 'express';
import { prisma } from './db.js';
import { manejarErrores, rutaNoEncontrada } from './http/errors.js';
import { authRouter } from './routes/auth.js';

export const crearApp = () => {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // Render pone un proxy delante: req.ip debe ser el del cliente
  app.use(express.json({ limit: '100kb' }));

  // También sirve para "despertar" el servidor gratuito antes de usarlo
  app.get('/health', async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  });

  app.use('/api/v1/auth', authRouter);

  app.use(rutaNoEncontrada);
  app.use(manejarErrores);
  return app;
};
