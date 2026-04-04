import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useRoute, useNavigation } from '@react-navigation/native';
import { orderApi } from '../api';
import AppIcon from '../components/AppIcon';
import { RootStackNavigationProp, RootStackRouteProp } from '../types';

export default function OrderSuccessScreen() {
  const route = useRoute<RootStackRouteProp<'OrderSuccess'>>();
  const navigation = useNavigation<RootStackNavigationProp<'OrderSuccess'>>();
  const { orderId } = route.params;
  const [order, setOrder] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const itemsOpacity = useSharedValue(0);

  React.useEffect(() => {
    const fetchOrder = async () => {
      try {
        const response = await orderApi.getOrder(orderId);
        setOrder(response.data);
      } catch (err) {
        console.error('Failed to fetch order details:', err);
      } finally {
        setLoading(false);
        // Start animations
        scale.value = withSpring(1, { damping: 12, stiffness: 100 });
        opacity.value = withTiming(1, { duration: 600 });
        itemsOpacity.value = withDelay(400, withTiming(1, { duration: 800 }));
      }
    };
    void fetchOrder();
  }, [orderId]);

  const animatedCheckmark = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const animatedItems = useAnimatedStyle(() => ({
    opacity: itemsOpacity.value,
    transform: [{ translateY: withSpring(itemsOpacity.value === 1 ? 0 : 20) }],
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.checkmark, animatedCheckmark]}>
        <AppIcon name="shield-check-outline" size={64} color="#ffffff" />
      </Animated.View>
      
      <Animated.View style={[{ alignItems: 'center' }, animatedCheckmark]}>
        <Text style={styles.title}>Your order is ready!</Text>
        <Text style={styles.subtitle}>Order #{orderId.slice(-6).toUpperCase()} has been fulfilled</Text>
      </Animated.View>

      {loading ? (
        <ActivityIndicator size="large" color="#f97316" style={{ marginTop: 20 }} />
      ) : order ? (
        <Animated.View style={[styles.detailsCard, animatedItems]}>
          <Text style={styles.detailsTitle}>Items Ordered</Text>
          <View style={styles.itemsList}>
            {order.items.map((item: any, idx: number) => (
              <View key={idx} style={styles.itemRow}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemQty}>x{item.quantity}</Text>
              </View>
            ))}
          </View>
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Paid</Text>
            <Text style={styles.totalValue}>₹{order.totalAmount.toFixed(2)}</Text>
          </View>
        </Animated.View>
      ) : null}
      
      <TouchableOpacity 
        style={styles.doneButton} 
        onPress={() => navigation.navigate('Main', { screen: 'Home' })}
      >
        <Text style={styles.doneButtonText}>Done</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1e',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  checkmark: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    shadowColor: '#22c55e',
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#8892a4',
    marginBottom: 32,
  },
  detailsCard: {
    backgroundColor: '#161b2e',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginTop: 8,
  },
  detailsTitle: {
    color: '#f97316',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  itemsList: {
    gap: 12,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  itemQty: {
    color: '#8892a4',
    fontSize: 16,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 16,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  totalValue: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  doneButton: {
    marginTop: 40,
    backgroundColor: '#f97316',
    paddingHorizontal: 60,
    paddingVertical: 18,
    borderRadius: 18,
    shadowColor: '#f97316',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  doneButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
});
