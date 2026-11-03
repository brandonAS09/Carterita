import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  Coins,
  Calendar,
  Sparkles,
  AlertCircle,
  ArrowRight,
  CircleDollarSign
} from 'lucide-react-native';
import { COLORS, SIZES } from '../src/theme/theme';
import { authService } from '../src/services/authService';
import { budgetService, TipoCiclo } from '../src/services/budgetService';

const MONEDAS = [
  { code: 'MXN', label: 'MXN ($)', symbol: '$' },
  { code: 'USD', label: 'USD ($)', symbol: '$' },
  { code: 'EUR', label: 'EUR (€)', symbol: '€' },
];

const CICLOS: { tipo: TipoCiclo; label: string; desc: string }[] = [
  { tipo: 'Diario', label: 'Diario', desc: 'Renovación cada día' },
  { tipo: 'Semanal', label: 'Semanal', desc: 'Cada 7 días' },
  { tipo: 'Mensual', label: 'Mensual', desc: 'Cada 30 días' },
];

export default function BudgetSetupScreen({ navigation }: any) {
  const [userId, setUserId] = useState<number | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [moneda, setMoneda] = useState<string>('MXN');
  const [tipoCiclo, setTipoCiclo] = useState<TipoCiclo>('Mensual');
  const [montoText, setMontoText] = useState<string>('');
  const [touched, setTouched] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    loadActiveUser();
  }, []);

  const loadActiveUser = async () => {
    try {
      const session = await authService.getActiveSession();
      if (session) {
        setUserId(session.id);
        setUserName(session.nombre);

        // Si ya tenía un presupuesto guardado, lo pre-cargamos
        const existingBudget = await budgetService.getBudgetByUserId(session.id);
        if (existingBudget) {
          setMoneda(existingBudget.moneda);
          setTipoCiclo(existingBudget.tipo_ciclo);
          setMontoText(existingBudget.monto_base.toString());
        }
      } else {
        navigation.replace('Login');
      }
    } catch {
      setErrorMessage('No se pudo verificar la sesión.');
    }
  };

  const parsedMonto = parseFloat(montoText.replace(/,/g, ''));
  const isMontoValid = !isNaN(parsedMonto) && parsedMonto > 0;
  const isFormValid = isMontoValid && userId !== null;

  const dailyEstimate = isMontoValid
    ? budgetService.calculateDailyLimit(parsedMonto, tipoCiclo)
    : 0;

  const currentSymbol = MONEDAS.find((m) => m.code === moneda)?.symbol || '$';

  const handleSaveBudget = async () => {
    if (!isFormValid || isLoading || !userId) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      await budgetService.createOrUpdateBudget(
        userId,
        parsedMonto,
        tipoCiclo,
        moneda
      );

      // Redirigir al Dashboard una vez guardado el presupuesto
      navigation.replace('Menu');
    } catch (error: any) {
      // Caso negativo: Fallo en SQLite / base de datos
      setErrorMessage(
        error?.message || 'Ocurrió un error al guardar tu configuración. Inténtalo de nuevo.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <CircleDollarSign color={COLORS.secondary} size={36} />
            </View>
            <Text style={styles.welcomeText}>
              ¡Hola{userName ? `, ${userName}` : ''}! 👋
            </Text>
            <Text style={styles.title}>Define tu Presupuesto</Text>
            <Text style={styles.subtitle}>
              Carterita calculará automáticamente cuánto puedes gastar cada día sin salirte de tu meta.
            </Text>
          </View>

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
              <Text style={styles.sectionTitle}>1. Moneda Local</Text>
            </View>
            <View style={styles.currencyRow}>
              {MONEDAS.map((m) => {
                const isSelected = moneda === m.code;
                return (
                  <TouchableOpacity
                    key={m.code}
                    style={[
                      styles.currencyChip,
                      isSelected && styles.currencyChipSelected,
                    ]}
                    onPress={() => setMoneda(m.code)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.currencyChipText,
                        isSelected && styles.currencyChipTextSelected,
                      ]}
                    >
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
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
                    style={[
                      styles.cycleCard,
                      isSelected && styles.cycleCardSelected,
                    ]}
                    onPress={() => setTipoCiclo(c.tipo)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.cycleLabel,
                        isSelected && styles.cycleLabelSelected,
                      ]}
                    >
                      {c.label}
                    </Text>
                    <Text style={styles.cycleDesc}>{c.desc}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
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
                keyboardType="numeric"
                value={montoText}
                onChangeText={(val) => {
                  setMontoText(val);
                  if (errorMessage) setErrorMessage(null);
                }}
                onBlur={() => setTouched(true)}
              />
              <Text style={styles.currencySuffix}>{moneda}</Text>
            </View>

            {touched && !isMontoValid && (
              <Text style={styles.fieldErrorText}>
                Ingresa un monto válido mayor a 0.
              </Text>
            )}

            {/* Vista previa en tiempo real del límite diario */}
            <View style={styles.previewBox}>
              <Text style={styles.previewLabel}>LÍMITE ESTIMADO POR DÍA:</Text>
              <Text style={styles.previewAmount}>
                {currentSymbol}
                {dailyEstimate.toLocaleString('es-MX', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                <Text style={styles.previewCurrency}>{moneda}/día</Text>
              </Text>
            </View>
          </View>

          {/* Botón Guardar / Continuar (Criterios: Deshabilitado si incompleto, spinner al guardar) */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              !isFormValid && styles.submitButtonDisabled,
            ]}
            onPress={handleSaveBudget}
            disabled={!isFormValid || isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color={COLORS.background} size="small" />
            ) : (
              <View style={styles.buttonContent}>
                <Text
                  style={[
                    styles.submitButtonText,
                    !isFormValid && styles.submitButtonTextDisabled,
                  ]}
                >
                  Comenzar con Carterita
                </Text>
                <ArrowRight
                  color={!isFormValid ? COLORS.disabledText : COLORS.background}
                  size={20}
                />
              </View>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardContainer: {
    flex: 1,
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
