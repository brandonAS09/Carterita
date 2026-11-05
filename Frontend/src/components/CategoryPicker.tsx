import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, SIZES } from '../theme/theme';
import { CategoryIcon } from '../theme/categoryIcons';
import type { Categoria } from '../services/transactionService';

interface CategoryPickerProps {
  categorias: Categoria[];
  selectedId: number | null;
  onChange: (categoria: Categoria | null) => void;
}

/** Selector de categoría en chips (vista previa de Voz y Escáner). */
export default function CategoryPicker({ categorias, selectedId, onChange }: CategoryPickerProps) {
  return (
    <View style={styles.grid}>
      {categorias.map((cat) => {
        const isSelected = selectedId === cat.id;
        return (
          <TouchableOpacity
            key={cat.id}
            style={[styles.chip, isSelected && styles.chipSelected]}
            onPress={() => onChange(isSelected ? null : cat)}
            activeOpacity={0.8}
          >
            <CategoryIcon icono={cat.icono} color={isSelected ? COLORS.text : COLORS.secondary} size={16} />
            <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{cat.nombre}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SIZES.spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: SIZES.radius.button,
    paddingHorizontal: SIZES.spacing.sm,
    paddingVertical: 8,
  },
  chipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.secondary,
  },
  chipText: {
    color: COLORS.textSecondary,
    fontSize: SIZES.body2,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: COLORS.text,
    fontWeight: '700',
  },
});
