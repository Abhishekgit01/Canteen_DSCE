import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SplashScreen from './screens/SplashScreen';
import AuthScreen from './screens/AuthScreen';
import OtpScreen from './screens/OtpScreen';
import HomeScreen from './screens/HomeScreen';
import SearchScreen from './screens/SearchScreen';
import ItemDetailScreen from './screens/ItemDetailScreen';
import CartScreen from './screens/CartScreen';
import PaymentScreen from './screens/PaymentScreen';
import OrderQRScreen from './screens/OrderQRScreen';
import OrderSuccessScreen from './screens/OrderSuccessScreen';
import OrdersScreen from './screens/OrdersScreen';
import ProfileScreen from './screens/ProfileScreen';
import ScannerScreen from './screens/ScannerScreen';
import { connectSocket, disconnectSocket } from './api/socket';
import { useAuthStore } from './stores/authStore';
import { useCartStore } from './stores/cartStore';
import { MainTabParamList, RootStackParamList } from './types';
import { palette, shadows } from './theme';
import AppIcon from './components/AppIcon';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function TabIcon({ name, focused }: { name: keyof MainTabParamList; focused: boolean }) {
  const colors = {
    active: palette.accent,
    inactive: '#A3A3A3',
  };

  const iconProps = {
    size: 20,
    color: focused ? colors.active : colors.inactive,
  };

  const icons: Record<keyof MainTabParamList, React.ReactNode> = {
    Home: <AppIcon name="home" {...iconProps} />,
    Cart: <AppIcon name="shopping-bag" {...iconProps} />,
    Orders: <AppIcon name="receipt-text-outline" {...iconProps} />,
    Profile: <AppIcon name="user" {...iconProps} />,
    Scanner: <AppIcon name="camera" {...iconProps} />,
  };

  return (
    <View style={styles.tabItem}>
      {focused ? <View style={styles.tabIndicator} /> : <View style={styles.tabIndicatorSpacer} />}
      <View style={[styles.tabIconWrap, focused && styles.tabIconActive]}>
        {icons[name]}
      </View>
    </View>
  );
}

function MainTabs() {
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const labels: Record<keyof MainTabParamList, string> = {
    Home: 'Home',
    Cart: 'Cart',
    Orders: 'Orders',
    Profile: 'Profile',
    Scanner: 'Scan',
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        tabBarLabel: labels[route.name],
        tabBarActiveTintColor: palette.accent,
        tabBarInactiveTintColor: '#8A94A6',
        tabBarStyle: [styles.tabBar, { height: 76 + insets.bottom, paddingBottom: 8 + insets.bottom }],
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarItemStyle: styles.tabBarItem,
        headerShown: false,
        tabBarHideOnKeyboard: true,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Cart" component={CartScreen} />
      <Tab.Screen name="Orders" component={OrdersScreen} />
      {user?.role === 'staff' && <Tab.Screen name="Scanner" component={ScannerScreen} />}
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function Navigation() {
  const { loadAuth, token, user, isLoading } = useAuthStore();
  const { loadCart } = useCartStore();

  useEffect(() => {
    const initializeApp = async () => {
      await loadAuth();
      await loadCart();
    };

    void initializeApp();
  }, [loadAuth, loadCart]);

  useEffect(() => {
    if (token && user) {
      connectSocket(token);
      return undefined;
    }

    disconnectSocket();
    return undefined;
  }, [token, user]);

  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {token && user ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="Search" component={SearchScreen} />
            <Stack.Screen name="ItemDetail" component={ItemDetailScreen} />
            <Stack.Screen name="Payment" component={PaymentScreen} />
            <Stack.Screen name="OrderQR" component={OrderQRScreen} />
            <Stack.Screen name="OrderSuccess" component={OrderSuccessScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Auth" component={AuthScreen} />
            <Stack.Screen name="Otp" component={OtpScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderTopWidth: 0,
    paddingTop: 6,
    ...shadows.floating,
  },
  tabBarItem: {
    paddingTop: 4,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabIndicator: {
    width: 22,
    height: 3,
    borderRadius: 999,
    backgroundColor: palette.accent,
  },
  tabIndicatorSpacer: {
    width: 22,
    height: 3,
  },
  tabIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconActive: {
    backgroundColor: 'rgba(245,130,31,0.12)',
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.1,
    marginBottom: 2,
  },
});
