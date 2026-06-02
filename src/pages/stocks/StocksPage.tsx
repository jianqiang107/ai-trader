import { useState, useEffect, useMemo } from 'react';
import DataTable from '../../components/common/DataTable';
import SignalTag from '../../components/common/SignalTag';
import EmptyState from '../../components/common/EmptyState';
import type { Stock, SignalTagType } from '../../types';
import { formatPrice, formatChangePct, formatVolume } from '../../utils/format';
import { STRATEGY_TYPES } from '../../utils/constants';
import api from '../../services/api';

export default function StocksPage() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [activeMode, setActiveMode] = useState<SignalTagType | 'all'>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchStocks = async () => {
      setLoading(true);
      try {
        const params: Record<string, string> = {};
        if (activeMode !== 'all') params.mode = activeMode;
        const data: unknown = await api.get('/market/stocks', { params });
        const StockData = data as { items: Stock[]; total: number };
        setStocks(StockData.items || []);
      } catch (e) {
        console.error('Failed to fetch stocks:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchStocks();
  }, [activeMode]);

  const filteredStocks = useMemo(() => {
    if (!search) return stocks;
    const q = search.toLowerCase();
    return stocks.filter(
      (s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)
    );
  }, [stocks, search]);

  const columns = [
    {
      key: 'name',
      title: '股票名称',
      width: 100,
      align: 'left' as const,
      render: (_: unknown, row: Stock) => (
        <div className="flex flex-col">
          <span className="text-text-primary font-medium text-[11px]">{row.name}</span>
          <span className="text-text-muted text-[10px]">{row.code}</span>
        </div>
      ),
    },
    {
      key: 'price',
      title: '最新价',
      width: 70,
      align: 'right' as const,
      sorter: (a: Stock, b: Stock) => a.price - b.price,
      render: (_: unknown, row: Stock) => (
        <span className="text-text-primary">{formatPrice(row.price)}</span>
      ),
    },
    {
      key: 'change_pct',
      title: '涨跌幅',
      width: 70,
      align: 'right' as const,
      sorter: (a: Stock, b: Stock) => a.change_pct - b.change_pct,
      render: (_: unknown, row: Stock) => (
        <span className={row.change_pct >= 0 ? 'rise' : 'fall'}>
          {formatChangePct(row.change_pct)}
        </span>
      ),
    },
    {
      key: 'volume',
      title: '成交量',
      width: 70,
      align: 'right' as const,
      sorter: (a: Stock, b: Stock) => a.volume - b.volume,
      render: (_: unknown, row: Stock) => (
        <span className="text-text-secondary">{formatVolume(row.volume)}</span>
      ),
    },
    {
      key: 'turnover_rate',
      title: '换手率',
      width: 60,
      align: 'right' as const,
      sorter: (a: Stock, b: Stock) => a.turnover_rate - b.turnover_rate,
      render: (_: unknown, row: Stock) => (
        <span className="text-text-secondary">{row.turnover_rate.toFixed(2)}%</span>
      ),
    },
    {
      key: 'timing_score',
      title: '择时得分',
      width: 70,
      align: 'center' as const,
      sorter: (a: Stock, b: Stock) => a.timing_score - b.timing_score,
      render: (_: unknown, row: Stock) => {
        const score = row.timing_score;
        const color = score >= 80 ? 'rise' : score >= 50 ? 'text-orange' : 'fall';
        return (
          <div className="flex items-center justify-center gap-1">
            <div className="w-8 h-1.5 bg-bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${score}%`,
                  background: score >= 80 ? '#e84040' : score >= 50 ? '#ff8c00' : '#00c0a0',
                }}
              />
            </div>
            <span className={`text-[10px] font-medium ${color}`}>{score}</span>
          </div>
        );
      },
    },
    {
      key: 'signal_tags',
      title: '信号标签',
      align: 'left' as const,
      render: (_: unknown, row: Stock) => (
        <div className="flex items-center gap-1">
          {row.signal_tags.map((tag) => (
            <SignalTag key={tag} tag={tag} />
          ))}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 筛选栏 */}
      <div className="h-9 bg-[#141414] border-b border-border flex items-center px-3 gap-3 shrink-0">
        {/* 信号类型筛选 */}
        <div className="flex items-center gap-0.5">
          <button
            className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
              activeMode === 'all'
                ? 'bg-orange/15 text-orange border border-orange/30'
                : 'text-text-muted hover:text-text-secondary'
            }`}
            onClick={() => setActiveMode('all')}
          >
            全部
          </button>
          {STRATEGY_TYPES.map((type) => (
            <button
              key={type}
              className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                activeMode === type
                  ? 'bg-orange/15 text-orange border border-orange/30'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
              onClick={() => setActiveMode(type)}
            >
              {type}
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-border" />

        {/* 搜索 */}
        <input
          type="text"
          placeholder="🔍 搜索股票..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-bg-panel border border-border-light text-text-primary px-2 py-0.5 rounded text-xs w-[120px]"
        />

        <span className="flex-1" />
        <span className="text-text-muted text-[11px]">{filteredStocks.length} 只股票</span>
      </div>

      {/* 表格 */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full text-text-muted text-sm">
            加载中...
          </div>
        ) : filteredStocks.length > 0 ? (
          <DataTable
            columns={columns}
            data={filteredStocks}
            rowKey="code"
            onRowClick={(row) => {
              /* 可扩展：点击股票打开详情 */
            }}
          />
        ) : (
          <EmptyState message="暂无股票数据" description="未找到匹配的股票" />
        )}
      </div>
    </div>
  );
}
