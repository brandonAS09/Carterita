import React, { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTheme, useThemedStyles } from '../../theme/ThemeProvider';
import { MIN_TOUCH, RADIUS, SPACING, ThemeColors, TYPOGRAPHY } from '../../theme/theme';
import { buildMonthGrid, canGoToNextMonth, shiftMonth } from '../../utils/calendarUtils';
import { formatLongDate, toLocalDateKey } from '../../utils/dateUtils';
import Button from './Button';

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

interface DatePickerDialogProps {
  visible: boolean;
  value: string; // 'YYYY-MM-DD'
  onSelect: (dateKey: string) => void;
  onClose: () => void;
}

/** D21: calendario propio, sin librería nativa. Los días futuros no se pueden elegir. */
export default function DatePickerDialog({ visible, value, onSelect, onClose }: DatePickerDialogProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const hoy = toLocalDateKey();
  const [valueYear, valueMonth] = value.split('-').map(Number);
  const [shown, setShown] = useState({ year: valueYear, month: valueMonth });

  const weeks = useMemo(() => buildMonthGrid(shown.year, shown.month, hoy), [shown, hoy]);
  const monthName = new Date(shown.year, shown.month - 1, 1).toLocaleDateString('es-MX', { month: 'long' });
  const monthLabel = `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${shown.year}`;
  const canGoNext = canGoToNextMonth(shown.year, shown.month, hoy);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.dialog} accessibilityViewIsModal>
          <View style={styles.header}>
            <Pressable
              style={styles.navButton}
              onPress={() => setShown(shiftMonth(shown.year, shown.month, -1))}
              accessibilityRole="button"
              accessibilityLabel="Mes anterior"
            >
              <ChevronLeft color={colors.primary} size={24} />
            </Pressable>
            <Text style={styles.monthLabel} accessibilityRole="header">
              {monthLabel}
            </Text>
            <Pressable
              style={styles.navButton}
              onPress={() => setShown(shiftMonth(shown.year, shown.month, 1))}
              disabled={!canGoNext}
              accessibilityRole="button"
              accessibilityLabel="Mes siguiente"
              accessibilityState={{ disabled: !canGoNext }}
            >
              <ChevronRight color={canGoNext ? colors.primary : colors.divider} size={24} />
            </Pressable>
          </View>

          <View style={styles.week} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {WEEKDAYS.map((label, index) => (
              <Text key={index} style={styles.weekday}>
                {label}
              </Text>
            ))}
          </View>

          {weeks.map((week, weekIndex) => (
            <View key={weekIndex} style={styles.week}>
              {week.map((cell, dayIndex) => {
                if (!cell) return <View key={dayIndex} style={styles.dayCell} />;
                const isSelected = cell.key === value;
                return (
                  <Pressable
                    key={cell.key}
                    style={styles.dayCell}
                    disabled={cell.isFuture}
                    onPress={() => onSelect(cell.key)}
                    accessibilityRole="button"
                    accessibilityLabel={formatLongDate(cell.key)}
                    accessibilityState={{ selected: isSelected, disabled: cell.isFuture }}
                  >
                    <View style={[styles.dayCircle, isSelected && { backgroundColor: colors.primary }]}>
                      <Text
                        style={[
                          styles.dayText,
                          isSelected && { color: colors.onPrimary },
                          cell.key === hoy && !isSelected && styles.today,
                          cell.isFuture && styles.dayFuture,
                        ]}
                      >
                        {cell.day}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}

          <Button label="Cancelar" variant="text" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    overlay: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'center', paddingHorizontal: SPACING.md },
    dialog: { backgroundColor: colors.surface, borderRadius: RADIUS.xl, padding: SPACING.md, gap: 2 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.xs },
    navButton: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
    monthLabel: { ...TYPOGRAPHY.body1Strong, color: colors.text },
    week: { flexDirection: 'row' },
    weekday: { ...TYPOGRAPHY.caption, color: colors.textSecondary, flex: 1, textAlign: 'center' },
    dayCell: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    dayCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    dayText: { ...TYPOGRAPHY.body2, color: colors.text, fontVariant: ['tabular-nums'] },
    today: { ...TYPOGRAPHY.body2Strong, color: colors.primary },
    dayFuture: { color: colors.divider },
  });
