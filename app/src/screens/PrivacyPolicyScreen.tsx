import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { RootStackScreenProps } from '../types';
import { palette, shadows } from '../theme';

const sections = [
  {
    title: 'What We Collect',
    body: 'We collect your name, email address, college, student ID, order history, and device session data required to keep your canteen account signed in.',
  },
  {
    title: 'How We Use It',
    body: 'Your data is used for account creation, OTP delivery, order processing, payment confirmation, and helping campus canteen staff fulfil and support your orders.',
  },
  {
    title: 'Who Can Access It',
    body: 'Access is limited to authorized canteen operations staff and administrators who need it to manage menu items, orders, and support requests.',
  },
  {
    title: 'Payments',
    body: 'Razorpay handles card and UPI payment processing. Payment credentials are not stored directly inside this mobile app.',
  },
  {
    title: 'Data Retention',
    body: 'We retain account and order records for operational and support purposes. To request deletion, contact your canteen administrator before account removal.',
  },
  {
    title: 'Third Parties',
    body: 'We do not sell your personal data. Email delivery, payment, and infrastructure providers only receive the minimum data required to complete their service.',
  },
];

export default function PrivacyPolicyScreen({
  navigation,
}: RootStackScreenProps<'PrivacyPolicy'>) {
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
          <Text style={styles.eyebrow}>Privacy Policy</Text>
          <Text style={styles.title}>Your campus canteen data, explained clearly.</Text>
          <Text style={styles.subtitle}>
            This policy covers account details, OTP delivery, order data, and how payment handling
            is delegated to Razorpay.
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

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Need Help?</Text>
          <Text style={styles.sectionBody}>
            Reach out to your canteen administrator if you need account help, want to correct your
            details, or want your data reviewed or removed.
          </Text>
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
