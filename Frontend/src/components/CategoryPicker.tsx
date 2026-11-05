import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH, RADIUS, SPACING, TYPOGRAPHY } from '../theme/theme';
import { CategoryIcon } from '../theme/categoryIcons';
import type { Categoria } from '../services/transactionService';

interface CategoryPickerProps {
  categorias: Categoria[];
  selectedId: number | null;
  onChange: (categoria: Categoria | null) => void;
}

/** Selector de categoría en chips (vista previa de Voz y Escáner). */
export default function CategoryPicker({ categorias, selectedId, onChange }: CategoryPickerProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.grid}>
      {categorias.map((cat) => {
        const isSelected = selectedId === cat.id;
        const fg = isSelected ? colors.onPrimary : colors.text;
        return (
          <Pressable
            key={cat.id}
            onPress={() => onChange(isSelected ? null : cat)}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            style={[styles.chip, { backgroundColor: isSelected ? colors.primary : colors.surfaceVariant }]}
          >
            <CategoryIcon icono={cat.icono} color={isSelected ? colors.onPrimary : colors.primary} size={16} />
            <Text style={[TYPOGRAPHY.body2, { color: fg }]}>{cat.nombre}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: MIN_TOUCH,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md,
  },
});
