import { memo, useCallback } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useAppStore } from '../../stores/app-store';
import { StepCard } from './StepCard';
import { CreateStepInput } from './CreateStepInput';

interface Props {
  phaseId: string;
  onCreateStep: (phaseId: string, title: string) => void;
}

export const PhaseColumn = memo(function PhaseColumn({ phaseId, onCreateStep }: Props) {
  const phase = useAppStore(useCallback((s) => s.phases[phaseId], [phaseId]));
  const stepIds = useAppStore(useCallback((s) => s.stepOrder[phaseId] ?? [], [phaseId]));

  const { setNodeRef, isOver } = useDroppable({
    id: phaseId,
    data: { phaseId },
  });

  if (!phase) return null;

  return (
    <div className="flex-shrink-0 w-72">
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="text-sm font-semibold text-text-primary">{phase.name}</h3>
        <span className="text-xs text-text-secondary">{stepIds.length}</span>
      </div>

      <div
        ref={setNodeRef}
        className={`space-y-2 min-h-[200px] p-2 rounded-lg transition-colors ${
          isOver ? 'bg-accent/10' : 'bg-transparent'
        }`}
      >
        <SortableContext items={stepIds} strategy={verticalListSortingStrategy}>
          {stepIds.map((id) => (
            <StepCard key={id} stepId={id} />
          ))}
        </SortableContext>

        <CreateStepInput onSubmit={(title) => onCreateStep(phaseId, title)} />
      </div>
    </div>
  );
});
