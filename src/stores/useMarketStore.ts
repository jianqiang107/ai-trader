import { create } from 'zustand';
import type { IndexData } from '../types';
import { marketService } from '../services/marketService';
import { POLL_INTERVAL } from '../utils/constants';

interface MarketState {
  indices: IndexData[];
  selectedDate: string;
  marketRegime: 'bull' | 'bear' | 'neutral';
  fetchIndices: () => Promise<void>;
  setSelectedDate: (date: string) => void;
  startIndexPolling: () => void;
  stopIndexPolling: () => void;
}

let pollTimer: ReturnType<typeof setInterval> | null = null;
let indicesFetching = false;

export const useMarketStore = create<MarketState>((set, get) => ({
  indices: [],
  selectedDate: new Date().toISOString().slice(0, 10),
  marketRegime: 'neutral',

  fetchIndices: async () => {
    if (indicesFetching) return;
    indicesFetching = true;
    try {
      const data = await marketService.getIndices();
      set({ indices: data });
      const avgChange = data.reduce((sum, idx) => sum + idx.change_pct, 0) / data.length;
      set({
        marketRegime: avgChange > 0.5 ? 'bull' : avgChange < -0.5 ? 'bear' : 'neutral',
      });
    } catch (e) {
      console.error('Failed to fetch indices:', e);
    } finally {
      indicesFetching = false;
    }
  },

  setSelectedDate: (date: string) => {
    set({ selectedDate: date });
  },

  startIndexPolling: () => {
    if (pollTimer) return;
    get().fetchIndices();
    pollTimer = setInterval(() => {
      get().fetchIndices();
    }, POLL_INTERVAL);
  },

  stopIndexPolling: () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  },
}));
