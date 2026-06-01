import { useState, useEffect, useCallback } from 'react';
import type { KLineData } from '../types';
import { marketService } from '../services/marketService';

interface UseKlineReturn {
  klineData: KLineData[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/** K线数据加载Hook */
export function useKline(code: string, period: string = 'daily'): UseKlineReturn {
  const [klineData, setKlineData] = useState<KLineData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!code) return;
    setLoading(true);
    setError(null);
    try {
      const data = await marketService.getKline(code, period);
      setKlineData(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载K线数据失败');
    } finally {
      setLoading(false);
    }
  }, [code, period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { klineData, loading, error, refresh: fetchData };
}

/** 计算MA均线 */
export function calcMA(data: KLineData[], period: number): (number | null)[] {
  return data.map((_, i) => {
    if (i < period - 1) return null;
    const sum = data.slice(i - period + 1, i + 1).reduce((s, d) => s + d.close, 0);
    return +(sum / period).toFixed(2);
  });
}
