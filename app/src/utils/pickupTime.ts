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

export function getPickupWindow(now = new Date()) {
  const serviceStart = setTimeForToday(now, PICKUP_TIME_CONFIG.serviceStartHour);
  const serviceEnd = setTimeForToday(now, PICKUP_TIME_CONFIG.serviceEndHour);
  const leadTimeDate = roundUpToInterval(
    new Date(now.getTime() + PICKUP_TIME_CONFIG.leadMinutes * 60 * 1000),
    PICKUP_TIME_CONFIG.intervalMinutes,
  );

  const minDate = leadTimeDate < serviceStart ? serviceStart : leadTimeDate;

  return {
    minDate: minDate > serviceEnd ? serviceEnd : minDate,
    maxDate: serviceEnd,
  };
}

export function clampPickupDate(date: Date, now = new Date()) {
  const { minDate, maxDate } = getPickupWindow(now);
  const rounded = roundUpToInterval(date, PICKUP_TIME_CONFIG.intervalMinutes);

  if (rounded < minDate) {
    return new Date(minDate);
  }

  if (rounded > maxDate) {
    return new Date(maxDate);
  }

  return rounded;
}

export function getPickupTimeSlots(now = new Date()) {
  const { minDate, maxDate } = getPickupWindow(now);
  const cursor = new Date(minDate);
  const slots: string[] = [];

  while (cursor <= maxDate) {
    slots.push(dateToPickupTime(cursor));
    cursor.setMinutes(cursor.getMinutes() + PICKUP_TIME_CONFIG.intervalMinutes);
  }

  if (slots.length === 0) {
    slots.push(getTimeString(PICKUP_TIME_CONFIG.serviceEndHour));
  }

  return slots;
}

export function getDefaultPickupTime(now = new Date()) {
  return dateToPickupTime(getPickupWindow(now).minDate);
}

export function getPickupQuickChoices(now = new Date(), count = 4) {
  return getPickupTimeSlots(now).slice(0, count);
}

export function formatPickupTime(value: string) {
  const date = pickupTimeToDate(value);

  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function getPickupSelectionHint(value: string, now = new Date()) {
  const selectedDate = pickupTimeToDate(value, now);
  const minutesAway = Math.max(0, Math.ceil((selectedDate.getTime() - now.getTime()) / 60000));
  const serviceClose = formatPickupTime(dateToPickupTime(getPickupWindow(now).maxDate));

  if (minutesAway <= PICKUP_TIME_CONFIG.leadMinutes + PICKUP_TIME_CONFIG.intervalMinutes) {
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
