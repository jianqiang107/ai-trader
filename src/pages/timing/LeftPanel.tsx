import { useState, useEffect } from 'react';
import { useMarketStore } from '../../stores/useMarketStore';
import { useSignalStore } from '../../stores/useSignalStore';
import { useAuthStore } from '../../stores/useAuthStore';
import KlineChart from '../../components/charts/KlineChart';
import EmotionChart from '../../components/charts/EmotionChart';

export default function LeftPanel() {
  const selectedDate = useMarketStore((s) => s.selectedDate);
  const setSelectedDate = useMarketStore((s) => s.setSelectedDate);
  const emotion1Data = useSignalStore((s) => s.emotion1Data);
  const emotion2Data = useSignalStore((s) => s.emotion2Data);
  const fetchEmotionData = useSignalStore((s) => s.fetchEmotionData);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [localDate, setLocalDate] = useState(selectedDate);

  useEffect(() => {
    // 未认证时跳过 API 调用，避免触发 401 导致页面重定向抖动
    if (!isAuthenticated) return;
    fetchEmotionData(localDate);
  }, [localDate, fetchEmotionData, isAuthenticated]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = e.target.value;
    setLocalDate(date);
    setSelectedDate(date);
  };

  const handleSandbox = () => {
    alert(`沙盘演练：正在加载 ${localDate} 数据，请稍候...`);
  };

  return (
    <div className="w-[220px] min-w-[220px] bg-bg-secondary border-r border-border flex flex-col overflow-hidden">
      {/* 日期选择器 */}
      <div className="h-[30px] bg-[#141414] border-b border-border flex items-center px-2.5 gap-2.5 shrink-0">
        <label className="text-text-muted text-[11px]">日期:</label>
        <input
          type="date"
          value={localDate}
          onChange={handleDateChange}
          className="bg-bg-panel border border-border-light text-text-secondary px-1.5 py-0.5 rounded text-[11px] cursor-pointer"
        />
        <div
          className="px-2.5 py-0.5 bg-orange/15 border border-orange text-orange rounded text-[11px] cursor-pointer hover:bg-orange hover:text-black transition-all"
          onClick={handleSandbox}
        >
          沙盘演练
        </div>
      </div>

      {/* 平均股价K线 */}
      <div className="h-[28px] bg-[#141414] border-b border-border flex items-center px-2.5 gap-1.5 shrink-0">
        <div className="w-1.5 h-1.5 rounded-full bg-orange" />
        <span className="text-text-primary text-[11px] font-medium">平均股价指数</span>
        <span className="text-text-muted text-[10px] ml-auto">日线·前复权</span>
      </div>
      <div className="shrink-0" style={{ height: 200 }}>
        <KlineChart code="INDEX_AVG" height={200} showVolume={true} showMA={true} showMark={true} />
      </div>

      {/* 情绪研判一号 */}
      <div className="h-[28px] bg-[#141414] border-b border-border flex items-center px-2.5 gap-1.5 shrink-0">
        <div className="w-1.5 h-1.5 rounded-full bg-blue" />
        <span className="text-text-primary text-[11px] font-medium">情绪研判一号</span>
      </div>
      <div className="shrink-0" style={{ height: 120 }}>
        <EmotionChart mode="area" data1={emotion1Data} data2={[]} height={120} />
      </div>

      {/* 情绪研判二号 */}
      <div className="h-[28px] bg-[#141414] border-b border-border flex items-center px-2.5 gap-1.5 shrink-0">
        <div className="w-1.5 h-1.5 rounded-full bg-[#9c27b0]" />
        <span className="text-text-primary text-[11px] font-medium">情绪研判二号</span>
      </div>
      <div className="flex-1 min-h-[80px]">
        <EmotionChart mode="bar" data1={[]} data2={emotion2Data} height={120} />
      </div>
    </div>
  );
}
