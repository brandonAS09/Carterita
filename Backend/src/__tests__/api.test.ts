import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { crearApp } from '../app.js';
import { prisma } from '../db.js';

const app = crearApp();
const sufijo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const HOY = '2026-11-20';

interface Cuenta {
  token: string;
  id: number;
}

const crearCuenta = async (nombre: string): Promise<Cuenta> => {
  const r = await request(app)
    .post('/api/v1/auth/registro')
    .send({ nombre, email: `api-${nombre.toLowerCase()}-${sufijo}@carterita.test`, password: 'secreta1' });
  return { token: r.body.token, id: r.body.usuario.id };
};

/** Petición autenticada con la fecha local del "teléfono". */
const como = (cuenta: Cuenta, hoy = HOY) => ({
  get: (url: string) => request(app).get(url).set('Authorization', `Bearer ${cuenta.token}`).set('X-Fecha-Local', hoy),
  post: (url: string, body: object = {}) =>
    request(app).post(url).set('Authorization', `Bearer ${cuenta.token}`).set('X-Fecha-Local', hoy).send(body),
  put: (url: string, body: object) =>
    request(app).put(url).set('Authorization', `Bearer ${cuenta.token}`).set('X-Fecha-Local', hoy).send(body),
  patch: (url: string, body: object) =>
    request(app).patch(url).set('Authorization', `Bearer ${cuenta.token}`).set('X-Fecha-Local', hoy).send(body),
  del: (url: string) => request(app).delete(url).set('Authorization', `Bearer ${cuenta.token}`).set('X-Fecha-Local', hoy),
});

let ana: Cuenta;
let luis: Cuenta;
let comida: number;

beforeAll(async () => {
  [ana, luis] = await Promise.all([crearCuenta('Ana'), crearCuenta('Luis')]);
  comida = (await prisma.categoria.findUniqueOrThrow({ where: { nombre: 'Comida' } })).id;
});

afterAll(async () => {
  const usuarios = await prisma.usuario.findMany({ where: { email: { endsWith: `${sufijo}@carterita.test` } } });
  const ids = usuarios.map((u) => u.id);
  await prisma.grupo.deleteMany({ where: { miembros: { some: { usuarioId: { in: ids } } } } });
  await prisma.metaAhorro.deleteMany({ where: { creadaPorId: { in: ids } } });
  await prisma.usuario.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

describe('presupuesto y resumen', () => {
  test('sin presupuesto: 404; al crearlo, el ciclo inicia el día del teléfono', async () => {
    expect((await como(ana).get('/api/v1/presupuesto')).status).toBe(404);
    const creado = await como(ana).post('/api/v1/presupuesto', { montoBase: 1400, tipoCiclo: 'Semanal', moneda: 'MXN' });
    expect(creado.status).toBe(201);
    expect(creado.body.presupuesto).toMatchObject({ monto_base: 1400, fecha_inicio: HOY, fecha_fin: '2026-11-26' });
  });

  test('el ciclo vencido se renueva solo', async () => {
    const r = await como(ana, '2026-11-28').get('/api/v1/presupuesto');
    expect(r.body.presupuesto).toMatchObject({ fecha_inicio: '2026-11-27', fecha_fin: '2026-12-03' });
    // Regresa al ciclo de las pruebas para lo que sigue
    await prisma.presupuesto.update({
      where: { usuarioId: ana.id },
      data: { fechaInicio: new Date(`${HOY}T00:00:00Z`), fechaFin: new Date('2026-11-26T00:00:00Z') },
    });
  });

  test('resumen de hoy con un gasto', async () => {
    await como(ana).post('/api/v1/gastos', {
      monto: 50, concepto: 'Tacos', categoriaId: comida, origen: 'Voz', fechaKey: HOY, clienteId: randomUUID(),
    });
    const r = await como(ana).get('/api/v1/resumen/hoy');
    expect(r.status).toBe(200);
    expect(r.body.resumen).toMatchObject({ limiteHoy: 200, gastadoHoy: 50, disponibleHoy: 150 });
  });
});

describe('gastos', () => {
  test('el mismo clienteId no duplica (D34)', async () => {
    const clienteId = randomUUID();
    const body = { monto: 30.456, concepto: 'Café', categoriaId: comida, fechaKey: HOY, clienteId };
    const a = await como(ana).post('/api/v1/gastos', body);
    const b = await como(ana).post('/api/v1/gastos', body);
    expect(a.status).toBe(201);
    expect(b.status).toBe(200);
    expect(b.body.gasto.id).toBe(a.body.gasto.id);
    expect(a.body.gasto.monto).toBe(30.46);
    expect(await prisma.transaccion.count({ where: { usuarioId: ana.id, clienteId } })).toBe(1);
  });

  test('un gasto de un día pasado usa el mediodía local que manda el teléfono', async () => {
    const r = await como(ana).post('/api/v1/gastos', {
      monto: 20, concepto: 'Pan', categoriaId: comida, fechaKey: '2026-11-18',
      fecha: '2026-11-18T20:00:00.000Z', clienteId: randomUUID(),
    });
    expect(r.body.gasto).toMatchObject({ fecha: '2026-11-18T20:00:00.000Z', fecha_local: '2026-11-18' });
  });

  test('un concepto de 200 letras se rechaza con un mensaje claro', async () => {
    const r = await como(ana).post('/api/v1/gastos', {
      monto: 10, concepto: 'a'.repeat(200), categoriaId: null, fechaKey: HOY, clienteId: randomUUID(),
    });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatchObject({ campo: 'concepto', mensaje: expect.stringContaining('80') });
  });

  test('doble toque: dos envíos simultáneos con el mismo clienteId guardan uno y ambos responden bien', async () => {
    const body = { monto: 33, concepto: 'Doble toque', categoriaId: null, fechaKey: HOY, clienteId: randomUUID() };
    const [a, b] = await Promise.all([como(ana).post('/api/v1/gastos', body), como(ana).post('/api/v1/gastos', body)]);
    expect([a.status, b.status].sort()).toEqual([200, 201]);
    expect(a.body.gasto.id).toBe(b.body.gasto.id);
    expect(await prisma.transaccion.count({ where: { usuarioId: ana.id, clienteId: body.clienteId } })).toBe(1);
  });

  test('doble toque en un abono: se registra uno y ninguno marca error', async () => {
    const meta = (await como(ana).post('/api/v1/metas', { nombre: 'Doble', montoObjetivo: 1000 })).body.meta;
    const body = { monto: 50, tipo: 'Abono', clienteId: randomUUID() };
    const [a, b] = await Promise.all([
      como(ana).post(`/api/v1/metas/${meta.id}/aportes`, body),
      como(ana).post(`/api/v1/metas/${meta.id}/aportes`, body),
    ]);
    expect([a.status, b.status].every((s) => s === 200 || s === 201)).toBe(true);
    expect((await prisma.metaAhorro.findUniqueOrThrow({ where: { id: meta.id } })).montoAcumulado.toNumber()).toBe(50);
  });

  test('fechas futuras y conceptos cortos se rechazan', async () => {
    const futura = await como(ana).post('/api/v1/gastos', {
      monto: 10, concepto: 'Mañana', categoriaId: null, fechaKey: '2026-11-21', clienteId: randomUUID(),
    });
    expect(futura.status).toBe(400);
    expect(futura.body.error.campo).toBe('fechaKey');
    const corto = await como(ana).post('/api/v1/gastos', {
      monto: 10, concepto: 'A', categoriaId: null, fechaKey: HOY, clienteId: randomUUID(),
    });
    expect(corto.body.error.campo).toBe('concepto');
  });

  test('editar, aprender la categoría, filtrar por rango y borrar', async () => {
    const creado = await como(ana).post('/api/v1/gastos', {
      monto: 99, concepto: 'Abarrotes Lupita', categoriaId: null, origen: 'OCR', fechaKey: HOY, clienteId: randomUUID(),
    });
    const id = creado.body.gasto.id;
    const editado = await como(ana).patch(`/api/v1/gastos/${id}`, {
      monto: 120, concepto: 'Abarrotes Lupita', categoriaId: comida, fechaKey: '2026-11-19',
    });
    expect(editado.body.gasto).toMatchObject({ monto: 120, fecha_local: '2026-11-19', origen_registro: 'OCR' });

    const aprendida = await como(ana).get(`/api/v1/categorias/aprendida?concepto=${encodeURIComponent('abarrotes  lupita.')}`);
    expect(aprendida.body.nombre).toBe('Comida');

    const ayer = await como(ana).get('/api/v1/gastos?desde=2026-11-19&hasta=2026-11-19');
    expect(ayer.body.gastos.map((g: { id: number }) => g.id)).toEqual([id]);

    expect((await como(ana).del(`/api/v1/gastos/${id}`)).status).toBe(204);
    expect((await como(ana).get(`/api/v1/gastos/${id}`)).status).toBe(404);
  });

  test('nadie toca los gastos de otra persona (Escenario 9)', async () => {
    const [gasto] = (await como(ana).get('/api/v1/gastos?limite=1')).body.gastos;
    expect((await como(luis).get(`/api/v1/gastos/${gasto.id}`)).status).toBe(404);
    expect((await como(luis).patch(`/api/v1/gastos/${gasto.id}`, { monto: 1, concepto: 'Hack', categoriaId: null })).status).toBe(404);
    expect((await como(luis).del(`/api/v1/gastos/${gasto.id}`)).status).toBe(404);
    expect((await como(luis).get('/api/v1/gastos')).body.gastos).toEqual([]);
  });
});

describe('metas', () => {
  test('abono, excedente único por día y límite del objetivo', async () => {
    const meta = (await como(ana).post('/api/v1/metas', { nombre: 'Bici', montoObjetivo: 500, icono: 'bike' })).body.meta;
    const abono = await como(ana).post(`/api/v1/metas/${meta.id}/aportes`, { monto: 100, tipo: 'Abono', clienteId: randomUUID() });
    expect(abono.body).toMatchObject({ aportado: 100, completada: false });

    const excedente = { monto: 50, tipo: 'Excedente', fechaOrigen: '2026-11-19', clienteId: randomUUID() };
    expect((await como(ana).post(`/api/v1/metas/${meta.id}/aportes`, excedente)).status).toBe(201);
    const repetido = await como(ana).post(`/api/v1/metas/${meta.id}/aportes`, { ...excedente, clienteId: randomUUID() });
    expect(repetido.status).toBe(409);

    const excede = await como(ana).post(`/api/v1/metas/${meta.id}/aportes`, { monto: 1000, tipo: 'Abono', clienteId: randomUUID() });
    expect(excede.status).toBe(400);
    expect((await como(luis).post(`/api/v1/metas/${meta.id}/aportes`, { monto: 1, tipo: 'Abono', clienteId: randomUUID() })).status).toBe(404);
  });
});

describe('grupos (Sprint 8)', () => {
  test('crear, unirse, ahorrar juntos, compartir gastos y salir retirando (Escenarios 10-16)', async () => {
    const grupo = (await como(ana).post('/api/v1/grupos', { nombre: 'Viaje' })).body.grupo;
    const detalle = (await como(ana).get(`/api/v1/grupos/${grupo.id}`)).body.grupo;
    expect(detalle.invitacion.codigo).toMatch(/^[A-HJ-KMNP-Z2-9]{6}$/);

    // Luis no ve el grupo hasta unirse
    expect((await como(luis).get(`/api/v1/grupos/${grupo.id}`)).status).toBe(404);
    const union = await como(luis).post('/api/v1/grupos/unirse', { codigo: detalle.invitacion.codigo.toLowerCase() });
    expect(union.status).toBe(201);
    expect((await como(luis).post('/api/v1/grupos/unirse', { codigo: detalle.invitacion.codigo })).status).toBe(409);

    const meta = (await como(ana).post('/api/v1/metas', { nombre: 'Oaxaca', montoObjetivo: 10000, grupoId: grupo.id })).body.meta;
    await como(ana).post(`/api/v1/metas/${meta.id}/aportes`, { monto: 500, tipo: 'Abono', clienteId: randomUUID() });
    await como(luis).post(`/api/v1/metas/${meta.id}/aportes`, { monto: 120, tipo: 'Abono', clienteId: randomUUID() });

    // Gasto compartido: cuenta en el presupuesto personal de Luis y se ve en el grupo
    await como(luis).post('/api/v1/gastos', {
      monto: 600, concepto: 'Gasolina', categoriaId: null, fechaKey: HOY, clienteId: randomUUID(), grupoId: grupo.id,
    });
    const visto = (await como(ana).get(`/api/v1/grupos/${grupo.id}`)).body.grupo;
    expect(visto.metas[0]).toMatchObject({ monto_acumulado: 620 });
    expect(visto.metas[0].aportes_por_persona.map((p: { nombre: string; total: number }) => [p.nombre, p.total])).toEqual([
      ['Ana', 500],
      ['Luis', 120],
    ]);
    expect(visto.gastos).toMatchObject({ total: 600, por_miembro: [{ nombre: 'Luis', total: 600, porcentaje: 100 }] });

    // Privacidad: Ana no ve los gastos personales de Luis
    expect((await como(ana).get('/api/v1/gastos')).body.gastos.some((g: { concepto: string }) => g.concepto === 'Gasolina')).toBe(false);

    // Luis sale retirando sus aportes (D43)
    expect((await como(luis).post(`/api/v1/grupos/${grupo.id}/salir`, { retirarAportes: true })).status).toBe(204);
    const despues = (await como(ana).get(`/api/v1/grupos/${grupo.id}`)).body.grupo;
    expect(despues.metas[0].monto_acumulado).toBe(500);
    expect(despues.metas[0].retiros).toMatchObject([{ nombre: 'Luis', monto: 120 }]);
    expect(despues.gastos.por_miembro[0]).toMatchObject({ nombre: 'Luis', es_miembro: false });
    expect((await como(luis).get(`/api/v1/grupos/${grupo.id}`)).status).toBe(404);

    // El último miembro sale: el grupo se borra
    await como(ana).post(`/api/v1/grupos/${grupo.id}/salir`, {});
    expect(await prisma.grupo.findUnique({ where: { id: grupo.id } })).toBeNull();
  });

  test('el admin se transfiere al miembro más antiguo y el código vencido no sirve', async () => {
    const grupo = (await como(ana).post('/api/v1/grupos', { nombre: 'Casa' })).body.grupo;
    const { codigo } = (await como(ana).get(`/api/v1/grupos/${grupo.id}`)).body.grupo.invitacion;
    await como(luis).post('/api/v1/grupos/unirse', { codigo });
    await como(ana).post(`/api/v1/grupos/${grupo.id}/salir`, {});
    expect((await como(luis).get(`/api/v1/grupos/${grupo.id}`)).body.grupo.mi_rol).toBe('Admin');

    await prisma.invitacionGrupo.update({ where: { grupoId: grupo.id }, data: { expiraEn: new Date(Date.now() - 1000) } });
    const vencido = await como(ana).post('/api/v1/grupos/unirse', { codigo });
    expect(vencido.body.error.codigo).toBe('CODIGO_VENCIDO');
  });
});
