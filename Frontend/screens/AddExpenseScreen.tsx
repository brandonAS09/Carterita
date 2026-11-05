import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DollarSign, FileText, LayoutGrid } from 'lucide-react-native';
import { useTheme, useThemedStyles } from '../src/theme/ThemeProvider';
import { SPACING, ThemeColors, TYPOGRAPHY } from '../src/theme/theme';
import { authService } from '../src/services/authService';
import { budgetService } from '../src/services/budgetService';
import { transactionService, Categoria } from '../src/services/transactionService';
import { getCurrencySymbol } from '../src/utils/currencyUtils';
import { notifySuccess } from '../src/utils/feedback';
import { CategoryIcon } from '../src/theme/categoryIcons';
import CategoryPicker from '../src/components/CategoryPicker';
import HeroHeader from '../src/components/ui/HeroHeader';
import Button from '../src/components/ui/Button';
import TextField from '../src/components/ui/TextField';
import Card from '../src/components/ui/Card';
import { Banner, FormSection } from '../src/components/ui/Form';

export default function AddExpenseScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
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
      notifySuccess();
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
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.screen}>
      <HeroHeader title="Nuevo Gasto" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Caso negativo: SQLite falla */}
        {errorMessage && <Banner tone="error" message={errorMessage} />}
        {savedOk && <Banner tone="success" message="¡Gasto registrado!" />}

        <FormSection title="¿Cuánto gastaste?" icon={DollarSign}>
          <TextField
            accessibilityLabel="Monto del gasto"
            amount
            prefix={monedaSimbolo}
            placeholder="0.00"
            keyboardType="numeric"
            value={montoText}
            onChangeText={(v) => {
              setMontoText(v);
              if (errorMessage) setErrorMessage(null);
            }}
            onBlur={() => setTouchedMonto(true)}
            autoFocus
            error={touchedMonto && !isMontoValid ? 'Ingresa un monto mayor a 0.' : null}
          />
        </FormSection>

        <FormSection title="Categoría" icon={LayoutGrid} badge="Opcional">
          {loadingCats ? (
            <View style={styles.catsLoading}>
              <ActivityIndicator color={colors.primary} size="small" />
              <Text style={styles.secondaryText}>Cargando categorías...</Text>
            </View>
          ) : (
            <CategoryPicker
              categorias={categorias}
              selectedId={categoriaSeleccionada?.id ?? null}
              onChange={setCategoriaSeleccionada}
            />
          )}
        </FormSection>

        <FormSection title="¿En qué lo gastaste?" icon={FileText}>
          <TextField
            accessibilityLabel="Concepto del gasto"
            placeholder="Ej: Tacos, Uber, Netflix..."
            value={concepto}
            onChangeText={(v) => {
              setConcepto(v);
              if (errorMessage) setErrorMessage(null);
            }}
            onBlur={() => setTouchedConcepto(true)}
            maxLength={80}
            returnKeyType="done"
            error={touchedConcepto && !isConceptoValid ? 'Escribe al menos 2 caracteres para el concepto.' : null}
          />
        </FormSection>

        {isFormValid && (
          <Card>
            <Text style={styles.summaryLabel}>Resumen del gasto</Text>
            <Text style={styles.summaryAmount}>
              {monedaSimbolo}
              {parsedMonto.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
            <View style={styles.summaryRow}>
              <Text style={styles.secondaryText}>{concepto.trim()}</Text>
              {categoriaSeleccionada && (
                <>
                  <Text style={styles.secondaryText}>·</Text>
                  <CategoryIcon icono={categoriaSeleccionada.icono} color={colors.textSecondary} size={14} />
                  <Text style={styles.secondaryText}>{categoriaSeleccionada.nombre}</Text>
                </>
              )}
            </View>
          </Card>
        )}
      </ScrollView>

      {/* Botón fijo: sigue visible con el teclado abierto (Criterio F02: deshabilitado / indicador de carga) */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.sm }]}>
        <Button label="Registrar Gasto" onPress={handleSave} disabled={!isFormValid || savedOk} loading={isLoading} />
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    scrollContent: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.md },
    catsLoading: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
    secondaryText: { ...TYPOGRAPHY.body2, color: colors.textSecondary },
    summaryLabel: { ...TYPOGRAPHY.caption, color: colors.textSecondary },
    summaryAmount: { ...TYPOGRAPHY.h2, color: colors.text, fontVariant: ['tabular-nums'] },
    summaryRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
    footer: {
      paddingHorizontal: SPACING.md,
      paddingTop: SPACING.sm,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
  });
