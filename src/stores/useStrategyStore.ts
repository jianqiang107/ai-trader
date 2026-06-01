import { create } from 'zustand';
import type { Strategy, StrategyType, FactorState, PerformanceData } from '../types';
import { strategyService } from '../services/strategyService';

interface StrategyState {
  strategies: Strategy[];
  currentStrategy: Strategy | null;
  strategyPerformance: PerformanceData | null;
  factorStates: FactorState[];
  fetchStrategies: (type?: StrategyType, sort?: string) => Promise<void>;
  fetchStrategyDetail: (id: string) => Promise<void>;
  fetchPerformance: (id: string, start: string, end: string) => Promise<void>;
  subscribeStrategy: (id: string) => Promise<void>;
}

export const useStrategyStore = create<StrategyState>((set) => ({
  strategies: [],
  currentStrategy: null,
  strategyPerformance: null,
  factorStates: [],

  fetchStrategies: async (type?: StrategyType, sort?: string) => {
    try {
      const data = await strategyService.getStrategies(type, sort);
      set({ strategies: data });
    } catch (e) {
      console.error('Failed to fetch strategies:', e);
    }
  },

  fetchStrategyDetail: async (id: string) => {
    try {
      const [strategy, factors] = await Promise.all([
        strategyService.getStrategyDetail(id),
        strategyService.getFactorStates(id),
      ]);
      set({ currentStrategy: strategy, factorStates: factors });
    } catch (e) {
      console.error('Failed to fetch strategy detail:', e);
    }
  },

  fetchPerformance: async (id: string, start: string, end: string) => {
    try {
      const data = await strategyService.getPerformance(id, start, end);
      set({ strategyPerformance: data });
    } catch (e) {
      console.error('Failed to fetch performance:', e);
    }
  },

  subscribeStrategy: async (id: string) => {
    try {
      await strategyService.subscribeStrategy(id);
      set((state) => ({
        strategies: state.strategies.map((s) =>
          s.id === id ? { ...s, is_subscribed: true } : s
        ),
        currentStrategy: state.currentStrategy?.id === id
          ? { ...state.currentStrategy, is_subscribed: true }
          : state.currentStrategy,
      }));
    } catch (e) {
      console.error('Failed to subscribe strategy:', e);
    }
  },
}));
