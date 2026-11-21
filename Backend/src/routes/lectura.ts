import { Router } from 'express';
import multer from 'multer';
import { config } from '../config.js';
import { usuarioDe } from '../http/auth.js';
import { ApiError } from '../http/errors.js';
import { crearLimite } from '../http/limiteIntentos.js';

/**
 * S7-09 (D44, D45): en Expo Go no existen ML Kit ni el reconocimiento de voz nativo,
 * así que el iPhone manda la foto o el audio y el servidor los procesa.
 * Las llaves de OCR.space y Groq solo viven aquí, nunca en la app.
 */

const MAX_FOTO = 1024 * 1024; // límite del plan gratuito de OCR.space
const MAX_AUDIO = 5 * 1024 * 1024;
const TIEMPO_SERVICIO_MS = 30_000;

const subirFoto = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FOTO, files: 1 } });
const subirAudio = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_AUDIO, files: 1 } });

// Cuidar las cuotas gratuitas: 30 lecturas por hora por usuario (R28)
const limite = crearLimite(30, 60 * 60 * 1000, 'Llegaste al límite de lecturas por hora. Registra el gasto a mano o inténtalo más tarde.');

const servicioCaido = (que: string) =>
  new ApiError(502, 'SERVICIO_EXTERNO', `No pudimos ${que} en este momento. Puedes registrar el gasto a mano.`);

/** Convierte errores de multer (archivo grande, campo inesperado) en errores claros. */
const conArchivo =
  (subida: multer.Multer, campo: string, tipo: 'foto' | 'audio'): import('express').RequestHandler =>
  (req, res, next) =>
    subida.single(campo)(req, res, (error: unknown) => {
      if (!error) return next();
      if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        return next(new ApiError(413, 'MUY_GRANDE', tipo === 'foto' ? 'La foto pesa más de 1 MB.' : 'El audio es demasiado largo.'));
      }
      next(new ApiError(400, 'VALIDACION', `No recibimos ${tipo === 'foto' ? 'la foto' : 'el audio'}.`));
    });

interface OcrSpaceWord {
  WordText: string;
  Left: number;
  Top: number;
  Width: number;
  Height: number;
}

interface OcrSpaceRespuesta {
  IsErroredOnProcessing?: boolean;
  ErrorMessage?: string | string[];
  ParsedResults?: { TextOverlay?: { Lines?: { LineText: string; Words: OcrSpaceWord[] }[] } }[];
}

/** Mismo formato que el módulo nativo (OcrLine): texto y caja de cada renglón. */
export const lineasDeOcrSpace = (datos: OcrSpaceRespuesta) =>
  (datos.ParsedResults ?? []).flatMap((pagina) =>
    (pagina.TextOverlay?.Lines ?? [])
      .filter((linea) => linea.Words?.length)
      .map((linea) => {
        const left = Math.min(...linea.Words.map((w) => w.Left));
        const top = Math.min(...linea.Words.map((w) => w.Top));
        const right = Math.max(...linea.Words.map((w) => w.Left + w.Width));
        const bottom = Math.max(...linea.Words.map((w) => w.Top + w.Height));
        return {
          text: linea.LineText ?? linea.Words.map((w) => w.WordText).join(' '),
          frame: { left, top, width: right - left, height: bottom - top },
        };
      })
  );

export const lecturaRouter = Router();

lecturaRouter.post('/ocr', conArchivo(subirFoto, 'foto', 'foto'), async (req, res) => {
  const usuarioId = usuarioDe(req);
  if (!req.file) throw new ApiError(400, 'VALIDACION', 'No recibimos la foto.');
  if (!/^image\/(jpe?g|png)$/.test(req.file.mimetype)) throw new ApiError(400, 'VALIDACION', 'La foto debe ser JPG o PNG.');
  if (!config.ocrSpaceApiKey) throw servicioCaido('leer el ticket');
  limite.revisar(`ocr|${usuarioId}`);
  limite.registrar(`ocr|${usuarioId}`);

  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(req.file.buffer)], { type: req.file.mimetype }), 'ticket.jpg');
  form.append('language', 'spa');
  form.append('OCREngine', '2');
  form.append('isOverlayRequired', 'true');
  form.append('scale', 'true');
  form.append('detectOrientation', 'true');

  let datos: OcrSpaceRespuesta;
  try {
    const respuesta = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: { apikey: config.ocrSpaceApiKey },
      body: form,
      signal: AbortSignal.timeout(TIEMPO_SERVICIO_MS),
    });
    datos = (await respuesta.json()) as OcrSpaceRespuesta;
  } catch (error) {
    console.error('OCR.space no respondió:', error);
    throw servicioCaido('leer el ticket');
  }
  if (datos.IsErroredOnProcessing) {
    console.error('OCR.space devolvió un error:', datos.ErrorMessage);
    throw servicioCaido('leer el ticket');
  }
  res.json({ lines: lineasDeOcrSpace(datos) });
});

// Vocabulario de gastos: ayuda a Whisper con montos y comercios comunes
const PISTA_VOZ = 'Registro de gastos en pesos mexicanos. Gasté 85 pesos en tacos. Pagué 120 en el Oxxo. Uber, gasolina, súper, Netflix.';

lecturaRouter.post('/voz', conArchivo(subirAudio, 'audio', 'audio'), async (req, res) => {
  const usuarioId = usuarioDe(req);
  if (!req.file) throw new ApiError(400, 'VALIDACION', 'No recibimos el audio.');
  if (!config.groqApiKey) throw servicioCaido('entender el audio');
  limite.revisar(`voz|${usuarioId}`);
  limite.registrar(`voz|${usuarioId}`);

  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(req.file.buffer)], { type: req.file.mimetype || 'audio/m4a' }), req.file.originalname || 'voz.m4a');
  form.append('model', 'whisper-large-v3-turbo');
  form.append('language', 'es');
  form.append('prompt', PISTA_VOZ);
  form.append('response_format', 'json');
  form.append('temperature', '0');

  try {
    const respuesta = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.groqApiKey}` },
      body: form,
      signal: AbortSignal.timeout(TIEMPO_SERVICIO_MS),
    });
    const datos = (await respuesta.json()) as { text?: string; error?: { message?: string } };
    if (!respuesta.ok) {
      console.error('Groq devolvió un error:', respuesta.status, datos.error?.message);
      throw servicioCaido('entender el audio');
    }
    res.json({ texto: (datos.text ?? '').trim() });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error('Groq no respondió:', error);
    throw servicioCaido('entender el audio');
  }
});
