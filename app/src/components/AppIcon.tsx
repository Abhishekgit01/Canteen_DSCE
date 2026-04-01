import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export type AppIconName =
  | 'arrow-left'
  | 'bell'
  | 'camera'
  | 'cart-outline'
  | 'cellphone-nfc'
  | 'chevron-right'
  | 'clock'
  | 'credit-card-outline'
  | 'fire'
  | 'help-circle-outline'
  | 'heart'
  | 'heart-outline'
  | 'home'
  | 'log-out'
  | 'map-pin'
  | 'minus'
  | 'plus'
  | 'receipt-text-outline'
  | 'search'
  | 'shield-check-outline'
  | 'shopping-bag'
  | 'silverware-fork-knife'
  | 'star'
  | 'user'
  | 'wallet-outline';

const glyphs: Record<AppIconName, React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  'arrow-left': 'arrow-left',
  bell: 'bell-outline',
  camera: 'camera-outline',
  'cart-outline': 'cart-outline',
  'cellphone-nfc': 'cellphone-nfc',
  'chevron-right': 'chevron-right',
  clock: 'clock-outline',
  'credit-card-outline': 'credit-card-outline',
  fire: 'fire',
  'help-circle-outline': 'help-circle-outline',
  heart: 'heart',
  'heart-outline': 'heart-outline',
  home: 'home-outline',
  'log-out': 'logout',
  'map-pin': 'map-marker-outline',
  minus: 'minus',
  plus: 'plus',
  'receipt-text-outline': 'receipt-text-outline',
  search: 'magnify',
  'shield-check-outline': 'shield-check-outline',
  'shopping-bag': 'shopping-outline',
  'silverware-fork-knife': 'silverware-fork-knife',
  star: 'star-outline',
  user: 'account-outline',
  'wallet-outline': 'wallet-outline',
};

type AppIconProps = {
  name: AppIconName;
  size?: number;
  color?: string;
};

export default function AppIcon({ name, size = 18, color = '#1A1A1A' }: AppIconProps) {
  return <MaterialCommunityIcons name={glyphs[name]} size={size} color={color} />;
}
