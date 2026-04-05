import { getCollegePickupConfig, type SupportedCollege } from '../config/college.js';

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

function pickupTimeToDate(value: string, base = new Date()) {
  const [rawHours, rawMinutes] = value.split(':');
  const hours = Number(rawHours);
  const minutes = Number(rawMinutes);
  const next = new Date(base);

  next.setHours(Number.isFinite(hours) ? hours : 12, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  return next;
}

export function getPickupWindow(college: SupportedCollege, now = new Date()) {
  const config = getCollegePickupConfig(college);
  const serviceStart = setTimeForToday(now, config.serviceStartHour);
  const serviceEnd = setTimeForToday(now, config.serviceEndHour);
  const leadTimeDate = roundUpToInterval(
    new Date(now.getTime() + config.leadMinutes * 60 * 1000),
    config.intervalMinutes,
  );

  const minDate = leadTimeDate < serviceStart ? serviceStart : leadTimeDate;

  return {
    minDate: minDate > serviceEnd ? serviceEnd : minDate,
    maxDate: serviceEnd,
    intervalMinutes: config.intervalMinutes,
  };
}

export function isPickupTimeAllowed(value: string, college: SupportedCollege, now = new Date()) {
  const match = PICKUP_TIME_PATTERN.exec(value.trim());

  if (!match) {
    return false;
  }

  const pickupDate = pickupTimeToDate(value, now);
  const { minDate, maxDate, intervalMinutes } = getPickupWindow(college, now);

  return (
    pickupDate.getTime() >= minDate.getTime() &&
    pickupDate.getTime() <= maxDate.getTime() &&
    pickupDate.getMinutes() % intervalMinutes === 0
  );
}
