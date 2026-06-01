import { useState, useCallback, useMemo } from 'react';
import { Virtuoso } from 'react-virtuoso';

interface Column<T = any> {
  key: string;
  title: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  render?: (value: unknown, row: T, index: number) => React.ReactNode;
  sorter?: (a: T, b: T) => number;
}

interface DataTableProps<T = any> {
  columns: Column<T>[];
  data: T[];
  rowKey?: string;
  onRowClick?: (row: T, index: number) => void;
  selectedRowKey?: string | null;
  height?: number | string;
  className?: string;
}

export default function DataTable<T = any>({
  columns,
  data,
  rowKey = 'code',
  onRowClick,
  selectedRowKey,
  height,
  className = '',
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = useCallback(
    (col: Column<T>) => {
      if (!col.sorter) return;
      if (sortKey === col.key) {
        setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(col.key);
        setSortDir('desc');
      }
    },
    [sortKey]
  );

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sorter) return data;
    const sorted = [...data].sort(col.sorter);
    return sortDir === 'desc' ? sorted.reverse() : sorted;
  }, [data, sortKey, sortDir, columns]);

  return (
    <div className={`flex flex-col h-full overflow-hidden ${className}`} style={height ? { height } : undefined}>
      {/* 表头 */}
      <div className="flex items-center bg-[#161616] border-b border-border sticky top-0 z-10 shrink-0">
        {columns.map((col) => (
          <div
            key={col.key}
            className={`px-2 py-1.5 text-[11px] text-text-muted font-normal whitespace-nowrap ${
              col.sorter ? 'cursor-pointer hover:text-text-secondary' : ''
            } ${col.align === 'left' ? 'text-left' : col.align === 'right' ? 'text-right' : 'text-center'}`}
            style={col.width ? { width: col.width, flex: 'none' } : { flex: 1 }}
            onClick={() => col.sorter && handleSort(col)}
          >
            {col.title}
            {sortKey === col.key && <span className="ml-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>}
          </div>
        ))}
      </div>

      {/* 虚拟滚动表格体 */}
      <div className="flex-1 overflow-hidden">
        <Virtuoso
          data={sortedData}
          itemContent={(index, row) => {
            const typedRow = row as T;
            const isSelected = selectedRowKey && typedRow[rowKey as keyof T] === selectedRowKey;
            return (
              <div
                className={`flex items-center border-b border-[#1a1a1a] cursor-pointer hover:bg-[#1e1e1e] ${
                  isSelected ? 'bg-orange/5' : ''
                }`}
                onClick={() => onRowClick?.(typedRow, index)}
              >
                {columns.map((col) => (
                  <div
                    key={col.key}
                    className={`px-2 py-1.5 text-[11px] whitespace-nowrap ${
                      col.align === 'left' ? 'text-left' : col.align === 'right' ? 'text-right' : 'text-center'
                    }`}
                    style={col.width ? { width: col.width, flex: 'none' } : { flex: 1 }}
                  >
                    {col.render
                      ? col.render(typedRow[col.key as keyof T], typedRow, index)
                      : (typedRow[col.key as keyof T] as React.ReactNode)}
                  </div>
                ))}
              </div>
            );
          }}
        />
      </div>
    </div>
  );
}
