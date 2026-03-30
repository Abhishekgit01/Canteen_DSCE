import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
  Linking,
  TextInput,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { orderApi, paymentApi } from '../api';
import { connectSocket } from '../api/socket';
import { useAuthStore } from '../stores/authStore';
import { useCartStore } from '../stores/cartStore';
import {
  MockPaymentInitResponse,
  RazorpayPaymentInitResponse,
  RootStackNavigationProp,
  RootStackRouteProp,
  UpiLinkPaymentInitResponse,
} from '../types';

const upiAppOptions = [
  { key: 'gpay', label: 'Google Pay', badge: 'G', tint: '#2563eb', background: '#e0ecff' },
  { key: 'phonepe', label: 'PhonePe', badge: 'P', tint: '#6d28d9', background: '#efe3ff' },
  { key: 'paytm', label: 'Paytm UPI', badge: '₹', tint: '#0f766e', background: '#dff8f4' },
] as const;

function formatAmount(amount: number) {
  return amount.toFixed(2).replace(/\.00$/, '');
}

function getErrorMessage(error: any) {
  return error?.response?.data?.error || error?.description || 'Payment failed. Please try again.';
}

export default function PaymentScreen() {
  const route = useRoute<RootStackRouteProp<'Payment'>>();
  const navigation = useNavigation<RootStackNavigationProp<'Payment'>>();
  const { token, user } = useAuthStore();
  const { clearCart } = useCartStore();
  const payment = route.params;
  const { amount, mode, orderId } = payment;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [upiAppOpened, setUpiAppOpened] = useState(false);
  const [upiTransactionId, setUpiTransactionId] = useState('');
  const [selectedUpiApp, setSelectedUpiApp] = useState<(typeof upiAppOptions)[number]['key']>('gpay');
  const pulse = useRef(new Animated.Value(1)).current;
  const hasNavigatedRef = useRef(false);
  const razorpayStartedRef = useRef(false);

  const shortOrderId = orderId.slice(-6).toUpperCase();
  const upiPayment = mode === 'upi_link' ? (payment as UpiLinkPaymentInitResponse) : null;
  const merchantName = upiPayment?.canteenName || 'DSCE Canteen';
  const merchantUpiId = upiPayment?.canteenUpiId || 'canteen@upi';
  const selectedUpiAppLabel =
    upiAppOptions.find((option) => option.key === selectedUpiApp)?.label || 'Google Pay';

  useEffect(() => {
    if (mode !== 'mock') {
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.04,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [mode, pulse]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const socket = connectSocket(token);
    const handlePaid = (data: any) => {
      if (data?.orderId === orderId && typeof data.qrToken === 'string') {
        void navigateToOrderQr(data.qrToken);
      }
    };

    socket.on('order:paid', handlePaid);

    return () => {
      socket.off('order:paid', handlePaid);
    };
  }, [orderId, token]);

  const navigateToOrderQr = async (qrToken: string) => {
    if (hasNavigatedRef.current) {
      return;
    }

    hasNavigatedRef.current = true;
    await clearCart();
    navigation.replace('OrderQR', { orderId, qrToken });
  };

  const fetchQrAndNavigate = async () => {
    const response = await orderApi.getOrder(orderId);
    const qrToken = response.data?.qrToken;

    if (!qrToken) {
      throw new Error('QR code is not ready yet. Please try again in a moment.');
    }

    await navigateToOrderQr(qrToken);
  };

  const handleMockPayment = async () => {
    const mockPayment = payment as MockPaymentInitResponse;

    setIsSubmitting(true);
    setStatusMessage('Processing...');
    setErrorMessage('');

    try {
      await paymentApi.confirmMockPayment({
        orderId,
        transactionId: mockPayment.transactionId,
      });

      await fetchQrAndNavigate();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setIsSubmitting(false);
      setStatusMessage(null);
    }
  };

  const openUpiApp = async () => {
    const upiPayment = payment as UpiLinkPaymentInitResponse;
    setErrorMessage('');

    try {
      await Linking.openURL(upiPayment.upiUri);
      setUpiAppOpened(true);
    } catch {
      setErrorMessage('Could not open a UPI app on this device.');
    }
  };

  const handleUpiConfirmation = async () => {
    setIsSubmitting(true);
    setStatusMessage('Confirming payment...');
    setErrorMessage('');

    try {
      await paymentApi.confirmUpiPayment({
        orderId,
        upiTransactionId,
      });

      await fetchQrAndNavigate();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setIsSubmitting(false);
      setStatusMessage(null);
    }
  };

  useEffect(() => {
    if (mode !== 'razorpay' || razorpayStartedRef.current) {
      return;
    }

    const razorpayPayment = payment as RazorpayPaymentInitResponse;
    razorpayStartedRef.current = true;

    let cancelled = false;

    const startRazorpay = async () => {
      setIsSubmitting(true);
      setStatusMessage('Opening Razorpay...');
      setErrorMessage('');

      try {
        const RazorpayCheckout = require('react-native-razorpay').default;

        await RazorpayCheckout.open({
          key: razorpayPayment.key,
          amount: String(Math.round(amount * 100)),
          currency: 'INR',
          name: 'DSCE Canteen',
          description: `Order #${shortOrderId}`,
          order_id: razorpayPayment.razorpayOrderId,
          prefill: {
            name: user?.name,
            email: user?.email,
          },
          notes: {
            orderId,
          },
          theme: {
            color: '#f97316',
          },
        });

        if (cancelled || hasNavigatedRef.current) {
          return;
        }

        setStatusMessage('Payment received. Waiting for confirmation...');
      } catch (error) {
        if (cancelled || hasNavigatedRef.current) {
          return;
        }

        setIsSubmitting(false);
        setStatusMessage(null);
        setErrorMessage(getErrorMessage(error));
      }
    };

    void startRazorpay();

    return () => {
      cancelled = true;
    };
  }, [amount, mode, orderId, payment, shortOrderId, user?.email, user?.name]);

  const renderStatus = () => {
    if (!statusMessage && !isSubmitting) {
      return null;
    }

    return (
      <View style={styles.statusContainer}>
        <ActivityIndicator size="small" color="#f97316" />
        <Text style={styles.statusText}>{statusMessage || 'Processing...'}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Complete Payment</Text>
        <Text style={styles.headerSubtitle}>Order #{shortOrderId}</Text>
      </View>

      {mode === 'mock' ? (
        <>
          <View style={styles.mockCard}>
            <View style={styles.brandRow}>
              <View style={styles.brandMark}>
                <Text style={styles.brandMarkText}>G</Text>
              </View>
              <View>
                <Text style={styles.brandName}>Google Pay</Text>
                <Text style={styles.brandType}>UPI payment</Text>
              </View>
            </View>

            <View style={styles.sectionDivider} />

            <Text style={styles.amountLabel}>You pay</Text>
            <Text style={styles.amount}>₹{formatAmount(amount)}</Text>

            <View style={styles.detailGrid}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>To</Text>
                <Text style={styles.detailValue}>{merchantName}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>UPI ID</Text>
                <Text style={styles.detailValue}>{merchantUpiId}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Order</Text>
                <Text style={styles.detailValue}>#{shortOrderId}</Text>
              </View>
            </View>
          </View>

          <View style={styles.instructionsCard}>
            <Text style={styles.appsTitle}>Choose a UPI app</Text>
            <View style={styles.appsRow}>
              {upiAppOptions.map((option) => {
                const active = selectedUpiApp === option.key;

                return (
                  <TouchableOpacity
                    key={option.key}
                    activeOpacity={0.9}
                    style={[styles.appChip, active && styles.appChipActive]}
                    onPress={() => setSelectedUpiApp(option.key)}
                  >
                    <View style={[styles.appBadge, { backgroundColor: option.background }]}>
                      <Text style={[styles.appBadgeText, { color: option.tint }]}>{option.badge}</Text>
                    </View>
                    <Text style={[styles.appChipText, active && styles.appChipTextActive]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.inputHelper}>
              The checkout flow mirrors a real UPI handoff so you can test the full journey cleanly.
            </Text>
          </View>

          <Animated.View style={{ transform: [{ scale: pulse }] }}>
            <TouchableOpacity
              style={[styles.primaryButton, isSubmitting && styles.primaryButtonDisabled]}
              onPress={handleMockPayment}
              disabled={isSubmitting}
            >
              <Text style={styles.primaryButtonText}>
                {isSubmitting ? 'Processing...' : `Continue with ${selectedUpiAppLabel}`}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </>
      ) : null}

      {mode === 'upi_link' ? (
        <>
          <View style={styles.mockCard}>
            <View style={styles.brandRow}>
              <View style={styles.brandMark}>
                <Text style={styles.brandMarkText}>G</Text>
              </View>
              <View>
                <Text style={styles.brandName}>Google Pay</Text>
                <Text style={styles.brandType}>UPI payment</Text>
              </View>
            </View>

            <View style={styles.sectionDivider} />

            <Text style={styles.amountLabel}>You pay</Text>
            <Text style={styles.amount}>₹{formatAmount(amount)}</Text>

            <View style={styles.detailGrid}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>To</Text>
                <Text style={styles.detailValue}>{merchantName}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>UPI ID</Text>
                <Text style={styles.detailValue}>{merchantUpiId}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Order</Text>
                <Text style={styles.detailValue}>#{shortOrderId}</Text>
              </View>
            </View>
          </View>

          <View style={styles.instructionsCard}>
            <Text style={styles.appsTitle}>Choose a UPI app</Text>
            <View style={styles.appsRow}>
              {upiAppOptions.map((option) => {
                const active = selectedUpiApp === option.key;

                return (
                  <TouchableOpacity
                    key={option.key}
                    activeOpacity={0.9}
                    style={[styles.appChip, active && styles.appChipActive]}
                    onPress={() => setSelectedUpiApp(option.key)}
                  >
                    <View style={[styles.appBadge, { backgroundColor: option.background }]}>
                      <Text style={[styles.appBadgeText, { color: option.tint }]}>{option.badge}</Text>
                    </View>
                    <Text style={[styles.appChipText, active && styles.appChipTextActive]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.stepRow}>
              <View style={styles.stepIcon}>
                <Text style={styles.stepIconText}>1</Text>
              </View>
              <Text style={styles.stepText}>Tap the button below to open your UPI app</Text>
            </View>
            <View style={styles.stepRow}>
              <View style={styles.stepIcon}>
                <Text style={styles.stepIconText}>2</Text>
              </View>
              <Text style={styles.stepText}>Pay ₹{formatAmount(amount)} to DSCE Canteen</Text>
            </View>
            <View style={styles.stepRow}>
              <View style={styles.stepIcon}>
                <Text style={styles.stepIconText}>3</Text>
              </View>
              <Text style={styles.stepText}>
                Come back here and enter your UPI transaction ID
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={openUpiApp}
            disabled={isSubmitting}
          >
            <Text style={styles.primaryButtonText}>Open {selectedUpiAppLabel}</Text>
          </TouchableOpacity>

          {upiAppOpened ? (
            <View style={styles.inputCard}>
              <Text style={styles.inputLabel}>Enter Transaction ID from your UPI app</Text>
              <Text style={styles.inputHelper}>
                Find it in GPay under Transaction Details or PhonePe under History
              </Text>
              <TextInput
                value={upiTransactionId}
                onChangeText={(value) => setUpiTransactionId(value.replace(/\D/g, ''))}
                placeholder="e.g. 316847291234"
                placeholderTextColor="#6b7280"
                keyboardType="number-pad"
                style={styles.input}
              />
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  (upiTransactionId.length < 8 || isSubmitting) && styles.primaryButtonDisabled,
                ]}
                onPress={handleUpiConfirmation}
                disabled={upiTransactionId.length < 8 || isSubmitting}
              >
                <Text style={styles.primaryButtonText}>Confirm Payment</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <Text style={styles.bottomNote}>
            Paid to: {merchantUpiId}
          </Text>
        </>
      ) : null}

      {mode === 'razorpay' ? (
        <View style={styles.razorpayCard}>
          <Text style={styles.amount}>₹{formatAmount(amount)}</Text>
          <Text style={styles.mutedText}>Launching Razorpay checkout</Text>
          <Text style={styles.mutedText}>Stay on this screen until payment is confirmed.</Text>
        </View>
      ) : null}

      {renderStatus()}

      {errorMessage ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      {mode === 'razorpay' ? (
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.goBack()}
          disabled={isSubmitting}
        >
          <Text style={styles.secondaryButtonText}>Go Back</Text>
        </TouchableOpacity>
      ) : null}

      <View style={styles.footerGlow} />
      <View style={styles.footerGlowSecondary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050816',
    paddingHorizontal: 24,
    paddingTop: 72,
    paddingBottom: 36,
  },
  header: {
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
  },
  headerSubtitle: {
    marginTop: 6,
    color: '#8f9bb3',
    fontSize: 14,
  },
  mockCard: {
    backgroundColor: '#101827',
    borderRadius: 24,
    padding: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandMark: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#e0ecff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkText: {
    color: '#2563eb',
    fontSize: 24,
    fontWeight: '800',
  },
  brandName: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  brandType: {
    color: '#8f9bb3',
    fontSize: 13,
    marginTop: 2,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 20,
  },
  amountLabel: {
    color: '#8f9bb3',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  instructionsCard: {
    backgroundColor: '#101827',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 18,
  },
  razorpayCard: {
    backgroundColor: '#101827',
    borderRadius: 24,
    padding: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    gap: 8,
  },
  inputCard: {
    backgroundColor: '#0f1726',
    borderRadius: 20,
    padding: 20,
    marginTop: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  amount: {
    fontSize: 40,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 18,
  },
  detailGrid: {
    gap: 14,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  detailLabel: {
    color: '#8f9bb3',
    fontSize: 14,
  },
  detailValue: {
    flex: 1,
    textAlign: 'right',
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '600',
  },
  mutedText: {
    color: '#8f9bb3',
    fontSize: 15,
    marginTop: 4,
  },
  primaryButton: {
    marginTop: 22,
    backgroundColor: '#f97316',
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#f97316',
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryButton: {
    marginTop: 18,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#273245',
    backgroundColor: '#0b1220',
  },
  secondaryButtonText: {
    color: '#cbd5e1',
    fontWeight: '600',
  },
  appsTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  appsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  appChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#0f1726',
  },
  appChipActive: {
    borderColor: 'rgba(249, 115, 22, 0.42)',
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
  },
  appBadge: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appBadgeText: {
    fontSize: 16,
    fontWeight: '800',
  },
  appChipText: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '600',
  },
  appChipTextActive: {
    color: '#ffffff',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(249, 115, 22, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stepIconText: {
    color: '#f97316',
    fontWeight: '700',
  },
  stepText: {
    flex: 1,
    color: '#e5e7eb',
    fontSize: 14,
    lineHeight: 20,
  },
  inputLabel: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  inputHelper: {
    color: '#8f9bb3',
    fontSize: 13,
    marginTop: 8,
    lineHeight: 18,
  },
  input: {
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#273245',
    backgroundColor: '#08101d',
    color: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    gap: 10,
  },
  statusText: {
    color: '#f8fafc',
    fontSize: 14,
  },
  errorCard: {
    backgroundColor: 'rgba(127, 29, 29, 0.35)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.35)',
    borderRadius: 16,
    padding: 14,
    marginTop: 18,
  },
  errorText: {
    color: '#fecaca',
    textAlign: 'center',
    lineHeight: 20,
  },
  bottomNote: {
    marginTop: 18,
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 13,
  },
  footerGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
    bottom: -80,
    left: -60,
  },
  footerGlowSecondary: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    top: 90,
    right: -50,
  },
});
