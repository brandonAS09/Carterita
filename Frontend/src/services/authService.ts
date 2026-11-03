import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDb } from '../database/initDb';
import { hashPassword, verifyPassword } from '../utils/passwordUtils';

export interface User {
  id: number;
  nombre: string;
  email: string;
  password_hash: string;
}

export const authService = {
  // Registro de nuevo usuario
  register: async (nombre: string, email: string, password: string): Promise<User> => {
    const db = await getDb();
    const cleanEmail = email.trim().toLowerCase();
    const cleanNombre = nombre.trim();

    // Verificar si el correo ya existe
    const existing = await db.getFirstAsync<User>(
      'SELECT id FROM Usuario WHERE email = ?',
      [cleanEmail]
    );

    if (existing) {
      throw new Error('El correo electrónico ya se encuentra registrado.');
    }

    // Insertar nuevo usuario (la contraseña nunca se guarda en texto plano)
    const passwordHash = await hashPassword(password);
    const result = await db.runAsync(
      'INSERT INTO Usuario (nombre, email, password_hash) VALUES (?, ?, ?)',
      [cleanNombre, cleanEmail, passwordHash]
    );

    const newUser: User = {
      id: result.lastInsertRowId,
      nombre: cleanNombre,
      email: cleanEmail,
      password_hash: passwordHash,
    };

    // Guardar sesión activa en AsyncStorage
    await AsyncStorage.setItem('userId', newUser.id.toString());
    await AsyncStorage.setItem('userName', newUser.nombre);
    await AsyncStorage.setItem('userEmail', newUser.email);

    return newUser;
  },

  // Inicio de sesión
  login: async (email: string, password: string): Promise<User> => {
    const db = await getDb();
    const cleanEmail = email.trim().toLowerCase();

    const user = await db.getFirstAsync<User>(
      'SELECT * FROM Usuario WHERE email = ?',
      [cleanEmail]
    );

    if (!user) {
      throw new Error('Correo o contraseña incorrectos.');
    }

    if (!(await verifyPassword(password, user.password_hash))) {
      throw new Error('Correo o contraseña incorrectos.');
    }

    // Guardar sesión activa
    await AsyncStorage.setItem('userId', user.id.toString());
    await AsyncStorage.setItem('userName', user.nombre);
    await AsyncStorage.setItem('userEmail', user.email);

    return user;
  },

  // Cierre de sesión
  logout: async () => {
    await AsyncStorage.removeItem('userId');
    await AsyncStorage.removeItem('userName');
    await AsyncStorage.removeItem('userEmail');
  },

  // Obtener sesión activa
  getActiveSession: async () => {
    const userId = await AsyncStorage.getItem('userId');
    const userName = await AsyncStorage.getItem('userName');
    const userEmail = await AsyncStorage.getItem('userEmail');

    if (userId && userName) {
      return { id: Number(userId), nombre: userName, email: userEmail || '' };
    }
    return null;
  }
};
