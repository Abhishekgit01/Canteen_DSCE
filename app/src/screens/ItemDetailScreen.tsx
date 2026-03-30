import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useCartStore } from '../stores/cartStore';
import { RootStackNavigationProp, RootStackRouteProp } from '../types';

const { width } = Dimensions.get('window');

export default function ItemDetailScreen() {
  const route = useRoute<RootStackRouteProp<'ItemDetail'>>();
  const navigation = useNavigation<RootStackNavigationProp<'ItemDetail'>>();
  const { item } = route.params;
  const { addItem } = useCartStore();

  const [selectedTemp, setSelectedTemp] = useState(item.tempOptions[0] || 'normal');
  const [quantity, setQuantity] = useState(1);
  const [scheduledTime, setScheduledTime] = useState('');

  const generateTimeSlots = () => {
    const slots = [];
    const now = new Date();
    now.setMinutes(now.getMinutes() + 15);
    const end = new Date();
    end.setHours(20, 0, 0, 0);

    while (now <= end) {
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      slots.push(`${hours}:${minutes}`);
      now.setMinutes(now.getMinutes() + 15);
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  const handleAddToCart = () => {
    addItem({
      menuItem: item,
      quantity,
      tempPreference: selectedTemp,
      scheduledTime: scheduledTime || timeSlots[0],
    });
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.imageContainer}>
          <Image source={{ uri: item.imageUrl }} style={styles.image} />
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.description}>{item.description}</Text>

          <View style={styles.macros}>
            <View style={styles.macroItem}>
              <Text style={styles.macroValue}>{item.calories}</Text>
              <Text style={styles.macroLabel}>calories</Text>
            </View>
          </View>

          {item.tempOptions.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Temperature</Text>
              <View style={styles.tempContainer}>
                {item.tempOptions.map((temp) => (
                  <TouchableOpacity
                    key={temp}
                    style={[styles.tempChip, selectedTemp === temp && styles.activeTempChip]}
                    onPress={() => setSelectedTemp(temp)}
                  >
                    <Text style={[styles.tempText, selectedTemp === temp && styles.activeTempText]}>
                      {temp.charAt(0).toUpperCase() + temp.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pickup Time</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {timeSlots.map((time) => (
                <TouchableOpacity
                  key={time}
                  style={[styles.timeChip, scheduledTime === time && styles.activeTimeChip]}
                  onPress={() => setScheduledTime(time)}
                >
                  <Text style={[styles.timeText, scheduledTime === time && styles.activeTimeText]}>
                    {time}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quantity</Text>
            <View style={styles.quantityContainer}>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => setQuantity(Math.max(1, quantity - 1))}
              >
                <Text style={styles.quantityButtonText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.quantityText}>{quantity}</Text>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => setQuantity(quantity + 1)}
              >
                <Text style={styles.quantityButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.priceContainer}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalPrice}>₹{item.price * quantity}</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={handleAddToCart}>
          <Text style={styles.addButtonText}>Add to Cart</Text>
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
  imageContainer: {
    position: 'relative',
  },
  image: {
    width: width,
    height: 300,
    backgroundColor: '#141929',
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(10, 15, 30, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    color: '#ffffff',
    fontSize: 24,
  },
  content: {
    padding: 20,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#8892a4',
    lineHeight: 20,
    marginBottom: 16,
  },
  macros: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  macroItem: {
    backgroundColor: '#141929',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  macroValue: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  macroLabel: {
    color: '#8892a4',
    fontSize: 12,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  tempContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  tempChip: {
    backgroundColor: '#141929',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  activeTempChip: {
    backgroundColor: '#f97316',
  },
  tempText: {
    color: '#8892a4',
    fontWeight: '600',
  },
  activeTempText: {
    color: '#ffffff',
  },
  timeChip: {
    backgroundColor: '#141929',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 8,
  },
  activeTimeChip: {
    backgroundColor: '#f97316',
  },
  timeText: {
    color: '#8892a4',
    fontWeight: '600',
  },
  activeTimeText: {
    color: '#ffffff',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  quantityButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#141929',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButtonText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  quantityText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    minWidth: 40,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#141929',
    gap: 16,
  },
  priceContainer: {
    flex: 1,
  },
  totalLabel: {
    color: '#8892a4',
    fontSize: 12,
  },
  totalPrice: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
  },
  addButton: {
    backgroundColor: '#f97316',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
});
