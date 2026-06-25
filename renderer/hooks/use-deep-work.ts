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
