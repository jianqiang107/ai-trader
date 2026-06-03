import { useMemo, useState } from 'react';
import DataTable from '../../components/common/DataTable';
import { useSignalStore } from '../../stores/useSignalStore';
import { formatChangePct, formatPrice } from '../../utils/format';

interface EtfRow {
  code: string;
  name: string;
  pct: number;
  price: number;
  vol: number;
  liangbi: number;
  flow: number;
  [key: string]: unknown;
}

const ETF_MOCK: EtfRow[] = [
  { code: '159919', name: '沪深300ETF', pct: 1.85, price: 4.125, vol: 4560, liangbi: 1.23, flow: 2.45 },
  { code: '510050', name: '上证50ETF', pct: 1.42, price: 2.856, vol: 3280, liangbi: 0.98, flow: 1.56 },
  { code: '159915', name: '创业板ETF', pct: 3.21, price: 2.345, vol: 5230, liangbi: 1.85, flow: 3.12 },
  { code: '512880', name: '证券ETF', pct: -0.56, price: 1.234, vol: 2890, liangbi: 0.72, flow: -1.23 },
  { code: '515000', name: '科技ETF', pct: 2.68, price: 1.567, vol: 4120, liangbi: 1.45, flow: 2.89 },
  { code: '516160', name: '新能源ETF', pct: -1.23, price: 0.892, vol: 3450, liangbi: 0.88, flow: -0.56 },
  { code: '512170', name: '医疗ETF', pct: 0.78, price: 0.654, vol: 1980, liangbi: 0.65, flow: 0.34 },
  { code: '159928', name: '消费ETF', pct: -0.45, price: 1.123, vol: 2340, liangbi: 0.92, flow: -0.89 },
  { code: '512690', name: '酒ETF', pct: 1.56, price: 0.987, vol: 2870, liangbi: 1.12, flow: 1.23 },
  { code: '512660', name: '军工ETF', pct: -2.34, price: 0.765, vol: 1560, liangbi: 0.56, flow: -2.45 },
  { code: '516110', name: '半导体ETF', pct: 4.12, price: 2.156, vol: 5670, liangbi: 2.15, flow: 4.56 },
  { code: '159869', name: '游戏ETF', pct: 1.89, price: 0.823, vol: 1890, liangbi: 0.78, flow: 0.67 },
];

export default function EtfTab() {
  const selectStock = useSignalStore((s) => s.selectStock);
  const selectedStock = useSignalStore((s) => s.selectedStock);
  const [data] = useState(ETF_MOCK);

  const columns = useMemo(() => [
    { key: 'index', title: '序号', width: 40, render: (_: unknown, __: unknown, i: number) => <span className="text-text-muted">{i + 1}</span> },
    { key: 'code', title: '代码', width: 70, render: (v: unknown) => <span className="text-blue">{v as string}</span> },
    { key: 'name', title: '名称', width: 80, render: (v: unknown) => <span className="text-text-primary">{v as string}</span> },
    { key: 'pct', title: '涨跌幅', width: 65, sorter: (a: Record<string, unknown>, b: Record<string, unknown>) => (a as EtfRow).pct - (b as EtfRow).pct, render: (v: unknown) => <span className={(v as number) >= 0 ? 'rise' : 'fall'}>{formatChangePct(v as number)}</span> },
    { key: 'price', title: '现价', width: 55, render: (v: unknown) => formatPrice(v as number, 3) },
    { key: 'vol', title: '成交量(手)', width: 70, render: (v: unknown) => <span className="text-text-secondary">{(v as number).toLocaleString()}</span> },
    { key: 'liangbi', title: '量比', width: 45, render: (v: unknown) => <span className={(v as number) > 1 ? 'rise' : 'fall'}>{(v as number).toFixed(2)}</span> },
    { key: 'flow', title: '资金流向', width: 65, render: (v: unknown) => <span className={(v as number) >= 0 ? 'rise' : 'fall'}>{(v as number) >= 0 ? '+' : ''}{(v as number).toFixed(2)}亿</span> },
  ], []);

  return (
    <div className="flex flex-col h-full">
      <div className="h-7 bg-[#141414] border-b border-border flex items-center px-2.5 gap-1.5 shrink-0">
        <div className="w-1.5 h-1.5 rounded-full bg-blue" />
        <span className="text-text-primary text-[11px] font-medium">ETF模式 · 实时监控</span>
        <span className="ml-auto text-blue text-[11px]">{data.length} 只</span>
      </div>
      <div className="flex-1 overflow-hidden">
        <DataTable
          columns={columns}
          data={data as unknown as Record<string, unknown>[]}
          rowKey="code"
          onRowClick={(row) => selectStock((row as unknown as EtfRow).code, (row as unknown as EtfRow).name)}
          selectedRowKey={selectedStock?.code}
        />
      </div>
    </div>
  );
}
