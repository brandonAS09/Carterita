import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, SIZES } from '../theme/theme';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
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
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onCancel} activeOpacity={0.8}>
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.confirmButton]} onPress={onConfirm} activeOpacity={0.8}>
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    paddingHorizontal: SIZES.spacing.lg,
  },
  card: {
    backgroundColor: COLORS.tertiary,
    borderRadius: SIZES.radius.card,
    borderWidth: 1,
    borderColor: COLORS.primary,
    padding: SIZES.spacing.lg,
  },
  title: {
    color: COLORS.text,
    fontSize: SIZES.h2 - 4,
    fontWeight: 'bold',
    marginBottom: SIZES.spacing.xs,
  },
  message: {
    color: COLORS.textSecondary,
    fontSize: SIZES.body2,
    lineHeight: 20,
    marginBottom: SIZES.spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    gap: SIZES.spacing.xs,
  },
  button: {
    flex: 1,
    minHeight: 48,
    borderRadius: SIZES.radius.button,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SIZES.spacing.sm,
  },
  cancelButton: {
    borderWidth: 2,
    borderColor: COLORS.secondary,
  },
  confirmButton: {
    backgroundColor: COLORS.secondary,
  },
  cancelText: {
    color: COLORS.secondary,
    fontSize: SIZES.body1,
    fontWeight: '600',
  },
  confirmText: {
    color: COLORS.background,
    fontSize: SIZES.body1,
    fontWeight: 'bold',
  },
});
