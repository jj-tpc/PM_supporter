import { type ReactNode } from 'react';
import { useAppStore } from '../../stores/app-store';

interface ShellProps {
  children: ReactNode;
}

export function Shell({ children }: ShellProps) {
  const isDeepWork = useAppStore((s) => s.isDeepWork);
  const syncStatus = useAppStore((s) => s.syncStatus);
  const setDeepWork = useAppStore((s) => s.setDeepWork);

  return (
    <div data-mode={isDeepWork ? 'deepwork' : 'normal'} className="flex h-screen">
      {!isDeepWork && (
        <nav className="w-56 border-r border-border bg-surface-raised flex flex-col p-4">
          <h1 className="text-lg font-semibold text-text-primary mb-6">PM Supporter</h1>
          <ul className="space-y-2 flex-1">
            <li className="text-text-secondary hover:text-text-primary cursor-pointer">홈</li>
            <li className="text-text-secondary hover:text-text-primary cursor-pointer">빌드</li>
            <li className="text-text-secondary hover:text-text-primary cursor-pointer">캘린더</li>
          </ul>
          <div className="text-xs text-text-secondary">
            {syncStatus === 'synced' && '🟢 동기화됨'}
            {syncStatus === 'syncing' && '🔄 동기화 중'}
            {syncStatus === 'offline' && '🟡 오프라인'}
            {syncStatus === 'error' && '🔴 동기화 오류'}
          </div>
        </nav>
      )}

      <main className="flex-1 bg-surface overflow-auto">
        {children}
      </main>

      <button
        className="fixed bottom-6 left-6 w-12 h-12 bg-accent hover:bg-accent-hover text-surface-raised rounded-xl flex items-center justify-center shadow-lg transition-colors z-50"
        style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}
        title="AI"
      >
        AI
      </button>

      <button
        onClick={() => setDeepWork(!isDeepWork)}
        className="fixed top-4 right-4 px-3 py-1.5 text-sm rounded-full border border-border text-text-secondary hover:text-text-primary hover:border-accent transition-colors z-50"
      >
        {isDeepWork ? '🔴 Deep Work 종료' : '🔘 Deep Work'}
      </button>
    </div>
  );
}
