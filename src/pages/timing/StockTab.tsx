import { useMemo } from 'react';
import DataTable from '../../components/common/DataTable';
import SignalTag from '../../components/common/SignalTag';
import { useSignalStore } from '../../stores/useSignalStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { formatChangePct, formatDateTime, formatPrice } from '../../utils/format';
import type { Signal, SignalTagType } from '../../types';

export default function StockTab() {
  const timingSignals = useSignalStore((s) => s.timingSignals);
  const selectStock = useSignalStore((s) => s.selectStock);
  const selectedStock = useSignalStore((s) => s.selectedStock);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const signals = useMemo(() => {
    const combined = [
      ...(timingSignals['个股'] || []),
      ...(timingSignals['低吸'] || []),
      ...(timingSignals['均值回归'] || []),
    ];
    return Array.from(
      new Map(combined.map((signal) => [signal.stock_code, signal])).values()
    );
  }, [timingSignals]);

  const columns = useMemo(() => [
    { key: 'index', title: '序号', width: 40, render: (_: unknown, __: unknown, i: number) => <span className="text-text-muted">{i + 1}</span> },
    { key: 'stock_code', title: '代码', width: 70, render: (v: unknown) => <span className="text-blue">{v as string}</span> },
    { key: 'stock_name', title: '名称', width: 70, render: (v: unknown) => <span className="text-text-primary">{v as string}</span> },
    { key: 'mode', title: '入选模式', width: 65, render: (v: unknown) => <SignalTag tag={v as SignalTagType} /> },
    { key: 'current_price', title: '当前价', width: 60, render: (v: unknown, row: unknown) => {
      const signal = row as Signal;
      const price = signal.current_price ?? signal.signal_price;
      const pnl = signal.floating_pnl ?? 0;
      return <span className={pnl >= 0 ? 'rise' : 'fall'}>{formatPrice(price)}</span>;
    }},
    { key: 'signal_price', title: '信号价', width: 60, render: (v: unknown) => <span className="text-orange">{formatPrice(v as number)}</span> },
    { key: 'reasons', title: '入选原因', width: 150, align: 'left' as const, render: (v: unknown) => {
      const reasons = (v as string[] | undefined) || [];
      const text = reasons.join('；');
      return <span className="block truncate text-text-secondary" title={text}>{reasons[0] || '-'}</span>;
    }},
    { key: 'floating_pnl', title: '浮动盈亏', width: 70, render: (v: unknown) => {
      const val = v as number | null;
      if (val === null || val === undefined) return <span className="text-text-muted">-</span>;
      return <span className={val >= 0 ? 'rise' : 'fall'}>{formatChangePct(val)}</span>;
    }},
    { key: 'signal_time', title: '信号时间', width: 105, render: (v: unknown) => <span className="text-text-muted">{formatDateTime(v as string)}</span> },
    { key: 'confidence', title: '强度', width: 65, render: (v: unknown) => {
      const val = Number(v) || 0;
      return (
        <div className="flex items-center gap-1">
          <div className="h-1 rounded" style={{ width: Math.max(12, val * 0.45), background: val > 80 ? '#e84040' : '#ff8c00' }} />
          <span className={val > 80 ? 'rise' : 'text-orange'}>{val}</span>
        </div>
      );
    }},
  ], []);

  return (
    <div className="flex flex-col h-full">
      <div className="h-7 bg-[#141414] border-b border-border flex items-center px-2.5 gap-1.5 shrink-0">
        <div className="w-1.5 h-1.5 rounded-full bg-orange" />
        <span className="text-text-primary text-[11px] font-medium">个股模式 · 低吸/均值回归</span>
        <span className="text-text-muted text-[10px]">从全市场筛选个股机会</span>
        <span className="ml-auto text-orange text-[11px]">{signals.length} 只</span>
      </div>
      <div className="flex-1 overflow-hidden">
        {signals.length > 0 ? (
          <DataTable
            columns={columns}
            data={signals as unknown as Record<string, unknown>[]}
            rowKey="id"
            onRowClick={(row) => selectStock((row as unknown as Signal).stock_code, (row as unknown as Signal).stock_name)}
            selectedRowKey={selectedStock?.code}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-text-muted text-sm gap-2 px-4 text-center">
            <div className="text-3xl">📭</div>
            {!isAuthenticated ? (
              <>
                <div>请登录后查看个股策略信号</div>
                <div className="text-xs">登录后从全市场按低吸/均值回归策略筛选</div>
              </>
            ) : (
              <>
                <div>暂无符合个股策略条件的入选股</div>
                <div className="text-xs">系统不会用固定演示股票补位；有真实信号时会在这里更新</div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
