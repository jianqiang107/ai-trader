import type { Signal } from '../types';

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function getDailyChangePct(signal: Signal): number | null {
  return finiteNumber(signal.score_breakdown?.['涨跌幅']);
}

export function getSelectionReturnPct(signal: Signal): number | null {
  const floatingPnl = finiteNumber(signal.floating_pnl);
  if (floatingPnl !== null) return floatingPnl;

  const entryPrice = finiteNumber(signal.signal_price);
  const currentPrice = finiteNumber(signal.current_price);
  if (entryPrice === null || entryPrice <= 0 || currentPrice === null) return null;

  return ((currentPrice - entryPrice) / entryPrice) * 100;
}

export function getTodayPnlPct(signal: Signal): number | null {
  return finiteNumber(signal.actual_pnl);
}

export function formatSignedPct(value: number | null): string {
  if (value === null) return '-';
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(2)}%`;
}

export function pnlClassName(value: number | null): string {
  if (value === null || value === 0) return 'text-text-muted';
  return value > 0 ? 'rise' : 'fall';
}

export function deduplicateSummarySignals(signals: Signal[]): Signal[] {
  const strongestByCode = new Map<string, Signal>();

  for (const signal of signals) {
    const current = strongestByCode.get(signal.stock_code);
    if (!current || signal.confidence > current.confidence) {
      strongestByCode.set(signal.stock_code, signal);
    }
  }

  return Array.from(strongestByCode.values());
}
