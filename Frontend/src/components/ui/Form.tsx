import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, type LucideIcon } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { MIN_TOUCH, RADIUS, SPACING, TYPOGRAPHY } from '../../theme/theme';
import { useReducedMotion } from '../../utils/useReducedMotion';
import Card from './Card';

interface FormSectionProps {
  title: string;
  icon?: LucideIcon;
  /** Nota a la derecha del título, como "Opcional". */
  badge?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Tarjeta con título para agrupar los campos de un formulario. */
export function FormSection({ title, icon: Icon, badge, children, style }: FormSectionProps) {
  const { colors } = useTheme();
  return (
    <Card style={[styles.section, style]}>
      <View style={styles.sectionHeader}>
        {Icon && <Icon color={colors.primary} size={20} />}
        <Text style={[TYPOGRAPHY.body1Strong, styles.sectionTitle, { color: colors.text }]} accessibilityRole="header">
          {title}
        </Text>
        {badge && <Text style={[TYPOGRAPHY.caption, { color: colors.textSecondary }]}>{badge}</Text>}
      </View>
      {children}
    </Card>
  );
}

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  /** Texto secundario debajo de la etiqueta. */
  description?: string;
  style?: StyleProp<ViewStyle>;
}

/** Opción seleccionable: la selección se indica con color y con el estado para lector de pantalla. */
export function Chip({ label, selected, onPress, description, style }: ChipProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: !!selected }}
      style={[
        description ? styles.choice : styles.chip,
        { backgroundColor: selected ? colors.primary : colors.surfaceVariant },
        style,
      ]}
    >
      <Text style={[TYPOGRAPHY.body2Strong, styles.center, { color: selected ? colors.onPrimary : colors.text }]}>{label}</Text>
      {description && (
        <Text style={[TYPOGRAPHY.caption, styles.center, { color: selected ? colors.onPrimary : colors.textSecondary }]}>
          {description}
        </Text>
      )}
    </Pressable>
  );
}

type Tone = 'error' | 'warning' | 'success' | 'info';

const TONE_ICON: Record<Tone, LucideIcon> = { error: AlertCircle, warning: AlertTriangle, success: CheckCircle2, info: Info };

/** Aviso dentro de una pantalla: el tono se comunica con ícono y texto, no solo con color. */
export function Banner({
  tone,
  message,
  action,
  style,
}: {
  tone: Tone;
  message: string;
  action?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const toneColor = { error: colors.error, warning: colors.warning, success: colors.success, info: colors.textSecondary }[tone];
  const Icon = TONE_ICON[tone];
  return (
    <View
      accessibilityRole={tone === 'error' ? 'alert' : undefined}
      style={[styles.banner, { backgroundColor: colors.surfaceVariant }, style]}
    >
      <Icon color={tone === 'info' ? colors.primary : toneColor} size={20} />
      <Text style={[TYPOGRAPHY.body2, styles.bannerText, { color: tone === 'info' ? colors.text : toneColor }]}>{message}</Text>
      {action}
    </View>
  );
}

const FILL_DURATION = 400;

/** Barra de progreso que se llena en 400ms, o de golpe si está activado "reducir movimiento". */
export function ProgressBar({ progress, color }: { progress: number; color: string }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const value = Math.min(Math.max(progress, 0), 1);
  const fill = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      fill.setValue(value);
      return;
    }
    Animated.timing(fill, { toValue: value, duration: FILL_DURATION, useNativeDriver: false }).start();
  }, [value, reduceMotion, fill]);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      style={[styles.track, { backgroundColor: colors.surfaceVariant }]}
    >
      <Animated.View
        style={[
          styles.fill,
          { backgroundColor: color, width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: SPACING.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginBottom: SPACING.sm },
  sectionTitle: { flex: 1 },
  chip: {
    minHeight: MIN_TOUCH,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choice: {
    minHeight: MIN_TOUCH,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    gap: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { textAlign: 'center' },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.xs,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  bannerText: { flex: 1 },
  track: { height: 8, borderRadius: RADIUS.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: RADIUS.pill },
});
