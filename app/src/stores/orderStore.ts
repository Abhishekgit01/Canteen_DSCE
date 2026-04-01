import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Order {
  id: string;
  status: 'pending' | 'paid' | 'preparing' | 'ready' | 'fulfilled' | 'failed';
  items: Array<{
    menuItemId: string;
    name: string;
    quantity: number;
    price: number;
  }>;
  totalAmount: number;
  qrToken?: string;
  createdAt: string;
}

interface OrderState {
  orders: Order[];
  currentOrder: Order | null;
  updateOrder: (orderId: string, updates: Partial<Order>) => void;
  setCurrentOrder: (order: Order | null) => void;
  addOrder: (order: Order) => void;
}

export const useOrderStore = create<OrderState>()(
  persist(
    (set, get) => ({
      orders: [],
      currentOrder: null,
      
      updateOrder: (orderId, updates) => {
        set((state) => ({
          orders: state.orders.map((order) =>
            order.id === orderId ? { ...order, ...updates } : order
          ),
          currentOrder: state.currentOrder?.id === orderId 
            ? { ...state.currentOrder, ...updates }
            : state.currentOrder,
        }));
      },
      
      setCurrentOrder: (order) => {
        set({ currentOrder: order });
      },
      
      addOrder: (order) => {
        set((state) => ({
          orders: [order, ...state.orders],
          currentOrder: order,
        }));
      },
    }),
    {
      name: 'order-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
