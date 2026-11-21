import { api } from '../api/client';
import { normalizeConceptKey, pickSuggestedCategory } from '../utils/categoryLearning';

/** F09: el servidor recuerda la categoría al guardar o editar un gasto; aquí solo se consulta. */
export const categoryPreferenceService = {
  findLearned: async (_userId: number, concepto: string): Promise<string | null> => {
    if (!normalizeConceptKey(concepto)) return null;
    const { nombre } = await api<{ nombre: string | null }>(
      `/categorias/aprendida?concepto=${encodeURIComponent(concepto)}`
    );
    return nombre;
  },

  /** Si la consulta falla (p. ej. sin red), se usa el diccionario: sugerir nunca bloquea el registro. */
  suggest: async (userId: number, concepto: string, dictionary: string | null): Promise<string | null> => {
    try {
      return pickSuggestedCategory(await categoryPreferenceService.findLearned(userId, concepto), dictionary);
    } catch {
      return dictionary;
    }
  },
};
