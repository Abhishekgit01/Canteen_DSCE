import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { menuApi } from '../api';
import AppIcon from '../components/AppIcon';
import FoodCard from '../components/FoodCard';
import { useAuthStore } from '../stores/authStore';
import { useCartStore } from '../stores/cartStore';
import { MainTabNavigationProp, MenuItem } from '../types';
import { palette, shadows } from '../theme';

const categories = [
  { key: 'All', label: 'All', emoji: '🍽️' },
  { key: 'meals', label: 'Meals', emoji: '🍛' },
  { key: 'snacks', label: 'Snacks', emoji: '🍟' },
  { key: 'beverages', label: 'Beverages', emoji: '☕' },
  { key: 'desserts', label: 'Desserts', emoji: '🧁' },
];

const getDefaultScheduledTime = () => {
  const slot = new Date();
  slot.setMinutes(slot.getMinutes() + 15);
  const hours = slot.getHours().toString().padStart(2, '0');
  const minutes = slot.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

export default function HomeScreen() {
  const navigation = useNavigation<MainTabNavigationProp<'Home'>>();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { items, addItem, updateQuantity, total } = useCartStore();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [timeLeft, setTimeLeft] = useState(38);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((current) => (current > 1 ? current - 1 : 45));
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchMenu = async () => {
      try {
        setErrorMessage('');
        const response = await menuApi.getMenu();
        setMenuItems(response.data);
      } catch (error) {
        console.error('Failed to fetch menu:', error);
        setErrorMessage('Could not load the canteen menu right now.');
      } finally {
        setLoading(false);
      }
    };

    void fetchMenu();
  }, []);

  const filteredItems =
    selectedCategory === 'All'
      ? menuItems
      : menuItems.filter((item) => item.category === selectedCategory);

  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const getQuantity = (menuItemId: string) =>
    items.find((entry) => entry.menuItem.id === menuItemId)?.quantity || 0;

  const handleAdd = async (item: MenuItem) => {
    const existingItem = items.find((entry) => entry.menuItem.id === item.id);
    const nextQuantity = (existingItem?.quantity || 0) + 1;

    await addItem({
      menuItem: item,
      quantity: nextQuantity,
      tempPreference: existingItem?.tempPreference || item.tempOptions[0] || 'normal',
      scheduledTime: existingItem?.scheduledTime || getDefaultScheduledTime(),
    });
  };

  const handleQuantityChange = async (item: MenuItem, delta: number) => {
    const currentQuantity = getQuantity(item.id);
    await updateQuantity(item.id, Math.max(0, currentQuantity + delta));
  };

  const renderHeader = () => (
    <View>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View>
            <View style={styles.pickupRow}>
            <AppIcon name="map-pin" size={13} color="rgba(255,255,255,0.72)" />
            <Text style={styles.pickupLabel}>PICKUP FROM</Text>
          </View>
          <Text style={styles.headerTitle}>DSCE Canteen</Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.headerIconButton}
            onPress={() => navigation.navigate('Search')}
          >
            <AppIcon name="search" size={18} color={palette.surface} />
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.headerIconButton}
            onPress={() => navigation.navigate('Orders')}
          >
            <AppIcon name="bell" size={18} color={palette.surface} />
            <View style={styles.notificationDot} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.contentWrap}>
        <View style={styles.heroCard}>
          <View style={styles.heroTextBlock}>
            <View style={styles.heroTitleRow}>
              <AppIcon name="fire" size={18} color="#FFE3B1" />
              <Text style={styles.heroTitle}>Lunch Rush</Text>
            </View>
            <Text style={styles.heroSubtitle}>
              Order before the queue builds up and pick it up on your way.
            </Text>
          </View>

          <View style={styles.heroTimer}>
            <Text style={styles.heroTimerValue}>{timeLeft}</Text>
            <Text style={styles.heroTimerLabel}>MINS LEFT</Text>
          </View>
        </View>

        <View style={styles.infoStrip}>
          <View style={styles.infoPill}>
            <AppIcon name="silverware-fork-knife" size={14} color={palette.brand} />
            <Text style={styles.infoPillText}>Freshly served today</Text>
          </View>
          <View style={styles.infoHint}>
            <AppIcon name="clock" size={12} color={palette.muted} />
            <Text style={styles.infoHintText}>Quick pickup in 15 mins</Text>
          </View>
        </View>

        <FlatList
          data={categories}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.categoryList}
          renderItem={({ item }) => {
            const active = selectedCategory === item.key;
            return (
              <TouchableOpacity
                activeOpacity={0.92}
                style={[styles.categoryChip, active && styles.categoryChipActive]}
                onPress={() => setSelectedCategory(item.key)}
              >
                <Text style={styles.categoryEmoji}>{item.emoji}</Text>
                <Text style={[styles.categoryLabel, active && styles.categoryLabelActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>
              {selectedCategory === 'All' ? 'Lunch Specials' : categories.find((item) => item.key === selectedCategory)?.label}
            </Text>
            <Text style={styles.sectionSubtitle}>
              {filteredItems.length} items available for {user?.name?.split(' ')[0] || 'you'}
            </Text>
          </View>
          <View style={styles.bestSellerTag}>
            <AppIcon name="star" size={14} color={palette.accent} />
            <Text style={styles.bestSellerText}>Bestsellers</Text>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={palette.accent} />
          <Text style={styles.stateText}>Loading today&apos;s menu...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.menuList,
            { paddingBottom: cartCount > 0 ? 180 : 110 + insets.bottom },
          ]}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={
            <View style={styles.centerState}>
              <Text style={styles.emptyTitle}>Nothing on this shelf right now</Text>
              <Text style={styles.emptyText}>
                Try another category or refresh once the canteen updates the menu.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <FoodCard
              item={item}
              quantity={getQuantity(item.id)}
              onPress={() => navigation.navigate('ItemDetail', { item })}
              onAdd={() => void handleAdd(item)}
              onIncrement={() => void handleAdd(item)}
              onDecrement={() => void handleQuantityChange(item, -1)}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {errorMessage ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{errorMessage}</Text>
        </View>
      ) : null}

      {cartCount > 0 ? (
        <TouchableOpacity
          activeOpacity={0.95}
          style={[styles.cartBar, { bottom: 82 + insets.bottom }]}
          onPress={() => navigation.navigate('Cart')}
        >
          <View style={styles.cartBarLeft}>
            <View style={styles.cartCountPill}>
              <Text style={styles.cartCountText}>{cartCount}</Text>
            </View>
            <View>
              <Text style={styles.cartBarLabel}>
                {cartCount} {cartCount === 1 ? 'item' : 'items'} added
              </Text>
              <Text style={styles.cartBarSubtext}>Review your order</Text>
            </View>
          </View>

          <View style={styles.cartBarRight}>
            <Text style={styles.cartBarTotal}>₹{total()}</Text>
            <AppIcon name="chevron-right" size={18} color={palette.surface} />
          </View>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  header: {
    backgroundColor: palette.brand,
    paddingHorizontal: 18,
    paddingBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  pickupLabel: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  headerTitle: {
    color: palette.surface,
    fontSize: 22,
    fontWeight: '800',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.accent,
  },
  contentWrap: {
    paddingHorizontal: 16,
    marginTop: -2,
  },
  heroCard: {
    backgroundColor: palette.accent,
    borderRadius: 24,
    padding: 18,
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
    ...shadows.floating,
  },
  heroTextBlock: {
    flex: 1,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  heroTitle: {
    color: palette.surface,
    fontSize: 20,
    fontWeight: '800',
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 13,
    lineHeight: 19,
  },
  heroTimer: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 82,
  },
  heroTimerValue: {
    color: palette.surface,
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 30,
  },
  heroTimerLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 4,
  },
  infoStrip: {
    marginTop: 16,
    gap: 10,
  },
  infoPill: {
    alignSelf: 'flex-start',
    backgroundColor: palette.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    ...shadows.card,
  },
  infoPillText: {
    color: palette.brand,
    fontSize: 12,
    fontWeight: '700',
  },
  infoHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 2,
  },
  infoHintText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '500',
  },
  categoryList: {
    paddingTop: 16,
    paddingBottom: 10,
    gap: 10,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    ...shadows.card,
  },
  categoryChipActive: {
    backgroundColor: palette.brand,
  },
  categoryEmoji: {
    fontSize: 15,
  },
  categoryLabel: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  categoryLabelActive: {
    color: palette.surface,
  },
  sectionHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
    paddingTop: 8,
    paddingBottom: 12,
  },
  sectionTitle: {
    color: palette.ink,
    fontSize: 22,
    fontWeight: '800',
  },
  sectionSubtitle: {
    color: palette.muted,
    fontSize: 13,
    marginTop: 4,
  },
  bestSellerTag: {
    backgroundColor: palette.warningSoft,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  bestSellerText: {
    color: palette.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  menuList: {
    paddingBottom: 120,
  },
  separator: {
    height: 14,
  },
  centerState: {
    paddingHorizontal: 24,
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  stateText: {
    color: palette.muted,
    fontSize: 14,
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyText: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  errorBanner: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    backgroundColor: palette.dangerSoft,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...shadows.card,
  },
  errorBannerText: {
    color: palette.danger,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  cartBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: palette.brand,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shadows.floating,
  },
  cartBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  cartCountPill: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    minWidth: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartCountText: {
    color: palette.surface,
    fontSize: 15,
    fontWeight: '800',
  },
  cartBarLabel: {
    color: palette.surface,
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  cartBarSubtext: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    marginTop: 2,
  },
  cartBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cartBarTotal: {
    color: palette.surface,
    fontSize: 19,
    fontWeight: '800',
  },
});
