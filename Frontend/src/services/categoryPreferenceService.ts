import { getDb } from '../database/initDb';
import { normalizeConceptKey, pickSuggestedCategory } from '../utils/categoryLearning';

/** F09: recuerda, por usuario, la categoría que eligió para cada concepto. */
export const categoryPreferenceService = {
  /** La elección más reciente reemplaza a la anterior. Un gasto sin categoría no enseña nada. */
  remember: async (userId: number, concepto: string, categoriaId: number | null): Promise<void> => {
    const clave = normalizeConceptKey(concepto);
    if (!clave || categoriaId === null) return;
    const db = await getDb();
    await db.runAsync(
      `INSERT INTO PreferenciaCategoria (usuario_id, clave, categoria_id, usos, actualizado_en)
       VALUES (?, ?, ?, 1, ?)
       ON CONFLICT (usuario_id, clave) DO UPDATE SET
         categoria_id = excluded.categoria_id,
         usos = usos + 1,
         actualizado_en = excluded.actualizado_en`,
      [userId, clave, categoriaId, new Date().toISOString()]
    );
  },

  /** Nombre de la categoría aprendida para un concepto, o null si aún no hay ninguna. */
  findLearned: async (userId: number, concepto: string): Promise<string | null> => {
    const clave = normalizeConceptKey(concepto);
    if (!clave) return null;
    const db = await getDb();
    const row = await db.getFirstAsync<{ nombre: string }>(
      `SELECT c.nombre AS nombre
       FROM PreferenciaCategoria p
       JOIN Categoria c ON c.id = p.categoria_id
       WHERE p.usuario_id = ? AND p.clave = ?`,
      [userId, clave]
    );
    return row?.nombre ?? null;
  },

  /** Sugerencia final. Si la consulta falla, se usa el diccionario: aprender nunca bloquea el registro. */
  suggest: async (userId: number, concepto: string, dictionary: string | null): Promise<string | null> => {
    try {
      return pickSuggestedCategory(await categoryPreferenceService.findLearned(userId, concepto), dictionary);
    } catch (error) {
      console.error('Error al consultar la categoría aprendida:', error);
      return dictionary;
    }
  },
};
