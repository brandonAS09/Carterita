import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Mic, Square, MicOff, Settings, PenLine, RotateCcw, Info } from 'lucide-react-native';
import { useTheme, useThemedStyles } from '../src/theme/ThemeProvider';
import { RADIUS, SPACING, ThemeColors, TYPOGRAPHY } from '../src/theme/theme';
import { authService } from '../src/services/authService';
import { budgetService, Presupuesto } from '../src/services/budgetService';
import { transactionService, Categoria } from '../src/services/transactionService';
import { voiceRecognitionService, RecognitionConfig } from '../src/services/voiceRecognitionService';
import { parseVoiceExpense, ParsedVoiceExpense } from '../src/utils/voiceExpenseParser';
import { useReducedMotion } from '../src/utils/useReducedMotion';
import ExpenseReviewForm, { ExpenseReviewValues } from '../src/components/ExpenseReviewForm';
import HeroHeader from '../src/components/ui/HeroHeader';
import Button from '../src/components/ui/Button';
import { Banner } from '../src/components/ui/Form';

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
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const reduceMotion = useReducedMotion();
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
    if (phase !== 'listening' || reduceMotion) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.out(Easing.ease), useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [phase, pulse, reduceMotion]);

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  const renderBlocked = (title: string, message: string, actions: React.ReactNode) => (
    <View style={styles.centerBlock}>
      <View style={styles.blockedIcon}>
        <MicOff color={colors.error} size={36} />
      </View>
      <Text style={styles.blockedTitle}>{title}</Text>
      <Text style={styles.blockedMessage}>{message}</Text>
      <View style={styles.blockedActions}>{actions}</View>
    </View>
  );

  const manualButton = <Button label="Registrar manualmente" variant="secondary" icon={PenLine} onPress={goManual} />;

  const renderContent = () => {
    switch (phase) {
      case 'checking':
        return (
          <View style={styles.centerBlock}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        );

      case 'needs-dev-build':
        return renderBlocked(
          'Dictado no disponible',
          'El dictado por voz necesita la versión de desarrollo de Carterita. No está disponible en Expo Go.',
          manualButton
        );

      case 'unavailable': // Escenario 7
        return renderBlocked('Dictado no disponible', 'Tu dispositivo no tiene reconocimiento de voz disponible.', manualButton);

      case 'permission-denied': // Escenario 2
        return renderBlocked(
          'Permiso de micrófono',
          'Se necesita acceso al micrófono para el dictado por voz.',
          <>
            <Button label="Abrir ajustes" icon={Settings} onPress={() => Linking.openSettings()} />
            {manualButton}
            <Button label="Ya di el permiso, intentar de nuevo" variant="text" onPress={startListening} />
          </>
        );

      case 'no-amount': // Escenario 3
        return (
          <View style={styles.centerBlock}>
            {!!parsed?.transcripcion && <Text style={styles.heardText}>"{parsed.transcripcion}"</Text>}
            <Banner tone="error" message={MSG_NO_AMOUNT} />
            <View style={styles.blockedActions}>
              <Button label="Dictar de nuevo" icon={RotateCcw} onPress={startListening} />
              <Button label="Continuar" variant="secondary" onPress={() => setPhase('review')} />
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
          <Pressable
            style={[styles.micButton, isListening && styles.micButtonActive]}
            onPress={handleMicPress}
            accessibilityRole="button"
            accessibilityLabel={isListening ? 'Detener dictado' : 'Iniciar dictado'}
          >
            {isListening ? (
              <Square color={colors.onPrimary} size={36} fill={colors.onPrimary} />
            ) : (
              <Mic color={colors.onAccent} size={48} />
            )}
          </Pressable>
        </View>

        {/* Transcripción en vivo */}
        <View style={styles.transcriptBox}>
          {partial ? (
            <Text style={styles.transcriptText} accessibilityLiveRegion="polite">
              {partial}
            </Text>
          ) : (
            <Text style={styles.transcriptPlaceholder}>
              {isListening ? 'Habla ahora…' : 'Aquí aparecerá lo que digas'}
            </Text>
          )}
        </View>

        {notice && <Banner tone="error" message={notice} style={styles.notice} />}

        {showOnlineNotice && (
          <View style={styles.infoRow}>
            <Info color={colors.textSecondary} size={14} />
            <Text style={styles.infoText}>
              Este dispositivo usa el reconocimiento de voz del sistema, que puede requerir internet. Tus gastos se
              siguen guardando solo en tu teléfono.
            </Text>
          </View>
        )}

        {!isListening && (
          <View style={styles.examples}>
            <Text style={styles.examplesTitle}>Prueba diciendo</Text>
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
            <Text style={styles.heardLabel}>Escuché</Text>
            <Text style={styles.heardText}>"{parsed.transcripcion}"</Text>
          </View>
        )
      }
      footer={(isSaving) => (
        <Button
          label="Dictar de nuevo"
          variant="secondary"
          icon={RotateCcw}
          onPress={startListening}
          disabled={isSaving}
          style={styles.footerButton}
        />
      )}
      onSave={handleSave}
    />
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.screen}>
      <HeroHeader title={phase === 'review' ? 'Confirmar Gasto' : 'Gasto por Voz'} onBack={goBack} />
      {renderContent()}
    </KeyboardAvoidingView>
  );
}

const MIC_SIZE = 120;

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    recorder: { flex: 1, alignItems: 'center', paddingHorizontal: SPACING.md },
    recorderTitle: { ...TYPOGRAPHY.h2, color: colors.text },
    recorderSubtitle: { ...TYPOGRAPHY.body2, color: colors.textSecondary, marginTop: 4, textAlign: 'center' },
    micArea: { width: 200, height: 200, justifyContent: 'center', alignItems: 'center', marginVertical: SPACING.sm },
    micRing: {
      position: 'absolute',
      width: MIC_SIZE,
      height: MIC_SIZE,
      borderRadius: MIC_SIZE / 2,
      backgroundColor: colors.primary,
    },
    micButton: {
      width: MIC_SIZE,
      height: MIC_SIZE,
      borderRadius: MIC_SIZE / 2,
      backgroundColor: colors.accent,
      justifyContent: 'center',
      alignItems: 'center',
    },
    micButtonActive: { backgroundColor: colors.primary },
    transcriptBox: {
      alignSelf: 'stretch',
      minHeight: 72,
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      justifyContent: 'center',
    },
    transcriptText: { ...TYPOGRAPHY.body1, color: colors.text, textAlign: 'center' },
    transcriptPlaceholder: { ...TYPOGRAPHY.body2, color: colors.textSecondary, textAlign: 'center' },
    notice: { alignSelf: 'stretch', marginTop: SPACING.sm, marginBottom: 0 },
    infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: SPACING.sm, alignSelf: 'stretch' },
    infoText: { ...TYPOGRAPHY.caption, color: colors.textSecondary, flex: 1 },
    examples: { marginTop: SPACING.md, alignItems: 'center', gap: 4 },
    examplesTitle: { ...TYPOGRAPHY.body2Strong, color: colors.textSecondary },
    exampleText: { ...TYPOGRAPHY.body2, color: colors.textSecondary },
    centerBlock: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: SPACING.md, gap: SPACING.sm },
    blockedIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.surfaceVariant,
      justifyContent: 'center',
      alignItems: 'center',
    },
    blockedTitle: { ...TYPOGRAPHY.h3, color: colors.text, textAlign: 'center' },
    blockedMessage: { ...TYPOGRAPHY.body2, color: colors.textSecondary, textAlign: 'center' },
    blockedActions: { alignSelf: 'stretch', gap: SPACING.sm, marginTop: SPACING.xs },
    footerButton: { marginTop: SPACING.sm },
    heardCard: {
      backgroundColor: colors.surfaceVariant,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      marginBottom: SPACING.sm,
      gap: 4,
    },
    heardLabel: { ...TYPOGRAPHY.caption, color: colors.textSecondary },
    heardText: { ...TYPOGRAPHY.body1, color: colors.text, textAlign: 'center' },
  });
