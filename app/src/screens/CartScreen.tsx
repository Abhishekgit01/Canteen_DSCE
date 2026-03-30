import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MainTabNavigationProp } from '../types';
import { useCartStore } from '../stores/cartStore';
import { orderApi } from '../api';

function getErrorMessage(error: any) {
  return error?.response?.data?.error || 'Could not create your order. Please try again.';
}

export default function CartScreen() {
  const navigation = useNavigation<MainTabNavigationProp<'Cart'>>();
  const { items, updateQuantity, total } = useCartStore();
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const subtotal = total();

  const handleCreateOrder = async () => {
    if (items.length === 0 || isCreatingOrder) {
      return;
    }

    setIsCreatingOrder(true);
    setErrorMessage('');

    try {
      const response = await orderApi.createOrder({
        items: items.map((item) => ({
          menuItemId: item.menuItem.id,
          quantity: item.quantity,
          tempPreference: item.tempPreference,
        })),
        scheduledTime: items[0]?.scheduledTime || '',
      });

      navigation.navigate('Payment', response.data);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsCreatingOrder(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Cart</Text>
        <Text style={styles.itemCount}>{items.length} items</Text>
      </View>

      <ScrollView style={styles.list}>
        {items.map((item) => (
          <View key={item.menuItem.id} style={styles.cartItem}>
            <Image source={{ uri: item.menuItem.imageUrl }} style={styles.itemImage} />
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.menuItem.name}</Text>
              <Text style={styles.itemTemp}>{item.tempPreference}</Text>
              <Text style={styles.itemTime}>Pickup: {item.scheduledTime}</Text>
              <Text style={styles.itemPrice}>₹{item.menuItem.price}</Text>
            </View>
            <View style={styles.quantityControls}>
              <TouchableOpacity
                style={styles.qtyButton}
                onPress={() => updateQuantity(item.menuItem.id, item.quantity - 1)}
              >
                <Text style={styles.qtyButtonText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.quantity}>{item.quantity}</Text>
              <TouchableOpacity
                style={styles.qtyButton}
                onPress={() => updateQuantity(item.menuItem.id, item.quantity + 1)}
              >
                <Text style={styles.qtyButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.summary}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>₹{subtotal}</Text>
          </View>
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>₹{subtotal}</Text>
          </View>
        </View>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        <TouchableOpacity
          style={[
            styles.payButton,
            (items.length === 0 || isCreatingOrder) && styles.payButtonDisabled,
          ]}
          disabled={items.length === 0 || isCreatingOrder}
          onPress={handleCreateOrder}
        >
          {isCreatingOrder ? (
            <View style={styles.payButtonLoading}>
              <ActivityIndicator color="#ffffff" size="small" />
              <Text style={styles.payButtonText}>Creating order...</Text>
            </View>
          ) : (
            <Text style={styles.payButtonText}>Proceed to Pay</Text>
          )}
        </TouchableOpacity>
      </View>
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
  itemCount: {
    color: '#8892a4',
    marginTop: 4,
  },
  list: {
    flex: 1,
    padding: 16,
  },
  cartItem: {
    flexDirection: 'row',
    backgroundColor: '#141929',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#1a2035',
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  itemName: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
  itemTemp: {
    color: '#8892a4',
    fontSize: 12,
    marginTop: 2,
  },
  itemTime: {
    color: '#f97316',
    fontSize: 12,
    marginTop: 2,
  },
  itemPrice: {
    color: '#ffffff',
    fontWeight: '700',
    marginTop: 4,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1a2035',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  quantity: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    minWidth: 24,
    textAlign: 'center',
  },
  footer: {
    padding: 16,
    backgroundColor: '#141929',
  },
  summary: {
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    color: '#8892a4',
  },
  summaryValue: {
    color: '#ffffff',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#1a2035',
    paddingTop: 8,
    marginTop: 8,
  },
  totalLabel: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 18,
  },
  totalValue: {
    color: '#f97316',
    fontWeight: '700',
    fontSize: 18,
  },
  payButton: {
    backgroundColor: '#f97316',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  payButtonDisabled: {
    opacity: 0.5,
  },
  payButtonLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  payButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  errorText: {
    color: '#fda4af',
    marginBottom: 12,
    textAlign: 'center',
  },
});
