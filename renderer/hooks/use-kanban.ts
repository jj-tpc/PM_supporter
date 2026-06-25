import { useEffect, useCallback } from 'react';
import { useAppStore } from '../stores/app-store';
import { ipc } from '../lib/ipc-client';
import type { DragEndEvent } from '@dnd-kit/core';

export function useKanban(buildId: string) {
  const phases = useAppStore(
    useCallback(
      (s) => (s.phaseOrder[buildId] ?? []).map((id) => s.phases[id]).filter(Boolean),
      [buildId],
    ),
  );
  const setPhases = useAppStore((s) => s.setPhases);
  const setSteps = useAppStore((s) => s.setSteps);
  const moveStep = useAppStore((s) => s.moveStep);

  useEffect(() => {
    async function load() {
      const phaseList = await ipc['phase:list'](buildId);
      setPhases(buildId, phaseList);
      for (const phase of phaseList) {
        const steps = await ipc['step:listByPhase'](phase.id);
        setSteps(phase.id, steps);
      }
    }
    load();
  }, [buildId, setPhases, setSteps]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const stepId = active.id as string;
      const step = useAppStore.getState().steps[stepId];
      if (!step) return;

      const fromPhaseId = step.phaseId;
      // over.id could be a step or a phase column
      const overData = over.data.current;
      const toPhaseId = (overData?.phaseId as string) ?? (over.id as string);
      const newOrder = (overData?.sortable?.index as number) ?? 0;

      // Optimistic update
      moveStep(stepId, fromPhaseId, toPhaseId, newOrder);

      // Persist to DB (async, rollback on error)
      ipc['step:move']({ stepId, targetPhaseId: toPhaseId, order: newOrder }).catch(() => {
        // Rollback: reload from DB
        ipc['step:listByPhase'](fromPhaseId).then((steps) => setSteps(fromPhaseId, steps));
        ipc['step:listByPhase'](toPhaseId).then((steps) => setSteps(toPhaseId, steps));
      });
    },
    [moveStep, setSteps],
  );

  const createPhase = async (name: string) => {
    const order = phases.length;
    const phase = await ipc['phase:create']({ buildId, name, order, wipLimit: null });
    useAppStore.getState().addPhase(phase);
  };

  const createStep = async (phaseId: string, title: string) => {
    const stepOrder = useAppStore.getState().stepOrder[phaseId] ?? [];
    const order = stepOrder.length;
    const step = await ipc['step:create']({
      buildId,
      phaseId,
      title,
      description: '',
      priority: 'medium',
      dueDate: null,
      order,
      createdBy: null,
    });
    useAppStore.getState().addStep(step);
  };

  const deleteStep = async (id: string) => {
    const step = useAppStore.getState().steps[id];
    if (!step) return;
    useAppStore.getState().removeStep(id);
    await ipc['step:delete'](id);
  };

  return { phases, handleDragEnd, createPhase, createStep, deleteStep };
}
