import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
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
import LoadingOverlay from '../components/LoadingOverlay';
import { CAT_MESSAGES } from '../constants/loading';
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
  const shake = useRef(new Animated.Value(0)).current;

  const { setAuth } = useAuthStore();
  const isPasswordReset = purpose === 'password_reset';

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((t) => (t > 0 ? t - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const clearCodeInputs = () => {
    setCode(['', '', '', '', '', '']);
    inputs.current[0]?.focus();
  };

  const triggerOtpFailure = (message: string) => {
    setError(message);
    clearCodeInputs();
    Animated.sequence([
      Animated.timing(shake, { toValue: 12, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -12, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const maybeAutoSubmit = (digits: string[]) => {
    if (isPasswordReset || loading) {
      return;
    }

    if (digits.join('').length === 6) {
      setTimeout(() => {
        void handleVerify(digits.join(''));
      }, 0);
    }
  };

  const handleChange = (text: string, index: number) => {
    const digits = text.replace(/\D/g, '');
    const nextCode = [...code];

    if (!digits) {
      nextCode[index] = '';
      setCode(nextCode);
      return;
    }

    digits
      .slice(0, 6 - index)
      .split('')
      .forEach((digit, offset) => {
        nextCode[index + offset] = digit;
      });

    setCode(nextCode);

    const nextIndex = Math.min(index + digits.length, 5);
    if (nextIndex < 5) {
      inputs.current[nextIndex]?.focus();
    } else {
      inputs.current[5]?.blur();
    }

    maybeAutoSubmit(nextCode);
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (overrideCode?: string) => {
    const fullCode = overrideCode || code.join('');

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
      const message =
        err.response?.data?.error ||
        (isPasswordReset ? 'Could not reset your password' : 'Invalid OTP');

      if (err.response?.status === 400) {
        triggerOtpFailure(message);
      } else {
        setError(message);
      }
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
      clearCodeInputs();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to resend OTP');
    }
  };

  const formattedTimer = `${Math.floor(timer / 60)}:${String(timer % 60).padStart(2, '0')}`;

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

        <Animated.View style={[styles.codeContainer, { transform: [{ translateX: shake }] }]}>
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
        </Animated.View>

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
          onPress={() => void handleVerify()}
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
            {timer > 0 ? `Resend in ${formattedTimer}` : 'Resend OTP'}
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
      <LoadingOverlay
        visible={loading}
        message={isPasswordReset ? 'Resetting your password...' : CAT_MESSAGES.otp}
      />
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
