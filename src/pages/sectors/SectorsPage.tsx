import { useState, useEffect, useMemo } from 'react';
import DataTable from '../../components/common/DataTable';
import EmptyState from '../../components/common/EmptyState';
import type { Sector, SectorType } from '../../types';
import { formatChangePct, formatAmount, formatNetFlow } from '../../utils/format';
import { SECTOR_TYPES } from '../../utils/constants';
import api from '../../services/api';

export default function SectorsPage() {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [activeType, setActiveType] = useState<SectorType | 'all'>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSectors = async () => {
      setLoading(true);
      try {
        const params: Record<string, string> = {};
        if (activeType !== 'all') params.type = activeType;
        const data: unknown = await api.get('/sectors', { params });
        setSectors(data as Sector[]);
      } catch (e) {
        console.error('Failed to fetch sectors:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchSectors();
  }, [activeType]);

  const filteredSectors = useMemo(() => {
    if (!search) return sectors;
    const q = search.toLowerCase();
    return sectors.filter(
      (s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)
    );
  }, [sectors, search]);

  const columns = [
    {
      key: 'name',
      title: '板块名称',
      width: 120,
      align: 'left' as const,
      render: (_: unknown, row: Sector) => (
        <span className="text-text-primary font-medium">{row.name}</span>
      ),
    },
    {
      key: 'type',
      title: '类型',
      width: 70,
      align: 'center' as const,
      render: (_: unknown, row: Sector) => {
        const label = SECTOR_TYPES.find((t) => t.value === row.type)?.label || row.type;
        return <span className="text-text-muted">{label}</span>;
      },
    },
    {
      key: 'change_pct',
      title: '涨跌幅',
      width: 80,
      align: 'right' as const,
      sorter: (a: Sector, b: Sector) => a.change_pct - b.change_pct,
      render: (_: unknown, row: Sector) => (
        <span className={row.change_pct >= 0 ? 'rise' : 'fall'}>
          {formatChangePct(row.change_pct)}
        </span>
      ),
    },
    {
      key: 'up_count',
      title: '上涨',
      width: 50,
      align: 'center' as const,
      sorter: (a: Sector, b: Sector) => a.up_count - b.up_count,
      render: (_: unknown, row: Sector) => (
        <span className="rise">{row.up_count}</span>
      ),
    },
    {
      key: 'down_count',
      title: '下跌',
      width: 50,
      align: 'center' as const,
      sorter: (a: Sector, b: Sector) => a.down_count - b.down_count,
      render: (_: unknown, row: Sector) => (
        <span className="fall">{row.down_count}</span>
      ),
    },
    {
      key: 'net_inflow',
      title: '净流入',
      width: 80,
      align: 'right' as const,
      sorter: (a: Sector, b: Sector) => a.net_inflow - b.net_inflow,
      render: (_: unknown, row: Sector) => (
        <span className={row.net_inflow >= 0 ? 'rise' : 'fall'}>
          {formatNetFlow(row.net_inflow)}
        </span>
      ),
    },
    {
      key: 'turnover_rate',
      title: '换手率',
      width: 70,
      align: 'right' as const,
      sorter: (a: Sector, b: Sector) => a.turnover_rate - b.turnover_rate,
      render: (_: unknown, row: Sector) => (
        <span className="text-text-primary">{row.turnover_rate.toFixed(2)}%</span>
      ),
    },
    {
      key: 'representative_stocks',
      title: '领涨股',
      align: 'left' as const,
      render: (_: unknown, row: Sector) => (
        <span className="text-text-secondary text-[10px] truncate">
          {row.representative_stocks.slice(0, 3).join('、')}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 筛选栏 */}
      <div className="h-9 bg-[#141414] border-b border-border flex items-center px-3 gap-3 shrink-0">
        {/* 板块类型 */}
        <div className="flex items-center gap-0.5">
          <button
            className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
              activeType === 'all'
                ? 'bg-orange/15 text-orange border border-orange/30'
                : 'text-text-muted hover:text-text-secondary'
            }`}
            onClick={() => setActiveType('all')}
          >
            全部
          </button>
          {SECTOR_TYPES.map((t) => (
            <button
              key={t.value}
              className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                activeType === t.value
                  ? 'bg-orange/15 text-orange border border-orange/30'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
              onClick={() => setActiveType(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-border" />

        {/* 搜索 */}
        <input
          type="text"
          placeholder="🔍 搜索板块..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-bg-panel border border-border-light text-text-primary px-2 py-0.5 rounded text-xs w-[120px]"
        />

        <span className="flex-1" />
        <span className="text-text-muted text-[11px]">{filteredSectors.length} 个板块</span>
      </div>

      {/* 表格 */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full text-text-muted text-sm">
            加载中...
          </div>
        ) : filteredSectors.length > 0 ? (
          <DataTable
            columns={columns}
            data={filteredSectors}
            rowKey="code"
            onRowClick={(row) => {
              /* 可扩展：点击板块跳转 */
            }}
          />
        ) : (
          <EmptyState message="暂无板块数据" description="未找到匹配的板块" />
        )}
      </div>
    </div>
  );
}
