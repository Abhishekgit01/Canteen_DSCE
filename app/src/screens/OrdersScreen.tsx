import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { orderApi, reviewsApi } from '../api';
import AppIcon from '../components/AppIcon';
import { MainTabNavigationProp, Order, PendingReviewItem } from '../types';
import { palette, shadows } from '../theme';

function getErrorMessage(error: any) {
  return error?.response?.data?.error || 'Could not open this order right now.';
}

const getStatusTheme = (status: Order['status']) => {
  switch (status) {
    case 'paid':
      return { backgroundColor: palette.successSoft, color: palette.success, label: 'Paid' };
    case 'preparing':
      return { backgroundColor: palette.warningSoft, color: palette.accent, label: 'Preparing' };
    case 'ready':
      return { backgroundColor: palette.infoSoft, color: palette.info, label: 'Ready' };
    case 'fulfilled':
      return { backgroundColor: palette.successSoft, color: palette.success, label: 'Collected' };
    case 'failed':
      return { backgroundColor: palette.dangerSoft, color: palette.danger, label: 'Failed' };
    default:
      return { backgroundColor: palette.surfaceMuted, color: palette.muted, label: 'Pending' };
  }
};

export default function OrdersScreen() {
  const navigation = useNavigation<MainTabNavigationProp<'Orders'>>();
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingOrderId, setOpeningOrderId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [pendingReviewCounts, setPendingReviewCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    void fetchOrdersAndPending();
  }, []);

  const fetchOrdersAndPending = async () => {
    try {
      setErrorMessage('');
      const [ordersResponse, pendingResponse] = await Promise.all([
        orderApi.getMyOrders(),
        reviewsApi.getPendingReviews().catch(() => [] as PendingReviewItem[]),
      ]);
      const sortedOrders = [...ordersResponse.data].sort(
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      );
      setOrders(sortedOrders);
      const counts = pendingResponse.reduce<Record<string, number>>((accumulator, item) => {
        accumulator[item.orderId] = (accumulator[item.orderId] || 0) + 1;
        return accumulator;
      }, {});
      setPendingReviewCounts(counts);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleOrderPress = async (order: Order) => {
    if (!['paid', 'preparing', 'ready'].includes(order.status)) {
      return;
    }

    setOpeningOrderId(order.id);
    setErrorMessage('');

    try {
      const response = await orderApi.getOrder(order.id);
      if (response.data?.qrToken) {
        navigation.navigate('OrderQR', {
          orderId: order.id,
          qrToken: response.data.qrToken,
        });
      } else {
        setErrorMessage('QR code is not ready yet for this order.');
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setOpeningOrderId(null);
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: insets.top + 12, paddingBottom: 110 + insets.bottom },
        ]}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchOrdersAndPending} tintColor={palette.accent} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Your Orders</Text>
            <Text style={styles.subtitle}>Track live orders and reopen your QR any time.</Text>
            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color={palette.accent} />
              <Text style={styles.loadingText}>Fetching your orders...</Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <AppIcon name="receipt-text-outline" size={28} color={palette.brand} />
              </View>
              <Text style={styles.emptyTitle}>No orders yet</Text>
              <Text style={styles.emptyText}>
                Once you place your first canteen order, it will show up here with its live status.
              </Text>
            </View>
          )
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => {
          const statusTheme = getStatusTheme(item.status);
          const itemSummary = item.items.map((entry) => `${entry.quantity}x ${entry.name}`).join(' · ');
          const interactive = ['paid', 'preparing', 'ready'].includes(item.status);
          const pendingReviewCount = pendingReviewCounts[item.id] || 0;

          return (
            <TouchableOpacity
              activeOpacity={interactive ? 0.94 : 1}
              style={styles.orderCard}
              onPress={() => void handleOrderPress(item)}
            >
              <View style={styles.orderHeader}>
                <View>
                  <Text style={styles.orderId}>Order #{item.id.slice(-6).toUpperCase()}</Text>
                  <Text style={styles.orderDate}>
                    {new Date(item.createdAt).toLocaleString()}
                  </Text>
                  {item.isPreOrder && (
                    <View style={styles.preOrderBadge}>
                      <Text style={styles.preOrderBadgeText}>Pre-Order</Text>
                      {item.scheduledFor && (
                         <Text style={styles.preOrderDateText}>
                           For: {new Date(item.scheduledFor).toLocaleString()}
                         </Text>
                      )}
                    </View>
                  )}
                </View>

                <View style={[styles.statusBadge, { backgroundColor: statusTheme.backgroundColor }]}>
                  <Text style={[styles.statusText, { color: statusTheme.color }]}>
                    {statusTheme.label}
                  </Text>
                </View>
              </View>

              <Text style={styles.orderItems} numberOfLines={2}>
                {itemSummary}
              </Text>

              <View style={styles.footerRow}>
                <View>
                  <Text style={styles.totalCaption}>Total</Text>
                  <Text style={styles.totalText}>₹{item.totalAmount}</Text>
                </View>

                {openingOrderId === item.id ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color={palette.accent} />
                    <Text style={styles.actionText}>Opening QR...</Text>
                  </View>
                ) : interactive ? (
                  <View style={styles.actionRow}>
                    <Text style={styles.actionText}>Open pickup QR</Text>
                    <AppIcon name="chevron-right" size={18} color={palette.accent} />
                  </View>
                ) : item.status === 'fulfilled' && pendingReviewCount > 0 ? (
                  <TouchableOpacity
                    activeOpacity={0.86}
                    style={styles.reviewButton}
                    onPress={() => navigation.navigate('RateOrder', { orderId: item.id })}
                  >
                    <Text style={styles.reviewButtonText}>
                      Rate meal ({pendingReviewCount})
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.secondaryAction}>
                    {item.status === 'fulfilled' ? 'Collected successfully' : 'Awaiting update'}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  listContent: {
    paddingHorizontal: 16,
  },
  header: {
    paddingBottom: 18,
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
    marginTop: 6,
  },
  separator: {
    height: 14,
  },
  orderCard: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: 16,
    gap: 14,
    ...shadows.card,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },
  orderId: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  orderDate: {
    color: palette.muted,
    fontSize: 12,
    marginTop: 4,
  },
  preOrderBadge: {
    marginTop: 4,
    backgroundColor: palette.warningSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  preOrderBadgeText: {
    color: palette.accent,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  preOrderDateText: {
    color: palette.accent,
    fontSize: 10,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
  },
  orderItems: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  totalCaption: {
    color: palette.muted,
    fontSize: 12,
  },
  totalText: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: '900',
    marginTop: 3,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  reviewButton: {
    backgroundColor: palette.surfaceRaised,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  reviewButtonText: {
    color: palette.accent,
    fontSize: 13,
    fontWeight: '800',
  },
  actionText: {
    color: palette.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryAction: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingTop: 60,
    gap: 12,
  },
  loadingText: {
    color: palette.muted,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: palette.warningSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: 22,
    fontWeight: '800',
  },
  emptyText: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
});
