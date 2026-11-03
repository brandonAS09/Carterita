import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  Plus,
  PiggyBank,
  Sparkles,
  CircleCheck,
  Info,
  Trash2,
  HandCoins,
  Trophy,
  CalendarClock,
  AlertCircle,
  X,
} from 'lucide-react-native';
import { COLORS, SIZES } from '../src/theme/theme';
import { authService } from '../src/services/authService';
import { budgetService } from '../src/services/budgetService';
import { goalService, MetaView, YesterdaySurplus } from '../src/services/goalService';
import { GoalIcon } from '../src/theme/goalIcons';
import { formatAmount, getCurrencySymbol, round2 } from '../src/utils/currencyUtils';
import { daysUntilDeadline } from '../src/utils/goalCalculator';
import { toLocalDateKey } from '../src/utils/dateUtils';
import ConfirmDialog from '../src/components/ConfirmDialog';
import CelebrationDialog from '../src/components/CelebrationDialog';

const GOLD = '#E0B33A';

interface Celebration {
  title: string;
  message: string;
  completed: boolean;
}

/** F07 - Metas de Ahorro Gamificadas (pestaña "Metas"). */
export default function GoalsScreen({ navigation }: any) {
  const [userId, setUserId] = useState<number | null>(null);
  const [moneda, setMoneda] = useState('MXN');
  const [goals, setGoals] = useState<MetaView[]>([]);
  const [surplus, setSurplus] = useState<YesterdaySurplus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Diálogos
  const [pickingGoalForSurplus, setPickingGoalForSurplus] = useState(false);
  const [abonoGoal, setAbonoGoal] = useState<MetaView | null>(null);
  const [deleteGoal, setDeleteGoal] = useState<MetaView | null>(null);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' | 'silent' = 'silent') => {
      if (mode === 'refresh') setIsRefreshing(true);
      try {
        const session = await authService.getActiveSession();
        if (!session) {
          navigation.replace('Login');
          return;
        }
        setUserId(session.id);
        const [budget, list, yesterday] = await Promise.all([
          budgetService.getBudgetByUserId(session.id),
          goalService.getGoals(session.id),
          goalService.getYesterdaySurplus(session.id),
        ]);
        if (budget) setMoneda(budget.moneda);
        setGoals(list);
        setSurplus(yesterday);
      } catch (error) {
        console.error('Error cargando metas:', error);
        setErrorMessage('No se pudieron cargar tus metas. Desliza hacia abajo para reintentar.');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [navigation]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const activeGoals = goals.filter((g) => !g.completada);
  const totalAhorrado = round2(goals.reduce((sum, g) => sum + g.monto_acumulado, 0));
  const hoy = toLocalDateKey();
  const fmt = (n: number) => formatAmount(n, moneda);

  // ── Acciones ──
  const moveSurplusTo = async (goal: MetaView) => {
    if (!userId || !surplus || surplus.monto <= 0) return;
    setPickingGoalForSurplus(false);
    setIsWorking(true);
    setErrorMessage(null);
    try {
      const outcome = await goalService.addContribution(userId, goal.id, surplus.monto, 'Excedente', surplus.fecha);
      const resto = round2(surplus.monto - outcome.aportado);
      setCelebration({
        completed: outcome.completada,
        title: outcome.completada ? '¡Meta completada!' : '¡Excedente guardado!',
        message:
          `Moviste ${fmt(outcome.aportado)} a "${goal.nombre}".` +
          (outcome.completada ? ' ¡Alcanzaste tu objetivo!' : '') +
          (resto > 0 ? ` Los ${fmt(resto)} restantes se quedan en tu presupuesto.` : ''),
      });
      await load();
    } catch (error: any) {
      setErrorMessage(error?.message ?? 'No se pudo mover el excedente. Inténtalo de nuevo.');
    } finally {
      setIsWorking(false);
    }
  };

  const confirmAbono = async (goal: MetaView, monto: number) => {
    if (!userId) return;
    setIsWorking(true);
    setErrorMessage(null);
    try {
      const outcome = await goalService.addContribution(userId, goal.id, monto, 'Abono');
      setAbonoGoal(null);
      if (outcome.completada) {
        setCelebration({
          completed: true,
          title: '¡Meta completada!',
          message: `Juntaste ${fmt(outcome.meta.monto_objetivo)} para "${goal.nombre}". ¡Felicidades!`,
        });
      }
      await load();
    } catch (error: any) {
      setAbonoGoal(null);
      setErrorMessage(error?.message ?? 'No se pudo registrar el abono. Inténtalo de nuevo.');
    } finally {
      setIsWorking(false);
    }
  };

  const confirmDelete = async () => {
    if (!userId || !deleteGoal) return;
    const goal = deleteGoal;
    setDeleteGoal(null);
    try {
      await goalService.deleteGoal(userId, goal.id);
      await load();
    } catch {
      setErrorMessage('No se pudo eliminar la meta. Inténtalo de nuevo.');
    }
  };

  // ── Render: tarjeta de excedente ──
  const renderSurplusCard = () => {
    if (surplus?.movido) {
      return (
        <View style={[styles.surplusCard, styles.surplusCardMuted]}>
          <CircleCheck color={COLORS.secondary} size={22} />
          <Text style={styles.surplusMutedText}>
            Ya guardaste el excedente de ayer: <Text style={styles.bold}>{fmt(surplus.movido.monto)}</Text> en "
            {surplus.movido.metaNombre}".
          </Text>
        </View>
      );
    }
    if (surplus && surplus.monto > 0) {
      return (
        <View style={styles.surplusCard}>
          <View style={styles.surplusHeader}>
            <Sparkles color={COLORS.secondary} size={22} />
            <Text style={styles.surplusLabel}>EXCEDENTE DE AYER</Text>
          </View>
          <Text style={styles.surplusAmount}>{fmt(surplus.monto)}</Text>
          <Text style={styles.surplusText}>Gastaste menos que tu límite. ¡Guárdalo en una meta!</Text>
          {activeGoals.length > 0 ? (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => setPickingGoalForSurplus(true)}
              disabled={isWorking}
              activeOpacity={0.8}
            >
              {isWorking ? (
                <ActivityIndicator color={COLORS.background} />
              ) : (
                <Text style={styles.primaryButtonText}>Mover excedente a una meta</Text>
              )}
            </TouchableOpacity>
          ) : (
            <Text style={styles.surplusHint}>Crea una meta para guardar tu excedente.</Text>
          )}
        </View>
      );
    }
    return (
      <View style={[styles.surplusCard, styles.surplusCardMuted]}>
        <Info color={COLORS.textSecondary} size={20} />
        <Text style={styles.surplusMutedText}>
          Cuando gastes menos que tu límite diario, al día siguiente podrás mover ese excedente a una meta.
        </Text>
      </View>
    );
  };

  // ── Render: tarjeta de meta ──
  const renderGoal = (goal: MetaView) => {
    const pct = Math.round(goal.progreso * 100);
    const dias = daysUntilDeadline(goal.fecha_limite, hoy);
    return (
      <View key={goal.id} style={[styles.goalCard, goal.completada && styles.goalCardCompleted]}>
        <View style={styles.goalHeader}>
          <View style={[styles.goalIcon, goal.completada && { borderColor: GOLD }]}>
            <GoalIcon icono={goal.icono} color={goal.completada ? GOLD : COLORS.secondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.goalName} numberOfLines={1}>
              {goal.nombre}
            </Text>
            <Text style={styles.goalAmounts}>
              <Text style={styles.bold}>{fmt(goal.monto_acumulado)}</Text> de {fmt(goal.monto_objetivo)}
            </Text>
          </View>
          {goal.completada ? (
            <View style={styles.completedBadge}>
              <Trophy color={COLORS.background} size={14} />
              <Text style={styles.completedBadgeText}>Completada</Text>
            </View>
          ) : (
            <Text style={styles.goalPct}>{pct}%</Text>
          )}
        </View>

        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${pct}%`, backgroundColor: goal.completada ? GOLD : COLORS.secondary },
            ]}
          />
        </View>

        <View style={styles.goalFooter}>
          <View style={styles.goalMeta}>
            {dias !== null && !goal.completada && (
              <>
                <CalendarClock color={dias < 0 ? COLORS.error : COLORS.textSecondary} size={14} />
                <Text style={[styles.goalMetaText, dias < 0 && { color: COLORS.error }]}>
                  {dias < 0 ? 'Fecha límite vencida' : dias === 0 ? 'Vence hoy' : `Faltan ${dias} días`}
                </Text>
              </>
            )}
            {!goal.completada && dias === null && (
              <Text style={styles.goalMetaText}>Faltan {fmt(goal.restante)}</Text>
            )}
          </View>
          <View style={styles.goalActions}>
            {!goal.completada && (
              <TouchableOpacity style={styles.smallButton} onPress={() => setAbonoGoal(goal)} activeOpacity={0.8}>
                <HandCoins color={COLORS.secondary} size={16} />
                <Text style={styles.smallButtonText}>Abonar</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => setDeleteGoal(goal)}
              activeOpacity={0.8}
              accessibilityLabel={`Eliminar meta ${goal.nombre}`}
            >
              <Trash2 color={COLORS.error} size={16} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => load('refresh')}
            tintColor={COLORS.secondary}
            colors={[COLORS.secondary]}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.headerOverline}>Ahorro gamificado</Text>
            <Text style={styles.headerTitle}>Mis Metas</Text>
          </View>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('CreateGoal')}
            activeOpacity={0.8}
            accessibilityLabel="Nueva meta"
          >
            <Plus color={COLORS.background} size={22} />
          </TouchableOpacity>
        </View>

        {errorMessage && (
          <View style={styles.errorBanner}>
            <AlertCircle color={COLORS.error} size={20} />
            <Text style={styles.errorBannerText}>{errorMessage}</Text>
            <TouchableOpacity onPress={() => setErrorMessage(null)} hitSlop={10}>
              <X color={COLORS.error} size={18} />
            </TouchableOpacity>
          </View>
        )}

        {isLoading ? (
          <ActivityIndicator color={COLORS.secondary} size="large" style={{ marginTop: SIZES.spacing.xl }} />
        ) : (
          <>
            {renderSurplusCard()}

            {goals.length > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>TOTAL AHORRADO</Text>
                <Text style={styles.summaryAmount}>{fmt(totalAhorrado)}</Text>
              </View>
            )}

            {goals.length === 0 ? (
              // Escenario 5: estado vacío
              <View style={styles.emptyState}>
                <PiggyBank color={COLORS.primary} size={56} />
                <Text style={styles.emptyTitle}>Aún no tienes metas</Text>
                <Text style={styles.emptyText}>¡Crea la primera y empieza a ahorrar!</Text>
                <TouchableOpacity
                  style={[styles.primaryButton, { alignSelf: 'stretch', marginHorizontal: SIZES.spacing.lg }]}
                  onPress={() => navigation.navigate('CreateGoal')}
                  activeOpacity={0.8}
                >
                  <Plus color={COLORS.background} size={18} />
                  <Text style={styles.primaryButtonText}>Nueva meta</Text>
                </TouchableOpacity>
              </View>
            ) : (
              goals.map(renderGoal)
            )}
          </>
        )}
      </ScrollView>

      {/* Elegir meta para el excedente */}
      <Modal visible={pickingGoalForSurplus} transparent animationType="fade" onRequestClose={() => setPickingGoalForSurplus(false)}>
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>¿A qué meta lo mueves?</Text>
            <Text style={styles.dialogMessage}>Excedente de ayer: {surplus ? fmt(surplus.monto) : ''}</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {activeGoals.map((g) => (
                <TouchableOpacity key={g.id} style={styles.pickRow} onPress={() => moveSurplusTo(g)} activeOpacity={0.8}>
                  <GoalIcon icono={g.icono} color={COLORS.secondary} size={20} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickName}>{g.nombre}</Text>
                    <Text style={styles.pickDetail}>Faltan {fmt(g.restante)}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setPickingGoalForSurplus(false)} activeOpacity={0.8}>
              <Text style={styles.secondaryButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Abono manual */}
      <AbonoDialog
        goal={abonoGoal}
        moneda={moneda}
        isSaving={isWorking}
        onCancel={() => setAbonoGoal(null)}
        onConfirm={confirmAbono}
      />

      {/* Escenario 7: eliminar */}
      <ConfirmDialog
        visible={deleteGoal !== null}
        title="¿Eliminar meta?"
        message={`Se eliminará "${deleteGoal?.nombre ?? ''}" y su progreso. Los excedentes que guardaste en ella regresarán a tu presupuesto.`}
        confirmLabel="Eliminar"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteGoal(null)}
      />

      <CelebrationDialog
        visible={celebration !== null}
        title={celebration?.title ?? ''}
        message={celebration?.message ?? ''}
        completed={celebration?.completed}
        onClose={() => setCelebration(null)}
      />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
// Diálogo de abono (Escenario 6)
// ─────────────────────────────────────────────
function AbonoDialog({
  goal,
  moneda,
  isSaving,
  onCancel,
  onConfirm,
}: {
  goal: MetaView | null;
  moneda: string;
  isSaving: boolean;
  onCancel: () => void;
  onConfirm: (goal: MetaView, monto: number) => void;
}) {
  const [montoText, setMontoText] = useState('');

  const monto = parseFloat(montoText.replace(/,/g, ''));
  const isPositive = !isNaN(monto) && isFinite(monto) && monto > 0;
  const excede = !!goal && isPositive && round2(monto) > goal.restante;
  const isValid = isPositive && !excede;

  const close = () => {
    setMontoText('');
    onCancel();
  };

  return (
    <Modal visible={goal !== null} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <View style={styles.dialog}>
          <Text style={styles.dialogTitle}>Abonar a "{goal?.nombre}"</Text>
          <Text style={styles.dialogMessage}>
            Usa dinero fuera de tu presupuesto (ahorros, ingresos extra). No afecta tu límite diario.
          </Text>
          <View style={[styles.amountWrapper, excede && styles.inputError]}>
            <Text style={styles.currencyPrefix}>{getCurrencySymbol(moneda)}</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="decimal-pad"
              value={montoText}
              onChangeText={setMontoText}
              autoFocus
            />
          </View>
          {excede && goal && (
            <Text style={styles.fieldError}>Solo faltan {formatAmount(goal.restante, moneda)} para completar esta meta.</Text>
          )}
          <View style={styles.dialogActions}>
            <TouchableOpacity style={[styles.secondaryButton, { flex: 1 }]} onPress={close} activeOpacity={0.8}>
              <Text style={styles.secondaryButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryButton, { flex: 1 }, !isValid && styles.disabledButton]}
              onPress={() => {
                if (goal && isValid) {
                  onConfirm(goal, monto);
                  setMontoText('');
                }
              }}
              disabled={!isValid || isSaving}
              activeOpacity={0.8}
            >
              {isSaving ? (
                <ActivityIndicator color={COLORS.background} />
              ) : (
                <Text style={[styles.primaryButtonText, !isValid && { color: COLORS.disabledText }]}>Abonar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingHorizontal: SIZES.spacing.lg, paddingTop: SIZES.spacing.md, paddingBottom: SIZES.spacing.xl },
  bold: { color: COLORS.text, fontWeight: '700' },
  // ── Header ──
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.spacing.lg,
    marginTop: SIZES.spacing.xs,
  },
  headerOverline: { color: COLORS.secondary, fontSize: SIZES.body2, fontWeight: '600' },
  headerTitle: { color: COLORS.text, fontSize: 28, fontWeight: 'bold', marginTop: 2 },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: SIZES.radius.button,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(207, 102, 121, 0.15)',
    borderWidth: 1,
    borderColor: COLORS.error,
    borderRadius: SIZES.radius.button,
    padding: SIZES.spacing.sm,
    marginBottom: SIZES.spacing.md,
    gap: SIZES.spacing.xs,
  },
  errorBannerText: { color: COLORS.error, fontSize: SIZES.body2, flex: 1 },
  // ── Excedente ──
  surplusCard: {
    backgroundColor: COLORS.tertiary,
    borderRadius: SIZES.radius.card,
    borderWidth: 1,
    borderColor: COLORS.secondary,
    padding: SIZES.spacing.lg,
    marginBottom: SIZES.spacing.lg,
    gap: SIZES.spacing.xs,
  },
  surplusCardMuted: {
    borderColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    padding: SIZES.spacing.md,
    gap: SIZES.spacing.sm,
  },
  surplusHeader: { flexDirection: 'row', alignItems: 'center', gap: SIZES.spacing.xs },
  surplusLabel: { color: COLORS.textSecondary, fontSize: 11, letterSpacing: 1.2, fontWeight: '700' },
  surplusAmount: { color: COLORS.secondary, fontSize: 36, fontWeight: 'bold', fontVariant: ['tabular-nums'] },
  surplusText: { color: COLORS.textSecondary, fontSize: SIZES.body2, marginBottom: SIZES.spacing.xs },
  surplusHint: { color: COLORS.text, fontSize: SIZES.body2, fontStyle: 'italic' },
  surplusMutedText: { color: COLORS.textSecondary, fontSize: SIZES.body2, flex: 1, lineHeight: 20 },
  // ── Resumen ──
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.spacing.sm,
  },
  summaryLabel: { color: COLORS.textSecondary, fontSize: 11, letterSpacing: 1.2, fontWeight: '700' },
  summaryAmount: { color: COLORS.text, fontSize: SIZES.body1, fontWeight: 'bold', fontVariant: ['tabular-nums'] },
  // ── Meta ──
  goalCard: {
    backgroundColor: COLORS.tertiary,
    borderRadius: SIZES.radius.card,
    borderWidth: 1,
    borderColor: COLORS.primary,
    padding: SIZES.spacing.md,
    marginBottom: SIZES.spacing.sm,
  },
  goalCardCompleted: { borderColor: GOLD },
  goalHeader: { flexDirection: 'row', alignItems: 'center', gap: SIZES.spacing.sm },
  goalIcon: {
    width: 44,
    height: 44,
    borderRadius: SIZES.radius.button,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  goalName: { color: COLORS.text, fontSize: SIZES.body1, fontWeight: '700' },
  goalAmounts: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2, fontVariant: ['tabular-nums'] },
  goalPct: { color: COLORS.secondary, fontSize: SIZES.body1, fontWeight: 'bold', fontVariant: ['tabular-nums'] },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: GOLD,
    borderRadius: SIZES.radius.button,
    paddingHorizontal: SIZES.spacing.xs,
    paddingVertical: 4,
  },
  completedBadgeText: { color: COLORS.background, fontSize: 11, fontWeight: 'bold' },
  progressTrack: {
    height: 8,
    backgroundColor: COLORS.background,
    borderRadius: 4,
    marginTop: SIZES.spacing.sm,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4 },
  goalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SIZES.spacing.sm,
  },
  goalMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  goalMetaText: { color: COLORS.textSecondary, fontSize: 12 },
  goalActions: { flexDirection: 'row', alignItems: 'center', gap: SIZES.spacing.xs },
  smallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: COLORS.secondary,
    borderRadius: SIZES.radius.button,
    paddingHorizontal: SIZES.spacing.sm,
    minHeight: 36,
  },
  smallButtonText: { color: COLORS.secondary, fontSize: SIZES.body2, fontWeight: '600' },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: SIZES.radius.button,
    borderWidth: 1,
    borderColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // ── Vacío ──
  emptyState: {
    alignItems: 'center',
    paddingVertical: SIZES.spacing.xl,
    gap: SIZES.spacing.sm,
    backgroundColor: COLORS.tertiary,
    borderRadius: SIZES.radius.card,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  emptyTitle: { color: COLORS.text, fontSize: SIZES.body1, fontWeight: '700' },
  emptyText: { color: COLORS.textSecondary, fontSize: SIZES.body2, marginBottom: SIZES.spacing.xs },
  // ── Botones ──
  primaryButton: {
    flexDirection: 'row',
    gap: SIZES.spacing.xs,
    backgroundColor: COLORS.secondary,
    borderRadius: SIZES.radius.button,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SIZES.spacing.md,
  },
  primaryButtonText: { color: COLORS.background, fontSize: SIZES.body1, fontWeight: 'bold' },
  disabledButton: { backgroundColor: COLORS.disabledBg },
  secondaryButton: {
    borderWidth: 2,
    borderColor: COLORS.secondary,
    borderRadius: SIZES.radius.button,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SIZES.spacing.sm,
  },
  secondaryButtonText: { color: COLORS.secondary, fontSize: SIZES.body1, fontWeight: '600' },
  // ── Diálogos ──
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    paddingHorizontal: SIZES.spacing.lg,
  },
  dialog: {
    backgroundColor: COLORS.tertiary,
    borderRadius: SIZES.radius.card,
    borderWidth: 1,
    borderColor: COLORS.primary,
    padding: SIZES.spacing.lg,
  },
  dialogTitle: { color: COLORS.text, fontSize: SIZES.h2 - 4, fontWeight: 'bold', marginBottom: SIZES.spacing.xs },
  dialogMessage: { color: COLORS.textSecondary, fontSize: SIZES.body2, lineHeight: 20, marginBottom: SIZES.spacing.md },
  dialogActions: { flexDirection: 'row', gap: SIZES.spacing.xs, marginTop: SIZES.spacing.md, alignItems: 'flex-end' },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.spacing.sm,
    padding: SIZES.spacing.sm,
    borderRadius: SIZES.radius.button,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.background,
    marginBottom: SIZES.spacing.xs,
  },
  pickName: { color: COLORS.text, fontSize: SIZES.body1, fontWeight: '600' },
  pickDetail: { color: COLORS.textSecondary, fontSize: 12 },
  amountWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: SIZES.radius.button,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingHorizontal: SIZES.spacing.md,
    height: 56,
  },
  currencyPrefix: { color: COLORS.secondary, fontSize: 24, fontWeight: 'bold', marginRight: 6 },
  amountInput: { flex: 1, color: COLORS.text, fontSize: 24, fontWeight: 'bold', fontVariant: ['tabular-nums'] },
  inputError: { borderColor: COLORS.error },
  fieldError: { color: COLORS.error, fontSize: 12, marginTop: 6, marginLeft: 4 },
});
