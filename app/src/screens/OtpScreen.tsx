import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { authApi } from '../api';
import { useAuthStore } from '../stores/authStore';
import { RootStackScreenProps } from '../types';
import { palette, shadows } from '../theme';

export default function OtpScreen({ route, navigation }: RootStackScreenProps<'Otp'>) {
  const { email } = route.params;
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timer, setTimer] = useState(60);
  const inputs = useRef<TextInput[]>([]);

  const { setAuth } = useAuthStore();

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
    setLoading(true);
    setError('');
    try {
      const response = await authApi.verifyOtp({ email, code: fullCode });
      const { user, token } = response.data;
      await setAuth(user, token);
      navigation.replace('Main');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (timer > 0) return;
    try {
      await authApi.resendOtp({ email });
      setTimer(60);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to resend');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar style="dark" />
      <View style={styles.content}>
        <Text style={styles.title}>Enter OTP</Text>
        <Text style={styles.subtitle}>Enter the 6-digit code sent to {email}</Text>

        <View style={styles.codeContainer}>
          {code.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => { if (ref) inputs.current[index] = ref; }}
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

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleVerify}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? 'Verifying...' : 'Verify'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleResend} disabled={timer > 0}>
          <Text style={[styles.resend, timer > 0 && styles.resendDisabled]}>
            {timer > 0 ? `Resend in ${timer}s` : 'Resend OTP'}
          </Text>
        </TouchableOpacity>
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
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: palette.ink,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: palette.muted,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
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
});
