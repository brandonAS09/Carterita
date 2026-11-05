import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { ChevronLeft } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { MIN_TOUCH, SPACING, TYPOGRAPHY } from '../../theme/theme';

type Variant = 'full' | 'home' | 'compact';

/** Zona inferior reservada para las ondas: ningún texto queda encima (R7 del Sprint 5). */
const WAVE_ZONE: Record<Variant, number> = { full: 72, home: 72, compact: 40 };
const MIN_HEIGHT: Record<Exclude<Variant, 'full'>, number> = { home: 280, compact: 120 };
const FULL_HEIGHT_RATIO = 0.45;
const COLLAPSED_FULL_HEIGHT = 160;

/** Onda de borde a borde. Los valores son fracciones de la zona, medidas desde abajo. */
const wavePath = (w: number, h: number, zone: number, [start, c1, c2, end]: number[]) => {
  const y = (fraction: number) => h - zone * fraction;
  return `M0 ${y(start)} C${w * 0.3} ${y(c1)} ${w * 0.6} ${y(c2)} ${w} ${y(end)} L${w} ${h} L0 ${h} Z`;
};

interface HeroHeaderProps {
  variant?: Variant;
  title?: string;
  onBack?: () => void;
  /** Acción a la derecha del título (solo en la variante compacta). */
  right?: React.ReactNode;
  /** Variante completa con el teclado abierto: se reduce para no tapar el formulario. */
  collapsed?: boolean;
  children?: React.ReactNode;
}

/** Elemento distintivo de la guía (sección 5): cabecera con gradiente que se funde con la pantalla. */
export default function HeroHeader({ variant = 'compact', title, onBack, right, collapsed, children }: HeroHeaderProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const [size, setSize] = useState({ width: 0, height: 0 });

  const zone = WAVE_ZONE[variant];
  let minHeight: number;
  if (variant === 'full') {
    minHeight = collapsed ? COLLAPSED_FULL_HEIGHT + insets.top : screenHeight * FULL_HEIGHT_RATIO;
  } else {
    minHeight = MIN_HEIGHT[variant] + insets.top;
  }

  return (
    <View
      style={[styles.container, { minHeight, paddingTop: insets.top + SPACING.xs, paddingBottom: zone }]}
      onLayout={({ nativeEvent: { layout } }) => setSize({ width: layout.width, height: layout.height })}
    >
      {size.width > 0 && (
        <View style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Svg width={size.width} height={size.height}>
            <Defs>
              <LinearGradient id="hero" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={colors.heroStart} />
                <Stop offset="1" stopColor={colors.heroEnd} />
              </LinearGradient>
            </Defs>
            <Rect width={size.width} height={size.height} fill="url(#hero)" />
            <Path d={wavePath(size.width, size.height, zone, [0.8, 1.05, 0.45, 0.7])} fill={colors.onHero} fillOpacity={0.08} />
            <Path d={wavePath(size.width, size.height, zone, [0.6, 0.95, 0.3, 0.75])} fill={colors.onHero} fillOpacity={0.12} />
            <Path d={wavePath(size.width, size.height, zone, [0.3, 0.75, 0.05, 0.45])} fill={colors.background} />
          </Svg>
        </View>
      )}

      {variant === 'compact' && (
        <View style={styles.compactRow}>
          {onBack ? (
            <Pressable
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel="Regresar"
              style={[styles.iconButton, { backgroundColor: colors.heroChip }]}
            >
              <ChevronLeft color={colors.onHero} size={24} />
            </Pressable>
          ) : (
            <View style={styles.iconSlot} />
          )}
          <Text style={[styles.title, { color: colors.onHero }]} accessibilityRole="header" numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.iconSlot}>{right}</View>
        </View>
      )}

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: SPACING.md, overflow: 'hidden' },
  compactRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  iconButton: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: MIN_TOUCH / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSlot: { width: MIN_TOUCH, minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  title: { ...TYPOGRAPHY.h3, flex: 1, textAlign: 'center' },
});
