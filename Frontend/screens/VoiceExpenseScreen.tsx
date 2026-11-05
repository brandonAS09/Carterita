import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  Linking,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ChevronLeft,
  Mic,
  Square,
  AlertCircle,
  MicOff,
  Settings,
  PenLine,
  RotateCcw,
  Info,
} from 'lucide-react-native';
import { COLORS, SIZES } from '../src/theme/theme';
import { authService } from '../src/services/authService';
import { budgetService, Presupuesto } from '../src/services/budgetService';
import { transactionService, Categoria } from '../src/services/transactionService';
import { voiceRecognitionService, RecognitionConfig } from '../src/services/voiceRecognitionService';
import { parseVoiceExpense, ParsedVoiceExpense } from '../src/utils/voiceExpenseParser';
import ExpenseReviewForm, { ExpenseReviewValues } from '../src/components/ExpenseReviewForm';

/**
 * F03 - Registro de Gasto por Voz.
 * Flujo: idle → listening → (no-amount) → review → guardar.
 */
type Phase =
  | 'checking'
  | 'needs-dev-build'
  | 'unavailable'
  | 'permission-denied'
  | 'idle'
  | 'listening'
  | 'no-amount'
  | 'review';

const MSG_NO_SPEECH = 'No te escuchamos. Toca el micrófono e intenta de nuevo.';
const MSG_NO_AMOUNT =
  "No detectamos el monto del gasto. Por favor ingresa la cantidad manualmente o intenta dictar de nuevo (Ej. 'Compré un café de 45 pesos').";
const ONLINE_NOTICE_KEY = 'carterita.voiceOnlineNoticeShown';

const EXAMPLES = ['Gasté 85 pesos en gasolina', 'Un café de 45', 'Uber al trabajo por 120'];

export default function VoiceExpenseScreen({ navigation }: any) {
  const [phase, setPhase] = useState<Phase>('checking');
  const [userId, setUserId] = useState<number | null>(null);
  const [budget, setBudget] = useState<Presupuesto | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);

  // Dictado
  const [partial, setPartial] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [showOnlineNotice, setShowOnlineNotice] = useState(false);
  const [parsed, setParsed] = useState<ParsedVoiceExpense | null>(null);

  // Refs para los listeners nativos (se registran una sola vez)
  const transcriptRef = useRef('');
  const errorHandledRef = useRef(false);
  const configRef = useRef<RecognitionConfig | null>(null);
  const phaseRef = useRef<Phase>('checking');
  phaseRef.current = phase;

  // ─────────────────────────────────────────────
  // Carga inicial
  // ─────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const availability = voiceRecognitionService.getAvailability();
      if (availability !== 'available') {
        setPhase(availability === 'needs-dev-build' ? 'needs-dev-build' : 'unavailable');
        return;
      }
      try {
        const session = await authService.getActiveSession();
        if (!session) {
          navigation.replace('Login');
          return;
        }
        setUserId(session.id);
        const [b, cats] = await Promise.all([
          budgetService.getBudgetByUserId(session.id),
          transactionService.getAllCategories(),
        ]);
        setBudget(b);
        setCategorias(cats);
        setPhase('idle');
      } catch {
        setNotice('No se pudieron cargar tus datos. Intenta de nuevo.');
        setPhase('idle');
      }
    };
    init();
    // Escenario 8: al salir de la pantalla se cancela cualquier grabación
    return () => voiceRecognitionService.abort();
  }, [navigation]);

  // ─────────────────────────────────────────────
  // Procesamiento del dictado
  // ─────────────────────────────────────────────
  const processTranscript = useCallback(
    (transcript: string) => {
      const result = parseVoiceExpense(transcript, budget?.moneda ?? 'MXN');
      setParsed(result);
      setPhase(result.monto === null ? 'no-amount' : 'review');
    },
    [budget]
  );

  const handleError = (code: string) => {
    if (code === 'aborted') return;
    // Con transcripción parcial, el evento "end" procesará lo que se alcanzó a escuchar
    if ((code === 'no-speech' || code === 'speech-timeout') && transcriptRef.current.trim()) return;

    errorHandledRef.current = true;
    switch (code) {
      case 'not-allowed':
        setPhase('permission-denied');
        return;
      case 'no-speech':
      case 'speech-timeout':
        setNotice(MSG_NO_SPEECH);
        break;
      case 'network':
        setNotice('No hay conexión para el reconocimiento de voz en este dispositivo. Revisa tu internet o registra el gasto manualmente.');
        break;
      case 'language-not-supported':
        if (configRef.current?.onDevice) {
          voiceRecognitionService.disableOnDevice();
          setNotice('Ajustamos el reconocimiento de voz. Toca el micrófono de nuevo.');
        } else {
          setNotice('El español no está disponible en el reconocimiento de voz de este dispositivo.');
        }
        break;
      case 'busy':
        setNotice('El reconocimiento de voz está ocupado. Intenta de nuevo en un momento.');
        break;
      default:
        setNotice('Ocurrió un problema con el reconocimiento de voz. Intenta de nuevo.');
    }
    setPhase('idle');
  };

  const handleEnd = () => {
    const transcript = transcriptRef.current.trim();
    if (transcript) {
      processTranscript(transcript);
      return;
    }
    if (errorHandledRef.current) return; // el error ya definió el estado
    if (phaseRef.current === 'listening') {
      setNotice(MSG_NO_SPEECH); // Escenario 4
      setPhase('idle');
    }
  };

  // Handlers más recientes para los listeners registrados una sola vez
  const handlersRef = useRef({ handleError, handleEnd });
  handlersRef.current = { handleError, handleEnd };

  useEffect(() => {
    const unsubscribe = [
      voiceRecognitionService.on('result', (event) => {
        const text = event.results[0]?.transcript ?? '';
        transcriptRef.current = text;
        setPartial(text);
      }),
      voiceRecognitionService.on('error', (event) => handlersRef.current.handleError(event.error)),
      voiceRecognitionService.on('end', () => handlersRef.current.handleEnd()),
    ];
    return () => unsubscribe.forEach((off) => off());
  }, []);

  // ─────────────────────────────────────────────
  // Acciones de dictado
  // ─────────────────────────────────────────────
  const startListening = async () => {
    setNotice(null);
    setPartial('');
    setParsed(null);
    transcriptRef.current = '';
    errorHandledRef.current = false;

    const config = await voiceRecognitionService.resolveConfig();
    configRef.current = config;

    const permission = await voiceRecognitionService.requestPermissions(config.onDevice);
    if (permission !== 'granted') {
      setPhase('permission-denied'); // Escenario 2
      return;
    }

    // D2: aviso discreto (una sola vez) cuando se usa reconocimiento en línea
    if (!config.onDevice) {
      try {
        if (!(await AsyncStorage.getItem(ONLINE_NOTICE_KEY))) {
          setShowOnlineNotice(true);
          await AsyncStorage.setItem(ONLINE_NOTICE_KEY, '1');
        }
      } catch {
        /* el aviso es opcional */
      }
    }

    setPhase('listening');
    try {
      voiceRecognitionService.start(config);
    } catch {
      setNotice('No se pudo iniciar el micrófono. Intenta de nuevo.');
      setPhase('idle');
    }
  };

  const handleMicPress = () => {
    if (phase === 'listening') {
      voiceRecognitionService.stop(); // finaliza y dispara "end" con lo escuchado
    } else {
      startListening();
    }
  };

  const goBack = () => {
    voiceRecognitionService.abort();
    navigation.goBack();
  };

  const goManual = () => {
    voiceRecognitionService.abort();
    navigation.replace('AddExpense');
  };

  const handleSave = async ({ monto, concepto, categoriaId }: ExpenseReviewValues) => {
    await transactionService.addTransaction(userId!, monto, concepto, categoriaId, 'Voz');
    navigation.goBack(); // el Dashboard se actualiza al recibir foco
  };

  // ─────────────────────────────────────────────
  // Animación del micrófono
  // ─────────────────────────────────────────────
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (phase !== 'listening') {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.out(Easing.ease), useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [phase, pulse]);

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  const renderBlocked = (icon: React.ReactNode, title: string, message: string, actions: React.ReactNode) => (
    <View style={styles.centerBlock}>
      <View style={styles.blockedIcon}>{icon}</View>
      <Text style={styles.blockedTitle}>{title}</Text>
      <Text style={styles.blockedMessage}>{message}</Text>
      <View style={styles.blockedActions}>{actions}</View>
    </View>
  );

  const manualButton = (
    <TouchableOpacity style={styles.secondaryButton} onPress={goManual} activeOpacity={0.8}>
      <PenLine color={COLORS.secondary} size={18} />
      <Text style={styles.secondaryButtonText}>Registrar manualmente</Text>
    </TouchableOpacity>
  );

  const renderContent = () => {
    switch (phase) {
      case 'checking':
        return (
          <View style={styles.centerBlock}>
            <ActivityIndicator size="large" color={COLORS.secondary} />
          </View>
        );

      case 'needs-dev-build':
        return renderBlocked(
          <MicOff color={COLORS.error} size={36} />,
          'Dictado no disponible',
          'El dictado por voz necesita la versión de desarrollo de Carterita. No está disponible en Expo Go.',
          manualButton
        );

      case 'unavailable': // Escenario 7
        return renderBlocked(
          <MicOff color={COLORS.error} size={36} />,
          'Dictado no disponible',
          'Tu dispositivo no tiene reconocimiento de voz disponible.',
          manualButton
        );

      case 'permission-denied': // Escenario 2
        return renderBlocked(
          <MicOff color={COLORS.error} size={36} />,
          'Permiso de micrófono',
          'Se necesita acceso al micrófono para el dictado por voz.',
          <>
            <TouchableOpacity style={styles.primaryButton} onPress={() => Linking.openSettings()} activeOpacity={0.8}>
              <Settings color={COLORS.background} size={18} />
              <Text style={styles.primaryButtonText}>Abrir ajustes</Text>
            </TouchableOpacity>
            {manualButton}
            <TouchableOpacity onPress={startListening} activeOpacity={0.8} style={styles.linkButton}>
              <Text style={styles.linkText}>Ya di el permiso, intentar de nuevo</Text>
            </TouchableOpacity>
          </>
        );

      case 'no-amount': // Escenario 3
        return (
          <View style={styles.centerBlock}>
            {!!parsed?.transcripcion && <Text style={styles.heardText}>"{parsed.transcripcion}"</Text>}
            <View style={styles.warningCard}>
              <AlertCircle color={COLORS.error} size={20} />
              <Text style={styles.warningText}>{MSG_NO_AMOUNT}</Text>
            </View>
            <View style={styles.blockedActions}>
              <TouchableOpacity style={styles.primaryButton} onPress={startListening} activeOpacity={0.8}>
                <RotateCcw color={COLORS.background} size={18} />
                <Text style={styles.primaryButtonText}>Dictar de nuevo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setPhase('review')} activeOpacity={0.8}>
                <Text style={styles.secondaryButtonText}>Continuar</Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case 'review':
        return renderReview();

      default: // idle / listening
        return renderRecorder();
    }
  };

  const renderRecorder = () => {
    const isListening = phase === 'listening';
    return (
      <View style={styles.recorder}>
        <Text style={styles.recorderTitle}>{isListening ? 'Te escucho…' : 'Dicta tu gasto'}</Text>
        <Text style={styles.recorderSubtitle}>
          {isListening ? 'Toca de nuevo para terminar' : 'Toca el micrófono y di el monto y en qué lo gastaste'}
        </Text>

        <View style={styles.micArea}>
          {isListening && (
            <Animated.View style={[styles.micRing, { transform: [{ scale: ringScale }], opacity: ringOpacity }]} />
          )}
          <TouchableOpacity
            style={[styles.micButton, isListening && styles.micButtonActive]}
            onPress={handleMicPress}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={isListening ? 'Detener dictado' : 'Iniciar dictado'}
          >
            {isListening ? (
              <Square color={COLORS.background} size={36} fill={COLORS.background} />
            ) : (
              <Mic color={COLORS.background} size={48} />
            )}
          </TouchableOpacity>
        </View>

        {/* Transcripción en vivo */}
        <View style={styles.transcriptBox}>
          {partial ? (
            <Text style={styles.transcriptText}>{partial}</Text>
          ) : (
            <Text style={styles.transcriptPlaceholder}>
              {isListening ? 'Habla ahora…' : 'Aquí aparecerá lo que digas'}
            </Text>
          )}
        </View>

        {notice && (
          <View style={styles.noticeRow}>
            <AlertCircle color={COLORS.error} size={16} />
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        )}

        {showOnlineNotice && (
          <View style={styles.infoRow}>
            <Info color={COLORS.textSecondary} size={14} />
            <Text style={styles.infoText}>
              Este dispositivo usa el reconocimiento de voz del sistema, que puede requerir internet. Tus gastos se
              siguen guardando solo en tu teléfono.
            </Text>
          </View>
        )}

        {!isListening && (
          <View style={styles.examples}>
            <Text style={styles.examplesTitle}>PRUEBA DICIENDO</Text>
            {EXAMPLES.map((e) => (
              <Text key={e} style={styles.exampleText}>
                "{e}"
              </Text>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderReview = () => (
    <ExpenseReviewForm
      initial={{
        monto: parsed?.monto ?? null,
        moneda: parsed?.moneda ?? budget?.moneda ?? 'MXN',
        concepto: parsed?.concepto ?? '',
        categoria: parsed?.categoria ?? null,
      }}
      budget={budget}
      categorias={categorias}
      userId={userId}
      header={
        !!parsed?.transcripcion && (
          <View style={styles.heardCard}>
            <Text style={styles.heardLabel}>ESCUCHÉ</Text>
            <Text style={styles.heardText}>"{parsed.transcripcion}"</Text>
          </View>
        )
      }
      footer={(isSaving) => (
        <TouchableOpacity
          style={[styles.secondaryButton, { marginTop: SIZES.spacing.sm }]}
          onPress={startListening}
          activeOpacity={0.8}
          disabled={isSaving}
        >
          <RotateCcw color={COLORS.secondary} size={18} />
          <Text style={styles.secondaryButtonText}>Dictar de nuevo</Text>
        </TouchableOpacity>
      )}
      onSave={handleSave}
    />
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.navBar}>
          <TouchableOpacity style={styles.backButton} onPress={goBack} activeOpacity={0.8}>
            <ChevronLeft color={COLORS.text} size={24} />
          </TouchableOpacity>
          <Text style={styles.navTitle}>{phase === 'review' ? 'Confirmar Gasto' : 'Gasto por Voz'}</Text>
          <View style={{ width: 40 }} />
        </View>
        {renderContent()}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  // ── Navbar ──
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.spacing.md,
    paddingVertical: SIZES.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.primary,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: SIZES.radius.button,
    backgroundColor: COLORS.tertiary,
    borderWidth: 1,
    borderColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navTitle: { color: COLORS.text, fontSize: SIZES.body1, fontWeight: '700', letterSpacing: 0.3 },
  // ── Grabadora ──
  recorder: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: SIZES.spacing.lg,
    paddingTop: SIZES.spacing.xl,
  },
  recorderTitle: { color: COLORS.text, fontSize: SIZES.h2, fontWeight: 'bold' },
  recorderSubtitle: {
    color: COLORS.textSecondary,
    fontSize: SIZES.body2,
    marginTop: SIZES.spacing.xs,
    textAlign: 'center',
  },
  micArea: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: SIZES.spacing.xl,
  },
  micRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.secondary,
  },
  micButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micButtonActive: { backgroundColor: COLORS.error },
  transcriptBox: {
    alignSelf: 'stretch',
    minHeight: 72,
    backgroundColor: COLORS.tertiary,
    borderRadius: SIZES.radius.card,
    borderWidth: 1,
    borderColor: COLORS.primary,
    padding: SIZES.spacing.md,
    justifyContent: 'center',
  },
  transcriptText: { color: COLORS.text, fontSize: SIZES.body1, textAlign: 'center' },
  transcriptPlaceholder: { color: COLORS.textSecondary, fontSize: SIZES.body2, textAlign: 'center', fontStyle: 'italic' },
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.spacing.xs,
    marginTop: SIZES.spacing.md,
    alignSelf: 'stretch',
  },
  noticeText: { color: COLORS.error, fontSize: SIZES.body2, flex: 1 },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: SIZES.spacing.sm,
    alignSelf: 'stretch',
  },
  infoText: { color: COLORS.textSecondary, fontSize: 12, flex: 1, lineHeight: 16 },
  examples: { marginTop: SIZES.spacing.lg, alignItems: 'center', gap: 4 },
  examplesTitle: {
    color: COLORS.textSecondary,
    fontSize: 11,
    letterSpacing: 1,
    fontWeight: '700',
    marginBottom: 4,
  },
  exampleText: { color: COLORS.textSecondary, fontSize: SIZES.body2, fontStyle: 'italic' },
  // ── Estados bloqueados ──
  centerBlock: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SIZES.spacing.lg,
    gap: SIZES.spacing.sm,
  },
  blockedIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.tertiary,
    borderWidth: 1,
    borderColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  blockedTitle: { color: COLORS.text, fontSize: SIZES.h2 - 4, fontWeight: 'bold', textAlign: 'center' },
  blockedMessage: { color: COLORS.textSecondary, fontSize: SIZES.body2, textAlign: 'center', lineHeight: 20 },
  blockedActions: { alignSelf: 'stretch', gap: SIZES.spacing.sm, marginTop: SIZES.spacing.md },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SIZES.spacing.xs,
    backgroundColor: 'rgba(207, 102, 121, 0.15)',
    borderWidth: 1,
    borderColor: COLORS.error,
    borderRadius: SIZES.radius.button,
    padding: SIZES.spacing.sm,
  },
  warningText: { color: COLORS.error, fontSize: SIZES.body2, flex: 1, lineHeight: 20 },
  // ── Botones ──
  primaryButton: {
    flexDirection: 'row',
    gap: SIZES.spacing.xs,
    backgroundColor: COLORS.secondary,
    borderRadius: SIZES.radius.button,
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: { color: COLORS.background, fontSize: SIZES.body1, fontWeight: 'bold' },
  secondaryButton: {
    flexDirection: 'row',
    gap: SIZES.spacing.xs,
    borderWidth: 2,
    borderColor: COLORS.secondary,
    borderRadius: SIZES.radius.button,
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: { color: COLORS.secondary, fontSize: SIZES.body1, fontWeight: '600' },
  linkButton: { alignItems: 'center', paddingVertical: SIZES.spacing.xs },
  linkText: { color: COLORS.textSecondary, fontSize: SIZES.body2, textDecorationLine: 'underline' },
  // ── Vista previa ──
  heardCard: {
    backgroundColor: 'rgba(19, 92, 58, 0.25)',
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: SIZES.radius.card,
    padding: SIZES.spacing.md,
    marginBottom: SIZES.spacing.md,
  },
  heardLabel: { color: COLORS.textSecondary, fontSize: 11, letterSpacing: 1, fontWeight: '700', marginBottom: 4 },
  heardText: { color: COLORS.text, fontSize: SIZES.body1, fontStyle: 'italic', textAlign: 'center' },
});
