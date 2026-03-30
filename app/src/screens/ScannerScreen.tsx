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

const { width } = Dimensions.get('window');
const SCAN_AREA = width * 0.6;

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string; name?: string } | null>(null);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (!scanning) return;
    setScanning(false);

    try {
      // Decode JWT to get orderId
      const payload = JSON.parse(atob(data.split('.')[1]));
      const orderId = payload.orderId;

      const response = await orderApi.fulfillOrder(orderId, data);
      setResult({
        type: 'success',
        message: 'Order fulfilled!',
        name: response.data.order.userId,
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
    }, 3000);
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
        </View>
      )}
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
    fontSize: 18,
    marginTop: 8,
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
});
