import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import AppIcon from '../components/AppIcon';
import { RootStackNavigationProp, RootStackRouteProp } from '../types';

export default function OrderSuccessScreen() {
  const route = useRoute<RootStackRouteProp<'OrderSuccess'>>();
  const navigation = useNavigation<RootStackNavigationProp<'OrderSuccess'>>();
  const { orderId } = route.params;

  return (
    <View style={styles.container}>
      <View style={styles.checkmark}>
        <AppIcon name="shield-check-outline" size={56} color="#ffffff" />
      </View>
      <Text style={styles.title}>Your order is ready!</Text>
      <Text style={styles.subtitle}>Order #{orderId.slice(-6)} has been fulfilled</Text>
      
      <TouchableOpacity style={styles.doneButton} onPress={() => navigation.navigate('Main', { screen: 'Home' })}>
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
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#8892a4',
    marginBottom: 48,
  },
  doneButton: {
    backgroundColor: '#f97316',
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 12,
  },
  doneButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
});
