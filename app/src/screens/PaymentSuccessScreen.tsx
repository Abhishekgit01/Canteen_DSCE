import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withDelay,
  Easing,
  useAnimatedStyle,
  FadeIn,
  FadeInUp,
  SlideInDown,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import QRCode from 'react-native-qrcode-svg';
import { getCollegeFullName } from '../constants/colleges';
import type { RootStackNavigationProp, RootStackRouteProp } from '../types';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

export default function PaymentSuccessScreen() {
  const navigation = useNavigation<RootStackNavigationProp<'PaymentSuccess'>>();
  const route = useRoute<RootStackRouteProp<'PaymentSuccess'>>();
  const insets = useSafeAreaInsets();
  
  const params = route.params;

  const circleProgress = useSharedValue(0);
  const checkProgress = useSharedValue(0);

  const formatEstimatedPickup = (value?: string) => {
    if (!value) {
      return '';
    }

    return new Date(value).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  useEffect(() => {
    // Sequence:
    // 0-600ms: draw circle
    circleProgress.value = withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) });
    // 400-700ms: draw checkmark (starts at 400ms, takes 300ms)
    checkProgress.value = withDelay(400, withTiming(1, { duration: 300, easing: Easing.inOut(Easing.ease) }));
  }, []);

  const circleProps = useAnimatedProps(() => {
    const circumference = 2 * Math.PI * 45;
    return {
      strokeDashoffset: circumference * (1 - circleProgress.value),
    };
  });

  const checkProps = useAnimatedProps(() => {
    const pathLength = 50; 
    return {
      strokeDashoffset: pathLength * (1 - checkProgress.value),
    };
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.content}>
        {/* Animated Checkmark */}
        <View style={styles.iconContainer}>
          <Svg width={100} height={100} viewBox="0 0 100 100">
            <AnimatedCircle
              cx="50"
              cy="50"
              r="45"
              stroke="#00C853"
              strokeWidth="5"
              fill="transparent"
              strokeDasharray={2 * Math.PI * 45}
              animatedProps={circleProps}
              strokeLinecap="round"
              transform="rotate(-90 50 50)"
            />
            <AnimatedPath
              d="M30 50 L45 65 L70 35"
              stroke="#00C853"
              strokeWidth="6"
              fill="transparent"
              strokeDasharray={50}
              animatedProps={checkProps}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>

        {/* Success Text */}
        <Animated.View entering={FadeInUp.delay(700).duration(200)} style={styles.textContainer}>
          <Text style={styles.title}>Payment Successful</Text>
        </Animated.View>

        {/* Amount */}
        <Animated.View entering={FadeIn.delay(900).duration(200)} style={styles.amountContainer}>
          <Text style={styles.amount}>₹{params.amount.toFixed(2).replace(/\.00$/, '')}</Text>
        </Animated.View>

        {/* Order Card */}
        <Animated.View entering={SlideInDown.delay(1100).duration(300)} style={styles.card}>
          <Text style={styles.cardHeader}>Order #{params.orderId.slice(-6).toUpperCase()}</Text>
          <View style={styles.divider} />
          
          <View style={styles.row}>
            <Text style={styles.studentName}>{params.studentName}</Text>
            <Text style={styles.collegeText}>{getCollegeFullName(params.college)}</Text>
          </View>
          <View style={styles.divider} />
          
          <View style={styles.itemsContainer}>
            {params.items.map((item: { name: string, quantity: number, price: number }, index: number) => (
              <View key={index} style={styles.itemRow}>
                <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.itemQty}>× {item.quantity}</Text>
                <Text style={styles.itemPrice}>₹{item.price * item.quantity}</Text>
              </View>
            ))}
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>₹{params.amount}</Text>
          </View>
          
          <View style={styles.footerRow}>
            <Text style={styles.footerLabel}>Paid via</Text>
            <Text style={styles.footerValue}>Razorpay</Text>
          </View>
          <View style={styles.footerRow}>
            <Text style={styles.footerLabel}>Time</Text>
            <Text style={styles.footerValue}>
              {new Date(params.paidAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>

          {params.estimatedPickupMinutes ? (
            <>
              <View style={styles.divider} />
              <View style={styles.pickupRow}>
                <View>
                  <Text style={styles.pickupLabel}>Ready for pickup in</Text>
                  <Text style={styles.pickupValue}>~{params.estimatedPickupMinutes} minutes</Text>
                  {params.estimatedPickupAt ? (
                    <Text style={styles.pickupAt}>
                      Around {formatEstimatedPickup(params.estimatedPickupAt)}
                    </Text>
                  ) : null}
                </View>
              </View>
            </>
          ) : null}
        </Animated.View>

        {/* QR Code */}
        <Animated.View entering={FadeIn.delay(1400).duration(200)} style={styles.qrContainer}>
          <View style={styles.qrWrapper}>
            <QRCode value={params.qrToken} size={140} />
          </View>
          <Text style={styles.qrHelper}>Show this QR code at the counter</Text>
        </Animated.View>

        <View style={{ flex: 1 }} />

        {/* View Orders Button */}
        <Animated.View entering={FadeInUp.delay(1600).duration(200)} style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.button}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Main', { screen: 'Orders' })}
          >
            <Text style={styles.buttonText}>View Orders</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1e', // Dark theme matching the app
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
    paddingTop: 40,
  },
  iconContainer: {
    width: 100,
    height: 100,
    marginBottom: 24,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  amountContainer: {
    marginBottom: 32,
  },
  amount: {
    fontSize: 42,
    fontWeight: '800',
    color: '#00C853',
  },
  card: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    width: '100%',
    padding: 20,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  cardHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  collegeText: {
    fontSize: 14,
    color: '#8f9bb3',
  },
  itemsContainer: {
    gap: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemName: {
    flex: 1,
    fontSize: 14,
    color: '#ffffff',
  },
  itemQty: {
    width: 40,
    fontSize: 14,
    color: '#8f9bb3',
    textAlign: 'center',
  },
  itemPrice: {
    width: 60,
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'right',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#00C853',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  footerLabel: {
    fontSize: 13,
    color: '#8f9bb3',
  },
  footerValue: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '500',
  },
  pickupRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickupLabel: {
    fontSize: 13,
    color: '#8f9bb3',
  },
  pickupValue: {
    marginTop: 4,
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
  },
  pickupAt: {
    marginTop: 4,
    fontSize: 13,
    color: '#00C853',
    fontWeight: '600',
  },
  qrContainer: {
    alignItems: 'center',
  },
  qrWrapper: {
    padding: 12,
    backgroundColor: '#ffffff',
    borderRadius: 12,
  },
  qrHelper: {
    marginTop: 12,
    fontSize: 14,
    color: '#8f9bb3',
  },
  buttonContainer: {
    width: '100%',
    paddingBottom: 20,
  },
  button: {
    backgroundColor: '#f97316',
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
