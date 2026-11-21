import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { Users } from 'lucide-react-native';
import { groupService, GrupoResumen } from '../services/groupService';
import { useTheme } from '../theme/ThemeProvider';
import { SPACING, TYPOGRAPHY } from '../theme/theme';
import { Chip, FormSection } from './ui/Form';

interface Props {
  value: number | null;
  onChange: (grupoId: number | null) => void;
}

/**
 * S8-03: "Compartir con…" al registrar un gasto. Por defecto no se comparte.
 * Si el usuario no tiene grupos o no hay red, no se muestra: compartir nunca bloquea el registro.
 */
export default function ShareWithGroupPicker({ value, onChange }: Props) {
  const { colors } = useTheme();
  const [grupos, setGrupos] = useState<GrupoResumen[]>([]);

  useEffect(() => {
    groupService
      .getGroups()
      .then(setGrupos)
      .catch(() => setGrupos([]));
  }, []);

  if (grupos.length === 0) return null;
  return (
    <FormSection title="Compartir con" icon={Users} badge="Opcional">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label="Solo para mí" selected={value === null} onPress={() => onChange(null)} />
        {grupos.map((g) => (
          <Chip key={g.id} label={g.nombre} selected={value === g.id} onPress={() => onChange(g.id)} />
        ))}
      </ScrollView>
      {value !== null && (
        <Text style={[TYPOGRAPHY.caption, styles.hint, { color: colors.textSecondary }]}>
          El grupo verá este gasto. Sigue contando en tu presupuesto personal.
        </Text>
      )}
    </FormSection>
  );
}

const styles = StyleSheet.create({
  chips: { gap: SPACING.xs },
  hint: { marginTop: SPACING.xs },
});
