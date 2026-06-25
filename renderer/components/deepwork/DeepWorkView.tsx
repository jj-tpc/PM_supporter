// renderer/components/deepwork/DeepWorkView.tsx
import { useMemo } from 'react';
import { useDeepWork } from '../../hooks/use-deep-work';
import { useAppStore } from '../../stores/app-store';
import { PomodoroTimer } from './PomodoroTimer';
import { FocusChecklist } from './FocusChecklist';
import { StepSelector } from './StepSelector';
import { FirstTimeGuide } from './FirstTimeGuide';

export function DeepWorkView() {
  const {
    currentStep, deepWorkStepId,
    timerSeconds, timerRunning, timerTotal,
    showGuide,
    enter, exit, completeStep, pause, resume,
    dismissGuide,
  } = useDeepWork();

  const calendarEvents = useAppStore((s) => s.calendarEvents);

  // Next upcoming event
  const nextEvent = useMemo(() => {
    const now = new Date();
    return Object.values(calendarEvents)
      .filter((e) => new Date(e.startTime) > now)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))[0] ?? null;
  }, [calendarEvents]);

  const minutesUntilNext = nextEvent
    ? Math.round((new Date(nextEvent.startTime).getTime() - Date.now()) / 60000)
    : null;

  // First time guide
  if (showGuide) {
    return <FirstTimeGuide onDismiss={dismissGuide} />;
  }

  // Step selection (no step chosen yet)
  if (!deepWorkStepId) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <StepSelector onSelect={(id) => enter(id)} onCancel={exit} />
      </div>
    );
  }

  // Main focus view
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 max-w-lg mx-auto">
      {/* Current step */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold text-text-primary mb-2">
          {currentStep?.title ?? '스텝 로딩 중...'}
        </h2>
        {currentStep?.dueDate && (
          <p className="text-sm text-text-secondary">
            마감: {new Date(currentStep.dueDate).toLocaleDateString('ko-KR')}
          </p>
        )}
      </div>

      {/* Timer */}
      <div className="mb-8 w-full">
        <PomodoroTimer
          seconds={timerSeconds}
          total={timerTotal}
          running={timerRunning}
          onPause={pause}
          onResume={resume}
          onReset={() => {
            useAppStore.getState().resetTimer();
            resume();
          }}
        />
      </div>

      {/* Checklist */}
      <div className="w-full mb-8">
        <FocusChecklist stepId={deepWorkStepId} />
      </div>

      {/* Next event */}
      {nextEvent && minutesUntilNext !== null && (
        <div className="w-full text-center py-3 border-t border-border">
          <p className="text-xs text-text-secondary">
            다음 일정: {nextEvent.summary} ({minutesUntilNext}분 후)
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 mt-4">
        <button
          onClick={completeStep}
          className="px-4 py-2 text-sm bg-accent text-surface-raised rounded hover:bg-accent-hover"
        >
          스텝 완료
        </button>
        <button
          onClick={pause}
          className="px-4 py-2 text-sm border border-border text-text-secondary rounded hover:text-text-primary"
        >
          잠시 멈춤
        </button>
      </div>
    </div>
  );
}
