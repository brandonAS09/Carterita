import * as SecureStore from 'expo-secure-store';
import { toLocalDateKey } from '../utils/dateUtils';

/**
 * S7-06 / S7-07: único punto de salida a la red.
 * - Agrega la URL base, el token y la fecha local del teléfono (D30).
 * - Corta a los 15 s y convierte cada falla en un ApiError con un tipo y un mensaje listo para mostrar.
 * - Avisa cuando una petición tarda (servidor gratuito despertando, D31) y cuando la sesión expira.
 */

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'https://carterita-api-r4u1.onrender.com').replace(/\/$/, '');

const TIMEOUT_MS = 15_000;
const TIMEOUT_DESPERTANDO_MS = 75_000; // la primera petición puede tardar mientras Render despierta
const AVISO_LENTO_MS = 5_000;
const TOKEN_KEY = 'carterita.token';

export type ApiErrorTipo =
  | 'SinConexion'
  | 'TiempoAgotado'
  | 'SesionExpirada'
  | 'Validacion'
  | 'NoEncontrado'
  | 'Conflicto'
  | 'Servidor';

export class ApiError extends Error {
  constructor(
    readonly tipo: ApiErrorTipo,
    message: string,
    readonly status = 0,
    readonly codigo?: string,
    readonly campo?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const MENSAJES: Record<ApiErrorTipo, string> = {
  SinConexion: 'Sin conexión a internet. Revisa tu red e inténtalo de nuevo.',
  TiempoAgotado: 'El servidor tardó demasiado en responder. Inténtalo de nuevo.',
  SesionExpirada: 'Tu sesión expiró. Vuelve a iniciar sesión.',
  Validacion: 'Revisa los datos e inténtalo de nuevo.',
  NoEncontrado: 'No encontramos lo que buscabas.',
  Conflicto: 'No se pudo completar la acción.',
  Servidor: 'Ocurrió un error en el servidor. Inténtalo de nuevo.',
};

/** Mensaje para mostrar al usuario a partir de cualquier error. */
export const mensajeDeError = (error: unknown, porDefecto = MENSAJES.Servidor): string =>
  error instanceof ApiError ? error.message : porDefecto;

export const esErrorDeRed = (error: unknown) =>
  error instanceof ApiError && (error.tipo === 'SinConexion' || error.tipo === 'TiempoAgotado');

// ── Token ─────────────────────────────────────────────
let tokenEnMemoria: string | null | undefined;

export const tokenStore = {
  get: async () => {
    if (tokenEnMemoria === undefined) {
      try {
        tokenEnMemoria = await SecureStore.getItemAsync(TOKEN_KEY);
      } catch {
        tokenEnMemoria = null;
      }
    }
    return tokenEnMemoria;
  },
  set: async (token: string) => {
    tokenEnMemoria = token;
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  },
  clear: async () => {
    tokenEnMemoria = null;
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch {
      /* ya no existía */
    }
  },
};

// ── Eventos para la interfaz (banda de red y sesión expirada) ──
type Listener = () => void;
const sesionExpiradaListeners = new Set<Listener>();
const lentitudListeners = new Set<(lentas: number) => void>();
let peticionesLentas = 0;
let servidorDespierto = false;

export const onSesionExpirada = (listener: Listener) => {
  sesionExpiradaListeners.add(listener);
  return () => sesionExpiradaListeners.delete(listener);
};

export const onPeticionesLentas = (listener: (lentas: number) => void) => {
  lentitudListeners.add(listener);
  return () => lentitudListeners.delete(listener);
};

const cambiarLentas = (delta: number) => {
  peticionesLentas = Math.max(0, peticionesLentas + delta);
  lentitudListeners.forEach((l) => l(peticionesLentas));
};

const tipoPorStatus = (status: number): ApiErrorTipo => {
  if (status === 401) return 'SesionExpirada';
  if (status === 400 || status === 422 || status === 413 || status === 429) return 'Validacion';
  if (status === 404) return 'NoEncontrado';
  if (status === 409 || status === 403) return 'Conflicto';
  return 'Servidor';
};

interface Opciones {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** FormData para subir archivos (escáner y voz desde Expo Go). */
  form?: FormData;
  auth?: boolean;
  timeoutMs?: number;
}

interface Crudo {
  status: number;
  texto: string;
}

const enviarConFetch = async (
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string | undefined,
  signal: AbortSignal
): Promise<Crudo> => {
  const r = await fetch(url, { method, headers, body, signal });
  return { status: r.status, texto: r.status === 204 ? '' : await r.text() };
};

const enviarConXhr = (
  url: string,
  method: string,
  headers: Record<string, string>,
  form: FormData,
  signal: AbortSignal
): Promise<Crudo> =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.onload = () => resolve({ status: xhr.status, texto: xhr.responseText ?? '' });
    xhr.onerror = () => reject(new TypeError('Network request failed'));
    xhr.onabort = () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
    signal.addEventListener('abort', () => xhr.abort());
    xhr.send(form);
  });

/** Hace la petición y devuelve el JSON (o null en 204). Lanza siempre ApiError. */
export const api = async <T>(ruta: string, opciones: Opciones = {}): Promise<T> => {
  const { method = 'GET', body, form, auth = true, timeoutMs } = opciones;
  const headers: Record<string, string> = { Accept: 'application/json', 'X-Fecha-Local': toLocalDateKey() };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = await tokenStore.get();
    if (!token) throw new ApiError('SesionExpirada', MENSAJES.SesionExpirada, 401);
    headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const limite = timeoutMs ?? (servidorDespierto ? TIMEOUT_MS : TIMEOUT_DESPERTANDO_MS);
  const corte = setTimeout(() => controller.abort(), limite);
  let marcadaLenta = false;
  const aviso = setTimeout(() => {
    marcadaLenta = true;
    cambiarLentas(1);
  }, AVISO_LENTO_MS);

  let respuesta: Crudo;
  try {
    const url = `${API_URL}/api/v1${ruta}`;
    // Los archivos (foto o audio con `uri`) se suben con XMLHttpRequest: el fetch de Expo no los acepta
    respuesta = form
      ? await enviarConXhr(url, method, headers, form, controller.signal)
      : await enviarConFetch(url, method, headers, body !== undefined ? JSON.stringify(body) : undefined, controller.signal);
  } catch (error: any) {
    if (__DEV__) console.warn(`La petición ${method} ${ruta} no llegó al servidor:`, error?.message ?? error);
    if (error?.name === 'AbortError') throw new ApiError('TiempoAgotado', MENSAJES.TiempoAgotado);
    throw new ApiError('SinConexion', MENSAJES.SinConexion);
  } finally {
    clearTimeout(corte);
    clearTimeout(aviso);
    if (marcadaLenta) cambiarLentas(-1);
  }
  servidorDespierto = true;

  if (respuesta.status === 204) return null as T;
  let datos: any = null;
  try {
    datos = respuesta.texto ? JSON.parse(respuesta.texto) : null;
  } catch {
    /* respuesta sin JSON (p. ej. página de error del proveedor) */
  }

  if (respuesta.status < 200 || respuesta.status >= 300) {
    const tipo = tipoPorStatus(respuesta.status);
    const error = new ApiError(
      tipo,
      datos?.error?.mensaje ?? MENSAJES[tipo],
      respuesta.status,
      datos?.error?.codigo,
      datos?.error?.campo
    );
    if (tipo === 'SesionExpirada' && auth) {
      await tokenStore.clear();
      sesionExpiradaListeners.forEach((l) => l());
    }
    throw error;
  }
  return datos as T;
};

/** Despierta el servidor gratuito al abrir la app, sin esperar ni fallar (R17). */
export const despertarServidor = () => {
  fetch(`${API_URL}/health`)
    .then(() => {
      servidorDespierto = true;
    })
    .catch(() => {});
};

/**
 * D34: identificador por guardado. Si un intento falla por red, el reintento con los mismos datos
 * reutiliza el mismo id y el servidor no lo duplica; tras un éxito, el siguiente gasto igual es nuevo.
 */
const pendientes = new Map<string, string>();
const nuevoId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;

export const conIdempotencia = async <T>(huella: string, enviar: (clienteId: string) => Promise<T>): Promise<T> => {
  const clienteId = pendientes.get(huella) ?? nuevoId();
  pendientes.set(huella, clienteId);
  try {
    const resultado = await enviar(clienteId);
    pendientes.delete(huella);
    return resultado;
  } catch (error) {
    // Solo se conserva el id si no sabemos si el servidor lo recibió
    if (!esErrorDeRed(error)) pendientes.delete(huella);
    throw error;
  }
};
