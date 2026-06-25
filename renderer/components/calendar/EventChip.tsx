// renderer/components/calendar/EventChip.tsx
import { memo } from 'react';

interface Props {
  summary: string;
  startTime: string;
  onClick?: () => void;
}

export const EventChip = memo(function EventChip({ summary, startTime, onClick }: Props) {
  const time = new Date(startTime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

  return (
    <button
      onClick={onClick}
      className="w-full text-left text-xs px-2 py-1 rounded bg-accent/15 text-accent hover:bg-accent/25 transition-colors truncate"
    >
      <span className="font-medium">{time}</span> {summary}
    </button>
  );
});
