import React, { useEffect, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { menuApi, pickupSettingsApi, rushHoursApi } from '../api';
import AppIcon from '../components/AppIcon';
import FoodCard from '../components/FoodCard';
import MenuSkeleton from '../components/MenuSkeleton';
import { DEFAULT_COLLEGE, getCanteenName, normalizeCollege } from '../constants/colleges';
import { useAuthStore } from '../stores/authStore';
import { useCanteenStore } from '../stores/canteenStore';
import { useCartStore } from '../stores/cartStore';
import { useFavoritesStore } from '../stores/favoritesStore';
import { MainTabNavigationProp, MenuItem } from '../types';
import { palette, shadows } from '../theme';
import { formatPickupTime, getDefaultPickupTime, getLunchRushInfo } from '../utils/pickupTime';

const categories = [
  { key: 'All', label: 'All' },
  { key: 'Favorites', label: 'Favorites ❤️' },
  { key: 'meals', label: 'Meals' },
  { key: 'snacks', label: 'Snacks' },
  { key: 'beverages', label: 'Beverages' },
  { key: 'desserts', label: 'Desserts' },
];

export default function HomeScreen() {
  const navigation = useNavigation<MainTabNavigationProp<'Home'>>();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { user } = useAuthStore();
  const userCollege = user?.college;
  const resolvedCollege = normalizeCollege(userCollege) || DEFAULT_COLLEGE;
  const initialMenu = menuApi.getCachedMenu(userCollege);
  const { items, addItem, updateQuantity, total } = useCartStore();
  const { isFavorite } = useFavoritesStore();
  const rushHourStatus = useCanteenStore(
    (state) => state.rushStatusByCollege[resolvedCollege] || null,
  );
  const pickupSettings = useCanteenStore(
    (state) => state.pickupSettingsByCollege[resolvedCollege] || null,
  );
  const setRushStatus = useCanteenStore((state) => state.setRushStatus);
  const setPickupSettings = useCanteenStore((state) => state.setPickupSettings);
  const [menuItems, setMenuItems] = useState<MenuItem[]>(initialMenu);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(initialMenu.length === 0);
  const [errorMessage, setErrorMessage] = useState('');
  const [rushInfo, setRushInfo] = useState(() => getLunchRushInfo(new Date(), userCollege));
  const canteenName = getCanteenName(userCollege);

  useEffect(() => {
    const cachedMenu = menuApi.getCachedMenu(userCollege);
    setMenuItems(cachedMenu);
    setLoading(cachedMenu.length === 0);
    setRushInfo(getLunchRushInfo(new Date(), userCollege));
  }, [userCollege]);

  useEffect(() => {
    let cancelled = false;

    const refreshRushHourStatus = async () => {
      setRushInfo(getLunchRushInfo(new Date(), userCollege));
      const [rushResult, pickupResult] = await Promise.allSettled([
        rushHoursApi.getStatus(userCollege),
        pickupSettingsApi.getSettings(userCollege),
      ]);

      if (cancelled) {
        return;
      }

      if (rushResult.status === 'fulfilled') {
        setRushStatus(resolvedCollege, rushResult.value.data);
      } else {
        console.error('Failed to fetch rush hour status:', rushResult.reason);
      }

      if (pickupResult.status === 'fulfilled') {
        setPickupSettings(pickupResult.value.data);
      } else {
        console.error('Failed to fetch pickup settings:', pickupResult.reason);
      }
    };

    void refreshRushHourStatus();

    const interval = setInterval(() => {
      void refreshRushHourStatus();
    }, 60000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [resolvedCollege, setPickupSettings, setRushStatus, userCollege]);

  useEffect(() => {
    const fetchMenu = async (showLoader = false) => {
      try {
        if (showLoader) {
          setLoading(true);
        }

        setErrorMessage('');
        const response = await menuApi.getMenu({ college: userCollege });
        setMenuItems(response.data);
      } catch (error) {
        console.error('Failed to fetch menu:', error);
        setErrorMessage('Could not load the canteen menu right now.');
      } finally {
        setLoading(false);
      }
    };

    void fetchMenu(initialMenu.length === 0);

    const unsubscribe = navigation.addListener('focus', () => {
      void fetchMenu(false);
    });

    return unsubscribe;
  }, [initialMenu.length, navigation, userCollege]);

  const filteredItems =
    selectedCategory === 'All'
      ? menuItems
      : selectedCategory === 'Favorites'
      ? menuItems.filter((item) => isFavorite(item.id) || item.isFeatured)
      : menuItems.filter((item) => item.category === selectedCategory);

  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const currentRushHour = rushHourStatus?.current || null;
  const upcomingRushHour =
    currentRushHour ||
    rushHourStatus?.all.find((entry) => entry.startTime >= currentTime) ||
    rushHourStatus?.all[0] ||
    null;
  const heroTitle = currentRushHour?.label || upcomingRushHour?.label || 'Lunch Rush';
  const heroSubtitle = currentRushHour
    ? currentRushHour.message
    : upcomingRushHour
      ? `${upcomingRushHour.message} · ${formatPickupTime(upcomingRushHour.startTime)} to ${formatPickupTime(
          upcomingRushHour.endTime,
        )}`
      : rushInfo.subtitle;
  const heroTimerValue = currentRushHour
    ? currentRushHour.surchargePercent > 0
      ? `+${currentRushHour.surchargePercent}%`
      : 'LIVE'
    : upcomingRushHour
      ? formatPickupTime(upcomingRushHour.startTime)
      : rushInfo.formattedTime;
  const heroTimerLabel = currentRushHour
    ? `${formatPickupTime(currentRushHour.startTime)} - ${formatPickupTime(currentRushHour.endTime)}`
    : upcomingRushHour
      ? `Till ${formatPickupTime(upcomingRushHour.endTime)}`
      : rushInfo.label;

  const getQuantity = (menuItemId: string) =>
    items.find((entry) => entry.menuItem.id === menuItemId)?.quantity || 0;

  const handleAdd = async (item: MenuItem) => {
    const existingItem = items.find((entry) => entry.menuItem.id === item.id);
    const nextQuantity = (existingItem?.quantity || 0) + 1;

    await addItem({
      menuItem: item,
      quantity: nextQuantity,
      tempPreference: existingItem?.tempPreference || item.tempOptions[0] || 'normal',
      scheduledTime: existingItem?.scheduledTime || getDefaultPickupTime(new Date(), userCollege),
      chefNote: existingItem?.chefNote || '',
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
          <Text style={styles.headerTitle}>{canteenName}</Text>
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
              <Text style={styles.heroTitle}>{heroTitle}</Text>
            </View>
            <Text style={styles.heroSubtitle}>
              {heroSubtitle}
            </Text>
          </View>

          <View style={styles.heroTimer}>
            <Text style={styles.heroTimerValue}>{heroTimerValue}</Text>
            <Text style={styles.heroTimerLabel}>{heroTimerLabel}</Text>
          </View>
        </View>

        <View style={styles.infoStrip}>
          <View style={styles.infoPill}>
            <AppIcon name="silverware-fork-knife" size={14} color={palette.brand} />
            <Text style={styles.infoPillText}>
              Freshly served today
            </Text>
          </View>
          <View style={styles.infoHint}>
            <AppIcon name="clock" size={12} color={palette.muted} />
            <Text style={styles.infoHintText}>
              {pickupSettings
                ? `Open till ${formatPickupTime(pickupSettings.closingTime)}`
                : `Quick pickup from ${formatPickupTime(getDefaultPickupTime(new Date(), userCollege))}`}
            </Text>
          </View>
        </View>

        {upcomingRushHour ? (
          <View style={styles.rushBanner}>
            <View style={styles.rushBannerIcon}>
              <AppIcon name="clock" size={16} color={palette.surface} />
            </View>
            <View style={styles.rushBannerCopy}>
              <Text style={styles.rushBannerTitle}>
                {currentRushHour ? 'Rush Hour Active' : 'Upcoming Rush Hour'}
              </Text>
              <Text style={styles.rushBannerText}>
                {upcomingRushHour.label} · {formatPickupTime(upcomingRushHour.startTime)} to{' '}
                {formatPickupTime(upcomingRushHour.endTime)}
              </Text>
              <Text style={styles.rushBannerText}>{upcomingRushHour.message}</Text>
              {upcomingRushHour.surchargePercent > 0 ? (
                <Text style={styles.rushBannerSurcharge}>
                  +{upcomingRushHour.surchargePercent}% busy-hour charge
                  {currentRushHour ? ' is active right now.' : ' will apply in this window.'}
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}

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
              {selectedCategory === 'All'
                ? 'Lunch Specials'
                : categories.find((item) => item.key === selectedCategory)?.label}
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
        <FlatList
          data={[0]}
          keyExtractor={(i) => i.toString()}
          contentContainerStyle={[
            styles.menuList,
            { paddingBottom: tabBarHeight + 18 },
          ]}
          ListHeaderComponent={renderHeader}
          renderItem={() => <MenuSkeleton count={5} />}
          scrollEnabled={false}
        />
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.menuList,
            { paddingBottom: cartCount > 0 ? tabBarHeight + 64 : tabBarHeight + 18 },
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
              onPressRating={() =>
                navigation.navigate('ItemReviews', {
                  menuItemId: item.id,
                  menuItemName: item.name,
                })
              }
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
          style={[styles.cartBar, { bottom: 14 + insets.bottom }]}
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
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 28,
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
  closedBanner: {
    marginTop: 14,
    backgroundColor: '#1F2A44',
    borderRadius: 22,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    ...shadows.card,
  },
  closedBannerIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: palette.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closedBannerCopy: {
    flex: 1,
    gap: 4,
  },
  closedBannerTitle: {
    color: palette.surface,
    fontSize: 15,
    fontWeight: '800',
  },
  closedBannerText: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12,
    lineHeight: 18,
  },
  rushBanner: {
    marginTop: 14,
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    ...shadows.card,
  },
  rushBannerIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(248, 113, 113, 0.22)',
  },
  rushBannerCopy: {
    flex: 1,
    gap: 3,
  },
  rushBannerTitle: {
    color: palette.surface,
    fontSize: 14,
    fontWeight: '800',
  },
  rushBannerText: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12,
    lineHeight: 18,
  },
  rushBannerSurcharge: {
    color: '#FDE68A',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
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
