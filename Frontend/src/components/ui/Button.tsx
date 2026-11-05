import React from 'react';
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { MIN_TOUCH, RADIUS, SPACING, TYPOGRAPHY } from '../../theme/theme';

type Variant = 'primary' | 'secondary' | 'text' | 'destructive';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: LucideIcon;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Botones de la guía (sección 6): forma pill, 48dp mínimo; al procesar conserva su ancho. */
export default function Button({ label, onPress, variant = 'primary', icon: Icon, disabled, loading, style }: ButtonProps) {
  const { colors } = useTheme();
  const isInactive = !!disabled || !!loading;

  const palette = {
    primary: { bg: colors.accent, pressed: colors.accentPressed, fg: colors.onAccent, border: 'transparent' },
    secondary: { bg: 'transparent', pressed: colors.surfaceVariant, fg: colors.primary, border: colors.primary },
    text: { bg: 'transparent', pressed: colors.surfaceVariant, fg: colors.primary, border: 'transparent' },
    destructive: { bg: colors.error, pressed: colors.error, fg: colors.onError, border: 'transparent' },
  }[variant];

  const showDisabled = !!disabled && !loading;
  const fg = showDisabled ? colors.textSecondary : palette.fg;

  return (
    <Pressable
      onPress={onPress}
      disabled={isInactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isInactive, busy: !!loading }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: showDisabled
            ? colors.surfaceVariant
            : pressed
              ? palette.pressed
              : palette.bg,
          borderColor: showDisabled ? 'transparent' : palette.border,
        },
        style,
      ]}
    >
      <View style={[styles.content, loading && styles.hidden]}>
        {Icon && <Icon color={fg} size={20} />}
        <Text style={[styles.label, { color: fg }]}>{label}</Text>
      </View>
      {loading && <ActivityIndicator color={fg} style={StyleSheet.absoluteFill} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TOUCH,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs },
  hidden: { opacity: 0 },
  label: { ...TYPOGRAPHY.body1Strong, textAlign: 'center', flexShrink: 1 },
});
