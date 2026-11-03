import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Coins,
  Calendar,
  Sparkles,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ChevronLeft,
  CircleDollarSign,
  RefreshCw,
} from 'lucide-react-native';
import { COLORS, SIZES } from '../src/theme/theme';
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

const CICLOS: { tipo: TipoCiclo; label: string; desc: string }[] = [
  { tipo: 'Diario', label: 'Diario', desc: 'Renovación cada día' },
  { tipo: 'Semanal', label: 'Semanal', desc: 'Cada 7 días' },
  { tipo: 'Mensual', label: 'Mensual', desc: 'Cada 30 días' },
];

const SAVE_ERROR = 'Ocurrió un error al guardar tu configuración. Inténtalo de nuevo.';

const parseNumber = (text: string) => parseFloat(text.replace(/,/g, ''));
const toInputText = (n: number) => round2(n).toString();

/**
 * F01 (Onboarding) y F01.1 (Edición de Presupuesto).
 * route.params.mode: 'onboarding' (por defecto) | 'edit'
 */
export default function BudgetSetupScreen({ navigation, route }: any) {
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

  // ── Render ──
  if (isInitializing) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.centered]}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color={COLORS.secondary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        {/* Navbar (solo modo edición) */}
        {isEditMode && (
          <View style={styles.navBar}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              activeOpacity={0.8}
            >
              <ChevronLeft color={COLORS.text} size={24} />
            </TouchableOpacity>
            <Text style={styles.navTitle}>Editar Presupuesto</Text>
            <View style={{ width: 40 }} />
          </View>
        )}

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header (solo onboarding) */}
          {!isEditMode && (
            <View style={styles.header}>
              <View style={styles.iconCircle}>
                <CircleDollarSign color={COLORS.secondary} size={36} />
              </View>
              <Text style={styles.welcomeText}>
                Hola{userName ? `, ${userName}` : ''}
              </Text>
              <Text style={styles.title}>Define tu Presupuesto</Text>
              <Text style={styles.subtitle}>
                Carterita calculará automáticamente cuánto puedes gastar cada día sin salirte de tu meta.
              </Text>
            </View>
          )}

          {/* Banner de Error (Caso Negativo) */}
          {errorMessage && (
            <View style={styles.errorBanner}>
              <AlertCircle color={COLORS.error} size={20} />
              <Text style={styles.errorBannerText}>{errorMessage}</Text>
            </View>
          )}

          {/* 1. Selección de Moneda */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Coins color={COLORS.secondary} size={18} />
              <Text style={styles.sectionTitle}>1. Moneda</Text>
            </View>
            <View style={styles.currencyRow}>
              {MONEDAS.map((m) => {
                const isSelected = moneda === m.code;
                return (
                  <TouchableOpacity
                    key={m.code}
                    style={[styles.currencyChip, isSelected && styles.currencyChipSelected]}
                    onPress={() => setMoneda(m.code)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.currencyChipText, isSelected && styles.currencyChipTextSelected]}>
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Tipo de cambio (solo si cambia la moneda) */}
            {currencyChanged && (
              <View style={styles.rateBlock}>
                <Text style={styles.rateLabel}>Tipo de cambio</Text>
                <View
                  style={[
                    styles.rateInputContainer,
                    touchedTasa && !isTasaValid && styles.amountInputError,
                  ]}
                >
                  <Text style={styles.rateAffix}>1 USD =</Text>
                  <TextInput
                    style={styles.rateInput}
                    placeholder="0.00"
                    placeholderTextColor={COLORS.textSecondary}
                    keyboardType="decimal-pad"
                    value={tasaText}
                    onChangeText={(val) => {
                      setTasaText(val);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    onBlur={() => setTouchedTasa(true)}
                  />
                  <Text style={styles.rateAffix}>MXN</Text>
                </View>
                {touchedTasa && !isTasaValid ? (
                  <Text style={styles.fieldErrorText}>Ingresa un tipo de cambio válido mayor a 0.</Text>
                ) : (
                  <View style={styles.hintRow}>
                    <RefreshCw color={COLORS.textSecondary} size={14} />
                    <Text style={styles.hintText}>
                      Tu presupuesto, todos tus gastos y tus metas se convertirán a {moneda}.
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* 2. Tipo de Ciclo */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Calendar color={COLORS.secondary} size={18} />
              <Text style={styles.sectionTitle}>2. Ciclo del Presupuesto</Text>
            </View>
            <View style={styles.cycleGrid}>
              {CICLOS.map((c) => {
                const isSelected = tipoCiclo === c.tipo;
                return (
                  <TouchableOpacity
                    key={c.tipo}
                    style={[styles.cycleCard, isSelected && styles.cycleCardSelected]}
                    onPress={() => setTipoCiclo(c.tipo)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.cycleLabel, isSelected && styles.cycleLabelSelected]}>
                      {c.label}
                    </Text>
                    <Text style={styles.cycleDesc}>{c.desc}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {isEditMode && cycleChanged && (
              <View style={styles.hintRow}>
                <RefreshCw color={COLORS.textSecondary} size={14} />
                <Text style={styles.hintText}>Cambiar el tipo de ciclo lo reiniciará a partir de hoy.</Text>
              </View>
            )}
          </View>

          {/* 3. Monto Base del Presupuesto */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Sparkles color={COLORS.secondary} size={18} />
              <Text style={styles.sectionTitle}>3. Monto Total para este Ciclo</Text>
            </View>

            <View
              style={[
                styles.amountInputContainer,
                touched && !isMontoValid && styles.amountInputError,
              ]}
            >
              <Text style={styles.currencyPrefix}>{currentSymbol}</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0.00"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="decimal-pad"
                value={montoText}
                onChangeText={(val) => {
                  setMontoText(val);
                  setMontoEditedByUser(true);
                  if (errorMessage) setErrorMessage(null);
                }}
                onBlur={() => setTouched(true)}
              />
              <Text style={styles.currencySuffix}>{moneda}</Text>
            </View>

            {touched && !isMontoValid && (
              <Text style={styles.fieldErrorText}>Ingresa un monto válido mayor a 0.</Text>
            )}

            {/* Escenario 3: advertencia de sobregasto (informa, no bloquea) */}
            {showOverspendWarning && cycleSpentInSelectedCurrency !== null && (
              <View style={styles.warningRow}>
                <AlertTriangle color={COLORS.error} size={16} />
                <Text style={styles.warningText}>
                  Ya gastaste {formatAmount(cycleSpentInSelectedCurrency, moneda)} en este ciclo. Tu saldo
                  quedará en negativo.
                </Text>
              </View>
            )}

            {/* Vista previa en tiempo real del límite diario */}
            <View style={styles.previewBox}>
              <Text style={styles.previewLabel}>LÍMITE ESTIMADO POR DÍA:</Text>
              <Text style={styles.previewAmount}>
                {formatAmount(dailyEstimate, moneda)}{' '}
                <Text style={styles.previewCurrency}>{moneda}/día</Text>
              </Text>
            </View>
          </View>

          {/* Botón Guardar (deshabilitado si inválido o sin cambios; spinner al guardar) */}
          <TouchableOpacity
            style={[styles.submitButton, !isFormValid && styles.submitButtonDisabled]}
            onPress={handleSavePress}
            disabled={!isFormValid || isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color={COLORS.background} size="small" />
            ) : (
              <View style={styles.buttonContent}>
                <Text style={[styles.submitButtonText, !isFormValid && styles.submitButtonTextDisabled]}>
                  {isEditMode ? 'Guardar cambios' : 'Comenzar con Carterita'}
                </Text>
                {!isEditMode && (
                  <ArrowRight color={!isFormValid ? COLORS.disabledText : COLORS.background} size={20} />
                )}
              </View>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Escenario 2: confirmación de reinicio de ciclo */}
      <ConfirmDialog
        visible={showCycleConfirm}
        title="¿Reiniciar tu ciclo?"
        message={`Tu nuevo ciclo ${tipoCiclo} comenzará hoy. Los gastos que registraste en días anteriores dejarán de contar para tu presupuesto (no se borrarán de tu historial).`}
        confirmLabel="Reiniciar ciclo"
        onConfirm={performSave}
        onCancel={() => setShowCycleConfirm(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardContainer: {
    flex: 1,
  },
  // ── Navbar (modo edición) ──
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
  navTitle: {
    color: COLORS.text,
    fontSize: SIZES.body1,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  scrollContent: {
    paddingHorizontal: SIZES.spacing.lg,
    paddingTop: SIZES.spacing.lg,
    paddingBottom: SIZES.spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: SIZES.spacing.lg,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.tertiary,
    borderWidth: 1,
    borderColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SIZES.spacing.sm,
  },
  welcomeText: {
    color: COLORS.secondary,
    fontSize: SIZES.body2,
    fontWeight: '600',
    marginBottom: 4,
  },
  title: {
    color: COLORS.text,
    fontSize: SIZES.h1 - 4,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: SIZES.body2,
    textAlign: 'center',
    marginTop: SIZES.spacing.xs,
    lineHeight: 20,
    paddingHorizontal: SIZES.spacing.sm,
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
  errorBannerText: {
    color: COLORS.error,
    fontSize: SIZES.body2,
    flex: 1,
  },
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
  sectionTitle: {
    color: COLORS.text,
    fontSize: SIZES.body1,
    fontWeight: '600',
  },
  currencyRow: {
    flexDirection: 'row',
    gap: SIZES.spacing.xs,
  },
  currencyChip: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: SIZES.radius.button,
    paddingVertical: 10,
    alignItems: 'center',
  },
  currencyChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.secondary,
  },
  currencyChipText: {
    color: COLORS.textSecondary,
    fontSize: SIZES.body2,
    fontWeight: '600',
  },
  currencyChipTextSelected: {
    color: COLORS.text,
    fontWeight: 'bold',
  },
  // ── Tipo de cambio ──
  rateBlock: {
    marginTop: SIZES.spacing.md,
  },
  rateLabel: {
    color: COLORS.text,
    fontSize: SIZES.body2,
    fontWeight: '500',
    marginBottom: SIZES.spacing.xs,
  },
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
  rateAffix: {
    color: COLORS.textSecondary,
    fontSize: SIZES.body1,
    fontWeight: '600',
  },
  rateInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: SIZES.body1,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
    height: '100%',
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SIZES.spacing.xs,
  },
  hintText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    flex: 1,
  },
  cycleGrid: {
    flexDirection: 'row',
    gap: SIZES.spacing.xs,
  },
  cycleCard: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: SIZES.radius.button,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  cycleCardSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.secondary,
  },
  cycleLabel: {
    color: COLORS.textSecondary,
    fontSize: SIZES.body2,
    fontWeight: '700',
  },
  cycleLabelSelected: {
    color: COLORS.text,
  },
  cycleDesc: {
    color: COLORS.textSecondary,
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
    opacity: 0.8,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: SIZES.radius.button,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingHorizontal: SIZES.spacing.md,
    height: 54,
  },
  amountInputError: {
    borderColor: COLORS.error,
  },
  currencyPrefix: {
    color: COLORS.secondary,
    fontSize: SIZES.h2,
    fontWeight: 'bold',
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: SIZES.h2,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
    height: '100%',
  },
  currencySuffix: {
    color: COLORS.textSecondary,
    fontSize: SIZES.body2,
    fontWeight: '600',
    marginLeft: 6,
  },
  fieldErrorText: {
    color: COLORS.error,
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: SIZES.spacing.xs,
  },
  warningText: {
    color: COLORS.error,
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  previewBox: {
    marginTop: SIZES.spacing.md,
    padding: SIZES.spacing.sm,
    backgroundColor: 'rgba(19, 92, 58, 0.35)',
    borderRadius: SIZES.radius.button,
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignItems: 'center',
  },
  previewLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    letterSpacing: 0.8,
    fontWeight: '600',
  },
  previewAmount: {
    color: COLORS.secondary,
    fontSize: SIZES.h2,
    fontWeight: 'bold',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  previewCurrency: {
    fontSize: SIZES.body2,
    color: COLORS.textSecondary,
    fontWeight: 'normal',
  },
  submitButton: {
    backgroundColor: COLORS.secondary,
    borderRadius: SIZES.radius.button,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SIZES.spacing.xs,
  },
  submitButtonDisabled: {
    backgroundColor: COLORS.disabledBg,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.spacing.xs,
  },
  submitButtonText: {
    color: COLORS.background,
    fontSize: SIZES.body1,
    fontWeight: 'bold',
  },
  submitButtonTextDisabled: {
    color: COLORS.disabledText,
  },
});
