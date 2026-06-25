// renderer/components/ai/StructuredResult.tsx
import { memo, useMemo } from 'react';
import { ipc } from '../../lib/ipc-client';
import { useAppStore } from '../../stores/app-store';
import type { AIRoadmap } from '../../../shared/types';

interface Props {
  content: string;
}

export const StructuredResult = memo(function StructuredResult({ content }: Props) {
  const activeBuildId = useAppStore((s) => s.activeBuildId);

  const roadmap = useMemo(() => {
    const match = content.match(/```json\s*([\s\S]*?)```/);
    if (!match) return null;
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.type === 'roadmap' && Array.isArray(parsed.phases)) return parsed as AIRoadmap;
    } catch {}
    return null;
  }, [content]);

  if (!roadmap) return null;

  const applyToBuild = async () => {
    if (!activeBuildId) return;
    const stepsToCreate: Parameters<typeof ipc['step:createBatch']>[0] = [];
    for (const phase of roadmap.phases) {
      const createdPhase = await ipc['phase:create']({
        buildId: activeBuildId, name: phase.name,
        order: roadmap.phases.indexOf(phase), wipLimit: null,
      });
      for (let i = 0; i < phase.steps.length; i++) {
        const step = phase.steps[i];
        stepsToCreate.push({
          buildId: activeBuildId, phaseId: createdPhase.id,
          title: step.title, description: step.description,
          priority: step.priority, dueDate: null, order: i, createdBy: 'ai',
        });
      }
    }
    if (stepsToCreate.length > 0) await ipc['step:createBatch'](stepsToCreate);
    alert(`${roadmap.phases.length}개 페이즈, ${stepsToCreate.length}개 스텝이 빌드에 추가되었습니다.`);
  };

  return (
    <div className="my-2 rounded-lg border border-accent/30 bg-accent/5 p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-accent">로드맵</h4>
        {activeBuildId && (
          <button onClick={applyToBuild}
            className="text-xs px-2 py-1 bg-accent text-surface-raised rounded hover:bg-accent-hover">
            빌드에 적용
          </button>
        )}
      </div>
      {roadmap.phases.map((phase, i) => (
        <div key={i} className="mb-2">
          <p className="text-xs font-medium text-text-primary">
            {phase.name} {phase.durationWeeks && `(${phase.durationWeeks}주)`}
          </p>
          <ul className="ml-3 mt-1 space-y-0.5">
            {phase.steps.map((step, j) => (
              <li key={j} className="text-xs text-text-secondary">
                • {step.title} <span className="text-text-secondary/60 ml-1">[{step.priority}]</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
});
