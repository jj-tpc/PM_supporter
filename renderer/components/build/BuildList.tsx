// renderer/components/build/BuildList.tsx
import { useState } from 'react';
import { useRouter } from 'next/router';
import { useBuilds } from '../../hooks/use-builds';
import { CreateBuildDialog } from './CreateBuildDialog';

export function BuildList() {
  const { builds, createBuild, deleteBuild } = useBuilds();
  const [showCreate, setShowCreate] = useState(false);
  const router = useRouter();

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-text-primary">빌드</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 text-sm bg-accent text-surface-raised rounded hover:bg-accent-hover"
        >
          + 새 빌드
        </button>
      </div>

      {builds.length === 0 ? (
        <div className="text-center py-16 text-text-secondary">
          <p className="text-lg mb-2">아직 빌드가 없습니다</p>
          <p className="text-sm mb-4">새 빌드를 만들어 프로젝트를 시작하세요</p>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 text-sm bg-accent text-surface-raised rounded hover:bg-accent-hover"
          >
            첫 빌드 만들기
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {builds.map((build) => (
            <div
              key={build.id}
              onClick={() => router.push(`/builds/${build.id}`)}
              className="flex items-center justify-between p-4 rounded-lg border border-border bg-surface-raised hover:border-accent cursor-pointer transition-colors"
            >
              <div>
                <h3 className="font-medium text-text-primary">{build.name}</h3>
                {build.description && (
                  <p className="text-sm text-text-secondary mt-1">{build.description}</p>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`"${build.name}" 빌드를 삭제하시겠습니까?\n휴지통에서 30일간 복원 가능합니다.`)) {
                    deleteBuild(build.id);
                  }
                }}
                className="text-text-secondary hover:text-danger text-sm px-2 py-1"
              >
                삭제
              </button>
            </div>
          ))}
        </div>
      )}

      <CreateBuildDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={async (name, description) => {
          const build = await createBuild(name, description);
          router.push(`/builds/${build.id}`);
        }}
      />
    </div>
  );
}
