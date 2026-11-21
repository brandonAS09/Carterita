/**
 * F09 - Categorías que aprenden. Funciones puras: la lectura y escritura están en
 * categoryPreferenceService.
 */

/** Clave de un concepto: "Abarrotes Lupita." y "abarrotes  lupita" son lo mismo (D23: coincidencia exacta). */
export const normalizeConceptKey = (concepto: string): string =>
  concepto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/** Lo aprendido del usuario tiene prioridad sobre el diccionario. */
export const pickSuggestedCategory = (learned: string | null, dictionary: string | null): string | null =>
  learned ?? dictionary;
