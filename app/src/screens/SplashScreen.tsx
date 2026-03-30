import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

export default function SplashScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>DSCE</Text>
      <Text style={styles.title}>Canteen</Text>
      <ActivityIndicator color="#f97316" style={styles.loader} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    fontSize: 48,
    fontWeight: '800',
    color: '#f97316',
    letterSpacing: -2,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 8,
  },
  loader: {
    marginTop: 32,
  },
});
