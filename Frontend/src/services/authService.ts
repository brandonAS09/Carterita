import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, tokenStore } from '../api/client';

export interface User {
  id: number;
  nombre: string;
  email: string;
}

interface RespuestaSesion {
  token: string;
  usuario: User & { zonaHoraria: string };
}

/** D30: la zona horaria del teléfono viaja con el registro y el login. */
const zonaHoraria = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
};

/** D32: el token va en SecureStore; nombre y correo en AsyncStorage para mostrarlos sin red. */
const guardarSesion = async ({ token, usuario }: RespuestaSesion): Promise<User> => {
  await tokenStore.set(token);
  await AsyncStorage.multiSet([
    ['userId', String(usuario.id)],
    ['userName', usuario.nombre],
    ['userEmail', usuario.email],
  ]);
  return { id: usuario.id, nombre: usuario.nombre, email: usuario.email };
};

export const authService = {
  register: async (nombre: string, email: string, password: string): Promise<User> =>
    guardarSesion(
      await api<RespuestaSesion>('/auth/registro', {
        method: 'POST',
        auth: false,
        body: { nombre: nombre.trim(), email: email.trim(), password, zonaHoraria: zonaHoraria() },
      })
    ),

  login: async (email: string, password: string): Promise<User> =>
    guardarSesion(
      await api<RespuestaSesion>('/auth/login', {
        method: 'POST',
        auth: false,
        body: { email: email.trim(), password, zonaHoraria: zonaHoraria() },
      })
    ),

  /** Funciona sin red: solo borra lo guardado en el teléfono. */
  logout: async () => {
    await tokenStore.clear();
    await AsyncStorage.multiRemove(['userId', 'userName', 'userEmail']);
  },

  /** Sesión guardada en el teléfono (sin consultar la red). */
  getActiveSession: async (): Promise<User | null> => {
    const token = await tokenStore.get();
    const [[, userId], [, userName], [, userEmail]] = await AsyncStorage.multiGet(['userId', 'userName', 'userEmail']);
    if (token && userId && userName) return { id: Number(userId), nombre: userName, email: userEmail || '' };
    return null;
  },
};
