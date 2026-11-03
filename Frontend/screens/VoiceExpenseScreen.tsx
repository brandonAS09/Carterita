import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
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
  DollarSign,
  FileText,
  LayoutGrid,
  RefreshCw,
  Info,
} from 'lucide-react-native';
import { COLORS, SIZES } from '../src/theme/theme';
import { authService } from '../src/services/authService';
import { budgetService, Presupuesto } from '../src/services/budgetService';
import { transactionService, Categoria } from '../src/services/transactionService';
import { voiceRecognitionService, RecognitionConfig } from '../src/services/voiceRecognitionService';
import { parseVoiceExpense, ParsedVoiceExpense } from '../src/utils/voiceExpenseParser';
import { convertAmount, formatAmount, getCurrencySymbol, round2 } from '../src/utils/currencyUtils';
import CategoryPicker from '../src/components/CategoryPicker';

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
const MSG_SAVE_ERROR = 'Ocurrió un error al guardar el gasto. Inténtalo de nuevo.';
const ONLINE_NOTICE_KEY = 'carterita.voiceOnlineNoticeShown';

const EXAMPLES = ['Gasté 85 pesos en gasolina', 'Un café de 45', 'Uber al trabajo por 120'];

const parseNumber = (text: string) => parseFloat(text.replace(/,/g, ''));
const toInputText = (n: number) => round2(n).toString();

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

  // Vista previa editable
  const [montoText, setMontoText] = useState('');
  const [montoEdited, setMontoEdited] = useState(false);
  const [concepto, setConcepto] = useState('');
  const [categoria, setCategoria] = useState<Categoria | null>(null);
  const [tasaText, setTasaText] = useState('');
  const [touched, setTouched] = useState({ monto: false, concepto: false, tasa: false });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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
      const monedaPresupuesto = budget?.moneda ?? 'MXN';
      const result = parseVoiceExpense(transcript, monedaPresupuesto);
      setParsed(result);

      setConcepto(result.concepto);
      setCategoria(categorias.find((c) => c.nombre === result.categoria) ?? null);
      setMontoEdited(false);
      setTasaText(budget?.tipo_cambio_usd ? budget.tipo_cambio_usd.toString() : '');
      setTouched({ monto: false, concepto: false, tasa: false });
      setSaveError(null);

      if (result.monto === null) {
        setMontoText('');
      } else if (result.moneda === monedaPresupuesto) {
        setMontoText(toInputText(result.monto));
      } else if (budget?.tipo_cambio_usd) {
        setMontoText(
          toInputText(convertAmount(result.monto, result.moneda, monedaPresupuesto, budget.tipo_cambio_usd))
        );
      } else {
        setMontoText(''); // se calcula cuando el usuario captura la tasa (D1)
      }

      setPhase(result.monto === null ? 'no-amount' : 'review');
    },
    [budget, categorias]
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

  // ─────────────────────────────────────────────
  // Vista previa: moneda (D1) y validaciones
  // ─────────────────────────────────────────────
  const monedaPresupuesto = budget?.moneda ?? 'MXN';
  const isForeign = !!parsed && parsed.monto !== null && parsed.moneda !== monedaPresupuesto;
  const needsRate = isForeign && !budget?.tipo_cambio_usd;
  const parsedTasa = parseNumber(tasaText);
  const isTasaValid = !isNaN(parsedTasa) && isFinite(parsedTasa) && parsedTasa > 0;
  const tasaEfectiva = needsRate ? (isTasaValid ? parsedTasa : null) : budget?.tipo_cambio_usd ?? null;

  // Conversión en vivo mientras el usuario captura la tasa (si no editó el monto a mano)
  useEffect(() => {
    if (phase !== 'review' || !needsRate || montoEdited || !parsed?.monto) return;
    setMontoText(
      isTasaValid ? toInputText(convertAmount(parsed.monto, parsed.moneda, monedaPresupuesto, parsedTasa)) : ''
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasaText, phase, needsRate, montoEdited, parsed]);

  const parsedMonto = parseNumber(montoText);
  const isMontoValid = !isNaN(parsedMonto) && parsedMonto > 0;
  const isConceptoValid = concepto.trim().length >= 2;
  const isFormValid = isMontoValid && isConceptoValid && (!needsRate || isTasaValid) && userId !== null;

  const handleSave = async () => {
    if (!isFormValid || isSaving || !userId) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      if (needsRate) await budgetService.setExchangeRate(userId, parsedTasa);
      await transactionService.addTransaction(userId, round2(parsedMonto), concepto, categoria?.id ?? null, 'Voz');
      navigation.goBack(); // el Dashboard se actualiza al recibir foco
    } catch (error) {
      console.error('Error al guardar gasto por voz:', error);
      setSaveError(MSG_SAVE_ERROR);
      setIsSaving(false);
    }
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
    <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      {!!parsed?.transcripcion && (
        <View style={styles.heardCard}>
          <Text style={styles.heardLabel}>ESCUCHÉ</Text>
          <Text style={styles.heardText}>"{parsed.transcripcion}"</Text>
        </View>
      )}

      {saveError && (
        <View style={styles.errorBanner}>
          <AlertCircle color={COLORS.error} size={20} />
          <Text style={styles.errorBannerText}>{saveError}</Text>
        </View>
      )}

      {/* D1: monto dictado en otra moneda */}
      {isForeign && parsed?.monto != null && (
        <View style={[styles.currencyCard, needsRate && styles.currencyCardWarning]}>
          <View style={styles.sectionHeader}>
            <RefreshCw color={needsRate ? COLORS.error : COLORS.secondary} size={16} />
            <Text style={styles.currencyText}>
              {needsRate
                ? `Dictaste un monto en ${parsed.moneda === 'USD' ? 'dólares' : 'pesos'}, pero aún no has definido un tipo de cambio. Defínelo para convertirlo a ${monedaPresupuesto}.`
                : `${parsed.monto.toFixed(2)} ${parsed.moneda} ≈ ${formatAmount(
                    convertAmount(parsed.monto, parsed.moneda, monedaPresupuesto, tasaEfectiva!),
                    monedaPresupuesto
                  )} ${monedaPresupuesto} (1 USD = ${tasaEfectiva} MXN)`}
            </Text>
          </View>
          {needsRate && (
            <>
              <View style={[styles.rateInputContainer, touched.tasa && !isTasaValid && styles.inputError]}>
                <Text style={styles.rateAffix}>1 USD =</Text>
                <TextInput
                  style={styles.rateInput}
                  placeholder="0.00"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="decimal-pad"
                  value={tasaText}
                  onChangeText={setTasaText}
                  onBlur={() => setTouched((t) => ({ ...t, tasa: true }))}
                />
                <Text style={styles.rateAffix}>MXN</Text>
              </View>
              {touched.tasa && !isTasaValid && (
                <Text style={styles.fieldError}>Ingresa un tipo de cambio válido mayor a 0.</Text>
              )}
            </>
          )}
        </View>
      )}

      {/* Monto */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <DollarSign color={COLORS.secondary} size={18} />
          <Text style={styles.sectionTitle}>Monto</Text>
        </View>
        <View style={[styles.amountWrapper, touched.monto && !isMontoValid && styles.inputError]}>
          <Text style={styles.currencyPrefix}>{getCurrencySymbol(monedaPresupuesto)}</Text>
          <TextInput
            style={styles.amountInput}
            placeholder="0.00"
            placeholderTextColor={COLORS.textSecondary}
            keyboardType="decimal-pad"
            value={montoText}
            onChangeText={(v) => {
              setMontoText(v);
              setMontoEdited(true);
            }}
            onBlur={() => setTouched((t) => ({ ...t, monto: true }))}
            autoFocus={parsed?.monto == null} // Escenario 3 → "Continuar": monto vacío y enfocado
          />
          <Text style={styles.currencySuffix}>{monedaPresupuesto}</Text>
        </View>
        {touched.monto && !isMontoValid && <Text style={styles.fieldError}>Ingresa un monto mayor a 0.</Text>}
      </View>

      {/* Concepto */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <FileText color={COLORS.secondary} size={18} />
          <Text style={styles.sectionTitle}>Concepto</Text>
        </View>
        <View style={[styles.inputWrapper, touched.concepto && !isConceptoValid && styles.inputError]}>
          <TextInput
            style={styles.textInput}
            placeholder="Ej: Tacos, Uber, Netflix..."
            placeholderTextColor={COLORS.textSecondary}
            value={concepto}
            onChangeText={setConcepto}
            onBlur={() => setTouched((t) => ({ ...t, concepto: true }))}
            maxLength={80}
          />
        </View>
        {touched.concepto && !isConceptoValid && (
          <Text style={styles.fieldError}>Escribe al menos 2 caracteres para el concepto.</Text>
        )}
      </View>

      {/* Categoría */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <LayoutGrid color={COLORS.secondary} size={18} />
          <Text style={styles.sectionTitle}>Categoría</Text>
          <Text style={styles.optionalBadge}>{parsed?.categoria ? 'Sugerida' : 'Opcional'}</Text>
        </View>
        <CategoryPicker categorias={categorias} selectedId={categoria?.id ?? null} onChange={setCategoria} />
      </View>

      <TouchableOpacity
        style={[styles.saveButton, !isFormValid && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={!isFormValid || isSaving}
        activeOpacity={0.8}
      >
        {isSaving ? (
          <ActivityIndicator color={COLORS.background} size="small" />
        ) : (
          <Text style={[styles.saveButtonText, !isFormValid && styles.saveButtonTextDisabled]}>Guardar gasto</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={[styles.secondaryButton, { marginTop: SIZES.spacing.sm }]} onPress={startListening} activeOpacity={0.8} disabled={isSaving}>
        <RotateCcw color={COLORS.secondary} size={18} />
        <Text style={styles.secondaryButtonText}>Dictar de nuevo</Text>
      </TouchableOpacity>
    </ScrollView>
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
  scrollContent: {
    paddingHorizontal: SIZES.spacing.lg,
    paddingTop: SIZES.spacing.md,
    paddingBottom: SIZES.spacing.xl,
  },
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
  currencyCard: {
    backgroundColor: COLORS.tertiary,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: SIZES.radius.card,
    padding: SIZES.spacing.md,
    marginBottom: SIZES.spacing.md,
  },
  currencyCardWarning: { borderColor: COLORS.error },
  currencyText: { color: COLORS.text, fontSize: SIZES.body2, flex: 1, lineHeight: 20 },
  rateInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: SIZES.radius.button,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingHorizontal: SIZES.spacing.md,
    height: 48,
    gap: SIZES.spacing.xs,
  },
  rateAffix: { color: COLORS.textSecondary, fontSize: SIZES.body1, fontWeight: '600' },
  rateInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: SIZES.body1,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
    height: '100%',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(207, 102, 121, 0.15)',
    borderWidth: 1,
    borderColor: COLORS.error,
    borderRadius: SIZES.radius.button,
    padding: SIZES.spacing.sm,
    marginBottom: SIZES.spacing.md,
    gap: SIZES.spacing.xs,
  },
  errorBannerText: { color: COLORS.error, fontSize: SIZES.body2, flex: 1 },
  sectionCard: {
    backgroundColor: COLORS.tertiary,
    borderRadius: SIZES.radius.card,
    padding: SIZES.spacing.md,
    marginBottom: SIZES.spacing.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.spacing.xs,
    marginBottom: SIZES.spacing.sm,
  },
  sectionTitle: { color: COLORS.text, fontSize: SIZES.body1, fontWeight: '600', flex: 1 },
  optionalBadge: { color: COLORS.textSecondary, fontSize: 11, fontStyle: 'italic' },
  amountWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: SIZES.radius.button,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingHorizontal: SIZES.spacing.md,
    height: 60,
  },
  currencyPrefix: { color: COLORS.secondary, fontSize: 28, fontWeight: 'bold', marginRight: 6 },
  amountInput: { flex: 1, color: COLORS.text, fontSize: 28, fontWeight: 'bold', fontVariant: ['tabular-nums'] },
  currencySuffix: { color: COLORS.textSecondary, fontSize: SIZES.body2, fontWeight: '600', marginLeft: 6 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: SIZES.radius.button,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingHorizontal: SIZES.spacing.md,
    height: 50,
  },
  textInput: { flex: 1, color: COLORS.text, fontSize: SIZES.body1 },
  inputError: { borderColor: COLORS.error },
  fieldError: { color: COLORS.error, fontSize: 12, marginTop: 6, marginLeft: 4 },
  saveButton: {
    backgroundColor: COLORS.secondary,
    borderRadius: SIZES.radius.button,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonDisabled: { backgroundColor: COLORS.disabledBg },
  saveButtonText: { color: COLORS.background, fontSize: SIZES.body1, fontWeight: 'bold' },
  saveButtonTextDisabled: { color: COLORS.disabledText },
});
