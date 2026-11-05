import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  Plus,
  PiggyBank,
  Sparkles,
  CircleCheck,
  Info,
  Trash2,
  HandCoins,
  CalendarClock,
  X,
} from 'lucide-react-native';
import { useTheme, useThemedStyles } from '../src/theme/ThemeProvider';
import { MIN_TOUCH, RADIUS, SPACING, ThemeColors, TYPOGRAPHY } from '../src/theme/theme';
import { authService } from '../src/services/authService';
import { budgetService } from '../src/services/budgetService';
import { goalService, MetaView, YesterdaySurplus } from '../src/services/goalService';
import { GoalIcon } from '../src/theme/goalIcons';
import { formatAmount, getCurrencySymbol, round2 } from '../src/utils/currencyUtils';
import { daysUntilDeadline } from '../src/utils/goalCalculator';
import { toLocalDateKey } from '../src/utils/dateUtils';
import ConfirmDialog from '../src/components/ConfirmDialog';
import CelebrationDialog from '../src/components/CelebrationDialog';
import HeroHeader from '../src/components/ui/HeroHeader';
import Button from '../src/components/ui/Button';
import Card from '../src/components/ui/Card';
import Amount from '../src/components/ui/Amount';
import TextField from '../src/components/ui/TextField';
import { Banner, ProgressBar } from '../src/components/ui/Form';
import { EmptyState, Skeleton } from '../src/components/ui/States';

interface Celebration {
  title: string;
  message: string;
  completed: boolean;
}

/** F07 - Metas de Ahorro Gamificadas (pestaña "Metas"). */
export default function GoalsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
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
        <Card style={styles.mutedCard}>
          <CircleCheck color={colors.success} size={22} />
          <Text style={styles.mutedText}>
            Ya guardaste el excedente de ayer: <Text style={styles.strong}>{fmt(surplus.movido.monto)}</Text> en "
            {surplus.movido.metaNombre}".
          </Text>
        </Card>
      );
    }
    if (surplus && surplus.monto > 0) {
      return (
        <Card style={styles.surplusCard}>
          <View style={styles.surplusHeader}>
            <Sparkles color={colors.success} size={20} />
            <Text style={styles.surplusLabel}>Excedente de ayer</Text>
          </View>
          <Amount value={surplus.monto} moneda={moneda} sign="plus" label="Excedente de ayer" style={styles.surplusAmount} />
          <Text style={styles.mutedText}>Gastaste menos que tu límite. ¡Guárdalo en una meta!</Text>
          {activeGoals.length > 0 ? (
            <Button
              label="Mover excedente a una meta"
              onPress={() => setPickingGoalForSurplus(true)}
              loading={isWorking}
              style={styles.surplusButton}
            />
          ) : (
            <Text style={styles.hint}>Crea una meta para guardar tu excedente.</Text>
          )}
        </Card>
      );
    }
    return (
      <Card style={styles.mutedCard}>
        <Info color={colors.textSecondary} size={20} />
        <Text style={styles.mutedText}>
          Cuando gastes menos que tu límite diario, al día siguiente podrás mover ese excedente a una meta.
        </Text>
      </Card>
    );
  };

  // ── Render: tarjeta de meta ──
  const renderGoal = (goal: MetaView) => {
    const pct = Math.round(goal.progreso * 100);
    const dias = daysUntilDeadline(goal.fecha_limite, hoy);
    return (
      <Card key={goal.id} style={styles.goalCard}>
        <View style={styles.goalHeader}>
          <View style={styles.goalIcon}>
            <GoalIcon icono={goal.icono} color={goal.completada ? colors.success : colors.primary} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.goalName} numberOfLines={1}>
              {goal.nombre}
            </Text>
            <Text style={styles.goalAmounts}>
              <Text style={styles.strong}>{fmt(goal.monto_acumulado)}</Text> de {fmt(goal.monto_objetivo)}
            </Text>
          </View>
          {goal.completada ? (
            <View style={styles.completedBadge}>
              <CircleCheck color={colors.success} size={16} />
              <Text style={styles.completedText}>Completada</Text>
            </View>
          ) : (
            <Text style={styles.goalPct}>{pct}%</Text>
          )}
        </View>

        <ProgressBar progress={goal.progreso} color={goal.completada ? colors.success : colors.accent} />

        <View style={styles.goalFooter}>
          <View style={styles.goalMeta}>
            {!goal.completada && <Text style={styles.goalMetaText}>Faltan {fmt(goal.restante)}</Text>}
            {dias !== null && !goal.completada && (
              <View style={styles.goalDeadline}>
                <CalendarClock color={dias < 0 ? colors.error : colors.textSecondary} size={14} />
                <Text style={[styles.goalMetaText, dias < 0 && { color: colors.error }]}>
                  {dias < 0 ? 'Fecha límite vencida' : dias === 0 ? 'Vence hoy' : `Faltan ${dias} días`}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.goalActions}>
            {!goal.completada && (
              <Pressable style={styles.abonoButton} onPress={() => setAbonoGoal(goal)} accessibilityRole="button">
                <HandCoins color={colors.primary} size={18} />
                <Text style={styles.abonoText}>Abonar</Text>
              </Pressable>
            )}
            <Pressable
              style={styles.iconButton}
              onPress={() => setDeleteGoal(goal)}
              accessibilityRole="button"
              accessibilityLabel={`Eliminar meta ${goal.nombre}`}
            >
              <Trash2 color={colors.error} size={20} />
            </Pressable>
          </View>
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.screen}>
      <HeroHeader
        title="Mis Metas"
        right={
          <Pressable
            style={[styles.addButton, { backgroundColor: colors.heroChip }]}
            onPress={() => navigation.navigate('CreateGoal')}
            accessibilityRole="button"
            accessibilityLabel="Nueva meta"
          >
            <Plus color={colors.onHero} size={24} />
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => load('refresh')}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        {errorMessage && (
          <Banner
            tone="error"
            message={errorMessage}
            action={
              <Pressable onPress={() => setErrorMessage(null)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cerrar aviso">
                <X color={colors.error} size={18} />
              </Pressable>
            }
          />
        )}

        {isLoading ? (
          [1, 2].map((i) => <Skeleton key={i} width="100%" height={140} style={styles.skeleton} />)
        ) : (
          <>
            {renderSurplusCard()}

            {goals.length > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total ahorrado</Text>
                <Amount value={totalAhorrado} moneda={moneda} label="Total ahorrado" style={styles.summaryAmount} />
              </View>
            )}

            {goals.length === 0 ? (
              // Escenario 5: estado vacío
              <EmptyState icon={PiggyBank} title="Aún no tienes metas" message="¡Crea la primera y empieza a ahorrar!">
                <Button
                  label="Nueva meta"
                  icon={Plus}
                  onPress={() => navigation.navigate('CreateGoal')}
                  style={styles.emptyButton}
                />
              </EmptyState>
            ) : (
              goals.map(renderGoal)
            )}
          </>
        )}
      </ScrollView>

      {/* Elegir meta para el excedente */}
      <Modal visible={pickingGoalForSurplus} transparent animationType="fade" onRequestClose={() => setPickingGoalForSurplus(false)}>
        <View style={styles.overlay}>
          <View style={styles.dialog} accessibilityViewIsModal>
            <Text style={styles.dialogTitle} accessibilityRole="header">
              ¿A qué meta lo mueves?
            </Text>
            <Text style={styles.dialogMessage}>Excedente de ayer: {surplus ? fmt(surplus.monto) : ''}</Text>
            <ScrollView style={styles.pickList}>
              {activeGoals.map((g) => (
                <Pressable key={g.id} style={styles.pickRow} onPress={() => moveSurplusTo(g)} accessibilityRole="button">
                  <GoalIcon icono={g.icono} color={colors.primary} size={20} />
                  <View style={styles.flex}>
                    <Text style={styles.pickName}>{g.nombre}</Text>
                    <Text style={styles.pickDetail}>Faltan {fmt(g.restante)}</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
            <Button label="Cancelar" variant="text" onPress={() => setPickingGoalForSurplus(false)} />
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
        destructive
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
    </View>
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
  const styles = useThemedStyles(createStyles);
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
        <View style={styles.dialog} accessibilityViewIsModal>
          <Text style={styles.dialogTitle} accessibilityRole="header">
            Abonar a "{goal?.nombre}"
          </Text>
          <Text style={styles.dialogMessage}>
            Usa dinero fuera de tu presupuesto (ahorros, ingresos extra). No afecta tu límite diario.
          </Text>
          <TextField
            accessibilityLabel="Monto del abono"
            amount
            prefix={getCurrencySymbol(moneda)}
            placeholder="0.00"
            keyboardType="decimal-pad"
            value={montoText}
            onChangeText={setMontoText}
            autoFocus
            error={excede && goal ? `Solo faltan ${formatAmount(goal.restante, moneda)} para completar esta meta.` : null}
          />
          <View style={styles.dialogActions}>
            <Button
              label="Abonar"
              disabled={!isValid}
              loading={isSaving}
              onPress={() => {
                if (goal && isValid) {
                  onConfirm(goal, monto);
                  setMontoText('');
                }
              }}
            />
            <Button label="Cancelar" variant="text" onPress={close} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    scrollContent: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.lg },
    flex: { flex: 1 },
    strong: { fontFamily: TYPOGRAPHY.body2Strong.fontFamily, color: colors.text },
    addButton: {
      width: MIN_TOUCH,
      height: MIN_TOUCH,
      borderRadius: MIN_TOUCH / 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    skeleton: { borderRadius: RADIUS.lg, marginBottom: SPACING.sm },
    mutedCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
    mutedText: { ...TYPOGRAPHY.body2, color: colors.textSecondary, flexShrink: 1 },
    surplusCard: { marginBottom: SPACING.sm, gap: 4 },
    surplusHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
    surplusLabel: { ...TYPOGRAPHY.body2Strong, color: colors.text },
    surplusAmount: { ...TYPOGRAPHY.h1, color: colors.success },
    surplusButton: { marginTop: SPACING.sm },
    hint: { ...TYPOGRAPHY.caption, color: colors.textSecondary, marginTop: SPACING.xs },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: SPACING.xs,
      marginBottom: 4,
    },
    summaryLabel: { ...TYPOGRAPHY.h3, color: colors.text },
    summaryAmount: { ...TYPOGRAPHY.h3, color: colors.text },
    emptyButton: { alignSelf: 'stretch', marginTop: SPACING.xs },
    goalCard: { marginBottom: SPACING.sm, gap: SPACING.sm },
    goalHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    goalIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surfaceVariant,
      alignItems: 'center',
      justifyContent: 'center',
    },
    goalName: { ...TYPOGRAPHY.body1Strong, color: colors.text },
    goalAmounts: { ...TYPOGRAPHY.body2, color: colors.textSecondary, fontVariant: ['tabular-nums'] },
    goalPct: { ...TYPOGRAPHY.body1Strong, color: colors.primary, fontVariant: ['tabular-nums'] },
    completedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    completedText: { ...TYPOGRAPHY.caption, color: colors.success },
    goalFooter: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
    goalMeta: { flex: 1, gap: 2 },
    goalDeadline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    goalMetaText: { ...TYPOGRAPHY.caption, color: colors.textSecondary, flexShrink: 1 },
    goalActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    abonoButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: MIN_TOUCH,
      paddingHorizontal: SPACING.sm,
      borderRadius: RADIUS.pill,
      backgroundColor: colors.surfaceVariant,
    },
    abonoText: { ...TYPOGRAPHY.body2Strong, color: colors.primary },
    iconButton: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
    overlay: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'center', paddingHorizontal: SPACING.lg },
    dialog: { backgroundColor: colors.surface, borderRadius: RADIUS.xl, padding: SPACING.lg, gap: SPACING.sm },
    dialogTitle: { ...TYPOGRAPHY.h3, color: colors.text },
    dialogMessage: { ...TYPOGRAPHY.body2, color: colors.textSecondary },
    dialogActions: { gap: SPACING.xs },
    pickList: { maxHeight: 320 },
    pickRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      minHeight: MIN_TOUCH,
      backgroundColor: colors.surfaceVariant,
      borderRadius: RADIUS.md,
      padding: SPACING.sm,
      marginBottom: SPACING.xs,
    },
    pickName: { ...TYPOGRAPHY.body1, color: colors.text },
    pickDetail: { ...TYPOGRAPHY.caption, color: colors.textSecondary },
  });
