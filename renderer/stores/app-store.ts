import { create } from 'zustand';
import type { Build, Phase, Step, Crew, CalendarEvent, CalendarViewType } from '../../shared/types';

interface AppState {
  builds: Record<string, Build>;
  phases: Record<string, Phase>;
  steps: Record<string, Step>;
  crews: Record<string, Crew>;
  phaseOrder: Record<string, string[]>;
  stepOrder: Record<string, string[]>;
  activeBuildId: string | null;
  isDeepWork: boolean;
  syncStatus: 'synced' | 'syncing' | 'offline' | 'error';
  selectedStepId: string | null;
  stepAssignees: Record<string, string[]>;
  calendarEvents: Record<string, CalendarEvent>;
  calendarView: CalendarViewType;
  calendarDate: string;
  googleConnected: boolean;

  setBuilds: (builds: Build[]) => void;
  setPhases: (buildId: string, phases: Phase[]) => void;
  setSteps: (phaseId: string, steps: Step[]) => void;
  setCrews: (crews: Crew[]) => void;
  setActiveBuild: (id: string | null) => void;
  setDeepWork: (on: boolean) => void;
  setSyncStatus: (status: AppState['syncStatus']) => void;

  addBuild: (build: Build) => void;
  removeBuild: (id: string) => void;
  addPhase: (phase: Phase) => void;
  removePhase: (id: string) => void;
  addStep: (step: Step) => void;
  updateStep: (id: string, changes: Partial<Step>) => void;
  removeStep: (id: string) => void;
  moveStep: (stepId: string, fromPhaseId: string, toPhaseId: string, newOrder: number) => void;
  addCrew: (crew: Crew) => void;
  removeCrew: (id: string) => void;
  setSelectedStep: (id: string | null) => void;
  setStepAssignees: (stepId: string, crewIds: string[]) => void;
  setCalendarEvents: (events: CalendarEvent[]) => void;
  setCalendarView: (view: CalendarViewType) => void;
  setCalendarDate: (date: string) => void;
  setGoogleConnected: (connected: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  builds: {},
  phases: {},
  steps: {},
  crews: {},
  phaseOrder: {},
  stepOrder: {},
  activeBuildId: null,
  isDeepWork: false,
  syncStatus: 'synced',
  selectedStepId: null,
  stepAssignees: {},
  calendarEvents: {},
  calendarView: 'month',
  calendarDate: new Date().toISOString(),
  googleConnected: false,

  setBuilds: (builds) => set({
    builds: Object.fromEntries(builds.map(b => [b.id, b])),
  }),
  setPhases: (buildId, phases) => set((state) => ({
    phases: { ...state.phases, ...Object.fromEntries(phases.map(p => [p.id, p])) },
    phaseOrder: { ...state.phaseOrder, [buildId]: phases.map(p => p.id) },
  })),
  setSteps: (phaseId, steps) => set((state) => ({
    steps: { ...state.steps, ...Object.fromEntries(steps.map(s => [s.id, s])) },
    stepOrder: { ...state.stepOrder, [phaseId]: steps.map(s => s.id) },
  })),
  setCrews: (crews) => set({
    crews: Object.fromEntries(crews.map(c => [c.id, c])),
  }),
  setActiveBuild: (id) => set({ activeBuildId: id }),
  setDeepWork: (on) => set({ isDeepWork: on }),
  setSyncStatus: (status) => set({ syncStatus: status }),

  addBuild: (build) => set((state) => ({
    builds: { ...state.builds, [build.id]: build },
  })),
  removeBuild: (id) => set((state) => {
    const { [id]: _, ...rest } = state.builds;
    return { builds: rest };
  }),
  addPhase: (phase) => set((state) => ({
    phases: { ...state.phases, [phase.id]: phase },
    phaseOrder: {
      ...state.phaseOrder,
      [phase.buildId]: [...(state.phaseOrder[phase.buildId] ?? []), phase.id],
    },
  })),
  removePhase: (id) => set((state) => {
    const { [id]: removed, ...restPhases } = state.phases;
    if (!removed) return {};
    const phaseOrder = { ...state.phaseOrder };
    if (phaseOrder[removed.buildId]) {
      phaseOrder[removed.buildId] = phaseOrder[removed.buildId].filter(pid => pid !== id);
    }
    return { phases: restPhases, phaseOrder };
  }),
  addStep: (step) => set((state) => ({
    steps: { ...state.steps, [step.id]: step },
    stepOrder: {
      ...state.stepOrder,
      [step.phaseId]: [...(state.stepOrder[step.phaseId] ?? []), step.id],
    },
  })),
  updateStep: (id, changes) => set((state) => ({
    steps: {
      ...state.steps,
      [id]: { ...state.steps[id], ...changes },
    },
  })),
  removeStep: (id) => set((state) => {
    const { [id]: removed, ...restSteps } = state.steps;
    if (!removed) return {};
    const stepOrder = { ...state.stepOrder };
    if (stepOrder[removed.phaseId]) {
      stepOrder[removed.phaseId] = stepOrder[removed.phaseId].filter(sid => sid !== id);
    }
    return { steps: restSteps, stepOrder };
  }),
  moveStep: (stepId, fromPhaseId, toPhaseId, newOrder) => set((state) => {
    const fromOrder = [...(state.stepOrder[fromPhaseId] ?? [])].filter(id => id !== stepId);
    const toOrder = fromPhaseId === toPhaseId
      ? fromOrder
      : [...(state.stepOrder[toPhaseId] ?? [])];
    toOrder.splice(newOrder, 0, stepId);
    return {
      steps: {
        ...state.steps,
        [stepId]: { ...state.steps[stepId], phaseId: toPhaseId, order: newOrder },
      },
      stepOrder: {
        ...state.stepOrder,
        [fromPhaseId]: fromOrder,
        [toPhaseId]: toOrder,
      },
    };
  }),
  addCrew: (crew) => set((state) => ({
    crews: { ...state.crews, [crew.id]: crew },
  })),
  removeCrew: (id) => set((state) => {
    const { [id]: _, ...rest } = state.crews;
    return { crews: rest };
  }),
  setSelectedStep: (id) => set({ selectedStepId: id }),
  setStepAssignees: (stepId, crewIds) => set((state) => ({
    stepAssignees: { ...state.stepAssignees, [stepId]: crewIds },
  })),
  setCalendarEvents: (events) => set({
    calendarEvents: Object.fromEntries(events.map(e => [e.id, e])),
  }),
  setCalendarView: (view) => set({ calendarView: view }),
  setCalendarDate: (date) => set({ calendarDate: date }),
  setGoogleConnected: (connected) => set({ googleConnected: connected }),
}));
