import * as SQLite from 'expo-sqlite';

export const initDatabase = async () => {
  try {
    // Abrimos la base de datos de manera asíncrona (Soportado en versiones recientes de Expo)
    const db = await SQLite.openDatabaseAsync('carterita.db');
    
    // Es vital encender las foreign keys en SQLite ya que vienen apagadas por defecto
    await db.execAsync('PRAGMA foreign_keys = ON;');

    // 1. Crear tabla Usuario
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS Usuario (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        nombre TEXT NOT NULL
      );
    `);

    // 2. Crear tabla Presupuesto (asociado a Usuario)
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS Presupuesto (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        monto_base REAL NOT NULL,
        tipo_ciclo TEXT NOT NULL,
        moneda TEXT NOT NULL DEFAULT 'MXN',
        fecha_inicio TEXT NOT NULL,
        FOREIGN KEY (usuario_id) REFERENCES Usuario (id) ON DELETE CASCADE
      );
    `);

    // 3. Crear tabla Categoria
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS Categoria (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        icono TEXT NOT NULL
      );
    `);

    // 4. Crear tabla Transaccion (asociada a Usuario y Categoria)
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS Transaccion (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        monto REAL NOT NULL,
        fecha TEXT NOT NULL,
        concepto TEXT NOT NULL,
        categoria_id INTEGER,
        origen_registro TEXT NOT NULL DEFAULT 'Manual',
        FOREIGN KEY (usuario_id) REFERENCES Usuario (id) ON DELETE CASCADE,
        FOREIGN KEY (categoria_id) REFERENCES Categoria (id) ON DELETE SET NULL
      );
    `);

    console.log('Base de datos inicializada correctamente');
    return db;
  } catch (error) {
    console.error('Error al inicializar la base de datos:', error);
    throw error;
  }
};
