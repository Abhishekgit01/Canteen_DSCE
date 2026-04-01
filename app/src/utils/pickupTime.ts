const PICKUP_TIME_CONFIG = {
  leadMinutes: 15,
  intervalMinutes: 15,
  serviceStartHour: 9,
  serviceEndHour: 20,
  lunchRushStartHour: 12,
  lunchRushEndHour: 15,
} as const;

function formatTwoDigits(value: number) {
  return value.toString().padStart(2, '0');
}

function getTimeString(hours: number, minutes = 0) {
  return `${formatTwoDigits(hours)}:${formatTwoDigits(minutes)}`;
}

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

export function getPickupTimeSlots(now = new Date()) {
  const firstAvailable = roundUpToInterval(
    new Date(now.getTime() + PICKUP_TIME_CONFIG.leadMinutes * 60 * 1000),
    PICKUP_TIME_CONFIG.intervalMinutes,
  );
  const serviceStart = setTimeForToday(now, PICKUP_TIME_CONFIG.serviceStartHour);
  const serviceEnd = setTimeForToday(now, PICKUP_TIME_CONFIG.serviceEndHour);
  const cursor = firstAvailable < serviceStart ? serviceStart : firstAvailable;
  const slots: string[] = [];

  while (cursor <= serviceEnd) {
    slots.push(getTimeString(cursor.getHours(), cursor.getMinutes()));
    cursor.setMinutes(cursor.getMinutes() + PICKUP_TIME_CONFIG.intervalMinutes);
  }

  if (slots.length === 0) {
    slots.push(getTimeString(PICKUP_TIME_CONFIG.serviceEndHour));
  }

  return slots;
}

export function getDefaultPickupTime(now = new Date()) {
  return getPickupTimeSlots(now)[0];
}

export function formatPickupTime(value: string) {
  const [rawHours, rawMinutes] = value.split(':');
  const hours = Number(rawHours);
  const minutes = Number(rawMinutes);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return value;
  }

  const date = new Date();
  date.setHours(hours, minutes, 0, 0);

  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function getLunchRushWindowLabel() {
  return `${formatPickupTime(getTimeString(PICKUP_TIME_CONFIG.lunchRushStartHour))} - ${formatPickupTime(
    getTimeString(PICKUP_TIME_CONFIG.lunchRushEndHour),
  )}`;
}

export function getLunchRushInfo(now = new Date()) {
  const rushStart = setTimeForToday(now, PICKUP_TIME_CONFIG.lunchRushStartHour);
  const rushEnd = setTimeForToday(now, PICKUP_TIME_CONFIG.lunchRushEndHour);

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  if (now < rushStart) {
    const mins = Math.max(1, Math.ceil((rushStart.getTime() - now.getTime()) / 60000));
    return {
      minutes: mins,
      formattedTime: formatDuration(mins),
      label: 'TO START',
      subtitle: `Rush window ${getLunchRushWindowLabel()}`,
    };
  }

  if (now < rushEnd) {
    const mins = Math.max(1, Math.ceil((rushEnd.getTime() - now.getTime()) / 60000));
    return {
      minutes: mins,
      formattedTime: formatDuration(mins),
      label: 'LEFT',
      subtitle: `Rush window ${getLunchRushWindowLabel()}`,
    };
  }

  const tomorrowStart = setTimeForToday(new Date(now.getTime() + 24 * 60 * 60 * 1000), PICKUP_TIME_CONFIG.lunchRushStartHour);
  const mins = Math.max(1, Math.ceil((tomorrowStart.getTime() - now.getTime()) / 60000));

  return {
    minutes: mins,
    formattedTime: formatDuration(mins),
    label: 'TO START',
    subtitle: `Next rush ${getLunchRushWindowLabel()}`,
  };
}

export { PICKUP_TIME_CONFIG };
