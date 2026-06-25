import {
  DndContext,
  DragOverlay,
  closestCorners,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useState } from 'react';
import { useKanban } from '../../hooks/use-kanban';
import { PhaseColumn } from './PhaseColumn';
import { CreatePhaseButton } from './CreatePhaseButton';
import { StepCard } from './StepCard';

interface Props {
  buildId: string;
}

export function Board({ buildId }: Props) {
  const { phases, handleDragEnd, createPhase, createStep } = useKanban(buildId);
  const [activeId, setActiveId] = useState<string | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  return (
    <DndContext
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={(e) => { handleDragEnd(e); setActiveId(null); }}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex gap-4 overflow-x-auto p-6 h-full items-start">
        {phases.map((phase) => (
          <PhaseColumn
            key={phase.id}
            phaseId={phase.id}
            onCreateStep={createStep}
          />
        ))}
        <CreatePhaseButton onSubmit={createPhase} />
      </div>

      <DragOverlay>
        {activeId ? <StepCard stepId={activeId} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
