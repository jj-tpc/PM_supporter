# Plan 6: Deep Work — 토글 + 전환 시퀀스 + "지금 이것만" + 타이머 + Split View

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deep Work 토글 ON 시 앱이 극적으로 전환되어 "지금 이것만" 집중 화면을 보여주고, 포모도로 타이머, 체크리스트, Split View 참고 패널, 첫 진입 프리뷰 카드를 제공한다.

**Architecture:** Deep Work는 Shell.tsx의 `data-mode` 속성 전환으로 테마를 변경하고, 별도의 DeepWorkView 컴포넌트가 메인 콘텐츠를 대체한다. 타이머는 Zustand로 관리하고, IPC로 세션 시작/종료를 DB에 기록한다. Split View는 읽기 전용 참고 패널.

**Tech Stack:** React 19, Zustand (기존), Tailwind CSS 4, IPC (기존 deepwork:* 핸들러)

**Dependencies:** Plan 1 (IPC 핸들러), Plan 2 (칸반 — 스텝 데이터)

**이미 구현된 것:** isDeepWork/setDeepWork (Zustand), deepwork:start/end/getCurrent/updateContext (IPC), deep_work_sessions (SQLite), Shell.tsx 토글 버튼, Tailwind [data-mode='deepwork'] 테마

---

## File Structure

```
renderer/
├── components/
│   ├── layout/
│   │   └── Shell.tsx               # (수정) Deep Work 시 DeepWorkView 렌더
│   └── deepwork/
│       ├── DeepWorkView.tsx         # "지금 이것만" 메인 화면
│       ├── PomodoroTimer.tsx        # 포모도로 타이머 (프로그레스 바)
│       ├── FocusChecklist.tsx       # 현재 스텝 체크리스트
│       ├── StepSelector.tsx         # 스텝 선택 화면 (진입 시)
│       ├── SessionSummary.tsx       # 세션 종료 요약 카드
│       ├── SplitViewPanel.tsx       # 읽기 전용 참고 패널
│       └── FirstTimeGuide.tsx       # 첫 진입 프리뷰 카드 3장
├── hooks/
│   └── use-deep-work.ts            # Deep Work 세션 관리 hook
└── stores/
    └── app-store.ts                # (수정) Deep Work 확장 상태
```

---

### Task 1: Zustand Deep Work 확장 + hook

**Files:**
- Modify: `renderer/stores/app-store.ts`
- Create: `renderer/hooks/use-deep-work.ts`

- [ ] **Step 1: Zustand 확장**

`renderer/stores/app-store.ts`에 추가:

```typescript
// State
deepWorkStepId: string | null;         // 현재 집중 중인 스텝
deepWorkSessionId: string | null;      // 현재 세션 ID
deepWorkTimerSeconds: number;          // 타이머 남은 초
deepWorkTimerRunning: boolean;         // 타이머 진행 중
deepWorkTimerTotal: number;            // 타이머 전체 초 (기본 25*60)
deepWorkShowGuide: boolean;            // 첫 진입 가이드 표시 여부
deepWorkSplitView: boolean;            // Split View 열림 여부
deepWorkSplitTarget: 'kanban' | 'calendar' | null; // Split View 대상

// Actions
setDeepWorkStepId: (id: string | null) => void;
setDeepWorkSessionId: (id: string | null) => void;
setDeepWorkTimer: (seconds: number) => void;
setDeepWorkTimerRunning: (running: boolean) => void;
setDeepWorkTimerTotal: (total: number) => void;
setDeepWorkShowGuide: (show: boolean) => void;
setDeepWorkSplitView: (open: boolean) => void;
setDeepWorkSplitTarget: (target: 'kanban' | 'calendar' | null) => void;
tickTimer: () => void;
resetTimer: () => void;
```

Defaults: deepWorkStepId null, deepWorkSessionId null, deepWorkTimerSeconds 1500, deepWorkTimerRunning false, deepWorkTimerTotal 1500, deepWorkShowGuide true (첫 사용), deepWorkSplitView false, deepWorkSplitTarget null.

tickTimer: decrements deepWorkTimerSeconds by 1, stops at 0.
resetTimer: sets deepWorkTimerSeconds = deepWorkTimerTotal.

- [ ] **Step 2: use-deep-work hook**

```typescript
// renderer/hooks/use-deep-work.ts
import { useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '../stores/app-store';
import { ipc } from '../lib/ipc-client';

export function useDeepWork() {
  const {
    isDeepWork, setDeepWork,
    deepWorkStepId, setDeepWorkStepId,
    deepWorkSessionId, setDeepWorkSessionId,
    deepWorkTimerSeconds, deepWorkTimerRunning, deepWorkTimerTotal,
    setDeepWorkTimerRunning, tickTimer, resetTimer,
    deepWorkShowGuide, setDeepWorkShowGuide,
    deepWorkSplitView, deepWorkSplitTarget,
    setDeepWorkSplitView, setDeepWorkSplitTarget,
    steps,
  } = useAppStore();

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer tick
  useEffect(() => {
    if (deepWorkTimerRunning && deepWorkTimerSeconds > 0) {
      intervalRef.current = setInterval(() => {
        tickTimer();
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [deepWorkTimerRunning, deepWorkTimerSeconds > 0, tickTimer]);

  // Auto-pause at 0
  useEffect(() => {
    if (deepWorkTimerSeconds === 0 && deepWorkTimerRunning) {
      setDeepWorkTimerRunning(false);
    }
  }, [deepWorkTimerSeconds, deepWorkTimerRunning, setDeepWorkTimerRunning]);

  const enter = useCallback(async (stepId: string) => {
    // Start DB session
    const session = await ipc['deepwork:start']({ stepId });
    setDeepWorkSessionId(session.id);
    setDeepWorkStepId(stepId);
    resetTimer();
    setDeepWorkTimerRunning(true);
    setDeepWork(true);
  }, [setDeepWork, setDeepWorkSessionId, setDeepWorkStepId, resetTimer, setDeepWorkTimerRunning]);

  const exit = useCallback(async () => {
    // End DB session
    if (deepWorkSessionId) {
      await ipc['deepwork:end'](deepWorkSessionId);
    }
    setDeepWorkTimerRunning(false);
    setDeepWork(false);
    setDeepWorkStepId(null);
    setDeepWorkSessionId(null);
    setDeepWorkSplitView(false);
  }, [deepWorkSessionId, setDeepWork, setDeepWorkTimerRunning, setDeepWorkStepId, setDeepWorkSessionId, setDeepWorkSplitView]);

  const completeStep = useCallback(async () => {
    if (!deepWorkStepId) return;
    // Move step to done (optimistic)
    const step = steps[deepWorkStepId];
    if (step) {
      await ipc['step:update'](deepWorkStepId, { priority: step.priority });
    }
    setDeepWorkStepId(null);
    resetTimer();
    setDeepWorkTimerRunning(false);
  }, [deepWorkStepId, steps, setDeepWorkStepId, resetTimer, setDeepWorkTimerRunning]);

  const pause = useCallback(() => {
    setDeepWorkTimerRunning(false);
  }, [setDeepWorkTimerRunning]);

  const resume = useCallback(() => {
    if (deepWorkTimerSeconds > 0) {
      setDeepWorkTimerRunning(true);
    }
  }, [deepWorkTimerSeconds, setDeepWorkTimerRunning]);

  const saveContext = useCallback(async (note: string) => {
    if (deepWorkSessionId) {
      await ipc['deepwork:updateContext'](deepWorkSessionId, note);
    }
  }, [deepWorkSessionId]);

  const openSplitView = useCallback((target: 'kanban' | 'calendar') => {
    setDeepWorkSplitView(true);
    setDeepWorkSplitTarget(target);
  }, [setDeepWorkSplitView, setDeepWorkSplitTarget]);

  const closeSplitView = useCallback(() => {
    setDeepWorkSplitView(false);
    setDeepWorkSplitTarget(null);
  }, [setDeepWorkSplitView, setDeepWorkSplitTarget]);

  const dismissGuide = useCallback(() => {
    setDeepWorkShowGuide(false);
  }, [setDeepWorkShowGuide]);

  const currentStep = deepWorkStepId ? steps[deepWorkStepId] : null;

  return {
    isActive: isDeepWork,
    currentStep, deepWorkStepId, deepWorkSessionId,
    timerSeconds: deepWorkTimerSeconds,
    timerRunning: deepWorkTimerRunning,
    timerTotal: deepWorkTimerTotal,
    showGuide: deepWorkShowGuide,
    splitView: deepWorkSplitView,
    splitTarget: deepWorkSplitTarget,
    enter, exit, completeStep, pause, resume, saveContext,
    openSplitView, closeSplitView, dismissGuide,
  };
}
```

- [ ] **Step 3: 커밋**

```bash
git add renderer/stores/app-store.ts renderer/hooks/use-deep-work.ts
git commit -m "feat: Deep Work Zustand state and session management hook"
```

---

### Task 2: 포모도로 타이머 + 체크리스트 + 스텝 선택

**Files:**
- Create: `renderer/components/deepwork/PomodoroTimer.tsx`
- Create: `renderer/components/deepwork/FocusChecklist.tsx`
- Create: `renderer/components/deepwork/StepSelector.tsx`

- [ ] **Step 1: 디렉토리 생성**

```bash
mkdir -p renderer/components/deepwork
```

- [ ] **Step 2: PomodoroTimer**

```tsx
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
```

- [ ] **Step 3: FocusChecklist**

```tsx
// renderer/components/deepwork/FocusChecklist.tsx
import { memo, useEffect, useState } from 'react';
import { ipc } from '../../lib/ipc-client';
import type { ChecklistItem } from '../../../shared/types';

interface Props {
  stepId: string;
}

export const FocusChecklist = memo(function FocusChecklist({ stepId }: Props) {
  const [items, setItems] = useState<ChecklistItem[]>([]);

  useEffect(() => {
    ipc['checklist:list'](stepId).then(setItems);
  }, [stepId]);

  const toggle = async (item: ChecklistItem) => {
    const updated = await ipc['checklist:update'](item.id, { isChecked: !item.isChecked });
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  };

  if (items.length === 0) {
    return (
      <p className="text-sm text-text-secondary text-center py-4">
        체크리스트가 없습니다
      </p>
    );
  }

  const completed = items.filter((i) => i.isChecked).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-text-secondary">{completed}/{items.length} 완료</span>
      </div>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-2">
            <button
              onClick={() => toggle(item)}
              className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center text-xs ${
                item.isChecked
                  ? 'bg-accent border-accent text-surface-raised'
                  : 'border-border hover:border-accent'
              }`}
            >
              {item.isChecked && '✓'}
            </button>
            <span className={`text-sm ${item.isChecked ? 'text-text-secondary line-through' : 'text-text-primary'}`}>
              {item.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
});
```

- [ ] **Step 4: StepSelector**

Deep Work 진입 시 또는 스텝 완료 후 다음 스텝을 선택하는 화면.

```tsx
// renderer/components/deepwork/StepSelector.tsx
import { memo, useMemo } from 'react';
import { useAppStore } from '../../stores/app-store';
import type { Step } from '../../../shared/types';

interface Props {
  onSelect: (stepId: string) => void;
  onCancel: () => void;
}

export const StepSelector = memo(function StepSelector({ onSelect, onCancel }: Props) {
  const steps = useAppStore((s) => s.steps);
  const phases = useAppStore((s) => s.phases);

  const sortedSteps = useMemo(() => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return Object.values(steps)
      .filter((s) => {
        const phase = phases[s.phaseId];
        return phase && phase.name !== 'Done' && phase.name !== '완료';
      })
      .sort((a, b) => {
        // Priority first
        const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (pDiff !== 0) return pDiff;
        // Due date (sooner first)
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return 0;
      });
  }, [steps, phases]);

  const priorityColors: Record<string, string> = {
    critical: 'border-l-danger',
    high: 'border-l-warning',
    medium: 'border-l-accent',
    low: 'border-l-border',
  };

  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-xl font-semibold text-text-primary mb-2 text-center">
        집중할 스텝을 선택하세요
      </h2>
      <p className="text-sm text-text-secondary mb-6 text-center">
        우선순위와 마감일 기준으로 정렬되어 있습니다
      </p>

      {sortedSteps.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-text-secondary">진행 가능한 스텝이 없습니다</p>
          <button onClick={onCancel} className="mt-4 text-sm text-accent hover:text-accent-hover">
            돌아가기
          </button>
        </div>
      ) : (
        <div className="space-y-2 max-h-[50vh] overflow-auto">
          {sortedSteps.slice(0, 10).map((step) => (
            <button
              key={step.id}
              onClick={() => onSelect(step.id)}
              className={`w-full text-left p-3 rounded-lg border border-border bg-surface-raised hover:border-accent transition-colors border-l-4 ${priorityColors[step.priority]}`}
            >
              <p className="text-sm font-medium text-text-primary">{step.title}</p>
              <div className="flex gap-3 mt-1">
                <span className="text-xs text-text-secondary">{step.priority}</span>
                {step.dueDate && (
                  <span className="text-xs text-text-secondary">
                    마감: {new Date(step.dueDate).toLocaleDateString('ko-KR')}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
```

- [ ] **Step 5: 커밋**

```bash
git add renderer/components/deepwork/
git commit -m "feat: pomodoro timer, focus checklist, and step selector components"
```

---

### Task 3: DeepWorkView + 세션 요약 + 첫 진입 가이드

**Files:**
- Create: `renderer/components/deepwork/SessionSummary.tsx`
- Create: `renderer/components/deepwork/FirstTimeGuide.tsx`
- Create: `renderer/components/deepwork/DeepWorkView.tsx`

- [ ] **Step 1: SessionSummary**

```tsx
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
```

- [ ] **Step 2: FirstTimeGuide**

```tsx
// renderer/components/deepwork/FirstTimeGuide.tsx
import { memo, useState } from 'react';

interface Props {
  onDismiss: () => void;
}

const slides = [
  {
    title: '화면이 이렇게 바뀝니다',
    description: '다크 테마, 사이드바 숨김, 풀스크린 — 집중할 수 있는 환경이 됩니다.',
  },
  {
    title: '이런 기능이 켜집니다',
    description: '포모도로 타이머로 시간을 관리하고, 체크리스트로 진행 상황을 확인하세요.',
  },
  {
    title: '나갈 때는 이렇게',
    description: 'Esc를 두 번 누르거나 우상단 종료 버튼을 클릭하세요. 참고 패널로 다른 뷰를 잠깐 볼 수도 있습니다.',
  },
];

export const FirstTimeGuide = memo(function FirstTimeGuide({ onDismiss }: Props) {
  const [current, setCurrent] = useState(0);
  const [neverShow, setNeverShow] = useState(false);

  const isLast = current === slides.length - 1;

  const handleDismiss = () => {
    onDismiss();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
      <div className="bg-surface-raised rounded-xl p-8 max-w-md w-full shadow-2xl">
        {/* Slide indicator */}
        <div className="flex justify-center gap-2 mb-6">
          {slides.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full ${i === current ? 'bg-accent' : 'bg-border'}`}
            />
          ))}
        </div>

        <h3 className="text-lg font-semibold text-text-primary text-center mb-2">
          {slides[current].title}
        </h3>
        <p className="text-sm text-text-secondary text-center mb-8">
          {slides[current].description}
        </p>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs text-text-secondary">
            <input
              type="checkbox"
              checked={neverShow}
              onChange={(e) => setNeverShow(e.target.checked)}
              className="rounded"
            />
            다시 안 보기
          </label>

          <div className="flex gap-2">
            {current > 0 && (
              <button
                onClick={() => setCurrent(current - 1)}
                className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary"
              >
                이전
              </button>
            )}
            {isLast ? (
              <button
                onClick={handleDismiss}
                className="px-4 py-1.5 text-sm bg-accent text-surface-raised rounded hover:bg-accent-hover"
              >
                시작하기
              </button>
            ) : (
              <button
                onClick={() => setCurrent(current + 1)}
                className="px-3 py-1.5 text-sm bg-accent text-surface-raised rounded hover:bg-accent-hover"
              >
                다음
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
```

- [ ] **Step 3: DeepWorkView 메인 화면**

```tsx
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
```

- [ ] **Step 4: 커밋**

```bash
git add renderer/components/deepwork/
git commit -m "feat: DeepWorkView with step selector, timer, checklist, first-time guide"
```

---

### Task 4: Split View + Shell 연동 + Esc 핸들링

**Files:**
- Create: `renderer/components/deepwork/SplitViewPanel.tsx`
- Modify: `renderer/components/layout/Shell.tsx` — Deep Work 시 DeepWorkView 렌더, Esc 핸들링

- [ ] **Step 1: SplitViewPanel**

```tsx
// renderer/components/deepwork/SplitViewPanel.tsx
import { memo } from 'react';
import { useAppStore } from '../../stores/app-store';

interface Props {
  target: 'kanban' | 'calendar';
  onClose: () => void;
}

export const SplitViewPanel = memo(function SplitViewPanel({ target, onClose }: Props) {
  const builds = useAppStore((s) => s.builds);
  const phases = useAppStore((s) => s.phases);
  const steps = useAppStore((s) => s.steps);
  const stepOrder = useAppStore((s) => s.stepOrder);
  const phaseOrder = useAppStore((s) => s.phaseOrder);
  const calendarEvents = useAppStore((s) => s.calendarEvents);
  const activeBuildId = useAppStore((s) => s.activeBuildId);

  return (
    <div className="w-[35%] border-l border-border bg-surface-raised overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-text-primary">
          {target === 'kanban' ? '칸반 (읽기 전용)' : '캘린더 (읽기 전용)'}
        </h3>
        <button onClick={onClose} className="text-text-secondary hover:text-text-primary text-sm">✕</button>
      </div>

      {/* Content */}
      <div className="p-4">
        {target === 'kanban' && activeBuildId && (
          <div className="space-y-3">
            {(phaseOrder[activeBuildId] ?? []).map((phaseId) => {
              const phase = phases[phaseId];
              if (!phase) return null;
              const ids = stepOrder[phaseId] ?? [];
              return (
                <div key={phaseId}>
                  <h4 className="text-xs font-semibold text-text-secondary mb-1">
                    {phase.name} ({ids.length})
                  </h4>
                  <ul className="space-y-1">
                    {ids.slice(0, 5).map((sid) => {
                      const step = steps[sid];
                      if (!step) return null;
                      return (
                        <li key={sid} className="text-xs text-text-primary truncate px-2 py-1 bg-surface rounded">
                          {step.title}
                        </li>
                      );
                    })}
                    {ids.length > 5 && <li className="text-xs text-text-secondary px-2">+{ids.length - 5}</li>}
                  </ul>
                </div>
              );
            })}
          </div>
        )}

        {target === 'calendar' && (
          <div className="space-y-2">
            {Object.values(calendarEvents)
              .filter((e) => {
                const d = new Date(e.startTime);
                const today = new Date();
                return d.toDateString() === today.toDateString();
              })
              .sort((a, b) => a.startTime.localeCompare(b.startTime))
              .map((event) => (
                <div key={event.id} className="text-xs px-2 py-1.5 bg-surface rounded">
                  <span className="text-accent font-medium">
                    {new Date(event.startTime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {' '}{event.summary}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
});
```

- [ ] **Step 2: Shell.tsx 수정 — Deep Work 연동**

Read `renderer/components/layout/Shell.tsx`. Make these changes:

1. Import DeepWorkView and SplitViewPanel:
```tsx
import { DeepWorkView } from '../deepwork/DeepWorkView';
import { SplitViewPanel } from '../deepwork/SplitViewPanel';
import { useDeepWork } from '../../hooks/use-deep-work';
```

2. In Shell component, add:
```tsx
const { isActive, exit, splitView, splitTarget, closeSplitView, openSplitView } = useDeepWork();
```

3. When Deep Work is active, replace `<main>{children}</main>` with DeepWorkView + optional SplitView:
```tsx
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
```

4. Add Esc key handler:
```tsx
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && isDeepWork) {
      if (splitView) {
        closeSplitView();
      } else {
        // Double-Esc to exit: use a simple debounce
        exit();
      }
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [isDeepWork, splitView, closeSplitView, exit]);
```

5. Update Deep Work toggle to use the hook's enter/exit:
```tsx
<button
  onClick={() => isDeepWork ? exit() : setDeepWork(true)}
  // ... existing styling
>
```

Wait — entering Deep Work should show step selector first. Change the toggle to:
```tsx
onClick={() => {
  if (isDeepWork) {
    exit();
  } else {
    setDeepWork(true); // This triggers DeepWorkView which shows StepSelector
  }
}}
```

6. Add Split View buttons in the Deep Work toolbar area (inside the Deep Work view or as floating buttons):
```tsx
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
```

- [ ] **Step 3: 커밋**

```bash
git add renderer/components/deepwork/SplitViewPanel.tsx renderer/components/layout/Shell.tsx
git commit -m "feat: Deep Work Split View panel, Shell integration, and Esc handling"
```

---

### Task 5: 통합 테스트 + 푸쉬

**Files:** 전체 확인

- [ ] **Step 1: 전체 테스트**

```bash
pnpm vitest run
```

Expected: 16 tests PASS

- [ ] **Step 2: 앱 실행 확인**

```bash
pnpm dev
```

확인:
1. Deep Work 토글 → 다크 테마 전환 + 사이드바 숨김
2. (첫 진입) 가이드 카드 3장 표시 → "시작하기"
3. 스텝 선택 화면 → 스텝 클릭 → "지금 이것만" 화면
4. 포모도로 타이머 카운트다운, 일시 정지/재개
5. 체크리스트 표시 (있으면)
6. 다음 일정 표시 (캘린더 연결 시)
7. 우하단 "칸반" / "캘린더" 버튼 → Split View 열림/닫힘
8. Esc → Split View 닫힘 / (다시 Esc) Deep Work 종료
9. "스텝 완료" → 스텝 선택 화면으로 복귀
10. Deep Work 종료 → 일반 모드 복귀

- [ ] **Step 3: 푸쉬**

```bash
git push
```

---

## Summary

| Task | 내용 | 핵심 파일 |
|---|---|---|
| 1 | Zustand Deep Work 확장 + hook | app-store.ts, use-deep-work.ts |
| 2 | 포모도로 타이머 + 체크리스트 + 스텝 선택 | 3 컴포넌트 |
| 3 | DeepWorkView + 세션 요약 + 첫 진입 가이드 | 3 컴포넌트 |
| 4 | Split View + Shell 연동 + Esc 핸들링 | SplitViewPanel, Shell 수정 |
| 5 | 통합 + 푸쉬 | 전체 확인 |

**전체 커밋: 4회, 신규 컴포넌트: 7개**

**Fan-out 기회:**
- T1 (스토어+hook) → T2 (타이머/체크리스트)와 T3 (DeepWorkView) **거의 병렬 가능** (T3이 T2 컴포넌트를 import하므로 T2 먼저)
- T4 (Shell) → T5 (통합): 순차
