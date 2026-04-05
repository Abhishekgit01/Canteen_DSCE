import React from 'react';
import { StyleSheet, View } from 'react-native';
import CatLoader from './CatLoader';

type LoadingOverlayProps = {
  visible: boolean;
  message?: string;
  variant?: 'default' | 'inverse';
};

export default function LoadingOverlay({
  visible,
  message,
  variant = 'default',
}: LoadingOverlayProps) {
  if (!visible) {
    return null;
  }

  return (
    <View style={styles.overlay}>
      <CatLoader message={message} variant={variant} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
});
