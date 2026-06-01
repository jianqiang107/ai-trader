import { useEffect } from 'react';
import { useMarketStore } from '../../stores/useMarketStore';
import { formatPrice, formatChangePct } from '../../utils/format';

export default function IndexBar() {
  const indices = useMarketStore((s) => s.indices);
  const fetchIndices = useMarketStore((s) => s.fetchIndices);
  const startIndexPolling = useMarketStore((s) => s.startIndexPolling);
  const stopIndexPolling = useMarketStore((s) => s.stopIndexPolling);

  useEffect(() => {
    fetchIndices();
    startIndexPolling();
    return () => stopIndexPolling();
  }, [fetchIndices, startIndexPolling, stopIndexPolling]);

  return (
    <div className="flex gap-0 px-3 py-1 bg-[#0d0d0d] border-b border-border shrink-0">
      {indices.map((idx) => {
        const isRise = idx.change_pct >= 0;
        return (
          <div
            key={idx.code}
            className="flex flex-col pr-4 mr-4 border-r border-border last:border-r-0 last:mr-0 last:pr-0"
          >
            <span className="text-[10px] text-text-muted mb-0.5">{idx.name}</span>
            <span className={`text-[13px] font-semibold ${isRise ? 'rise' : 'fall'}`}>
              {formatPrice(idx.price)}
            </span>
            <span className={`text-[10px] ${isRise ? 'rise' : 'fall'}`}>
              {formatChangePct(idx.change_pct)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
