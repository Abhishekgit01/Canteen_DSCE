import type {
  CompositeNavigationProp,
  CompositeScreenProps,
  NavigatorScreenParams,
  RouteProp,
} from '@react-navigation/native';
import type { BottomTabNavigationProp, BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';

export interface User {
  id: string;
  usn?: string | null;
  email: string;
  name: string;
  college?: College;
  role: 'student' | 'staff' | 'manager' | 'admin';
  isVerified: boolean;
  picture?: string | null;
}

export type College = 'DSCE' | 'NIE';
export type OtpPurpose = 'signup' | 'password_reset';

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  price: number;
  calories: number;
  category: 'meals' | 'snacks' | 'beverages' | 'desserts';
  tempOptions: ('cold' | 'normal' | 'hot')[];
  isAvailable: boolean;
  isFeatured?: boolean;
}

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  tempPreference: string;
  scheduledTime: string;
}

export interface Order {
  id: string;
  userId: string;
  items: {
    menuItemId: string;
    name: string;
    price?: number;
    quantity: number;
    tempPreference: string;
  }[];
  scheduledTime: string;
  totalAmount: number;
  paymentMethod?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  upiTransactionId?: string;
  status: 'pending_payment' | 'paid' | 'preparing' | 'ready' | 'fulfilled' | 'failed';
  qrToken?: string;
  createdAt: string;
}

export type PaymentMode = 'mock' | 'upi_link' | 'razorpay';

type PaymentInitBase = {
  mode: PaymentMode;
  orderId: string;
  amount: number;
};

export type RazorpayOrderDetails = {
  key_id: string;
  razorpay_order_id: string;
  amount: number;
  currency: string;
};

export type MockPaymentInitResponse = PaymentInitBase & {
  mode: 'mock';
  transactionId: string;
};

export type UpiLinkPaymentInitResponse = PaymentInitBase & {
  mode: 'upi_link';
  upiUri: string;
  canteenUpiId: string;
  canteenName?: string;
};

export type RazorpayPaymentInitResponse = PaymentInitBase & {
  mode: 'razorpay';
  order: Order;
  razorpay: RazorpayOrderDetails;
};

export type PaymentInitResponse =
  | MockPaymentInitResponse
  | UpiLinkPaymentInitResponse
  | RazorpayPaymentInitResponse;

export type MainTabParamList = {
  Home: undefined;
  Cart: undefined;
  Orders: undefined;
  Profile: undefined;
  Scanner: undefined;
};

export type RootStackParamList = {
  Splash: undefined;
  Welcome: undefined;
  Auth:
    | {
        selectedCollege?: College;
        initialMode?: 'login' | 'signup';
        prefilledEmail?: string;
      }
    | undefined;
  Otp: { email: string; purpose: OtpPurpose };
  ForgotPassword: { prefilledEmail?: string } | undefined;
  GoogleCollegeSelect: {
    idToken?: string;
    accessToken?: string;
    email: string;
    name: string;
    picture?: string | null;
    selectedCollege?: College;
  };
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  Search: undefined;
  ItemDetail: { item: MenuItem };
  Payment: PaymentInitResponse;
  OrderQR: { orderId: string; qrToken: string };
  OrderSuccess: { orderId: string };
  PaymentSuccess: {
    orderId: string;
    qrToken: string;
    amount: number;
    items: {
      name: string;
      quantity: number;
      price: number;
    }[];
    studentName: string;
    college: string;
    paidAt: string;
  };
};

export type RootStackNavigationProp<
  Screen extends keyof RootStackParamList = keyof RootStackParamList,
> = NativeStackNavigationProp<RootStackParamList, Screen>;

export type RootStackRouteProp<Screen extends keyof RootStackParamList> = RouteProp<
  RootStackParamList,
  Screen
>;

export type RootStackScreenProps<Screen extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  Screen
>;

export type MainTabNavigationProp<Screen extends keyof MainTabParamList> = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, Screen>,
  NativeStackNavigationProp<RootStackParamList>
>;

export type MainTabScreenProps<Screen extends keyof MainTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, Screen>,
  NativeStackScreenProps<RootStackParamList>
>;
