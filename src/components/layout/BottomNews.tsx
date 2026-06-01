import { useEffect, useRef, useState } from 'react';
import type { News } from '../../types';
import { newsService } from '../../services/newsService';

export default function BottomNews() {
  const [newsList, setNewsList] = useState<News[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    newsService.getBottomNews().then(setNewsList).catch(() => {});
  }, []);

  if (newsList.length === 0) return null;

  // Duplicate for seamless loop
  const allNews = [...newsList, ...newsList];

  return (
    <div className="h-[30px] bg-[#0d0d0d] border-t border-border flex items-center overflow-hidden shrink-0">
      <div className="bg-orange text-black text-[10px] font-bold px-2 whitespace-nowrap shrink-0 h-full flex items-center">
        快讯
      </div>
      <div className="flex-1 overflow-hidden relative h-full" ref={scrollRef}>
        <div
          className="flex items-center h-full whitespace-nowrap text-text-secondary text-[11px]"
          style={{ animation: 'scrollNews 60s linear infinite' }}
        >
          {allNews.map((n, i) => (
            <span key={`${n.id}-${i}`} className="px-6">
              ◆ {n.title}
            </span>
          ))}
        </div>
      </div>
      <style>{`
        @keyframes scrollNews {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
