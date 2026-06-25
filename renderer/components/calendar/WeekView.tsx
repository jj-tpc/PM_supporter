// renderer/components/calendar/WeekView.tsx
import { memo, useMemo } from 'react';
import { EventChip } from './EventChip';
import type { CalendarEvent } from '../../../shared/types';

interface Props {
  dateStr: string;
  events: CalendarEvent[];
  onSelectEvent: (id: string) => void;
}

export const WeekView = memo(function WeekView({ dateStr, events, onSelectEvent }: Props) {
  const date = new Date(dateStr);
  const dayOfWeek = date.getDay();
  const weekStart = new Date(date.getFullYear(), date.getMonth(), date.getDate() - dayOfWeek);

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart.getTime() + i * 24 * 60 * 60 * 1000);
      return d;
    });
  }, [weekStart.getTime()]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const key = new Date(event.startTime).toISOString().split('T')[0];
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(event);
    }
    return map;
  }, [events]);

  const today = new Date().toISOString().split('T')[0];
  const weekDayNames = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <div className="grid grid-cols-7 h-full">
      {days.map((d, i) => {
        const dateKey = d.toISOString().split('T')[0];
        const dayEvents = eventsByDate.get(dateKey) ?? [];
        const isToday = dateKey === today;

        return (
          <div key={i} className="border-r border-border flex flex-col">
            <div className={`text-center py-3 border-b border-border ${isToday ? 'bg-accent/10' : ''}`}>
              <div className="text-xs text-text-secondary">{weekDayNames[i]}</div>
              <div className={`text-lg font-semibold ${isToday ? 'text-accent' : 'text-text-primary'}`}>
                {d.getDate()}
              </div>
            </div>
            <div className="flex-1 overflow-auto p-2 space-y-1">
              {dayEvents.map((evt) => (
                <EventChip
                  key={evt.id}
                  summary={evt.summary}
                  startTime={evt.startTime}
                  onClick={() => onSelectEvent(evt.id)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
});
