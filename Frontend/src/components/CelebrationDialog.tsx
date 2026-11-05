import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Modal, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { RADIUS, SPACING, TYPOGRAPHY } from '../theme/theme';
import { notifySuccess } from '../utils/feedback';
import { useReducedMotion } from '../utils/useReducedMotion';
import Button from './ui/Button';

interface CelebrationDialogProps {
  visible: boolean;
  title: string;
  message: string;
  completed?: boolean; // meta completada: incluye confeti
  onClose: () => void;
}

const CONFETTI_COUNT = 18;
const CONFETTI_DURATION = 1200; // máximo de la sección 9 de la guía
const CONFETTI_SPREAD = 150;
const CONFETTI_FALL = 170;

/** Logro (F07): check en círculo magenta, vibración ligera y confeti breve. */
export default function CelebrationDialog({ visible, title, message, completed, onClose }: CelebrationDialogProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const scale = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;

  const pieces = useMemo(
    () =>
      Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
        x: ((i / (CONFETTI_COUNT - 1)) * 2 - 1) * CONFETTI_SPREAD,
        lift: 30 + ((i * 37) % 60),
        spin: `${(i % 2 ? 1 : -1) * (180 + (i * 53) % 360)}deg`,
      })),
    []
  );
  const confettiColors = [colors.accent, colors.primary, colors.success, colors.warning];

  useEffect(() => {
    if (!visible) return;
    notifySuccess();
    if (reduceMotion) {
      scale.setValue(1);
      burst.setValue(1);
      return;
    }
    scale.setValue(0);
    burst.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }),
      Animated.timing(burst, { toValue: 1, duration: CONFETTI_DURATION, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [visible, reduceMotion, scale, burst]);

  const showConfetti = !!completed && !reduceMotion;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: colors.scrim }]}>
        <View style={[styles.card, { backgroundColor: colors.surface }]} accessibilityViewIsModal>
          <View style={styles.badgeArea}>
            {showConfetti && (
              <View
                style={styles.confetti}
                pointerEvents="none"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                {pieces.map((piece, i) => (
                  <Animated.View
                    key={i}
                    style={[
                      styles.piece,
                      {
                        backgroundColor: confettiColors[i % confettiColors.length],
                        opacity: burst.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 1, 0] }),
                        transform: [
                          { translateX: burst.interpolate({ inputRange: [0, 1], outputRange: [0, piece.x] }) },
                          {
                            translateY: burst.interpolate({
                              inputRange: [0, 0.35, 1],
                              outputRange: [0, -piece.lift, CONFETTI_FALL],
                            }),
                          },
                          { rotate: burst.interpolate({ inputRange: [0, 1], outputRange: ['0deg', piece.spin] }) },
                        ],
                      },
                    ]}
                  />
                ))}
              </View>
            )}
            <Animated.View style={[styles.badge, { backgroundColor: colors.accent, transform: [{ scale }] }]}>
              <Check color={colors.onAccent} size={48} strokeWidth={3} />
            </Animated.View>
          </View>
          <Text style={[TYPOGRAPHY.h2, styles.center, { color: colors.text }]} accessibilityRole="header">
            {title}
          </Text>
          <Text style={[TYPOGRAPHY.body2, styles.center, { color: colors.textSecondary }]}>{message}</Text>
          <Button label="¡Genial!" onPress={onClose} style={styles.button} />
        </View>
      </View>
    </Modal>
  );
}

const BADGE_SIZE = 96;

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', paddingHorizontal: SPACING.lg },
  card: { borderRadius: RADIUS.xl, padding: SPACING.lg, alignItems: 'center', gap: SPACING.xs },
  badgeArea: { width: BADGE_SIZE, height: BADGE_SIZE, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.xs },
  badge: { width: BADGE_SIZE, height: BADGE_SIZE, borderRadius: BADGE_SIZE / 2, alignItems: 'center', justifyContent: 'center' },
  confetti: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  piece: { position: 'absolute', width: 8, height: 12, borderRadius: 2 },
  center: { textAlign: 'center' },
  button: { alignSelf: 'stretch', marginTop: SPACING.sm },
});
