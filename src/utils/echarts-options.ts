import type { EChartsOption } from 'echarts';

/** 通用暗色主题网格配置 */
export const darkGrid = {
  top: 8,
  left: 45,
  right: 6,
  bottom: 24,
};

/** 通用暗色坐标轴标签样式 */
export const darkAxisLabel = {
  color: '#666666',
  fontSize: 9,
};

/** 通用暗色分割线 */
export const darkSplitLine = {
  lineStyle: {
    color: '#1a1a1a',
  },
};

/** 通用暗色坐标轴线 */
export const darkAxisLine = {
  lineStyle: {
    color: '#333333',
  },
};

/** 通用暗色tooltip */
export const darkTooltip: EChartsOption['tooltip'] = {
  trigger: 'axis',
  backgroundColor: '#1c1c1c',
  borderColor: '#333333',
  textStyle: {
    color: '#cccccc',
    fontSize: 10,
  },
};

/** K线图涨跌色 */
export const candlestickStyle = {
  color: '#e84040',
  color0: '#00c0a0',
  borderColor: '#e84040',
  borderColor0: '#00c0a0',
};

/** 创建基础暗色图表配置 */
export function createBaseChartOption(): Partial<EChartsOption> {
  return {
    animation: false,
    backgroundColor: 'transparent',
    tooltip: darkTooltip,
    grid: darkGrid,
  };
}

/** 创建带双网格的K线图配置基础 */
export function createKlineGridOption() {
  return [
    { top: 8, left: 45, right: 6, bottom: 28, height: '70%' },
    { top: '80%', left: 45, right: 6, bottom: 4 },
  ];
}

/** 涨跌色面积渐变 - 策略收益(橙) */
export function orangeAreaGradient() {
  return {
    type: 'linear' as const,
    x: 0, y: 0, x2: 0, y2: 1,
    colorStops: [
      { offset: 0, color: 'rgba(255,140,0,0.25)' },
      { offset: 1, color: 'rgba(255,140,0,0)' },
    ],
  };
}

/** 蓝色面积渐变 - 沪深300 */
export function blueAreaGradient() {
  return {
    type: 'linear' as const,
    x: 0, y: 0, x2: 0, y2: 1,
    colorStops: [
      { offset: 0, color: 'rgba(74,158,255,0.15)' },
      { offset: 1, color: 'rgba(74,158,255,0)' },
    ],
  };
}

/** 蓝色面积渐变 - 情绪一号 */
export function emotionBlueGradient() {
  return {
    type: 'linear' as const,
    x: 0, y: 0, x2: 0, y2: 1,
    colorStops: [
      { offset: 0, color: 'rgba(74,158,255,0.3)' },
      { offset: 1, color: 'rgba(74,158,255,0)' },
    ],
  };
}

/** 红色面积渐变 - 分时图 */
export function riseAreaGradient() {
  return {
    type: 'linear' as const,
    x: 0, y: 0, x2: 0, y2: 1,
    colorStops: [
      { offset: 0, color: 'rgba(232,64,64,0.2)' },
      { offset: 1, color: 'rgba(232,64,64,0)' },
    ],
  };
}
