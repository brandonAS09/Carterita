import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import ReceiptOcr, { OcrResult } from '../../modules/receipt-ocr';
import { api } from '../api/client';

/**
 * S7-09 (D44): lectura de tickets y voz.
 * - Build de desarrollo (Android): ML Kit en el teléfono, sin internet.
 * - Expo Go (iPhone): la foto o el audio se mandan al servidor (OCR.space y Groq).
 */

const ANCHO_MAXIMO = 1600; // suficiente para leer un ticket y quedar debajo de 1 MB

/** Reduce la foto para el límite de 1 MB del servicio gratuito. */
const prepararFoto = async (uri: string) => {
  const contexto = ImageManipulator.manipulate(uri);
  const original = await contexto.renderAsync();
  const imagen =
    original.width > ANCHO_MAXIMO ? await ImageManipulator.manipulate(uri).resize({ width: ANCHO_MAXIMO }).renderAsync() : original;
  let resultado = await imagen.saveAsync({ format: SaveFormat.JPEG, compress: 0.7 });
  // Si aún pesa mucho (fotos muy detalladas), se comprime un poco más
  const peso = (await fetch(resultado.uri).then((r) => r.blob())).size;
  if (peso > 950 * 1024) resultado = await imagen.saveAsync({ format: SaveFormat.JPEG, compress: 0.45 });
  return resultado.uri;
};

export const readingService = {
  /** true si el teléfono puede leer tickets por sí solo (build con el módulo nativo). */
  hasNativeOcr: () => ReceiptOcr !== null,

  recognizeReceipt: async (uri: string): Promise<OcrResult> => {
    if (ReceiptOcr) return ReceiptOcr.recognizeText(uri);
    const form = new FormData();
    form.append('foto', { uri: await prepararFoto(uri), name: 'ticket.jpg', type: 'image/jpeg' } as any);
    return api<OcrResult>('/ocr', { method: 'POST', form, timeoutMs: 45_000 });
  },

  /** Audio grabado en el teléfono → texto (Whisper en el servidor). */
  transcribe: async (uri: string): Promise<string> => {
    const extension = uri.split('.').pop()?.toLowerCase() ?? 'm4a';
    const form = new FormData();
    form.append('audio', { uri, name: `voz.${extension}`, type: extension === 'wav' ? 'audio/wav' : 'audio/m4a' } as any);
    return (await api<{ texto: string }>('/voz', { method: 'POST', form, timeoutMs: 45_000 })).texto;
  },
};
