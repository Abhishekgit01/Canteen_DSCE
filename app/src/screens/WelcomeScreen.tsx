import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { College, RootStackScreenProps } from '../types';
import { palette, shadows } from '../theme';

const colleges: Array<{
  id: College;
  title: string;
  subtitle: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  accent: string;
  soft: string;
}> = [
  {
    id: 'DSCE',
    title: 'DSCE',
    subtitle: 'Roster-assisted signup and daily canteen ordering',
    icon: 'school-outline',
    accent: palette.brand,
    soft: '#FCE7E1',
  },
  {
    id: 'NIE',
    title: 'NIE',
    subtitle: 'Manual signup today, same ordering flow and OTP access',
    icon: 'office-building-outline',
    accent: palette.info,
    soft: palette.infoSoft,
  },
];

export default function WelcomeScreen({ navigation }: RootStackScreenProps<'Welcome'>) {
  const insets = useSafeAreaInsets();
  const [selectedCollege, setSelectedCollege] = useState<College>('DSCE');

  const selectedCard = colleges.find((college) => college.id === selectedCollege) ?? colleges[0];

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 28 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={[styles.heroOrb, styles.heroOrbPrimary]} />
          <View style={[styles.heroOrb, styles.heroOrbSecondary]} />
          <View style={styles.heroBadge}>
            <MaterialCommunityIcons name="silverware-fork-knife" size={18} color={palette.accent} />
            <Text style={styles.heroBadgeText}>Ybyte Campus Canteen</Text>
          </View>
          <Text style={styles.heroTitle}>Order faster, skip the queue, pick your campus.</Text>
          <Text style={styles.heroSubtitle}>
            Start with your college so signup, OTP verification, and canteen identity feel personal from the first screen.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Choose your college</Text>
          {colleges.map((college) => {
            const isSelected = college.id === selectedCollege;

            return (
              <Pressable
                key={college.id}
                onPress={() => setSelectedCollege(college.id)}
                style={[
                  styles.collegeCard,
                  isSelected && styles.collegeCardSelected,
                ]}
              >
                <View style={[styles.collegeIconWrap, { backgroundColor: college.soft }]}>
                  <MaterialCommunityIcons name={college.icon} size={22} color={college.accent} />
                </View>
                <View style={styles.collegeTextWrap}>
                  <Text style={styles.collegeTitle}>{college.title}</Text>
                  <Text style={styles.collegeSubtitle}>{college.subtitle}</Text>
                </View>
                <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                  {isSelected ? <View style={styles.radioInner} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.highlightCard}>
          <Text style={styles.highlightEyebrow}>Campus ready</Text>
          <Text style={styles.highlightTitle}>{selectedCard.title} selected</Text>
          <Text style={styles.highlightCopy}>
            You can change this later on the auth screen, but we’ll use it to tailor signup and verification right away.
          </Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.92}
          style={styles.primaryButton}
          onPress={() =>
            navigation.navigate('Auth', {
              selectedCollege,
              initialMode: 'signup',
            })
          }
        >
          <Text style={styles.primaryButtonText}>Continue with {selectedCollege}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.secondaryButton}
          onPress={() =>
            navigation.navigate('Auth', {
              selectedCollege,
              initialMode: 'login',
            })
          }
        >
          <Text style={styles.secondaryButtonText}>I already have an account</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  content: {
    paddingHorizontal: 20,
    gap: 20,
  },
  hero: {
    backgroundColor: palette.surface,
    borderRadius: 30,
    padding: 24,
    overflow: 'hidden',
    ...shadows.card,
  },
  heroOrb: {
    position: 'absolute',
    borderRadius: 999,
  },
  heroOrbPrimary: {
    width: 140,
    height: 140,
    backgroundColor: '#FFE7D1',
    top: -46,
    right: -28,
  },
  heroOrbSecondary: {
    width: 96,
    height: 96,
    backgroundColor: '#FCE4E4',
    bottom: -36,
    left: -12,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: palette.surfaceRaised,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 18,
  },
  heroBadgeText: {
    color: palette.brand,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  heroTitle: {
    color: palette.ink,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '900',
    maxWidth: '88%',
  },
  heroSubtitle: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 14,
    maxWidth: '88%',
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
  collegeIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collegeTextWrap: {
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
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: palette.accent,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: palette.accent,
  },
  highlightCard: {
    backgroundColor: palette.warningSoft,
    borderRadius: 24,
    padding: 18,
    gap: 6,
  },
  highlightEyebrow: {
    color: '#9A6A35',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  highlightTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: '800',
  },
  highlightCopy: {
    color: '#7A5B37',
    fontSize: 14,
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: palette.accent,
    borderRadius: 20,
    paddingVertical: 17,
    alignItems: 'center',
    ...shadows.floating,
  },
  primaryButtonText: {
    color: palette.surface,
    fontSize: 16,
    fontWeight: '900',
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: palette.brand,
    fontSize: 14,
    fontWeight: '800',
  },
});
