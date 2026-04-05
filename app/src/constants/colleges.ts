import type { College } from '../types';

type CollegeMeta = {
  name: string;
  fullName: string;
  canteenName: string;
  supportsRoster: boolean;
  pickupConfig: {
    leadMinutes: number;
    intervalMinutes: number;
    serviceStartHour: number;
    serviceEndHour: number;
    lunchRushStartHour: number;
    lunchRushEndHour: number;
  };
};

export const DEFAULT_COLLEGE: College = 'DSCE';

export const COLLEGES: Record<College, CollegeMeta> = {
  DSCE: {
    name: 'DSCE',
    fullName: 'Dayananda Sagar College of Engineering',
    canteenName: 'DSCE Canteen',
    supportsRoster: true,
    pickupConfig: {
      leadMinutes: 15,
      intervalMinutes: 15,
      serviceStartHour: 9,
      serviceEndHour: 20,
      lunchRushStartHour: 12,
      lunchRushEndHour: 15,
    },
  },
  NIE: {
    name: 'NIE',
    fullName: 'The National Institute of Engineering',
    canteenName: 'NIE Canteen',
    supportsRoster: true,
    pickupConfig: {
      leadMinutes: 15,
      intervalMinutes: 15,
      serviceStartHour: 8,
      serviceEndHour: 19,
      lunchRushStartHour: 12,
      lunchRushEndHour: 14,
    },
  },
};

export const AVAILABLE_COLLEGES = Object.keys(COLLEGES) as College[];

export const normalizeCollege = (college?: string | null): College | null => {
  const normalized = String(college || '').trim().toUpperCase();

  if (normalized in COLLEGES) {
    return normalized as College;
  }

  return null;
};

export const getCollegeMeta = (college?: string | null): CollegeMeta => {
  const normalized = normalizeCollege(college);
  return normalized ? COLLEGES[normalized] : COLLEGES[DEFAULT_COLLEGE];
};

export const getCollegeName = (college?: string | null): string => getCollegeMeta(college).name;

export const getCollegeFullName = (college?: string | null): string =>
  getCollegeMeta(college).fullName;

export const getCanteenName = (college?: string | null): string => getCollegeMeta(college).canteenName;

export const supportsRosterLookup = (college?: string | null): boolean =>
  getCollegeMeta(college).supportsRoster;

export const getCollegePickupConfig = (college?: string | null) =>
  getCollegeMeta(college).pickupConfig;

export const formatPayeeName = (value?: string | null, fallbackCollege?: string | null): string => {
  const normalized = String(value || '').trim().replace(/\+/g, ' ');
  return normalized || getCanteenName(fallbackCollege);
};
