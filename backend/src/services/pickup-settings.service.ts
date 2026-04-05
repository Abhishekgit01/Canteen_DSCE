import { getCollegePickupConfig, resolveCollege, type SupportedCollege } from '../config/college.js';
import { PickupSettings } from '../models/PickupSettings.js';
import { RushHour } from '../models/RushHour.js';

const TIME_PATTERN = /^\d{2}:\d{2}$/;

type PickupSettingsRecord = {
  college: SupportedCollege;
  basePickupMinutes: number;
  rushHourExtra: number;
  perItemExtra: number;
  maxPickupMinutes: number;
  openingTime: string;
  closingTime: string;
  breakStart: string;
  breakEnd: string;
  hasBreak: boolean;
  isOpen: boolean;
  closedMessage: string;
  updatedBy?: unknown;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

export type PickupRuntimeSettings = PickupSettingsRecord & {
  intervalMinutes: number;
  isCurrentlyOpen: boolean;
  currentTime: string;
};

function getCurrentTimeString(now = new Date()) {
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function timeToMinutes(value: string) {
  const match = TIME_PATTERN.exec(value.trim());
  if (!match) {
    return 0;
  }

  const hours = Number(match[0].slice(0, 2));
  const minutes = Number(match[0].slice(3, 5));
  return hours * 60 + minutes;
}

function isWithinBreak(settings: PickupSettingsRecord, currentMinutes: number) {
  if (!settings.hasBreak) {
    return false;
  }

  const breakStartMinutes = timeToMinutes(settings.breakStart);
  const breakEndMinutes = timeToMinutes(settings.breakEnd);
  return currentMinutes >= breakStartMinutes && currentMinutes < breakEndMinutes;
}

function buildDefaultPickupSettings(college: SupportedCollege): PickupSettingsRecord {
  const config = getCollegePickupConfig(college);

  return {
    college,
    basePickupMinutes: config.leadMinutes,
    rushHourExtra: 10,
    perItemExtra: 2,
    maxPickupMinutes: 45,
    openingTime: `${String(config.serviceStartHour).padStart(2, '0')}:00`,
    closingTime: `${String(config.serviceEndHour).padStart(2, '0')}:00`,
    breakStart: '15:00',
    breakEnd: '16:00',
    hasBreak: false,
    isOpen: true,
    closedMessage: 'Canteen is currently closed',
  };
}

export async function ensurePickupSettingsDocument(college: SupportedCollege) {
  const resolvedCollege = resolveCollege(college);
  const defaults = buildDefaultPickupSettings(resolvedCollege);

  const settings = await PickupSettings.findOneAndUpdate(
    { college: resolvedCollege },
    { $setOnInsert: defaults },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    },
  ).lean();

  return settings as PickupSettingsRecord;
}

export async function getPickupSettingsRecord(college: SupportedCollege) {
  return ensurePickupSettingsDocument(resolveCollege(college));
}

export function toPickupRuntimeSettings(
  college: SupportedCollege,
  settings: PickupSettingsRecord,
  now = new Date(),
): PickupRuntimeSettings {
  const resolvedCollege = resolveCollege(college);
  const config = getCollegePickupConfig(resolvedCollege);
  const currentTime = getCurrentTimeString(now);
  const currentMinutes = timeToMinutes(currentTime);
  const openingMinutes = timeToMinutes(settings.openingTime);
  const closingMinutes = timeToMinutes(settings.closingTime);

  const isCurrentlyOpen =
    settings.isOpen &&
    currentMinutes >= openingMinutes &&
    currentMinutes <= closingMinutes &&
    !isWithinBreak(settings, currentMinutes);

  return {
    ...settings,
    college: resolvedCollege,
    intervalMinutes: config.intervalMinutes,
    currentTime,
    isCurrentlyOpen,
  };
}

export async function getPickupRuntimeSettings(college: SupportedCollege, now = new Date()) {
  const resolvedCollege = resolveCollege(college);
  const settings = await getPickupSettingsRecord(resolvedCollege);
  return toPickupRuntimeSettings(resolvedCollege, settings, now);
}

export async function getActiveRushHour(college: SupportedCollege, now = new Date()) {
  const resolvedCollege = resolveCollege(college);
  const currentDay = now.getDay();
  const currentTime = getCurrentTimeString(now);

  return RushHour.findOne({
    college: resolvedCollege,
    isActive: true,
    dayOfWeek: currentDay,
    startTime: { $lte: currentTime },
    endTime: { $gte: currentTime },
  })
    .sort({ startTime: 1 })
    .lean();
}

export async function calculateEstimatedPickup(
  college: SupportedCollege,
  itemCount: number,
  now = new Date(),
) {
  const settings = await getPickupRuntimeSettings(college, now);
  const activeRushHour = await getActiveRushHour(college, now);

  let estimatedPickupMinutes =
    settings.basePickupMinutes + settings.perItemExtra * Math.max(0, itemCount);

  if (activeRushHour) {
    estimatedPickupMinutes += settings.rushHourExtra;
  }

  estimatedPickupMinutes = Math.min(
    estimatedPickupMinutes,
    settings.maxPickupMinutes,
  );

  return {
    settings,
    activeRushHour,
    estimatedPickupMinutes,
    estimatedPickupAt: new Date(now.getTime() + estimatedPickupMinutes * 60 * 1000),
  };
}
