import { memo } from 'react';
import { CrewAvatar } from '../crew/CrewAvatar';

interface CrewWorkload {
  crewId: string;
  crewName: string;
  total: number;
  done: number;
  inProgress: number;
  overdue: number;
}

interface Props {
  workload: CrewWorkload[];
}

export const CrewSnapshot = memo(function CrewSnapshot({ workload }: Props) {
  if (workload.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface-raised p-4">
        <h3 className="text-sm font-semibold text-text-primary mb-3">크루 현황</h3>
        <p className="text-sm text-text-secondary">등록된 크루가 없습니다</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface-raised p-4">
      <h3 className="text-sm font-semibold text-text-primary mb-3">크루 현황</h3>
      <div className="space-y-3">
        {workload.map((crew) => {
          const progress = crew.total > 0 ? (crew.done / crew.total) * 100 : 0;
          return (
            <div key={crew.crewId} className="flex items-center gap-3">
              <CrewAvatar name={crew.crewName} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-text-primary truncate">{crew.crewName}</span>
                  <span className="text-xs text-text-secondary shrink-0 ml-2">
                    {crew.done}/{crew.total}
                    {crew.overdue > 0 && (
                      <span className="text-danger ml-1">({crew.overdue} 지연)</span>
                    )}
                  </span>
                </div>
                <div className="h-1.5 bg-border rounded-full">
                  <div
                    className="h-full bg-accent rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
