import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import { existsSync } from 'node:fs';
import { crearApp } from '../app.js';
import { prisma } from '../db.js';
import { lineasDeOcrSpace } from '../routes/lectura.js';

const app = crearApp();
const sufijo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let token = '';

beforeAll(async () => {
  const r = await request(app)
    .post('/api/v1/auth/registro')
    .send({ nombre: 'Lectura', email: `lectura-${sufijo}@carterita.test`, password: 'secreta1' });
  token = r.body.token;
});

afterAll(async () => {
  await prisma.usuario.deleteMany({ where: { email: { endsWith: `${sufijo}@carterita.test` } } });
  await prisma.$disconnect();
});

describe('lectura de tickets y voz (S7-09)', () => {
  test('convierte la respuesta de OCR.space al formato de líneas de la app', () => {
    const lineas = lineasDeOcrSpace({
      ParsedResults: [
        {
          TextOverlay: {
            Lines: [
              {
                LineText: 'TOTAL $89.50',
                Words: [
                  { WordText: 'TOTAL', Left: 30, Top: 400, Width: 80, Height: 20 },
                  { WordText: '$89.50', Left: 300, Top: 402, Width: 90, Height: 22 },
                ],
              },
            ],
          },
        },
      ],
    });
    expect(lineas).toEqual([{ text: 'TOTAL $89.50', frame: { left: 30, top: 400, width: 360, height: 24 } }]);
  });

  test('sin archivo responde 400 y sin sesión 401', async () => {
    const sinArchivo = await request(app).post('/api/v1/ocr').set('Authorization', `Bearer ${token}`);
    expect(sinArchivo.status).toBe(400);
    expect((await request(app).post('/api/v1/voz')).status).toBe(401);
  });

  test('una foto de más de 1 MB se rechaza con un mensaje claro', async () => {
    const grande = Buffer.alloc(1024 * 1024 + 10, 0xff);
    const r = await request(app)
      .post('/api/v1/ocr')
      .set('Authorization', `Bearer ${token}`)
      .attach('foto', grande, { filename: 'ticket.jpg', contentType: 'image/jpeg' });
    expect(r.status).toBe(413);
    expect(r.body.error.mensaje).toContain('1 MB');
  });

  // Pruebas reales contra OCR.space y Groq: solo si hay llaves y los archivos de prueba existen
  const ticket = process.env.TICKET_PRUEBA;
  const audio = process.env.AUDIO_PRUEBA;

  test.runIf(!!ticket && existsSync(ticket ?? '') && !!process.env.OCR_SPACE_API_KEY)('lee un ticket real', async () => {
    const r = await request(app)
      .post('/api/v1/ocr')
      .set('Authorization', `Bearer ${token}`)
      .attach('foto', ticket!, { contentType: 'image/jpeg' });
    expect(r.status).toBe(200);
    const texto = r.body.lines.map((l: { text: string }) => l.text).join('\n');
    console.log('OCR:\n' + texto);
    expect(texto).toMatch(/89[.,]50/);
  });

  test.runIf(!!audio && existsSync(audio ?? '') && !!process.env.GROQ_API_KEY)('transcribe un audio real', async () => {
    const r = await request(app)
      .post('/api/v1/voz')
      .set('Authorization', `Bearer ${token}`)
      .attach('audio', audio!, { contentType: 'audio/wav' });
    expect(r.status).toBe(200);
    console.log('Voz:', r.body.texto);
    expect(r.body.texto.toLowerCase()).toMatch(/tacos/);
  });
});
