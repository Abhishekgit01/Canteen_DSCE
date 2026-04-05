import type { SupportedCollege } from '../config/college.js';

export interface MenuCacheEntry {
  data: unknown[];
  cachedAt: number;
}

export const MENU_CACHE_TTL_MS = 2 * 60 * 1000;
export const MENU_CACHE_SELECT =
  'name description imageUrl price calories college category tempOptions isAvailable isFeatured';

let cache: Partial<Record<SupportedCollege, MenuCacheEntry>> = {};

export const getMenuCache = (college: SupportedCollege) => {
  const entry = cache[college];

  if (!entry) {
    return null;
  }

  if (Date.now() - entry.cachedAt >= MENU_CACHE_TTL_MS) {
    delete cache[college];
    return null;
  }

  return entry.data;
};

export const setMenuCache = (college: SupportedCollege, data: unknown[]) => {
  cache[college] = {
    data,
    cachedAt: Date.now(),
  };
};

export const clearMenuCache = (college?: SupportedCollege) => {
  if (!college) {
    cache = {};
    return;
  }

  delete cache[college];
};
