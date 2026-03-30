export interface User {
  id: string;
  email: string;
  name: string;
  rollNumber: string;
  semester: string;
  department: string;
  walletBalance: number;
  rewardPoints: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MenuItem {
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
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  itemId: string;
  name: string;
  price: number;
  quantity: number;
  isVeg: boolean;
}

export type OrderStatus = 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';

export interface Order {
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
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface CartItem {
  item: MenuItem;
  quantity: number;
}

// Socket events
export interface OrderUpdateEvent {
  orderId: string;
  status: OrderStatus;
  eta: number;
  message: string;
}

export interface SocketEvents {
  connection: () => void;
  disconnect: () => void;
  'order:subscribe': (orderId: string) => void;
  'order:unsubscribe': (orderId: string) => void;
  'order:update': (data: OrderUpdateEvent) => void;
}

// API Request/Response types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  rollNumber: string;
  semester: string;
  department: string;
}

export interface CreateOrderRequest {
  items: { itemId: string; quantity: number }[];
  paymentMethod: 'wallet' | 'upi' | 'card';
  canteen: string;
}

export interface UpdateOrderStatusRequest {
  status: OrderStatus;
}
