interface EmptyStateProps {
  icon?: string;
  message: string;
  description?: string;
  className?: string;
}

export default function EmptyState({ icon = '📭', message, description, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center h-full text-text-muted ${className}`}>
      <div className="text-3xl mb-2">{icon}</div>
      <div className="text-sm mb-1">{message}</div>
      {description && <div className="text-xs text-text-muted">{description}</div>}
    </div>
  );
}
