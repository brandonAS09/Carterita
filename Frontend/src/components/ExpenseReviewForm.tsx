import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { DollarSign, FileText, LayoutGrid, RefreshCw } from 'lucide-react-native';
import { useTheme, useThemedStyles } from '../theme/ThemeProvider';
import { MIN_TOUCH, RADIUS, SPACING, ThemeColors, TYPOGRAPHY } from '../theme/theme';
import { budgetService, Presupuesto } from '../services/budgetService';
import type { Categoria } from '../services/transactionService';
import { convertAmount, formatAmount, getCurrencySymbol, Moneda, round2 } from '../utils/currencyUtils';
import { notifySuccess } from '../utils/feedback';
import CategoryPicker from './CategoryPicker';
import Button from './ui/Button';
import TextField from './ui/TextField';
import { Banner, FormSection } from './ui/Form';

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
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
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
      notifySuccess();
    } catch (error) {
      console.error('Error al guardar el gasto:', error);
      setSaveError(MSG_SAVE_ERROR);
      setIsSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      {header}

      {saveError && <Banner tone="error" message={saveError} />}

      {/* D1: monto dictado en otra moneda */}
      {isForeign && initial.monto != null && (
        <FormSection
          title={needsRate ? 'Falta el tipo de cambio' : 'Conversión de moneda'}
          icon={RefreshCw}
        >
          <Text style={styles.currencyText}>
            {needsRate
              ? `Dictaste un monto en ${initial.moneda === 'USD' ? 'dólares' : 'pesos'}, pero aún no has definido un tipo de cambio. Defínelo para convertirlo a ${monedaPresupuesto}.`
              : `${initial.monto.toFixed(2)} ${initial.moneda} ≈ ${formatAmount(
                  convertAmount(initial.monto, initial.moneda, monedaPresupuesto, tasaEfectiva!),
                  monedaPresupuesto
                )} ${monedaPresupuesto} (1 USD = ${tasaEfectiva} MXN)`}
          </Text>
          {needsRate && (
            <TextField
              accessibilityLabel="Tipo de cambio en pesos por dólar"
              prefix="1 USD ="
              suffix="MXN"
              placeholder="0.00"
              keyboardType="decimal-pad"
              value={tasaText}
              onChangeText={setTasaText}
              onBlur={() => setTouched((t) => ({ ...t, tasa: true }))}
              error={touched.tasa && !isTasaValid ? 'Ingresa un tipo de cambio válido mayor a 0.' : null}
              containerStyle={styles.rateField}
            />
          )}
        </FormSection>
      )}

      {/* Monto */}
      <FormSection title="Monto" icon={DollarSign}>
        <TextField
          accessibilityLabel="Monto"
          amount
          prefix={getCurrencySymbol(monedaPresupuesto)}
          suffix={monedaPresupuesto}
          placeholder="0.00"
          keyboardType="decimal-pad"
          value={montoText}
          onChangeText={changeMonto}
          onBlur={() => setTouched((t) => ({ ...t, monto: true }))}
          autoFocus={initial.monto == null} // sin monto: campo vacío y enfocado
          error={touched.monto && !isMontoValid ? 'Ingresa un monto mayor a 0.' : null}
        />

        {suggestions.length > 0 && (
          <View style={styles.suggestions}>
            <Text style={styles.suggestionsTitle}>¿Es alguno de estos?</Text>
            <View style={styles.suggestionRow}>
              {suggestions.map((value) => (
                <Pressable
                  key={value}
                  style={[styles.suggestionChip, { borderColor: colors.primary }]}
                  onPress={() => changeMonto(toInputText(value))}
                  accessibilityRole="button"
                >
                  <Text style={styles.suggestionText}>{formatAmount(value, monedaPresupuesto)}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </FormSection>

      {/* Concepto */}
      <FormSection title="Concepto" icon={FileText}>
        <TextField
          accessibilityLabel="Concepto"
          placeholder="Ej: Tacos, Uber, Netflix..."
          value={concepto}
          onChangeText={setConcepto}
          onBlur={() => setTouched((t) => ({ ...t, concepto: true }))}
          maxLength={80}
          error={touched.concepto && !isConceptoValid ? 'Escribe al menos 2 caracteres para el concepto.' : null}
        />
      </FormSection>

      {/* Categoría */}
      <FormSection title="Categoría" icon={LayoutGrid} badge={initial.categoria ? 'Sugerida' : 'Opcional'}>
        <CategoryPicker categorias={categorias} selectedId={categoria?.id ?? null} onChange={setCategoria} />
      </FormSection>

      {extra}

      <Button label="Guardar gasto" onPress={handleSave} disabled={!isFormValid} loading={isSaving} />

      {footer?.(isSaving)}
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    scrollContent: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xl },
    currencyText: { ...TYPOGRAPHY.body2, color: colors.text },
    rateField: { marginTop: SPACING.sm },
    suggestions: { marginTop: SPACING.sm },
    suggestionsTitle: { ...TYPOGRAPHY.body2, color: colors.textSecondary, marginBottom: SPACING.xs },
    suggestionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
    suggestionChip: {
      minHeight: MIN_TOUCH,
      borderWidth: 1.5,
      borderRadius: RADIUS.pill,
      paddingHorizontal: SPACING.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    suggestionText: { ...TYPOGRAPHY.body2Strong, color: colors.primary, fontVariant: ['tabular-nums'] },
  });
