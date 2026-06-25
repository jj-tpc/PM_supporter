// renderer/components/deepwork/StepSelector.tsx
import { memo, useMemo } from 'react';
import { useAppStore } from '../../stores/app-store';

interface Props {
  onSelect: (stepId: string) => void;
  onCancel: () => void;
}

export const StepSelector = memo(function StepSelector({ onSelect, onCancel }: Props) {
  const steps = useAppStore((s) => s.steps);
  const phases = useAppStore((s) => s.phases);

  const sortedSteps = useMemo(() => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return Object.values(steps)
      .filter((s) => {
        const phase = phases[s.phaseId];
        return phase && phase.name !== 'Done' && phase.name !== '\uC644\uB8CC';
      })
      .sort((a, b) => {
        // Priority first
        const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (pDiff !== 0) return pDiff;
        // Due date (sooner first)
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return 0;
      });
  }, [steps, phases]);

  const priorityColors: Record<string, string> = {
    critical: 'border-l-danger',
    high: 'border-l-warning',
    medium: 'border-l-accent',
    low: 'border-l-border',
  };

  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-xl font-semibold text-text-primary mb-2 text-center">
        집중할 스텝을 선택하세요
      </h2>
      <p className="text-sm text-text-secondary mb-6 text-center">
        우선순위와 마감일 기준으로 정렬되어 있습니다
      </p>

      {sortedSteps.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-text-secondary">진행 가능한 스텝이 없습니다</p>
          <button onClick={onCancel} className="mt-4 text-sm text-accent hover:text-accent-hover">
            돌아가기
          </button>
        </div>
      ) : (
        <div className="space-y-2 max-h-[50vh] overflow-auto">
          {sortedSteps.slice(0, 10).map((step) => (
            <button
              key={step.id}
              onClick={() => onSelect(step.id)}
              className={`w-full text-left p-3 rounded-lg border border-border bg-surface-raised hover:border-accent transition-colors border-l-4 ${priorityColors[step.priority]}`}
            >
              <p className="text-sm font-medium text-text-primary">{step.title}</p>
              <div className="flex gap-3 mt-1">
                <span className="text-xs text-text-secondary">{step.priority}</span>
                {step.dueDate && (
                  <span className="text-xs text-text-secondary">
                    마감: {new Date(step.dueDate).toLocaleDateString('ko-KR')}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
