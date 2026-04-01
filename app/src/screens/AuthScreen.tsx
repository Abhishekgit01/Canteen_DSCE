import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { API_CONFIG_ERROR, authApi } from '../api';
import { useAuthStore } from '../stores/authStore';
import { RootStackScreenProps } from '../types';
import { palette, shadows } from '../theme';

export default function AuthScreen({ navigation }: RootStackScreenProps<'Auth'>) {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const usnPattern = /^[1-9][A-Z]{2}\d{2}[A-Z]{2}\d{3}$/;
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Signup fields
  const [usn, setUsn] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [studentName, setStudentName] = useState('');
  const [manualName, setManualName] = useState('');
  const [isLookingUpUsn, setIsLookingUpUsn] = useState(false);
  const [usnLookupError, setUsnLookupError] = useState('');

  const { setAuth } = useAuthStore();
  const normalizedSignupUsn = useMemo(() => usn.trim().toUpperCase().replace(/\s+/g, ''), [usn]);

  useEffect(() => {
    setStudentName('');
    setManualName('');
    setUsnLookupError('');

    if (!usnPattern.test(normalizedSignupUsn)) {
      setIsLookingUpUsn(false);
      return;
    }

    let cancelled = false;
    setIsLookingUpUsn(true);

    authApi.lookupStudent(normalizedSignupUsn)
      .then((response) => {
        if (!cancelled) {
          setStudentName(response.data.name);
        }
      })
      .catch((err: any) => {
        if (!cancelled) {
          const lookupError =
            err.response?.status === 404
              ? err.response?.data?.error || 'USN not found in the imported roster'
              : 'Could not reach the server. Check that the backend is running and reachable.';
          setUsnLookupError(lookupError);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLookingUpUsn(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [normalizedSignupUsn]);

  const handleLogin = async () => {
    const normalizedEmail = loginEmail.trim().toLowerCase();

    if (!normalizedEmail || !loginPassword) {
      setError('Please fill all fields');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await authApi.login({ email: normalizedEmail, password: loginPassword });
      const { user, token } = response.data;
      await setAuth(user, token);
      navigation.replace('Main');
    } catch (err: any) {
      setError(err.response?.data?.error || err.userMessage || API_CONFIG_ERROR || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedSignupUsn || !normalizedEmail || !password) {
      setError('Please fill all fields');
      return;
    }
    if (!emailPattern.test(normalizedEmail)) {
      setError('Please enter a valid email address');
      return;
    }
    if (!studentName) {
      if (!manualName.trim()) {
        setError(usnLookupError || 'USN not found in roster');
        return;
      }
    }
    setLoading(true);
    setError('');
    try {
      const response = await authApi.signup({
        usn: normalizedSignupUsn,
        email: normalizedEmail,
        password,
        name: studentName ? undefined : manualName.trim(),
      });

      if (response.data.verificationRequired === false) {
        const { user, token } = response.data;
        await setAuth(user, token);
        navigation.replace('Main');
        return;
      }

      navigation.navigate('Otp', { email: normalizedEmail });
    } catch (err: any) {
      setError(err.response?.data?.error || err.userMessage || API_CONFIG_ERROR || 'Signup failed');
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
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.logoWrap}>
          <Text style={styles.logo}>DSCE</Text>
          <Text style={styles.subtitle}>Canteen App</Text>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, isLogin && styles.activeTab]}
            onPress={() => setIsLogin(true)}
          >
            <Text style={[styles.tabText, isLogin && styles.activeTabText]}>Login</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, !isLogin && styles.activeTab]}
            onPress={() => setIsLogin(false)}
          >
            <Text style={[styles.tabText, !isLogin && styles.activeTabText]}>Sign Up</Text>
          </TouchableOpacity>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {isLogin ? (
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#8892a4"
              value={loginEmail}
              onChangeText={setLoginEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#8892a4"
              value={loginPassword}
              onChangeText={setLoginPassword}
              secureTextEntry
            />
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text style={styles.buttonText}>{loading ? 'Please wait...' : 'Login'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="USN"
              placeholderTextColor="#8892a4"
              value={usn}
              onChangeText={(value) => setUsn(value.toUpperCase())}
              autoCapitalize="characters"
            />
            <View style={styles.lookupCard}>
              <Text style={styles.lookupLabel}>Name from DSCE records</Text>
              <Text style={styles.lookupValue}>
                {isLookingUpUsn
                  ? 'Looking up your name...'
                  : studentName || 'If your USN is missing here, enter your name below'}
              </Text>
              {usnLookupError ? <Text style={styles.lookupError}>{usnLookupError}</Text> : null}
            </View>
            {!studentName && !isLookingUpUsn ? (
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                placeholderTextColor="#8892a4"
                value={manualName}
                onChangeText={setManualName}
              />
            ) : null}
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#8892a4"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#8892a4"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSignup}
              disabled={loading}
            >
              <Text style={styles.buttonText}>{loading ? 'Please wait...' : 'Sign Up'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  scroll: {
    padding: 24,
    paddingTop: 60,
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    fontSize: 38,
    fontWeight: '900',
    color: palette.brand,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: palette.muted,
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: palette.surface,
    borderRadius: 16,
    padding: 4,
    marginBottom: 24,
    ...shadows.card,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
  },
  activeTab: {
    backgroundColor: palette.brand,
  },
  tabText: {
    color: palette.muted,
    fontWeight: '700',
  },
  activeTabText: {
    color: palette.surface,
  },
  form: {
    gap: 16,
  },
  lookupCard: {
    backgroundColor: palette.surface,
    borderRadius: 18,
    padding: 16,
    gap: 6,
    ...shadows.card,
  },
  lookupLabel: {
    color: palette.muted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  lookupValue: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  lookupError: {
    color: palette.danger,
    fontSize: 13,
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
    marginTop: 8,
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
});
