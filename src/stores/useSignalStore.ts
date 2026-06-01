import { create } from 'zustand';
import type { Signal, TimingSignalMap, EmotionData, EmotionFlowData, LiveSignalFilter, LiveSignalStats, AlertSetting } from '../types';
import { signalService } from '../services/signalService';

interface SignalState {
  timingSignals: TimingSignalMap;
  emotion1Data: EmotionData[];
  emotion2Data: EmotionFlowData[];
  liveSignals: Signal[];
  liveStats: LiveSignalStats;
  liveFilter: LiveSignalFilter;
  selectedStock: { code: string; name: string } | null;
  selectedChartTab: 'fenshi' | 'liangjiao' | 'macd' | 'kdj';
  fetchTimingSignals: (date: string, mode: string) => Promise<void>;
  fetchEmotionData: (date: string) => Promise<void>;
  fetchLiveSignals: () => Promise<void>;
  selectStock: (code: string, name: string) => void;
  setSelectedChartTab: (tab: 'fenshi' | 'liangjiao' | 'macd' | 'kdj') => void;
  acknowledgeSignal: (id: string, action: 'execute' | 'ignore') => Promise<void>;
  setAlert: (id: string, setting: AlertSetting) => Promise<void>;
  setLiveFilter: (filter: Partial<LiveSignalFilter>) => void;
}

export const useSignalStore = create<SignalState>((set, get) => ({
  timingSignals: {},
  emotion1Data: [],
  emotion2Data: [],
  liveSignals: [],
  liveStats: { today_count: 0, holding: 0, take_profit: 0, stop_loss: 0, alerting: 0 },
  liveFilter: { type: 'all', period: 'today' },
  selectedStock: null,
  selectedChartTab: 'fenshi',

  fetchTimingSignals: async (date: string, mode: string) => {
    try {
      const data = await signalService.getTimingSignals(date, mode);
      set((state) => ({
        timingSignals: { ...state.timingSignals, [mode]: data },
      }));
    } catch (e) {
      console.error('Failed to fetch timing signals:', e);
    }
  },

  fetchEmotionData: async (date: string) => {
    try {
      const [emotion1, emotion2] = await Promise.all([
        signalService.getEmotion1(date),
        signalService.getEmotion2(date),
      ]);
      set({ emotion1Data: emotion1, emotion2Data: emotion2 });
    } catch (e) {
      console.error('Failed to fetch emotion data:', e);
    }
  },

  fetchLiveSignals: async () => {
    try {
      const [signals, stats] = await Promise.all([
        signalService.getLiveSignals(get().liveFilter),
        signalService.getLiveStats(),
      ]);
      set({ liveSignals: signals, liveStats: stats });
    } catch (e) {
      console.error('Failed to fetch live signals:', e);
    }
  },

  selectStock: (code: string, name: string) => {
    set({ selectedStock: { code, name } });
  },

  setSelectedChartTab: (tab) => {
    set({ selectedChartTab: tab });
  },

  acknowledgeSignal: async (id: string, action: 'execute' | 'ignore') => {
    try {
      await signalService.acknowledgeSignal(id, action);
      set((state) => ({
        liveSignals: state.liveSignals.map((s) =>
          s.id === id ? { ...s, status: action === 'execute' ? 'executed' : 'ignored' } : s
        ),
      }));
    } catch (e) {
      console.error('Failed to acknowledge signal:', e);
    }
  },

  setAlert: async (id: string, setting: AlertSetting) => {
    try {
      await signalService.setAlert(id, setting);
      set((state) => ({
        liveSignals: state.liveSignals.map((s) =>
          s.id === id ? { ...s, stop_loss_price: setting.stop_loss_price, take_profit_price: setting.take_profit_price } : s
        ),
      }));
    } catch (e) {
      console.error('Failed to set alert:', e);
    }
  },

  setLiveFilter: (filter) => {
    set((state) => ({
      liveFilter: { ...state.liveFilter, ...filter },
    }));
  },
}));
