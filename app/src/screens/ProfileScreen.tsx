import React from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { disconnectSocket } from '../api/socket';
import AppIcon from '../components/AppIcon';
import { getCollegeFullName, getCollegeName } from '../constants/colleges';
import { useAuthStore } from '../stores/authStore';
import { useCartStore } from '../stores/cartStore';
import { MainTabNavigationProp } from '../types';
import { palette, shadows } from '../theme';

const getInitials = (name?: string) =>
  String(name || 'DS')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

export default function ProfileScreen() {
  const navigation = useNavigation<MainTabNavigationProp<'Profile'>>();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuthStore();
  const { items, clearCart } = useCartStore();

  const handleLogout = async () => {
    await logout();
    await clearCart();
    disconnectSocket();
  };

  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const handleCampusAccount = () => {
    Alert.alert(
      'Campus Account',
      `${user?.name || `${getCollegeName(user?.college)} Student`}\n${user?.usn || ''}\n${user?.email || ''}\n${user?.college ? getCollegeFullName(user.college) : 'College not set'}`,
    );
  };

  const handleRoleAccess = () => {
    Alert.alert(
      'Role Access',
      `You are signed in as ${user?.role || 'student'}. Staff-only tools appear automatically when the account has access.`,
    );
  };

  const handleSupport = () => {
    Alert.alert(
      'Help & Support',
      'Use the Orders tab for live status updates. If anything is wrong with a pickup, show your QR code at the canteen desk.',
    );
  };

  const menuOptions = [
    {
      icon: 'wallet-outline' as const,
      label: 'Campus Account',
      sublabel: 'Canteen profile synced with your student login',
      color: '#FCECD8',
      iconColor: palette.brand,
      onPress: handleCampusAccount,
    },
    {
      icon: 'cart-outline' as const,
      label: 'Cart Snapshot',
      sublabel: `${cartCount} items saved locally`,
      color: '#F2E8FF',
      iconColor: '#7C3AED',
      onPress: () => navigation.navigate('Cart'),
    },
    {
      icon: 'shield-check-outline' as const,
      label: 'Role Access',
      sublabel: `${user?.role || 'student'} access enabled`,
      color: '#EAF8EE',
      iconColor: palette.success,
      onPress: handleRoleAccess,
    },
    {
      icon: 'help-circle-outline' as const,
      label: 'Support',
      sublabel: 'Use the canteen desk if your order needs help',
      color: '#EAF1FF',
      iconColor: palette.info,
      onPress: handleSupport,
    },
  ];

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: 120 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Profile</Text>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(user?.name)}</Text>
          </View>

          <View style={styles.profileTextWrap}>
            <Text style={styles.name}>{user?.name || `${getCollegeName(user?.college)} Student`}</Text>
            <Text style={styles.meta}>{user?.usn}</Text>
            <Text style={styles.meta}>{user?.email}</Text>
            {user?.college ? <Text style={styles.meta}>{getCollegeFullName(user.college)}</Text> : null}
          </View>
        </View>

        <View style={styles.infoBand}>
          <View style={styles.infoBandItem}>
            <Text style={styles.infoBandValue}>{items.length}</Text>
            <Text style={styles.infoBandLabel}>Cart Lines</Text>
          </View>
          <View style={styles.infoBandDivider} />
          <View style={styles.infoBandItem}>
            <Text style={styles.infoBandValue}>{user?.role || 'student'}</Text>
            <Text style={styles.infoBandLabel}>Access</Text>
          </View>
        </View>

        <View style={styles.menuCard}>
          {menuOptions.map((option, index) => (
              <TouchableOpacity
                key={option.label}
                activeOpacity={0.9}
                style={[styles.menuRow, index > 0 && styles.menuRowSpacing]}
                onPress={option.onPress}
              >
                <View style={[styles.menuIcon, { backgroundColor: option.color }]}>
                  <AppIcon name={option.icon} size={18} color={option.iconColor} />
                </View>
                <View style={styles.menuTextWrap}>
                  <Text style={styles.menuLabel}>{option.label}</Text>
                  <Text style={styles.menuSubLabel}>{option.sublabel}</Text>
                </View>
                <AppIcon name="chevron-right" size={18} color={palette.subtle} />
              </TouchableOpacity>
            ))}
        </View>

        <TouchableOpacity activeOpacity={0.92} style={styles.logoutButton} onPress={handleLogout}>
          <AppIcon name="log-out" size={17} color={palette.surface} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  content: {
    paddingHorizontal: 16,
    gap: 16,
  },
  title: {
    color: palette.ink,
    fontSize: 28,
    fontWeight: '800',
  },
  profileCard: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    ...shadows.card,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: palette.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: palette.surface,
    fontSize: 22,
    fontWeight: '900',
  },
  profileTextWrap: {
    flex: 1,
    gap: 4,
  },
  name: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: '800',
  },
  meta: {
    color: palette.muted,
    fontSize: 13,
  },
  infoBand: {
    backgroundColor: palette.warningSoft,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoBandItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  infoBandDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#F1D6B7',
  },
  infoBandValue: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  infoBandLabel: {
    color: '#9A6A35',
    fontSize: 12,
    fontWeight: '700',
  },
  menuCard: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: 14,
    ...shadows.card,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuRowSpacing: {
    marginTop: 14,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTextWrap: {
    flex: 1,
    gap: 3,
  },
  menuLabel: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  menuSubLabel: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  logoutButton: {
    backgroundColor: palette.brand,
    borderRadius: 22,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    ...shadows.floating,
  },
  logoutText: {
    color: palette.surface,
    fontSize: 15,
    fontWeight: '800',
  },
});
