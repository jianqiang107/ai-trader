import { useMemo } from 'react';
import DataTable from '../../components/common/DataTable';
import SignalTag from '../../components/common/SignalTag';
import { useSignalStore } from '../../stores/useSignalStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { formatPrice } from '../../utils/format';
import {
  deduplicateSummarySignals,
  formatSignedPct,
  getDailyChangePct,
  getSelectionReturnPct,
  getTodayPnlPct,
  pnlClassName,
} from '../../utils/summarySignal';
import type { Signal, SignalTagType } from '../../types';

export default function SummaryTab() {
  const timingSignals = useSignalStore((s) => s.timingSignals);
  const selectStock = useSignalStore((s) => s.selectStock);
  const selectedStock = useSignalStore((s) => s.selectedStock);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const signals = useMemo(() => {
    return deduplicateSummarySignals(Object.values(timingSignals).flat())
      .sort((a, b) => (getDailyChangePct(b) ?? -Infinity) - (getDailyChangePct(a) ?? -Infinity));
  }, [timingSignals]);

  const columns = useMemo(() => [
    { key: 'index', title: '序号', width: 40, render: (_: unknown, __: unknown, i: number) => <span className="text-text-muted">{i + 1}</span> },
    {
      key: 'stock_code',
      title: '代码',
      width: 72,
      sorter: (a: Signal, b: Signal) => a.stock_code.localeCompare(b.stock_code),
      render: (v: unknown) => <span className="font-semibold text-[#f3f600]">{String(v).split('.')[0]}</span>,
    },
    {
      key: 'stock_name',
      title: '名称',
      width: 76,
      sorter: (a: Signal, b: Signal) => a.stock_name.localeCompare(b.stock_name, 'zh-CN'),
      render: (v: unknown) => <span className="font-semibold text-[#f3f600]">{v as string}</span>,
    },
    {
      key: 'mode',
      title: '入选模式',
      width: 72,
      sorter: (a: Signal, b: Signal) => a.mode.localeCompare(b.mode, 'zh-CN'),
      render: (v: unknown) => <SignalTag tag={v as SignalTagType} />,
    },
    {
      key: 'sector_name',
      title: '入选板块',
      width: 94,
      sorter: (a: Signal, b: Signal) => (a.sector_name || '').localeCompare(b.sector_name || '', 'zh-CN'),
      render: (v: unknown) => (
        <span className="block truncate text-blue" title={String(v || '未分类')}>
          {String(v || '未分类')}
        </span>
      ),
    },
    {
      key: 'daily_change_pct',
      title: '涨幅',
      width: 68,
      sorter: (a: Signal, b: Signal) => (getDailyChangePct(a) ?? -Infinity) - (getDailyChangePct(b) ?? -Infinity),
      render: (_: unknown, row: Signal) => {
        const value = getDailyChangePct(row);
        return <span className={`font-semibold ${pnlClassName(value)}`}>{formatSignedPct(value)}</span>;
      },
    },
    {
      key: 'signal_price',
      title: '入选价格',
      width: 76,
      sorter: (a: Signal, b: Signal) => a.signal_price - b.signal_price,
      render: (v: unknown) => <span className="text-text-primary">{formatPrice(v as number)}</span>,
    },
    {
      key: 'selection_return_pct',
      title: '入选涨幅',
      width: 78,
      sorter: (a: Signal, b: Signal) => (getSelectionReturnPct(a) ?? -Infinity) - (getSelectionReturnPct(b) ?? -Infinity),
      render: (_: unknown, row: Signal) => {
        const value = getSelectionReturnPct(row);
        return <span className={pnlClassName(value)}>{formatSignedPct(value)}</span>;
      },
    },
    {
      key: 'today_pnl_pct',
      title: '今日盈亏',
      width: 78,
      sorter: (a: Signal, b: Signal) => (getTodayPnlPct(a) ?? -Infinity) - (getTodayPnlPct(b) ?? -Infinity),
      render: (_: unknown, row: Signal) => {
        const value = getTodayPnlPct(row);
        return <span className={pnlClassName(value)}>{formatSignedPct(value)}</span>;
      },
    },
  ], []);

  return (
    <div className="flex flex-col h-full">
      <div className="h-7 bg-[#141414] border-b border-border flex items-center px-2.5 gap-1.5 shrink-0">
        <div className="w-1.5 h-1.5 rounded-full bg-orange" />
        <span className="text-text-primary text-[11px] font-medium">个股汇总</span>
        <span className="text-text-muted text-[10px]">按当日涨幅排序</span>
        <span className="ml-auto text-text-muted text-[11px]">{signals.length} 只</span>
      </div>
      <div className="flex-1 overflow-hidden">
        {signals.length > 0 ? (
          <DataTable<Signal>
            columns={columns}
            data={signals}
            rowKey="stock_code"
            onRowClick={(row) => selectStock(row.stock_code, row.stock_name)}
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
