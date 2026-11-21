import { beforeEach, describe, expect, jest, test } from '@jest/globals';

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: async (k: string) => store.get(k) ?? null,
    setItemAsync: async (k: string, v: string) => void store.set(k, v),
    deleteItemAsync: async (k: string) => void store.delete(k),
  };
});

import { api, ApiError, conIdempotencia, onSesionExpirada, tokenStore } from '../client';

const respuesta = (status: number, body?: unknown) =>
  ({ status, ok: status >= 200 && status < 300, text: async () => (body === undefined ? "" : JSON.stringify(body)) }) as unknown as Response;

const fetchMock = jest.fn<typeof fetch>();
globalThis.fetch = fetchMock as unknown as typeof fetch;

beforeEach(async () => {
  fetchMock.mockReset();
  await tokenStore.set('token-de-prueba');
});

describe('cliente HTTP', () => {
  test('manda token y fecha local, y devuelve el JSON', async () => {
    fetchMock.mockResolvedValueOnce(respuesta(200, { ok: 1 }));
    expect(await api('/gastos')).toEqual({ ok: 1 });
    const [, init] = fetchMock.mock.calls[0];
    const headers = init!.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer token-de-prueba');
    expect(headers['X-Fecha-Local']).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('sin red da SinConexion con un mensaje claro', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
    await expect(api('/gastos')).rejects.toMatchObject({ tipo: 'SinConexion', message: expect.stringContaining('Sin conexión') });
  });

  test('un error del servidor conserva su mensaje y el campo', async () => {
    fetchMock.mockResolvedValueOnce(
      respuesta(400, { error: { codigo: 'VALIDACION', mensaje: 'La fecha no puede ser futura.', campo: 'fechaKey' } })
    );
    const error = (await api('/gastos').catch((e) => e)) as ApiError;
    expect(error).toMatchObject({ tipo: 'Validacion', message: 'La fecha no puede ser futura.', campo: 'fechaKey' });
  });

  test('401 borra el token y avisa que la sesión expiró', async () => {
    const aviso = jest.fn();
    const quitar = onSesionExpirada(aviso);
    fetchMock.mockResolvedValueOnce(respuesta(401, { error: { codigo: 'SESION_EXPIRADA', mensaje: 'Tu sesión expiró.' } }));
    await expect(api('/gastos')).rejects.toMatchObject({ tipo: 'SesionExpirada' });
    expect(aviso).toHaveBeenCalledTimes(1);
    expect(await tokenStore.get()).toBeNull();
    quitar();
  });

  test('204 devuelve null', async () => {
    fetchMock.mockResolvedValueOnce(respuesta(204));
    expect(await api('/gastos/1', { method: 'DELETE' })).toBeNull();
  });
});

describe('idempotencia (D34)', () => {
  test('el reintento tras una falla de red usa el mismo clienteId; el siguiente gasto, uno nuevo', async () => {
    const ids: string[] = [];
    const enviar = jest.fn(async (clienteId: string) => {
      ids.push(clienteId);
      if (ids.length === 1) throw new ApiError('TiempoAgotado', 'tardó');
      return 'ok';
    });
    await expect(conIdempotencia('gasto|tacos', enviar)).rejects.toBeInstanceOf(ApiError);
    await conIdempotencia('gasto|tacos', enviar);
    await conIdempotencia('gasto|tacos', enviar);
    expect(ids[0]).toBe(ids[1]);
    expect(ids[2]).not.toBe(ids[1]);
  });

  test('un error de validación no conserva el id', async () => {
    const ids: string[] = [];
    const enviar = async (clienteId: string) => {
      ids.push(clienteId);
      if (ids.length === 1) throw new ApiError('Validacion', 'mal');
      return 'ok';
    };
    await conIdempotencia('gasto|x', enviar).catch(() => {});
    await conIdempotencia('gasto|x', enviar);
    expect(ids[0]).not.toBe(ids[1]);
  });
});
