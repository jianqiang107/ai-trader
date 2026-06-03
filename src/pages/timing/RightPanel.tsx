import { useEffect, useState } from 'react';
import { useSignalStore } from '../../stores/useSignalStore';
import KlineChart from '../../components/charts/KlineChart';
import FenshiChart from '../../components/charts/FenshiChart';
import VolfsChart from '../../components/charts/VolfsChart';
import type { FenshiData, VolfsData } from '../../types';
import { marketService } from '../../services/marketService';
import { formatPrice, formatChangePct } from '../../utils/format';

type ChartTab = 'fenshi' | 'liangjiao' | 'macd' | 'kdj';

const CHART_TABS: { key: ChartTab; label: string }[] = [
  { key: 'fenshi', label: '分时' },
  { key: 'liangjiao', label: '量比' },
  { key: 'macd', label: 'MACD' },
  { key: 'kdj', label: 'KDJ' },
];

export default function RightPanel() {
  const selectedStock = useSignalStore((s) => s.selectedStock);
  const selectedChartTab = useSignalStore((s) => s.selectedChartTab);
  const setSelectedChartTab = useSignalStore((s) => s.setSelectedChartTab);

  const [fenshiData, setFenshiData] = useState<FenshiData[]>([]);
  const [volfsData, setVolfsData] = useState<VolfsData[]>([]);
  const [stockPrice, setStockPrice] = useState(0);
  const [stockPct, setStockPct] = useState(0);

  useEffect(() => {
    if (!selectedStock) return;

    // Generate mock data for the selected stock
    marketService.getFenshi(selectedStock.code).then((data) => {
      setFenshiData(data);
      if (data.length > 0) {
        const lastPrice = data[data.length - 1].price;
        setStockPrice(lastPrice);
        if (data.length >= 2) {
          const firstPrice = data[0].price;
          const changePct = ((lastPrice - firstPrice) / firstPrice) * 100;
          setStockPct(+changePct.toFixed(2));
        } else {
          setStockPct(0);
        }
      }
    });

    marketService.getVolfs(selectedStock.code).then(setVolfsData);
  }, [selectedStock?.code]);

  if (!selectedStock) {
    return (
      <div className="w-[340px] min-w-[340px] bg-bg-secondary flex flex-col items-center justify-center text-text-muted text-sm">
        <div className="text-2xl mb-2">📊</div>
        <div>请选择股票查看详情</div>
      </div>
    );
  }

  const isRise = stockPct >= 0;

  return (
    <div className="w-[340px] min-w-[340px] bg-bg-secondary flex flex-col overflow-hidden">
      {/* 股票信息头 */}
      <div className="h-7 bg-[#141414] border-b border-border flex items-center px-2.5 gap-1.5 shrink-0">
        <span className="text-xs font-semibold text-text-primary">{selectedStock.name}</span>
        <span className="text-text-muted text-[11px]">{selectedStock.code}</span>
        <span className="flex-1" />
        <span className={`text-sm font-bold ${isRise ? 'rise' : 'fall'}`}>
          {formatPrice(stockPrice)}
        </span>
        <span className={`text-[11px] ${isRise ? 'rise' : 'fall'}`}>
          {formatChangePct(stockPct)}
        </span>
      </div>

      {/* 图表Tab */}
      <div className="h-[26px] bg-[#141414] border-b border-border flex items-center px-2 gap-0.5 shrink-0">
        {CHART_TABS.map((tab) => (
          <div
            key={tab.key}
            className={`px-2 py-0.5 cursor-pointer text-[11px] rounded transition-all ${
              selectedChartTab === tab.key
                ? 'text-white bg-blue'
                : 'text-text-muted hover:text-text-secondary'
            }`}
            onClick={() => setSelectedChartTab(tab.key)}
          >
            {tab.label}
          </div>
        ))}
      </div>

      {/* 分时图 */}
      <div className="shrink-0" style={{ height: 140 }}>
        <FenshiChart data={fenshiData} height={140} />
      </div>

      {/* VOLFS量能 */}
      <div className="h-7 bg-[#141414] border-b border-border flex items-center px-2.5 gap-1.5 shrink-0">
        <div className="w-1.5 h-1.5 rounded-full bg-[#ffd700]" />
        <span className="text-text-primary text-[11px] font-medium">VOLFS量能</span>
      </div>
      <div className="shrink-0" style={{ height: 100 }}>
        <VolfsChart data={volfsData} height={100} />
      </div>

      {/* 日K线图 */}
      <div className="h-7 bg-[#141414] border-b border-border flex items-center px-2.5 gap-1.5 shrink-0">
        <div className="w-1.5 h-1.5 rounded-full bg-orange" />
        <span className="text-text-primary text-[11px] font-medium">日K线图</span>
      </div>
      <div className="flex-1 min-h-[80px]">
        <KlineChart code={selectedStock.code} height={200} showVolume={false} showMA={true} />
      </div>
    </div>
  );
}
