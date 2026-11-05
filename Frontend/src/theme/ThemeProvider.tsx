import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SystemUI from 'expo-system-ui';
import { darkColors, lightColors, ThemeColors } from './theme';

export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'carterita.themePreference';
const isPreference = (value: string | null): value is ThemePreference =>
  value === 'system' || value === 'light' || value === 'dark';

interface ThemeContextValue {
  colors: ThemeColors;
  isDark: boolean;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  /** false hasta leer la preferencia guardada: la pantalla de inicio sigue visible. */
  isReady: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Sección 8 de la guía: preferencia del dispositivo (Sistema, Claro u Oscuro), con cambio en vivo. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (isPreference(saved)) setPreferenceState(saved);
      })
      .catch(() => {
        /* sin preferencia guardada se usa la del sistema */
      })
      .finally(() => setIsReady(true));
  }, []);

  // Hace que los elementos nativos (teclado, diálogos del sistema) sigan el tema elegido
  useEffect(() => {
    Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {
      /* si falla, el tema aplica solo en esta sesión */
    });
  }, []);

  const isDark = preference === 'system' ? systemScheme === 'dark' : preference === 'dark';
  const colors = isDark ? darkColors : lightColors;

  // Evita destellos del fondo nativo entre pantallas
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
  }, [colors.background]);

  const value = useMemo(
    () => ({ colors, isDark, preference, setPreference, isReady }),
    [colors, isDark, preference, setPreference, isReady]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme debe usarse dentro de ThemeProvider');
  return context;
};

/** Estilos que reaccionan al tema: `const styles = useThemedStyles(createStyles);` */
export const useThemedStyles = <T,>(createStyles: (colors: ThemeColors) => T): T => {
  const { colors } = useTheme();
  return useMemo(() => createStyles(colors), [colors, createStyles]);
};
