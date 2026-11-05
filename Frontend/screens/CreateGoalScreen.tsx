import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Target, DollarSign, Shapes, CalendarClock } from 'lucide-react-native';
import { useTheme, useThemedStyles } from '../src/theme/ThemeProvider';
import { MIN_TOUCH, RADIUS, SPACING, ThemeColors, TYPOGRAPHY } from '../src/theme/theme';
import { authService } from '../src/services/authService';
import { budgetService } from '../src/services/budgetService';
import { goalService } from '../src/services/goalService';
import { GOAL_ICONS, DEFAULT_GOAL_ICON } from '../src/theme/goalIcons';
import { getCurrencySymbol } from '../src/utils/currencyUtils';
import { addDaysToKey, toLocalDateKey } from '../src/utils/dateUtils';
import HeroHeader from '../src/components/ui/HeroHeader';
import Button from '../src/components/ui/Button';
import TextField from '../src/components/ui/TextField';
import { Banner, Chip, FormSection } from '../src/components/ui/Form';

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
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
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
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.screen}>
      <HeroHeader title="Nueva Meta" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {errorMessage && <Banner tone="error" message={errorMessage} />}

        <FormSection title="¿Para qué estás ahorrando?" icon={Target}>
          <TextField
            accessibilityLabel="Nombre de la meta"
            placeholder="Ej: Vacaciones, Laptop nueva..."
            value={nombre}
            onChangeText={setNombre}
            onBlur={() => setTouched((t) => ({ ...t, nombre: true }))}
            maxLength={40}
            autoFocus
            error={touched.nombre && !isNombreValid ? 'Escribe un nombre para tu meta.' : null}
          />
        </FormSection>

        <FormSection title="¿Cuánto quieres juntar?" icon={DollarSign}>
          <TextField
            accessibilityLabel="Objetivo de la meta"
            amount
            prefix={getCurrencySymbol(moneda)}
            suffix={moneda}
            placeholder="0.00"
            keyboardType="decimal-pad"
            value={objetivoText}
            onChangeText={setObjetivoText}
            onBlur={() => setTouched((t) => ({ ...t, objetivo: true }))}
            error={touched.objetivo && !isObjetivoValid ? 'Ingresa un objetivo mayor a 0.' : null}
          />
        </FormSection>

        <FormSection title="Icono" icon={Shapes}>
          <View style={styles.iconGrid}>
            {GOAL_ICONS.map(({ key, label, Icon }) => {
              const isSelected = icono === key;
              return (
                <Pressable
                  key={key}
                  style={[styles.iconOption, isSelected && { backgroundColor: colors.primary }]}
                  onPress={() => setIcono(key)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={label}
                >
                  <Icon color={isSelected ? colors.onPrimary : colors.primary} size={24} />
                  <Text style={[styles.iconLabel, isSelected && { color: colors.onPrimary }]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </FormSection>

        <FormSection title="Fecha límite" icon={CalendarClock} badge="Opcional">
          <View style={styles.chipRow}>
            {PLAZOS.map((p) => (
              <Chip key={p.label} label={p.label} selected={plazoDays === p.days} onPress={() => setPlazoDays(p.days)} />
            ))}
          </View>
          {fechaLimite && <Text style={styles.dateHint}>Hasta el {formatDate(fechaLimite)}</Text>}
        </FormSection>

        <Button label="Crear Meta" onPress={handleCreate} disabled={!isFormValid} loading={isSaving} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    scrollContent: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xl },
    iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
    iconOption: {
      flexBasis: '22%',
      flexGrow: 1,
      minHeight: MIN_TOUCH,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      padding: SPACING.xs,
      borderRadius: RADIUS.md,
      backgroundColor: colors.surfaceVariant,
    },
    iconLabel: { ...TYPOGRAPHY.caption, color: colors.text, textAlign: 'center' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
    dateHint: { ...TYPOGRAPHY.body2, color: colors.textSecondary, marginTop: SPACING.xs },
  });
