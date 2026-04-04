import React, { useEffect, useRef, useState } from 'react';
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
import { authApi } from '../api';
import { useAuthStore } from '../stores/authStore';
import type { RootStackScreenProps } from '../types';
import { palette, shadows } from '../theme';

export default function OtpScreen({ route, navigation }: RootStackScreenProps<'Otp'>) {
  const { email, purpose } = route.params;
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timer, setTimer] = useState(60);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const inputs = useRef<TextInput[]>([]);

  const { setAuth } = useAuthStore();
  const isPasswordReset = purpose === 'password_reset';

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((t) => (t > 0 ? t - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleChange = (text: string, index: number) => {
    if (text.length > 1) return;

    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);

    if (text && index < 5) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const fullCode = code.join('');

    if (fullCode.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }

    if (isPasswordReset) {
      if (!newPassword) {
        setError('Enter a new password');
        return;
      }

      if (newPassword.length < 6) {
        setError('Password must be at least 6 characters long');
        return;
      }

      if (newPassword !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
    }

    setLoading(true);
    setError('');

    try {
      const response = isPasswordReset
        ? await authApi.resetPasswordWithOtp({
            email,
            code: fullCode,
            password: newPassword,
          })
        : await authApi.verifyOtp({ email, code: fullCode });

      const { user, token } = response.data;
      await setAuth(user, token);
      navigation.replace('Main');
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          (isPasswordReset ? 'Could not reset your password' : 'Invalid OTP'),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (timer > 0) return;

    setError('');

    try {
      if (isPasswordReset) {
        await authApi.requestPasswordResetOtp({ email });
      } else {
        await authApi.resendOtp({ email });
      }

      setTimer(60);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to resend OTP');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar style="dark" />
      <View style={styles.content}>
        <Text style={styles.eyebrow}>{isPasswordReset ? 'Password Reset' : 'Email Verification'}</Text>
        <Text style={styles.title}>{isPasswordReset ? 'Set a new password' : 'Enter your OTP'}</Text>
        <Text style={styles.subtitle}>
          {isPasswordReset
            ? `Enter the 6-digit code sent to ${email}, then choose a new password for your canteen account.`
            : `Enter the 6-digit code sent to ${email} to finish setting up your account.`}
        </Text>

        <View style={styles.codeContainer}>
          {code.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => {
                if (ref) inputs.current[index] = ref;
              }}
              style={styles.codeInput}
              maxLength={1}
              keyboardType="number-pad"
              value={digit}
              onChangeText={(text) => handleChange(text, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              selectTextOnFocus
            />
          ))}
        </View>

        {isPasswordReset ? (
          <View style={styles.passwordGroup}>
            <TextInput
              style={styles.input}
              placeholder="New Password"
              placeholderTextColor="#8892a4"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />
            <TextInput
              style={styles.input}
              placeholder="Confirm New Password"
              placeholderTextColor="#8892a4"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleVerify}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading
              ? isPasswordReset
                ? 'Resetting...'
                : 'Verifying...'
              : isPasswordReset
                ? 'Reset Password'
                : 'Verify OTP'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleResend} disabled={timer > 0}>
          <Text style={[styles.resend, timer > 0 && styles.resendDisabled]}>
            {timer > 0 ? `Resend in ${timer}s` : 'Resend OTP'}
          </Text>
        </TouchableOpacity>

        {isPasswordReset ? (
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.backLinkWrap}
            onPress={() =>
              navigation.replace('Auth', {
                initialMode: 'login',
                prefilledEmail: email,
              })
            }
          >
            <Text style={styles.backLink}>Back to login</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  eyebrow: {
    color: palette.brand,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    color: palette.ink,
    textAlign: 'center',
    marginTop: 10,
  },
  subtitle: {
    fontSize: 14,
    color: palette.muted,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 28,
    lineHeight: 21,
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  codeInput: {
    width: 48,
    height: 56,
    backgroundColor: palette.surface,
    borderRadius: 16,
    textAlign: 'center',
    color: palette.ink,
    fontSize: 24,
    fontWeight: '800',
    ...shadows.card,
  },
  passwordGroup: {
    gap: 12,
    marginBottom: 8,
  },
  input: {
    backgroundColor: palette.surface,
    borderRadius: 18,
    padding: 16,
    color: palette.ink,
    fontSize: 16,
    ...shadows.card,
  },
  button: {
    backgroundColor: palette.accent,
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
    ...shadows.floating,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: palette.surface,
    fontWeight: '800',
    fontSize: 16,
  },
  error: {
    color: palette.danger,
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '700',
  },
  resend: {
    color: palette.brand,
    textAlign: 'center',
    marginTop: 24,
    fontWeight: '700',
  },
  resendDisabled: {
    color: palette.muted,
  },
  backLinkWrap: {
    alignItems: 'center',
    marginTop: 14,
  },
  backLink: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '700',
  },
});
