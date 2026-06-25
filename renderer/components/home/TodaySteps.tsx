import { memo } from 'react';
import Link from 'next/link';
import type { Step } from '../../../shared/types';

interface StepWithBuild {
  step: Step;
  buildName: string;
}

interface Props {
  steps: StepWithBuild[];
}

const priorityDots: Record<string, string> = {
  critical: 'bg-danger',
  high: 'bg-warning',
  medium: 'bg-accent',
  low: 'bg-text-secondary',
};

export const TodaySteps = memo(function TodaySteps({ steps }: Props) {
  return (
    <div className="rounded-lg border border-border bg-surface-raised p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-primary">오늘의 스텝</h3>
        <Link href="/builds" className="text-xs text-accent hover:text-accent-hover">
          빌드 →
        </Link>
      </div>
      {steps.length === 0 ? (
        <p className="text-sm text-text-secondary">오늘 마감인 스텝이 없습니다</p>
      ) : (
        <ul className="space-y-2">
          {steps.map(({ step, buildName }) => (
            <li key={step.id} className="flex items-start gap-2">
              <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${priorityDots[step.priority]}`} />
              <div className="min-w-0">
                <p className="text-sm text-text-primary truncate">{step.title}</p>
                <p className="text-xs text-text-secondary">{buildName}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
