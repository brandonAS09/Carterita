import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ChartPie, ChevronRight, Lightbulb, Minus, TrendingDown, TrendingUp } from 'lucide-react-native';
import { authService } from '../src/services/authService';
import { budgetService, Presupuesto } from '../src/services/budgetService';
import { transactionService } from '../src/services/transactionService';
import { CategoryIcon } from '../src/theme/categoryIcons';
import { useTheme, useThemedStyles } from '../src/theme/ThemeProvider';
import { CATEGORY_CHART_SLOTS, MIN_TOUCH, RADIUS, SPACING, ThemeColors, TYPOGRAPHY } from '../src/theme/theme';
import { round2 } from '../src/utils/currencyUtils';
import { diffInDays, toLocalDateKey } from '../src/utils/dateUtils';
import { buildDonutSlices, buildReport, getReportPeriods, PeriodKey, Report, ReportPeriod } from '../src/utils/reportCalculator';
import DonutChart from '../src/components/charts/DonutChart';
import DailyBars from '../src/components/charts/DailyBars';
import HeroHeader from '../src/components/ui/HeroHeader';
import Amount from '../src/components/ui/Amount';
import Button from '../src/components/ui/Button';
import Card from '../src/components/ui/Card';
import { Chip } from '../src/components/ui/Form';
import { EmptyState, ErrorState, Skeleton } from '../src/components/ui/States';

const MIN_DAYS_FOR_BARS = 2;
const LARGE_TEXT_SCALE = 1.3;

/** F10: en qué se va el dinero, sin dependencias nuevas y sin salir del teléfono. */
export default function ReportsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  // Con texto grande, el nombre va en su propio renglón para no cortarse
  const isLargeText = useWindowDimensions().fontScale >= LARGE_TEXT_SCALE;

  const [budget, setBudget] = useState<Presupuesto | null>(null);
  const [periods, setPeriods] = useState<ReportPeriod[]>([]);
  const [periodKey, setPeriodKey] = useState<PeriodKey | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const hasLoadedOnce = useRef(false);

  const load = useCallback(
    async (requested: PeriodKey | null) => {
      if (!hasLoadedOnce.current) setIsLoading(true);
      setLoadFailed(false);
      try {
        const session = await authService.getActiveSession();
        if (!session) {
          navigation.replace('Login');
          return;
        }
        const current = await budgetService.ensureCurrentCycle(session.id);
        if (!current) {
          navigation.replace('BudgetSetup');
          return;
        }
        const options = getReportPeriods(current.tipo_ciclo, current.fecha_inicio, current.fecha_fin, toLocalDateKey());
        // Si el ciclo cambió y el período elegido ya no existe, se usa el primero
        const period = options.find((p) => p.key === requested) ?? options[0];
        const [rows, previous] = await Promise.all([
          transactionService.getTransactionsBetween(session.id, period.from, period.to),
          transactionService.getTransactionsBetween(session.id, period.prevFrom, period.prevTo),
        ]);
        setBudget(current);
        setPeriods(options);
        setPeriodKey(period.key);
        setReport(buildReport(rows, previous, period));
        hasLoadedOnce.current = true;
      } catch (error) {
        console.error('Error cargando reportes:', error);
        setLoadFailed(true);
      } finally {
        setIsLoading(false);
      }
    },
    [navigation]
  );

  useFocusEffect(
    useCallback(() => {
      load(periodKey);
      // Al recibir el foco se conserva el período elegido
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load])
  );

  const moneda = budget?.moneda ?? 'MXN';
  const period = periods.find((p) => p.key === periodKey);
  const slices = useMemo(() => buildDonutSlices(report?.categories ?? []), [report]);

  const referenceLimit = useMemo(() => {
    if (!budget || !period?.isCycle) return null;
    return round2(budget.monto_base / (diffInDays(budget.fecha_inicio, budget.fecha_fin) + 1));
  }, [budget, period]);

  const renderChange = (data: Report) => {
    if (data.changePct === null) return null;
    const Icon = data.changePct > 0 ? TrendingUp : data.changePct < 0 ? TrendingDown : Minus;
    const text =
      data.changePct === 0
        ? 'Igual que el período anterior'
        : `${Math.abs(data.changePct)} % ${data.changePct > 0 ? 'más' : 'menos'} que el período anterior`;
    // Gastar no es un error: la comparación usa color neutro
    return (
      <View style={styles.changeRow}>
        <Icon color={colors.textSecondary} size={16} />
        <Text style={styles.secondaryText}>{text}</Text>
      </View>
    );
  };

  const renderBody = () => {
    if (isLoading) {
      return [120, 280, 200].map((height) => <Skeleton key={height} width="100%" height={height} style={styles.skeleton} />);
    }
    if (loadFailed || !report) {
      return <ErrorState message="No pudimos preparar tus reportes. Inténtalo de nuevo." onRetry={() => load(periodKey)} />;
    }
    if (report.total <= 0) {
      return (
        <EmptyState icon={ChartPie} message="No hay gastos en este período. Registra uno para ver tus reportes.">
          <Button label="Registrar gasto" onPress={() => navigation.navigate('AddExpense')} style={styles.emptyButton} />
        </EmptyState>
      );
    }
    return (
      <>
        <Card style={styles.card}>
          <Text style={styles.secondaryText}>Gastaste en total</Text>
          <Amount value={report.total} moneda={moneda} label="Gastaste en total" fit style={styles.totalAmount} />
          {renderChange(report)}
        </Card>

        {report.insights.map((insight) => (
          <View key={insight} style={styles.insight}>
            <Lightbulb color={colors.primary} size={18} />
            <Text style={styles.insightText}>{insight}</Text>
          </View>
        ))}

        <Card style={styles.card}>
          <Text style={styles.cardTitle} accessibilityRole="header">
            Gasto por categoría
          </Text>
          <DonutChart slices={slices} total={report.total} moneda={moneda} />
          <View style={styles.categoryList}>
            {report.categories.map((category) => {
              const slot = CATEGORY_CHART_SLOTS[category.nombre];
              return (
                <Pressable
                  key={category.id ?? 'sin-categoria'}
                  style={({ pressed }) => [styles.categoryRow, pressed && { backgroundColor: colors.surfaceVariant }]}
                  disabled={category.id === null}
                  onPress={() => navigation.navigate('History', { categoriaId: category.id })}
                  accessibilityRole={category.id === null ? undefined : 'button'}
                  accessibilityHint={category.id === null ? undefined : 'Abre el historial filtrado'}
                >
                  <View
                    style={[styles.swatch, { backgroundColor: slot === undefined ? colors.chartNeutral : colors.chart[slot] }]}
                  />
                  <CategoryIcon icono={category.icono} color={colors.textSecondary} size={18} />
                  <View style={[styles.categoryBody, isLargeText && styles.categoryBodyStacked]}>
                    <Text style={styles.categoryName}>{category.nombre}</Text>
                    <View style={styles.categoryValues}>
                      <Text style={styles.secondaryText}>{category.pct} %</Text>
                      <Amount value={category.total} moneda={moneda} style={styles.categoryAmount} />
                    </View>
                  </View>
                  <View style={styles.chevronSlot}>
                    {category.id !== null && <ChevronRight color={colors.textSecondary} size={18} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {report.days.length >= MIN_DAYS_FOR_BARS && (
          <Card style={styles.card}>
            <Text style={styles.cardTitle} accessibilityRole="header">
              Gasto por día
            </Text>
            <DailyBars days={report.days} moneda={moneda} referenceLimit={referenceLimit} />
          </Card>
        )}
      </>
    );
  };

  return (
    <View style={styles.screen}>
      <HeroHeader title="Reportes" />
      <ScrollView contentContainerStyle={styles.content}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.periods}
          contentContainerStyle={styles.periodsContent}
        >
          {periods.map((option) => (
            <Chip
              key={option.key}
              label={option.label}
              selected={option.key === periodKey}
              onPress={() => {
                setPeriodKey(option.key);
                load(option.key);
              }}
            />
          ))}
        </ScrollView>
        {renderBody()}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.lg },
    periods: { marginHorizontal: -SPACING.md, marginBottom: SPACING.sm, flexGrow: 0 },
    periodsContent: { gap: SPACING.xs, paddingHorizontal: SPACING.md },
    skeleton: { borderRadius: RADIUS.lg, marginBottom: SPACING.sm },
    emptyButton: { alignSelf: 'stretch', marginTop: SPACING.xs },
    card: { marginBottom: SPACING.sm },
    cardTitle: { ...TYPOGRAPHY.h3, color: colors.text, marginBottom: SPACING.sm },
    secondaryText: { ...TYPOGRAPHY.body2, color: colors.textSecondary },
    totalAmount: { ...TYPOGRAPHY.h1, color: colors.text },
    changeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    insight: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.xs,
      backgroundColor: colors.surfaceVariant,
      borderRadius: RADIUS.md,
      padding: SPACING.sm,
      marginBottom: SPACING.xs,
    },
    insightText: { ...TYPOGRAPHY.body2, color: colors.text, flex: 1 },
    categoryList: { marginTop: SPACING.sm },
    categoryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
      minHeight: MIN_TOUCH,
      borderRadius: RADIUS.sm,
      paddingVertical: 4,
    },
    swatch: { width: 12, height: 12, borderRadius: 3 },
    categoryBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
    categoryBodyStacked: { flexDirection: 'column', alignItems: 'flex-start', gap: 0 },
    categoryName: { ...TYPOGRAPHY.body2, color: colors.text, flexShrink: 1, flexGrow: 1 },
    categoryValues: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
    categoryAmount: { ...TYPOGRAPHY.body2Strong, color: colors.text },
    chevronSlot: { width: 18 },
  });
