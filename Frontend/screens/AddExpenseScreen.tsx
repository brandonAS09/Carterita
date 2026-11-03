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
  FlatList,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  DollarSign,
  FileText,
  LayoutGrid,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react-native';
import { COLORS, SIZES } from '../src/theme/theme';
import { authService } from '../src/services/authService';
import { budgetService } from '../src/services/budgetService';
import { transactionService, Categoria } from '../src/services/transactionService';
import { getCurrencySymbol } from '../src/utils/currencyUtils';
import { CategoryIcon } from '../src/theme/categoryIcons';

export default function AddExpenseScreen({ navigation }: any) {
  // Datos de usuario / presupuesto
  const [userId, setUserId] = useState<number | null>(null);
  const [monedaSimbolo, setMonedaSimbolo] = useState('$');

  // Campos del formulario
  const [montoText, setMontoText] = useState('');
  const [concepto, setConcepto] = useState('');
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<Categoria | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);

  // Estados de interacción
  const [touchedMonto, setTouchedMonto] = useState(false);
  const [touchedConcepto, setTouchedConcepto] = useState(false);

  // Control
  const [isLoading, setIsLoading] = useState(false);
  const [loadingCats, setLoadingCats] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const session = await authService.getActiveSession();
      if (!session) { navigation.replace('Login'); return; }
      setUserId(session.id);

      const budget = await budgetService.getBudgetByUserId(session.id);
      if (budget) {
        setMonedaSimbolo(getCurrencySymbol(budget.moneda));
      }

      const cats = await transactionService.getAllCategories();
      setCategorias(cats);
    } catch {
      setErrorMessage('Error al cargar los datos iniciales.');
    } finally {
      setLoadingCats(false);
    }
  };

  // ── Validaciones (Criterio F02 Escenario 2) ──
  const parsedMonto = parseFloat(montoText.replace(/,/g, ''));
  const isMontoValid = !isNaN(parsedMonto) && parsedMonto > 0;
  const isConceptoValid = concepto.trim().length >= 2;

  // Botón habilitado SOLO si monto > 0 y concepto no vacío (categoría es opcional)
  const isFormValid = isMontoValid && isConceptoValid;

  const handleSave = async () => {
    if (!isFormValid || isLoading || !userId) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      await transactionService.addTransaction(
        userId,
        parsedMonto,
        concepto,
        categoriaSeleccionada?.id ?? null
      );

      // Feedback visual de éxito breve antes de volver
      setSavedOk(true);
      setTimeout(() => {
        navigation.goBack();
      }, 800);
    } catch (error: any) {
      setErrorMessage(
        error?.message ?? 'Ocurrió un error al guardar el gasto. Inténtalo de nuevo.'
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
        style={{ flex: 1 }}
      >
        {/* ── Header con botón Atrás ── */}
        <View style={styles.navBar}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <ChevronLeft color={COLORS.text} size={24} />
          </TouchableOpacity>
          <Text style={styles.navTitle}>Nuevo Gasto</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Banner de error (Caso negativo - SQLite falla) ── */}
          {errorMessage && (
            <View style={styles.errorBanner}>
              <AlertCircle color={COLORS.error} size={20} />
              <Text style={styles.errorBannerText}>{errorMessage}</Text>
            </View>
          )}

          {/* ── Banner de éxito ── */}
          {savedOk && (
            <View style={styles.successBanner}>
              <CheckCircle2 color={COLORS.secondary} size={20} />
              <Text style={styles.successBannerText}>¡Gasto registrado!</Text>
            </View>
          )}

          {/* ── Sección 1: Monto ── */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <DollarSign color={COLORS.secondary} size={18} />
              <Text style={styles.sectionTitle}>¿Cuánto gastaste?</Text>
            </View>

            <View
              style={[
                styles.amountWrapper,
                touchedMonto && !isMontoValid && styles.inputError,
              ]}
            >
              <Text style={styles.currencyPrefix}>{monedaSimbolo}</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0.00"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="numeric"
                value={montoText}
                onChangeText={(v) => {
                  setMontoText(v);
                  if (errorMessage) setErrorMessage(null);
                }}
                onBlur={() => setTouchedMonto(true)}
                autoFocus
              />
            </View>
            {touchedMonto && !isMontoValid && (
              <Text style={styles.fieldError}>Ingresa un monto mayor a 0.</Text>
            )}
          </View>

          {/* ── Sección 2: Concepto ── */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <FileText color={COLORS.secondary} size={18} />
              <Text style={styles.sectionTitle}>¿En qué lo gastaste?</Text>
            </View>

            <View
              style={[
                styles.inputWrapper,
                touchedConcepto && !isConceptoValid && styles.inputError,
              ]}
            >
              <TextInput
                style={styles.textInput}
                placeholder="Ej: Tacos, Uber, Netflix..."
                placeholderTextColor={COLORS.textSecondary}
                value={concepto}
                onChangeText={(v) => {
                  setConcepto(v);
                  if (errorMessage) setErrorMessage(null);
                }}
                onBlur={() => setTouchedConcepto(true)}
                maxLength={80}
                returnKeyType="done"
              />
            </View>
            {touchedConcepto && !isConceptoValid && (
              <Text style={styles.fieldError}>
                Escribe al menos 2 caracteres para el concepto.
              </Text>
            )}
          </View>

          {/* ── Sección 3: Categoría (Opcional) ── */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <LayoutGrid color={COLORS.secondary} size={18} />
              <Text style={styles.sectionTitle}>Categoría</Text>
              <Text style={styles.optionalBadge}>Opcional</Text>
            </View>

            {loadingCats ? (
              <View style={styles.catsLoadingContainer}>
                <ActivityIndicator color={COLORS.secondary} size="small" />
                <Text style={styles.catsLoadingText}>Cargando categorías...</Text>
              </View>
            ) : (
              <View style={styles.categoryGrid}>
                {categorias.map((cat) => {
                  const isSelected = categoriaSeleccionada?.id === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.categoryChip,
                        isSelected && styles.categoryChipSelected,
                      ]}
                      onPress={() =>
                        setCategoriaSeleccionada(isSelected ? null : cat)
                      }
                      activeOpacity={0.8}
                    >
                      <CategoryIcon
                        icono={cat.icono}
                        color={isSelected ? COLORS.text : COLORS.secondary}
                        size={16}
                      />
                      <Text
                        style={[
                          styles.categoryChipText,
                          isSelected && styles.categoryChipTextSelected,
                        ]}
                      >
                        {cat.nombre}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* ── Resumen previo al guardado ── */}
          {isFormValid && (
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>RESUMEN DEL GASTO</Text>
              <Text style={styles.summaryAmount}>
                {monedaSimbolo}
                {parsedMonto.toLocaleString('es-MX', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Text>
              <View style={styles.summaryDetailRow}>
                <Text style={styles.summaryDetail}>{concepto.trim()}</Text>
                {categoriaSeleccionada && (
                  <>
                    <Text style={styles.summaryDetail}>·</Text>
                    <CategoryIcon
                      icono={categoriaSeleccionada.icono}
                      color={COLORS.textSecondary}
                      size={14}
                    />
                    <Text style={styles.summaryDetail}>{categoriaSeleccionada.nombre}</Text>
                  </>
                )}
              </View>
            </View>
          )}

          {/* ── Botón Guardar (Criterio F02: Deshabilitado / Spinner) ── */}
          <TouchableOpacity
            style={[
              styles.saveButton,
              !isFormValid && styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={!isFormValid || isLoading || savedOk}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color={COLORS.background} size="small" />
            ) : (
              <Text
                style={[
                  styles.saveButtonText,
                  !isFormValid && styles.saveButtonTextDisabled,
                ]}
              >
                Registrar Gasto
              </Text>
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
  navTitle: {
    color: COLORS.text,
    fontSize: SIZES.body1,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  scrollContent: {
    paddingHorizontal: SIZES.spacing.lg,
    paddingTop: SIZES.spacing.md,
    paddingBottom: SIZES.spacing.xl,
  },
  // ── Banners ──
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
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(47, 163, 106, 0.15)',
    borderWidth: 1,
    borderColor: COLORS.secondary,
    borderRadius: SIZES.radius.button,
    padding: SIZES.spacing.sm,
    marginBottom: SIZES.spacing.md,
    gap: SIZES.spacing.xs,
  },
  successBannerText: {
    color: COLORS.secondary,
    fontSize: SIZES.body2,
    fontWeight: '600',
    flex: 1,
  },
  // ── Tarjetas de Sección ──
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
    flex: 1,
  },
  optionalBadge: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontStyle: 'italic',
  },
  // ── Input Monto ──
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
  currencyPrefix: {
    color: COLORS.secondary,
    fontSize: 28,
    fontWeight: 'bold',
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 28,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  // ── Input Concepto ──
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
  textInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: SIZES.body1,
  },
  inputError: {
    borderColor: COLORS.error,
  },
  fieldError: {
    color: COLORS.error,
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
  },
  // ── Categorías ──
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SIZES.spacing.xs,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: SIZES.radius.button,
    paddingHorizontal: SIZES.spacing.sm,
    paddingVertical: 8,
  },
  categoryChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.secondary,
  },
  categoryChipText: {
    color: COLORS.textSecondary,
    fontSize: SIZES.body2,
    fontWeight: '500',
  },
  categoryChipTextSelected: {
    color: COLORS.text,
    fontWeight: '700',
  },
  catsLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.spacing.sm,
    paddingVertical: SIZES.spacing.sm,
  },
  catsLoadingText: {
    color: COLORS.textSecondary,
    fontSize: SIZES.body2,
  },
  // ── Resumen ──
  summaryBox: {
    backgroundColor: 'rgba(19, 92, 58, 0.25)',
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: SIZES.radius.card,
    padding: SIZES.spacing.md,
    marginBottom: SIZES.spacing.md,
    alignItems: 'center',
  },
  summaryLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    letterSpacing: 1,
    fontWeight: '700',
    marginBottom: 4,
  },
  summaryAmount: {
    color: COLORS.secondary,
    fontSize: 36,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  summaryDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
  },
  summaryDetail: {
    color: COLORS.textSecondary,
    fontSize: SIZES.body2,
  },
  // ── Botón Guardar ──
  saveButton: {
    backgroundColor: COLORS.secondary,
    borderRadius: SIZES.radius.button,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: COLORS.disabledBg,
  },
  saveButtonText: {
    color: COLORS.background,
    fontSize: SIZES.body1,
    fontWeight: 'bold',
  },
  saveButtonTextDisabled: {
    color: COLORS.disabledText,
  },
});
