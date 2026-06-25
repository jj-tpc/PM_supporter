// renderer/components/deepwork/PomodoroTimer.tsx
import { memo } from 'react';

interface Props {
  seconds: number;
  total: number;
  running: boolean;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
}

export const PomodoroTimer = memo(function PomodoroTimer({
  seconds, total, running, onPause, onResume, onReset,
}: Props) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const progress = total > 0 ? ((total - seconds) / total) * 100 : 0;
  const isComplete = seconds === 0;

  return (
    <div className="text-center">
      {/* Timer display */}
      <div className="text-4xl font-mono font-light text-text-primary mb-3">
        {String(minutes).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-border rounded-full mb-4 mx-auto max-w-xs">
        <div
          className="h-full bg-accent rounded-full transition-all duration-1000"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Controls */}
      <div className="flex justify-center gap-3">
        {isComplete ? (
          <>
            <button
              onClick={onReset}
              className="px-4 py-2 text-sm bg-accent text-surface-raised rounded hover:bg-accent-hover"
            >
              다시 시작
            </button>
          </>
        ) : running ? (
          <button
            onClick={onPause}
            className="px-4 py-2 text-sm border border-border text-text-secondary rounded hover:text-text-primary hover:border-accent"
          >
            일시 정지
          </button>
        ) : (
          <button
            onClick={onResume}
            className="px-4 py-2 text-sm bg-accent text-surface-raised rounded hover:bg-accent-hover"
          >
            계속하기
          </button>
        )}
      </div>
    </div>
  );
});
