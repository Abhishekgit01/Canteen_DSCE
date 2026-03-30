import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import { getSocket } from '../api/socket';
import { RootStackNavigationProp, RootStackRouteProp } from '../types';

const { width } = Dimensions.get('window');

export default function OrderQRScreen() {
  const route = useRoute<RootStackRouteProp<'OrderQR'>>();
  const navigation = useNavigation<RootStackNavigationProp<'OrderQR'>>();
  const { orderId, qrToken } = route.params;

  useEffect(() => {
    const socket = getSocket();
    socket?.on('order:fulfilled', (data: any) => {
      if (data.orderId === orderId) {
        navigation.navigate('OrderSuccess', { orderId });
      }
    });

    return () => {
      socket?.off('order:fulfilled');
    };
  }, [orderId]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Show this QR to Canteen Staff</Text>
      
      <View style={styles.qrContainer}>
        <QRCode
          value={qrToken}
          size={280}
          backgroundColor="#ffffff"
          color="#0a0f1e"
        />
      </View>

      <View style={styles.pulseContainer}>
        <View style={[styles.pulseDot, styles.pulse1]} />
        <View style={[styles.pulseDot, styles.pulse2]} />
        <View style={[styles.pulseDot, styles.pulse3]} />
        <Text style={styles.pulseText}>Show this to canteen staff</Text>
      </View>

      <TouchableOpacity
        style={styles.doneButton}
        onPress={() => navigation.navigate('Main', { screen: 'Orders' })}
      >
        <Text style={styles.doneButtonText}>View Orders</Text>
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
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 32,
    textAlign: 'center',
  },
  qrContainer: {
    backgroundColor: '#ffffff',
    padding: 24,
    borderRadius: 16,
    marginBottom: 32,
  },
  pulseContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f97316',
  },
  pulse1: {
    opacity: 1,
  },
  pulse2: {
    opacity: 0.6,
  },
  pulse3: {
    opacity: 0.3,
  },
  pulseText: {
    color: '#f97316',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  doneButton: {
    position: 'absolute',
    bottom: 40,
    backgroundColor: '#f97316',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 12,
  },
  doneButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
});
