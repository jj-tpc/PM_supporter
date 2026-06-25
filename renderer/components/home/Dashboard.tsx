import { useDashboard } from '../../hooks/use-dashboard';
import { OnboardingChecklist } from './OnboardingChecklist';
import { WelcomeCard } from './WelcomeCard';
import { TodaySchedule } from './TodaySchedule';
import { TodaySteps } from './TodaySteps';
import { CrewSnapshot } from './CrewSnapshot';

export function Dashboard() {
  const { data, loading, dismissOnboarding } = useDashboard();

  if (loading || !data) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-border rounded w-48" />
          <div className="h-24 bg-border rounded" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-48 bg-border rounded" />
            <div className="h-48 bg-border rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl space-y-4">
      {/* 온보딩 체크리스트 */}
      <OnboardingChecklist state={data.onboarding} onDismiss={dismissOnboarding} />

      {/* 환영 카드 (MVP — Phase 2에서 AI 브리핑으로 교체) */}
      <WelcomeCard />

      {/* 오늘의 일정 + 스텝 */}
      <div className="grid grid-cols-2 gap-4">
        <TodaySchedule events={data.todayEvents} />
        <TodaySteps steps={data.todaySteps} />
      </div>

      {/* 크루 현황 */}
      <CrewSnapshot workload={data.crewWorkload} />
    </div>
  );
}
