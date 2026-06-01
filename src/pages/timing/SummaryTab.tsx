import { useEffect, useState } from 'react';
import DataTable from '../../components/common/DataTable';
import SignalTag from '../../components/common/SignalTag';
import { useSignalStore } from '../../stores/useSignalStore';
import { formatChangePct, formatPrice } from '../../utils/format';
import type { Signal, SignalTagType } from '../../types';

export default function SummaryTab() {
  const timingSignals = useSignalStore((s) => s.timingSignals);
  const selectStock = useSignalStore((s) => s.selectStock);
  const selectedStock = useSignalStore((s) => s.selectedStock);
  const [signals, setSignals] = useState<Signal[]>([]);

  useEffect(() => {
    // Collect all signals across modes
    const allSignals = Object.values(timingSignals).flat();
    if (allSignals.length === 0) {
      // Fallback mock
      setSignals([
        { id: 's1', stock_code: '600160', stock_name: '巨化股份', signal_type: 'BUY', strategy_id: 's1', signal_time: '2026-06-01T09:35:00+08:00', signal_price: 33.50, mode: '低吸', confidence: 85, status: 'executed', stop_loss_price: 31.20, take_profit_price: 36.80, alert_status: 'safe', actual_pnl: 7.31, current_price: 35.95, floating_pnl: 7.31 },
        { id: 's2', stock_code: '002594', stock_name: '比亚迪', signal_type: 'BUY', strategy_id: 's2', signal_time: '2026-06-01T09:42:00+08:00', signal_price: 248.50, mode: '趋势', confidence: 78, status: 'executed', stop_loss_price: 240.00, take_profit_price: 265.00, alert_status: 'safe', actual_pnl: 3.34, current_price: 256.80, floating_pnl: 3.34 },
        { id: 's3', stock_code: '600276', stock_name: '恒瑞医药', signal_type: 'BUY', strategy_id: 's3', signal_time: '2026-05-30T10:15:00+08:00', signal_price: 45.80, mode: '突破', confidence: 92, status: 'executed', stop_loss_price: 43.50, take_profit_price: 52.00, alert_status: 'take_profit', actual_pnl: 6.77, current_price: 48.90, floating_pnl: 6.77 },
        { id: 's4', stock_code: '601899', stock_name: '紫金矿业', signal_type: 'BUY', strategy_id: 's4', signal_time: '2026-05-29T09:45:00+08:00', signal_price: 15.60, mode: '低吸', confidence: 88, status: 'executed', stop_loss_price: 14.80, take_profit_price: 17.50, alert_status: 'safe', actual_pnl: 7.69, current_price: 16.80, floating_pnl: 7.69 },
        { id: 's5', stock_code: '002230', stock_name: '科大讯飞', signal_type: 'BUY', strategy_id: 's5', signal_time: '2026-05-28T10:00:00+08:00', signal_price: 48.20, mode: '趋势', confidence: 82, status: 'executed', stop_loss_price: 46.00, take_profit_price: 55.00, alert_status: 'warning', actual_pnl: 8.71, current_price: 52.40, floating_pnl: 8.71 },
        { id: 's6', stock_code: '300750', stock_name: '宁德时代', signal_type: 'BUY', strategy_id: 's6', signal_time: '2026-05-27T09:50:00+08:00', signal_price: 192.00, mode: '突破', confidence: 75, status: 'executed', stop_loss_price: 186.00, take_profit_price: 205.00, alert_status: 'safe', actual_pnl: 3.39, current_price: 198.50, floating_pnl: 3.39 },
        { id: 's7', stock_code: '000725', stock_name: '京东方A', signal_type: 'BUY', strategy_id: 's7', signal_time: '2026-05-26T10:30:00+08:00', signal_price: 4.28, mode: '低吸', confidence: 80, status: 'pending', stop_loss_price: 4.05, take_profit_price: 4.85, alert_status: 'safe', actual_pnl: null, current_price: 4.52, floating_pnl: 5.61 },
        { id: 's8', stock_code: '600547', stock_name: '山东黄金', signal_type: 'BUY', strategy_id: 's8', signal_time: '2026-05-25T09:55:00+08:00', signal_price: 27.50, mode: '趋势', confidence: 76, status: 'executed', stop_loss_price: 26.20, take_profit_price: 30.00, alert_status: 'safe', actual_pnl: 4.00, current_price: 28.60, floating_pnl: 4.00 },
        { id: 's9', stock_code: '002415', stock_name: '海康威视', signal_type: 'BUY', strategy_id: 's9', signal_time: '2026-05-24T10:20:00+08:00', signal_price: 31.20, mode: '均值回归', confidence: 70, status: 'executed', stop_loss_price: 29.80, take_profit_price: 34.00, alert_status: 'safe', actual_pnl: 4.17, current_price: 32.50, floating_pnl: 4.17 },
        { id: 's10', stock_code: '600690', stock_name: '海尔智家', signal_type: 'BUY', strategy_id: 's10', signal_time: '2026-05-19T10:10:00+08:00', signal_price: 27.30, mode: '趋势', confidence: 74, status: 'executed', stop_loss_price: 26.00, take_profit_price: 30.00, alert_status: 'safe', actual_pnl: 3.66, current_price: 28.30, floating_pnl: 3.66 },
        { id: 's11', stock_code: '000333', stock_name: '美的集团', signal_type: 'BUY', strategy_id: 's11', signal_time: '2026-05-18T09:48:00+08:00', signal_price: 60.80, mode: '趋势', confidence: 77, status: 'executed', stop_loss_price: 58.50, take_profit_price: 66.00, alert_status: 'safe', actual_pnl: 2.48, current_price: 62.30, floating_pnl: 2.48 },
        { id: 's12', stock_code: '605020', stock_name: '永和股份', signal_type: 'BUY', strategy_id: 's12', signal_time: '2026-05-17T10:25:00+08:00', signal_price: 21.20, mode: '突破', confidence: 83, status: 'executed', stop_loss_price: 20.00, take_profit_price: 24.00, alert_status: 'stop_loss', actual_pnl: 5.19, current_price: 22.30, floating_pnl: 5.19 },
      ]);
    } else {
      setSignals(allSignals);
    }
  }, [timingSignals]);

  const columns = [
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
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="h-7 bg-[#141414] border-b border-border flex items-center px-2.5 gap-1.5 shrink-0">
        <div className="w-1.5 h-1.5 rounded-full bg-orange" />
        <span className="text-text-primary text-[11px] font-medium">个股汇总</span>
        <span className="ml-auto text-text-muted text-[11px]">{signals.length} 只</span>
      </div>
      <div className="flex-1 overflow-hidden">
        <DataTable
          columns={columns}
          data={signals as unknown as Record<string, unknown>[]}
          rowKey="id"
          onRowClick={(row) => selectStock((row as unknown as Signal).stock_code, (row as unknown as Signal).stock_name)}
          selectedRowKey={selectedStock?.code}
        />
      </div>
    </div>
  );
}
