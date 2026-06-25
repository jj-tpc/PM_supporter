// renderer/components/calendar/DayView.tsx
import { memo, useMemo } from 'react';
import type { CalendarEvent } from '../../../shared/types';

interface Props {
  dateStr: string;
  events: CalendarEvent[];
  onSelectEvent: (id: string) => void;
}

export const DayView = memo(function DayView({ dateStr, events, onSelectEvent }: Props) {
  const date = new Date(dateStr);
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const dayKey = date.toISOString().split('T')[0];
  const dayEvents = useMemo(() =>
    events.filter(e => new Date(e.startTime).toISOString().split('T')[0] === dayKey),
    [events, dayKey]
  );

  return (
    <div className="h-full overflow-auto">
      <div className="text-center py-4 border-b border-border">
        <div className="text-lg font-semibold text-text-primary">
          {date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
        </div>
      </div>
      <div className="relative">
        {hours.map((hour) => {
          const hourEvents = dayEvents.filter(e => new Date(e.startTime).getHours() === hour);
          return (
            <div key={hour} className="flex border-b border-border min-h-[60px]">
              <div className="w-16 text-right pr-3 py-2 text-xs text-text-secondary shrink-0">
                {hour.toString().padStart(2, '0')}:00
              </div>
              <div className="flex-1 py-1 px-2 space-y-1">
                {hourEvents.map((evt) => (
                  <button
                    key={evt.id}
                    onClick={() => onSelectEvent(evt.id)}
                    className="w-full text-left text-sm px-3 py-2 rounded bg-accent/15 text-accent hover:bg-accent/25 transition-colors"
                  >
                    <span className="font-medium">
                      {new Date(evt.startTime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {' '}{evt.summary}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
