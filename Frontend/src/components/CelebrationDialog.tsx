import React, { useEffect, useRef } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import { Trophy, Sparkles } from 'lucide-react-native';
import { COLORS, SIZES } from '../theme/theme';

interface CelebrationDialogProps {
  visible: boolean;
  title: string;
  message: string;
  completed?: boolean; // insignia especial de meta completada
  onClose: () => void;
}

/** Felicitación gamificada (F07): insignia con efecto de escala y giro. */
export default function CelebrationDialog({ visible, title, message, completed, onClose }: CelebrationDialogProps) {
  const scale = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    scale.setValue(0);
    rotate.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }),
      Animated.timing(rotate, { toValue: 1, duration: 600, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
    ]).start();
  }, [visible, scale, rotate]);

  const spin = rotate.interpolate({ inputRange: [0, 1], outputRange: ['-30deg', '0deg'] });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Animated.View style={[styles.badge, completed && styles.badgeCompleted, { transform: [{ scale }, { rotate: spin }] }]}>
            {completed ? <Trophy color={COLORS.background} size={44} /> : <Sparkles color={COLORS.background} size={44} />}
          </Animated.View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <TouchableOpacity style={styles.button} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.buttonText}>¡Genial!</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    paddingHorizontal: SIZES.spacing.lg,
  },
  card: {
    backgroundColor: COLORS.tertiary,
    borderRadius: SIZES.radius.card,
    borderWidth: 1,
    borderColor: COLORS.secondary,
    padding: SIZES.spacing.lg,
    alignItems: 'center',
  },
  badge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SIZES.spacing.md,
  },
  badgeCompleted: { backgroundColor: '#E0B33A' },
  title: { color: COLORS.text, fontSize: SIZES.h2, fontWeight: 'bold', textAlign: 'center' },
  message: {
    color: COLORS.textSecondary,
    fontSize: SIZES.body2,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: SIZES.spacing.xs,
    marginBottom: SIZES.spacing.lg,
  },
  button: {
    alignSelf: 'stretch',
    backgroundColor: COLORS.secondary,
    borderRadius: SIZES.radius.button,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: { color: COLORS.background, fontSize: SIZES.body1, fontWeight: 'bold' },
});
