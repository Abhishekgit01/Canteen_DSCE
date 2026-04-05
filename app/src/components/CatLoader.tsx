import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { palette } from '../theme';

type CatLoaderProps = {
  message?: string;
  size?: 'small' | 'large';
  variant?: 'default' | 'inverse';
};

type DotProps = {
  delay: number;
  dotSize: number;
  color: string;
};

const TIMED_MESSAGES = [
  { after: 0, message: 'Loading...' },
  { after: 2000, message: 'Meow! Waking up the server... 🐱' },
  { after: 5000, message: 'The cat is on it, hang tight! 🐾' },
  { after: 8000, message: 'Almost there, promise! ☕' },
  { after: 12000, message: 'Server was napping... nearly ready! 😴' },
  { after: 18000, message: 'Worth the wait, we promise 🍱' },
] as const;

const SIZE_CONFIG = {
  small: {
    face: 40,
    ear: 9,
    eye: 6,
    tailHeight: 18,
    tailWidth: 4,
    paw: 14,
    nose: 10,
    dot: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    messageSize: 12,
    messageMargin: 8,
  },
  large: {
    face: 78,
    ear: 16,
    eye: 10,
    tailHeight: 32,
    tailWidth: 6,
    paw: 24,
    nose: 15,
    dot: 8,
    paddingVertical: 18,
    paddingHorizontal: 18,
    messageSize: 14,
    messageMargin: 12,
  },
} as const;

function LoadingDot({ delay, dotSize, color }: DotProps) {
  const bounce = useSharedValue(0);

  useEffect(() => {
    bounce.value = withDelay(
      delay,
      withRepeat(
        withSequence(withTiming(-6, { duration: 280 }), withTiming(0, { duration: 280 })),
        -1,
        false,
      ),
    );
  }, [bounce, delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bounce.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.dot,
        animatedStyle,
        { width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: color },
      ]}
    />
  );
}

export default function CatLoader({
  message,
  size = 'large',
  variant = 'default',
}: CatLoaderProps) {
  const [timedMessage, setTimedMessage] = useState(message ?? TIMED_MESSAGES[0].message);
  const config = SIZE_CONFIG[size];
  const tailRotation = useSharedValue(0);
  const bodyBob = useSharedValue(0);
  const blink = useSharedValue(1);
  const pawWave = useSharedValue(0);

  useEffect(() => {
    tailRotation.value = withRepeat(
      withSequence(
        withTiming(18, { duration: 420, easing: Easing.inOut(Easing.ease) }),
        withTiming(-18, { duration: 420, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );

    bodyBob.value = withRepeat(
      withSequence(withTiming(-4, { duration: 700 }), withTiming(0, { duration: 700 })),
      -1,
      true,
    );

    blink.value = withRepeat(
      withSequence(
        withDelay(2200, withTiming(0.18, { duration: 80 })),
        withTiming(1, { duration: 80 }),
      ),
      -1,
      false,
    );

    pawWave.value = withRepeat(
      withSequence(withTiming(-10, { duration: 360 }), withTiming(10, { duration: 360 })),
      -1,
      true,
    );
  }, [blink, bodyBob, pawWave, tailRotation]);

  useEffect(() => {
    setTimedMessage(message ?? TIMED_MESSAGES[0].message);

    if (message) {
      return;
    }

    const timers = TIMED_MESSAGES.slice(1).map(({ after, message: nextMessage }) =>
      setTimeout(() => setTimedMessage(nextMessage), after),
    );

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [message]);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bodyBob.value }],
  }));

  const tailStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${tailRotation.value}deg` }],
  }));

  const eyeStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: blink.value }],
  }));

  const pawStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${pawWave.value}deg` }],
  }));

  const messageColor = variant === 'inverse' ? '#DCE3F5' : palette.muted;
  const dotColor = variant === 'inverse' ? '#FBD38D' : palette.accent;

  return (
    <View
      style={[
        styles.container,
        {
          paddingVertical: config.paddingVertical,
          paddingHorizontal: config.paddingHorizontal,
        },
      ]}
    >
      <Animated.View style={[styles.catWrap, bodyStyle, { marginBottom: size === 'small' ? 2 : 8 }]}>
        <View
          style={[
            styles.face,
            {
              width: config.face,
              height: config.face,
              borderRadius: config.face / 2,
            },
          ]}
        >
          <View style={[styles.earsRow, { top: -config.ear + 2 }]}>
            <View
              style={[
                styles.ear,
                {
                  borderLeftWidth: config.ear,
                  borderRightWidth: config.ear,
                  borderBottomWidth: config.ear * 1.5,
                },
              ]}
            />
            <View
              style={[
                styles.ear,
                {
                  borderLeftWidth: config.ear,
                  borderRightWidth: config.ear,
                  borderBottomWidth: config.ear * 1.5,
                },
              ]}
            />
          </View>

          <Animated.View style={[styles.eyesRow, eyeStyle]}>
            <View
              style={[
                styles.eye,
                {
                  width: config.eye,
                  height: config.eye,
                  borderRadius: config.eye / 2,
                },
              ]}
            />
            <View
              style={[
                styles.eye,
                {
                  width: config.eye,
                  height: config.eye,
                  borderRadius: config.eye / 2,
                },
              ]}
            />
          </Animated.View>

          <Text style={[styles.nose, { fontSize: config.nose }]}>•ㅅ•</Text>
        </View>

        <Animated.Text style={[styles.paw, pawStyle, { fontSize: config.paw }]}>🐾</Animated.Text>
        <Animated.View
          style={[
            styles.tail,
            tailStyle,
            {
              width: config.tailWidth,
              height: config.tailHeight,
              borderRadius: config.tailWidth / 2,
              right: -config.tailWidth,
              bottom: config.face * 0.2,
            },
          ]}
        />
      </Animated.View>

      <View style={styles.dotsRow}>
        {[0, 1, 2].map((index) => (
          <LoadingDot
            key={index}
            delay={index * 160}
            dotSize={config.dot}
            color={dotColor}
          />
        ))}
      </View>

      {timedMessage ? (
        <Text
          style={[
            styles.message,
            {
              marginTop: config.messageMargin,
              fontSize: config.messageSize,
              color: messageColor,
            },
          ]}
        >
          {timedMessage}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  catWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  face: {
    backgroundColor: '#F5B14C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  earsRow: {
    position: 'absolute',
    flexDirection: 'row',
    gap: 22,
  },
  ear: {
    width: 0,
    height: 0,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#F5B14C',
  },
  eyesRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 4,
  },
  eye: {
    backgroundColor: '#222222',
  },
  nose: {
    color: '#222222',
    fontWeight: '700',
  },
  paw: {
    position: 'absolute',
    left: -18,
    bottom: -4,
  },
  tail: {
    position: 'absolute',
    backgroundColor: '#F5B14C',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    opacity: 0.95,
  },
  message: {
    textAlign: 'center',
    maxWidth: 240,
    fontWeight: '600',
    lineHeight: 20,
  },
});
