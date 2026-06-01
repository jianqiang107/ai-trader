import dayjs from 'dayjs';

/** 格式化价格 */
export function formatPrice(price: number, digits: number = 2): string {
  return price.toFixed(digits);
}

/** 格式化涨跌幅 */
export function formatChangePct(pct: number): string {
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

/** 格式化金额（万元） */
export function formatAmount(amount: number): string {
  if (amount >= 10000) {
    return `${(amount / 10000).toFixed(2)}亿`;
  }
  return `${amount.toFixed(0)}万`;
}

/** 格式化成交量（万手） */
export function formatVolume(volume: number): string {
  if (volume >= 10000) {
    return `${(volume / 10000).toFixed(0)}万手`;
  }
  return `${volume.toFixed(0)}手`;
}

/** 格式化日期 */
export function formatDate(date: string | Date, format: string = 'YYYY-MM-DD'): string {
  return dayjs(date).format(format);
}

/** 格式化时间 */
export function formatTime(date: string | Date): string {
  return dayjs(date).format('HH:mm');
}

/** 格式化日期时间 */
export function formatDateTime(date: string | Date): string {
  return dayjs(date).format('YYYY-MM-DD HH:mm');
}

/** 获取涨跌色class */
export function getChangeColorClass(value: number): string {
  return value >= 0 ? 'rise' : 'fall';
}

/** 格式化净流入 */
export function formatNetFlow(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}亿`;
}
