import { afterAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import { crearApp } from '../app.js';
import { prisma } from '../db.js';

// Pruebas contra la base de desarrollo de Neon; cada corrida usa correos únicos y los borra al final.
const app = crearApp();
const sufijo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const correo = (nombre: string) => `prueba-${nombre}-${sufijo}@carterita.test`;

afterAll(async () => {
  await prisma.usuario.deleteMany({ where: { email: { endsWith: `${sufijo}@carterita.test` } } });
  await prisma.$disconnect();
});

describe('cuenta y sesión', () => {
  test('registro, login y /yo con el token', async () => {
    const email = correo('ana');
    const registro = await request(app)
      .post('/api/v1/auth/registro')
      .send({ nombre: 'Ana', email: email.toUpperCase(), password: 'secreta1', zonaHoraria: 'America/Tijuana' });
    expect(registro.status).toBe(201);
    expect(registro.body.usuario).toMatchObject({ nombre: 'Ana', email, zonaHoraria: 'America/Tijuana' });
    expect(registro.body.usuario.passwordHash).toBeUndefined();

    const login = await request(app).post('/api/v1/auth/login').send({ email, password: 'secreta1' });
    expect(login.status).toBe(200);

    const yo = await request(app).get('/api/v1/auth/yo').set('Authorization', `Bearer ${login.body.token}`);
    expect(yo.status).toBe(200);
    expect(yo.body.usuario.email).toBe(email);
  });

  test('la contraseña se guarda con hash', async () => {
    const email = correo('hash');
    await request(app).post('/api/v1/auth/registro').send({ nombre: 'Hash', email, password: 'secreta1' });
    const usuario = await prisma.usuario.findUnique({ where: { email } });
    expect(usuario?.passwordHash).not.toContain('secreta1');
    expect(usuario?.passwordHash.startsWith('$2')).toBe(true);
  });

  test('correo duplicado responde 409', async () => {
    const email = correo('dup');
    await request(app).post('/api/v1/auth/registro').send({ nombre: 'Uno', email, password: 'secreta1' });
    const otra = await request(app).post('/api/v1/auth/registro').send({ nombre: 'Dos', email, password: 'secreta1' });
    expect(otra.status).toBe(409);
    expect(otra.body.error).toMatchObject({ codigo: 'CORREO_REGISTRADO', campo: 'email' });
  });

  test('validaciones del registro', async () => {
    const corta = await request(app).post('/api/v1/auth/registro').send({ nombre: 'Ana', email: correo('v'), password: '123' });
    expect(corta.status).toBe(400);
    expect(corta.body.error).toMatchObject({ codigo: 'VALIDACION', campo: 'password' });

    const zona = await request(app)
      .post('/api/v1/auth/registro')
      .send({ nombre: 'Ana', email: correo('z'), password: 'secreta1', zonaHoraria: 'Marte/Olimpo' });
    expect(zona.status).toBe(400);
    expect(zona.body.error.campo).toBe('zonaHoraria');
  });

  test('credenciales incorrectas y límite de intentos', async () => {
    const email = correo('limite');
    await request(app).post('/api/v1/auth/registro').send({ nombre: 'Lim', email, password: 'secreta1' });
    for (let i = 0; i < 5; i++) {
      const fallo = await request(app).post('/api/v1/auth/login').send({ email, password: 'mala' });
      expect(fallo.status).toBe(401);
    }
    const bloqueado = await request(app).post('/api/v1/auth/login').send({ email, password: 'secreta1' });
    expect(bloqueado.status).toBe(429);
  });

  test('sin token o con token falso responde 401', async () => {
    expect((await request(app).get('/api/v1/auth/yo')).status).toBe(401);
    const falso = await request(app).get('/api/v1/auth/yo').set('Authorization', 'Bearer abc.def.ghi');
    expect(falso.status).toBe(401);
    expect(falso.body.error.codigo).toBe('SESION_EXPIRADA');
  });

  test('health responde y una ruta inexistente da 404 con el formato de error', async () => {
    expect((await request(app).get('/health')).body).toEqual({ ok: true });
    const nada = await request(app).get('/api/v1/nada');
    expect(nada.status).toBe(404);
    expect(nada.body.error.codigo).toBe('NO_ENCONTRADO');
  });
});
