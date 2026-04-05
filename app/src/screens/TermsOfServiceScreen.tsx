import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { RootStackScreenProps } from '../types';
import { palette, shadows } from '../theme';

const sections = [
  {
    title: 'Eligibility',
    body: 'This app is for students, staff, and authorized canteen operators of supported colleges. You must use accurate account details and only use the campus linked to your account.',
  },
  {
    title: 'Ordering Rules',
    body: 'Orders must be placed through the official app flow. Menu availability, pickup slots, and order readiness are managed by your college canteen team and may change during service hours.',
  },
  {
    title: 'Payments',
    body: 'Payments are processed through approved backend payment flows and Razorpay where enabled. You agree not to tamper with payment confirmation or bypass official checkout steps.',
  },
  {
    title: 'Account Responsibility',
    body: 'You are responsible for keeping your login details and OTP access private. Fraudulent orders, abuse of staff workflows, or misuse of the app may lead to account suspension.',
  },
  {
    title: 'Service Availability',
    body: 'The canteen service may be unavailable during maintenance, holidays, stock shortages, or connectivity issues. Features and timings can differ by college campus.',
  },
  {
    title: 'Support and Disputes',
    body: 'For order disputes, refunds, account updates, or content takedown requests, contact your campus canteen administrator through the support path shared by your college.',
  },
] as const;

export default function TermsOfServiceScreen({
  navigation,
}: RootStackScreenProps<'TermsOfService'>) {
  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialCommunityIcons name="arrow-left" size={20} color={palette.ink} />
        </TouchableOpacity>

        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>Terms of Service</Text>
          <Text style={styles.title}>Ground rules for using the campus canteen app.</Text>
          <Text style={styles.subtitle}>
            These terms explain who can use the service, how ordering works, and how campus
            canteen access should be handled responsibly.
          </Text>
        </View>

        <View style={styles.card}>
          {sections.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionBody}>{section.body}</Text>
            </View>
          ))}
        </View>
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
    paddingTop: 56,
    paddingBottom: 32,
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
  heroCard: {
    backgroundColor: palette.surface,
    borderRadius: 28,
    padding: 22,
    gap: 10,
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
    lineHeight: 34,
    fontWeight: '900',
  },
  subtitle: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 22,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: 20,
    gap: 18,
    ...shadows.card,
  },
  section: {
    gap: 6,
  },
  sectionTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  sectionBody: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 21,
  },
});
