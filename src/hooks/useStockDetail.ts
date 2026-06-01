import { useState, useCallback } from 'react';
import type { Stock, KLineData, FenshiData, VolfsData } from '../types';
import { marketService } from '../services/marketService';

interface StockDetail {
  stock: Stock | null;
  klineData: KLineData[];
  fenshiData: FenshiData[];
  volfsData: VolfsData[];
  loading: boolean;
}

interface UseStockDetailReturn extends StockDetail {
  open: (code: string, name: string) => void;
  close: () => void;
  isOpen: boolean;
  stockCode: string;
  stockName: string;
}

/** 个股详情联动Hook */
export function useStockDetail(): UseStockDetailReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [stockCode, setStockCode] = useState('');
  const [stockName, setStockName] = useState('');
  const [detail, setDetail] = useState<StockDetail>({
    stock: null,
    klineData: [],
    fenshiData: [],
    volfsData: [],
    loading: false,
  });

  const open = useCallback(async (code: string, name: string) => {
    setStockCode(code);
    setStockName(name);
    setIsOpen(true);
    setDetail((prev) => ({ ...prev, loading: true }));

    try {
      const [kline, fenshi, volfs] = await Promise.all([
        marketService.getKline(code),
        marketService.getFenshi(code),
        marketService.getVolfs(code),
      ]);

      setDetail({
        stock: {
          code,
          name,
          market: code.startsWith('6') ? 'SH' : 'SZ',
          price: kline.length > 0 ? kline[kline.length - 1].close : 0,
          change_pct: 0,
          volume: 0,
          turnover_rate: 0,
          timing_score: 0,
          signal_tags: [],
          sector_codes: [],
        },
        klineData: kline,
        fenshiData: fenshi,
        volfsData: volfs,
        loading: false,
      });
    } catch (e) {
      console.error('Failed to load stock detail:', e);
      setDetail((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  return {
    ...detail,
    open,
    close,
    isOpen,
    stockCode,
    stockName,
  };
}
