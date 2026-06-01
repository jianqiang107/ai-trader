import { useState } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import type { PlanLevel } from '../../types';

/** 套餐定义 */
interface PlanDef {
  level: PlanLevel;
  name: string;
  price: number;
  priceLabel: string;
  features: string[];
  highlights: string[];
  buttonLabel: string;
}

const PLANS: PlanDef[] = [
  {
    level: 'free',
    name: '免费版',
    price: 0,
    priceLabel: '¥0/月',
    features: ['查看信号', '基础择时', '2因子标签'],
    highlights: [],
    buttonLabel: '当前套餐',
  },
  {
    level: 'pro',
    name: '专业版',
    price: 198,
    priceLabel: '¥198/月',
    features: ['查看信号', '基础择时', '2因子标签', '因子雷达图', '3策略预设', '智能预警', '沙盘演练'],
    highlights: ['因子雷达图', '3策略预设', '智能预警', '沙盘演练'],
    buttonLabel: '立即开通',
  },
  {
    level: 'flagship',
    name: '旗舰版',
    price: 398,
    priceLabel: '¥398/月',
    features: ['查看信号', '基础择时', '2因子标签', '因子雷达图', '全策略预设', '智能预警', '沙盘演练', '因子权重调整', '自建组合', '专属客服'],
    highlights: ['因子权重调整', '自建组合', '全策略预设', '专属客服'],
    buttonLabel: '立即开通',
  },
];

/** 功能对比表行 */
interface FeatureRow {
  name: string;
  free: boolean | string;
  pro: boolean | string;
  flagship: boolean | string;
}

const FEATURE_COMPARISON: FeatureRow[] = [
  { name: '实时信号查看', free: true, pro: true, flagship: true },
  { name: '基础择时系统', free: true, pro: true, flagship: true },
  { name: '因子标签', free: '2个', pro: '全部', flagship: '全部+自定义' },
  { name: '因子雷达图', free: false, pro: true, flagship: true },
  { name: '策略预设', free: false, pro: '3个', flagship: '全部' },
  { name: '智能预警', free: false, pro: true, flagship: true },
  { name: '沙盘演练', free: false, pro: true, flagship: true },
  { name: '因子权重调整', free: false, pro: false, flagship: true },
  { name: '自建组合', free: false, pro: false, flagship: true },
  { name: '专属客服', free: false, pro: false, flagship: true },
  { name: '回测深度', free: '1年', pro: '3年', flagship: '5年' },
  { name: '同时监控股票', free: '5只', pro: '30只', flagship: '无限' },
];

/** 渲染对比单元格 */
function FeatureCell({ value }: { value: boolean | string }) {
  if (typeof value === 'boolean') {
    return value ? (
      <span className="text-rise text-sm">✓</span>
    ) : (
      <span className="text-text-muted text-sm">✗</span>
    );
  }
  return <span className="text-text-secondary text-xs">{value}</span>;
}

const PLAN_LABELS: Record<PlanLevel, string> = {
  free: '免费版',
  pro: '专业版',
  flagship: '旗舰版',
};

export default function MembershipPage() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const currentPlan: PlanLevel = user?.plan ?? 'free';

  const [selectedPlan, setSelectedPlan] = useState<PlanLevel | null>(null);
  const [purchasing, setPurchasing] = useState(false);

  const handlePurchase = async (plan: PlanLevel) => {
    if (plan === currentPlan) return;
    setPurchasing(true);
    setSelectedPlan(plan);
    // 模拟购买
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setPurchasing(false);
    setSelectedPlan(null);
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* 当前会员状态卡片 */}
      <div
        className="rounded-lg border border-border p-5 mb-6"
        style={{ background: 'var(--bg-card, #181818)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #ff8c00, #e84040)' }}
            >
              {isAuthenticated ? user?.nickname?.charAt(0) ?? 'U' : '?'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-text-primary text-sm font-semibold">
                  {isAuthenticated ? user?.nickname : '未登录'}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] bg-orange/15 text-orange border border-orange/30">
                  {PLAN_LABELS[currentPlan]}
                </span>
              </div>
              {isAuthenticated && user?.plan_expires_at && (
                <div className="text-text-muted text-xs mt-0.5">
                  到期时间：{user.plan_expires_at}
                </div>
              )}
            </div>
          </div>
          {isAuthenticated && currentPlan !== 'free' && (
            <button className="px-4 py-1.5 rounded text-xs bg-orange/15 text-orange border border-orange/30 hover:bg-orange hover:text-black transition-colors">
              续费
            </button>
          )}
        </div>
      </div>

      {/* 三档套餐对比 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {PLANS.map((plan) => {
          const isCurrent = plan.level === currentPlan;
          return (
            <div
              key={plan.level}
              className={`rounded-lg border p-5 flex flex-col transition-all ${
                isCurrent
                  ? 'border-orange shadow-[0_0_12px_rgba(255,140,0,0.15)]'
                  : 'border-border hover:border-border-light'
              }`}
              style={{ background: 'var(--bg-card, #181818)' }}
            >
              {/* 套餐名 */}
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-text-primary text-sm font-semibold">{plan.name}</h4>
                {isCurrent && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] bg-orange text-black font-medium">
                    当前
                  </span>
                )}
              </div>

              {/* 价格 */}
              <div className="mb-4">
                <span className="text-orange text-2xl font-bold">{plan.priceLabel}</span>
              </div>

              {/* 功能列表 */}
              <ul className="space-y-2 mb-5 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <span className={`text-xs ${plan.highlights.includes(feature) ? 'text-orange' : 'text-rise'}`}>
                      ✓
                    </span>
                    <span className={`text-xs ${plan.highlights.includes(feature) ? 'text-orange' : 'text-text-secondary'}`}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              {/* 按钮 */}
              <button
                className={`w-full py-2 rounded text-xs font-medium transition-colors disabled:opacity-50 ${
                  isCurrent
                    ? 'bg-bg-secondary border border-border text-text-muted cursor-default'
                    : 'bg-orange text-black hover:bg-orange/80'
                }`}
                disabled={isCurrent || purchasing}
                onClick={() => handlePurchase(plan.level)}
              >
                {purchasing && selectedPlan === plan.level
                  ? '处理中...'
                  : isCurrent
                    ? '当前套餐'
                    : currentPlan !== 'free' && plan.level === currentPlan
                      ? '续费'
                      : plan.buttonLabel}
              </button>
            </div>
          );
        })}
      </div>

      {/* 功能对比表 */}
      <div
        className="rounded-lg border border-border overflow-hidden"
        style={{ background: 'var(--bg-card, #181818)' }}
      >
        <div className="px-5 py-3 border-b border-border">
          <h4 className="text-text-primary text-sm font-semibold">功能对比详情</h4>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-5 py-2 text-text-muted text-xs font-medium">功能</th>
              <th className="text-center px-3 py-2 text-text-muted text-xs font-medium">免费版</th>
              <th className="text-center px-3 py-2 text-orange text-xs font-medium">专业版</th>
              <th className="text-center px-3 py-2 text-orange text-xs font-medium">旗舰版</th>
            </tr>
          </thead>
          <tbody>
            {FEATURE_COMPARISON.map((row, idx) => (
              <tr
                key={row.name}
                className={`border-b border-border/50 ${idx % 2 === 0 ? 'bg-bg-secondary/30' : ''}`}
              >
                <td className="px-5 py-2.5 text-text-secondary text-xs">{row.name}</td>
                <td className="text-center px-3 py-2.5">
                  <FeatureCell value={row.free} />
                </td>
                <td className="text-center px-3 py-2.5">
                  <FeatureCell value={row.pro} />
                </td>
                <td className="text-center px-3 py-2.5">
                  <FeatureCell value={row.flagship} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
