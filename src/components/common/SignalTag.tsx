import type { SignalTagType } from '../../types';
import { SIGNAL_TAG_COLORS } from '../../utils/constants';

interface SignalTagProps {
  tag: SignalTagType;
  className?: string;
}

export default function SignalTag({ tag, className = '' }: SignalTagProps) {
  const colors = SIGNAL_TAG_COLORS[tag] || SIGNAL_TAG_COLORS['低吸'];

  return (
    <span
      className={`inline-block px-1.5 py-0.5 rounded text-[10px] leading-tight ${className}`}
      style={{
        background: colors.bg,
        color: colors.color,
        border: `1px solid ${colors.border}`,
      }}
    >
      {tag}
    </span>
  );
}
