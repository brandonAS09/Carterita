import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { PackageOpen, Search } from 'lucide-react-native';
import { authService } from '../src/services/authService';
import { budgetService } from '../src/services/budgetService';
import { Categoria, Transaccion, transactionService } from '../src/services/transactionService';
import { useTheme, useThemedStyles } from '../src/theme/ThemeProvider';
import { SPACING, ThemeColors, TYPOGRAPHY } from '../src/theme/theme';
import { formatDayLabel } from '../src/utils/dateUtils';
import { filterTransactions, groupByDay } from '../src/utils/historyUtils';
import HeroHeader from '../src/components/ui/HeroHeader';
import TextField from '../src/components/ui/TextField';
import { Chip } from '../src/components/ui/Form';
import { TransactionRow } from '../src/components/ui/HomeBlocks';
import { EmptyState, ErrorState, Skeleton } from '../src/components/ui/States';

const formatTime = (fecha: string) =>
  new Date(fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

/** S5-11: historial de solo lectura (D14). Editar y borrar quedan para un sprint de funciones. */
export default function HistoryScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const [items, setItems] = useState<Transaccion[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [moneda, setMoneda] = useState('MXN');
  const [query, setQuery] = useState('');
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadFailed(false);
    try {
      const session = await authService.getActiveSession();
      if (!session) {
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        return;
      }
      const [all, cats, budget] = await Promise.all([
        transactionService.getAllTransactions(session.id),
        transactionService.getAllCategories(),
        budgetService.getBudgetByUserId(session.id),
      ]);
      setItems(all);
      setCategorias(cats);
      if (budget) setMoneda(budget.moneda);
    } catch (error) {
      console.error('Error cargando el historial:', error);
      setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, [navigation]);

  useEffect(() => {
    load();
  }, [load]);

  const groups = useMemo(() => groupByDay(filterTransactions(items, query, categoriaId)), [items, query, categoriaId]);

  const renderList = () => {
    if (isLoading) {
      return [1, 2, 3, 4].map((i) => (
        <View key={i} style={styles.skeletonRow}>
          <Skeleton width={40} height={40} style={styles.skeletonIcon} />
          <View style={styles.skeletonText}>
            <Skeleton width="70%" height={14} />
            <Skeleton width="40%" height={12} />
          </View>
        </View>
      ));
    }
    if (loadFailed) {
      return <ErrorState message="No pudimos cargar tu historial. Inténtalo de nuevo." onRetry={load} />;
    }
    if (groups.length === 0) {
      const hasFilters = !!query.trim() || categoriaId !== null;
      return (
        <EmptyState
          icon={PackageOpen}
          message={hasFilters ? 'Ningún gasto coincide con tu búsqueda.' : 'Aún no hay gastos. Registra el primero en segundos.'}
        />
      );
    }
    return groups.map((group, index) => (
      <View key={group.day} style={styles.group}>
        {/* Línea de tiempo: decorativa, oculta para lectores de pantalla */}
        <View style={styles.timeline} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={styles.dot} />
          {index < groups.length - 1 && <View style={styles.line} />}
        </View>
        <View style={styles.groupBody}>
          <Text style={styles.dayLabel} accessibilityRole="header">
            {formatDayLabel(group.day)}
          </Text>
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
      </View>
    ));
  };

  return (
    <View style={styles.screen}>
      <HeroHeader title="Historial" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TextField
          accessibilityLabel="Buscar por concepto"
          placeholder="Buscar por concepto"
          value={query}
          onChangeText={setQuery}
          leftIcon={Search}
          returnKeyType="search"
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters} contentContainerStyle={styles.filtersContent}>
          <Chip label="Todas" selected={categoriaId === null} onPress={() => setCategoriaId(null)} />
          {categorias.map((cat) => (
            <Chip
              key={cat.id}
              label={cat.nombre}
              selected={categoriaId === cat.id}
              onPress={() => setCategoriaId(categoriaId === cat.id ? null : cat.id)}
            />
          ))}
        </ScrollView>
        <View style={{ backgroundColor: colors.background }}>{renderList()}</View>
      </ScrollView>
    </View>
  );
}

const DOT_SIZE = 12;

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xl },
    filters: { marginTop: SPACING.sm, marginBottom: SPACING.md, marginHorizontal: -SPACING.md, flexGrow: 0 },
    filtersContent: { gap: SPACING.xs, paddingHorizontal: SPACING.md },
    group: { flexDirection: 'row', gap: SPACING.sm },
    timeline: { width: DOT_SIZE, alignItems: 'center' },
    dot: { width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2, backgroundColor: colors.primary, marginTop: 4 },
    line: { flex: 1, width: 2, backgroundColor: colors.divider, marginTop: 4 },
    groupBody: { flex: 1, paddingBottom: SPACING.sm },
    dayLabel: { ...TYPOGRAPHY.body2Strong, color: colors.textSecondary },
    skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.xs },
    skeletonIcon: { borderRadius: 20 },
    skeletonText: { flex: 1, gap: SPACING.xs },
  });
