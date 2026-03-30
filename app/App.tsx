import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import Navigation from './src/Navigation';

export default function App() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Navigation />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1e',
  },
});
