import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { CalendarDays, ChevronRight, Trash2 } from 'lucide-react-native';
import { authService } from '../src/services/authService';
import { budgetService, Presupuesto } from '../src/services/budgetService';
import { Categoria, Transaccion, transactionService } from '../src/services/transactionService';
import { useTheme, useThemedStyles } from '../src/theme/ThemeProvider';
import { MIN_TOUCH, SPACING, ThemeColors, TYPOGRAPHY } from '../src/theme/theme';
import { formatDayLabel, toLocalDateKey } from '../src/utils/dateUtils';
import ExpenseReviewForm, { ExpenseReviewValues } from '../src/components/ExpenseReviewForm';
import ConfirmDialog from '../src/components/ConfirmDialog';
import HeroHeader from '../src/components/ui/HeroHeader';
import Button from '../src/components/ui/Button';
import Card from '../src/components/ui/Card';
import DatePickerDialog from '../src/components/ui/DatePickerDialog';
import { Banner } from '../src/components/ui/Form';
import { ErrorState } from '../src/components/ui/States';
import { mensajeDeError } from '../src/api/client';

const MSG_DELETE_ERROR = 'No se pudo eliminar el gasto. Inténtalo de nuevo.';

/** F08.1: corregir o eliminar un gasto. Inicio recalcula con F06 al recibir el foco. */
export default function EditExpenseScreen({ navigation, route }: any) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const transactionId: number = route.params.id;

  const [userId, setUserId] = useState<number | null>(null);
  const [expense, setExpense] = useState<Transaccion | null>(null);
  const [budget, setBudget] = useState<Presupuesto | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [fechaKey, setFechaKey] = useState('');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    setIsLoading(true);
    try {
      const session = await authService.getActiveSession();
      if (!session) {
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        return;
      }
      setUserId(session.id);
      const [tx, b, cats] = await Promise.all([
        transactionService.getTransactionById(session.id, transactionId),
        budgetService.getBudgetByUserId(session.id),
        transactionService.getAllCategories(),
      ]);
      setExpense(tx);
      setBudget(b);
      setCategorias(cats);
      if (tx) setFechaKey(tx.fecha_local ?? toLocalDateKey(new Date(tx.fecha)));
    } catch (error) {
      console.error('Error al cargar el gasto:', error);
      setExpense(null);
      setLoadError(mensajeDeError(error));
    } finally {
      setIsLoading(false);
    }
  }, [navigation, transactionId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async ({ monto, concepto, categoriaId }: ExpenseReviewValues) => {
    const originalKey = toLocalDateKey(new Date(expense!.fecha));
    await transactionService.updateTransaction(userId!, transactionId, {
      monto,
      concepto,
      categoriaId,
      // Sin cambio de fecha se conserva la hora original
      fechaKey: fechaKey !== originalKey ? fechaKey : undefined,
    });
    navigation.goBack();
  };

  const handleDelete = async () => {
    setIsConfirmingDelete(false);
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await transactionService.deleteTransaction(userId!, transactionId);
      navigation.goBack();
    } catch (error) {
      console.error('Error al eliminar el gasto:', error);
      setDeleteError(mensajeDeError(error, MSG_DELETE_ERROR));
      setIsDeleting(false);
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }
    if (loadError) {
      return <ErrorState message={loadError} onRetry={load} />;
    }
    if (!expense) {
      return <ErrorState message="Este gasto ya no existe. Puede que se haya eliminado desde otro dispositivo." />;
    }
    return (
      <ExpenseReviewForm
        initial={{
          monto: expense.monto,
          moneda: budget?.moneda ?? 'MXN',
          concepto: expense.concepto,
          categoria: expense.categoria_nombre ?? null,
        }}
        budget={budget}
        categorias={categorias}
        userId={userId}
        saveLabel="Guardar cambios"
        hideCategoryBadge
        header={deleteError && <Banner tone="error" message={deleteError} />}
        extra={
          <Pressable
            onPress={() => setIsDatePickerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`Fecha del gasto: ${formatDayLabel(fechaKey)}. Cambiar`}
          >
            <Card style={styles.dateRow}>
              <CalendarDays color={colors.primary} size={20} />
              <View style={styles.dateText}>
                <Text style={styles.dateLabel}>Fecha</Text>
                <Text style={styles.dateValue}>{formatDayLabel(fechaKey)}</Text>
              </View>
              <ChevronRight color={colors.textSecondary} size={20} />
            </Card>
          </Pressable>
        }
        footer={(isSaving) => (
          <Pressable
            style={styles.deleteButton}
            onPress={() => setIsConfirmingDelete(true)}
            disabled={isSaving || isDeleting}
            accessibilityRole="button"
          >
            <Trash2 color={colors.error} size={18} />
            <Text style={styles.deleteText}>Eliminar gasto</Text>
          </Pressable>
        )}
        onSave={handleSave}
      />
    );
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.screen}>
      <HeroHeader title="Editar Gasto" onBack={() => navigation.goBack()} />
      {renderContent()}

      {!!fechaKey && (
        <DatePickerDialog
          visible={isDatePickerOpen}
          value={fechaKey}
          onSelect={(key) => {
            setFechaKey(key);
            setIsDatePickerOpen(false);
          }}
          onClose={() => setIsDatePickerOpen(false)}
        />
      )}

      <ConfirmDialog
        visible={isConfirmingDelete}
        title="¿Eliminar este gasto?"
        message={`Se eliminará "${expense?.concepto ?? ''}" y tu presupuesto se recalculará. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setIsConfirmingDelete(false)}
      />
      {isDeleting && <View style={styles.blocker} />}
      {isDeleting && (
        <View style={styles.blockerSpinner}>
          <Button label="Eliminando" onPress={() => {}} loading />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    dateRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
    dateText: { flex: 1 },
    dateLabel: { ...TYPOGRAPHY.body1Strong, color: colors.text },
    dateValue: { ...TYPOGRAPHY.body2, color: colors.textSecondary },
    deleteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.xs,
      minHeight: MIN_TOUCH,
      marginTop: SPACING.xs,
    },
    deleteText: { ...TYPOGRAPHY.body1Strong, color: colors.error },
    blocker: { ...StyleSheet.absoluteFill, backgroundColor: colors.scrim },
    blockerSpinner: { position: 'absolute', left: SPACING.lg, right: SPACING.lg, top: '45%' },
  });
