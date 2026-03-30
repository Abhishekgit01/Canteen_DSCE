import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { orderApi } from '../api';
import { MainTabNavigationProp, Order } from '../types';

function getErrorMessage(error: any) {
  return error?.response?.data?.error || 'Could not open this order right now.';
}

export default function OrdersScreen() {
  const navigation = useNavigation<MainTabNavigationProp<'Orders'>>();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingOrderId, setOpeningOrderId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setErrorMessage('');
      const response = await orderApi.getMyOrders();
      setOrders(response.data);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return '#22c55e';
      case 'preparing': return '#f97316';
      case 'ready': return '#3b82f6';
      case 'fulfilled': return '#10b981';
      case 'failed': return '#ef4444';
      default: return '#8892a4';
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

  const renderItem = ({ item }: { item: Order }) => (
    <TouchableOpacity
      style={styles.orderCard}
      onPress={() => handleOrderPress(item)}
    >
      <View style={styles.orderHeader}>
        <Text style={styles.orderId}>Order #{item.id.slice(-6)}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status}
          </Text>
        </View>
      </View>
      <Text style={styles.orderDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
      <Text style={styles.orderItems}>
        {item.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
      </Text>
      {openingOrderId === item.id ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color="#f97316" size="small" />
          <Text style={styles.loadingText}>Opening QR...</Text>
        </View>
      ) : null}
      <Text style={styles.orderTotal}>₹{item.totalAmount}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Orders</Text>
      </View>

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <FlatList
        data={orders}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshing={loading}
        onRefresh={fetchOrders}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1e',
  },
  header: {
    padding: 16,
    paddingTop: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  list: {
    padding: 16,
  },
  errorText: {
    color: '#fda4af',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  orderCard: {
    backgroundColor: '#141929',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderId: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  orderDate: {
    color: '#8892a4',
    fontSize: 12,
    marginBottom: 8,
  },
  orderItems: {
    color: '#ffffff',
    fontSize: 14,
    marginBottom: 8,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  loadingText: {
    color: '#f8fafc',
    fontSize: 12,
  },
  orderTotal: {
    color: '#f97316',
    fontWeight: '700',
    fontSize: 16,
  },
});
