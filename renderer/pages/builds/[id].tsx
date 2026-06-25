import { useRouter } from 'next/router';
import { Board } from '../../components/kanban/Board';
import { StepDetail } from '../../components/kanban/StepDetail';
import { useAppStore } from '../../stores/app-store';

export default function BuildPage() {
  const router = useRouter();
  const buildId = router.query.id as string;
  const build = useAppStore((s) => s.builds[buildId]);
  const selectedStepId = useAppStore((s) => s.selectedStepId);

  if (!buildId) return null;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <h2 className="text-xl font-semibold text-text-primary">
          {build?.name ?? '로딩 중...'}
        </h2>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto">
          <Board buildId={buildId} />
        </div>
        {selectedStepId && <StepDetail />}
      </div>
    </div>
  );
}
