// renderer/components/deepwork/SplitViewPanel.tsx
import { memo } from 'react';
import { useAppStore } from '../../stores/app-store';

interface Props {
  target: 'kanban' | 'calendar';
  onClose: () => void;
}

export const SplitViewPanel = memo(function SplitViewPanel({ target, onClose }: Props) {
  const phases = useAppStore((s) => s.phases);
  const steps = useAppStore((s) => s.steps);
  const stepOrder = useAppStore((s) => s.stepOrder);
  const phaseOrder = useAppStore((s) => s.phaseOrder);
  const calendarEvents = useAppStore((s) => s.calendarEvents);
  const activeBuildId = useAppStore((s) => s.activeBuildId);

  return (
    <div className="w-[35%] border-l border-border bg-surface-raised overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-text-primary">
          {target === 'kanban' ? '칸반 (읽기 전용)' : '캘린더 (읽기 전용)'}
        </h3>
        <button onClick={onClose} className="text-text-secondary hover:text-text-primary text-sm">✕</button>
      </div>

      {/* Content */}
      <div className="p-4">
        {target === 'kanban' && activeBuildId && (
          <div className="space-y-3">
            {(phaseOrder[activeBuildId] ?? []).map((phaseId) => {
              const phase = phases[phaseId];
              if (!phase) return null;
              const ids = stepOrder[phaseId] ?? [];
              return (
                <div key={phaseId}>
                  <h4 className="text-xs font-semibold text-text-secondary mb-1">
                    {phase.name} ({ids.length})
                  </h4>
                  <ul className="space-y-1">
                    {ids.slice(0, 5).map((sid) => {
                      const step = steps[sid];
                      if (!step) return null;
                      return (
                        <li key={sid} className="text-xs text-text-primary truncate px-2 py-1 bg-surface rounded">
                          {step.title}
                        </li>
                      );
                    })}
                    {ids.length > 5 && <li className="text-xs text-text-secondary px-2">+{ids.length - 5}</li>}
                  </ul>
                </div>
              );
            })}
          </div>
        )}

        {target === 'calendar' && (
          <div className="space-y-2">
            {Object.values(calendarEvents)
              .filter((e) => {
                const d = new Date(e.startTime);
                const today = new Date();
                return d.toDateString() === today.toDateString();
              })
              .sort((a, b) => a.startTime.localeCompare(b.startTime))
              .map((event) => (
                <div key={event.id} className="text-xs px-2 py-1.5 bg-surface rounded">
                  <span className="text-accent font-medium">
                    {new Date(event.startTime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {' '}{event.summary}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
});
