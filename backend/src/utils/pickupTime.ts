import { type SupportedCollege } from '../config/college.js';
import { getPickupRuntimeSettings } from '../services/pickup-settings.service.js';

const PICKUP_TIME_PATTERN = /^(\d{2}):(\d{2})$/;

function roundUpToInterval(date: Date, intervalMinutes: number) {
  const rounded = new Date(date);
  const remainder = rounded.getMinutes() % intervalMinutes;

  if (remainder !== 0) {
    rounded.setMinutes(rounded.getMinutes() + intervalMinutes - remainder);
  }

  rounded.setSeconds(0, 0);
  return rounded;
}

function setTimeForToday(base: Date, hours: number, minutes = 0) {
  const next = new Date(base);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

function parseTimeString(value: string) {
  const [rawHours, rawMinutes] = value.split(':');
  const hours = Number(rawHours);
  const minutes = Number(rawMinutes);

  return {
    hours: Number.isFinite(hours) ? hours : 0,
    minutes: Number.isFinite(minutes) ? minutes : 0,
  };
}

function pickupTimeToDate(value: string, base = new Date()) {
  const { hours, minutes } = parseTimeString(value);
  const next = new Date(base);

  next.setHours(hours, minutes, 0, 0);
  return next;
}

function isWithinBreak(date: Date, breakStart: Date, breakEnd: Date) {
  return date >= breakStart && date < breakEnd;
}

async function buildPickupWindow(college: SupportedCollege, now = new Date()) {
  const runtime = await getPickupRuntimeSettings(college, now);
  const { hours: openingHour, minutes: openingMinute } = parseTimeString(runtime.openingTime);
  const { hours: closingHour, minutes: closingMinute } = parseTimeString(runtime.closingTime);
  const serviceStart = setTimeForToday(now, openingHour, openingMinute);
  const serviceEnd = setTimeForToday(now, closingHour, closingMinute);
  const leadTimeDate = roundUpToInterval(
    new Date(now.getTime() + runtime.basePickupMinutes * 60 * 1000),
    runtime.intervalMinutes,
  );

  let minDate = leadTimeDate < serviceStart ? serviceStart : leadTimeDate;

  let breakWindow:
    | {
        start: Date;
        end: Date;
      }
    | null = null;

  if (runtime.hasBreak) {
    const { hours: breakStartHour, minutes: breakStartMinute } = parseTimeString(runtime.breakStart);
    const { hours: breakEndHour, minutes: breakEndMinute } = parseTimeString(runtime.breakEnd);
    const breakStart = setTimeForToday(now, breakStartHour, breakStartMinute);
    const breakEnd = setTimeForToday(now, breakEndHour, breakEndMinute);

    breakWindow = { start: breakStart, end: breakEnd };
    if (isWithinBreak(minDate, breakStart, breakEnd)) {
      minDate = roundUpToInterval(new Date(breakEnd), runtime.intervalMinutes);
    }
  }

  if (minDate > serviceEnd) {
    minDate = new Date(serviceEnd);
  }

  return {
    minDate,
    maxDate: serviceEnd,
    intervalMinutes: runtime.intervalMinutes,
    isCurrentlyOpen: runtime.isCurrentlyOpen,
    breakWindow,
  };
}

export async function getPickupWindow(college: SupportedCollege, now = new Date()) {
  const { minDate, maxDate, intervalMinutes } = await buildPickupWindow(college, now);

  return {
    minDate,
    maxDate,
    intervalMinutes,
  };
}

export async function isPickupTimeAllowed(value: string, college: SupportedCollege, now = new Date()) {
  const match = PICKUP_TIME_PATTERN.exec(value.trim());

  if (!match) {
    return false;
  }

  const pickupDate = pickupTimeToDate(value, now);
  const { minDate, maxDate, intervalMinutes, isCurrentlyOpen, breakWindow } =
    await buildPickupWindow(college, now);

  if (!isCurrentlyOpen) {
    return false;
  }

  if (breakWindow && isWithinBreak(pickupDate, breakWindow.start, breakWindow.end)) {
    return false;
  }

  return (
    pickupDate.getTime() >= minDate.getTime() &&
    pickupDate.getTime() <= maxDate.getTime() &&
    pickupDate.getMinutes() % intervalMinutes === 0
  );
}
