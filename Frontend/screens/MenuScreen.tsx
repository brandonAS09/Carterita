import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Animated, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertCircle, Camera, Mic, PackageOpen, PenLine, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react-native';
import { authService } from '../src/services/authService';
import { goalService } from '../src/services/goalService';
import { smartBudgetService, TodayBudgetSummary } from '../src/services/smartBudgetService';
import { transactionService, Transaccion } from '../src/services/transactionService';
import { useTheme, useThemedStyles } from '../src/theme/ThemeProvider';
import { RADIUS, SPACING, ThemeColors, TYPOGRAPHY } from '../src/theme/theme';
import { formatAmount } from '../src/utils/currencyUtils';
import { formatDayLabel, formatLongDate } from '../src/utils/dateUtils';
import { groupByDay } from '../src/utils/historyUtils';
import HeroHeader from '../src/components/ui/HeroHeader';
import { CountingAmount } from '../src/components/ui/Amount';
import Button from '../src/components/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '../src/components/ui/States';
import { Avatar, Logo, QuickAction, SummaryTile, TransactionRow } from '../src/components/ui/HomeBlocks';

const RECENT_LIMIT = 5;
const TILE_OVERLAP = -20;
const STATUS_SCRIM_SCROLL = 60;

interface DashboardData extends TodayBudgetSummary {
  gastadoCiclo: number;
  excedente: number;
  recientes: Transaccion[];
}

/** Estado del presupuesto en lenguaje simple (F06, sección 7 de la guía). */
const getBudgetChip = (data: DashboardData): { icon: LucideIcon; text: string } | null => {
  if (data.cicloAgotado) {
    return { icon: AlertCircle, text: `Agotaste este ciclo. Se renueva el ${formatLongDate(data.fechaRenovacion)}` };
  }
  if (data.disponibleHoy < 0) {
    return { icon: AlertCircle, text: `Te pasaste ${formatAmount(data.disponibleHoy, data.presupuesto.moneda)} hoy` };
  }
  if (data.ajuste === 'alza') return { icon: TrendingUp, text: 'Ahorraste: tu límite de hoy subió' };
  if (data.ajuste === 'baja') return { icon: TrendingDown, text: 'Tu límite de hoy se ajustó' };
  return null;
};

const formatTime = (fecha: string) =>
  new Date(fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

export default function MenuScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();

  const [userName, setUserName] = useState('');
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const hasLoadedOnce = useRef(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  // mode: 'initial' → esqueleto | 'refresh' → jalar para recargar | 'silent' → al volver a la pantalla
  const loadDashboard = useCallback(
    async (mode: 'initial' | 'refresh' | 'silent' = 'initial') => {
      try {
        if (mode === 'refresh') setIsRefreshing(true);
        else if (mode === 'initial') setIsLoading(true);
        setLoadFailed(false);

        const session = await authService.getActiveSession();
        if (!session) {
          navigation.replace('Login');
          return;
        }
        setUserName(session.nombre);

        // Presupuesto + Recálculo Inteligente (F06), con renovación automática del ciclo
        const summary = await smartBudgetService.getTodaySummary(session.id);
        if (!summary) {
          navigation.replace('BudgetSetup');
          return;
        }

        const [recientes, gastadoCiclo, surplus] = await Promise.all([
          transactionService.getRecentTransactions(session.id, RECENT_LIMIT),
          transactionService.getCycleTotal(session.id, summary.presupuesto.fecha_inicio, summary.presupuesto.fecha_fin),
          goalService.getYesterdaySurplus(session.id),
        ]);

        // Un excedente que ya se movió a una meta deja de estar disponible
        const excedente = surplus && !surplus.movido ? surplus.monto : 0;
        setData({ ...summary, gastadoCiclo, excedente, recientes });
        hasLoadedOnce.current = true;
      } catch (error) {
        console.error('Error cargando el dashboard:', error);
        setLoadFailed(true);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [navigation]
  );

  // Recarga cada vez que la pantalla recibe el foco (Criterio F02 Esc. 1)
  useFocusEffect(
    useCallback(() => {
      loadDashboard(hasLoadedOnce.current ? 'silent' : 'initial');
    }, [loadDashboard])
  );

  const moneda = data?.presupuesto.moneda ?? 'MXN';
  const chip = data ? getBudgetChip(data) : null;
  const groups = useMemo(() => groupByDay(data?.recientes ?? []), [data?.recientes]);

  const statusScrimOpacity = scrollY.interpolate({
    inputRange: [0, STATUS_SCRIM_SCROLL],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const renderHeroBody = () => {
    if (isLoading) {
      return (
        <View style={styles.heroBody}>
          <Skeleton width={120} height={16} />
          <Skeleton width={220} height={48} />
          <Skeleton width={260} height={16} />
        </View>
      );
    }
    if (!data) return null;
    return (
      <View style={styles.heroBody}>
        <Text style={styles.heroLabel}>Disponible hoy</Text>
        <CountingAmount
          value={data.disponibleHoy}
          moneda={moneda}
          label="Disponible hoy"
          fit
          style={[TYPOGRAPHY.display, { color: colors.onHero }]}
        />
        <Text style={styles.heroLine}>
          Gastado hoy {formatAmount(data.gastadoHoy, moneda)} de {formatAmount(data.limiteHoy, moneda)} ·{' '}
          {data.diasRestantes === 1 ? 'Queda 1 día' : `Quedan ${data.diasRestantes} días`}
        </Text>
        {chip && (
          <View style={styles.chip}>
            <chip.icon color={colors.onHero} size={16} />
            <Text style={styles.chipText}>{chip.text}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderTransactions = () => {
    if (isLoading) {
      return [1, 2, 3].map((i) => (
        <View key={i} style={styles.skeletonRow}>
          <Skeleton width={40} height={40} style={styles.skeletonIcon} />
          <View style={styles.skeletonText}>
            <Skeleton width="70%" height={14} />
            <Skeleton width="40%" height={12} />
          </View>
          <Skeleton width={64} height={14} />
        </View>
      ));
    }
    if (groups.length === 0) {
      return <EmptyState icon={PackageOpen} message="Aún no hay gastos. Registra el primero en segundos." />;
    }
    return groups.map((group) => (
      <View key={group.day}>
        <Text style={styles.dayLabel}>{formatDayLabel(group.day)}</Text>
        {group.items.map((tx) => (
          <TransactionRow
            key={tx.id}
            concepto={tx.concepto}
            subtitle={`${tx.categoria_nombre ?? 'Sin categoría'} · ${formatTime(tx.fecha)}`}
            monto={tx.monto}
            moneda={moneda}
            icono={tx.categoria_icono}
          />
        ))}
      </View>
    ));
  };

  return (
    <View style={styles.screen}>
      <Animated.ScrollView
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadDashboard('refresh')}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        <HeroHeader variant="home">
          <View style={styles.heroTop}>
            <View>
              <Logo />
              <Text style={styles.heroGreeting}>Hola, {userName || 'Usuario'}</Text>
            </View>
            <Avatar nombre={userName} onPress={() => navigation.navigate('Settings')} />
          </View>
          {renderHeroBody()}
        </HeroHeader>

        {loadFailed && !data ? (
          <ErrorState
            message="No pudimos cargar tu información. Revisa de nuevo en un momento."
            onRetry={() => loadDashboard('initial')}
          />
        ) : (
          <View style={styles.body}>
            {data && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.tilesScroll}
                contentContainerStyle={styles.tiles}
              >
                <SummaryTile
                  label="Presupuesto"
                  value={data.presupuesto.monto_base}
                  moneda={moneda}
                  backgroundColor={colors.tileBudget}
                  accessibilityHint="Abre la edición del presupuesto"
                  onPress={() => navigation.navigate('BudgetSetup', { mode: 'edit' })}
                />
                <SummaryTile label="Gastado" value={data.gastadoCiclo} moneda={moneda} backgroundColor={colors.tileSpent} />
                <SummaryTile
                  label="Excedente"
                  value={data.excedente}
                  moneda={moneda}
                  backgroundColor={colors.tileSaved}
                  accessibilityHint="Abre tus metas de ahorro"
                  onPress={() => navigation.navigate('Metas')}
                />
              </ScrollView>
            )}

            <View style={styles.quickActions}>
              <QuickAction label="Manual" icon={PenLine} onPress={() => navigation.navigate('AddExpense')} />
              <QuickAction label="Voz" icon={Mic} onPress={() => navigation.navigate('VoiceExpense')} />
              <QuickAction label="Escanear" icon={Camera} onPress={() => navigation.navigate('ScannerExpense')} />
            </View>

            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle} accessibilityRole="header">
                Últimas transacciones
              </Text>
              <Button label="Ver todo" variant="text" onPress={() => navigation.navigate('History')} />
            </View>
            <View style={styles.transactions}>{renderTransactions()}</View>
          </View>
        )}
      </Animated.ScrollView>

      {/* Al desplazar, la barra de estado conserva un fondo oscuro para que sus iconos claros se lean */}
      <Animated.View
        pointerEvents="none"
        style={[styles.statusScrim, { height: insets.top, opacity: statusScrimOpacity }]}
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    scrollContent: { paddingBottom: SPACING.lg },
    heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
    heroGreeting: { ...TYPOGRAPHY.body2, color: colors.onHeroSecondary, marginTop: 2 },
    heroBody: { marginTop: SPACING.md, gap: 4 },
    heroLabel: { ...TYPOGRAPHY.body2Strong, color: colors.onHeroSecondary },
    heroLine: { ...TYPOGRAPHY.body2, color: colors.onHeroSecondary },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      marginTop: SPACING.xs,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 6,
      borderRadius: RADIUS.pill,
      backgroundColor: colors.heroChip,
      maxWidth: '100%',
    },
    chipText: { ...TYPOGRAPHY.body2Strong, color: colors.onHero, flexShrink: 1 },
    body: { paddingHorizontal: SPACING.md },
    tilesScroll: { marginTop: TILE_OVERLAP, marginHorizontal: -SPACING.md, flexGrow: 0 },
    tiles: { flexGrow: 1, gap: SPACING.xs, paddingHorizontal: SPACING.md },
    quickActions: { flexDirection: 'row', gap: SPACING.xs, marginTop: SPACING.md },
    sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.md },
    sectionTitle: { ...TYPOGRAPHY.h3, color: colors.text, flexShrink: 1 },
    transactions: { marginTop: 4 },
    dayLabel: { ...TYPOGRAPHY.body2Strong, color: colors.textSecondary, marginTop: SPACING.xs },
    skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.xs },
    skeletonIcon: { borderRadius: 20 },
    skeletonText: { flex: 1, gap: SPACING.xs },
    statusScrim: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: colors.heroStart },
  });
