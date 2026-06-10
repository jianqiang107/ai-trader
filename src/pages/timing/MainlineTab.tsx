import { useMemo } from 'react';
import DataTable from '../../components/common/DataTable';
import SignalTag from '../../components/common/SignalTag';
import { useSignalStore } from '../../stores/useSignalStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { formatChangePct, formatPrice } from '../../utils/format';
import type { Signal, SignalTagType } from '../../types';

export default function MainlineTab() {
  const timingSignals = useSignalStore((s) => s.timingSignals);
  const selectStock = useSignalStore((s) => s.selectStock);
  const selectedStock = useSignalStore((s) => s.selectedStock);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const signals = useMemo(() => {
    return timingSignals['主线'] || [];
  }, [timingSignals]);

  const columns = useMemo(() => [
    { key: 'index', title: '序号', width: 40, render: (_: unknown, __: unknown, i: number) => <span className="text-text-muted">{i + 1}</span> },
    { key: 'stock_code', title: '代码', width: 70, render: (v: unknown) => <span className="text-blue">{v as string}</span> },
    { key: 'stock_name', title: '名称', width: 70, render: (v: unknown) => <span className="text-text-primary">{v as string}</span> },
    { key: 'mode', title: '入选模式', width: 65, render: (v: unknown) => <SignalTag tag={v as SignalTagType} /> },
    { key: 'market_rank', title: '全市排名', width: 58, render: (v: unknown) => <span className="text-text-secondary">{v ? `#${v as number}` : '-'}</span> },
    { key: 'secondary_modes', title: '辅助信号', width: 95, render: (v: unknown) => {
      const modes = (v as SignalTagType[] | undefined) || [];
      return <span className="block truncate text-text-muted" title={modes.join('、')}>{modes.join('、') || '-'}</span>;
    }},
    { key: 'signal_price', title: '入选价', width: 60, render: (v: unknown) => formatPrice(v as number) },
    { key: 'confidence', title: '置信度', width: 50, render: (v: unknown) => <span className="text-orange">{v as number}%</span> },
    { key: 'reasons', title: '入选原因', width: 150, align: 'left' as const, render: (v: unknown) => {
      const reasons = (v as string[] | undefined) || [];
      const text = reasons.join('；');
      return <span className="block truncate text-text-secondary" title={text}>{reasons[0] || '-'}</span>;
    }},
    { key: 'floating_pnl', title: '浮动盈亏', width: 70, render: (v: unknown) => {
      const val = v as number | null;
      if (val === null) return <span className="text-text-muted">-</span>;
      return <span className={val >= 0 ? 'rise' : 'fall'}>{formatChangePct(val)}</span>;
    }},
  ], []);

  return (
    <div className="flex flex-col h-full">
      <div className="h-7 bg-[#141414] border-b border-border flex items-center px-2.5 gap-1.5 shrink-0">
        <div className="w-1.5 h-1.5 rounded-full bg-orange" />
        <span className="text-text-primary text-[11px] font-medium">主线模式 · 今日入选</span>
        <span className="text-text-muted text-[10px]">全市场四策略自动筛选</span>
        <span className="ml-auto text-fall text-[11px]">{signals.length} 只</span>
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
                <div>请登录后查看主线策略信号</div>
                <div className="text-xs">登录后由系统按低吸、趋势、突破、均值回归自动推荐</div>
              </>
            ) : (
              <>
                <div>今日暂无符合主线策略条件的入选股</div>
                <div className="text-xs">系统不会用演示数据补位；有真实信号时会在这里展示</div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
