import * as SQLite from 'expo-sqlite';
import { hashPassword, isHashedPassword } from '../utils/passwordUtils';
import { addDaysToKey, toLocalDateKey, parseDateKey } from '../utils/dateUtils';

/**
 * Conexión única (singleton) a SQLite + migraciones versionadas con PRAGMA user_version.
 *
 * Para cambiar el esquema: agrega una nueva función al arreglo MIGRATIONS.
 * NUNCA edites una migración ya publicada; los dispositivos que ya la corrieron no la repetirán.
 */

type Migration = (db: SQLite.SQLiteDatabase) => Promise<void>;

// ─────────────────────────────────────────────
// v1 — Esquema base del Sprint 1
// ─────────────────────────────────────────────
const migrationV1: Migration = async (db) => {
  // IF NOT EXISTS: las BD creadas antes de las migraciones (user_version = 0) ya tienen estas tablas.
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS Usuario (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      nombre TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS Presupuesto (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      monto_base REAL NOT NULL,
      tipo_ciclo TEXT NOT NULL,
      moneda TEXT NOT NULL DEFAULT 'MXN',
      fecha_inicio TEXT NOT NULL,
      FOREIGN KEY (usuario_id) REFERENCES Usuario (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Categoria (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      icono TEXT NOT NULL
    );

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

  const catCount = await db.getFirstAsync<{ total: number }>(
    'SELECT COUNT(*) AS total FROM Categoria'
  );
  if (catCount && catCount.total === 0) {
    const categorias = [
      { nombre: 'Comida', icono: 'utensils' },
      { nombre: 'Transporte', icono: 'car' },
      { nombre: 'Entretenimiento', icono: 'tv' },
      { nombre: 'Salud', icono: 'heart-pulse' },
      { nombre: 'Compras', icono: 'shopping-bag' },
      { nombre: 'Educación', icono: 'book-open' },
      { nombre: 'Servicios', icono: 'bolt' },
      { nombre: 'Otros', icono: 'circle-ellipsis' },
    ];
    for (const cat of categorias) {
      await db.runAsync('INSERT INTO Categoria (nombre, icono) VALUES (?, ?)', [
        cat.nombre,
        cat.icono,
      ]);
    }
  }
};

// ─────────────────────────────────────────────
// v2 — Preparación Sprint 2 (F06 / F07) + hash de contraseñas
// ─────────────────────────────────────────────
const migrationV2: Migration = async (db) => {
  await db.execAsync(`
    ALTER TABLE Presupuesto ADD COLUMN fecha_fin TEXT;
    ALTER TABLE Categoria ADD COLUMN es_default INTEGER NOT NULL DEFAULT 1;

    CREATE TABLE IF NOT EXISTS MetaAhorro (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      nombre TEXT NOT NULL,
      monto_objetivo REAL NOT NULL,
      monto_acumulado REAL NOT NULL DEFAULT 0,
      icono TEXT,
      fecha_limite TEXT,
      FOREIGN KEY (usuario_id) REFERENCES Usuario (id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_transaccion_usuario_fecha ON Transaccion (usuario_id, fecha);
  `);

  // Normalizar fecha_inicio a 'YYYY-MM-DD' local y calcular fecha_fin de los presupuestos existentes.
  const presupuestos = await db.getAllAsync<{ id: number; tipo_ciclo: string; fecha_inicio: string }>(
    'SELECT id, tipo_ciclo, fecha_inicio FROM Presupuesto'
  );
  for (const p of presupuestos) {
    const inicio = toLocalDateKey(parseDateKey(p.fecha_inicio));
    const fin = addDaysToKey(inicio, cycleLengthInDays(p.tipo_ciclo) - 1);
    await db.runAsync('UPDATE Presupuesto SET fecha_inicio = ?, fecha_fin = ? WHERE id = ?', [
      inicio,
      fin,
      p.id,
    ]);
  }

  // Las contraseñas del Sprint 1 estaban en texto plano: se convierten a hash.
  const usuarios = await db.getAllAsync<{ id: number; password_hash: string }>(
    'SELECT id, password_hash FROM Usuario'
  );
  for (const u of usuarios) {
    if (!isHashedPassword(u.password_hash)) {
      await db.runAsync('UPDATE Usuario SET password_hash = ? WHERE id = ?', [
        await hashPassword(u.password_hash),
        u.id,
      ]);
    }
  }
};

// ─────────────────────────────────────────────
// v3 — Edición de presupuesto y conversión MXN ↔ USD (S1.1-06)
// ─────────────────────────────────────────────
const migrationV3: Migration = async (db) => {
  await db.execAsync(`
    ALTER TABLE Presupuesto ADD COLUMN tipo_cambio_usd REAL;
    UPDATE Presupuesto SET moneda = 'MXN' WHERE moneda NOT IN ('MXN', 'USD');
  `);
};

// ─────────────────────────────────────────────
// v4 — Aportes a metas de ahorro (F07, Sprint 3)
// ─────────────────────────────────────────────
const migrationV4: Migration = async (db) => {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS AporteMeta (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meta_id INTEGER NOT NULL,
      usuario_id INTEGER NOT NULL,
      monto REAL NOT NULL,
      fecha TEXT NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'Excedente',
      fecha_origen TEXT,
      FOREIGN KEY (meta_id) REFERENCES MetaAhorro (id) ON DELETE CASCADE,
      FOREIGN KEY (usuario_id) REFERENCES Usuario (id) ON DELETE CASCADE
    );

    -- El excedente de un día solo puede moverse una vez
    CREATE UNIQUE INDEX IF NOT EXISTS ux_aporte_excedente_dia
      ON AporteMeta (usuario_id, fecha_origen) WHERE tipo = 'Excedente';

    CREATE INDEX IF NOT EXISTS idx_aporte_meta ON AporteMeta (meta_id);
  `);
};

// ─────────────────────────────────────────────
// v5 — Reparación de esquema de metas (Sprint 3)
// Algunas BD conservaban tablas MetaAhorro / AporteMeta de un intento previo (descartado)
// con columnas distintas (ej. `fecha_creacion NOT NULL`). Como v2/v4 usan CREATE TABLE
// IF NOT EXISTS, esas tablas nunca se actualizaron. Aquí se reconstruyen si no coinciden.
// ─────────────────────────────────────────────
interface TableSpec {
  create: string;              // CREATE TABLE <nombre> (...) canónico
  columns: string[];           // columnas canónicas
  required: string[];          // sin estas columnas los datos viejos no se pueden copiar
  selectExpr?: Record<string, string>; // expresión de copia por columna (para NULLs)
  after?: string;              // índices a recrear
}

const GOAL_TABLES: Record<'MetaAhorro' | 'AporteMeta', TableSpec> = {
  MetaAhorro: {
    create: `CREATE TABLE MetaAhorro (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      nombre TEXT NOT NULL,
      monto_objetivo REAL NOT NULL,
      monto_acumulado REAL NOT NULL DEFAULT 0,
      icono TEXT,
      fecha_limite TEXT,
      FOREIGN KEY (usuario_id) REFERENCES Usuario (id) ON DELETE CASCADE
    )`,
    columns: ['id', 'usuario_id', 'nombre', 'monto_objetivo', 'monto_acumulado', 'icono', 'fecha_limite'],
    required: ['id', 'usuario_id', 'nombre', 'monto_objetivo'],
    selectExpr: { monto_acumulado: 'COALESCE(monto_acumulado, 0)' },
  },
  AporteMeta: {
    create: `CREATE TABLE AporteMeta (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meta_id INTEGER NOT NULL,
      usuario_id INTEGER NOT NULL,
      monto REAL NOT NULL,
      fecha TEXT NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'Excedente',
      fecha_origen TEXT,
      FOREIGN KEY (meta_id) REFERENCES MetaAhorro (id) ON DELETE CASCADE,
      FOREIGN KEY (usuario_id) REFERENCES Usuario (id) ON DELETE CASCADE
    )`,
    columns: ['id', 'meta_id', 'usuario_id', 'monto', 'fecha', 'tipo', 'fecha_origen'],
    required: ['id', 'meta_id', 'usuario_id', 'monto', 'fecha'],
    selectExpr: { tipo: "COALESCE(tipo, 'Excedente')" },
    after: `
      CREATE UNIQUE INDEX IF NOT EXISTS ux_aporte_excedente_dia
        ON AporteMeta (usuario_id, fecha_origen) WHERE tipo = 'Excedente';
      CREATE INDEX IF NOT EXISTS idx_aporte_meta ON AporteMeta (meta_id);
    `,
  },
};

/**
 * Procedimiento recomendado por SQLite para cambiar un esquema: crear tabla nueva,
 * copiar, borrar la vieja y renombrar. Requiere foreign_keys = OFF (ver openAndPrepare).
 */
const rebuildTableIfSchemaDiffers = async (db: SQLite.SQLiteDatabase, table: string, spec: TableSpec) => {
  const info = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  const actual = info.map((c) => c.name);

  if (actual.length === 0) {
    await db.execAsync(`${spec.create};${spec.after ?? ''}`);
    return;
  }
  const matches = actual.length === spec.columns.length && spec.columns.every((c) => actual.includes(c));
  if (matches) return;

  console.log(`Reparando esquema de ${table}: [${actual.join(', ')}] → [${spec.columns.join(', ')}]`);
  await db.execAsync(spec.create.replace(`CREATE TABLE ${table}`, `CREATE TABLE ${table}_nueva`));

  if (spec.required.every((c) => actual.includes(c))) {
    const common = spec.columns.filter((c) => actual.includes(c));
    const select = common.map((c) => spec.selectExpr?.[c] ?? c);
    try {
      await db.execAsync(
        `INSERT INTO ${table}_nueva (${common.join(', ')}) SELECT ${select.join(', ')} FROM ${table}`
      );
    } catch (error) {
      console.warn(`No se pudieron copiar los datos previos de ${table}; se descartan.`, error);
    }
  } else {
    console.warn(`${table} previa sin columnas obligatorias; sus datos se descartan.`);
  }

  await db.execAsync(`DROP TABLE ${table}; ALTER TABLE ${table}_nueva RENAME TO ${table};${spec.after ?? ''}`);
};

const migrationV5: Migration = async (db) => {
  await rebuildTableIfSchemaDiffers(db, 'MetaAhorro', GOAL_TABLES.MetaAhorro);
  await rebuildTableIfSchemaDiffers(db, 'AporteMeta', GOAL_TABLES.AporteMeta);
  // Aportes huérfanos (de metas que no sobrevivieron a la reparación)
  await db.execAsync('DELETE FROM AporteMeta WHERE meta_id NOT IN (SELECT id FROM MetaAhorro)');
};

const MIGRATIONS: Migration[] = [migrationV1, migrationV2, migrationV3, migrationV4, migrationV5];

/** Duración en días de cada ciclo (fuente única, usada también por budgetService). */
export const cycleLengthInDays = (tipoCiclo: string): number => {
  switch (tipoCiclo) {
    case 'Semanal':
      return 7;
    case 'Mensual':
      return 30;
    default:
      return 1; // 'Diario'
  }
};

const runMigrations = async (db: SQLite.SQLiteDatabase) => {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = row?.user_version ?? 0;

  for (let version = currentVersion + 1; version <= MIGRATIONS.length; version++) {
    await db.withTransactionAsync(async () => {
      await MIGRATIONS[version - 1](db);
      // PRAGMA no acepta parámetros; `version` es un entero controlado por nosotros.
      await db.execAsync(`PRAGMA user_version = ${version}`);
    });
    console.log(`Migración de BD aplicada: v${version}`);
  }
};

const openAndPrepare = async (): Promise<SQLite.SQLiteDatabase> => {
  const db = await SQLite.openDatabaseAsync('carterita.db');
  // Las migraciones corren con foreign keys apagadas: reconstruir una tabla (DROP + RENAME)
  // con FKs activas dispararía borrados en cascada. Este PRAGMA no surte efecto dentro de
  // una transacción, por eso se cambia antes y después de migrar.
  await db.execAsync('PRAGMA foreign_keys = OFF;');
  await runMigrations(db);
  // Las foreign keys vienen apagadas por defecto y se configuran por conexión.
  await db.execAsync('PRAGMA foreign_keys = ON;');
  return db;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/** Devuelve la conexión compartida; la abre y migra solo la primera vez. */
export const getDb = (): Promise<SQLite.SQLiteDatabase> => {
  if (!dbPromise) {
    dbPromise = openAndPrepare().catch((error) => {
      console.error('Error al inicializar la base de datos:', error);
      dbPromise = null; // permitir reintento en la siguiente llamada
      throw error;
    });
  }
  return dbPromise;
};

/** Alias usado en el arranque de la app (App.tsx). */
export const initDatabase = getDb;
