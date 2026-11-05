import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { RADIUS, SPACING } from '../../theme/theme';

/** Tarjeta de la guía: en claro se eleva con sombra; en oscuro, solo con la superficie y un borde sutil. */
export default function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors, isDark } = useTheme();
  return (
    <View
      style={[
        { backgroundColor: colors.surface, borderRadius: RADIUS.lg, padding: SPACING.md },
        isDark
          ? { borderWidth: 1, borderColor: colors.divider }
          : {
              shadowColor: colors.heroStart,
              shadowOpacity: 0.1,
              shadowOffset: { width: 0, height: 4 },
              shadowRadius: 16,
              elevation: 2,
            },
        style,
      ]}
    >
      {children}
    </View>
  );
}
