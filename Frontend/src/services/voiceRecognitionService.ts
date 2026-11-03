import { VOICE_CONTEXTUAL_STRINGS } from '../utils/voiceExpenseParser';

/**
 * F03 - Capa delgada sobre `expo-speech-recognition`.
 *
 * El módulo nativo NO existe en Expo Go: importarlo de forma estática tumbaría toda la app.
 * Por eso se carga con `require` protegido y cada función tolera que no esté disponible.
 */

type SpeechLib = typeof import('expo-speech-recognition');
type SpeechModule = SpeechLib['ExpoSpeechRecognitionModule'];
type EventMap = import('expo-speech-recognition').ExpoSpeechRecognitionNativeEventMap;

let speechModule: SpeechModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  speechModule = (require('expo-speech-recognition') as SpeechLib).ExpoSpeechRecognitionModule;
} catch {
  speechModule = null; // Expo Go o build sin el módulo nativo
}

export type VoiceAvailability = 'available' | 'unavailable' | 'needs-dev-build';
export type VoicePermission = 'granted' | 'denied';

export interface RecognitionConfig {
  lang: string;
  onDevice: boolean; // D2: reconocimiento sin internet cuando el dispositivo lo soporta
}

const DEFAULT_LANG = 'es-MX';
let cachedConfig: RecognitionConfig | null = null;

export const voiceRecognitionService = {
  getAvailability: (): VoiceAvailability => {
    if (!speechModule) return 'needs-dev-build';
    try {
      return speechModule.isRecognitionAvailable() ? 'available' : 'unavailable';
    } catch {
      return 'unavailable';
    }
  },

  /**
   * D2: usa reconocimiento en el dispositivo solo si hay un modelo de español instalado;
   * si no, el reconocedor del sistema (puede usar internet). Se calcula una vez por sesión.
   */
  resolveConfig: async (): Promise<RecognitionConfig> => {
    if (cachedConfig) return cachedConfig;
    let config: RecognitionConfig = { lang: DEFAULT_LANG, onDevice: false };
    try {
      if (speechModule?.supportsOnDeviceRecognition()) {
        const { installedLocales } = await speechModule.getSupportedLocales({});
        const normalized = installedLocales.map((l) => l.replace('_', '-'));
        const spanish =
          normalized.find((l) => l.toLowerCase() === 'es-mx') ??
          normalized.find((l) => l.toLowerCase().startsWith('es'));
        if (spanish) config = { lang: spanish, onDevice: true };
      }
    } catch {
      // Sin información de modelos instalados → reconocimiento del sistema
    }
    cachedConfig = config;
    return config;
  },

  /** Si el reconocimiento en el dispositivo falla, se desactiva para el resto de la sesión. */
  disableOnDevice: () => {
    cachedConfig = { lang: DEFAULT_LANG, onDevice: false };
  },

  requestPermissions: async (onDevice: boolean): Promise<VoicePermission> => {
    if (!speechModule) return 'denied';
    try {
      // En el dispositivo basta el micrófono; en línea, iOS pide además el permiso de reconocimiento
      const result = onDevice
        ? await speechModule.requestMicrophonePermissionsAsync()
        : await speechModule.requestPermissionsAsync();
      return result.granted ? 'granted' : 'denied';
    } catch {
      return 'denied';
    }
  },

  start: (config: RecognitionConfig) => {
    speechModule?.start({
      lang: config.lang,
      interimResults: true,
      continuous: false, // se detiene solo al detectar silencio
      maxAlternatives: 1,
      requiresOnDeviceRecognition: config.onDevice,
      addsPunctuation: false,
      contextualStrings: VOICE_CONTEXTUAL_STRINGS,
    });
  },

  stop: () => {
    try {
      speechModule?.stop();
    } catch {
      /* no estaba escuchando */
    }
  },

  abort: () => {
    try {
      speechModule?.abort();
    } catch {
      /* no estaba escuchando */
    }
  },

  /** Suscribe un listener a un evento nativo. Devuelve la función para desuscribirse. */
  on: <K extends keyof EventMap>(event: K, listener: (payload: EventMap[K]) => void): (() => void) => {
    if (!speechModule) return () => {};
    const subscription = speechModule.addListener(event, listener as any);
    return () => subscription.remove();
  },
};
