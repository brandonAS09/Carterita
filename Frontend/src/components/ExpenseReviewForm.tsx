import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { AlertCircle, DollarSign, FileText, LayoutGrid, RefreshCw } from 'lucide-react-native';
import { COLORS, SIZES } from '../theme/theme';
import { budgetService, Presupuesto } from '../services/budgetService';
import type { Categoria } from '../services/transactionService';
import { convertAmount, formatAmount, getCurrencySymbol, Moneda, round2 } from '../utils/currencyUtils';
import CategoryPicker from './CategoryPicker';

const MSG_SAVE_ERROR = 'Ocurrió un error al guardar el gasto. Inténtalo de nuevo.';

const parseNumber = (text: string) => parseFloat(text.replace(/,/g, ''));
const toInputText = (n: number) => round2(n).toString();

export interface ExpenseReviewInitial {
  monto: number | null;
  moneda: Moneda;
  concepto: string;
  /** Nombre de la categoría sugerida, o null si no se reconoció. */
  categoria: string | null;
}

export interface ExpenseReviewValues {
  monto: number;
  concepto: string;
  categoriaId: number | null;
}

interface ExpenseReviewFormProps {
  initial: ExpenseReviewInitial;
  budget: Presupuesto | null;
  categorias: Categoria[];
  userId: number | null;
  /** Montos para llenar con un toque cuando no se detectó el total (F04, D10). */
  suggestions?: number[];
  /** Contenido sobre el formulario: lo escuchado por voz o la miniatura del ticket. */
  header?: React.ReactNode;
  /** Contenido entre la categoría y el botón de guardar. */
  extra?: React.ReactNode;
  /** Acción bajo el botón de guardar; recibe si se está guardando para deshabilitarla. */
  footer?: (isSaving: boolean) => React.ReactNode;
  /** Registra el gasto y sale de la pantalla. Si falla, el formulario muestra el error. */
  onSave: (values: ExpenseReviewValues) => Promise<void>;
}

/** Vista previa editable de un gasto, compartida entre Voz (F03) y Escáner (F04). */
export default function ExpenseReviewForm({
  initial,
  budget,
  categorias,
  userId,
  suggestions = [],
  header,
  extra,
  footer,
  onSave,
}: ExpenseReviewFormProps) {
  const monedaPresupuesto = budget?.moneda ?? 'MXN';

  const [montoText, setMontoText] = useState(() => {
    if (initial.monto === null) return '';
    if (initial.moneda === monedaPresupuesto) return toInputText(initial.monto);
    if (budget?.tipo_cambio_usd) {
      return toInputText(convertAmount(initial.monto, initial.moneda, monedaPresupuesto, budget.tipo_cambio_usd));
    }
    return ''; // se calcula cuando el usuario captura la tasa (D1)
  });
  const [montoEdited, setMontoEdited] = useState(false);
  const [concepto, setConcepto] = useState(initial.concepto);
  const [categoria, setCategoria] = useState<Categoria | null>(
    () => categorias.find((c) => c.nombre === initial.categoria) ?? null
  );
  const [tasaText, setTasaText] = useState(budget?.tipo_cambio_usd ? budget.tipo_cambio_usd.toString() : '');
  const [touched, setTouched] = useState({ monto: false, concepto: false, tasa: false });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // D1: moneda distinta a la del presupuesto
  const isForeign = initial.monto !== null && initial.moneda !== monedaPresupuesto;
  const needsRate = isForeign && !budget?.tipo_cambio_usd;
  const parsedTasa = parseNumber(tasaText);
  const isTasaValid = !isNaN(parsedTasa) && isFinite(parsedTasa) && parsedTasa > 0;
  const tasaEfectiva = needsRate ? (isTasaValid ? parsedTasa : null) : budget?.tipo_cambio_usd ?? null;

  // Conversión en vivo mientras el usuario captura la tasa (si no editó el monto a mano)
  useEffect(() => {
    if (!needsRate || montoEdited || !initial.monto) return;
    setMontoText(
      isTasaValid ? toInputText(convertAmount(initial.monto, initial.moneda, monedaPresupuesto, parsedTasa)) : ''
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasaText, needsRate, montoEdited]);

  const parsedMonto = parseNumber(montoText);
  const isMontoValid = !isNaN(parsedMonto) && parsedMonto > 0;
  const isConceptoValid = concepto.trim().length >= 2;
  const isFormValid = isMontoValid && isConceptoValid && (!needsRate || isTasaValid) && userId !== null;

  const changeMonto = (value: string) => {
    setMontoText(value);
    setMontoEdited(true);
  };

  const handleSave = async () => {
    if (!isFormValid || isSaving || !userId) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      if (needsRate) await budgetService.setExchangeRate(userId, parsedTasa);
      await onSave({ monto: round2(parsedMonto), concepto, categoriaId: categoria?.id ?? null });
    } catch (error) {
      console.error('Error al guardar el gasto:', error);
      setSaveError(MSG_SAVE_ERROR);
      setIsSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      {header}

      {saveError && (
        <View style={styles.errorBanner}>
          <AlertCircle color={COLORS.error} size={20} />
          <Text style={styles.errorBannerText}>{saveError}</Text>
        </View>
      )}

      {/* D1: monto dictado en otra moneda */}
      {isForeign && initial.monto != null && (
        <View style={[styles.currencyCard, needsRate && styles.currencyCardWarning]}>
          <View style={styles.sectionHeader}>
            <RefreshCw color={needsRate ? COLORS.error : COLORS.secondary} size={16} />
            <Text style={styles.currencyText}>
              {needsRate
                ? `Dictaste un monto en ${initial.moneda === 'USD' ? 'dólares' : 'pesos'}, pero aún no has definido un tipo de cambio. Defínelo para convertirlo a ${monedaPresupuesto}.`
                : `${initial.monto.toFixed(2)} ${initial.moneda} ≈ ${formatAmount(
                    convertAmount(initial.monto, initial.moneda, monedaPresupuesto, tasaEfectiva!),
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
            onChangeText={changeMonto}
            onBlur={() => setTouched((t) => ({ ...t, monto: true }))}
            autoFocus={initial.monto == null} // sin monto: campo vacío y enfocado
          />
          <Text style={styles.currencySuffix}>{monedaPresupuesto}</Text>
        </View>
        {touched.monto && !isMontoValid && <Text style={styles.fieldError}>Ingresa un monto mayor a 0.</Text>}

        {suggestions.length > 0 && (
          <View style={styles.suggestions}>
            <Text style={styles.suggestionsTitle}>¿Es alguno de estos?</Text>
            <View style={styles.suggestionRow}>
              {suggestions.map((value) => (
                <TouchableOpacity
                  key={value}
                  style={styles.suggestionChip}
                  onPress={() => changeMonto(toInputText(value))}
                  activeOpacity={0.8}
                >
                  <Text style={styles.suggestionText}>{formatAmount(value, monedaPresupuesto)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
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
          <Text style={styles.optionalBadge}>{initial.categoria ? 'Sugerida' : 'Opcional'}</Text>
        </View>
        <CategoryPicker categorias={categorias} selectedId={categoria?.id ?? null} onChange={setCategoria} />
      </View>

      {extra}

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

      {footer?.(isSaving)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: SIZES.spacing.lg,
    paddingTop: SIZES.spacing.md,
    paddingBottom: SIZES.spacing.xl,
  },
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
  suggestions: { marginTop: SIZES.spacing.sm },
  suggestionsTitle: { color: COLORS.textSecondary, fontSize: SIZES.body2, marginBottom: SIZES.spacing.xs },
  suggestionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.spacing.xs },
  suggestionChip: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.secondary,
    borderRadius: SIZES.radius.button,
    paddingHorizontal: SIZES.spacing.sm,
    paddingVertical: 8,
  },
  suggestionText: { color: COLORS.secondary, fontSize: SIZES.body2, fontWeight: '700', fontVariant: ['tabular-nums'] },
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
