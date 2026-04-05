export const SUPPORTED_COLLEGES = ['DSCE', 'NIE'] as const;

export type SupportedCollege = (typeof SUPPORTED_COLLEGES)[number];

export type CollegePickupConfig = {
  leadMinutes: number;
  intervalMinutes: number;
  serviceStartHour: number;
  serviceEndHour: number;
  lunchRushStartHour: number;
  lunchRushEndHour: number;
};

export const DEFAULT_COLLEGE: SupportedCollege = 'DSCE';

export const COLLEGE_CANTEEN_NAMES: Record<SupportedCollege, string> = {
  DSCE: 'DSCE Canteen',
  NIE: 'NIE Canteen',
};

export const COLLEGE_PICKUP_CONFIG: Record<SupportedCollege, CollegePickupConfig> = {
  DSCE: {
    leadMinutes: 15,
    intervalMinutes: 15,
    serviceStartHour: 9,
    serviceEndHour: 20,
    lunchRushStartHour: 12,
    lunchRushEndHour: 15,
  },
  NIE: {
    leadMinutes: 15,
    intervalMinutes: 15,
    serviceStartHour: 8,
    serviceEndHour: 19,
    lunchRushStartHour: 12,
    lunchRushEndHour: 14,
  },
};

export const normalizeCollege = (value: unknown): SupportedCollege | null => {
  const normalized = String(value || '').trim().toUpperCase();

  if (SUPPORTED_COLLEGES.includes(normalized as SupportedCollege)) {
    return normalized as SupportedCollege;
  }

  return null;
};

export const resolveCollege = (value?: unknown): SupportedCollege =>
  normalizeCollege(value) || DEFAULT_COLLEGE;

export const getCollegePickupConfig = (college?: unknown): CollegePickupConfig =>
  COLLEGE_PICKUP_CONFIG[resolveCollege(college)];
