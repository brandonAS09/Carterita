import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Wallet, type LucideIcon } from 'lucide-react-native';
import { useTheme, useThemedStyles } from '../../theme/ThemeProvider';
import { MIN_TOUCH, RADIUS, SPACING, ThemeColors, TYPOGRAPHY } from '../../theme/theme';
import { CategoryIcon } from '../../theme/categoryIcons';
import Amount from './Amount';

/** Logo: cartera y nombre de la app, siempre sobre el gradiente. */
export function Logo({ size = 'small' }: { size?: 'small' | 'large' }) {
  const { colors } = useTheme();
  const isLarge = size === 'large';
  return (
    <View style={[styles.logo, isLarge && styles.logoLarge]} accessible accessibilityLabel="Carterita">
      <Wallet color={colors.onHero} size={isLarge ? 48 : 24} />
      <Text style={[isLarge ? TYPOGRAPHY.h1 : TYPOGRAPHY.h3, { color: colors.onHero }]}>Carterita</Text>
    </View>
  );
}

const getInitials = (nombre: string) =>
  nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

export function Avatar({ nombre, onPress }: { nombre: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Abrir ajustes"
      style={[styles.avatar, { backgroundColor: colors.heroChip }]}
    >
      <Text style={[TYPOGRAPHY.body1Strong, { color: colors.onHero }]}>{getInitials(nombre) || 'C'}</Text>
    </Pressable>
  );
}

interface SummaryTileProps {
  label: string;
  value: number;
  moneda: string;
  backgroundColor: string;
  onPress?: () => void;
  accessibilityHint?: string;
}

/** Mosaico de resumen: siempre con contenido blanco sobre un color de marca. */
export function SummaryTile({ label, value, moneda, backgroundColor, onPress, accessibilityHint }: SummaryTileProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityHint={accessibilityHint}
      style={[styles.tile, { backgroundColor }]}
    >
      <Text style={[TYPOGRAPHY.caption, { color: colors.onHero }]}>{label}</Text>
      <Amount value={value} moneda={moneda} label={label} style={[TYPOGRAPHY.body1Strong, { color: colors.onHero }]} />
    </Pressable>
  );
}

export function QuickAction({ label, icon: Icon, onPress }: { label: string; icon: LucideIcon; onPress: () => void }) {
  const { colors } = useTheme();
  const themed = useThemedStyles(createStyles);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Registrar gasto: ${label}`}
      style={({ pressed }) => [themed.quickAction, pressed && { backgroundColor: colors.surfaceVariant }]}
    >
      <View style={themed.quickIcon}>
        <Icon color={colors.primary} size={24} />
      </View>
      {/* Con texto grande reduce su tamaño en lugar de partir la palabra */}
      <Text
        style={[TYPOGRAPHY.body2Strong, { color: colors.text }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
      >
        {label}
      </Text>
    </Pressable>
  );
}

interface TransactionRowProps {
  concepto: string;
  subtitle: string;
  monto: number;
  moneda: string;
  icono?: string | null;
}

/** Fila de gasto: el monto usa color neutro y signo menos (sección 2.2 de la guía). */
export function TransactionRow({ concepto, subtitle, monto, moneda, icono }: TransactionRowProps) {
  const { colors } = useTheme();
  const themed = useThemedStyles(createStyles);
  return (
    <View style={themed.row}>
      <View style={themed.rowIcon}>
        <CategoryIcon icono={icono} color={colors.primary} size={20} />
      </View>
      <View style={styles.rowText}>
        <Text style={[TYPOGRAPHY.body1, { color: colors.text }]} numberOfLines={1}>
          {concepto}
        </Text>
        <Text style={[TYPOGRAPHY.body2, { color: colors.textSecondary }]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Amount value={monto} moneda={moneda} sign="minus" style={[TYPOGRAPHY.body1Strong, { color: colors.text }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  logo: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  logoLarge: { flexDirection: 'column', gap: SPACING.sm },
  avatar: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: MIN_TOUCH / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tile: { flexGrow: 1, minWidth: 108, borderRadius: RADIUS.md, padding: SPACING.sm, gap: 4 },
  rowText: { flex: 1 },
});

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    quickAction: {
      flex: 1,
      alignItems: 'center',
      gap: SPACING.xs,
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.xs,
    },
    quickIcon: {
      width: MIN_TOUCH,
      height: MIN_TOUCH,
      borderRadius: MIN_TOUCH / 2,
      backgroundColor: colors.surfaceVariant,
      alignItems: 'center',
      justifyContent: 'center',
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.xs },
    rowIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surfaceVariant,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
