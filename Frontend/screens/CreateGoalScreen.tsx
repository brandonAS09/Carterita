import React, { useEffect, useState } from 'react';
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
import { ChevronLeft, Target, DollarSign, Shapes, CalendarClock, AlertCircle } from 'lucide-react-native';
import { COLORS, SIZES } from '../src/theme/theme';
import { authService } from '../src/services/authService';
import { budgetService } from '../src/services/budgetService';
import { goalService } from '../src/services/goalService';
import { GOAL_ICONS, DEFAULT_GOAL_ICON } from '../src/theme/goalIcons';
import { getCurrencySymbol } from '../src/utils/currencyUtils';
import { addDaysToKey, toLocalDateKey } from '../src/utils/dateUtils';

const PLAZOS: { label: string; days: number | null }[] = [
  { label: 'Sin fecha', days: null },
  { label: '1 mes', days: 30 },
  { label: '3 meses', days: 90 },
  { label: '6 meses', days: 180 },
  { label: '1 año', days: 365 },
];

const formatDate = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
};

/** F07 - Crear meta de ahorro. */
export default function CreateGoalScreen({ navigation }: any) {
  const [userId, setUserId] = useState<number | null>(null);
  const [moneda, setMoneda] = useState('MXN');

  const [nombre, setNombre] = useState('');
  const [objetivoText, setObjetivoText] = useState('');
  const [icono, setIcono] = useState(DEFAULT_GOAL_ICON);
  const [plazoDays, setPlazoDays] = useState<number | null>(null);
  const [touched, setTouched] = useState({ nombre: false, objetivo: false });

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const session = await authService.getActiveSession();
      if (!session) {
        navigation.replace('Login');
        return;
      }
      setUserId(session.id);
      const budget = await budgetService.getBudgetByUserId(session.id);
      if (budget) setMoneda(budget.moneda);
    })();
  }, [navigation]);

  // Escenario 3: botón deshabilitado si el nombre está vacío o el objetivo es <= 0
  const objetivo = parseFloat(objetivoText.replace(/,/g, ''));
  const isNombreValid = nombre.trim().length > 0;
  const isObjetivoValid = !isNaN(objetivo) && isFinite(objetivo) && objetivo > 0;
  const isFormValid = isNombreValid && isObjetivoValid && userId !== null;

  const fechaLimite = plazoDays === null ? null : addDaysToKey(toLocalDateKey(), plazoDays);

  const handleCreate = async () => {
    if (!isFormValid || isSaving || !userId) return;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      await goalService.createGoal(userId, { nombre, montoObjetivo: objetivo, icono, fechaLimite });
      navigation.goBack();
    } catch (error) {
      console.error('Error al crear meta:', error);
      setErrorMessage('Ocurrió un error al crear la meta. Inténtalo de nuevo.');
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.navBar}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <ChevronLeft color={COLORS.text} size={24} />
          </TouchableOpacity>
          <Text style={styles.navTitle}>Nueva Meta</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {errorMessage && (
            <View style={styles.errorBanner}>
              <AlertCircle color={COLORS.error} size={20} />
              <Text style={styles.errorBannerText}>{errorMessage}</Text>
            </View>
          )}

          {/* Nombre */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Target color={COLORS.secondary} size={18} />
              <Text style={styles.sectionTitle}>¿Para qué estás ahorrando?</Text>
            </View>
            <View style={[styles.inputWrapper, touched.nombre && !isNombreValid && styles.inputError]}>
              <TextInput
                style={styles.textInput}
                placeholder="Ej: Vacaciones, Laptop nueva..."
                placeholderTextColor={COLORS.textSecondary}
                value={nombre}
                onChangeText={setNombre}
                onBlur={() => setTouched((t) => ({ ...t, nombre: true }))}
                maxLength={40}
                autoFocus
              />
            </View>
            {touched.nombre && !isNombreValid && <Text style={styles.fieldError}>Escribe un nombre para tu meta.</Text>}
          </View>

          {/* Objetivo */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <DollarSign color={COLORS.secondary} size={18} />
              <Text style={styles.sectionTitle}>¿Cuánto quieres juntar?</Text>
            </View>
            <View style={[styles.amountWrapper, touched.objetivo && !isObjetivoValid && styles.inputError]}>
              <Text style={styles.currencyPrefix}>{getCurrencySymbol(moneda)}</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0.00"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="decimal-pad"
                value={objetivoText}
                onChangeText={setObjetivoText}
                onBlur={() => setTouched((t) => ({ ...t, objetivo: true }))}
              />
              <Text style={styles.currencySuffix}>{moneda}</Text>
            </View>
            {touched.objetivo && !isObjetivoValid && (
              <Text style={styles.fieldError}>Ingresa un objetivo mayor a 0.</Text>
            )}
          </View>

          {/* Icono */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Shapes color={COLORS.secondary} size={18} />
              <Text style={styles.sectionTitle}>Icono</Text>
            </View>
            <View style={styles.iconGrid}>
              {GOAL_ICONS.map(({ key, label, Icon }) => {
                const isSelected = icono === key;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.iconOption, isSelected && styles.iconOptionSelected]}
                    onPress={() => setIcono(key)}
                    activeOpacity={0.8}
                    accessibilityLabel={label}
                  >
                    <Icon color={isSelected ? COLORS.text : COLORS.secondary} size={24} />
                    <Text style={[styles.iconLabel, isSelected && styles.iconLabelSelected]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Fecha límite */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <CalendarClock color={COLORS.secondary} size={18} />
              <Text style={styles.sectionTitle}>Fecha límite</Text>
              <Text style={styles.optionalBadge}>Opcional</Text>
            </View>
            <View style={styles.chipRow}>
              {PLAZOS.map((p) => {
                const isSelected = plazoDays === p.days;
                return (
                  <TouchableOpacity
                    key={p.label}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                    onPress={() => setPlazoDays(p.days)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{p.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {fechaLimite && <Text style={styles.dateHint}>Hasta el {formatDate(fechaLimite)}</Text>}
          </View>

          <TouchableOpacity
            style={[styles.saveButton, !isFormValid && styles.saveButtonDisabled]}
            onPress={handleCreate}
            disabled={!isFormValid || isSaving}
            activeOpacity={0.8}
          >
            {isSaving ? (
              <ActivityIndicator color={COLORS.background} size="small" />
            ) : (
              <Text style={[styles.saveButtonText, !isFormValid && styles.saveButtonTextDisabled]}>Crear Meta</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
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
  scrollContent: {
    paddingHorizontal: SIZES.spacing.lg,
    paddingTop: SIZES.spacing.md,
    paddingBottom: SIZES.spacing.xl,
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
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: SIZES.spacing.xs, marginBottom: SIZES.spacing.sm },
  sectionTitle: { color: COLORS.text, fontSize: SIZES.body1, fontWeight: '600', flex: 1 },
  optionalBadge: { color: COLORS.textSecondary, fontSize: 11, fontStyle: 'italic' },
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
  inputError: { borderColor: COLORS.error },
  fieldError: { color: COLORS.error, fontSize: 12, marginTop: 6, marginLeft: 4 },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.spacing.xs },
  iconOption: {
    width: '23%',
    flexGrow: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: SIZES.spacing.sm,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: SIZES.radius.button,
  },
  iconOptionSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.secondary },
  iconLabel: { color: COLORS.textSecondary, fontSize: 11 },
  iconLabelSelected: { color: COLORS.text, fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.spacing.xs },
  chip: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: SIZES.radius.button,
    paddingHorizontal: SIZES.spacing.sm,
    paddingVertical: 8,
  },
  chipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.secondary },
  chipText: { color: COLORS.textSecondary, fontSize: SIZES.body2, fontWeight: '500' },
  chipTextSelected: { color: COLORS.text, fontWeight: '700' },
  dateHint: { color: COLORS.textSecondary, fontSize: 12, marginTop: SIZES.spacing.xs },
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
