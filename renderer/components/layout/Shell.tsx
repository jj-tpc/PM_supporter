import { type ReactNode, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAppStore } from '../../stores/app-store';
import { FloatingCard } from '../ai/FloatingCard';
import { useAiChat } from '../../hooks/use-ai-chat';
import { DeepWorkView } from '../deepwork/DeepWorkView';
import { SplitViewPanel } from '../deepwork/SplitViewPanel';
import { useDeepWork } from '../../hooks/use-deep-work';

interface ShellProps {
  children: ReactNode;
}

export function Shell({ children }: ShellProps) {
  const isDeepWork = useAppStore((s) => s.isDeepWork);
  const syncStatus = useAppStore((s) => s.syncStatus);
  const setDeepWork = useAppStore((s) => s.setDeepWork);
  const router = useRouter();
  const { isOpen: aiOpen, open: openAi } = useAiChat();
  const { exit, splitView, splitTarget, closeSplitView, openSplitView } = useDeepWork();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDeepWork) {
        if (splitView) {
          closeSplitView();
        } else {
          exit();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDeepWork, splitView, closeSplitView, exit]);

  const navItems = [
    { href: '/home', label: '홈' },
    { href: '/builds', label: '빌드' },
    { href: '/calendar', label: '캘린더' },
  ];

  return (
    <div data-mode={isDeepWork ? 'deepwork' : 'normal'} className="flex h-screen">
      {!isDeepWork && (
        <nav className="w-56 border-r border-border bg-surface-raised flex flex-col p-4">
          <h1 className="text-lg font-semibold text-text-primary mb-6">PM Supporter</h1>
          <ul className="space-y-2 flex-1">
            {navItems.map(item => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`block px-2 py-1.5 rounded text-sm ${
                    router.pathname.startsWith(item.href)
                      ? 'text-text-primary bg-surface font-medium'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="text-xs text-text-secondary">
            {syncStatus === 'synced' && '🟢 동기화됨'}
            {syncStatus === 'syncing' && '🔄 동기화 중'}
            {syncStatus === 'offline' && '🟡 오프라인'}
            {syncStatus === 'error' && '🔴 동기화 오류'}
          </div>
        </nav>
      )}

      {isDeepWork ? (
        <div className="flex flex-1">
          <div className="flex-1">
            <DeepWorkView />
          </div>
          {splitView && splitTarget && (
            <SplitViewPanel target={splitTarget} onClose={closeSplitView} />
          )}
        </div>
      ) : (
        <main className="flex-1 bg-surface overflow-auto">
          {children}
        </main>
      )}

      <button
        onClick={openAi}
        className={`fixed bottom-6 left-6 w-12 h-12 ${
          aiOpen ? 'bg-accent-hover' : 'bg-accent hover:bg-accent-hover'
        } text-surface-raised rounded-xl flex items-center justify-center shadow-lg transition-colors z-50`}
        style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}
        title="AI"
      >
        AI
      </button>
      <FloatingCard />

      <button
        onClick={() => {
          if (isDeepWork) {
            exit();
          } else {
            setDeepWork(true);
          }
        }}
        className="fixed top-4 right-4 px-3 py-1.5 text-sm rounded-full border border-border text-text-secondary hover:text-text-primary hover:border-accent transition-colors z-50"
      >
        {isDeepWork ? '🔴 Deep Work 종료' : '🔘 Deep Work'}
      </button>

      {isDeepWork && (
        <div className="fixed bottom-6 right-6 flex gap-2 z-50">
          <button onClick={() => openSplitView('kanban')}
            className="px-3 py-1.5 text-xs bg-surface-raised border border-border text-text-secondary rounded hover:text-text-primary">
            칸반
          </button>
          <button onClick={() => openSplitView('calendar')}
            className="px-3 py-1.5 text-xs bg-surface-raised border border-border text-text-secondary rounded hover:text-text-primary">
            캘린더
          </button>
        </div>
      )}
    </div>
  );
}
