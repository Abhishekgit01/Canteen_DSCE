import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface FavoritesState {
  favorites: string[];
  toggleFavorite: (itemId: string) => void;
  isFavorite: (itemId: string) => boolean;
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      favorites: [],
      toggleFavorite: (itemId: string) => set((state) => {
        if (state.favorites.includes(itemId)) {
          return { favorites: state.favorites.filter(id => id !== itemId) };
        } else {
          return { favorites: [...state.favorites, itemId] };
        }
      }),
      isFavorite: (itemId: string) => get().favorites.includes(itemId),
    }),
    {
      name: 'favorites-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
