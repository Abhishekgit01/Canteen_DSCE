import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CartItem } from '../types';
import { getMenuItemId, normalizeCartItem } from '../utils/menu';

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
    const normalizedItem = normalizeCartItem(item);
    if (!normalizedItem) {
      return;
    }

    const { items } = get();
    const existingIndex = items.findIndex(
      (entry) => getMenuItemId(entry.menuItem) === normalizedItem.menuItem.id,
    );
    let newItems;
    if (existingIndex >= 0) {
      newItems = [...items];
      newItems[existingIndex] = normalizedItem;
    } else {
      newItems = [...items, normalizedItem];
    }
    await AsyncStorage.setItem('cart', JSON.stringify(newItems));
    set({ items: newItems });
  },
  removeItem: async (menuItemId) => {
    const { items } = get();
    const newItems = items.filter((entry) => getMenuItemId(entry.menuItem) !== menuItemId);
    await AsyncStorage.setItem('cart', JSON.stringify(newItems));
    set({ items: newItems });
  },
  updateQuantity: async (menuItemId, quantity) => {
    const { items } = get();
    const newItems = items
      .map((entry) =>
        getMenuItemId(entry.menuItem) === menuItemId ? { ...entry, quantity } : entry,
      )
      .filter((entry) => entry.quantity > 0);
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
        const parsedItems = JSON.parse(cartStr);
        const normalizedItems = Array.isArray(parsedItems)
          ? parsedItems
              .map((item) => normalizeCartItem(item))
              .filter((item): item is CartItem => item !== null)
          : [];

        await AsyncStorage.setItem('cart', JSON.stringify(normalizedItems));
        set({ items: normalizedItems });
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
