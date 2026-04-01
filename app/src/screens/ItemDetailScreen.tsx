import React, { useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppIcon from '../components/AppIcon';
import { useFavoritesStore } from '../stores/favoritesStore';
import { useCartStore } from '../stores/cartStore';
import { RootStackNavigationProp, RootStackRouteProp } from '../types';
import { palette, shadows } from '../theme';
import { formatPickupTime, getDefaultPickupTime, getPickupTimeSlots } from '../utils/pickupTime';

export default function ItemDetailScreen() {
  const route = useRoute<RootStackRouteProp<'ItemDetail'>>();
  const navigation = useNavigation<RootStackNavigationProp<'ItemDetail'>>();
  const insets = useSafeAreaInsets();
  const { item } = route.params;
  const { addItem } = useCartStore();
  const { isFavorite, toggleFavorite } = useFavoritesStore();

  const [selectedTemp, setSelectedTemp] = useState(item.tempOptions[0] || 'normal');
  const [quantity, setQuantity] = useState(1);
  const [scheduledTime, setScheduledTime] = useState('');
  const timeSlots = getPickupTimeSlots();
  const selectedPickupTime = scheduledTime || timeSlots[0] || getDefaultPickupTime();

  const handleAddToCart = async () => {
    await addItem({
      menuItem: item,
      quantity,
      tempPreference: selectedTemp,
      scheduledTime: selectedPickupTime,
    });
    navigation.goBack();
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 160 + insets.bottom }}
      >
        <View style={styles.hero}>
          <Image source={{ uri: item.imageUrl }} style={styles.heroImage} />
          <View style={[styles.heroOverlay, { paddingTop: insets.top + 10, flexDirection: 'row', justifyContent: 'space-between' }]}>
            <TouchableOpacity activeOpacity={0.9} style={styles.backButton} onPress={() => navigation.goBack()}>
              <AppIcon name="arrow-left" size={20} color={palette.surface} />
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={0.9} style={styles.backButton} onPress={() => toggleFavorite(item.id)}>
              <AppIcon name={isFavorite(item.id) ? "heart" : "heart-outline"} size={20} color={isFavorite(item.id) ? "#EF4444" : palette.surface} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <View style={styles.summaryMeta}>
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeText}>
                    {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
                  </Text>
                </View>
                <Text style={styles.calorieText}>{item.calories} cal</Text>
              </View>
              <Text style={styles.title}>{item.name}</Text>
              <Text style={styles.description}>{item.description}</Text>
            </View>

            {item.tempOptions.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Temperature</Text>
                <View style={styles.chipWrap}>
                  {item.tempOptions.map((temp) => {
                    const active = selectedTemp === temp;
                    return (
                      <TouchableOpacity
                        key={temp}
                        activeOpacity={0.92}
                        style={[styles.choiceChip, active && styles.choiceChipActive]}
                        onPress={() => setSelectedTemp(temp)}
                      >
                        <Text style={[styles.choiceChipText, active && styles.choiceChipTextActive]}>
                          {temp.charAt(0).toUpperCase() + temp.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Pickup Time</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.slotList}>
                {timeSlots.map((time) => {
                  const active = selectedPickupTime === time;
                  return (
                    <TouchableOpacity
                      key={time}
                      activeOpacity={0.92}
                      style={[styles.timeChip, active && styles.timeChipActive]}
                      onPress={() => setScheduledTime(time)}
                    >
                      <Text style={[styles.timeChipText, active && styles.timeChipTextActive]}>
                        {formatPickupTime(time)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quantity</Text>
              <View style={styles.quantityRow}>
                <TouchableOpacity
                  activeOpacity={0.92}
                  style={styles.quantityButton}
                  onPress={() => setQuantity(Math.max(1, quantity - 1))}
                >
                  <AppIcon name="minus" size={16} color={palette.surface} />
                </TouchableOpacity>
                <Text style={styles.quantityValue}>{quantity}</Text>
                <TouchableOpacity
                  activeOpacity={0.92}
                  style={styles.quantityButton}
                  onPress={() => setQuantity(quantity + 1)}
                >
                  <AppIcon name="plus" size={16} color={palette.surface} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 18 + insets.bottom }]}>
        <View>
          <Text style={styles.footerLabel}>Total</Text>
          <Text style={styles.footerPrice}>₹{item.price * quantity}</Text>
        </View>
        <TouchableOpacity activeOpacity={0.92} style={styles.addButton} onPress={() => void handleAddToCart()}>
          <AppIcon name="cart-outline" size={18} color={palette.surface} />
          <Text style={styles.addButtonText}>Add to Cart</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  hero: {
    position: 'relative',
    backgroundColor: palette.brand,
  },
  heroImage: {
    width: '100%',
    aspectRatio: 1.12,
    backgroundColor: palette.brand,
  },
  heroOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(26,26,26,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 16,
    marginTop: -28,
  },
  summaryCard: {
    backgroundColor: palette.surface,
    borderRadius: 28,
    padding: 18,
    gap: 18,
    ...shadows.floating,
  },
  summaryHeader: {
    gap: 8,
  },
  summaryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  categoryBadge: {
    backgroundColor: palette.warningSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  categoryBadgeText: {
    color: palette.accent,
    fontSize: 11,
    fontWeight: '800',
  },
  calorieText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    color: palette.ink,
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 32,
  },
  description: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  chipWrap: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  choiceChip: {
    backgroundColor: palette.surfaceMuted,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 14,
  },
  choiceChipActive: {
    backgroundColor: palette.brand,
  },
  choiceChipText: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  choiceChipTextActive: {
    color: palette.surface,
  },
  slotList: {
    gap: 10,
    paddingRight: 6,
  },
  timeChip: {
    backgroundColor: palette.surfaceMuted,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 14,
  },
  timeChipActive: {
    backgroundColor: palette.accent,
  },
  timeChipText: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  timeChipTextActive: {
    color: palette.surface,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  quantityButton: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityValue: {
    color: palette.ink,
    fontSize: 22,
    fontWeight: '900',
    minWidth: 28,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(250,248,245,0.96)',
    paddingTop: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  footerLabel: {
    color: palette.muted,
    fontSize: 12,
  },
  footerPrice: {
    color: palette.ink,
    fontSize: 24,
    fontWeight: '900',
    marginTop: 2,
  },
  addButton: {
    backgroundColor: palette.brand,
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    ...shadows.floating,
  },
  addButtonText: {
    color: palette.surface,
    fontSize: 15,
    fontWeight: '800',
  },
});
