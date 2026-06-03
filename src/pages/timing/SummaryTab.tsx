import { useMemo } from 'react';
import DataTable from '../../components/common/DataTable';
import SignalTag from '../../components/common/SignalTag';
import { useSignalStore } from '../../stores/useSignalStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { formatChangePct, formatPrice } from '../../utils/format';
import type { Signal, SignalTagType } from '../../types';

export default function SummaryTab() {
  const timingSignals = useSignalStore((s) => s.timingSignals);
  const selectStock = useSignalStore((s) => s.selectStock);
  const selectedStock = useSignalStore((s) => s.selectedStock);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // 直接从 store 获取真实数据，不再注入假数据
  const signals = useMemo(() => {
    return Object.values(timingSignals).flat();
  }, [timingSignals]);

  const columns = useMemo(() => [
    { key: 'index', title: '序号', width: 40, render: (_: unknown, __: unknown, i: number) => <span className="text-text-muted">{i + 1}</span> },
    { key: 'stock_code', title: '代码', width: 65, render: (v: unknown) => <span className="text-blue">{v as string}</span> },
    { key: 'stock_name', title: '名称', width: 65, render: (v: unknown) => <span className="text-text-primary">{v as string}</span> },
    { key: 'mode', title: '入选模式', width: 65, render: (v: unknown) => <SignalTag tag={v as SignalTagType} /> },
    { key: 'confidence', title: '置信度', width: 50, render: (v: unknown) => <span className="text-orange">{v as number}%</span> },
    { key: 'signal_price', title: '入选价', width: 55, render: (v: unknown) => formatPrice(v as number) },
    { key: 'floating_pnl', title: '浮动盈亏', width: 65, render: (v: unknown) => {
      const val = v as number | null;
      if (val === null) return <span className="text-text-muted">-</span>;
      return <span className={val >= 0 ? 'rise' : 'fall'}>{formatChangePct(val)}</span>;
    }},
    { key: 'alert_status', title: '预警', width: 45, render: (v: unknown) => {
      const status = v as string;
      if (status === 'take_profit') return <span className="rise text-[10px]">止盈</span>;
      if (status === 'stop_loss') return <span className="fall text-[10px]">止损</span>;
      if (status === 'warning') return <span className="text-orange text-[10px]">预警</span>;
      return <span className="text-text-muted text-[10px]">正常</span>;
    }},
  ], []);

  return (
    <div className="flex flex-col h-full">
      <div className="h-7 bg-[#141414] border-b border-border flex items-center px-2.5 gap-1.5 shrink-0">
        <div className="w-1.5 h-1.5 rounded-full bg-orange" />
        <span className="text-text-primary text-[11px] font-medium">个股汇总</span>
        <span className="ml-auto text-text-muted text-[11px]">{signals.length} 只</span>
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
          <div className="flex flex-col items-center justify-center h-full text-text-muted text-sm gap-2">
            <div className="text-3xl">📭</div>
            {!isAuthenticated ? (
              <>
                <div>请登录后查看实时信号</div>
                <div className="text-text-muted text-xs">登录后即可获取个股入选汇总数据</div>
              </>
            ) : (
              <>
                <div>暂无信号数据</div>
                <div className="text-text-muted text-xs">当前时段没有符合条件的个股入选</div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
