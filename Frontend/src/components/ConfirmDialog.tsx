import React from 'react';
import { Modal, View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { RADIUS, SPACING, TYPOGRAPHY } from '../theme/theme';
import Button from './ui/Button';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** La confirmación elimina algo: el botón usa el color de error. */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Diálogo de confirmación con el estilo de la guía UX/UI (reemplaza a Alert.alert). */
export default function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancelar',
  destructive,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={[styles.overlay, { backgroundColor: colors.scrim }]}>
        <View style={[styles.card, { backgroundColor: colors.surface }]} accessibilityViewIsModal>
          <Text style={[TYPOGRAPHY.h3, { color: colors.text }]} accessibilityRole="header">
            {title}
          </Text>
          <Text style={[TYPOGRAPHY.body2, { color: colors.textSecondary }]}>{message}</Text>
          <View style={styles.actions}>
            <Button label={confirmLabel} variant={destructive ? 'destructive' : 'primary'} onPress={onConfirm} />
            <Button label={cancelLabel} variant="text" onPress={onCancel} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', paddingHorizontal: SPACING.lg },
  card: { borderRadius: RADIUS.xl, padding: SPACING.lg, gap: SPACING.sm },
  actions: { gap: SPACING.xs, marginTop: SPACING.xs },
});
