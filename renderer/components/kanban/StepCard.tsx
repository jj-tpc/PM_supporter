import { memo, useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAppStore } from '../../stores/app-store';

interface Props {
  stepId: string;
}

export const StepCard = memo(function StepCard({ stepId }: Props) {
  const step = useAppStore(useCallback((s) => s.steps[stepId], [stepId]));
  const setSelectedStep = useAppStore((s) => s.setSelectedStep);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: stepId,
    data: { phaseId: step?.phaseId },
  });

  if (!step) return null;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const priorityColors = {
    critical: 'border-l-danger',
    high: 'border-l-warning',
    medium: 'border-l-accent',
    low: 'border-l-border',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => setSelectedStep(stepId)}
      className={`p-3 rounded-lg border border-border bg-surface-raised cursor-grab active:cursor-grabbing hover:border-accent transition-colors border-l-4 ${priorityColors[step.priority]}`}
    >
      <p className="text-sm text-text-primary font-medium">{step.title}</p>
      {step.dueDate && (
        <p className="text-xs text-text-secondary mt-1">
          마감: {new Date(step.dueDate).toLocaleDateString('ko-KR')}
        </p>
      )}
    </div>
  );
});
