import React, { useCallback, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { HandCoins, LogOut, Plus, RefreshCw, Share2, Trash2, UserMinus, X } from 'lucide-react-native';
import { useTheme, useThemedStyles } from '../src/theme/ThemeProvider';
import { MIN_TOUCH, RADIUS, SPACING, ThemeColors, TYPOGRAPHY } from '../src/theme/theme';
import { authService } from '../src/services/authService';
import { budgetService } from '../src/services/budgetService';
import { goalService, MetaView } from '../src/services/goalService';
import { groupService, GrupoDetalle } from '../src/services/groupService';
import { mensajeDeError } from '../src/api/client';
import { GoalIcon } from '../src/theme/goalIcons';
import { formatAmount } from '../src/utils/currencyUtils';
import { formatDayLabel } from '../src/utils/dateUtils';
import HeroHeader from '../src/components/ui/HeroHeader';
import Button from '../src/components/ui/Button';
import Card from '../src/components/ui/Card';
import { Banner, ProgressBar } from '../src/components/ui/Form';
import { ErrorState, Skeleton } from '../src/components/ui/States';
import ConfirmDialog from '../src/components/ConfirmDialog';
import CelebrationDialog from '../src/components/CelebrationDialog';
import { AbonoDialog } from './GoalsScreen';

const horasRestantes = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 3_600_000));

/** S8-01 a S8-04: detalle de un grupo. Se actualiza al abrir y al deslizar hacia abajo (D41). */
export default function GroupDetailScreen({ navigation, route }: any) {
  const { grupoId, nombre } = route.params as { grupoId: number; nombre?: string };
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const [grupo, setGrupo] = useState<GrupoDetalle | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [moneda, setMoneda] = useState('MXN');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [abonoGoal, setAbonoGoal] = useState<MetaView | null>(null);
  const [deleteGoal, setDeleteGoal] = useState<MetaView | null>(null);
  const [removeMember, setRemoveMember] = useState<{ usuario_id: number; nombre: string } | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [celebration, setCelebration] = useState<string | null>(null);

  // Cada miembro conserva un color mientras esté en el grupo (orden de llegada)
  const colorDe = (usuarioId: number) => {
    const i = grupo?.miembros.findIndex((m) => m.usuario_id === usuarioId) ?? -1;
    return i < 0 ? colors.chartNeutral : colors.chart[i % colors.chart.length];
  };
  const fmt = (n: number) => formatAmount(n, moneda);

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setIsRefreshing(true);
      setLoadError(null);
      try {
        const session = await authService.getActiveSession();
        if (!session) {
          navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
          return;
        }
        setUserId(session.id);
        const [detalle, budget] = await Promise.all([
          groupService.getGroup(grupoId),
          budgetService.getBudgetByUserId(session.id),
        ]);
        setGrupo(detalle);
        if (budget) setMoneda(budget.moneda);
      } catch (error) {
        setLoadError(mensajeDeError(error, 'No pudimos cargar el grupo.'));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [grupoId, navigation]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const ejecutar = async (accion: () => Promise<void>, porDefecto: string) => {
    setIsWorking(true);
    setAviso(null);
    try {
      await accion();
    } catch (error) {
      setAviso(mensajeDeError(error, porDefecto));
    } finally {
      setIsWorking(false);
    }
  };

  const compartirCodigo = async () => {
    if (!grupo?.invitacion) return;
    await Share.share({
      message: `Únete a mi grupo "${grupo.nombre}" en Carterita con el código ${grupo.invitacion.codigo}. Vence en ${horasRestantes(grupo.invitacion.expira_en)} horas.`,
    }).catch(() => {});
  };

  const confirmAbono = (goal: MetaView, monto: number) =>
    ejecutar(async () => {
      const outcome = await goalService.addContribution(userId!, goal.id, monto, 'Abono');
      setAbonoGoal(null);
      if (outcome.completada) setCelebration(`Entre todos juntaron ${fmt(outcome.meta.monto_objetivo)} para "${goal.nombre}".`);
      await load();
    }, 'No se pudo registrar el abono. Inténtalo de nuevo.').finally(() => setAbonoGoal(null));

  const salir = (retirarAportes: boolean) =>
    ejecutar(async () => {
      await groupService.leaveGroup(grupoId, retirarAportes);
      setIsLeaving(false);
      navigation.goBack();
    }, 'No pudiste salir del grupo. Inténtalo de nuevo.');

  const renderInvitacion = (g: GrupoDetalle) => {
    if (g.mi_rol !== 'Admin') return null;
    return (
      <Card style={styles.card}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          Invitar
        </Text>
        {g.invitacion ? (
          <>
            <Text style={styles.code} accessibilityLabel={`Código ${g.invitacion.codigo.split('').join(' ')}`} selectable>
              {g.invitacion.codigo}
            </Text>
            <Text style={styles.muted}>
              Vence en {horasRestantes(g.invitacion.expira_en)} horas. Solo sirve para entrar; quienes ya están en el grupo
              siguen en él.
            </Text>
            <View style={styles.row}>
              <Button label="Compartir" icon={Share2} variant="secondary" onPress={compartirCodigo} style={styles.flex} />
              <Button
                label="Nuevo código"
                icon={RefreshCw}
                variant="text"
                loading={isWorking}
                onPress={() => ejecutar(async () => { await groupService.newCode(grupoId); await load(); }, 'No se pudo generar el código.')}
                style={styles.flex}
              />
            </View>
          </>
        ) : (
          <>
            <Text style={styles.muted}>El código anterior venció. Genera uno nuevo para invitar a alguien.</Text>
            <Button
              label="Generar código"
              icon={RefreshCw}
              variant="secondary"
              loading={isWorking}
              onPress={() => ejecutar(async () => { await groupService.newCode(grupoId); await load(); }, 'No se pudo generar el código.')}
            />
          </>
        )}
      </Card>
    );
  };

  const renderMeta = (meta: MetaView, g: GrupoDetalle) => {
    const puedeBorrar = g.mi_rol === 'Admin' || meta.creada_por_id === userId;
    const total = meta.monto_acumulado || 1;
    return (
      <Card key={meta.id} style={styles.card}>
        <View style={styles.row}>
          <GoalIcon icono={meta.icono} color={meta.completada ? colors.success : colors.primary} />
          <View style={styles.flex}>
            <Text style={styles.itemTitle}>{meta.nombre}</Text>
            <Text style={styles.muted}>
              <Text style={styles.strong}>{fmt(meta.monto_acumulado)}</Text> de {fmt(meta.monto_objetivo)}
            </Text>
          </View>
          <Text style={styles.strong}>{Math.round(meta.progreso * 100)}%</Text>
        </View>

        {/* Barra dividida por persona: color de cada miembro, con 2px de separación */}
        <View style={styles.stack} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {meta.aportes_por_persona.map((p) => (
            <View
              key={p.usuario_id}
              style={{ flex: (p.total / total) * meta.progreso, backgroundColor: colorDe(p.usuario_id), borderRadius: 4 }}
            />
          ))}
          <View style={{ flex: Math.max(0, 1 - meta.progreso), backgroundColor: colors.surfaceVariant, borderRadius: 4 }} />
        </View>

        {meta.aportes_por_persona.length === 0 ? (
          <Text style={styles.muted}>Aún nadie ha aportado. ¡Sé el primero!</Text>
        ) : (
          meta.aportes_por_persona.map((p) => (
            <View key={p.usuario_id} style={styles.personRow}>
              <View style={[styles.swatch, { backgroundColor: colorDe(p.usuario_id) }]} />
              <Text style={styles.personName}>
                {p.nombre}
                {p.usuario_id === userId ? ' (tú)' : ''}
                {!p.es_miembro ? ' · ya no es miembro' : ''}
              </Text>
              <Text style={styles.strong}>{fmt(p.total)}</Text>
            </View>
          ))
        )}
        {meta.retiros.map((r, i) => (
          <Text key={i} style={styles.muted}>
            {r.nombre} retiró {fmt(r.monto)} al salir del grupo.
          </Text>
        ))}

        <View style={styles.row}>
          {!meta.completada && (
            <Button label="Abonar" icon={HandCoins} variant="secondary" onPress={() => setAbonoGoal(meta)} style={styles.flex} />
          )}
          {puedeBorrar && (
            <Pressable
              style={styles.iconButton}
              onPress={() => setDeleteGoal(meta)}
              accessibilityRole="button"
              accessibilityLabel={`Eliminar meta ${meta.nombre}`}
            >
              <Trash2 color={colors.error} size={20} />
            </Pressable>
          )}
        </View>
      </Card>
    );
  };

  const renderBody = () => {
    if (isLoading) return [160, 200, 140].map((h) => <Skeleton key={h} width="100%" height={h} style={styles.skeleton} />);
    if (loadError || !grupo) return <ErrorState message={loadError ?? 'No pudimos cargar el grupo.'} onRetry={() => load()} />;
    const g = grupo;
    return (
      <>
        {aviso && (
          <Banner
            tone="error"
            message={aviso}
            action={
              <Pressable onPress={() => setAviso(null)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cerrar aviso">
                <X color={colors.error} size={18} />
              </Pressable>
            }
          />
        )}

        {renderInvitacion(g)}

        <Card style={styles.card}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Miembros ({g.miembros.length} de 6)
          </Text>
          {g.miembros.map((m) => (
            <View key={m.usuario_id} style={styles.personRow}>
              <View style={[styles.swatch, { backgroundColor: colorDe(m.usuario_id) }]} />
              <Text style={styles.personName}>
                {m.nombre}
                {m.usuario_id === userId ? ' (tú)' : ''}
              </Text>
              {m.rol === 'Admin' && <Text style={styles.badge}>Admin</Text>}
              {g.mi_rol === 'Admin' && m.usuario_id !== userId && (
                <Pressable
                  style={styles.iconButton}
                  onPress={() => setRemoveMember(m)}
                  accessibilityRole="button"
                  accessibilityLabel={`Quitar a ${m.nombre} del grupo`}
                >
                  <UserMinus color={colors.error} size={18} />
                </Pressable>
              )}
            </View>
          ))}
        </Card>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Metas del grupo
          </Text>
          <Button
            label="Nueva meta"
            icon={Plus}
            variant="text"
            onPress={() => navigation.navigate('CreateGoal', { grupoId, grupoNombre: g.nombre })}
          />
        </View>
        {g.metas.length === 0 ? (
          <Text style={[styles.muted, styles.emptyText]}>Creen una meta para ahorrar juntos, como un viaje o algo para la casa.</Text>
        ) : (
          g.metas.map((meta) => renderMeta(meta, g))
        )}

        <Card style={styles.card}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Gastos compartidos del mes
          </Text>
          {g.gastos.lista.length === 0 ? (
            <Text style={styles.muted}>
              Al registrar un gasto, elige "Compartir con {g.nombre}" para que aparezca aquí. Sigue contando en el presupuesto
              de quien pagó.
            </Text>
          ) : (
            <>
              <Text style={styles.total}>{fmt(g.gastos.total)}</Text>
              {g.gastos.por_miembro.map((p) => (
                <View key={p.usuario_id} style={styles.personRow}>
                  <View style={[styles.swatch, { backgroundColor: colorDe(p.usuario_id) }]} />
                  <Text style={styles.personName}>
                    {p.nombre}
                    {!p.es_miembro ? ' · ya no es miembro' : ''}
                  </Text>
                  <Text style={styles.muted}>{p.porcentaje} %</Text>
                  <Text style={styles.strong}>{fmt(p.total)}</Text>
                </View>
              ))}
              <View style={styles.divider} />
              {g.gastos.lista.slice(0, 15).map((gasto) => (
                <View key={gasto.id} style={styles.expenseRow}>
                  <View style={styles.flex}>
                    <Text style={styles.personName}>{gasto.concepto}</Text>
                    <Text style={styles.muted}>
                      {gasto.nombre_usuario} · {formatDayLabel(gasto.fecha_local)}
                    </Text>
                  </View>
                  <Text style={styles.strong}>{fmt(gasto.monto)}</Text>
                </View>
              ))}
            </>
          )}
        </Card>

        <Button label="Salir del grupo" icon={LogOut} variant="text" onPress={() => setIsLeaving(true)} />
      </>
    );
  };

  return (
    <View style={styles.screen}>
      <HeroHeader title={grupo?.nombre ?? nombre ?? 'Grupo'} onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => load(true)}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        {renderBody()}
      </ScrollView>

      <AbonoDialog goal={abonoGoal} moneda={moneda} isSaving={isWorking} onCancel={() => setAbonoGoal(null)} onConfirm={confirmAbono} />

      <ConfirmDialog
        visible={deleteGoal !== null}
        title="¿Eliminar meta del grupo?"
        message={`Se eliminará "${deleteGoal?.nombre ?? ''}" con los aportes de todos los miembros.`}
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => {
          const meta = deleteGoal!;
          setDeleteGoal(null);
          ejecutar(async () => { await goalService.deleteGoal(userId!, meta.id); await load(); }, 'No se pudo eliminar la meta.');
        }}
        onCancel={() => setDeleteGoal(null)}
      />

      <ConfirmDialog
        visible={removeMember !== null}
        title={`¿Quitar a ${removeMember?.nombre ?? ''}?`}
        message="Dejará de ver el grupo. Lo que aportó a las metas se queda: no puedes decidir sobre el dinero de otra persona."
        confirmLabel="Quitar"
        destructive
        onConfirm={() => {
          const miembro = removeMember!;
          setRemoveMember(null);
          ejecutar(async () => { await groupService.removeMember(grupoId, miembro.usuario_id); await load(); }, 'No se pudo quitar al miembro.');
        }}
        onCancel={() => setRemoveMember(null)}
      />

      {/* D43: al salir se elige qué pasa con lo aportado */}
      <Modal visible={isLeaving} transparent animationType="fade" onRequestClose={() => setIsLeaving(false)}>
        <View style={styles.overlay}>
          <View style={styles.dialog} accessibilityViewIsModal>
            <Text style={styles.dialogTitle} accessibilityRole="header">
              ¿Salir de "{grupo?.nombre}"?
            </Text>
            <Text style={styles.muted}>
              Dejarás de ver el grupo. Tus gastos compartidos se quedan en su historial. ¿Qué hacemos con lo que aportaste a
              sus metas?
            </Text>
            <Button label="Dejar mis aportes" loading={isWorking} onPress={() => salir(false)} />
            <Button label="Retirar mis aportes" variant="secondary" disabled={isWorking} onPress={() => salir(true)} />
            <Button label="Cancelar" variant="text" onPress={() => setIsLeaving(false)} />
          </View>
        </View>
      </Modal>

      <CelebrationDialog
        visible={celebration !== null}
        title="¡Meta completada!"
        message={celebration ?? ''}
        completed
        onClose={() => setCelebration(null)}
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: SPACING.md, paddingBottom: SPACING.xl, gap: SPACING.sm },
    skeleton: { borderRadius: RADIUS.lg },
    card: { gap: SPACING.xs },
    flex: { flex: 1 },
    row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.xs },
    sectionTitle: { ...TYPOGRAPHY.h3, color: colors.text },
    itemTitle: { ...TYPOGRAPHY.body1Strong, color: colors.text },
    muted: { ...TYPOGRAPHY.body2, color: colors.textSecondary },
    strong: { ...TYPOGRAPHY.body2Strong, color: colors.text },
    total: { ...TYPOGRAPHY.h2, color: colors.text },
    emptyText: { paddingHorizontal: SPACING.xs },
    code: { ...TYPOGRAPHY.h1, color: colors.primary, letterSpacing: 6, textAlign: 'center', paddingVertical: SPACING.xs },
    stack: { flexDirection: 'row', height: 10, gap: 2, borderRadius: 4, overflow: 'hidden', marginVertical: 4 },
    personRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, minHeight: 32 },
    personName: { ...TYPOGRAPHY.body2, color: colors.text, flex: 1 },
    swatch: { width: 12, height: 12, borderRadius: 3 },
    badge: {
      ...TYPOGRAPHY.caption,
      color: colors.primary,
      backgroundColor: colors.surfaceVariant,
      borderRadius: RADIUS.pill,
      paddingHorizontal: SPACING.xs,
      paddingVertical: 2,
      overflow: 'hidden',
    },
    iconButton: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
    divider: { height: 1, backgroundColor: colors.divider, marginVertical: SPACING.xs },
    expenseRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, minHeight: 44 },
    overlay: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'center', padding: SPACING.md },
    dialog: { backgroundColor: colors.surface, borderRadius: RADIUS.xl, padding: SPACING.lg, gap: SPACING.sm },
    dialogTitle: { ...TYPOGRAPHY.h3, color: colors.text },
  });
