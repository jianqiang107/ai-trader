import { useMemo, useState } from 'react';
import DataTable from '../../components/common/DataTable';
import SignalTag from '../../components/common/SignalTag';
import { useSignalStore } from '../../stores/useSignalStore';
import { formatChangePct, formatPrice } from '../../utils/format';
import type { SignalTagType } from '../../types';

interface StockRow {
  code: string;
  name: string;
  sector: string;
  price: number;
  signal_price: number;
  pct: number;
  signal_time: string;
  strength: number;
  [key: string]: unknown;
}

const STOCK_MOCK: StockRow[] = [
  { code: '600160', name: '巨化股份', sector: '氢概念', price: 35.95, signal_price: 33.50, pct: 9.99, signal_time: '09:35', strength: 85 },
  { code: '600276', name: '恒瑞医药', sector: '医药', price: 48.90, signal_price: 45.80, pct: 6.45, signal_time: '09:52', strength: 92 },
  { code: '601899', name: '紫金矿业', sector: '有色金属', price: 16.80, signal_price: 15.60, pct: 7.23, signal_time: '10:05', strength: 88 },
  { code: '002230', name: '科大讯飞', sector: 'AI算力', price: 52.40, signal_price: 48.20, pct: 8.56, signal_time: '10:15', strength: 82 },
  { code: '000725', name: '京东方A', sector: '芯片', price: 4.52, signal_price: 4.28, pct: 5.89, signal_time: '10:28', strength: 80 },
  { code: '600547', name: '山东黄金', sector: '有色金属', price: 28.60, signal_price: 27.50, pct: 4.12, signal_time: '10:35', strength: 76 },
  { code: '600519', name: '贵州茅台', sector: '消费', price: 1680.00, signal_price: 1655.00, pct: 1.56, signal_time: '11:02', strength: 65 },
  { code: '600600', name: '青岛啤酒', sector: '消费', price: 82.10, signal_price: 80.50, pct: 1.89, signal_time: '13:05', strength: 72 },
];

export default function StockTab() {
  const selectStock = useSignalStore((s) => s.selectStock);
  const selectedStock = useSignalStore((s) => s.selectedStock);
  const [data] = useState(STOCK_MOCK);

  const columns = useMemo(() => [
    { key: 'index', title: '序号', width: 40, render: (_: unknown, __: unknown, i: number) => <span className="text-text-muted">{i + 1}</span> },
    { key: 'code', title: '代码', width: 70, render: (v: unknown) => <span className="text-blue">{v as string}</span> },
    { key: 'name', title: '名称', width: 70, render: (v: unknown) => <span className="text-text-primary">{v as string}</span> },
    { key: 'sector', title: '板块', width: 65, render: (v: unknown) => <span className="px-1 py-0.5 rounded text-[10px] bg-fall/10 text-fall border border-fall/30">{v as string}</span> },
    { key: 'price', title: '当前价', width: 55, render: (v: unknown, row: unknown) => <span className={(row as StockRow).pct >= 0 ? 'rise' : 'fall'}>{formatPrice(v as number)}</span> },
    { key: 'signal_price', title: '信号价', width: 55, render: (v: unknown) => <span className="text-orange">{formatPrice(v as number)}</span> },
    { key: 'pct', title: '涨幅', width: 55, sorter: (a: Record<string, unknown>, b: Record<string, unknown>) => (a as StockRow).pct - (b as StockRow).pct, render: (v: unknown) => <span className={(v as number) >= 0 ? 'rise' : 'fall'}>{formatChangePct(v as number)}</span> },
    { key: 'signal_time', title: '信号时间', width: 60, render: (v: unknown) => <span className="text-text-muted">{v as string}</span> },
    { key: 'strength', title: '强度', width: 65, render: (v: unknown) => {
      const val = v as number;
      return (
        <div className="flex items-center gap-1">
          <div className="h-1 rounded" style={{ width: val * 0.5, background: val > 80 ? '#e84040' : '#ff8c00' }} />
          <span className={val > 80 ? 'rise' : 'text-orange'}>{val}</span>
        </div>
      );
    }},
  ], []);

  return (
    <div className="flex flex-col h-full">
      <div className="h-7 bg-[#141414] border-b border-border flex items-center px-2.5 gap-1.5 shrink-0">
        <div className="w-1.5 h-1.5 rounded-full bg-orange" />
        <span className="text-text-primary text-[11px] font-medium">个股模式 · 低吸信号</span>
        <span className="ml-auto text-orange text-[11px]">{data.length} 只</span>
      </div>
      <div className="flex-1 overflow-hidden">
        <DataTable
          columns={columns}
          data={data as unknown as Record<string, unknown>[]}
          rowKey="code"
          onRowClick={(row) => selectStock((row as unknown as StockRow).code, (row as unknown as StockRow).name)}
          selectedRowKey={selectedStock?.code}
        />
      </div>
    </div>
  );
}
