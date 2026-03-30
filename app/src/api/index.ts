import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

// *********************************************
// PLEASE CHANGE THE IP ADDRESS BELOW TO YOUR COMPUTER'S IP
// *********************************************
const API_BASE = 'http://192.168.29.255:3001/api';

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
    if (error.response?.status === 401) {
      await useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

export default api;

export const authApi = {
  signup: (data: { name: string; usn: string; email: string; password: string }) =>
    api.post('/auth/signup', data),
  verifyOtp: (data: { email: string; code: string }) =>
    api.post('/auth/verify-otp', data),
  resendOtp: (data: { email: string }) =>
    api.post('/auth/resend-otp', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
};

export const menuApi = {
  getMenu: () => api.get('/menu'),
};

export const orderApi = {
  createOrder: (data: { items: any[]; scheduledTime: string }) =>
    api.post('/orders/create', data),
  getMyOrders: () => api.get('/orders/my'),
  getOrder: (id: string) => api.get(`/orders/${id}`),
  fulfillOrder: (id: string, qrToken: string) =>
    api.post(`/orders/${id}/fulfill`, { qrToken }),
};

export const paymentApi = {
  createMockPayment: (data: { orderId?: string; items: any[] }) =>
    api.post('/payment/mock/create', data),
  verifyMockPayment: (data: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) =>
    api.post('/payment/mock/verify', data),
  getPaymentStatus: (orderId: string) =>
    api.get(`/payment/mock/status/${orderId}`),
};
