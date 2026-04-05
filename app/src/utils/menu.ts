import { normalizeCollege } from '../constants/colleges';
import type { CartItem, MenuItem } from '../types';
import { getDefaultPickupTime } from './pickupTime';

type MenuCategory = MenuItem['category'];
type TempOption = MenuItem['tempOptions'][number];
type UnknownRecord = Record<string, unknown>;

const validCategories: MenuCategory[] = ['meals', 'snacks', 'beverages', 'desserts'];
const validTempOptions: TempOption[] = ['cold', 'normal', 'hot'];

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function toTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function toNumber(value: unknown, fallback = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

export function sanitizeChefNote(value: unknown) {
  return typeof value === 'string'
    ? value.replace(/<[^>]*>/g, '').slice(0, 200).trim()
    : '';
}

export function getMenuItemId(value: unknown) {
  if (!isRecord(value)) {
    return '';
  }

  return toTrimmedString(value.id) || toTrimmedString(value._id);
}

export function normalizeMenuItem(value: unknown): MenuItem | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = getMenuItemId(value);
  if (!id) {
    return null;
  }

  const category = validCategories.includes(value.category as MenuCategory)
    ? (value.category as MenuCategory)
    : 'snacks';

  const tempOptions = Array.isArray(value.tempOptions)
    ? value.tempOptions.filter((option): option is TempOption =>
        validTempOptions.includes(option as TempOption),
      )
    : [];

  return {
    id,
    name: toTrimmedString(value.name),
    description: toTrimmedString(value.description),
    imageUrl: toTrimmedString(value.imageUrl),
    price: toNumber(value.price),
    calories: toNumber(value.calories),
    college: normalizeCollege(toTrimmedString(value.college)) || undefined,
    category,
    tempOptions,
    isAvailable: value.isAvailable !== false,
  };
}

export function normalizeMenuItems(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeMenuItem(item))
    .filter((item): item is MenuItem => item !== null);
}

export function normalizeCartItem(value: unknown): CartItem | null {
  if (!isRecord(value)) {
    return null;
  }

  const menuItem = normalizeMenuItem(value.menuItem);
  if (!menuItem) {
    return null;
  }

  const quantity = Math.max(1, Math.round(toNumber(value.quantity, 1)));
  const requestedTemp = toTrimmedString(value.tempPreference) as TempOption;
  const tempPreference =
    validTempOptions.includes(requestedTemp) && (menuItem.tempOptions.length === 0 || menuItem.tempOptions.includes(requestedTemp))
      ? requestedTemp
      : menuItem.tempOptions[0] || 'normal';

  const scheduledTime =
    toTrimmedString(value.scheduledTime) || getDefaultPickupTime(new Date(), menuItem.college);

  return {
    menuItem,
    quantity,
    tempPreference,
    scheduledTime,
    chefNote: sanitizeChefNote(value.chefNote),
  };
}
