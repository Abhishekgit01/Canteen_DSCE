import { getCollegePickupConfig } from '../constants/colleges';

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

export function dateToPickupTime(date: Date) {
  return getTimeString(date.getHours(), date.getMinutes());
}

export function pickupTimeToDate(value: string, base = new Date()) {
  const [rawHours, rawMinutes] = value.split(':');
  const hours = Number(rawHours);
  const minutes = Number(rawMinutes);
  const next = new Date(base);

  next.setHours(Number.isFinite(hours) ? hours : 12, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  return next;
}

export function getPickupWindow(now = new Date(), college?: string | null) {
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

export function clampPickupDate(date: Date, now = new Date(), college?: string | null) {
  const { minDate, maxDate, intervalMinutes } = getPickupWindow(now, college);
  const rounded = roundUpToInterval(date, intervalMinutes);

  if (rounded < minDate) {
    return new Date(minDate);
  }

  if (rounded > maxDate) {
    return new Date(maxDate);
  }

  return rounded;
}

export function getPickupTimeSlots(now = new Date(), college?: string | null) {
  const config = getCollegePickupConfig(college);
  const { minDate, maxDate } = getPickupWindow(now, college);
  const cursor = new Date(minDate);
  const slots: string[] = [];

  while (cursor <= maxDate) {
    slots.push(dateToPickupTime(cursor));
    cursor.setMinutes(cursor.getMinutes() + config.intervalMinutes);
  }

  if (slots.length === 0) {
    slots.push(getTimeString(config.serviceEndHour));
  }

  return slots;
}

export function getDefaultPickupTime(now = new Date(), college?: string | null) {
  return dateToPickupTime(getPickupWindow(now, college).minDate);
}

export function getPickupQuickChoices(now = new Date(), count = 4, college?: string | null) {
  return getPickupTimeSlots(now, college).slice(0, count);
}

export function formatPickupTime(value: string) {
  const date = pickupTimeToDate(value);

  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function getPickupSelectionHint(value: string, now = new Date(), college?: string | null) {
  const config = getCollegePickupConfig(college);
  const selectedDate = pickupTimeToDate(value, now);
  const minutesAway = Math.max(0, Math.ceil((selectedDate.getTime() - now.getTime()) / 60000));
  const serviceClose = formatPickupTime(dateToPickupTime(getPickupWindow(now, college).maxDate));

  if (minutesAway <= config.leadMinutes + config.intervalMinutes) {
    return `Earliest ready window today · Service closes at ${serviceClose}`;
  }

  if (minutesAway < 60) {
    return `About ${minutesAway} minutes from now · Service closes at ${serviceClose}`;
  }

  const hours = Math.floor(minutesAway / 60);
  const minutes = minutesAway % 60;
  const formattedLead = minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;

  return `About ${formattedLead} from now · Service closes at ${serviceClose}`;
}

export function getLunchRushWindowLabel(college?: string | null) {
  const config = getCollegePickupConfig(college);
  return `${formatPickupTime(getTimeString(config.lunchRushStartHour))} - ${formatPickupTime(
    getTimeString(config.lunchRushEndHour),
  )}`;
}

export function getLunchRushInfo(now = new Date(), college?: string | null) {
  const config = getCollegePickupConfig(college);
  const rushStart = setTimeForToday(now, config.lunchRushStartHour);
  const rushEnd = setTimeForToday(now, config.lunchRushEndHour);

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
      subtitle: `Rush window ${getLunchRushWindowLabel(college)}`,
    };
  }

  if (now < rushEnd) {
    const mins = Math.max(1, Math.ceil((rushEnd.getTime() - now.getTime()) / 60000));
    return {
      minutes: mins,
      formattedTime: formatDuration(mins),
      label: 'LEFT',
      subtitle: `Rush window ${getLunchRushWindowLabel(college)}`,
    };
  }

  const tomorrowStart = setTimeForToday(
    new Date(now.getTime() + 24 * 60 * 60 * 1000),
    config.lunchRushStartHour,
  );
  const mins = Math.max(1, Math.ceil((tomorrowStart.getTime() - now.getTime()) / 60000));

  return {
    minutes: mins,
    formattedTime: formatDuration(mins),
    label: 'TO START',
    subtitle: `Next rush ${getLunchRushWindowLabel(college)}`,
  };
}
