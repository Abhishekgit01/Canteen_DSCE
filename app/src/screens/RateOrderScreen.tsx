import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { reviewsApi } from '../api';
import AppIcon from '../components/AppIcon';
import type { PendingReviewItem, RootStackScreenProps } from '../types';
import { palette, shadows } from '../theme';

const RATING_TAGS = {
  positive: [
    'Delicious',
    'Perfectly spicy',
    'Fresh',
    'Value for money',
    'Well prepared',
    'Served fast',
    'Great portion',
  ],
  negative: [
    'Average',
    'Not hot enough',
    'Took long',
    'Overpriced',
    'Too salty',
    'Too oily',
  ],
} as const;

type ReviewDraft = {
  rating: number;
  title: string;
  body: string;
  tags: string[];
};

const ratingLabels: Record<number, string> = {
  1: 'Poor',
  2: 'Below average',
  3: 'Okay',
  4: 'Good',
  5: 'Excellent',
};

function StarSelector({
  rating,
  onRate,
}: {
  rating: number;
  onRate: (value: number) => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handleRate = (value: number) => {
    Animated.sequence([
      Animated.spring(scale, {
        toValue: 1.08,
        useNativeDriver: true,
        friction: 5,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        friction: 5,
      }),
    ]).start();

    onRate(value);
  };

  return (
    <Animated.View style={[styles.starRow, { transform: [{ scale }] }]}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity key={star} activeOpacity={0.85} onPress={() => handleRate(star)}>
          <Text style={styles.starText}>{star <= rating ? '★' : '☆'}</Text>
        </TouchableOpacity>
      ))}
    </Animated.View>
  );
}

export default function RateOrderScreen({
  route,
  navigation,
}: RootStackScreenProps<'RateOrder'>) {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<PendingReviewItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({});
  const [loading, setLoading] = useState(true);
  const [submittingKey, setSubmittingKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const loadPendingReviews = async () => {
      try {
        setErrorMessage('');
        const pending = await reviewsApi.getPendingReviews();
        const filtered = route.params?.orderId
          ? pending.filter((item) => item.orderId === route.params?.orderId)
          : pending;
        setItems(filtered);
      } catch (error: any) {
        setErrorMessage(error?.response?.data?.error || 'Could not load pending reviews right now.');
      } finally {
        setLoading(false);
      }
    };

    void loadPendingReviews();
  }, [route.params?.orderId]);

  const updateDraft = (key: string, updates: Partial<ReviewDraft>) => {
    setDrafts((current) => ({
      ...current,
      [key]: {
        rating: current[key]?.rating || 0,
        title: current[key]?.title || '',
        body: current[key]?.body || '',
        tags: current[key]?.tags || [],
        ...updates,
      },
    }));
  };

  const removePendingItem = (key: string) => {
    setItems((current) => current.filter((item) => `${item.orderId}:${item.menuItem.id}` !== key));
    setDrafts((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const handleSubmit = async (item: PendingReviewItem) => {
    const key = `${item.orderId}:${item.menuItem.id}`;
    const draft = drafts[key];

    if (!draft?.rating) {
      setErrorMessage('Pick a star rating before submitting your review.');
      return;
    }

    setSubmittingKey(key);
    setErrorMessage('');

    try {
      await reviewsApi.submitReview({
        menuItemId: item.menuItem.id,
        orderId: item.orderId,
        rating: draft.rating,
        title: draft.title,
        body: draft.body,
        tags: draft.tags,
      });
      removePendingItem(key);
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.error || 'Could not submit your review.');
    } finally {
      setSubmittingKey(null);
    }
  };

  const isEmpty = !loading && items.length === 0;

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: 28 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity
            activeOpacity={0.88}
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <AppIcon name="arrow-left" size={18} color={palette.ink} />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Rate Your Meal</Text>
            <Text style={styles.subtitle}>
              Share what worked well and what could be better. Verified reviews help the next student order smarter.
            </Text>
          </View>
        </View>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={palette.accent} />
            <Text style={styles.centerText}>Loading your recent meals...</Text>
          </View>
        ) : null}

        {items.map((item) => {
          const key = `${item.orderId}:${item.menuItem.id}`;
          const draft = drafts[key] || { rating: 0, title: '', body: '', tags: [] };
          const tagOptions = draft.rating >= 4 ? RATING_TAGS.positive : RATING_TAGS.negative;

          return (
            <View key={key} style={styles.card}>
              <View style={styles.cardHeader}>
                <Image source={{ uri: item.menuItem.imageUrl }} style={styles.cardImage} />
                <View style={styles.cardCopy}>
                  <Text style={styles.cardTitle}>{item.menuItem.name}</Text>
                  <Text style={styles.cardMeta}>
                    Ordered on {new Date(item.orderDate).toLocaleDateString()}
                  </Text>
                </View>
              </View>

              <Text style={styles.prompt}>How would you rate this?</Text>
              <StarSelector
                rating={draft.rating}
                onRate={(rating) => updateDraft(key, { rating })}
              />
              {draft.rating ? (
                <Text style={styles.ratingLabel}>{ratingLabels[draft.rating]}</Text>
              ) : null}

              <View style={styles.tagWrap}>
                {tagOptions.map((tag) => {
                  const active = draft.tags.includes(tag);
                  return (
                    <TouchableOpacity
                      key={tag}
                      activeOpacity={0.88}
                      style={[styles.tagChip, active && styles.tagChipActive]}
                      onPress={() =>
                        updateDraft(key, {
                          tags: active
                            ? draft.tags.filter((entry) => entry !== tag)
                            : [...draft.tags, tag].slice(0, 5),
                        })
                      }
                    >
                      <Text style={[styles.tagChipText, active && styles.tagChipTextActive]}>{tag}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TextInput
                style={styles.input}
                value={draft.title}
                onChangeText={(title) => updateDraft(key, { title })}
                placeholder="Title your review (optional)"
                placeholderTextColor={palette.subtle}
                maxLength={100}
              />

              <TextInput
                style={[styles.input, styles.reviewBodyInput]}
                value={draft.body}
                onChangeText={(body) => updateDraft(key, { body })}
                placeholder="Write a quick review (optional)"
                placeholderTextColor={palette.subtle}
                multiline
                maxLength={500}
              />

              <View style={styles.actions}>
                <TouchableOpacity
                  activeOpacity={0.88}
                  style={styles.secondaryButton}
                  onPress={() => removePendingItem(key)}
                >
                  <Text style={styles.secondaryButtonText}>Skip</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.9}
                  style={styles.primaryButton}
                  onPress={() => void handleSubmit(item)}
                  disabled={submittingKey === key}
                >
                  <Text style={styles.primaryButtonText}>
                    {submittingKey === key ? 'Submitting...' : 'Submit Review'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {isEmpty ? (
          <View style={styles.centerState}>
            <Text style={styles.emptyTitle}>All caught up</Text>
            <Text style={styles.centerText}>
              There are no pending meal reviews right now.
            </Text>
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.primaryButton}
              onPress={() => navigation.navigate('Main', { screen: 'Orders' })}
            >
              <Text style={styles.primaryButtonText}>Back to Orders</Text>
            </TouchableOpacity>
          </View>
        ) : null}
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
    gap: 18,
  },
  header: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
    ...shadows.card,
  },
  headerCopy: {
    flex: 1,
    gap: 6,
  },
  title: {
    color: palette.ink,
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  errorText: {
    color: palette.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  centerState: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    gap: 12,
    ...shadows.card,
  },
  centerText: {
    color: palette.muted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: 22,
    fontWeight: '800',
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: 18,
    gap: 14,
    ...shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  cardImage: {
    width: 74,
    height: 74,
    borderRadius: 16,
    backgroundColor: palette.surfaceMuted,
  },
  cardCopy: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: '800',
  },
  cardMeta: {
    color: palette.muted,
    fontSize: 12,
  },
  prompt: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  starRow: {
    flexDirection: 'row',
    gap: 10,
  },
  starText: {
    fontSize: 34,
    color: palette.accent,
  },
  ratingLabel: {
    color: palette.success,
    fontSize: 14,
    fontWeight: '700',
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: palette.surfaceMuted,
  },
  tagChipActive: {
    backgroundColor: palette.surfaceRaised,
  },
  tagChipText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  tagChipTextActive: {
    color: palette.accent,
  },
  input: {
    backgroundColor: palette.background,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: palette.ink,
    fontSize: 14,
  },
  reviewBodyInput: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: 14,
    backgroundColor: palette.surfaceMuted,
  },
  secondaryButtonText: {
    color: palette.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  primaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: 14,
    backgroundColor: palette.accent,
  },
  primaryButtonText: {
    color: palette.surface,
    fontSize: 14,
    fontWeight: '800',
  },
});
