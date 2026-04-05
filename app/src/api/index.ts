import axios, { type AxiosResponse } from 'axios';
import { DEFAULT_COLLEGE, normalizeCollege } from '../constants/colleges';
import { useAuthStore } from '../stores/authStore';
import {
  API_BASE,
  API_CONFIG_ERROR,
  API_ORIGIN,
  PAYMENT_API_BASE,
} from './config';
import type {
  College,
  MenuItem,
  Order,
  PendingReviewItem,
  PaymentInitResponse,
  PaymentMode,
  PickupSettings,
  Review,
  RushHourRule,
  RushHourStatus,
  User,
} from '../types';
import { normalizeMenuItems } from '../utils/menu';

const MENU_CACHE_TTL_MS = 2 * 60 * 1000;

type MenuCacheEntry = {
  data: MenuItem[];
  cachedAt: number;
};

type RushHourApiRecord = Omit<RushHourRule, 'college'> & {
  college?: string | null;
};

type PickupSettingsApiRecord = Omit<PickupSettings, 'college'> & {
  college?: string | null;
};

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

let menuCache: Partial<Record<College, MenuCacheEntry>> = {};
let menuRequest: Partial<Record<College, Promise<MenuItem[]>>> = {};

api.interceptors.request.use(async (config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (!error.response) {
      error.userMessage =
        API_CONFIG_ERROR ||
        'Could not reach the server. Check that the backend is running and reachable.';
    }

    if (error.response?.status === 401) {
      await useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

export default api;
export { API_BASE, API_CONFIG_ERROR };

function resolveMenuCollege(college?: string | null): College {
  return normalizeCollege(college) || DEFAULT_COLLEGE;
}

function getFreshMenuCache(college?: string | null) {
  const resolvedCollege = resolveMenuCollege(college);
  const cachedEntry = menuCache[resolvedCollege];

  if (!cachedEntry) {
    return null;
  }

  if (Date.now() - cachedEntry.cachedAt >= MENU_CACHE_TTL_MS) {
    delete menuCache[resolvedCollege];
    return null;
  }

  return cachedEntry.data;
}

async function fetchMenuData(college?: string | null, force = false) {
  const resolvedCollege = resolveMenuCollege(college);

  if (!force) {
    const cachedMenu = getFreshMenuCache(resolvedCollege);
    if (cachedMenu) {
      return cachedMenu;
    }
  }

  const pendingRequest = menuRequest[resolvedCollege];
  if (pendingRequest) {
    return pendingRequest;
  }

  menuRequest[resolvedCollege] = api
    .get('/menu', {
      params: {
        college: resolvedCollege,
      },
    })
    .then((response) => {
      const data = normalizeMenuItems(response.data);
      menuCache[resolvedCollege] = {
        data,
        cachedAt: Date.now(),
      };
      return data;
    })
    .finally(() => {
      delete menuRequest[resolvedCollege];
    });

  return menuRequest[resolvedCollege]!;
}

function normalizeRushHourRule(value: RushHourApiRecord): RushHourRule {
  return {
    ...value,
    college: resolveMenuCollege(value.college),
  };
}

function normalizeRushHourStatus(value: {
  isRushHour?: boolean;
  current?: RushHourApiRecord | null;
  all?: RushHourApiRecord[];
}): RushHourStatus {
  return {
    isRushHour: Boolean(value?.isRushHour),
    current: value?.current ? normalizeRushHourRule(value.current) : null,
    all: Array.isArray(value?.all) ? value.all.map(normalizeRushHourRule) : [],
  };
}

function normalizePickupSettings(value: PickupSettingsApiRecord): PickupSettings {
  const sanitizeTime = (input: unknown, fallback: string) =>
    typeof input === 'string' && /^\d{2}:\d{2}$/.test(input.trim()) ? input.trim() : fallback;
  const toNumber = (input: unknown, fallback: number) => {
    const next = Number(input);
    return Number.isFinite(next) ? next : fallback;
  };

  return {
    college: resolveMenuCollege(value?.college),
    basePickupMinutes: toNumber(value?.basePickupMinutes, 15),
    rushHourExtra: toNumber(value?.rushHourExtra, 10),
    perItemExtra: toNumber(value?.perItemExtra, 2),
    maxPickupMinutes: toNumber(value?.maxPickupMinutes, 45),
    openingTime: sanitizeTime(value?.openingTime, '09:00'),
    closingTime: sanitizeTime(value?.closingTime, '20:00'),
    breakStart: sanitizeTime(value?.breakStart, '15:00'),
    breakEnd: sanitizeTime(value?.breakEnd, '16:00'),
    hasBreak: Boolean(value?.hasBreak),
    isOpen: value?.isOpen !== false,
    closedMessage:
      typeof value?.closedMessage === 'string' && value.closedMessage.trim()
        ? value.closedMessage.trim()
        : 'Canteen is currently closed',
    isCurrentlyOpen: Boolean(value?.isCurrentlyOpen),
    currentTime:
      typeof value?.currentTime === 'string' && /^\d{2}:\d{2}$/.test(value.currentTime.trim())
        ? value.currentTime.trim()
        : '00:00',
    updatedAt: typeof value?.updatedAt === 'string' ? value.updatedAt : undefined,
  };
}

type RazorpayCreateOrderResponse = {
  order: Order;
  razorpay: {
    key_id: string;
    razorpay_order_id: string;
    amount: number;
    currency: string;
  };
};

type CreateOrderResponse = PaymentInitResponse | RazorpayCreateOrderResponse;

type AuthResponse = {
  user: User;
  token: string;
};

type GoogleLoginPendingResponse = {
  requiresCollege: true;
  email: string;
  name: string;
  picture?: string | null;
  message: string;
};

type GoogleAuthPayload = {
  idToken?: string;
  accessToken?: string;
};

type SignupResponse =
  | {
      verificationRequired: true;
      message: string;
      student: {
        usn: string;
        name: string;
        source: 'roster' | 'manual';
      };
    }
  | ({
      verificationRequired: false;
      message: string;
    } & AuthResponse);

export const authApi = {
  lookupStudent: (usn: string, college: College) =>
    api.get<{ usn: string; name: string }>(`/auth/student/${encodeURIComponent(usn)}`, {
      params: { college },
    }),
  signup: (data: { usn: string; email: string; password: string; name?: string; college: College }) =>
    api.post<SignupResponse>('/auth/signup', data),
  verifyOtp: (data: { email: string; code: string }) =>
    api.post<AuthResponse>('/auth/verify-otp', data),
  resendOtp: (data: { email: string }) =>
    api.post('/auth/resend-otp', data),
  googleLogin: (data: GoogleAuthPayload) =>
    api.post<AuthResponse | GoogleLoginPendingResponse>('/auth/google', data),
  googleCompleteSignup: (data: GoogleAuthPayload & { college: College }) =>
    api.post<AuthResponse>('/auth/google/complete', data),
  requestPasswordResetOtp: (data: { email: string }) =>
    api.post<{ message: string; purpose?: 'signup' | 'password_reset' }>(
      '/auth/forgot-password/request',
      data,
    ),
  resetPasswordWithOtp: (data: { email: string; code: string; password: string }) =>
    api.post<AuthResponse>('/auth/forgot-password/reset', data),
  login: (data: { email: string; password: string }) =>
    api.post<AuthResponse>('/auth/login', data),
};

export const menuApi = {
  getMenu: async (options?: { force?: boolean; college?: string | null }) => {
    const data = await fetchMenuData(options?.college, options?.force);
    return {
      data,
    };
  },
  prefetchMenu: async (college?: string | null) => fetchMenuData(college),
  getCachedMenu: (college?: string | null) => getFreshMenuCache(college) || [],
};

export const rushHoursApi = {
  getStatus: async (college?: string | null) => {
    const response = await api.get('/rush-hours', {
      params: {
        college: resolveMenuCollege(college),
      },
    });

    return {
      ...response,
      data: normalizeRushHourStatus(response.data),
    };
  },
};

export const pickupSettingsApi = {
  getSettings: async (college?: string | null) => {
    const response = await api.get(`/pickup-settings/${resolveMenuCollege(college)}`);

    return {
      ...response,
      data: normalizePickupSettings(response.data),
    };
  },
};

export async function warmupBackend() {
  if (API_CONFIG_ERROR) {
    return;
  }

  await fetch(`${API_ORIGIN}/warmup`).catch(() => undefined);
}

export const saveExpoPushToken = (expoPushToken: string) =>
  api.post('/notifications/token', { expoPushToken });

export const clearExpoPushToken = () => api.delete('/notifications/token');

export const reviewsApi = {
  getItemReviews: (
    menuItemId: string,
    page = 1,
    sort: 'recent' | 'helpful' | 'highest' | 'lowest' = 'recent',
  ) =>
    api
      .get<{
        menuItem: Pick<MenuItem, 'id' | 'name' | 'averageRating' | 'totalReviews' | 'ratingBreakdown'> & {
          _id?: string;
        };
        reviews: Review[];
        pagination: {
          page: number;
          limit: number;
          total: number;
          pages: number;
        };
      }>(`/reviews/menu/${menuItemId}`, {
        params: { page, sort },
      })
      .then((response) => response.data),
  submitReview: (data: {
    menuItemId: string;
    orderId: string;
    rating: number;
    title?: string;
    body?: string;
    tags?: string[];
  }) => api.post<Review>('/reviews', data).then((response) => response.data),
  markReviewHelpful: (reviewId: string) =>
    api.post<{ helpful: number }>(`/reviews/${reviewId}/helpful`).then((response) => response.data),
  getPendingReviews: () =>
    api.get<PendingReviewItem[]>('/reviews/pending').then((response) => response.data),
};

export const orderApi = {
  createOrder: async (data: {
    items: Array<{
      menuItemId: string;
      quantity: number;
      tempPreference?: string;
      chefNote?: string;
    }>;
    scheduledTime: string;
  }): Promise<AxiosResponse<PaymentInitResponse>> => {
    const response = await api.post<CreateOrderResponse>('/orders/create', data);

    if ('razorpay' in response.data && 'order' in response.data) {
      return {
        ...response,
        data: {
          mode: 'razorpay',
          orderId: response.data.order.id,
          amount: response.data.razorpay.amount / 100,
          order: response.data.order,
          razorpay: response.data.razorpay,
        },
      } as AxiosResponse<PaymentInitResponse>;
    }

    return response as AxiosResponse<PaymentInitResponse>;
  },
  getMyOrders: () => api.get('/orders/my'),
  getOrder: (id: string) => api.get(`/orders/${id}`),
  getPaymentConfig: () =>
    api.get<{ mode: PaymentMode; canteenUpiId?: string; canteenName?: string }>('/orders/payment-config'),
  updateOrderStatus: (id: string, status: string) =>
    api.patch(`/orders/${id}/status`, { status }),
  fulfillOrder: (id: string, qrToken: string) =>
    api.post(`/orders/${id}/fulfill`, { qrToken }),
};

export const paymentApi = {
  confirmMockPayment: (data: { orderId: string; transactionId: string }) =>
    api.post('/orders/confirm-mock', data),
  confirmUpiPayment: (data: { orderId: string; upiTransactionId: string }) =>
    api.post('/orders/confirm-upi', data),
  confirmRazorpayPayment: async (
    orderId: string,
    data: {
      razorpay_payment_id: string;
      razorpay_order_id: string;
      razorpay_signature: string;
    },
  ) => {
    const response = await api.post<{ orderId: string; qrToken?: string }>(
      `/orders/${orderId}/confirm-razorpay`,
      data,
    );
    return response;
  },
};
