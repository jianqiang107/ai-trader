import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DataTable from '../../components/common/DataTable';
import EmptyState from '../../components/common/EmptyState';
import type { WatchlistItem } from '../../types';
import { useWatchlistStore } from '../../stores/useWatchlistStore';
import { formatPrice, formatChangePct, formatVolume, formatAmount, getChangeColorClass } from '../../utils/format';

const SORT_OPTIONS = [
  { value: 'change_pct', label: '涨跌幅' },
  { value: 'price', label: '价格' },
  { value: 'volume', label: '成交量' },
  { value: 'amplitude', label: '振幅' },
];

export default function WatchlistPage() {
  const stocks = useWatchlistStore((s) => s.stocks);
  const fetchWatchlist = useWatchlistStore((s) => s.fetchWatchlist);
  const addToWatchlist = useWatchlistStore((s) => s.addToWatchlist);
  const removeFromWatchlist = useWatchlistStore((s) => s.removeFromWatchlist);
  const sortBy = useWatchlistStore((s) => s.sortBy);
  const setSortBy = useWatchlistStore((s) => s.setSortBy);

  const [search, setSearch] = useState('');
  const [addCode, setAddCode] = useState('');
  const [showAddInput, setShowAddInput] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchWatchlist();
  }, [fetchWatchlist]);

  const filteredStocks = useMemo(() => {
    let result = stocks;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)
      );
    }
    return result;
  }, [stocks, search]);

  const handleAdd = async () => {
    if (!addCode.trim()) return;
    try {
      await addToWatchlist(addCode.trim());
      setMessage(`${addCode.trim()} 已加入自选。`);
      setAddCode('');
      setShowAddInput(false);
    } catch {
      setMessage('添加自选失败，请先确认已登录或稍后重试。');
    }
  };

  const handleRemove = async (code: string) => {
    try {
      await removeFromWatchlist(code);
      setMessage(`${code} 已从自选移除。`);
    } catch {
      setMessage('删除自选失败，请稍后重试。');
    }
  };

  /** 计算浮动盈亏（基于涨跌幅的模拟值） */
  const calcFloatingPnl = (item: WatchlistItem): number => {
    return +(item.price * item.change_pct / 100).toFixed(2);
  };

  const columns = [
    {
      key: 'name',
      title: '股票名称',
      width: 110,
      align: 'left' as const,
      render: (_: unknown, row: WatchlistItem) => (
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
      sorter: (a: WatchlistItem, b: WatchlistItem) => a.price - b.price,
      render: (_: unknown, row: WatchlistItem) => (
        <span className={`font-medium ${getChangeColorClass(row.change_pct)}`}>
          {formatPrice(row.price)}
        </span>
      ),
    },
    {
      key: 'change_pct',
      title: '涨跌幅',
      width: 70,
      align: 'right' as const,
      sorter: (a: WatchlistItem, b: WatchlistItem) => a.change_pct - b.change_pct,
      render: (_: unknown, row: WatchlistItem) => (
        <span className={getChangeColorClass(row.change_pct)}>
          {formatChangePct(row.change_pct)}
        </span>
      ),
    },
    {
      key: 'change_amount',
      title: '涨跌额',
      width: 65,
      align: 'right' as const,
      render: (_: unknown, row: WatchlistItem) => (
        <span className={getChangeColorClass(row.change_amount)}>
          {row.change_amount >= 0 ? '+' : ''}{row.change_amount.toFixed(2)}
        </span>
      ),
    },
    {
      key: 'volume',
      title: '成交量',
      width: 70,
      align: 'right' as const,
      sorter: (a: WatchlistItem, b: WatchlistItem) => a.volume - b.volume,
      render: (_: unknown, row: WatchlistItem) => (
        <span className="text-text-secondary">{formatVolume(row.volume)}</span>
      ),
    },
    {
      key: 'amplitude',
      title: '振幅',
      width: 55,
      align: 'right' as const,
      sorter: (a: WatchlistItem, b: WatchlistItem) => a.amplitude - b.amplitude,
      render: (_: unknown, row: WatchlistItem) => (
        <span className="text-text-secondary">{row.amplitude.toFixed(2)}%</span>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 50,
      align: 'center' as const,
      render: (_: unknown, row: WatchlistItem) => (
        <button
          className="text-text-muted hover:text-rise text-[10px] transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            handleRemove(row.code);
          }}
        >
          删除
        </button>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 筛选栏 */}
      <div className="h-9 bg-[#141414] border-b border-border flex items-center px-3 gap-3 shrink-0">
        {/* 排序 */}
        <div className="flex items-center gap-0.5">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                sortBy === opt.value
                  ? 'bg-blue/15 text-blue border border-blue/30'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
              onClick={() => setSortBy(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-border" />

        {/* 搜索 */}
        <input
          type="text"
          placeholder="🔍 搜索自选..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-bg-panel border border-border-light text-text-primary px-2 py-0.5 rounded text-xs w-[120px]"
        />

        <span className="flex-1" />
        {message && (
          <span className="text-orange text-[11px] max-w-[240px] truncate">{message}</span>
        )}

        {/* 添加自选 */}
        {showAddInput ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              placeholder="输入股票代码"
              value={addCode}
              onChange={(e) => setAddCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              className="bg-bg-panel border border-border-light text-text-primary px-2 py-0.5 rounded text-xs w-[90px]"
              autoFocus
            />
            <button
              className="px-2 py-0.5 bg-orange/15 border border-orange/30 text-orange rounded text-[10px]"
              onClick={handleAdd}
            >
              确认
            </button>
            <button
              className="text-text-muted text-[10px]"
              onClick={() => { setShowAddInput(false); setAddCode(''); }}
            >
              取消
            </button>
          </div>
        ) : (
          <button
            className="px-2 py-0.5 bg-orange/15 border border-orange/30 text-orange rounded text-[10px] hover:bg-orange hover:text-black transition-colors"
            onClick={() => setShowAddInput(true)}
          >
            + 添加自选
          </button>
        )}

        <span className="text-text-muted text-[11px]">{filteredStocks.length} 只</span>
      </div>

      {/* 表格 */}
      <div className="flex-1 overflow-hidden">
        {filteredStocks.length > 0 ? (
          <DataTable
            columns={columns}
            data={filteredStocks}
            rowKey="code"
            onRowClick={(row) => {
              /* 可扩展：点击股票打开详情 */
            }}
          />
        ) : (
          <EmptyState
            message="暂无自选股"
            description="点击右上角添加自选股"
            icon="⭐"
          />
        )}
      </div>
    </div>
  );
}
