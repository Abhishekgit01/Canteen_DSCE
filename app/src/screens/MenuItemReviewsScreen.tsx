import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { reviewsApi } from '../api';
import AppIcon from '../components/AppIcon';
import type { MenuItem, Review, RootStackScreenProps } from '../types';
import { palette, shadows } from '../theme';

const sortOptions = [
  { key: 'recent', label: 'Most Recent' },
  { key: 'helpful', label: 'Most Helpful' },
  { key: 'highest', label: 'Highest Rated' },
  { key: 'lowest', label: 'Lowest Rated' },
] as const;

type SortOption = (typeof sortOptions)[number]['key'];

export default function MenuItemReviewsScreen({
  route,
  navigation,
}: RootStackScreenProps<'ItemReviews'>) {
  const insets = useSafeAreaInsets();
  const { menuItemId, menuItemName } = route.params;
  const [menuItem, setMenuItem] = useState<
    Pick<MenuItem, 'name' | 'averageRating' | 'totalReviews' | 'ratingBreakdown'> | null
  >(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [sort, setSort] = useState<SortOption>('recent');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const fetchReviews = async (targetPage = 1, replace = true) => {
    try {
      if (replace) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      setErrorMessage('');
      const response = await reviewsApi.getItemReviews(menuItemId, targetPage, sort);
      setMenuItem({
        name: response.menuItem.name,
        averageRating: response.menuItem.averageRating,
        totalReviews: response.menuItem.totalReviews,
        ratingBreakdown: response.menuItem.ratingBreakdown,
      });
      setReviews((current) => (replace ? response.reviews : [...current, ...response.reviews]));
      setPage(response.pagination.page);
      setPages(response.pagination.pages);
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.error || 'Could not load reviews right now.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    void fetchReviews(1, true);
  }, [menuItemId, sort]);

  const totalReviews = menuItem?.totalReviews || 0;
  const breakdown = menuItem?.ratingBreakdown || { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };

  const ratingRows = useMemo(
    () =>
      [5, 4, 3, 2, 1].map((star) => {
        const count = breakdown[String(star) as keyof typeof breakdown] || 0;
        const percent = totalReviews > 0 ? (count / totalReviews) * 100 : 0;

        return {
          star,
          count,
          percent,
        };
      }),
    [breakdown, totalReviews],
  );

  const handleHelpful = async (reviewId: string) => {
    try {
      const response = await reviewsApi.markReviewHelpful(reviewId);
      setReviews((current) =>
        current.map((review) =>
          review.id === reviewId ? { ...review, helpful: response.helpful } : review,
        ),
      );
    } catch (error) {
      console.error('Failed to mark review as helpful:', error);
    }
  };

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
            <Text style={styles.title}>{menuItem?.name || menuItemName || 'Reviews'}</Text>
            <Text style={styles.subtitle}>
              {menuItem && menuItem.totalReviews > 0
                ? `${menuItem.averageRating.toFixed(1)} average from ${menuItem.totalReviews} verified reviews`
                : 'Reviews from recent student orders will appear here.'}
            </Text>
          </View>
        </View>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        {menuItem ? (
          <View style={styles.summaryCard}>
            <View style={styles.summaryMain}>
              <Text style={styles.summaryRating}>{menuItem.averageRating.toFixed(1)}</Text>
              <View>
                <Text style={styles.summaryStars}>{'★'.repeat(Math.round(menuItem.averageRating || 0))}</Text>
                <Text style={styles.summaryCount}>{menuItem.totalReviews} reviews</Text>
              </View>
            </View>

            <View style={styles.breakdownList}>
              {ratingRows.map((row) => (
                <View key={row.star} style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>{row.star}★</Text>
                  <View style={styles.breakdownBar}>
                    <View style={[styles.breakdownFill, { width: `${row.percent}%` }]} />
                  </View>
                  <Text style={styles.breakdownPercent}>{Math.round(row.percent)}%</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.sortRow}>
          {sortOptions.map((option) => {
            const active = option.key === sort;
            return (
              <TouchableOpacity
                key={option.key}
                activeOpacity={0.88}
                style={[styles.sortChip, active && styles.sortChipActive]}
                onPress={() => setSort(option.key)}
              >
                <Text style={[styles.sortChipText, active && styles.sortChipTextActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={palette.accent} />
            <Text style={styles.centerText}>Loading reviews...</Text>
          </View>
        ) : reviews.length === 0 ? (
          <View style={styles.centerState}>
            <Text style={styles.emptyTitle}>No reviews yet</Text>
            <Text style={styles.centerText}>
              Once students rate this item, the canteen community feedback will show up here.
            </Text>
          </View>
        ) : (
          reviews.map((review) => (
            <View key={review.id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {review.student?.name?.charAt(0).toUpperCase() || 'S'}
                  </Text>
                </View>
                <View style={styles.reviewHeaderCopy}>
                  <Text style={styles.reviewerName}>{review.student?.name || 'Student'}</Text>
                  <Text style={styles.reviewerMeta}>
                    {review.student?.college || review.college || 'Campus student'}
                  </Text>
                </View>
                <Text style={styles.reviewStars}>
                  {'★'.repeat(review.rating)}
                  {'☆'.repeat(5 - review.rating)}
                </Text>
              </View>

              <Text style={styles.verifiedBadge}>Verified purchase</Text>

              {review.title ? <Text style={styles.reviewTitle}>{review.title}</Text> : null}
              {review.body ? <Text style={styles.reviewBody}>{review.body}</Text> : null}

              {review.tags.length > 0 ? (
                <View style={styles.reviewTagWrap}>
                  {review.tags.map((tag) => (
                    <View key={tag} style={styles.reviewTag}>
                      <Text style={styles.reviewTagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <View style={styles.reviewFooter}>
                <TouchableOpacity
                  activeOpacity={0.88}
                  style={styles.helpfulButton}
                  onPress={() => void handleHelpful(review.id)}
                >
                  <Text style={styles.helpfulButtonText}>Helpful</Text>
                </TouchableOpacity>
                <Text style={styles.helpfulMeta}>
                  {review.helpful > 0 ? `${review.helpful} found this helpful` : 'Be the first to react'}
                </Text>
                <Text style={styles.reviewDate}>{new Date(review.createdAt).toLocaleDateString()}</Text>
              </View>
            </View>
          ))
        )}

        {page < pages ? (
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.loadMoreButton}
            onPress={() => void fetchReviews(page + 1, false)}
          >
            <Text style={styles.loadMoreText}>{loadingMore ? 'Loading...' : 'Load more reviews'}</Text>
          </TouchableOpacity>
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
  summaryCard: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: 18,
    gap: 16,
    ...shadows.card,
  },
  summaryMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  summaryRating: {
    color: palette.ink,
    fontSize: 44,
    fontWeight: '900',
  },
  summaryStars: {
    color: palette.accent,
    fontSize: 20,
    fontWeight: '800',
  },
  summaryCount: {
    color: palette.muted,
    fontSize: 13,
    marginTop: 6,
  },
  breakdownList: {
    gap: 10,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  breakdownLabel: {
    width: 28,
    color: palette.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  breakdownBar: {
    flex: 1,
    height: 10,
    borderRadius: 999,
    backgroundColor: palette.surfaceMuted,
    overflow: 'hidden',
  },
  breakdownFill: {
    height: '100%',
    backgroundColor: palette.accent,
  },
  breakdownPercent: {
    width: 42,
    color: palette.muted,
    fontSize: 12,
    textAlign: 'right',
  },
  sortRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sortChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: palette.surface,
    ...shadows.card,
  },
  sortChipActive: {
    backgroundColor: palette.surfaceRaised,
  },
  sortChipText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  sortChipTextActive: {
    color: palette.accent,
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
  reviewCard: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: 18,
    gap: 12,
    ...shadows.card,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: palette.accent,
    fontSize: 18,
    fontWeight: '800',
  },
  reviewHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  reviewerName: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  reviewerMeta: {
    color: palette.muted,
    fontSize: 12,
  },
  reviewStars: {
    color: palette.accent,
    fontSize: 16,
    fontWeight: '700',
  },
  verifiedBadge: {
    color: palette.success,
    fontSize: 12,
    fontWeight: '700',
  },
  reviewTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  reviewBody: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  reviewTagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reviewTag: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: palette.surfaceMuted,
  },
  reviewTagText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  reviewFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  helpfulButton: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: palette.surfaceRaised,
  },
  helpfulButtonText: {
    color: palette.accent,
    fontSize: 12,
    fontWeight: '800',
  },
  helpfulMeta: {
    color: palette.muted,
    fontSize: 12,
    flex: 1,
  },
  reviewDate: {
    color: palette.subtle,
    fontSize: 12,
  },
  loadMoreButton: {
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: palette.surface,
    ...shadows.card,
  },
  loadMoreText: {
    color: palette.accent,
    fontSize: 13,
    fontWeight: '800',
  },
});
