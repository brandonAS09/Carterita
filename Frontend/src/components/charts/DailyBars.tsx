import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeProvider';
import { TYPOGRAPHY } from '../../theme/theme';
import { formatAmount } from '../../utils/currencyUtils';
import { formatLongDate, formatShortDate } from '../../utils/dateUtils';
import type { DayTotal } from '../../utils/reportCalculator';

const HEIGHT = 140;
const MAX_BAR_WIDTH = 24;
const BAR_GAP = 2;
const CORNER = 4;
const MIN_VISIBLE_BAR = 3;

/** Barra con extremo superior redondeado y base recta. */
const barPath = (x: number, width: number, top: number, bottom: number) => {
  const r = Math.min(CORNER, width / 2, bottom - top);
  return `M${x} ${bottom} L${x} ${top + r} Q${x} ${top} ${x + r} ${top} L${x + width - r} ${top} Q${x + width} ${top} ${x + width} ${top + r} L${x + width} ${bottom} Z`;
};

interface DailyBarsProps {
  days: DayTotal[];
  moneda: string;
  /** Límite diario base, como línea de referencia en los períodos de ciclo. */
  referenceLimit?: number | null;
}

export default function DailyBars({ days, moneda, referenceLimit }: DailyBarsProps) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => setSelected(null), [days]);

  const { maxValue, busiest } = useMemo(() => {
    const top = days.reduce((best, day) => (day.total > best.total ? day : best), days[0]);
    return { maxValue: Math.max(top?.total ?? 0, referenceLimit ?? 0), busiest: top };
  }, [days, referenceLimit]);

  const slot = width > 0 && days.length > 0 ? width / days.length : 0;
  const barWidth = Math.max(Math.min(slot - BAR_GAP, MAX_BAR_WIDTH), 1);
  const yFor = (value: number) => HEIGHT - (maxValue > 0 ? (value / maxValue) * (HEIGHT - 4) : 0);

  const selectedDay = selected !== null ? days[selected] : null;

  return (
    <View>
      {/* En el teléfono no hay "hover": tocar una barra muestra su valor exacto */}
      <Text style={[TYPOGRAPHY.body2, { color: colors.text }]} accessibilityLiveRegion="polite">
        {selectedDay
          ? `${formatLongDate(selectedDay.day)}: ${formatAmount(selectedDay.total, moneda)}`
          : 'Toca una barra para ver el monto del día'}
      </Text>

      <Pressable
        style={styles.plot}
        onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)}
        onPress={({ nativeEvent }) => {
          if (slot > 0) setSelected(Math.min(Math.floor(nativeEvent.locationX / slot), days.length - 1));
        }}
        accessible
        accessibilityRole="image"
        accessibilityLabel={
          busiest && busiest.total > 0
            ? `Gasto por día. El día con más gasto fue ${formatLongDate(busiest.day)}, con ${formatAmount(busiest.total, moneda)}`
            : 'Gasto por día, sin gastos en este período'
        }
      >
        {width > 0 && (
          <Svg width={width} height={HEIGHT}>
            <Line x1={0} x2={width} y1={HEIGHT - 0.5} y2={HEIGHT - 0.5} stroke={colors.divider} strokeWidth={1} />
            {days.map((day, index) => {
              if (day.total <= 0) return null;
              const top = Math.min(yFor(day.total), HEIGHT - MIN_VISIBLE_BAR);
              const x = index * slot + (slot - barWidth) / 2;
              const isDimmed = selected !== null && selected !== index;
              return (
                <Path key={day.day} d={barPath(x, barWidth, top, HEIGHT - 1)} fill={colors.primary} fillOpacity={isDimmed ? 0.4 : 1} />
              );
            })}
            {!!referenceLimit && referenceLimit > 0 && (
              <Line
                x1={0}
                x2={width}
                y1={yFor(referenceLimit)}
                y2={yFor(referenceLimit)}
                stroke={colors.textSecondary}
                strokeWidth={1}
              />
            )}
          </Svg>
        )}
      </Pressable>

      {days.length > 0 && (
        <View style={styles.axis} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Text style={[TYPOGRAPHY.caption, { color: colors.textSecondary }]}>{formatShortDate(days[0].day)}</Text>
          <Text style={[TYPOGRAPHY.caption, { color: colors.textSecondary }]}>{formatShortDate(days[days.length - 1].day)}</Text>
        </View>
      )}
      {!!referenceLimit && referenceLimit > 0 && (
        <Text style={[TYPOGRAPHY.caption, styles.legend, { color: colors.textSecondary }]}>
          La línea marca tu límite diario base: {formatAmount(referenceLimit, moneda)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  plot: { height: HEIGHT, marginTop: 8 },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  legend: { marginTop: 4 },
});
