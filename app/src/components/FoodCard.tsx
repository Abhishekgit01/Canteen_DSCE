import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MenuItem } from '../types';
import { palette, shadows } from '../theme';
import AppIcon from './AppIcon';

type FoodCardProps = {
  item: MenuItem;
  quantity?: number;
  compact?: boolean;
  onPress?: () => void;
  onAdd?: () => void;
  onIncrement?: () => void;
  onDecrement?: () => void;
};

const formatCategory = (category: MenuItem['category']) =>
  category.charAt(0).toUpperCase() + category.slice(1);

export default function FoodCard({
  item,
  quantity = 0,
  compact = false,
  onPress,
  onAdd,
  onIncrement,
  onDecrement,
}: FoodCardProps) {
  if (compact) {
    return (
      <TouchableOpacity
        activeOpacity={0.9}
        style={styles.compactCard}
        onPress={onPress}
      >
        <View style={styles.compactImageWrap}>
          <Image source={{ uri: item.imageUrl }} style={styles.compactImage} />
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.9}
            style={styles.compactAddButton}
            onPress={onAdd}
          >
            <AppIcon name="plus" size={16} color={palette.accent} />
          </TouchableOpacity>
        </View>
        <View style={styles.compactBody}>
          <Text style={styles.compactName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.compactPrice}>₹{item.price}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity activeOpacity={0.94} style={styles.card} onPress={onPress}>
      <View style={styles.cardContent}>
        <View style={styles.infoWrap}>
          <View style={styles.metaRow}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{formatCategory(item.category)}</Text>
            </View>
            {item.isAvailable ? (
              <Text style={styles.metaText}>{item.calories} cal</Text>
            ) : (
              <View style={styles.soldOutBadge}>
                <Text style={styles.soldOutText}>Sold Out</Text>
              </View>
            )}
          </View>
          <Text style={styles.name} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={styles.description} numberOfLines={2}>
            {item.description}
          </Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>₹{item.price}</Text>
            <Text style={styles.metaText}>{item.tempOptions.length || 1} temp options</Text>
          </View>
        </View>

        <View style={styles.mediaWrap}>
          <Image source={{ uri: item.imageUrl }} style={styles.image} />
          {item.isAvailable ? (
            quantity > 0 ? (
              <View style={styles.stepper}>
                <TouchableOpacity
                  accessibilityRole="button"
                  activeOpacity={0.9}
                  style={styles.stepperButton}
                  onPress={onDecrement}
                >
                  <AppIcon name="minus" size={16} color={palette.surface} />
                </TouchableOpacity>
                <Text style={styles.stepperValue}>{quantity}</Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  activeOpacity={0.9}
                  style={styles.stepperButton}
                  onPress={onIncrement}
                >
                  <AppIcon name="plus" size={16} color={palette.surface} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.9}
                style={styles.addButton}
                onPress={onAdd}
              >
                <Text style={styles.addButtonText}>ADD</Text>
              </TouchableOpacity>
            )
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: 14,
    ...shadows.card,
  },
  cardContent: {
    flexDirection: 'row',
    gap: 14,
  },
  infoWrap: {
    flex: 1,
    paddingTop: 4,
    paddingBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  categoryBadge: {
    backgroundColor: palette.warningSoft,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  categoryBadgeText: {
    color: palette.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  soldOutBadge: {
    backgroundColor: palette.dangerSoft,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  soldOutText: {
    color: palette.danger,
    fontSize: 11,
    fontWeight: '700',
  },
  metaText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '500',
  },
  name: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 6,
  },
  description: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  price: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: '800',
  },
  mediaWrap: {
    width: 118,
    alignItems: 'center',
  },
  image: {
    width: 118,
    height: 108,
    borderRadius: 18,
    backgroundColor: palette.surfaceMuted,
  },
  addButton: {
    position: 'absolute',
    bottom: -12,
    alignSelf: 'center',
    backgroundColor: palette.surface,
    borderRadius: 12,
    paddingHorizontal: 22,
    paddingVertical: 8,
    ...shadows.card,
  },
  addButtonText: {
    color: palette.accent,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  stepper: {
    position: 'absolute',
    bottom: -14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.accent,
    borderRadius: 12,
    paddingHorizontal: 4,
    paddingVertical: 4,
    ...shadows.card,
  },
  stepperButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    color: palette.surface,
    fontSize: 15,
    fontWeight: '800',
    minWidth: 22,
    textAlign: 'center',
  },
  compactCard: {
    width: 136,
    backgroundColor: palette.surface,
    borderRadius: 22,
    padding: 10,
    ...shadows.card,
  },
  compactImageWrap: {
    position: 'relative',
  },
  compactImage: {
    width: '100%',
    height: 96,
    borderRadius: 16,
    backgroundColor: palette.surfaceMuted,
  },
  compactAddButton: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  compactBody: {
    paddingTop: 10,
    gap: 3,
  },
  compactName: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  compactPrice: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '800',
  },
});
