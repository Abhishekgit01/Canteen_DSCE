import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { useCartStore } from '../stores/cartStore';
import { disconnectSocket } from '../api/socket';

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();
  const { clearCart } = useCartStore();

  const handleLogout = async () => {
    await logout();
    await clearCart();
    disconnectSocket();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Name</Text>
        <Text style={styles.value}>{user?.name}</Text>

        <Text style={styles.label}>USN</Text>
        <Text style={styles.value}>{user?.usn}</Text>

        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{user?.email}</Text>

        <Text style={styles.label}>Role</Text>
        <Text style={[styles.value, styles.roleValue]}>{user?.role}</Text>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1e',
  },
  header: {
    padding: 16,
    paddingTop: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  card: {
    backgroundColor: '#141929',
    borderRadius: 12,
    padding: 20,
    margin: 16,
    gap: 12,
  },
  label: {
    color: '#8892a4',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  value: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  roleValue: {
    color: '#f97316',
    textTransform: 'capitalize',
  },
  logoutButton: {
    backgroundColor: '#ef4444',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  logoutText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
});
