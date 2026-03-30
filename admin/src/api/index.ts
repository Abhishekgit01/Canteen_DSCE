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

// Response interceptor - handle 401 and token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If error is 401 and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refreshToken');

      if (refreshToken) {
        try {
          console.log('Attempting token refresh...');
          const response = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
          const { accessToken } = response.data;
          
          // Store new token
          localStorage.setItem('accessToken', accessToken);
          
          // Update the failed request with new token
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          
          // Retry the original request
          console.log('Token refreshed, retrying request...');
          return api(originalRequest);
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          // Clear all auth data
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
          
          // Only redirect if not already on login page
          if (!window.location.pathname.includes('/login')) {
            window.location.href = '/login';
          }
        }
      } else {
        // No refresh token, clear auth and redirect
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
    }

    // For network errors or other issues, just reject
    return Promise.reject(error);
  }
);

export default api;

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
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
