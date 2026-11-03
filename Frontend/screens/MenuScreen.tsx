import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Animated,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Mic,
  Camera,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  LogOut,
  PlusCircle,
  PackageOpen,
  Settings,
} from 'lucide-react-native';
import { COLORS, SIZES } from '../src/theme/theme';
import { authService } from '../src/services/authService';
import { smartBudgetService, TodayBudgetSummary } from '../src/services/smartBudgetService';
import { transactionService, Transaccion } from '../src/services/transactionService';
import { formatAmount } from '../src/utils/currencyUtils';
import { CategoryIcon } from '../src/theme/categoryIcons';

// ─────────────────────────────────────────────
// Componente auxiliar: Skeleton Loader (Criterio F05 - Escenario 1)
// ─────────────────────────────────────────────
function SkeletonBlock({ width, height, style }: { width: string | number; height: number; style?: any }) {
  const opacity = React.useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 600, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          backgroundColor: COLORS.primary,
          borderRadius: 8,
          opacity,
        },
        style,
      ]}
    />
  );
}

function DashboardSkeleton() {
  return (
    <View style={skeletonStyles.container}>
      {/* Skeleton tarjeta de saldo */}
      <View style={skeletonStyles.card}>
        <SkeletonBlock width={160} height={14} style={{ marginBottom: 12 }} />
        <SkeletonBlock width={220} height={46} style={{ marginBottom: 12 }} />
        <SkeletonBlock width="100%" height={8} style={{ marginBottom: 8 }} />
        <SkeletonBlock width={200} height={12} />
      </View>
      {/* Skeleton título de sección */}
      <SkeletonBlock width={160} height={16} style={{ marginBottom: 16 }} />
      {/* Skeleton filas de transacciones */}
      {[1, 2, 3].map((i) => (
        <View key={i} style={skeletonStyles.row}>
          <SkeletonBlock width={44} height={44} style={{ borderRadius: 10 }} />
          <View style={{ flex: 1, gap: 8 }}>
            <SkeletonBlock width="70%" height={14} />
            <SkeletonBlock width="40%" height={11} />
          </View>
          <SkeletonBlock width={60} height={14} />
        </View>
      ))}
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  container: { paddingHorizontal: SIZES.spacing.lg },
  card: {
    backgroundColor: COLORS.tertiary,
    borderRadius: SIZES.radius.card,
    padding: SIZES.spacing.lg,
    marginBottom: SIZES.spacing.lg,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.spacing.sm,
    marginBottom: SIZES.spacing.sm,
    backgroundColor: COLORS.tertiary,
    padding: SIZES.spacing.md,
    borderRadius: SIZES.radius.button,
  },
});

// ─────────────────────────────────────────────
// Componente principal: Dashboard
// ─────────────────────────────────────────────
interface DashboardData extends TodayBudgetSummary {
  transacciones: Transaccion[];
}

const formatShortDate = (dateKey: string) => {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' });
};

export default function MenuScreen({ navigation }: any) {
  const [userName, setUserName] = useState('');
  const [userId, setUserId] = useState<number | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const hasLoadedOnce = useRef(false);

  // mode: 'initial' → skeleton | 'refresh' → pull-to-refresh | 'silent' → al volver a la pantalla
  const loadDashboard = useCallback(async (mode: 'initial' | 'refresh' | 'silent' = 'initial') => {
    try {
      if (mode === 'refresh') {
        setIsRefreshing(true);
      } else if (mode === 'initial') {
        setIsLoading(true);
      }

      // 1. Obtener la sesión activa
      const session = await authService.getActiveSession();
      if (!session) {
        navigation.replace('Login');
        return;
      }

      setUserId(session.id);
      setUserName(session.nombre);

      // 2. Presupuesto + Recálculo Inteligente (F06), con renovación automática del ciclo
      const summary = await smartBudgetService.getTodaySummary(session.id);
      if (!summary) {
        // Si por alguna razón no tiene presupuesto, volver a configuración
        navigation.replace('BudgetSetup');
        return;
      }

      // 3. Obtener transacciones de hoy
      const transacciones = await transactionService.getTodayTransactions(session.id);

      setData({ ...summary, transacciones });
      hasLoadedOnce.current = true;
    } catch (error) {
      console.error('Error cargando el dashboard:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [navigation]);

  // Recarga cada vez que la pantalla recibe el foco (ej. al regresar de "Nuevo Gasto" — Criterio F02 Esc. 1).
  // La primera vez muestra el skeleton; después actualiza en silencio.
  useFocusEffect(
    useCallback(() => {
      loadDashboard(hasLoadedOnce.current ? 'silent' : 'initial');
    }, [loadDashboard])
  );

  const handleLogout = async () => {
    await authService.logout();
    navigation.replace('Login');
  };

  // ── Formateadores ──
  const formatCurrency = (amount: number, moneda: string) => formatAmount(amount, moneda);

  const getSaldoColor = (saldo: number) => {
    if (saldo > 0) return COLORS.secondary;   // verde → positivo (Criterio F05 Escenario 1)
    return COLORS.error;                        // rojo  → excedido (Criterio F05 Escenario 1)
  };

  const getProgresoWidth = (gastado: number, limite: number): string => {
    if (limite <= 0) return gastado > 0 ? '100%' : '0%';
    const pct = Math.min((gastado / limite) * 100, 100);
    return `${pct}%`;
  };

  // ─────────────────────────────────────────────
  // Render: Estado de carga (Skeleton Loader - Criterio F05 Escenario 1)
  // ─────────────────────────────────────────────
  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        {/* Header estático mientras carga */}
        <View style={styles.header}>
          <View>
            <Text style={styles.saludo}>Cargando...</Text>
            <Text style={styles.appTitle}>Carterita</Text>
          </View>
        </View>
        <DashboardSkeleton />
      </SafeAreaView>
    );
  }

  const moneda = data?.presupuesto?.moneda ?? 'MXN';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadDashboard('refresh')}
            tintColor={COLORS.secondary}
            colors={[COLORS.secondary]}
          />
        }
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.saludo}>Hola, {userName || 'Usuario'}</Text>
            <Text style={styles.appTitle}>Carterita</Text>
          </View>
          <View style={styles.headerActions}>
            {/* S1.1-06: Edición de presupuesto */}
            <TouchableOpacity
              onPress={() => navigation.navigate('BudgetSetup', { mode: 'edit' })}
              style={styles.logoutButton}
              activeOpacity={0.8}
            >
              <Settings color={COLORS.secondary} size={22} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleLogout} style={styles.logoutButton} activeOpacity={0.8}>
              <LogOut color={COLORS.error} size={22} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Tarjeta Principal de Saldo (Criterio F05 - Escenario 1) ── */}
        {data && (
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>DISPONIBLE PARA HOY</Text>

            {/* Monto con color reactivo (verde/rojo según saldo) */}
            <Text
              style={[
                styles.balanceAmount,
                { color: getSaldoColor(data.disponibleHoy), fontVariant: ['tabular-nums'] },
              ]}
            >
              {data.disponibleHoy < 0 ? '-' : ''}
              {formatCurrency(data.disponibleHoy, moneda)}
            </Text>

            {/* Barra de progreso de gasto del día */}
            <View style={styles.progressBarContainer}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: getProgresoWidth(data.gastadoHoy, data.limiteHoy),
                    backgroundColor:
                      data.gastadoHoy > 0 && data.gastadoHoy >= data.limiteHoy
                        ? COLORS.error
                        : COLORS.secondary,
                  },
                ]}
              />
            </View>

            {/* Texto de resumen */}
            <Text style={styles.progressText}>
              Gastado hoy:{' '}
              <Text style={{ color: COLORS.text, fontWeight: '600' }}>
                {formatCurrency(data.gastadoHoy, moneda)}
              </Text>{' '}
              de{' '}
              <Text style={{ color: COLORS.text, fontWeight: '600' }}>
                {formatCurrency(data.limiteHoy, moneda)}
              </Text>
            </Text>

            {/* Contexto del ciclo (F06) */}
            <Text style={styles.cycleText}>
              {data.diasRestantes === 1 ? 'Queda 1 día' : `Quedan ${data.diasRestantes} días`} · Saldo del
              ciclo{' '}
              <Text style={{ color: data.saldoRestanteCiclo < 0 ? COLORS.error : COLORS.text, fontWeight: '600' }}>
                {data.saldoRestanteCiclo < 0 ? '-' : ''}
                {formatCurrency(data.saldoRestanteCiclo, moneda)}
              </Text>{' '}
              ({data.presupuesto.tipo_ciclo.toLowerCase()})
            </Text>

            {/* Mensajes de ajuste (F06 Escenarios 1, 2 y 3) */}
            {data.cicloAgotado ? (
              <View style={[styles.adjustBanner, styles.adjustBannerNegative]}>
                <AlertCircle color={COLORS.error} size={16} />
                <Text style={[styles.adjustText, { color: COLORS.error }]}>
                  Agotaste el presupuesto de este ciclo. Se renovará el {formatShortDate(data.fechaRenovacion)}.
                </Text>
              </View>
            ) : data.ajuste === 'alza' ? (
              <View style={styles.adjustBanner}>
                <TrendingUp color={COLORS.secondary} size={16} />
                <Text style={styles.adjustText}>
                  ¡Ahorraste en días anteriores! Tu límite de hoy subió a {formatCurrency(data.limiteHoy, moneda)}
                </Text>
              </View>
            ) : data.ajuste === 'baja' ? (
              <View style={styles.adjustBanner}>
                <TrendingDown color={COLORS.textSecondary} size={16} />
                <Text style={[styles.adjustText, { color: COLORS.textSecondary }]}>
                  Gastaste de más en días anteriores. Tu límite de hoy se ajustó a{' '}
                  {formatCurrency(data.limiteHoy, moneda)}
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {/* ── Registro Rápido (Motor Multimodal - placeholder Sprint 2) ── */}
        <Text style={styles.sectionTitle}>Registro Rápido</Text>
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionButton, { opacity: 0.5 }]}
            activeOpacity={0.8}
            disabled
          >
            <Mic color={COLORS.background} size={26} />
            <Text style={styles.actionButtonText}>Voz</Text>
            <Text style={styles.actionButtonBadge}>Sprint 2</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.cameraButton, { opacity: 0.5 }]}
            activeOpacity={0.8}
            disabled
          >
            <Camera color={COLORS.background} size={26} />
            <Text style={styles.actionButtonText}>Escanear</Text>
            <Text style={styles.actionButtonBadge}>Sprint 2</Text>
          </TouchableOpacity>

          {/* Botón de registro manual → F02 (próximo paso) */}
          <TouchableOpacity
            style={[styles.actionButton, styles.manualButton]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('AddExpense')}
          >
            <PlusCircle color={COLORS.background} size={26} />
            <Text style={styles.actionButtonText}>Manual</Text>
          </TouchableOpacity>
        </View>

        {/* ── Últimos Gastos de Hoy ── */}
        <Text style={styles.sectionTitle}>Gastos de Hoy</Text>

        {/* Empty State (Criterio F05 - Escenario 2) */}
        {data && data.transacciones.length === 0 ? (
          <View style={styles.emptyState}>
            <PackageOpen color={COLORS.primary} size={52} />
            <Text style={styles.emptyStateTitle}>¡Sin gastos por ahora!</Text>
            <Text style={styles.emptyStateSubtitle}>
              Aún no tienes gastos hoy. ¡Sigue así!
            </Text>
          </View>
        ) : (
          data?.transacciones.map((tx) => (
            <View key={tx.id} style={styles.transactionCard}>
              <View style={styles.transactionIcon}>
                <CategoryIcon icono={tx.categoria_icono} color={COLORS.secondary} size={20} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.transactionConcept} numberOfLines={1}>
                  {tx.concepto}
                </Text>
                <Text style={styles.transactionCategory}>
                  {tx.categoria_nombre ?? 'Sin categoría'} ·{' '}
                  {new Date(tx.fecha).toLocaleTimeString('es-MX', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
              <Text style={[styles.transactionAmount, { fontVariant: ['tabular-nums'] }]}>
                -{formatCurrency(tx.monto, moneda)}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: SIZES.spacing.lg,
    paddingTop: SIZES.spacing.md,
    paddingBottom: SIZES.spacing.xl,
  },
  // ── Header ──
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.spacing.lg,
    marginBottom: SIZES.spacing.lg,
    marginTop: SIZES.spacing.xs,
  },
  saludo: {
    color: COLORS.secondary,
    fontSize: SIZES.body2,
    fontWeight: '600',
  },
  appTitle: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: SIZES.spacing.xs,
  },
  logoutButton: {
    backgroundColor: COLORS.tertiary,
    padding: 10,
    borderRadius: SIZES.radius.button,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  // ── Tarjeta de Balance ──
  balanceCard: {
    backgroundColor: COLORS.tertiary,
    borderRadius: SIZES.radius.card,
    padding: SIZES.spacing.lg,
    marginBottom: SIZES.spacing.lg,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  balanceLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: '700',
  },
  balanceAmount: {
    fontSize: 44,
    fontWeight: 'bold',
    marginVertical: SIZES.spacing.xs,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: COLORS.background,
    borderRadius: 4,
    marginTop: SIZES.spacing.sm,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: SIZES.spacing.xs,
  },
  cycleText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  adjustBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.spacing.xs,
    marginTop: SIZES.spacing.sm,
    padding: SIZES.spacing.xs,
    borderRadius: SIZES.radius.button,
    backgroundColor: 'rgba(47, 163, 106, 0.12)',
  },
  adjustBannerNegative: {
    backgroundColor: 'rgba(207, 102, 121, 0.12)',
  },
  adjustText: {
    color: COLORS.secondary,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  // ── Secciones ──
  sectionTitle: {
    color: COLORS.text,
    fontSize: SIZES.body1,
    fontWeight: '700',
    marginBottom: SIZES.spacing.sm,
    letterSpacing: 0.3,
  },
  // ── Botones de Acción ──
  actionRow: {
    flexDirection: 'row',
    gap: SIZES.spacing.xs,
    marginBottom: SIZES.spacing.lg,
  },
  actionButton: {
    flex: 1,
    backgroundColor: COLORS.secondary,
    borderRadius: SIZES.radius.card,
    paddingVertical: SIZES.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  cameraButton: {
    backgroundColor: COLORS.primary,
  },
  manualButton: {
    backgroundColor: COLORS.secondary,
  },
  actionButtonText: {
    color: COLORS.background,
    fontWeight: 'bold',
    fontSize: SIZES.body2,
  },
  actionButtonBadge: {
    color: COLORS.background,
    fontSize: 10,
    opacity: 0.8,
    fontStyle: 'italic',
  },
  // ── Tarjetas de Transacción ──
  transactionCard: {
    backgroundColor: COLORS.tertiary,
    borderRadius: SIZES.radius.button,
    padding: SIZES.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.spacing.sm,
    marginBottom: SIZES.spacing.xs,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  transactionIcon: {
    backgroundColor: COLORS.background,
    padding: 10,
    borderRadius: SIZES.spacing.xs,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  transactionConcept: {
    color: COLORS.text,
    fontSize: SIZES.body2,
    fontWeight: '600',
  },
  transactionCategory: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  transactionAmount: {
    color: COLORS.error,
    fontWeight: 'bold',
    fontSize: SIZES.body2,
  },
  // ── Empty State ──
  emptyState: {
    alignItems: 'center',
    paddingVertical: SIZES.spacing.xl,
    gap: SIZES.spacing.sm,
    backgroundColor: COLORS.tertiary,
    borderRadius: SIZES.radius.card,
    borderWidth: 1,
    borderColor: COLORS.primary,
    marginBottom: SIZES.spacing.md,
  },
  emptyStateTitle: {
    color: COLORS.text,
    fontSize: SIZES.body1,
    fontWeight: '700',
  },
  emptyStateSubtitle: {
    color: COLORS.textSecondary,
    fontSize: SIZES.body2,
    textAlign: 'center',
    paddingHorizontal: SIZES.spacing.lg,
  },
});
