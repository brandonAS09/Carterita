import React from 'react';
import {
  Utensils,
  Car,
  Tv,
  HeartPulse,
  ShoppingBag,
  BookOpen,
  Zap,
  CircleEllipsis,
  Package,
} from 'lucide-react-native';

type IconComponent = React.ComponentType<{ color?: string; size?: number }>;

/**
 * Mapa único Categoria.icono → icono de lucide (S1.1-07).
 * Se usa en el selector de categorías y en la lista de transacciones.
 */
const CATEGORY_ICONS: Record<string, IconComponent> = {
  utensils: Utensils,
  car: Car,
  tv: Tv,
  'heart-pulse': HeartPulse,
  'shopping-bag': ShoppingBag,
  'book-open': BookOpen,
  bolt: Zap,
  'circle-ellipsis': CircleEllipsis,
};

export const getCategoryIcon = (icono?: string | null): IconComponent =>
  (icono && CATEGORY_ICONS[icono]) || Package;

export function CategoryIcon({
  icono,
  color,
  size = 18,
}: {
  icono?: string | null;
  color: string;
  size?: number;
}) {
  const Icon = getCategoryIcon(icono);
  return <Icon color={color} size={size} />;
}
