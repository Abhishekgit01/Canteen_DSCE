import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CartItem, MenuItem } from '../types';

interface CartState {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (menuItemId: string) => void;
  updateQuantity: (menuItemId: string, quantity: number) => void;
  clearCart: () => Promise<void>;
  loadCart: () => Promise<void>;
  total: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  addItem: async (item) => {
    const { items } = get();
    const existingIndex = items.findIndex(i => i.menuItem.id === item.menuItem.id);
    let newItems;
    if (existingIndex >= 0) {
      newItems = [...items];
      newItems[existingIndex] = item;
    } else {
      newItems = [...items, item];
    }
    await AsyncStorage.setItem('cart', JSON.stringify(newItems));
    set({ items: newItems });
  },
  removeItem: async (menuItemId) => {
    const { items } = get();
    const newItems = items.filter(i => i.menuItem.id !== menuItemId);
    await AsyncStorage.setItem('cart', JSON.stringify(newItems));
    set({ items: newItems });
  },
  updateQuantity: async (menuItemId, quantity) => {
    const { items } = get();
    const newItems = items.map(i =>
      i.menuItem.id === menuItemId ? { ...i, quantity } : i
    ).filter(i => i.quantity > 0);
    await AsyncStorage.setItem('cart', JSON.stringify(newItems));
    set({ items: newItems });
  },
  clearCart: async () => {
    await AsyncStorage.removeItem('cart');
    set({ items: [] });
  },
  loadCart: async () => {
    try {
      const cartStr = await AsyncStorage.getItem('cart');
      if (cartStr) {
        set({ items: JSON.parse(cartStr) });
        return;
      }
      set({ items: [] });
    } catch {
      await AsyncStorage.removeItem('cart');
      set({ items: [] });
    }
  },
  total: () => {
    return get().items.reduce((sum, item) => sum + (item.menuItem.price * item.quantity), 0);
  },
}));
