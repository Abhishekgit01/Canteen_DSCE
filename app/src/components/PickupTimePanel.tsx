import React, { useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import AppIcon from './AppIcon';
import { palette, shadows } from '../theme';
import {
  clampPickupDate,
  dateToPickupTime,
  formatPickupTime,
  getLunchRushWindowLabel,
  getPickupQuickChoices,
  getPickupSelectionHint,
  getPickupWindow,
  pickupTimeToDate,
} from '../utils/pickupTime';

type PickupTimePanelProps = {
  value: string;
  onChange: (time: string) => void | Promise<void>;
  contextLabel: string;
  compact?: boolean;
  college?: string | null;
};

export default function PickupTimePanel({
  value,
  onChange,
  contextLabel,
  compact = false,
  college,
}: PickupTimePanelProps) {
  const [showPicker, setShowPicker] = useState(false);
  const now = useMemo(() => new Date(), []);
  const quickChoices = useMemo(() => getPickupQuickChoices(now, 4, college), [college, now]);
  const { minDate, maxDate } = useMemo(() => getPickupWindow(now, college), [college, now]);
  const pickerDate = useMemo(() => pickupTimeToDate(value, now), [now, value]);

  const applyTime = (nextTime: string) => {
    void Promise.resolve(onChange(nextTime)).catch((error) => {
      console.error('Failed to update pickup time:', error);
    });
  };

  const handlePickerChange = (_event: unknown, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }

    if (!selectedDate) {
      return;
    }

    const safeDate = clampPickupDate(selectedDate, now, college);
    applyTime(dateToPickupTime(safeDate));
  };

  return (
    <View style={[styles.panel, compact && styles.panelCompact]}>
      <View style={styles.header}>
        <View style={[styles.iconWrap, compact && styles.iconWrapCompact]}>
          <AppIcon name="clock" size={compact ? 16 : 18} color={palette.accent} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, compact && styles.titleCompact]}>Pickup Time</Text>
          <Text style={styles.subtitle}>
            {contextLabel}: {formatPickupTime(value)}
          </Text>
        </View>
      </View>

      <View style={[styles.highlightCard, compact && styles.highlightCardCompact]}>
        <View style={styles.highlightCopy}>
          <Text style={styles.highlightEyebrow}>Selected</Text>
          <Text style={[styles.highlightValue, compact && styles.highlightValueCompact]}>
            {formatPickupTime(value)}
          </Text>
          <Text style={styles.highlightHint}>{getPickupSelectionHint(value, now, college)}</Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          style={[styles.customButton, compact && styles.customButtonCompact]}
          onPress={() => setShowPicker(true)}
        >
          <Text style={styles.customButtonText}>Customise</Text>
          <AppIcon name="chevron-right" size={16} color={palette.surface} />
        </TouchableOpacity>
      </View>

      <View style={styles.choiceRow}>
        {quickChoices.map((choice, index) => {
          const active = choice === value;
          const label = index === 0 ? 'Earliest' : `+${index * 15} min`;

          return (
            <TouchableOpacity
              key={choice}
              activeOpacity={0.92}
              style={[styles.choiceChip, active && styles.choiceChipActive]}
              onPress={() => applyTime(choice)}
            >
              <Text style={[styles.choiceLabel, active && styles.choiceLabelActive]}>{label}</Text>
              <Text style={[styles.choiceTime, active && styles.choiceTimeActive]}>
                {formatPickupTime(choice)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.rushHint}>Lunch rush: {getLunchRushWindowLabel(college)}</Text>
        <Text style={styles.boundsHint}>
          Open till {formatPickupTime(dateToPickupTime(maxDate))}
        </Text>
      </View>

      {showPicker ? (
        <DateTimePicker
          value={pickerDate}
          mode="time"
          is24Hour={false}
          display="default"
          minimumDate={minDate}
          maximumDate={maxDate}
          onChange={handlePickerChange}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: 14,
  },
  panelCompact: {
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: palette.warningSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapCompact: {
    width: 38,
    height: 38,
    borderRadius: 12,
  },
  headerCopy: {
    flex: 1,
    gap: 3,
  },
  title: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: '800',
  },
  titleCompact: {
    fontSize: 16,
  },
  subtitle: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  highlightCard: {
    backgroundColor: palette.surfaceRaised,
    borderRadius: 22,
    padding: 16,
    gap: 14,
    ...shadows.card,
  },
  highlightCardCompact: {
    borderRadius: 20,
    padding: 14,
  },
  highlightCopy: {
    gap: 6,
  },
  highlightEyebrow: {
    color: palette.brand,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  highlightValue: {
    color: palette.ink,
    fontSize: 28,
    fontWeight: '900',
  },
  highlightValueCompact: {
    fontSize: 24,
  },
  highlightHint: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  customButton: {
    alignSelf: 'flex-start',
    backgroundColor: palette.brand,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  customButtonCompact: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  customButtonText: {
    color: palette.surface,
    fontSize: 14,
    fontWeight: '800',
  },
  choiceRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  choiceChip: {
    minWidth: 92,
    backgroundColor: palette.surfaceMuted,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 3,
  },
  choiceChipActive: {
    backgroundColor: palette.accent,
  },
  choiceLabel: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  choiceLabelActive: {
    color: 'rgba(255,255,255,0.78)',
  },
  choiceTime: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  choiceTimeActive: {
    color: palette.surface,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  rushHint: {
    color: palette.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  boundsHint: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '600',
  },
});
