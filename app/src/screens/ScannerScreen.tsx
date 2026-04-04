import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { orderApi } from '../api';
import { PaymentMode } from '../types';

const { width } = Dimensions.get('window');
const SCAN_AREA = width * 0.6;

function decodeBase64Url(value: string) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');

  let output = '';
  let bc = 0;
  let bs: number | undefined;
  let buffer: number;
  let index = 0;

  while ((buffer = chars.indexOf(padded.charAt(index++))) !== -1) {
    if (buffer === 64) {
      break;
    }

    bs = bc % 4 ? (bs ?? 0) * 64 + buffer : buffer;
    if (bc++ % 4) {
      output += String.fromCharCode(255 & ((bs ?? 0) >> ((-2 * bc) & 6)));
    }
  }

  try {
    return decodeURIComponent(
      output
        .split('')
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join(''),
    );
  } catch {
    return output;
  }
}

function getQrPayload(token: string) {
  const parts = token.split('.');
  if (parts.length < 2) {
    throw new Error('Invalid token format');
  }

  return JSON.parse(decodeBase64Url(parts[1])) as { orderId?: string };
}

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [paymentMode, setPaymentMode] = useState<PaymentMode | null>(null);
  const [result, setResult] = useState<{ 
    type: 'success' | 'error'; 
    message: string; 
    name?: string;
    items?: Array<{ name: string; quantity: number }>;
  } | null>(null);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  useEffect(() => {
    orderApi.getPaymentConfig()
      .then((response) => {
        setPaymentMode(response.data.mode);
      })
      .catch(() => {
        setPaymentMode(null);
      });
  }, []);

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (!scanning) return;
    setScanning(false);

    try {
      const payload = getQrPayload(data);
      const orderId = payload.orderId;

      if (!orderId) {
        throw new Error('Missing order ID');
      }

      const response = await orderApi.fulfillOrder(orderId, data);
      setResult({
        type: 'success',
        message: 'Order fulfilled!',
        name: response.data.order.userId?.name || response.data.order.userId,
        items: response.data.order.items,
      });
    } catch (error: any) {
      setResult({
        type: 'error',
        message: error.response?.data?.error || 'Invalid QR code',
      });
    }

    setTimeout(() => {
      setResult(null);
      setScanning(true);
    }, result?.type === 'success' ? 5000 : 3000);
  };

  if (!permission?.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Camera permission required</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanning ? handleBarcodeScanned : undefined}
      >
        <View style={styles.overlay}>
          <View style={styles.scanFrame} />
          <Text style={styles.scanText}>Scan QR Code</Text>
        </View>
      </CameraView>

      {result && (
        <View style={[styles.resultOverlay, result.type === 'success' ? styles.success : styles.error]}>
          <Text style={styles.resultText}>{result.message}</Text>
          {result.name && <Text style={styles.resultName}>{result.name}</Text>}
          
          {result.items && (
            <View style={styles.itemsList}>
              {result.items.map((item, idx) => (
                <Text key={idx} style={styles.itemRow}>
                  • {item.name} x {item.quantity}
                </Text>
              ))}
            </View>
          )}
        </View>
      )}

      {paymentMode === 'upi_link' ? (
        <View style={styles.noteContainer}>
          <Text style={styles.noteText}>
            Verify UPI payment in canteen PhonePe/GPay before scanning
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1e',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrame: {
    width: SCAN_AREA,
    height: SCAN_AREA,
    borderWidth: 2,
    borderColor: '#f97316',
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  scanText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 24,
  },
  resultOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  success: {
    backgroundColor: 'rgba(34, 197, 94, 0.9)',
  },
  error: {
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
  },
  resultText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
  },
  resultName: {
    color: '#ffffff',
    fontSize: 20,
    marginTop: 4,
    fontWeight: '600',
  },
  itemsList: {
    marginTop: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    padding: 16,
    borderRadius: 12,
    minWidth: '70%',
  },
  itemRow: {
    color: '#ffffff',
    fontSize: 16,
    marginBottom: 4,
  },
  permissionText: {
    color: '#ffffff',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 16,
  },
  permissionButton: {
    backgroundColor: '#f97316',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  noteContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 28,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(10, 15, 30, 0.86)',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.28)',
  },
  noteText: {
    color: '#f8fafc',
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
  },
});
