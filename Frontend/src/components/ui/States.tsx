import React, { useEffect, useRef } from 'react';
import { Animated, DimensionValue, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { AlertCircle, type LucideIcon } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { RADIUS, SPACING, TYPOGRAPHY } from '../../theme/theme';
import Button from './Button';

interface StateProps {
  icon: LucideIcon;
  title?: string;
  message: string;
  children?: React.ReactNode;
}

/** Estado vacío: una ilustración simple, una frase y, si aplica, una acción. */
export function EmptyState({ icon: Icon, title, message, children }: StateProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.state}>
      <View style={[styles.stateIcon, { backgroundColor: colors.surfaceVariant }]}>
        <Icon color={colors.primary} size={32} />
      </View>
      {title && <Text style={[TYPOGRAPHY.h3, styles.center, { color: colors.text }]}>{title}</Text>}
      <Text style={[TYPOGRAPHY.body2, styles.center, { color: colors.textSecondary }]}>{message}</Text>
      {children}
    </View>
  );
}

/** Estado de error: qué pasó y cómo resolverlo, con opción de reintentar. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.state}>
      <View style={[styles.stateIcon, { backgroundColor: colors.surfaceVariant }]}>
        <AlertCircle color={colors.error} size={32} />
      </View>
      <Text style={[TYPOGRAPHY.body2, styles.center, { color: colors.text }]}>{message}</Text>
      {onRetry && <Button label="Reintentar" variant="secondary" onPress={onRetry} />}
    </View>
  );
}

/** Esqueleto con la forma del contenido; pulsa mientras los datos cargan. */
export function Skeleton({ width, height, style }: { width: DimensionValue; height: number; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 600, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, backgroundColor: colors.surfaceVariant, borderRadius: RADIUS.sm, opacity }, style]}
    />
  );
}

const styles = StyleSheet.create({
  state: { alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.lg, paddingHorizontal: SPACING.md },
  stateIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
});
