import { describe, test, expect } from '@jest/globals';
import { darkColors, lightColors, ThemeColors } from '../theme';

/** Sección 2.3 de la guía: un cambio de color no puede romper la accesibilidad sin que se note. */
const TEXT_MIN = 4.5;
const UI_MIN = 3;

const toRgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

const luminance = (hex: string) => {
  const [r, g, b] = toRgb(hex).map((value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const blend = (fg: string, bg: string, alpha: number) => {
  const [f, b] = [toRgb(fg), toRgb(bg)];
  return `#${f
    .map((v, i) => Math.round(alpha * v + (1 - alpha) * b[i]).toString(16).padStart(2, '0'))
    .join('')}`;
};

type Key = keyof ThemeColors;

const TEXT_PAIRS: [Key, Key][] = [
  ['text', 'background'],
  ['text', 'surface'],
  ['text', 'surfaceVariant'],
  ['textSecondary', 'background'],
  ['textSecondary', 'surface'],
  ['textSecondary', 'surfaceVariant'],
  ['primary', 'background'],
  ['primary', 'surface'],
  ['primary', 'surfaceVariant'],
  ['onPrimary', 'primary'],
  ['onAccent', 'accent'],
  ['onError', 'error'],
  ['success', 'background'],
  ['success', 'surface'],
  ['warning', 'surface'],
  ['error', 'background'],
  ['error', 'surface'],
  ['error', 'surfaceVariant'],
  ['onHero', 'heroStart'],
  ['onHero', 'heroEnd'],
  ['onHero', 'tileBudget'],
  ['onHero', 'tileSpent'],
  ['onHero', 'tileSaved'],
];

describe.each([
  ['claro', lightColors],
  ['oscuro', darkColors],
])('contrastes del tema %s', (_nombre, colors) => {
  test.each(TEXT_PAIRS)('%s sobre %s cumple 4.5:1', (fg, bg) => {
    expect(contrast(colors[fg], colors[bg])).toBeGreaterThanOrEqual(TEXT_MIN);
  });

  test('el borde de los controles cumple 3:1 sobre la superficie', () => {
    expect(contrast(colors.border, colors.surface)).toBeGreaterThanOrEqual(UI_MIN);
  });

  test('el texto secundario sobre el gradiente cumple 4.5:1 al 85 %', () => {
    expect(contrast(blend('#FFFFFF', colors.heroEnd, 0.85), colors.heroEnd)).toBeGreaterThanOrEqual(TEXT_MIN);
  });

  test('el texto blanco sobre el chip de la cabecera cumple 4.5:1', () => {
    expect(contrast('#FFFFFF', blend('#000000', colors.heroEnd, 0.22))).toBeGreaterThanOrEqual(TEXT_MIN);
  });
});

test('los dos temas definen los mismos tokens', () => {
  expect(Object.keys(darkColors).sort()).toEqual(Object.keys(lightColors).sort());
});
