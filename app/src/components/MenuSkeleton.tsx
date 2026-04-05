import React from 'react';
import { StyleSheet, View } from 'react-native';
import MenuItemSkeleton from './MenuItemSkeleton';

type MenuSkeletonProps = {
  count?: number;
};

export default function MenuSkeleton({ count = 5 }: MenuSkeletonProps) {
  return (
    <View style={styles.wrap}>
      <MenuItemSkeleton count={count} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 6,
  },
});
