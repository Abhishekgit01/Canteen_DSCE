import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

// Request interceptor - attach token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - clear auth on 401 to match the live backend token contract
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');

      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
};

export const menuApi = {
  getMenu: (college?: string) => api.get('/menu', { params: college ? { college } : {} }),
  createItem: (data: any) => api.post('/menu', data),
  updateItem: (id: string, data: any) => api.patch(`/menu/${id}`, data),
  deleteItem: (id: string) => api.delete(`/menu/${id}`),
};

export const ordersApi = {
  getOrders: (college?: string) => api.get('/admin/orders', { params: college ? { college } : {} }),
  getOrderById: (orderId: string) => api.get(`/orders/${orderId}`),
  createOrder: (items: any[]) => api.post('/orders', { items }),
  updateOrderStatus: (orderId: string, status: string) =>
    api.patch(`/orders/${orderId}/status`, { status }),
  fulfillOrder: (orderId: string, qrToken: string) =>
    api.post(`/orders/${orderId}/fulfill`, { qrToken }),
};

export const statsApi = {
  getStats: (college?: string) => api.get('/admin/stats', { params: college ? { college } : {} }),
};

export const usersApi = {
  getUsers: () => api.get('/admin/users'),
  updateRole: (id: string, role: string) => api.patch(`/admin/users/${id}/role`, { role }),
};

export const rushHoursApi = {
  getRushHours: (college?: string) =>
    api.get('/rush-hours/all', { params: college ? { college } : {} }),
  getRushHourStatus: (college?: string) =>
    api.get('/rush-hours', { params: college ? { college } : {} }),
  createRushHour: (data: any) => api.post('/rush-hours', data),
  updateRushHour: (id: string, data: any) => api.patch(`/rush-hours/${id}`, data),
  deleteRushHour: (id: string) => api.delete(`/rush-hours/${id}`),
};
