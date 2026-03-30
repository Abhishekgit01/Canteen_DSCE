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
  login: (usn: string, password: string) =>
    api.post('/auth/login', { usn, password }),
};

export const menuApi = {
  getMenu: () => api.get('/menu'),
  createItem: (data: any) => api.post('/menu', data),
  updateItem: (id: string, data: any) => api.patch(`/menu/${id}`, data),
  deleteItem: (id: string) => api.delete(`/menu/${id}`),
};

export const ordersApi = {
  getOrders: () => api.get('/admin/orders'),
};

export const statsApi = {
  getStats: () => api.get('/admin/stats'),
};

export const usersApi = {
  getUsers: () => api.get('/admin/users'),
  updateRole: (id: string, role: string) => api.patch(`/admin/users/${id}/role`, { role }),
};
