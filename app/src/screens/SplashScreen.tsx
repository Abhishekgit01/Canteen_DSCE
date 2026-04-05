import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import CatLoader from '../components/CatLoader';

export default function SplashScreen() {
  return (
    <View style={styles.container}>
      <Image source={require('../../assets/splash-icon.png')} style={styles.logo} resizeMode="contain" />
      <CatLoader size="small" variant="inverse" message="Warming up the canteen..." />
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
    width: 180,
    height: 180,
  },
});
