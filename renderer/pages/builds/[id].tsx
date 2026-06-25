import { useRouter } from 'next/router';
import { Board } from '../../components/kanban/Board';
import { useAppStore } from '../../stores/app-store';

export default function BuildPage() {
  const router = useRouter();
  const buildId = router.query.id as string;
  const build = useAppStore((s) => s.builds[buildId]);

  if (!buildId) return null;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <h2 className="text-xl font-semibold text-text-primary">
          {build?.name ?? '로딩 중...'}
        </h2>
      </div>
      <Board buildId={buildId} />
    </div>
  );
}
