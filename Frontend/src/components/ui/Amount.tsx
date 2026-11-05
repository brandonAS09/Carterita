import React from 'react';
import { StyleProp, Text, TextStyle } from 'react-native';
import { formatAmount, speakAmount } from '../../utils/currencyUtils';

interface AmountProps {
  value: number;
  moneda: string;
  /** `auto` muestra el menos solo si el valor es negativo. */
  sign?: 'auto' | 'minus' | 'plus';
  /** Frase previa para el lector de pantalla, como "Disponible hoy". */
  label?: string;
  /** Reduce el tamaño antes de truncar: necesita un contenedor con ancho definido. */
  fit?: boolean;
  style?: StyleProp<TextStyle>;
}

const signFor = (value: number, sign: AmountProps['sign']) => {
  if (sign === 'minus') return '-';
  if (sign === 'plus') return '+';
  return value < 0 ? '-' : '';
};

/** Monto con números tabulares, signo y lectura completa en lector de pantalla. */
export default function Amount({ value, moneda, sign = 'auto', label, fit, style }: AmountProps) {
  const prefix = signFor(value, sign);
  const spoken = `${prefix === '-' ? 'menos ' : prefix === '+' ? 'más ' : ''}${speakAmount(value, moneda)}`;
  return (
    <Text
      style={[{ fontVariant: ['tabular-nums'] }, style]}
      numberOfLines={1}
      adjustsFontSizeToFit={fit}
      minimumFontScale={fit ? 0.5 : undefined}
      accessibilityLabel={label ? `${label}, ${spoken}` : spoken}
    >
      {prefix}
      {formatAmount(value, moneda)}
    </Text>
  );
}
