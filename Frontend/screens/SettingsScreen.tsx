import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChevronRight, LogOut, Wallet } from 'lucide-react-native';
import { authService } from '../src/services/authService';
import { ThemePreference, useTheme, useThemedStyles } from '../src/theme/ThemeProvider';
import { MIN_TOUCH, RADIUS, SPACING, ThemeColors, TYPOGRAPHY } from '../src/theme/theme';
import HeroHeader from '../src/components/ui/HeroHeader';
import Card from '../src/components/ui/Card';
import Button from '../src/components/ui/Button';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
];

/** S5-08: tema, datos de la cuenta, presupuesto y cierre de sesión. */
export default function SettingsScreen({ navigation }: any) {
  const { colors, preference, setPreference } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [account, setAccount] = useState<{ nombre: string; email: string } | null>(null);

  useEffect(() => {
    authService
      .getActiveSession()
      .then((session) => session && setAccount({ nombre: session.nombre, email: session.email }))
      .catch((error) => console.error('Error al cargar la cuenta:', error));
  }, []);

  const handleLogout = async () => {
    await authService.logout();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  return (
    <View style={styles.screen}>
      <HeroHeader title="Ajustes" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Apariencia</Text>
        <Card>
          <Text style={styles.rowLabel}>Tema</Text>
          <View style={styles.segmented} accessibilityRole="radiogroup">
            {THEME_OPTIONS.map((option) => {
              const isSelected = option.value === preference;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setPreference(option.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  style={[styles.segment, isSelected && { backgroundColor: colors.primary }]}
                >
                  <Text style={[styles.segmentText, isSelected && { color: colors.onPrimary }]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        <Text style={styles.sectionTitle}>Cuenta</Text>
        <Card>
          <Text style={styles.rowLabel}>{account?.nombre ?? ' '}</Text>
          <Text style={styles.rowSecondary}>{account?.email ?? ' '}</Text>
        </Card>

        <Text style={styles.sectionTitle}>Presupuesto</Text>
        <Pressable
          onPress={() => navigation.navigate('BudgetSetup', { mode: 'edit' })}
          accessibilityRole="button"
          style={styles.linkRow}
        >
          <Wallet color={colors.primary} size={20} />
          <Text style={[styles.rowLabel, styles.linkText]}>Editar presupuesto</Text>
          <ChevronRight color={colors.textSecondary} size={20} />
        </Pressable>

        <Button label="Cerrar sesión" variant="secondary" icon={LogOut} onPress={handleLogout} style={styles.logout} />
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xl, gap: SPACING.xs },
    sectionTitle: { ...TYPOGRAPHY.h3, color: colors.text, marginTop: SPACING.md },
    rowLabel: { ...TYPOGRAPHY.body1, color: colors.text },
    rowSecondary: { ...TYPOGRAPHY.body2, color: colors.textSecondary },
    segmented: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceVariant,
      borderRadius: RADIUS.pill,
      padding: 4,
      marginTop: SPACING.xs,
    },
    segment: {
      flex: 1,
      minHeight: MIN_TOUCH - 8,
      borderRadius: RADIUS.pill,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    segmentText: { ...TYPOGRAPHY.body2Strong, color: colors.text },
    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      minHeight: MIN_TOUCH,
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
    },
    linkText: { flex: 1 },
    logout: { marginTop: SPACING.lg },
  });
