import { memo } from 'react';
import Link from 'next/link';
import type { OnboardingState } from '../../../shared/types';

interface Props {
  state: OnboardingState;
  onDismiss: () => void;
}

const items = [
  { key: 'buildCreated', label: '첫 빌드 만들기', href: '/builds' },
  { key: 'crewAdded', label: '크루 추가하기', href: '/builds' },
  { key: 'stepCreated', label: '스텝 만들기', href: '/builds' },
  { key: 'googleConnected', label: 'Google 캘린더 연결하기', href: '/calendar' },
  { key: 'deepWorkTried', label: '첫 Deep Work 해보기', href: null },
  { key: 'aiUsed', label: 'AI에게 로드맵 만들어달라고 하기', href: null },
] as const;

export const OnboardingChecklist = memo(function OnboardingChecklist({ state, onDismiss }: Props) {
  if (state.completedAt) return null;

  const completed = items.filter((item) => state[item.key]).length;
  const total = items.length;

  if (completed === total) return null;

  return (
    <div className="rounded-lg border border-border bg-surface-raised p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-primary">시작하기</h3>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-secondary">{completed}/{total} 완료</span>
          <button onClick={onDismiss} className="text-xs text-text-secondary hover:text-text-primary">
            닫기
          </button>
        </div>
      </div>
      {/* Progress bar */}
      <div className="h-1.5 bg-border rounded-full mb-3">
        <div
          className="h-full bg-accent rounded-full transition-all"
          style={{ width: `${(completed / total) * 100}%` }}
        />
      </div>
      <ul className="space-y-2">
        {items.map((item) => {
          const done = state[item.key];
          const content = (
            <li key={item.key} className="flex items-center gap-2 text-sm">
              <span className={done ? 'text-success' : 'text-text-secondary'}>
                {done ? '✅' : '□'}
              </span>
              <span className={done ? 'text-text-secondary line-through' : 'text-text-primary'}>
                {item.label}
              </span>
            </li>
          );
          if (!done && item.href) {
            return <Link key={item.key} href={item.href} className="block hover:bg-surface rounded px-1 -mx-1">{content}</Link>;
          }
          return content;
        })}
      </ul>
    </div>
  );
});
