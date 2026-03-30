const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string;
};

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('token');
    }
    return this.token;
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, token } = options;
    const authToken = token || this.getToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Auth
  async login(email: string, password: string) {
    const data = await this.request<{ user: User; token: string }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    this.setToken(data.token);
    return data;
  }

  async register(data: { email: string; password: string; name: string; rollNumber: string; semester: string; department: string }) {
    const result = await this.request<{ user: User; token: string }>('/auth/register', {
      method: 'POST',
      body: data,
    });
    this.setToken(result.token);
    return result;
  }

  async getMe() {
    return this.request<User>('/auth/me');
  }

  // Menu
  async getMenuItems() {
    return this.request<MenuItem[]>('/menu');
  }

  async getCategories() {
    return this.request<string[]>('/menu/categories');
  }

  async getMenuItem(id: string) {
    return this.request<MenuItem>(`/menu/${id}`);
  }

  // Orders
  async getOrders() {
    return this.request<Order[]>('/orders');
  }

  async getOrder(id: string) {
    return this.request<Order>(`/orders/${id}`);
  }

  async createOrder(data: { items: { itemId: string; quantity: number }[]; paymentMethod: 'wallet' | 'upi' | 'card'; canteen: string }) {
    return this.request<Order>('/orders', {
      method: 'POST',
      body: data,
    });
  }

  async updateOrderStatus(id: string, status: OrderStatus) {
    return this.request<Order>(`/orders/${id}/status`, {
      method: 'PATCH',
      body: { status },
    });
  }

  // Users
  async getProfile() {
    return this.request<User>('/users/profile');
  }

  async getWallet() {
    return this.request<{ balance: number; rewardPoints: number }>('/users/wallet');
  }

  async addWalletBalance(amount: number) {
    return this.request<{ balance: number; message: string }>('/users/wallet/add', {
      method: 'POST',
      body: { amount },
    });
  }
}

// Types
interface User {
  id: string;
  email: string;
  name: string;
  rollNumber: string;
  semester: string;
  department: string;
  walletBalance: number;
  rewardPoints: number;
}

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  isVeg: boolean;
  image: string;
  badge?: string;
  canteen: string;
  rating: number;
  prepTime: number;
  isAvailable: boolean;
}

type OrderStatus = 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';

interface OrderItem {
  itemId: string;
  name: string;
  price: number;
  quantity: number;
  isVeg: boolean;
}

interface Order {
  id: string;
  orderId: string;
  userId: string;
  items: OrderItem[];
  subtotal: number;
  serviceFee: number;
  discount: number;
  total: number;
  status: OrderStatus;
  paymentMethod: 'wallet' | 'upi' | 'card';
  canteen: string;
  eta: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export type { User, MenuItem, OrderStatus, OrderItem, Order };

export const api = new ApiClient();
