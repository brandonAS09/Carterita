import React from 'react';
import { PiggyBank, Plane, Laptop, Car, House, GraduationCap, Gift, Smartphone } from 'lucide-react-native';

type IconComponent = React.ComponentType<{ color?: string; size?: number }>;

/** Iconos disponibles para metas de ahorro (F07). La clave se guarda en MetaAhorro.icono. */
export const GOAL_ICONS: { key: string; label: string; Icon: IconComponent }[] = [
  { key: 'piggy-bank', label: 'Ahorro', Icon: PiggyBank },
  { key: 'plane', label: 'Viaje', Icon: Plane },
  { key: 'laptop', label: 'Laptop', Icon: Laptop },
  { key: 'car', label: 'Auto', Icon: Car },
  { key: 'house', label: 'Casa', Icon: House },
  { key: 'graduation-cap', label: 'Estudios', Icon: GraduationCap },
  { key: 'gift', label: 'Regalo', Icon: Gift },
  { key: 'smartphone', label: 'Celular', Icon: Smartphone },
];

export const DEFAULT_GOAL_ICON = 'piggy-bank';

export function GoalIcon({ icono, color, size = 22 }: { icono?: string | null; color: string; size?: number }) {
  const Icon = GOAL_ICONS.find((g) => g.key === icono)?.Icon ?? PiggyBank;
  return <Icon color={color} size={size} />;
}
