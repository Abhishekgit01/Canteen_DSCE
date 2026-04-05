import { create } from 'zustand';
import { DEFAULT_COLLEGE, normalizeCollege } from '../constants/colleges';
import type { College, PickupSettings, RushHourStatus } from '../types';

type RuntimeByCollege<T> = Partial<Record<College, T>>;

type CanteenState = {
  rushStatusByCollege: RuntimeByCollege<RushHourStatus>;
  pickupSettingsByCollege: RuntimeByCollege<PickupSettings>;
  setRushStatus: (college: string | null | undefined, status: RushHourStatus) => void;
  setPickupSettings: (settings: PickupSettings) => void;
};

function resolveCollege(college?: string | null): College {
  return normalizeCollege(college) || DEFAULT_COLLEGE;
}

export const useCanteenStore = create<CanteenState>((set) => ({
  rushStatusByCollege: {},
  pickupSettingsByCollege: {},
  setRushStatus: (college, status) =>
    set((state) => ({
      rushStatusByCollege: {
        ...state.rushStatusByCollege,
        [resolveCollege(college)]: status,
      },
    })),
  setPickupSettings: (settings) =>
    set((state) => ({
      pickupSettingsByCollege: {
        ...state.pickupSettingsByCollege,
        [resolveCollege(settings.college)]: settings,
      },
    })),
}));
