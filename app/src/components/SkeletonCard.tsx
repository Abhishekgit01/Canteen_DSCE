import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { palette, shadows } from '../theme';

export default function SkeletonCard() {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.8,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [opacity]);

  return (
    <Animated.View style={[styles.card, { opacity }]}>
      <View style={styles.imagePlaceholder} />
      <View style={styles.content}>
        <View style={styles.titlePlaceholder} />
        <View style={styles.descPlaceholder} />
        <View style={styles.footer}>
          <View style={styles.pricePlaceholder} />
          <View style={styles.buttonPlaceholder} />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    ...shadows.card,
  },
  imagePlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 20,
    backgroundColor: palette.surfaceMuted,
  },
  content: {
    flex: 1,
    gap: 8,
    paddingVertical: 4,
  },
  titlePlaceholder: {
    height: 18,
    width: '70%',
    backgroundColor: palette.surfaceMuted,
    borderRadius: 6,
  },
  descPlaceholder: {
    height: 14,
    width: '90%',
    backgroundColor: palette.surfaceMuted,
    borderRadius: 4,
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  pricePlaceholder: {
    height: 18,
    width: 60,
    backgroundColor: palette.surfaceMuted,
    borderRadius: 6,
  },
  buttonPlaceholder: {
    height: 32,
    width: 32,
    backgroundColor: palette.surfaceMuted,
    borderRadius: 16,
  },
});
