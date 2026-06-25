// renderer/components/calendar/MonthView.tsx
import { memo, useMemo } from 'react';
import { EventChip } from './EventChip';
import type { CalendarEvent } from '../../../shared/types';

interface Props {
  dateStr: string;
  events: CalendarEvent[];
  onSelectEvent: (id: string) => void;
}

export const MonthView = memo(function MonthView({ dateStr, events, onSelectEvent }: Props) {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = date.getMonth();

  const grid = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: { day: number; isCurrentMonth: boolean; date: Date }[] = [];

    // Previous month padding
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDay - 1; i >= 0; i--) {
      cells.push({ day: prevMonthDays - i, isCurrentMonth: false, date: new Date(year, month - 1, prevMonthDays - i) });
    }
    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, isCurrentMonth: true, date: new Date(year, month, d) });
    }
    // Next month padding
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
      cells.push({ day: d, isCurrentMonth: false, date: new Date(year, month + 1, d) });
    }

    return cells;
  }, [year, month]);

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
  const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <div className="h-full flex flex-col">
      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 border-b border-border">
        {weekDays.map((d) => (
          <div key={d} className="py-2 text-center text-xs font-medium text-text-secondary">{d}</div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7 flex-1">
        {grid.map((cell, i) => {
          const dateKey = cell.date.toISOString().split('T')[0];
          const dayEvents = eventsByDate.get(dateKey) ?? [];
          const isToday = dateKey === today;

          return (
            <div
              key={i}
              className={`border-b border-r border-border p-1 min-h-[80px] ${
                cell.isCurrentMonth ? '' : 'opacity-40'
              }`}
            >
              <span className={`text-xs inline-flex w-6 h-6 items-center justify-center rounded-full ${
                isToday ? 'bg-accent text-surface-raised font-bold' : 'text-text-secondary'
              }`}>
                {cell.day}
              </span>
              <div className="space-y-0.5 mt-1">
                {dayEvents.slice(0, 3).map((evt) => (
                  <EventChip
                    key={evt.id}
                    summary={evt.summary}
                    startTime={evt.startTime}
                    onClick={() => onSelectEvent(evt.id)}
                  />
                ))}
                {dayEvents.length > 3 && (
                  <span className="text-xs text-text-secondary px-2">+{dayEvents.length - 3}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
