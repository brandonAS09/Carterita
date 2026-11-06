import { beforeAll, describe, expect, jest, test } from '@jest/globals';
import { addDaysToKey, toLocalDateKey } from '../../utils/dateUtils';

/**
 * Integración con SQLite real (node:sqlite): corre todas las migraciones y comprueba que editar,
 * borrar y aprender dejen el presupuesto coherente (R11).
 */
jest.mock('expo-sqlite', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DatabaseSync } = require('node:sqlite');
  return {
    openDatabaseAsync: async () => {
      const raw = new DatabaseSync(':memory:');
      const db = {
        execAsync: async (sql: string) => raw.exec(sql),
        getAllAsync: async (sql: string, params: unknown[] = []) => raw.prepare(sql).all(...params),
        getFirstAsync: async (sql: string, params: unknown[] = []) => raw.prepare(sql).get(...params) ?? null,
        runAsync: async (sql: string, params: unknown[] = []) => {
          const result = raw.prepare(sql).run(...params);
          return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) };
        },
        withTransactionAsync: async (task: () => Promise<void>) => {
          raw.exec('BEGIN');
          try {
            await task();
            raw.exec('COMMIT');
          } catch (error) {
            raw.exec('ROLLBACK');
            throw error;
          }
        },
      };
      return db;
    },
  };
});
jest.mock('expo-crypto', () => ({
  digestStringAsync: async (_algorithm: string, text: string) => `hash-${text}`,
  getRandomBytesAsync: async () => new Uint8Array(16),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: {} }));

/* eslint-disable @typescript-eslint/no-require-imports */
const { getDb } = require('../../database/initDb');
const { transactionService } = require('../transactionService');
const { categoryPreferenceService } = require('../categoryPreferenceService');
const { smartBudgetService } = require('../smartBudgetService');
const { budgetService } = require('../budgetService');
const { goalService } = require('../goalService');
/* eslint-enable @typescript-eslint/no-require-imports */

const HOY = toLocalDateKey();
const AYER = addDaysToKey(HOY, -1);
const USER = 1;
const OTHER_USER = 2;
let comidaId: number;
let serviciosId: number;

beforeAll(async () => {
  const db = await getDb();
  await db.runAsync("INSERT INTO Usuario (id, nombre, email, password_hash) VALUES (1, 'Ana', 'a@a.com', 'x')");
  await db.runAsync("INSERT INTO Usuario (id, nombre, email, password_hash) VALUES (2, 'Beto', 'b@b.com', 'x')");
  await budgetService.createBudget(USER, 700, 'Semanal', 'MXN');
  // El ciclo empieza 3 días antes para poder probar gastos de días anteriores
  await db.runAsync('UPDATE Presupuesto SET fecha_inicio = ?, fecha_fin = ? WHERE usuario_id = ?', [
    addDaysToKey(HOY, -3),
    addDaysToKey(HOY, 3),
    USER,
  ]);
  const cats = await transactionService.getAllCategories();
  comidaId = cats.find((c: { nombre: string }) => c.nombre === 'Comida').id;
  serviciosId = cats.find((c: { nombre: string }) => c.nombre === 'Servicios').id;
});

describe('migraciones', () => {
  test('llegan a la versión 6 y crean la tabla de preferencias', async () => {
    const db = await getDb();
    expect((await db.getFirstAsync('PRAGMA user_version')).user_version).toBe(6);
    expect(await db.getAllAsync('PRAGMA table_info(PreferenciaCategoria)')).toHaveLength(5);
  });
});

describe('editar y borrar', () => {
  test('Escenario 1: corregir un monto de hoy cambia el disponible', async () => {
    const before = await smartBudgetService.getTodaySummary(USER);
    const tx = await transactionService.addTransaction(USER, 100, 'Tacos', comidaId);
    expect((await smartBudgetService.getTodaySummary(USER)).disponibleHoy).toBe(before.disponibleHoy - 100);

    await transactionService.updateTransaction(USER, tx.id, { monto: 50, concepto: 'Tacos', categoriaId: comidaId });
    expect((await smartBudgetService.getTodaySummary(USER)).disponibleHoy).toBe(before.disponibleHoy - 50);
    await transactionService.deleteTransaction(USER, tx.id);
  });

  test('Escenario 3: mover un gasto a ayer deja de contar hoy, pero sigue en el ciclo', async () => {
    const tx = await transactionService.addTransaction(USER, 70, 'Café', comidaId);
    const before = await smartBudgetService.getTodaySummary(USER);
    expect(before.gastadoHoy).toBe(70);

    await transactionService.updateTransaction(USER, tx.id, { monto: 70, concepto: 'Café', categoriaId: comidaId, fechaKey: AYER });
    const after = await smartBudgetService.getTodaySummary(USER);
    expect(after.gastadoHoy).toBe(0);
    expect(after.saldoRestanteCiclo).toBe(before.saldoRestanteCiclo);

    const edited = await transactionService.getTransactionById(USER, tx.id);
    expect(toLocalDateKey(new Date(edited.fecha))).toBe(AYER);
    await transactionService.deleteTransaction(USER, tx.id);
  });

  test('sin cambiar la fecha se conservan la hora y el origen', async () => {
    const tx = await transactionService.addTransaction(USER, 30, 'Pan', comidaId, 'Voz');
    await transactionService.updateTransaction(USER, tx.id, { monto: 35, concepto: 'Pan dulce', categoriaId: null });
    const edited = await transactionService.getTransactionById(USER, tx.id);
    expect(edited).toMatchObject({ fecha: tx.fecha, origen_registro: 'Voz', monto: 35, concepto: 'Pan dulce', categoria_id: null });
    await transactionService.deleteTransaction(USER, tx.id);
  });

  test('un gasto de un ciclo anterior no afecta el presupuesto actual', async () => {
    const before = await smartBudgetService.getTodaySummary(USER);
    const tx = await transactionService.addTransaction(USER, 40, 'Viejo', comidaId, 'Manual', addDaysToKey(HOY, -30));
    await transactionService.updateTransaction(USER, tx.id, { monto: 400, concepto: 'Viejo', categoriaId: comidaId });
    expect((await smartBudgetService.getTodaySummary(USER)).saldoRestanteCiclo).toBe(before.saldoRestanteCiclo);
    await transactionService.deleteTransaction(USER, tx.id);
  });

  test('Escenario 4: borrar devuelve el dinero y quita el gasto', async () => {
    const before = await smartBudgetService.getTodaySummary(USER);
    const tx = await transactionService.addTransaction(USER, 25, 'Refresco', comidaId);
    await transactionService.deleteTransaction(USER, tx.id);
    expect((await smartBudgetService.getTodaySummary(USER)).saldoRestanteCiclo).toBe(before.saldoRestanteCiclo);
    expect(await transactionService.getTransactionById(USER, tx.id)).toBeNull();
  });

  test('un usuario no puede editar ni borrar gastos de otro', async () => {
    const tx = await transactionService.addTransaction(USER, 10, 'Mío', comidaId);
    await transactionService.updateTransaction(OTHER_USER, tx.id, { monto: 999, concepto: 'Ajeno', categoriaId: null });
    await transactionService.deleteTransaction(OTHER_USER, tx.id);
    expect(await transactionService.getTransactionById(USER, tx.id)).toMatchObject({ monto: 10, concepto: 'Mío' });
    expect(await transactionService.getTransactionById(OTHER_USER, tx.id)).toBeNull();
    await transactionService.deleteTransaction(USER, tx.id);
  });

  test('Escenario 5: con el excedente ya movido, el aporte no cambia', async () => {
    const tx = await transactionService.addTransaction(USER, 10, 'Ayer', comidaId, 'Manual', AYER);
    const surplus = await goalService.getYesterdaySurplus(USER);
    expect(surplus.monto).toBeGreaterThan(0);

    const meta = await goalService.createGoal(USER, { nombre: 'Viaje', montoObjetivo: 5000, icono: 'plane', fechaLimite: null });
    const outcome = await goalService.addContribution(USER, meta.id, surplus.monto, 'Excedente', surplus.fecha);
    const before = await smartBudgetService.getTodaySummary(USER);

    await transactionService.updateTransaction(USER, tx.id, { monto: 60, concepto: 'Ayer', categoriaId: comidaId });

    const goals = await goalService.getGoals(USER);
    expect(goals.find((g: { id: number }) => g.id === meta.id).monto_acumulado).toBe(outcome.aportado);
    expect((await smartBudgetService.getTodaySummary(USER)).saldoRestanteCiclo).toBe(before.saldoRestanteCiclo - 50);

    await goalService.deleteGoal(USER, meta.id);
    await transactionService.deleteTransaction(USER, tx.id);
  });
});

describe('categorías que aprenden', () => {
  test('Escenario 7: guardar enseña, por concepto normalizado', async () => {
    const tx = await transactionService.addTransaction(USER, 80, 'Abarrotes Lupita', comidaId, 'OCR');
    expect(await categoryPreferenceService.findLearned(USER, 'abarrotes  LUPITA.')).toBe('Comida');
    await transactionService.deleteTransaction(USER, tx.id);
  });

  test('Escenario 8: gana al diccionario y es propio de cada usuario', async () => {
    const tx = await transactionService.addTransaction(USER, 20, 'Agua', comidaId);
    expect(await categoryPreferenceService.suggest(USER, 'Agua', 'Servicios')).toBe('Comida');
    expect(await categoryPreferenceService.suggest(OTHER_USER, 'Agua', 'Servicios')).toBe('Servicios');
    await transactionService.deleteTransaction(USER, tx.id);
  });

  test('editar enseña y la elección más reciente reemplaza a la anterior', async () => {
    const tx = await transactionService.addTransaction(USER, 20, 'Recibo', comidaId);
    await transactionService.updateTransaction(USER, tx.id, { monto: 20, concepto: 'Recibo', categoriaId: serviciosId });
    expect(await categoryPreferenceService.findLearned(USER, 'Recibo')).toBe('Servicios');
    await transactionService.deleteTransaction(USER, tx.id);
  });

  test('un gasto sin categoría no enseña ni borra lo aprendido', async () => {
    const first = await transactionService.addTransaction(USER, 20, 'Nieve', comidaId);
    const second = await transactionService.addTransaction(USER, 20, 'Nieve', null);
    expect(await categoryPreferenceService.findLearned(USER, 'Nieve')).toBe('Comida');
    await transactionService.addTransaction(USER, 20, 'Sin aprender', null);
    expect(await categoryPreferenceService.findLearned(USER, 'Sin aprender')).toBeNull();
    await transactionService.deleteTransaction(USER, first.id);
    await transactionService.deleteTransaction(USER, second.id);
  });
});

describe('reportes', () => {
  test('consulta solo los gastos del usuario dentro del período', async () => {
    const inside = await transactionService.addTransaction(USER, 15, 'Dentro', comidaId);
    const outside = await transactionService.addTransaction(USER, 15, 'Fuera', comidaId, 'Manual', addDaysToKey(HOY, -60));
    const rows = await transactionService.getTransactionsBetween(USER, addDaysToKey(HOY, -7), HOY);
    expect(rows.some((r: { id: number }) => r.id === inside.id)).toBe(true);
    expect(rows.some((r: { id: number }) => r.id === outside.id)).toBe(false);
    expect(await transactionService.getTransactionsBetween(OTHER_USER, addDaysToKey(HOY, -7), HOY)).toEqual([]);
    await transactionService.deleteTransaction(USER, inside.id);
    await transactionService.deleteTransaction(USER, outside.id);
  });
});
