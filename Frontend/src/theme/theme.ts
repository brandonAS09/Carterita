import type { TextStyle } from 'react-native';

/** Tokens de color de UX_UI_Guide_v2.md (sección 2). Ninguna pantalla define colores propios. */
export const lightColors = {
  background: '#F7F5FC',
  surface: '#FFFFFF',
  surfaceVariant: '#EFEBF8',
  text: '#1E1436',
  textSecondary: '#655C7D',
  primary: '#5B21B6',
  onPrimary: '#FFFFFF',
  primaryPressed: '#4C1D95',
  accent: '#C2187A',
  onAccent: '#FFFFFF',
  accentPressed: '#A3146A',
  success: '#0F7B4F',
  warning: '#A15C00',
  error: '#C62828',
  onError: '#FFFFFF',
  border: '#8F87A6',
  divider: '#E4DFF0',
  heroStart: '#3B1A8F',
  heroEnd: '#7C3AED',
  tileBudget: '#5B21B6',
  tileSpent: '#1E3A8A',
  tileSaved: '#C2187A',
  onHero: '#FFFFFF',
  onHeroSecondary: 'rgba(255, 255, 255, 0.85)',
  heroChip: 'rgba(0, 0, 0, 0.22)',
  scrim: 'rgba(0, 0, 0, 0.5)',
};

export type ThemeColors = typeof lightColors;

export const darkColors: ThemeColors = {
  background: '#120C22',
  surface: '#1D1533',
  surfaceVariant: '#2A2045',
  text: '#F1EEFA',
  textSecondary: '#B3AAC9',
  primary: '#B794F6',
  onPrimary: '#1A0F33',
  primaryPressed: '#A17FE8',
  accent: '#F472B6',
  onAccent: '#2B0A1E',
  accentPressed: '#EC5BA6',
  success: '#4ADE9B',
  warning: '#F5B451',
  error: '#FF8A80',
  onError: '#2B0A1E',
  border: '#7A6F96',
  divider: '#32274F',
  heroStart: '#23124F',
  heroEnd: '#5B2BB5',
  tileBudget: '#5B35B5',
  tileSpent: '#2A4596',
  tileSaved: '#A8175F',
  onHero: '#FFFFFF',
  onHeroSecondary: 'rgba(255, 255, 255, 0.85)',
  heroChip: 'rgba(0, 0, 0, 0.22)',
  scrim: 'rgba(0, 0, 0, 0.5)',
};

export const SPACING = { xs: 8, sm: 12, md: 16, lg: 24, xl: 32 };

export const RADIUS = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 };

/** Objetivo táctil mínimo (sección 10 de la guía). */
export const MIN_TOUCH = 48;

/** Con Inter, cada peso es una familia distinta: no se combina con `fontWeight`. */
export const FONTS = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

export const TYPOGRAPHY = {
  display: { fontFamily: FONTS.bold, fontSize: 40, lineHeight: 48 },
  h1: { fontFamily: FONTS.semiBold, fontSize: 32, lineHeight: 40 },
  h2: { fontFamily: FONTS.semiBold, fontSize: 24, lineHeight: 32 },
  h3: { fontFamily: FONTS.semiBold, fontSize: 18, lineHeight: 24 },
  body1: { fontFamily: FONTS.regular, fontSize: 16, lineHeight: 24 },
  body1Strong: { fontFamily: FONTS.semiBold, fontSize: 16, lineHeight: 24 },
  body2: { fontFamily: FONTS.regular, fontSize: 14, lineHeight: 20 },
  body2Strong: { fontFamily: FONTS.semiBold, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: FONTS.medium, fontSize: 12, lineHeight: 16 },
} satisfies Record<string, TextStyle>;
