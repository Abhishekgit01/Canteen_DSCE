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
  usn: string;
  email: string;
  name: string;
  role: 'student' | 'staff' | 'manager' | 'admin';
  isVerified: boolean;
}

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
    quantity: number;
    tempPreference: string;
  }[];
  scheduledTime: string;
  totalAmount: number;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  status: 'pending_payment' | 'paid' | 'preparing' | 'ready' | 'fulfilled';
  qrToken?: string;
  createdAt: string;
}

export type MainTabParamList = {
  Home: undefined;
  Cart: undefined;
  Orders: undefined;
  Profile: undefined;
  Scanner: undefined;
};

export type RootStackParamList = {
  Splash: undefined;
  Auth: undefined;
  Otp: { email: string };
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  ItemDetail: { item: MenuItem };
  Payment: { amount: number };
  OrderQR: { orderId: string; qrToken: string };
  OrderSuccess: { orderId: string };
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
