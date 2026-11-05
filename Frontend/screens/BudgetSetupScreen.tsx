import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Coins, Calendar, Sparkles, ArrowRight, RefreshCw } from 'lucide-react-native';
import { useTheme, useThemedStyles } from '../src/theme/ThemeProvider';
import { RADIUS, SPACING, ThemeColors, TYPOGRAPHY } from '../src/theme/theme';
import { authService } from '../src/services/authService';
import { budgetService, Presupuesto, TipoCiclo } from '../src/services/budgetService';
import { transactionService } from '../src/services/transactionService';
import {
  MONEDAS,
  Moneda,
  convertAmount,
  formatAmount,
  getCurrencySymbol,
  round2,
} from '../src/utils/currencyUtils';
import ConfirmDialog from '../src/components/ConfirmDialog';
import HeroHeader from '../src/components/ui/HeroHeader';
import Button from '../src/components/ui/Button';
import TextField from '../src/components/ui/TextField';
import { Banner, Chip, FormSection } from '../src/components/ui/Form';

const CICLOS: { tipo: TipoCiclo; label: string; desc: string }[] = [
  { tipo: 'Diario', label: 'Diario', desc: 'Renovación cada día' },
  { tipo: 'Semanal', label: 'Semanal', desc: 'Cada 7 días' },
  { tipo: 'Mensual', label: 'Mensual', desc: 'Cada 30 días' },
];

const SAVE_ERROR = 'Ocurrió un error al guardar tu configuración. Inténtalo de nuevo.';
const ONBOARDING_STEPS = 2;

const parseNumber = (text: string) => parseFloat(text.replace(/,/g, ''));
const toInputText = (n: number) => round2(n).toString();

/**
 * F01 (Onboarding) y F01.1 (Edición de Presupuesto).
 * route.params.mode: 'onboarding' (por defecto) | 'edit'
 */
export default function BudgetSetupScreen({ navigation, route }: any) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  // D18: dos pasos solo en el registro inicial; la edición sigue en una sola pantalla
  const [step, setStep] = useState(1);
  const isEditMode = route?.params?.mode === 'edit';

  const [userId, setUserId] = useState<number | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [original, setOriginal] = useState<Presupuesto | null>(null);
  const [cycleSpent, setCycleSpent] = useState(0);

  // Formulario
  const [moneda, setMoneda] = useState<Moneda>('MXN');
  const [tipoCiclo, setTipoCiclo] = useState<TipoCiclo>('Mensual');
  const [montoText, setMontoText] = useState<string>('');
  const [montoEditedByUser, setMontoEditedByUser] = useState(false);
  const [tasaText, setTasaText] = useState<string>('');

  // Interacción
  const [touched, setTouched] = useState<boolean>(false);
  const [touchedTasa, setTouchedTasa] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(isEditMode);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showCycleConfirm, setShowCycleConfirm] = useState(false);

  useEffect(() => {
    loadActiveUser();
  }, []);

  const loadActiveUser = async () => {
    try {
      const session = await authService.getActiveSession();
      if (!session) {
        navigation.replace('Login');
        return;
      }
      setUserId(session.id);
      setUserName(session.nombre);

      // Si ya tenía un presupuesto guardado, lo pre-cargamos
      const existingBudget = await budgetService.getBudgetByUserId(session.id);
      if (existingBudget) {
        setOriginal(existingBudget);
        setMoneda(existingBudget.moneda);
        setTipoCiclo(existingBudget.tipo_ciclo);
        setMontoText(toInputText(existingBudget.monto_base));
        if (existingBudget.tipo_cambio_usd) {
          setTasaText(existingBudget.tipo_cambio_usd.toString());
        }
        if (isEditMode) {
          setCycleSpent(
            await transactionService.getCycleTotal(
              session.id,
              existingBudget.fecha_inicio,
              existingBudget.fecha_fin
            )
          );
        }
      }
    } catch {
      setErrorMessage('No se pudo cargar tu configuración actual.');
    } finally {
      setIsInitializing(false);
    }
  };

  // ── Derivados ──
  const currencyChanged = original !== null && moneda !== original.moneda;
  const cycleChanged = original !== null && tipoCiclo !== original.tipo_ciclo;

  const parsedTasa = parseNumber(tasaText);
  const isTasaValid = !isNaN(parsedTasa) && isFinite(parsedTasa) && parsedTasa > 0;

  const parsedMonto = parseNumber(montoText);
  const isMontoValid = !isNaN(parsedMonto) && parsedMonto > 0;

  // Conversión en vivo del monto al cambiar de moneda (si el usuario no lo ha escrito a mano)
  useEffect(() => {
    if (!original || montoEditedByUser) return;
    if (moneda === original.moneda) {
      setMontoText(toInputText(original.monto_base));
    } else {
      setMontoText(
        isTasaValid ? toInputText(convertAmount(original.monto_base, original.moneda, moneda, parsedTasa)) : ''
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moneda, tasaText, original, montoEditedByUser]);

  const hasChanges =
    original !== null &&
    (currencyChanged || cycleChanged || (isMontoValid && round2(parsedMonto) !== round2(original.monto_base)));

  const isFormValid =
    isMontoValid &&
    userId !== null &&
    (!currencyChanged || isTasaValid) &&
    (!isEditMode || hasChanges);

  // Advertencia: nuevo monto menor a lo ya gastado en el ciclo (solo si el ciclo continúa)
  const cycleSpentInSelectedCurrency =
    original && currencyChanged
      ? isTasaValid
        ? convertAmount(cycleSpent, original.moneda, moneda, parsedTasa)
        : null
      : cycleSpent;
  const showOverspendWarning =
    isEditMode &&
    !cycleChanged &&
    isMontoValid &&
    cycleSpentInSelectedCurrency !== null &&
    cycleSpentInSelectedCurrency > 0 &&
    parsedMonto < cycleSpentInSelectedCurrency;

  const dailyEstimate = isMontoValid ? budgetService.calculateDailyLimit(parsedMonto, tipoCiclo) : 0;
  const currentSymbol = getCurrencySymbol(moneda);

  // ── Acciones ──
  const handleSavePress = () => {
    if (!isFormValid || isLoading) return;
    if (isEditMode && cycleChanged) {
      setShowCycleConfirm(true); // Escenario 2: confirmar antes de reiniciar el ciclo
      return;
    }
    performSave();
  };

  const performSave = async () => {
    setShowCycleConfirm(false);
    if (!isFormValid || isLoading || !userId) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      if (original) {
        await budgetService.updateBudget(userId, {
          montoBase: round2(parsedMonto),
          tipoCiclo,
          moneda,
          tipoCambioUsd: currencyChanged ? parsedTasa : undefined,
        });
      } else {
        await budgetService.createBudget(userId, round2(parsedMonto), tipoCiclo, moneda);
      }

      if (isEditMode) {
        navigation.goBack(); // El Dashboard se refresca solo al recibir foco
      } else {
        navigation.replace('Menu');
      }
    } catch (error) {
      console.error('Error al guardar el presupuesto:', error);
      setErrorMessage(SAVE_ERROR);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isEditMode || step === 1) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setStep(1);
      return true;
    });
    return () => subscription.remove();
  }, [isEditMode, step]);

  // ── Render ──
  if (isInitializing) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const amountSection = (
    <FormSection title={isEditMode ? 'Monto total para este ciclo' : '¿Cuánto quieres gastar en cada ciclo?'} icon={Sparkles}>
      <TextField
        accessibilityLabel="Monto total para este ciclo"
        amount
        prefix={currentSymbol}
        suffix={moneda}
        placeholder="0.00"
        keyboardType="decimal-pad"
        value={montoText}
        onChangeText={(val) => {
          setMontoText(val);
          setMontoEditedByUser(true);
          if (errorMessage) setErrorMessage(null);
        }}
        onBlur={() => setTouched(true)}
        autoFocus={!isEditMode}
        error={touched && !isMontoValid ? 'Ingresa un monto válido mayor a 0.' : null}
      />

      {/* Escenario 3: advertencia de sobregasto (informa, no bloquea) */}
      {showOverspendWarning && cycleSpentInSelectedCurrency !== null && (
        <Banner
          tone="warning"
          message={`Ya gastaste ${formatAmount(cycleSpentInSelectedCurrency, moneda)} en este ciclo. Tu saldo quedará en negativo.`}
          style={styles.warning}
        />
      )}
    </FormSection>
  );

  const currencySection = (
    <FormSection title="Moneda" icon={Coins}>
      <View style={styles.row}>
        {MONEDAS.map((m) => (
          <Chip key={m.code} label={m.label} selected={moneda === m.code} onPress={() => setMoneda(m.code)} style={styles.rowItem} />
        ))}
      </View>

      {/* Tipo de cambio (solo si cambia la moneda) */}
      {currencyChanged && (
        <View style={styles.rateBlock}>
          <TextField
            label="Tipo de cambio"
            prefix="1 USD ="
            suffix="MXN"
            placeholder="0.00"
            keyboardType="decimal-pad"
            value={tasaText}
            onChangeText={(val) => {
              setTasaText(val);
              if (errorMessage) setErrorMessage(null);
            }}
            onBlur={() => setTouchedTasa(true)}
            error={touchedTasa && !isTasaValid ? 'Ingresa un tipo de cambio válido mayor a 0.' : null}
          />
          {!(touchedTasa && !isTasaValid) && (
            <View style={styles.hintRow}>
              <RefreshCw color={colors.textSecondary} size={14} />
              <Text style={styles.hintText}>Tu presupuesto, todos tus gastos y tus metas se convertirán a {moneda}.</Text>
            </View>
          )}
        </View>
      )}
    </FormSection>
  );

  const cycleSection = (
    <FormSection title="Ciclo del presupuesto" icon={Calendar}>
      <View style={styles.row}>
        {CICLOS.map((c) => (
          <Chip
            key={c.tipo}
            label={c.label}
            description={c.desc}
            selected={tipoCiclo === c.tipo}
            onPress={() => setTipoCiclo(c.tipo)}
            style={styles.rowItem}
          />
        ))}
      </View>
      {isEditMode && cycleChanged && (
        <View style={styles.hintRow}>
          <RefreshCw color={colors.textSecondary} size={14} />
          <Text style={styles.hintText}>Cambiar el tipo de ciclo lo reiniciará a partir de hoy.</Text>
        </View>
      )}
    </FormSection>
  );

  // Vista previa en tiempo real del límite diario
  const dailyPreview = (
    <View style={styles.preview}>
      <Text style={styles.previewLabel}>Límite estimado por día</Text>
      <Text style={styles.previewAmount}>
        {formatAmount(dailyEstimate, moneda)} <Text style={styles.previewUnit}>{moneda}/día</Text>
      </Text>
    </View>
  );

  const renderBody = () => {
    if (isEditMode) {
      return (
        <>
          {amountSection}
          {currencySection}
          {cycleSection}
          {dailyPreview}
          {/* Deshabilitado si es inválido o no hay cambios; indicador de carga al guardar */}
          <Button label="Guardar cambios" onPress={handleSavePress} disabled={!isFormValid} loading={isLoading} />
        </>
      );
    }
    if (step === 1) {
      return (
        <>
          <Text style={styles.welcome}>Hola{userName ? `, ${userName}` : ''}</Text>
          <Text style={styles.subtitle}>
            Carterita calculará automáticamente cuánto puedes gastar cada día sin salirte de tu meta.
          </Text>
          {amountSection}
          <Button label="Continuar" icon={ArrowRight} onPress={() => setStep(2)} disabled={!isMontoValid} />
        </>
      );
    }
    return (
      <>
        {currencySection}
        {cycleSection}
        {dailyPreview}
        <Button
          label="Comenzar con Carterita"
          icon={ArrowRight}
          onPress={handleSavePress}
          disabled={!isFormValid}
          loading={isLoading}
        />
      </>
    );
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.screen}>
      <HeroHeader
        title={isEditMode ? 'Editar Presupuesto' : 'Define tu Presupuesto'}
        onBack={isEditMode ? () => navigation.goBack() : step === 2 ? () => setStep(1) : undefined}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {!isEditMode && (
          <View
            style={styles.dots}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={`Paso ${step} de ${ONBOARDING_STEPS}`}
          >
            {Array.from({ length: ONBOARDING_STEPS }, (_, i) => (
              <View key={i} style={[styles.dot, { backgroundColor: i < step ? colors.primary : colors.divider }]} />
            ))}
          </View>
        )}

        {/* Banner de Error (Caso Negativo) */}
        {errorMessage && <Banner tone="error" message={errorMessage} />}

        {renderBody()}
      </ScrollView>

      {/* Escenario 2: confirmación de reinicio de ciclo */}
      <ConfirmDialog
        visible={showCycleConfirm}
        title="¿Reiniciar tu ciclo?"
        message={`Tu nuevo ciclo ${tipoCiclo} comenzará hoy. Los gastos que registraste en días anteriores dejarán de contar para tu presupuesto (no se borrarán de tu historial). Los gastos de hoy sí se incluyen en el nuevo ciclo.`}
        confirmLabel="Reiniciar ciclo"
        onConfirm={performSave}
        onCancel={() => setShowCycleConfirm(false)}
      />
    </KeyboardAvoidingView>
  );
}

const DOT_SIZE = 8;

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    centered: { justifyContent: 'center', alignItems: 'center' },
    scrollContent: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xl },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: SPACING.xs, marginBottom: SPACING.md },
    dot: { width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2 },
    welcome: { ...TYPOGRAPHY.h2, color: colors.text },
    subtitle: { ...TYPOGRAPHY.body2, color: colors.textSecondary, marginTop: 4, marginBottom: SPACING.md },
    warning: { marginTop: SPACING.sm, marginBottom: 0 },
    row: { flexDirection: 'row', gap: SPACING.xs },
    rowItem: { flex: 1 },
    rateBlock: { marginTop: SPACING.sm },
    hintRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: SPACING.xs },
    hintText: { ...TYPOGRAPHY.caption, color: colors.textSecondary, flex: 1 },
    preview: {
      backgroundColor: colors.surfaceVariant,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      marginBottom: SPACING.md,
      gap: 2,
    },
    previewLabel: { ...TYPOGRAPHY.caption, color: colors.textSecondary },
    previewAmount: { ...TYPOGRAPHY.h2, color: colors.text, fontVariant: ['tabular-nums'] },
    previewUnit: { ...TYPOGRAPHY.body2, color: colors.textSecondary },
  });
