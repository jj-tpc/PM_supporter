import { memo } from 'react';
import Link from 'next/link';
import type { CalendarEvent } from '../../../shared/types';

interface Props {
  events: CalendarEvent[];
}

export const TodaySchedule = memo(function TodaySchedule({ events }: Props) {
  return (
    <div className="rounded-lg border border-border bg-surface-raised p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-primary">오늘의 일정</h3>
        <Link href="/calendar" className="text-xs text-accent hover:text-accent-hover">
          캘린더 →
        </Link>
      </div>
      {events.length === 0 ? (
        <p className="text-sm text-text-secondary">오늘 일정이 없습니다</p>
      ) : (
        <ul className="space-y-2">
          {events.slice(0, 5).map((event) => (
            <li key={event.id} className="flex items-start gap-3">
              <span className="text-xs text-accent font-medium w-12 shrink-0 pt-0.5">
                {new Date(event.startTime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="text-sm text-text-primary">{event.summary}</span>
            </li>
          ))}
          {events.length > 5 && (
            <li className="text-xs text-text-secondary">+{events.length - 5}개 더</li>
          )}
        </ul>
      )}
    </div>
  );
});
