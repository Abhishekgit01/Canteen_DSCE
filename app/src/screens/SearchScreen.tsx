import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { menuApi } from '../api';
import AppIcon from '../components/AppIcon';
import { useCartStore } from '../stores/cartStore';
import { MenuItem, RootStackNavigationProp } from '../types';
import { palette, shadows } from '../theme';

const defaultRecentSearches = ['Maggi', 'Biryani', 'Cold Coffee'];

const getDefaultScheduledTime = () => {
  const slot = new Date();
  slot.setMinutes(slot.getMinutes() + 15);
  const hours = slot.getHours().toString().padStart(2, '0');
  const minutes = slot.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

export default function SearchScreen() {
  const navigation = useNavigation<RootStackNavigationProp<'Search'>>();
  const insets = useSafeAreaInsets();
  const { items, addItem, total } = useCartStore();
  const [query, setQuery] = useState('');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [recentSearches, setRecentSearches] = useState(defaultRecentSearches);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const loadMenu = async () => {
      try {
        const response = await menuApi.getMenu();
        setMenuItems(response.data);
        setErrorMessage('');
      } catch (error) {
        console.error('Failed to load search menu:', error);
        setErrorMessage('Could not load menu items right now.');
      } finally {
        setLoading(false);
      }
    };

    void loadMenu();
  }, []);

  const trendingItems = useMemo(() => {
    const top = menuItems.slice(0, 5).map((item) => item.name);
    return top.length > 0 ? top : defaultRecentSearches;
  }, [menuItems]);

  const normalizedQuery = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (normalizedQuery.length <= 1) {
      return [];
    }

    return menuItems.filter((item) => {
      const haystack = `${item.name} ${item.description} ${item.category}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [menuItems, normalizedQuery]);

  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const rememberSearch = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    setRecentSearches((current) => {
      const next = [trimmed, ...current.filter((entry) => entry.toLowerCase() !== trimmed.toLowerCase())];
      return next.slice(0, 5);
    });
  };

  const handleSearchChipPress = (value: string) => {
    setQuery(value);
    rememberSearch(value);
  };

  const handleItemOpen = (item: MenuItem) => {
    rememberSearch(item.name);
    navigation.navigate('ItemDetail', { item });
  };

  const handleAdd = async (item: MenuItem) => {
    const existingItem = items.find((entry) => entry.menuItem.id === item.id);
    const nextQuantity = (existingItem?.quantity || 0) + 1;

    rememberSearch(item.name);
    await addItem({
      menuItem: item,
      quantity: nextQuantity,
      tempPreference: existingItem?.tempPreference || item.tempOptions[0] || 'normal',
      scheduledTime: existingItem?.scheduledTime || getDefaultScheduledTime(),
    });
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 12, paddingBottom: cartCount > 0 ? 180 : 110 + insets.bottom },
        ]}
      >
        <View style={styles.searchRow}>
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <AppIcon name="arrow-left" size={18} color={palette.ink} />
          </TouchableOpacity>

          <View style={styles.searchBar}>
            <AppIcon name="search" size={16} color={palette.subtle} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search for dishes, drinks..."
              placeholderTextColor={palette.subtle}
              returnKeyType="search"
              onSubmitEditing={() => rememberSearch(query)}
            />
            {query ? (
              <TouchableOpacity activeOpacity={0.85} onPress={() => setQuery('')}>
                <Text style={styles.clearText}>Clear</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={palette.accent} />
            <Text style={styles.stateText}>Loading menu...</Text>
          </View>
        ) : normalizedQuery.length > 1 ? (
          <View style={styles.resultsList}>
            {results.map((item) => (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.92}
                style={styles.resultCard}
                onPress={() => handleItemOpen(item)}
              >
                <Image source={{ uri: item.imageUrl }} style={styles.resultImage} />
                <View style={styles.resultTextWrap}>
                  <Text style={styles.resultName}>{item.name}</Text>
                  <Text style={styles.resultMeta}>
                    ₹{item.price} · {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
                  </Text>
                </View>
                <TouchableOpacity
                  activeOpacity={0.9}
                  style={styles.resultAddButton}
                  onPress={() => void handleAdd(item)}
                >
                  <AppIcon name="plus" size={16} color={palette.accent} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}

            {results.length === 0 ? (
              <Text style={styles.emptyText}>No results found for "{query.trim()}"</Text>
            ) : null}
          </View>
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recent Searches</Text>
              <View style={styles.chipWrap}>
                {recentSearches.map((entry) => (
                  <TouchableOpacity
                    key={entry}
                    activeOpacity={0.9}
                    style={styles.recentChip}
                    onPress={() => handleSearchChipPress(entry)}
                  >
                    <AppIcon name="clock" size={12} color={palette.subtle} />
                    <Text style={styles.recentChipText}>{entry}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Trending Now</Text>
              <View style={styles.trendingList}>
                {trendingItems.map((entry) => (
                  <TouchableOpacity
                    key={entry}
                    activeOpacity={0.9}
                    style={styles.trendingRow}
                    onPress={() => handleSearchChipPress(entry)}
                  >
                    <View style={styles.trendingIconWrap}>
                      <AppIcon name="star" size={12} color={palette.accent} />
                    </View>
                    <Text style={styles.trendingText}>{entry}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {cartCount > 0 ? (
        <TouchableOpacity
          activeOpacity={0.95}
          style={[styles.cartBar, { bottom: 30 + insets.bottom }]}
          onPress={() => navigation.navigate('Main', { screen: 'Cart' })}
        >
          <View style={styles.cartBarLeft}>
            <View style={styles.cartCountPill}>
              <Text style={styles.cartCountText}>{cartCount}</Text>
            </View>
            <View>
              <Text style={styles.cartBarLabel}>
                {cartCount} {cartCount === 1 ? 'item' : 'items'} added
              </Text>
              <Text style={styles.cartBarSubtext}>Go to cart</Text>
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
  content: {
    paddingHorizontal: 16,
    gap: 18,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  searchBar: {
    flex: 1,
    minHeight: 52,
    borderRadius: 22,
    backgroundColor: palette.surface,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    ...shadows.card,
  },
  searchInput: {
    flex: 1,
    color: palette.ink,
    fontSize: 15,
    paddingVertical: 12,
  },
  clearText: {
    color: palette.subtle,
    fontSize: 12,
    fontWeight: '700',
  },
  errorText: {
    color: palette.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  centerState: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 12,
  },
  stateText: {
    color: palette.muted,
    fontSize: 14,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: '800',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  recentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    ...shadows.card,
  },
  recentChipText: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '600',
  },
  trendingList: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: 10,
    ...shadows.card,
  },
  trendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 6,
    paddingVertical: 10,
  },
  trendingIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: palette.warningSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendingText: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '600',
  },
  resultsList: {
    gap: 10,
  },
  resultCard: {
    backgroundColor: palette.surface,
    borderRadius: 18,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...shadows.card,
  },
  resultImage: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: palette.surfaceMuted,
  },
  resultTextWrap: {
    flex: 1,
    gap: 4,
  },
  resultName: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  resultMeta: {
    color: palette.muted,
    fontSize: 12,
  },
  resultAddButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: palette.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: palette.muted,
    textAlign: 'center',
    fontSize: 14,
    paddingVertical: 30,
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
