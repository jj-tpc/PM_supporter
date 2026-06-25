// renderer/components/deepwork/SessionSummary.tsx
import { memo } from 'react';

interface Props {
  focusMinutes: number;
  stepsCompleted: number;
  onGoHome: () => void;
  onContinue: () => void;
}

export const SessionSummary = memo(function SessionSummary({
  focusMinutes, stepsCompleted, onGoHome, onContinue,
}: Props) {
  return (
    <div className="max-w-sm mx-auto text-center">
      <h2 className="text-xl font-semibold text-text-primary mb-6">Deep Work 세션 완료</h2>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="p-4 rounded-lg border border-border bg-surface-raised">
          <p className="text-2xl font-bold text-accent">{focusMinutes}분</p>
          <p className="text-xs text-text-secondary mt-1">집중 시간</p>
        </div>
        <div className="p-4 rounded-lg border border-border bg-surface-raised">
          <p className="text-2xl font-bold text-accent">{stepsCompleted}개</p>
          <p className="text-xs text-text-secondary mt-1">스텝 완료</p>
        </div>
      </div>

      <div className="flex justify-center gap-3">
        <button
          onClick={onGoHome}
          className="px-4 py-2 text-sm border border-border text-text-secondary rounded hover:text-text-primary"
        >
          홈으로
        </button>
        <button
          onClick={onContinue}
          className="px-4 py-2 text-sm bg-accent text-surface-raised rounded hover:bg-accent-hover"
        >
          한 세션 더
        </button>
      </div>
    </div>
  );
});
