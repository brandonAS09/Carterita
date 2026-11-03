/**
 * Monedas soportadas y conversión MXN ↔ USD (S1.1-06).
 * La app es offline: el tipo de cambio siempre lo captura el usuario (1 USD = X MXN).
 */

export type Moneda = 'MXN' | 'USD';

export const MONEDAS: { code: Moneda; label: string }[] = [
  { code: 'MXN', label: 'MXN ($)' },
  { code: 'USD', label: 'USD ($)' },
];

export const getCurrencySymbol = (_moneda: string): string => '$';

/** Redondeo a 2 decimales (centavos). */
export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Factor por el que se multiplica un monto para pasar de `from` a `to`. */
export const getConversionFactor = (from: Moneda, to: Moneda, tasaUsd: number): number => {
  if (from === to) return 1;
  return from === 'MXN' ? 1 / tasaUsd : tasaUsd;
};

export const convertAmount = (monto: number, from: Moneda, to: Moneda, tasaUsd: number): number =>
  round2(monto * getConversionFactor(from, to, tasaUsd));

/** Formato de visualización: "$1,234.50" (siempre positivo; el signo lo agrega quien llama). */
export const formatAmount = (amount: number, moneda: string): string =>
  `${getCurrencySymbol(moneda)}${Math.abs(amount).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
