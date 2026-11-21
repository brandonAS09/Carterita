import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WifiOff } from 'lucide-react-native';
import { onPeticionesLentas } from '../../api/client';
import { useTheme } from '../../theme/ThemeProvider';
import { SPACING, TYPOGRAPHY } from '../../theme/theme';

/**
 * S7-07: banda fija arriba.
 * - "Sin conexión" mientras el teléfono no tiene internet (desaparece sola al volver).
 * - "Conectando con el servidor…" cuando una petición tarda más de 5 s (servidor gratuito despertando).
 */
export default function NetworkBanner() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [sinConexion, setSinConexion] = useState(false);
  const [lentas, setLentas] = useState(0);

  useEffect(
    () =>
      NetInfo.addEventListener((estado) => {
        // isInternetReachable es null mientras se comprueba: solo se avisa si es falso con certeza
        setSinConexion(estado.isConnected === false || estado.isInternetReachable === false);
      }),
    []
  );
  useEffect(() => {
    const quitar = onPeticionesLentas(setLentas);
    return () => {
      quitar();
    };
  }, []);

  if (!sinConexion && lentas === 0) return null;

  const offline = sinConexion;
  return (
    <View
      style={[styles.banner, { paddingTop: insets.top + 6, backgroundColor: offline ? colors.error : colors.primary }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      {offline ? (
        <WifiOff color={colors.onPrimary} size={16} />
      ) : (
        <ActivityIndicator color={colors.onPrimary} size="small" />
      )}
      <Text style={[TYPOGRAPHY.caption, styles.text, { color: colors.onPrimary }]}>
        {offline ? 'Sin conexión. Tus datos no se pueden actualizar.' : 'Conectando con el servidor…'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    elevation: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingBottom: 6,
    paddingHorizontal: SPACING.md,
  },
  text: { flexShrink: 1, textAlign: 'center' },
});
