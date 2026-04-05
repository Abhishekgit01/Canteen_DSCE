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
  college?: College;
  category: 'meals' | 'snacks' | 'beverages' | 'desserts';
  tempOptions: ('cold' | 'normal' | 'hot')[];
  isAvailable: boolean;
  isFeatured?: boolean;
  averageRating: number;
  totalReviews: number;
  ratingBreakdown: {
    '1': number;
    '2': number;
    '3': number;
    '4': number;
    '5': number;
  };
}

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  tempPreference: string;
  scheduledTime: string;
  chefNote: string;
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
    chefNote?: string;
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

export interface Review {
  id: string;
  menuItemId: string;
  orderId: string;
  menuItem?: {
    id: string;
    name: string;
  };
  student?: {
    id: string;
    name: string;
    college?: College;
    email?: string;
  };
  college?: College;
  rating: number;
  title: string;
  body: string;
  tags: string[];
  helpful: number;
  isVerified: boolean;
  isVisible: boolean;
  createdAt: string;
}

export interface PendingReviewItem {
  orderId: string;
  orderDate: string;
  menuItem: {
    id: string;
    name: string;
    imageUrl: string;
    averageRating: number;
    totalReviews: number;
  };
}

export type PaymentMode = 'mock' | 'upi_link' | 'razorpay';

export interface RushHourRule {
  _id: string;
  college: College;
  dayOfWeek: number[];
  startTime: string;
  endTime: string;
  label: string;
  surchargePercent: number;
  isActive: boolean;
  message: string;
}

export interface RushHourStatus {
  isRushHour: boolean;
  current: RushHourRule | null;
  all: RushHourRule[];
}

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
  PrivacyPolicy: undefined;
  TermsOfService: undefined;
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
  ItemReviews: { menuItemId: string; menuItemName?: string };
  RateOrder: { orderId?: string } | undefined;
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
