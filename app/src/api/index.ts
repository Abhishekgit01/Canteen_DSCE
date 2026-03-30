import axios from 'axios';
import { NativeModules, Platform } from 'react-native';
import { useAuthStore } from '../stores/authStore';
import type { PaymentInitResponse, PaymentMode } from '../types';

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
const inferredOrigin = getDefaultApiOrigin();

export const API_CONFIG_ERROR =
  configuredOrigin || inferredOrigin
    ? null
    : 'This build is missing EXPO_PUBLIC_API_URL. Point it to your public backend URL and rebuild the app.';

const API_ORIGIN = configuredOrigin || inferredOrigin || 'https://invalid.localhost';

export const API_BASE = `${API_ORIGIN}/api`;

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
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

export const authApi = {
  lookupStudent: (usn: string) =>
    api.get<{ usn: string; name: string }>(`/auth/student/${encodeURIComponent(usn)}`),
  signup: (data: { usn: string; email: string; password: string; name?: string }) =>
    api.post('/auth/signup', data),
  verifyOtp: (data: { email: string; code: string }) =>
    api.post('/auth/verify-otp', data),
  resendOtp: (data: { email: string }) =>
    api.post('/auth/resend-otp', data),
  login: (data: { usn: string; password: string }) =>
    api.post('/auth/login', data),
};

export const menuApi = {
  getMenu: () => api.get('/menu'),
};

export const orderApi = {
  createOrder: (data: { items: any[]; scheduledTime: string }) =>
    api.post<PaymentInitResponse>('/orders/create', data),
  getMyOrders: () => api.get('/orders/my'),
  getOrder: (id: string) => api.get(`/orders/${id}`),
  getPaymentConfig: () =>
    api.get<{ mode: PaymentMode; canteenUpiId?: string; canteenName?: string }>(
      '/orders/payment-config',
    ),
  fulfillOrder: (id: string, qrToken: string) =>
    api.post(`/orders/${id}/fulfill`, { qrToken }),
};

export const paymentApi = {
  confirmMockPayment: (data: { orderId: string; transactionId: string }) =>
    api.post('/orders/confirm-mock', data),
  confirmUpiPayment: (data: { orderId: string; upiTransactionId: string }) =>
    api.post('/orders/confirm-upi', data),
};
