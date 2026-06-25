// renderer/components/calendar/CalendarView.tsx
import { useState } from 'react';
import { useCalendar } from '../../hooks/use-calendar';
import { MonthView } from './MonthView';
import { WeekView } from './WeekView';
import { DayView } from './DayView';
import type { CalendarViewType } from '../../../shared/types';

export function CalendarView() {
  const { events, view, dateStr, setView, navigate, googleConnected, connectGoogle, syncNow } = useCalendar();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const viewLabel = () => {
    const d = new Date(dateStr);
    switch (view) {
      case 'month': return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' });
      case 'week': return `${d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} 주`;
      case 'day': return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
    }
  };

  const viewOptions: { value: CalendarViewType; label: string }[] = [
    { value: 'month', label: '월' },
    { value: 'week', label: '주' },
    { value: 'day', label: '일' },
  ];

  if (!googleConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <p className="text-lg text-text-primary mb-2">Google 캘린더를 연결하세요</p>
        <p className="text-sm text-text-secondary mb-4">일정을 확인하고 관리하려면 Google 계정 연결이 필요합니다</p>
        <button onClick={connectGoogle} className="px-4 py-2 bg-accent text-surface-raised rounded hover:bg-accent-hover">
          Google 계정 연결
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-text-secondary hover:text-text-primary px-2 py-1">←</button>
          <h2 className="text-lg font-semibold text-text-primary min-w-[200px] text-center">{viewLabel()}</h2>
          <button onClick={() => navigate(1)} className="text-text-secondary hover:text-text-primary px-2 py-1">→</button>
          <button onClick={() => navigate(0)} className="text-sm text-accent hover:text-accent-hover ml-2">오늘</button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded border border-border">
            {viewOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setView(opt.value)}
                className={`px-3 py-1.5 text-sm ${
                  view === opt.value
                    ? 'bg-accent text-surface-raised'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button onClick={syncNow} className="text-sm text-text-secondary hover:text-text-primary px-2" title="동기화">🔄</button>
        </div>
      </div>

      {/* 뷰 */}
      <div className="flex-1 overflow-hidden">
        {view === 'month' && <MonthView dateStr={dateStr} events={events} onSelectEvent={setSelectedEventId} />}
        {view === 'week' && <WeekView dateStr={dateStr} events={events} onSelectEvent={setSelectedEventId} />}
        {view === 'day' && <DayView dateStr={dateStr} events={events} onSelectEvent={setSelectedEventId} />}
      </div>
    </div>
  );
}
