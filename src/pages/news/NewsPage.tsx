import { useState, useEffect, useMemo } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { useECharts, setChartOption } from '../../hooks/useECharts';
import StockDetailDialog from '../../components/common/StockDetailDialog';
import type { News, NewsCategory, Sentiment } from '../../types';
import { formatDateTime } from '../../utils/format';
import axios from 'axios';

const CATEGORY_TABS: { value: NewsCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'AI精选' },
  { value: 'market', label: '市场快讯' },
  { value: 'stock', label: '个股资讯' },
  { value: 'policy', label: '政策解读' },
];

/** 情绪标签颜色 */
function getSentimentStyle(sentiment: Sentiment): { bg: string; color: string; border: string } {
  switch (sentiment) {
    case '利好':
      return { bg: 'rgba(232,64,64,0.15)', color: '#e84040', border: 'rgba(232,64,64,0.3)' };
    case '利空':
      return { bg: 'rgba(0,192,160,0.15)', color: '#00c0a0', border: 'rgba(0,192,160,0.3)' };
    case '中性':
      return { bg: 'rgba(102,102,102,0.15)', color: '#999999', border: 'rgba(102,102,102,0.3)' };
  }
}

/** 影响度星级 */
function ImpactStars({ score }: { score: number }) {
  const stars = Math.round(score / 20);
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={`text-[10px] ${i < stars ? 'text-orange' : 'text-text-muted/30'}`}
        >
          ★
        </span>
      ))}
    </span>
  );
}

/** 关联股票名称映射 */
const STOCK_NAMES: Record<string, string> = {
  '601318': '中国平安',
  '600036': '招商银行',
  '002415': '海康威视',
  '000725': '京东方A',
  '600160': '巨化股份',
  '605020': '永和股份',
  '002594': '比亚迪',
  '002230': '科大讯飞',
  '600028': '中国石化',
  '600276': '恒瑞医药',
  '600547': '山东黄金',
  '002475': '立讯精密',
  '600309': '万华化学',
  '601939': '建设银行',
};

/** 板块名称映射 */
const SECTOR_NAMES: Record<string, string> = {
  S01: '化工',
  S02: '电子',
  S03: '计算机',
  S04: '汽车',
  S05: '医药',
  S06: '房地产',
  S08: '金融',
  S09: '新能源',
  S10: '储能',
  S11: '半导体',
};

export default function NewsPage() {
  const [newsList, setNewsList] = useState<News[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<NewsCategory | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [stockDialogCode, setStockDialogCode] = useState<string | null>(null);
  const [stockDialogName, setStockDialogName] = useState('');

  const { chartRef: gaugeChartRef, chartInstance: gaugeChartInstance } = useECharts();

  /** 获取资讯列表 */
  useEffect(() => {
    const fetchNews = async () => {
      setLoading(true);
      try {
        const params: Record<string, string> = {};
        if (activeCategory !== 'all') {
          params.category = activeCategory;
        }
        const res = await axios.get('/api/news', { params });
        setNewsList(res.data?.data ?? []);
      } catch {
        setNewsList([]);
      } finally {
        setLoading(false);
      }
    };
    fetchNews();
  }, [activeCategory]);

  /** 市场情绪仪表盘 */
  useEffect(() => {
    if (!gaugeChartInstance.current) return;
    setChartOption(gaugeChartInstance.current, {
      series: [
        {
          type: 'gauge',
          startAngle: 200,
          endAngle: -20,
          min: 0,
          max: 100,
          radius: '90%',
          center: ['50%', '55%'],
          splitNumber: 5,
          axisLine: {
            lineStyle: {
              width: 12,
              color: [
                [0.3, '#00c0a0'],
                [0.7, '#ff8c00'],
                [1, '#e84040'],
              ],
            },
          },
          pointer: {
            itemStyle: { color: 'auto' },
            width: 4,
            length: '60%',
          },
          axisTick: {
            distance: -12,
            length: 4,
            lineStyle: { color: '#666', width: 1 },
          },
          splitLine: {
            distance: -14,
            length: 10,
            lineStyle: { color: '#666', width: 1 },
          },
          axisLabel: {
            color: '#666',
            distance: 16,
            fontSize: 9,
          },
          detail: {
            valueAnimation: true,
            formatter: '{value}',
            color: '#e0e0e0',
            fontSize: 20,
            fontWeight: 'bold',
            offsetCenter: [0, '70%'],
          },
          title: {
            offsetCenter: [0, '90%'],
            color: '#aaa',
            fontSize: 10,
          },
          data: [{ value: 68, name: '市场情绪' }],
        },
      ],
    });
  }, [gaugeChartInstance]);

  /** 热门关联板块Top5 */
  const topSectors = useMemo(() => {
    const countMap: Record<string, number> = {};
    newsList.forEach((n) => {
      n.related_sectors.forEach((s) => {
        countMap[s] = (countMap[s] || 0) + 1;
      });
    });
    return Object.entries(countMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([code, count]) => ({
        code,
        name: SECTOR_NAMES[code] || code,
        count,
      }));
  }, [newsList]);

  /** 今日影响度最高3条 */
  const topImpact = useMemo(() => {
    return [...newsList]
      .sort((a, b) => b.impact_score - a.impact_score)
      .slice(0, 3);
  }, [newsList]);

  /** 点击关联股票 */
  const handleStockClick = (code: string) => {
    setStockDialogName(STOCK_NAMES[code] || code);
    setStockDialogCode(code);
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* 左栏：资讯列表 70% */}
      <div className="flex flex-col h-full" style={{ width: '70%' }}>
        {/* 筛选栏 */}
        <div className="h-9 bg-[#141414] border-b border-border flex items-center px-3 gap-0.5 shrink-0">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.value}
              className={`px-2.5 py-0.5 rounded text-[11px] transition-colors ${
                activeCategory === tab.value
                  ? 'bg-orange/15 text-orange border border-orange/30'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
              onClick={() => setActiveCategory(tab.value)}
            >
              {tab.label}
            </button>
          ))}
          <span className="flex-1" />
          <span className="text-text-muted text-[11px]">{newsList.length} 条资讯</span>
        </div>

        {/* 资讯列表 */}
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full text-text-muted text-sm">
              加载中...
            </div>
          ) : newsList.length === 0 ? (
            <div className="flex items-center justify-center h-full text-text-muted text-sm">
              暂无资讯
            </div>
          ) : (
            <Virtuoso
              data={newsList}
              itemContent={(index, news) => {
                const isExpanded = expandedId === news.id;
                const sentimentStyle = getSentimentStyle(news.sentiment);

                return (
                  <div
                    key={news.id}
                    className="px-4 py-3 border-b border-border cursor-pointer hover:bg-bg-secondary/50 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : news.id)}
                  >
                    {/* 标题行 */}
                    <div className="flex items-start gap-2 mb-1.5">
                      <h4 className="text-text-primary text-sm font-medium leading-snug flex-1">
                        {news.title}
                      </h4>
                    </div>

                    {/* AI摘要 */}
                    <p className="text-text-muted text-xs leading-relaxed mb-2 line-clamp-2">
                      {news.summary}
                    </p>

                    {/* 元信息行 */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* 来源+时间 */}
                      <span className="text-text-muted text-[10px]">
                        {news.source} · {formatDateTime(news.published_at)}
                      </span>

                      {/* 情绪标签 */}
                      <span
                        className="inline-block px-1.5 py-0.5 rounded text-[10px] leading-tight"
                        style={{
                          background: sentimentStyle.bg,
                          color: sentimentStyle.color,
                          border: `1px solid ${sentimentStyle.border}`,
                        }}
                      >
                        {news.sentiment}
                      </span>

                      {/* 影响度星级 */}
                      <ImpactStars score={news.impact_score} />

                      {/* 影响度数值 */}
                      <span className="text-text-muted text-[10px]">影响度 {news.impact_score}</span>
                    </div>

                    {/* 关联股票标签 */}
                    {news.related_stocks.length > 0 && (
                      <div className="flex items-center gap-1 mt-2 flex-wrap">
                        <span className="text-text-muted text-[10px] mr-1">关联:</span>
                        {news.related_stocks.map((code) => (
                          <button
                            key={code}
                            className="px-1.5 py-0.5 rounded text-[10px] bg-blue/10 text-blue border border-blue/20 hover:bg-blue/20 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStockClick(code);
                            }}
                          >
                            {STOCK_NAMES[code] || code}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* 展开全文 */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-text-secondary text-xs leading-relaxed">
                          {news.content}
                        </p>
                      </div>
                    )}
                  </div>
                );
              }}
            />
          )}
        </div>

        {/* 底部：关联股票快捷跳转 */}
        <div className="border-t border-border px-4 py-2 shrink-0 bg-[#111111]">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-text-muted text-[10px] shrink-0">关联股票：</span>
            {(() => {
              const allStocks = [...new Set(newsList.flatMap((n) => n.related_stocks))].slice(0, 8);
              return allStocks.map((code) => (
                <button
                  key={code}
                  className="px-2 py-0.5 rounded text-[10px] bg-bg-panel border border-border text-text-secondary hover:text-orange hover:border-orange/30 transition-colors"
                  onClick={() => handleStockClick(code)}
                >
                  {STOCK_NAMES[code] || code}({code})
                </button>
              ));
            })()}
          </div>
        </div>
      </div>

      {/* 右栏：资讯侧栏 30% */}
      <div className="flex flex-col h-full border-l border-border" style={{ width: '30%' }}>
        {/* AI情绪概览 */}
        <div className="px-4 py-3 border-b border-border">
          <h5 className="text-text-primary text-xs font-semibold mb-2">AI情绪概览</h5>
          <div className="h-[180px]">
            <div ref={gaugeChartRef as React.RefObject<HTMLDivElement>} className="w-full h-full" />
          </div>
        </div>

        {/* 热门关联板块Top5 */}
        <div className="px-4 py-3 border-b border-border">
          <h5 className="text-text-primary text-xs font-semibold mb-2">热门关联板块</h5>
          <div className="space-y-1.5">
            {topSectors.map((sector, idx) => (
              <div key={sector.code} className="flex items-center gap-2">
                <span
                  className={`w-4 h-4 rounded text-[9px] flex items-center justify-center font-bold ${
                    idx < 3 ? 'bg-orange/20 text-orange' : 'bg-bg-secondary text-text-muted'
                  }`}
                >
                  {idx + 1}
                </span>
                <span className="text-text-secondary text-xs flex-1">{sector.name}</span>
                <span className="text-text-muted text-[10px]">{sector.count}条</span>
              </div>
            ))}
            {topSectors.length === 0 && (
              <div className="text-text-muted text-xs py-2">暂无数据</div>
            )}
          </div>
        </div>

        {/* 今日影响度最高3条 */}
        <div className="px-4 py-3 flex-1 overflow-y-auto">
          <h5 className="text-text-primary text-xs font-semibold mb-2">影响度最高</h5>
          <div className="space-y-2">
            {topImpact.map((news) => {
              const sentimentStyle = getSentimentStyle(news.sentiment);
              return (
                <div
                  key={news.id}
                  className="p-2 rounded-lg border border-border cursor-pointer hover:border-orange/30 transition-colors"
                  style={{ background: 'var(--bg-card, #181818)' }}
                  onClick={() => setExpandedId(expandedId === news.id ? null : news.id)}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span
                      className="inline-block px-1 py-0 rounded text-[9px]"
                      style={{
                        background: sentimentStyle.bg,
                        color: sentimentStyle.color,
                      }}
                    >
                      {news.sentiment}
                    </span>
                    <span className="text-orange text-[10px] font-semibold">
                      影响度 {news.impact_score}
                    </span>
                  </div>
                  <p className="text-text-secondary text-[11px] leading-snug line-clamp-2">
                    {news.title}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* StockDetailDialog */}
      {stockDialogCode && (
        <StockDetailDialog
          open={!!stockDialogCode}
          stockCode={stockDialogCode}
          stockName={stockDialogName}
          onClose={() => setStockDialogCode(null)}
        />
      )}
    </div>
  );
}
