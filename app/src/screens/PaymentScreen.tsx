import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { orderApi } from '../api';
import { connectSocket } from '../api/socket';
import { useAuthStore } from '../stores/authStore';
import { useCartStore } from '../stores/cartStore';
import { RootStackNavigationProp, RootStackRouteProp } from '../types';

export default function PaymentScreen() {
  const route = useRoute<RootStackRouteProp<'Payment'>>();
  const navigation = useNavigation<RootStackNavigationProp<'Payment'>>();
  const { amount } = route.params;
  const { token, user } = useAuthStore();
  const { items, clearCart, total } = useCartStore();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');

  useEffect(() => {
    if (!token || !user) return;
    const socket = connectSocket(token);
    
    socket.on('order:paid', (data: any) => {
      setStatus('success');
      clearCart();
      setTimeout(() => {
        navigation.navigate('OrderQR', { orderId: data.orderId, qrToken: data.qrToken });
      }, 1500);
    });

    return () => {
      socket.off('order:paid');
    };
  }, [token, user]);

  const handlePayment = async () => {
    setLoading(true);
    setStatus('processing');
    
    try {
      const orderResponse = await orderApi.createOrder({
        items: items.map(item => ({
          menuItemId: item.menuItem.id,
          quantity: item.quantity,
          tempPreference: item.tempPreference,
        })),
        scheduledTime: items[0]?.scheduledTime || '12:00',
      });

      // Simulate Razorpay payment for demo
      setTimeout(() => {
        // In real app, would open Razorpay here
        // For demo, we'll simulate successful payment
      }, 2000);

    } catch (error) {
      setStatus('error');
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Complete Payment</Text>
        <Text style={styles.amount}>₹{amount}</Text>
        
        {status === 'idle' && (
          <TouchableOpacity style={styles.payButton} onPress={handlePayment} disabled={loading}>
            <Text style={styles.payButtonText}>
              {loading ? 'Processing...' : 'Pay with Razorpay'}
            </Text>
          </TouchableOpacity>
        )}

        {status === 'processing' && (
          <View style={styles.statusContainer}>
            <ActivityIndicator size="large" color="#f97316" />
            <Text style={styles.statusText}>Processing payment...</Text>
          </View>
        )}

        {status === 'success' && (
          <View style={styles.statusContainer}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.successText}>Payment Successful!</Text>
          </View>
        )}

        {status === 'error' && (
          <View style={styles.statusContainer}>
            <Text style={styles.errorIcon}>✗</Text>
            <Text style={styles.errorText}>Payment failed. Try again.</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => setStatus('idle')}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1e',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#141929',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 16,
  },
  amount: {
    fontSize: 48,
    fontWeight: '700',
    color: '#f97316',
    marginBottom: 32,
  },
  payButton: {
    backgroundColor: '#f97316',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  payButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  statusContainer: {
    alignItems: 'center',
  },
  statusText: {
    color: '#ffffff',
    marginTop: 16,
    fontSize: 16,
  },
  successIcon: {
    fontSize: 48,
    color: '#22c55e',
    fontWeight: '700',
  },
  successText: {
    color: '#22c55e',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 8,
  },
  errorIcon: {
    fontSize: 48,
    color: '#ef4444',
    fontWeight: '700',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
    marginTop: 8,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#1a2035',
    borderRadius: 8,
  },
  retryText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
