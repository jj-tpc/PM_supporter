import Link from 'next/link';
import { useMemo } from 'react';
import { useBuilds } from '../hooks/use-builds';
import { useAppStore } from '../stores/app-store';

export default function Home() {
  const { builds } = useBuilds();
  const calendarEvents = useAppStore((s) => s.calendarEvents);

  const todayEventCount = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return Object.values(calendarEvents).filter(
      (e) => e.startTime.split('T')[0] === today
    ).length;
  }, [calendarEvents]);

  return (
    <div className="p-8">
      <h2 className="text-2xl font-semibold text-text-primary mb-4">홈 대시보드</h2>
      <p className="text-text-secondary mb-6">Plan 4에서 전체 구현 예정</p>

      <div className="grid grid-cols-2 gap-4 max-w-lg">
        <div className="p-4 rounded-lg border border-border bg-surface-raised">
          <h3 className="text-sm font-semibold text-text-primary mb-2">빌드</h3>
          <p className="text-2xl font-bold text-accent">{builds.length}</p>
          <Link href="/builds" className="text-sm text-accent hover:text-accent-hover mt-2 inline-block">
            빌드 보기 →
          </Link>
        </div>

        <div className="p-4 rounded-lg border border-border bg-surface-raised">
          <h3 className="text-sm font-semibold text-text-primary mb-2">오늘 일정</h3>
          <p className="text-2xl font-bold text-accent">{todayEventCount}</p>
          <Link href="/calendar" className="text-sm text-accent hover:text-accent-hover mt-2 inline-block">
            캘린더 보기 →
          </Link>
        </div>
      </div>
    </div>
  );
}
