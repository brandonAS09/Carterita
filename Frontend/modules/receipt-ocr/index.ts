import { requireOptionalNativeModule } from 'expo';

/** Línea de texto reconocida, con su posición en píxeles dentro de la imagen. */
export interface OcrLine {
  text: string;
  frame: { left: number; top: number; width: number; height: number };
}

export interface OcrResult {
  lines: OcrLine[];
}

interface ReceiptOcrNativeModule {
  recognizeText(uri: string): Promise<OcrResult>;
}

/** null en Expo Go o en un build que no incluye el módulo. */
export default requireOptionalNativeModule<ReceiptOcrNativeModule>('ReceiptOcr');
