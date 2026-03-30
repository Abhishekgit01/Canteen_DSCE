import React from 'react';
import { StyleSheet, Text } from 'react-native';

type AppIconName =
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

const glyphs: Record<AppIconName, string> = {
  'arrow-left': '←',
  bell: '◌',
  camera: '⌖',
  'cart-outline': '🛒',
  'cellphone-nfc': '⌁',
  'chevron-right': '›',
  clock: '◷',
  'credit-card-outline': '▣',
  fire: '✦',
  'help-circle-outline': '?',
  home: '⌂',
  'log-out': '↗',
  'map-pin': '⌖',
  minus: '−',
  plus: '+',
  'receipt-text-outline': '☰',
  search: '⌕',
  'shield-check-outline': '◈',
  'shopping-bag': '◫',
  'silverware-fork-knife': '⋈',
  star: '★',
  user: '◉',
  'wallet-outline': '◍',
};

type AppIconProps = {
  name: AppIconName;
  size?: number;
  color?: string;
};

export default function AppIcon({ name, size = 18, color = '#1A1A1A' }: AppIconProps) {
  return <Text style={[styles.icon, { fontSize: size, color }]}>{glyphs[name]}</Text>;
}

const styles = StyleSheet.create({
  icon: {
    fontWeight: '700',
    textAlign: 'center',
    includeFontPadding: false,
  },
});
