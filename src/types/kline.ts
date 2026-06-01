/** K线数据 */
export interface KLineData {
  stock_code: string;
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
  ma5: number | null;
  ma10: number | null;
  ma20: number | null;
  ma30: number | null;
}

/** 分时数据 */
export interface FenshiData {
  time: string;
  price: number;
  avg_price: number;
  volume: number;
}

/** Volfs量能数据 */
export interface VolfsData {
  date: string;
  vol_value: number;
  vol_signal: 'bullish' | 'neutral' | 'bearish';
}

/** 情绪研判数据 */
export interface EmotionData {
  date: string;
  value: number;
}

/** 情绪研判二号(资金流向) */
export interface EmotionFlowData {
  date: string;
  inflow: number;
  outflow: number;
}
