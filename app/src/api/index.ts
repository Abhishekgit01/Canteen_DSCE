import axios, { type AxiosResponse } from 'axios';
import { NativeModules, Platform } from 'react-native';
import { useAuthStore } from '../stores/authStore';
import type { College, Order, PaymentInitResponse, PaymentMode, User } from '../types';
import { normalizeMenuItems } from '../utils/menu';

const normalizeOrigin = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }

  return value.replace(/\/api\/?$/, '').replace(/\/$/, '');
};

const getExpoDevHost = (): string | null => {
  const possibleScriptUrl = NativeModules.SourceCode?.scriptURL;

  if (!possibleScriptUrl) {
    return null;
  }

  try {
    return new URL(possibleScriptUrl).hostname;
  } catch {
    const match = possibleScriptUrl.match(/^[a-z]+:\/\/([^/:]+)/i);
    return match?.[1] || null;
  }
};

const getDefaultApiOrigin = (): string | null => {
  if (!__DEV__) {
    return null;
  }

  const expoHost = getExpoDevHost();
  if (expoHost) {
    return `http://${expoHost}:4000`;
  }

  return Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://127.0.0.1:4000';
};

const configuredOrigin = normalizeOrigin(process.env.EXPO_PUBLIC_API_URL);
const configuredPaymentOrigin = normalizeOrigin(process.env.EXPO_PUBLIC_PAYMENT_API_URL);
const inferredOrigin = getDefaultApiOrigin();

export const API_CONFIG_ERROR =
  configuredOrigin || inferredOrigin
    ? null
    : 'This build is missing EXPO_PUBLIC_API_URL. Point it to your public backend URL and rebuild the app.';

const API_ORIGIN = configuredOrigin || inferredOrigin || 'https://invalid.localhost';
const PAYMENT_API_ORIGIN = configuredPaymentOrigin || API_ORIGIN;

export const API_BASE = `${API_ORIGIN}/api`;
export const PAYMENT_API_BASE = PAYMENT_API_ORIGIN;

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

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
  lookupStudent: (usn: string) =>
    api.get<{ usn: string; name: string }>(`/auth/student/${encodeURIComponent(usn)}`),
  signup: (data: { usn: string; email: string; password: string; name?: string; college: College }) =>
    api.post<SignupResponse>('/auth/signup', data),
  verifyOtp: (data: { email: string; code: string }) =>
    api.post<AuthResponse>('/auth/verify-otp', data),
  resendOtp: (data: { email: string }) =>
    api.post('/auth/resend-otp', data),
  googleLogin: (idToken: string) =>
    api.post<AuthResponse | GoogleLoginPendingResponse>('/auth/google', { idToken }),
  googleCompleteSignup: (data: { idToken: string; college: College }) =>
    api.post<AuthResponse>('/auth/google/complete', data),
  requestPasswordResetOtp: (data: { email: string }) =>
    api.post<{ message: string }>('/auth/forgot-password/request', data),
  resetPasswordWithOtp: (data: { email: string; code: string; password: string }) =>
    api.post<AuthResponse>('/auth/forgot-password/reset', data),
  login: (data: { email: string; password: string }) =>
    api.post<AuthResponse>('/auth/login', data),
};

export const menuApi = {
  getMenu: async () => {
    const response = await api.get('/menu');
    return {
      ...response,
      data: normalizeMenuItems(response.data),
    };
  },
};

export const orderApi = {
  createOrder: async (data: { items: any[]; scheduledTime: string }): Promise<AxiosResponse<PaymentInitResponse>> => {
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
