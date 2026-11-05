import React, { useState } from 'react';
import { StyleProp, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { AlertCircle, type LucideIcon } from 'lucide-react-native';
import { useThemedStyles, useTheme } from '../../theme/ThemeProvider';
import { MIN_TOUCH, RADIUS, SPACING, ThemeColors, TYPOGRAPHY } from '../../theme/theme';

interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string | null;
  leftIcon?: LucideIcon;
  /** Texto fijo antes del valor, como "$". */
  prefix?: string;
  /** Texto fijo después del valor, como "MXN". */
  suffix?: string;
  /** Campo de monto: estilo `h1` y números tabulares. */
  amount?: boolean;
  rightAccessory?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
}

/** Input de la guía: etiqueta visible y bordes de reposo, foco y error. Sin altura fija para el 200 %. */
export default function TextField({
  label,
  error,
  leftIcon: LeftIcon,
  prefix,
  suffix,
  amount,
  rightAccessory,
  containerStyle,
  onFocus,
  onBlur,
  style,
  ...inputProps
}: TextFieldProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [isFocused, setIsFocused] = useState(false);

  const stateStyle = error ? styles.fieldError : isFocused ? styles.fieldFocused : null;
  const valueStyle = amount ? styles.amountText : styles.valueText;

  return (
    <View style={containerStyle}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.field, stateStyle]}>
        {LeftIcon && <LeftIcon color={colors.textSecondary} size={20} />}
        {prefix && <Text style={[valueStyle, styles.affix]}>{prefix}</Text>}
        <TextInput
          {...inputProps}
          accessibilityLabel={inputProps.accessibilityLabel ?? label}
          placeholderTextColor={colors.textSecondary}
          selectionColor={colors.primary}
          style={[styles.input, valueStyle, style]}
          onFocus={(event) => {
            setIsFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setIsFocused(false);
            onBlur?.(event);
          }}
        />
        {suffix && <Text style={styles.suffix}>{suffix}</Text>}
        {rightAccessory}
      </View>
      {!!error && (
        <View style={styles.errorRow}>
          <AlertCircle color={colors.error} size={14} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    label: { ...TYPOGRAPHY.body2Strong, color: colors.text, marginBottom: SPACING.xs },
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: MIN_TOUCH,
      backgroundColor: colors.surfaceVariant,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: SPACING.md,
      gap: SPACING.xs,
    },
    fieldFocused: { borderWidth: 2, borderColor: colors.primary, paddingHorizontal: SPACING.md - 1 },
    fieldError: { borderWidth: 2, borderColor: colors.error, paddingHorizontal: SPACING.md - 1 },
    input: { flex: 1, color: colors.text, paddingVertical: SPACING.xs },
    valueText: { ...TYPOGRAPHY.body1, color: colors.text },
    amountText: { ...TYPOGRAPHY.h1, color: colors.text, fontVariant: ['tabular-nums'] },
    affix: { color: colors.primary },
    suffix: { ...TYPOGRAPHY.body2Strong, color: colors.textSecondary },
    errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
    errorText: { ...TYPOGRAPHY.caption, color: colors.error, flex: 1 },
  });
