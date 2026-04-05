import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { API_CONFIG_ERROR, authApi, menuApi } from '../api';
import LoadingOverlay from '../components/LoadingOverlay';
import {
  AVAILABLE_COLLEGES,
  DEFAULT_COLLEGE,
  getCanteenName,
  getCollegeFullName,
  getCollegeName,
  supportsRosterLookup,
} from '../constants/colleges';
import { CAT_MESSAGES } from '../constants/loading';
import { getGoogleSignInErrorMessage, signInWithGoogleNative } from '../lib/googleAuth';
import type { College, RootStackScreenProps } from '../types';
import { useAuthStore } from '../stores/authStore';
import { palette, shadows } from '../theme';

type GoogleLoginButtonProps = {
  navigation: RootStackScreenProps<'Auth'>['navigation'];
  selectedCollege: College;
  onError: (message: string) => void;
  mode: 'login' | 'signup';
};

function GoogleLoginButton({
  navigation,
  selectedCollege,
  onError,
  mode,
}: GoogleLoginButtonProps) {
  const [googleLoading, setGoogleLoading] = useState(false);
  const { setAuth } = useAuthStore();

  const handleGoogleSignIn = async () => {
    onError('');
    setGoogleLoading(true);

    try {
      const credential = await signInWithGoogleNative();
      if (!credential) {
        setGoogleLoading(false);
        return;
      }

      const response = await authApi.googleLogin({
        accessToken: credential.accessToken,
        idToken: credential.idToken,
      });

      if ('requiresCollege' in response.data && response.data.requiresCollege) {
        navigation.navigate('GoogleCollegeSelect', {
          accessToken: credential.accessToken,
          idToken: credential.idToken,
          email: response.data.email,
          name: response.data.name,
          picture: response.data.picture || credential.picture,
          selectedCollege,
        });
        return;
      }

      const authData = response.data as { user: Parameters<typeof setAuth>[0]; token: string };
      await setAuth(authData.user, authData.token);
      navigation.replace('Main');
    } catch (error: any) {
      onError(error?.response?.data?.error || getGoogleSignInErrorMessage(error));
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      style={[styles.googleButton, googleLoading && styles.buttonDisabled]}
      onPress={() => void handleGoogleSignIn()}
      disabled={googleLoading}
    >
      <Image
        source={{ uri: 'https://developers.google.com/identity/images/g-logo.png' }}
        style={styles.googleLogo}
      />
      <Text style={styles.googleButtonText}>
        {googleLoading
          ? 'Opening Google...'
          : mode === 'signup'
            ? 'Sign up with Google'
            : 'Continue with Google'}
      </Text>
    </TouchableOpacity>
  );
}

export default function AuthScreen({ navigation, route }: RootStackScreenProps<'Auth'>) {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const usnPattern = /^[1-9][A-Z]{2}\d{2}[A-Z]{2}\d{3}$/;
  const [isLogin, setIsLogin] = useState(route.params?.initialMode !== 'signup');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedCollege, setSelectedCollege] = useState<College>(
    route.params?.selectedCollege ?? DEFAULT_COLLEGE,
  );

  const [loginEmail, setLoginEmail] = useState(route.params?.prefilledEmail ?? '');
  const [loginPassword, setLoginPassword] = useState('');

  const [usn, setUsn] = useState('');
  const [email, setEmail] = useState(route.params?.prefilledEmail ?? '');
  const [password, setPassword] = useState('');
  const [studentName, setStudentName] = useState('');
  const [manualName, setManualName] = useState('');
  const [isLookingUpUsn, setIsLookingUpUsn] = useState(false);
  const [usnLookupError, setUsnLookupError] = useState('');
  const [hasConsent, setHasConsent] = useState(false);

  const { setAuth } = useAuthStore();
  const normalizedSignupUsn = useMemo(() => usn.trim().toUpperCase().replace(/\s+/g, ''), [usn]);
  const isGoogleConfigured = Platform.OS === 'android';
  const selectedCollegeName = getCollegeName(selectedCollege);
  const selectedCollegeFullName = getCollegeFullName(selectedCollege);
  const selectedCanteenName = getCanteenName(selectedCollege);

  useEffect(() => {
    if (route.params?.selectedCollege) {
      setSelectedCollege(route.params.selectedCollege);
    }
  }, [route.params?.selectedCollege]);

  useEffect(() => {
    if (route.params?.initialMode) {
      setIsLogin(route.params.initialMode === 'login');
    }
  }, [route.params?.initialMode]);

  useEffect(() => {
    if (route.params?.prefilledEmail) {
      setLoginEmail(route.params.prefilledEmail);
      setEmail(route.params.prefilledEmail);
    }
  }, [route.params?.prefilledEmail]);

  useEffect(() => {
    setStudentName('');
    setUsnLookupError('');

    if (!supportsRosterLookup(selectedCollege)) {
      setIsLookingUpUsn(false);
      return;
    }

    if (!usnPattern.test(normalizedSignupUsn)) {
      setIsLookingUpUsn(false);
      return;
    }

    let cancelled = false;
    setIsLookingUpUsn(true);

    authApi
      .lookupStudent(normalizedSignupUsn, selectedCollege)
      .then((response) => {
        if (!cancelled) {
          setStudentName(response.data.name);
        }
      })
      .catch((err: any) => {
        if (!cancelled) {
          const lookupError =
            err.response?.status === 404
              ? err.response?.data?.error || `USN not found in the ${selectedCollegeName} roster`
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
  }, [normalizedSignupUsn, selectedCollege]);

  const handleLogin = async () => {
    const normalizedEmail = loginEmail.trim().toLowerCase();

    if (!normalizedEmail || !loginPassword) {
      setError('Please fill all fields');
      return;
    }

    setLoading(true);
    setError('');
    const menuPromise = menuApi.prefetchMenu(selectedCollege).catch(() => null);

    try {
      const response = await authApi.login({ email: normalizedEmail, password: loginPassword });
      const { user, token } = response.data;
      await setAuth(user, token);
      if (user.college && user.college !== selectedCollege) {
        await menuApi.prefetchMenu(user.college).catch(() => null);
      } else {
        await menuPromise;
      }
      navigation.replace('Main');
    } catch (err: any) {
      setError(err.response?.data?.error || err.userMessage || API_CONFIG_ERROR || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const resolvedName = studentName || manualName.trim();

    if (!normalizedSignupUsn || !normalizedEmail || !password) {
      setError('Please fill all fields');
      return;
    }

    if (!emailPattern.test(normalizedEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    if (!resolvedName) {
      setError(
        supportsRosterLookup(selectedCollege)
          ? usnLookupError || `Enter your full name if your USN is not in the ${selectedCollegeName} roster`
          : 'Please enter your full name',
      );
      return;
    }

    if (!hasConsent) {
      setError('Please confirm the privacy notice before signing up');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await authApi.signup({
        usn: normalizedSignupUsn,
        email: normalizedEmail,
        password,
        name: resolvedName,
        college: selectedCollege,
      });

      if (response.data.verificationRequired === false) {
        const { user, token } = response.data;
        await setAuth(user, token);
        navigation.replace('Main');
        return;
      }

      navigation.navigate('Otp', {
        email: normalizedEmail,
        purpose: 'signup',
      });
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
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <TouchableOpacity
            activeOpacity={0.75}
            style={styles.backButton}
            onPress={() => navigation.navigate('Welcome')}
          >
            <MaterialCommunityIcons name="arrow-left" size={20} color={palette.ink} />
          </TouchableOpacity>

          <Text style={styles.heroEyebrow}>{selectedCollegeName} Access</Text>
          <Text style={styles.heroTitle}>Welcome to the canteen lane.</Text>
          <Text style={styles.heroSubtitle}>
            Sign in for live orders or create a fresh account with campus-aware signup, OTP verification, and one-tap Google access for {selectedCanteenName}.
          </Text>
        </View>

        <View style={styles.collegeSwitchCard}>
          <Text style={styles.collegeSwitchLabel}>College</Text>
          <View style={styles.collegeSwitchRow}>
            {AVAILABLE_COLLEGES.map((college) => {
              const active = college === selectedCollege;

              return (
                <TouchableOpacity
                  key={college}
                  activeOpacity={0.9}
                  style={[styles.collegeChip, active && styles.collegeChipActive]}
                  onPress={() => setSelectedCollege(college)}
                >
                  <Text style={[styles.collegeChipText, active && styles.collegeChipTextActive]}>
                    {getCollegeName(college)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.collegeSwitchHint}>{selectedCollegeFullName}</Text>
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
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Login to your account</Text>
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
              activeOpacity={0.8}
              style={styles.inlineLinkWrap}
              onPress={() =>
                navigation.navigate('ForgotPassword', {
                  prefilledEmail: loginEmail.trim().toLowerCase(),
                })
              }
            >
              <Text style={styles.inlineLink}>Forgot password?</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text style={styles.buttonText}>{loading ? 'Please wait...' : 'Login'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.policyLinkWrap}
              onPress={() => navigation.navigate('PrivacyPolicy')}
            >
              <Text style={styles.policyLink}>Privacy Policy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.policyLinkWrap}
              onPress={() => navigation.navigate('TermsOfService')}
            >
              <Text style={styles.policyLink}>Terms of Service</Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            {isGoogleConfigured ? (
              <GoogleLoginButton
                navigation={navigation}
                selectedCollege={selectedCollege}
                onError={setError}
                mode="login"
              />
            ) : null}
          </View>
        ) : (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Create your {selectedCollegeName} account</Text>
            <TextInput
              style={styles.input}
              placeholder="USN"
              placeholderTextColor="#8892a4"
              value={usn}
              onChangeText={(value) => setUsn(value.toUpperCase())}
              autoCapitalize="characters"
            />

            <View style={styles.lookupCard}>
              <Text style={styles.lookupLabel}>
                {supportsRosterLookup(selectedCollege)
                  ? `${selectedCollegeName} records`
                  : 'Manual verification'}
              </Text>
              <Text style={styles.lookupValue}>
                {supportsRosterLookup(selectedCollege)
                  ? isLookingUpUsn
                    ? 'Looking up your name...'
                    : studentName || 'If your USN is not found, type your name below.'
                  : `${selectedCollegeName} signup currently uses manual name entry, then OTP verification on email.`}
              </Text>
              {usnLookupError && supportsRosterLookup(selectedCollege) ? (
                <Text style={styles.lookupError}>{usnLookupError}</Text>
              ) : null}
            </View>

            {!supportsRosterLookup(selectedCollege) || !studentName || !isLookingUpUsn ? (
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
              activeOpacity={0.9}
              style={styles.consentRow}
              onPress={() => setHasConsent((current) => !current)}
            >
              <MaterialCommunityIcons
                name={hasConsent ? 'checkbox-marked' : 'checkbox-blank-outline'}
                size={22}
                color={hasConsent ? palette.accent : palette.subtle}
              />
              <View style={styles.consentCopy}>
                <Text style={styles.consentText}>
                  I confirm I can use this campus canteen app and I agree to the privacy notice.
                </Text>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => navigation.navigate('PrivacyPolicy')}
                >
                  <Text style={styles.inlinePolicyLink}>Read Privacy Policy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => navigation.navigate('TermsOfService')}
                >
                  <Text style={styles.inlinePolicyLink}>Read Terms of Service</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSignup}
              disabled={loading}
            >
              <Text style={styles.buttonText}>{loading ? 'Please wait...' : 'Continue to OTP'}</Text>
            </TouchableOpacity>
            {isGoogleConfigured ? (
              <>
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>OR</Text>
                  <View style={styles.dividerLine} />
                </View>

                <GoogleLoginButton
                  navigation={navigation}
                  selectedCollege={selectedCollege}
                  onError={setError}
                  mode="signup"
                />
              </>
            ) : null}
          </View>
        )}
      </ScrollView>
      <LoadingOverlay
        visible={loading}
        message={isLogin ? CAT_MESSAGES.login : CAT_MESSAGES.signup}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  scroll: {
    padding: 20,
    paddingTop: 48,
    paddingBottom: 28,
    gap: 18,
  },
  heroCard: {
    backgroundColor: palette.surface,
    borderRadius: 28,
    padding: 22,
    ...shadows.card,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: palette.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  heroEyebrow: {
    color: palette.brand,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: palette.ink,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
    marginTop: 10,
  },
  heroSubtitle: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: palette.surface,
    borderRadius: 18,
    padding: 4,
    ...shadows.card,
  },
  collegeSwitchCard: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: 16,
    gap: 10,
    ...shadows.card,
  },
  collegeSwitchLabel: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  collegeSwitchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  collegeChip: {
    backgroundColor: palette.surfaceMuted,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  collegeChipActive: {
    backgroundColor: palette.brand,
  },
  collegeChipText: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '800',
  },
  collegeChipTextActive: {
    color: palette.surface,
  },
  collegeSwitchHint: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  tab: {
    flex: 1,
    paddingVertical: 13,
    alignItems: 'center',
    borderRadius: 14,
  },
  activeTab: {
    backgroundColor: palette.brand,
  },
  tabText: {
    color: palette.muted,
    fontWeight: '800',
  },
  activeTabText: {
    color: palette.surface,
  },
  formCard: {
    backgroundColor: palette.surface,
    borderRadius: 28,
    padding: 20,
    gap: 14,
    ...shadows.card,
  },
  formTitle: {
    color: palette.ink,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 2,
  },
  lookupCard: {
    backgroundColor: palette.surfaceRaised,
    borderRadius: 18,
    padding: 16,
    gap: 6,
  },
  lookupLabel: {
    color: palette.muted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  lookupValue: {
    color: palette.ink,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
  },
  lookupError: {
    color: palette.danger,
    fontSize: 13,
  },
  input: {
    backgroundColor: palette.surfaceMuted,
    borderRadius: 18,
    padding: 16,
    color: palette.ink,
    fontSize: 16,
  },
  inlineLinkWrap: {
    alignSelf: 'flex-end',
    marginTop: -2,
  },
  inlineLink: {
    color: palette.brand,
    fontSize: 13,
    fontWeight: '800',
  },
  policyLinkWrap: {
    alignItems: 'center',
    marginTop: -2,
  },
  policyLink: {
    color: palette.brand,
    fontSize: 13,
    fontWeight: '800',
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  consentCopy: {
    flex: 1,
    gap: 4,
  },
  consentText: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  inlinePolicyLink: {
    color: palette.brand,
    fontSize: 13,
    fontWeight: '800',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: palette.line,
  },
  dividerText: {
    color: palette.subtle,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
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
    opacity: 0.6,
  },
  buttonText: {
    color: palette.surface,
    fontWeight: '900',
    fontSize: 16,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DADCE0',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 10,
    ...shadows.card,
  },
  googleLogo: {
    width: 20,
    height: 20,
  },
  googleButtonText: {
    color: '#3C4043',
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    color: palette.danger,
    textAlign: 'center',
    fontWeight: '700',
    paddingHorizontal: 10,
  },
});
