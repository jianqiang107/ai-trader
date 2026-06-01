import { create } from 'zustand';
import type { WatchlistItem } from '../types';
import { watchlistService } from '../services/watchlistService';

interface WatchlistState {
  stocks: WatchlistItem[];
  sortBy: string;
  fetchWatchlist: () => Promise<void>;
  addToWatchlist: (code: string) => Promise<void>;
  removeFromWatchlist: (code: string) => Promise<void>;
  setSortBy: (sort: string) => void;
}

export const useWatchlistStore = create<WatchlistState>((set, get) => ({
  stocks: [],
  sortBy: 'change_pct',

  fetchWatchlist: async () => {
    try {
      const data = await watchlistService.getWatchlist();
      set({ stocks: data });
    } catch (e) {
      console.error('Failed to fetch watchlist:', e);
    }
  },

  addToWatchlist: async (code: string) => {
    try {
      await watchlistService.addToWatchlist(code);
      await get().fetchWatchlist();
    } catch (e) {
      console.error('Failed to add to watchlist:', e);
    }
  },

  removeFromWatchlist: async (code: string) => {
    try {
      await watchlistService.removeFromWatchlist(code);
      set((state) => ({
        stocks: state.stocks.filter((s) => s.code !== code),
      }));
    } catch (e) {
      console.error('Failed to remove from watchlist:', e);
    }
  },

  setSortBy: (sort: string) => {
    set({ sortBy: sort });
  },
}));
