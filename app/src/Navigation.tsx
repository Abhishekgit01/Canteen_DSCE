import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet } from 'react-native';

import SplashScreen from './screens/SplashScreen';
import AuthScreen from './screens/AuthScreen';
import OtpScreen from './screens/OtpScreen';
import HomeScreen from './screens/HomeScreen';
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

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function TabIcon({ name, focused }: { name: keyof MainTabParamList; focused: boolean }) {
  const icons: Record<keyof MainTabParamList, string> = {
    Home: '🏠',
    Cart: '🛒',
    Orders: '📋',
    Profile: '👤',
    Scanner: '📷',
  };

  return (
    <View style={[styles.tabIcon, focused && styles.tabIconActive]}>
      <Text style={styles.tabIconText}>{icons[name]}</Text>
    </View>
  );
}

function MainTabs() {
  const { user } = useAuthStore();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: true,
        tabBarLabelStyle: styles.tabLabel,
        tabBarActiveTintColor: '#f97316',
        tabBarInactiveTintColor: '#8892a4',
        headerShown: false,
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
    backgroundColor: '#141929',
    borderTopWidth: 0,
    paddingBottom: 8,
    paddingTop: 8,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  tabIcon: {
    padding: 4,
  },
  tabIconActive: {
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
    borderRadius: 8,
  },
  tabIconText: {
    fontSize: 20,
  },
});
