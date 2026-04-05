import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { palette, shadows } from '../theme';

type MenuItemSkeletonProps = {
  count?: number;
};

function SkeletonCard({ animatedStyle }: { animatedStyle: ReturnType<typeof useAnimatedStyle> }) {
  return (
    <View style={styles.card}>
      <View style={styles.imagePlaceholder} />
      <View style={styles.copyWrap}>
        <View style={[styles.line, styles.titleLine]} />
        <View style={[styles.line, styles.bodyLine]} />
        <View style={[styles.line, styles.metaLine]} />
      </View>
      <View style={styles.priceWrap}>
        <View style={[styles.line, styles.priceLine]} />
      </View>
      <Animated.View style={[styles.shimmer, animatedStyle]} />
    </View>
  );
}

export default function MenuItemSkeleton({ count = 4 }: MenuItemSkeletonProps) {
  const shimmerX = useSharedValue(-220);

  useEffect(() => {
    shimmerX.value = withRepeat(withTiming(320, { duration: 1100 }), -1, false);
  }, [shimmerX]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value }],
    opacity: interpolate(shimmerX.value, [-220, 40, 320], [0.18, 0.42, 0.18]),
  }));

  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} animatedStyle={animatedStyle} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 14,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: 22,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    overflow: 'hidden',
    ...shadows.card,
  },
  imagePlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: '#ECEFF5',
  },
  copyWrap: {
    flex: 1,
    gap: 8,
  },
  line: {
    backgroundColor: '#ECEFF5',
    borderRadius: 999,
  },
  titleLine: {
    width: '62%',
    height: 16,
  },
  bodyLine: {
    width: '78%',
    height: 12,
  },
  metaLine: {
    width: '42%',
    height: 12,
  },
  priceWrap: {
    alignItems: 'flex-end',
  },
  priceLine: {
    width: 40,
    height: 18,
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 120,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
});
