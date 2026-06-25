import { create } from 'zustand';
import type { Build, Phase, Step, Crew } from '../../shared/types';

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

  setBuilds: (builds: Build[]) => void;
  setPhases: (buildId: string, phases: Phase[]) => void;
  setSteps: (phaseId: string, steps: Step[]) => void;
  setCrews: (crews: Crew[]) => void;
  setActiveBuild: (id: string | null) => void;
  setDeepWork: (on: boolean) => void;
  setSyncStatus: (status: AppState['syncStatus']) => void;
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
}));
