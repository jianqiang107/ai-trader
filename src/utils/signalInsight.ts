import type { Signal } from '../types';

interface SignalInsight {
  triggers: string[];
  risks: string[];
  nextStep: string;
}

const MODE_TRIGGERS: Record<Signal['mode'], string[]> = {
  低吸: ['估值与回撤位置具备低吸条件', '反弹潜力高于当前风险阈值'],
  趋势: ['短线趋势保持上行', '涨势动力与市场环境形成共振'],
  突破: ['价格接近关键突破区间', '量能或资金热度支持继续观察'],
  均值回归: ['价格偏离均值后出现修复机会', '波动收敛有利于纪律化交易'],
};

const MODE_RISKS: Record<Signal['mode'], string[]> = {
  低吸: ['下跌趋势未完全扭转，需严格执行止损'],
  趋势: ['趋势信号怕放量回落，追高时注意仓位'],
  突破: ['突破失败会快速回撤，需要关注成交量确认'],
  均值回归: ['均值回归可能遇到单边行情失效'],
};

export function getSignalInsight(signal: Signal): SignalInsight {
  const triggers = [...(MODE_TRIGGERS[signal.mode] ?? [])];
  const risks = [...(MODE_RISKS[signal.mode] ?? [])];

  if (signal.confidence >= 80) {
    triggers.push(`置信度 ${signal.confidence}%，属于高优先级信号`);
  } else if (signal.confidence > 0) {
    triggers.push(`置信度 ${signal.confidence}%，建议结合右侧个股走势确认`);
  }

  if (signal.alert_status === 'warning') {
    risks.push('已接近预警区间，先确认止损止盈参数');
  }
  if (signal.alert_status === 'stop_loss') {
    risks.push('止损预警已触发，优先处理风险');
  }
  if (signal.alert_status === 'take_profit') {
    risks.push('止盈条件已触发，关注回落保护收益');
  }

  const nextStep = signal.status === 'pending'
    ? signal.signal_type === 'BUY'
      ? '确认个股详情和仓位后，再标记是否执行。'
      : '核对持仓与卖出条件，确认后再处理信号。'
    : signal.status === 'executed'
      ? '继续跟踪浮动盈亏和预警线。'
      : signal.status === 'ignored'
        ? '已忽略，可在后续信号中重新评估。'
        : '该信号已结束，建议回看执行结果。';

  return {
    triggers: triggers.slice(0, 3),
    risks: risks.slice(0, 2),
    nextStep,
  };
}
