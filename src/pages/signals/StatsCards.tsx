import type { LiveSignalStats } from '../../types';

interface StatsCardsProps {
  stats: LiveSignalStats;
}

interface StatItem {
  label: string;
  value: number;
  color: string;
  icon: string;
}

export default function StatsCards({ stats }: StatsCardsProps) {
  const items: StatItem[] = [
    { label: '今日信号', value: stats.today_count, color: 'text-orange', icon: '📊' },
    { label: '持仓中', value: stats.holding, color: 'text-blue', icon: '📈' },
    { label: '已止盈', value: stats.take_profit, color: 'text-fall', icon: '🎯' },
    { label: '已止损', value: stats.stop_loss, color: 'text-rise', icon: '🛡️' },
    { label: '预警中', value: stats.alerting, color: 'text-[#ffcc00]', icon: '⚠️' },
  ];

  return (
    <div className="flex items-stretch gap-2 px-3 py-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex-1 rounded-lg p-2.5 border border-border"
          style={{ background: 'var(--bg-card, #181818)' }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-xs">{item.icon}</span>
            <span className="text-text-muted text-[11px]">{item.label}</span>
          </div>
          <div className={`text-xl font-bold ${item.color}`}>{item.value}</div>
        </div>
      ))}
    </div>
  );
}
