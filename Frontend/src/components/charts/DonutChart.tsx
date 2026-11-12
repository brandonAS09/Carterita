import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeProvider';
import { TYPOGRAPHY } from '../../theme/theme';
import { formatAmount } from '../../utils/currencyUtils';
import type { DonutSlice } from '../../utils/reportCalculator';

const SIZE = 184;
const STROKE = 26;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP = 2; // separación entre rebanadas, del color de la superficie

export default function DonutChart({ slices, total, moneda }: { slices: DonutSlice[]; total: number; moneda: string }) {
  const { colors } = useTheme();

  let offset = 0;
  const summary = slices.map((slice) => `${slice.label}: ${formatAmount(slice.total, moneda)}`).join(', ');

  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Gasto por categoría. Total ${formatAmount(total, moneda)}. ${summary}`}
    >
      <Svg width={SIZE} height={SIZE}>
        {slices.map((slice) => {
          const length = total > 0 ? (slice.total / total) * CIRCUMFERENCE : 0;
          const dash = slices.length > 1 ? Math.max(length - GAP, 1) : length;
          const circle = (
            <Circle
              key={slice.key}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={slice.slot === null ? colors.chartNeutral : colors.chart[slice.slot]}
              strokeWidth={STROKE}
              strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
              strokeDashoffset={-offset}
              rotation={-90}
              originX={SIZE / 2}
              originY={SIZE / 2}
            />
          );
          offset += length;
          return circle;
        })}
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <Text style={[TYPOGRAPHY.caption, { color: colors.textSecondary }]}>Total</Text>
        <Text
          style={[TYPOGRAPHY.body1Strong, styles.total, { color: colors.text }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {formatAmount(total, moneda)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: SIZE, height: SIZE, alignSelf: 'center' },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: STROKE + 8 },
  total: { fontVariant: ['tabular-nums'] },
});
