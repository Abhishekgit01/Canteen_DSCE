import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { authApi } from '../api';
import { useAuthStore } from '../stores/authStore';
import type { College, RootStackScreenProps } from '../types';
import { palette, shadows } from '../theme';

const colleges: Array<{
  id: College;
  title: string;
  subtitle: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  tint: string;
  soft: string;
}> = [
  {
    id: 'DSCE',
    title: 'DSCE',
    subtitle: 'Roster-aware onboarding and the full campus canteen flow',
    icon: 'school-outline',
    tint: palette.brand,
    soft: '#FCE7E1',
  },
  {
    id: 'NIE',
    title: 'NIE',
    subtitle: 'Manual-first onboarding with the same ordering experience',
    icon: 'office-building-outline',
    tint: palette.info,
    soft: palette.infoSoft,
  },
];

export default function GoogleCollegeSelectScreen({
  navigation,
  route,
}: RootStackScreenProps<'GoogleCollegeSelect'>) {
  const { email, idToken, name, picture } = route.params;
  const [selectedCollege, setSelectedCollege] = useState<College>(route.params.selectedCollege ?? 'DSCE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setAuth } = useAuthStore();

  const handleContinue = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await authApi.googleCompleteSignup({
        idToken,
        college: selectedCollege,
      });
      const { user, token } = response.data;
      await setAuth(user, token);
      navigation.replace('Main');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not finish Google signup');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.screen}
    >
      <StatusBar style="dark" />
      <View style={styles.content}>
        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialCommunityIcons name="arrow-left" size={20} color={palette.ink} />
        </TouchableOpacity>

        <View style={styles.profileCard}>
          {picture ? (
            <Image source={{ uri: picture }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarFallbackText}>{name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.eyebrow}>Google Sign In</Text>
          <Text style={styles.title}>Finish setting up your canteen access</Text>
          <Text style={styles.subtitle}>
            Signed in as {name} with {email}. Pick your college once so we can tailor the rest of the experience.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Select your college</Text>
          {colleges.map((college) => {
            const isSelected = selectedCollege === college.id;

            return (
              <Pressable
                key={college.id}
                style={[styles.collegeCard, isSelected && styles.collegeCardSelected]}
                onPress={() => setSelectedCollege(college.id)}
              >
                <View style={[styles.iconWrap, { backgroundColor: college.soft }]}>
                  <MaterialCommunityIcons name={college.icon} size={22} color={college.tint} />
                </View>
                <View style={styles.copyWrap}>
                  <Text style={styles.collegeTitle}>{college.title}</Text>
                  <Text style={styles.collegeSubtitle}>{college.subtitle}</Text>
                </View>
                <View style={[styles.radio, isSelected && styles.radioSelected]}>
                  {isSelected ? <View style={styles.radioInner} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          activeOpacity={0.92}
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Finishing setup...' : `Continue with ${selectedCollege}`}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    gap: 18,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  profileCard: {
    backgroundColor: palette.surface,
    borderRadius: 30,
    padding: 24,
    alignItems: 'center',
    ...shadows.card,
  },
  avatar: {
    width: 74,
    height: 74,
    borderRadius: 37,
    marginBottom: 16,
  },
  avatarFallback: {
    width: 74,
    height: 74,
    borderRadius: 37,
    marginBottom: 16,
    backgroundColor: palette.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: palette.brand,
    fontSize: 28,
    fontWeight: '900',
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
    lineHeight: 34,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 10,
  },
  subtitle: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 10,
  },
  section: {
    gap: 12,
  },
  sectionLabel: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginLeft: 4,
  },
  collegeCard: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: 'transparent',
    ...shadows.card,
  },
  collegeCardSelected: {
    borderColor: palette.accent,
    transform: [{ translateY: -1 }],
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyWrap: {
    flex: 1,
    gap: 4,
  },
  collegeTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: '800',
  },
  collegeSubtitle: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: palette.accent,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: palette.accent,
  },
  error: {
    color: palette.danger,
    textAlign: 'center',
    fontWeight: '700',
  },
  button: {
    backgroundColor: palette.accent,
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
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
});
