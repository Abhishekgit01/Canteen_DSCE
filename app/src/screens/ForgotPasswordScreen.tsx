import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { RootStackScreenProps } from '../types';
import { API_CONFIG_ERROR, authApi } from '../api';
import LoadingOverlay from '../components/LoadingOverlay';
import { CAT_MESSAGES } from '../constants/loading';
import { palette, shadows } from '../theme';

export default function ForgotPasswordScreen({
  route,
  navigation,
}: RootStackScreenProps<'ForgotPassword'>) {
  const [email, setEmail] = useState(route.params?.prefilledEmail ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (route.params?.prefilledEmail) {
      setEmail(route.params.prefilledEmail);
    }
  }, [route.params?.prefilledEmail]);

  const handleSendOtp = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError('Please enter your email address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await authApi.requestPasswordResetOtp({ email: normalizedEmail });
      navigation.navigate('Otp', {
        email: normalizedEmail,
        purpose: response.data.purpose || 'password_reset',
      });
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          err.userMessage ||
          API_CONFIG_ERROR ||
          'Could not send the password reset OTP',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar style="dark" />
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Password Help</Text>
        <Text style={styles.title}>Forgot your password?</Text>
        <Text style={styles.subtitle}>
          Enter the email linked to your canteen account. We’ll send a 6-digit OTP so you can set a new password safely.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#8892a4"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          activeOpacity={0.92}
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSendOtp}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? 'Sending OTP...' : 'Send OTP'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.linkWrap}
          onPress={() =>
            navigation.replace('Auth', {
              initialMode: 'login',
              prefilledEmail: email.trim().toLowerCase(),
            })
          }
        >
          <Text style={styles.link}>Back to login</Text>
        </TouchableOpacity>
      </View>
      <LoadingOverlay visible={loading} message={CAT_MESSAGES.otp} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
    padding: 24,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: 28,
    padding: 24,
    gap: 14,
    ...shadows.card,
  },
  eyebrow: {
    color: palette.brand,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: palette.ink,
    fontSize: 28,
    fontWeight: '900',
  },
  subtitle: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 6,
  },
  input: {
    backgroundColor: palette.surfaceMuted,
    borderRadius: 18,
    padding: 16,
    color: palette.ink,
    fontSize: 16,
  },
  error: {
    color: palette.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  button: {
    backgroundColor: palette.accent,
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
    marginTop: 6,
    ...shadows.floating,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    color: palette.surface,
    fontSize: 16,
    fontWeight: '900',
  },
  linkWrap: {
    alignItems: 'center',
    paddingTop: 4,
  },
  link: {
    color: palette.brand,
    fontSize: 14,
    fontWeight: '800',
  },
});
