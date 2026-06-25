# Plan 2: Kanban — 빌드/페이즈/스텝 UI + DnD + 크루 관리

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PM이 빌드(프로젝트)를 생성하고, 페이즈(컬럼) 위에 스텝(태스크 카드)을 배치하고, 드래그 앤 드롭으로 이동하고, 크루(팀원)를 배정할 수 있는 칸반 보드 UI를 구현한다.

**Architecture:** Renderer에서 Zustand 정규화 스토어를 통해 데이터를 관리하고, IPC로 Main process의 SQLite를 읽고 쓴다. DnD는 @dnd-kit으로 구현하고, optimistic update를 적용한다. 컴포넌트는 `memo` + selector 패턴으로 리렌더를 최소화한다.

**Tech Stack:** React 19, @dnd-kit/core + @dnd-kit/sortable, Zustand (기존 store 확장), Tailwind CSS 4, IPC client (기존)

**Dependencies:** Plan 1 완료 필수 (SQLite, IPC handlers, Zustand store, App Shell)

---

## File Structure (Plan 2에서 생성/수정하는 파일)

```
renderer/
├── pages/
│   ├── builds/
│   │   ├── index.tsx              # 빌드 목록 페이지
│   │   └── [id].tsx               # 개별 빌드 칸반 보드 페이지
│   └── home.tsx                   # (수정) 빌드 목록 연결
├── components/
│   ├── layout/
│   │   └── Shell.tsx              # (수정) 사이드바 네비게이션 + 라우팅
│   ├── build/
│   │   ├── BuildList.tsx          # 빌드 목록 컴포넌트
│   │   └── CreateBuildDialog.tsx  # 빌드 생성 다이얼로그
│   ├── kanban/
│   │   ├── Board.tsx              # 칸반 보드 컨테이너 (DnD Context)
│   │   ├── PhaseColumn.tsx        # 페이즈 컬럼
│   │   ├── StepCard.tsx           # 스텝 카드
│   │   ├── StepDetail.tsx         # 스텝 상세 사이드 패널
│   │   ├── CreateStepInput.tsx    # 인라인 스텝 추가 입력
│   │   └── CreatePhaseButton.tsx  # 페이즈 추가 버튼
│   └── crew/
│       ├── CrewList.tsx           # 크루 관리 목록
│       ├── CrewAvatar.tsx         # 크루 아바타 (재사용)
│       └── CrewAssignPopover.tsx  # 스텝에 크루 배정 팝오버
├── stores/
│   └── app-store.ts              # (수정) 칸반 관련 액션 추가
├── hooks/
│   ├── use-builds.ts             # 빌드 CRUD hooks
│   ├── use-kanban.ts             # 칸반 보드 데이터 로딩 + DnD 핸들러
│   └── use-crews.ts              # 크루 CRUD hooks
└── lib/
    └── ipc-client.ts             # (기존, 수정 없음)
```

---

### Task 1: @dnd-kit 설치 + Zustand 스토어 확장

**Files:**
- Modify: `renderer/stores/app-store.ts`
- Create: `renderer/hooks/use-builds.ts`
- Create: `renderer/hooks/use-kanban.ts`
- Create: `renderer/hooks/use-crews.ts`

- [ ] **Step 1: @dnd-kit 설치**

```bash
cd /c/Users/twoja/project_tpc/PM_supporter
pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 2: Zustand 스토어에 칸반 액션 추가**

`renderer/stores/app-store.ts`에 다음 액션을 추가한다. 기존 인터페이스와 구현을 유지하면서 확장:

```typescript
// 기존 AppState 인터페이스에 추가할 필드/액션:

// 액션 추가
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

// selectedStepId: 스텝 상세 패널용
selectedStepId: string | null;
setSelectedStep: (id: string | null) => void;
```

구현에서 `moveStep`은 optimistic update — Zustand 상태를 즉시 변경하고, IPC 호출은 hook에서 별도로 처리:

```typescript
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
```

- [ ] **Step 3: 커스텀 hooks 생성**

`renderer/hooks/use-builds.ts`:
```typescript
import { useEffect } from 'react';
import { useAppStore } from '../stores/app-store';
import { ipc } from '../lib/ipc-client';

export function useBuilds() {
  const builds = useAppStore((s) => Object.values(s.builds));
  const setBuilds = useAppStore((s) => s.setBuilds);

  useEffect(() => {
    ipc['build:list']().then(setBuilds);
  }, [setBuilds]);

  const createBuild = async (name: string, description: string) => {
    const build = await ipc['build:create']({ name, description });
    useAppStore.getState().addBuild(build);
    return build;
  };

  const deleteBuild = async (id: string) => {
    await ipc['build:delete'](id);
    useAppStore.getState().removeBuild(id);
  };

  return { builds, createBuild, deleteBuild };
}
```

`renderer/hooks/use-kanban.ts`:
```typescript
import { useEffect, useCallback } from 'react';
import { useAppStore } from '../stores/app-store';
import { ipc } from '../lib/ipc-client';
import type { DragEndEvent } from '@dnd-kit/core';

export function useKanban(buildId: string) {
  const phases = useAppStore(
    useCallback((s) => (s.phaseOrder[buildId] ?? []).map(id => s.phases[id]).filter(Boolean), [buildId])
  );
  const setPhases = useAppStore((s) => s.setPhases);
  const setSteps = useAppStore((s) => s.setSteps);
  const moveStep = useAppStore((s) => s.moveStep);

  useEffect(() => {
    async function load() {
      const phaseList = await ipc['phase:list'](buildId);
      setPhases(buildId, phaseList);
      for (const phase of phaseList) {
        const steps = await ipc['step:listByPhase'](phase.id);
        setSteps(phase.id, steps);
      }
    }
    load();
  }, [buildId, setPhases, setSteps]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const stepId = active.id as string;
    const step = useAppStore.getState().steps[stepId];
    if (!step) return;

    const fromPhaseId = step.phaseId;
    // over.id could be a step or a phase column
    const overData = over.data.current;
    const toPhaseId = overData?.phaseId ?? (over.id as string);
    const newOrder = overData?.sortable?.index ?? 0;

    // Optimistic update
    moveStep(stepId, fromPhaseId, toPhaseId, newOrder);

    // Persist to DB (async, rollback on error)
    ipc['step:move']({ stepId, targetPhaseId: toPhaseId, order: newOrder }).catch(() => {
      // Rollback: reload from DB
      ipc['step:listByPhase'](fromPhaseId).then(steps => setSteps(fromPhaseId, steps));
      ipc['step:listByPhase'](toPhaseId).then(steps => setSteps(toPhaseId, steps));
    });
  }, [moveStep, setSteps]);

  const createPhase = async (name: string) => {
    const order = phases.length;
    const phase = await ipc['phase:create']({ buildId, name, order, wipLimit: null });
    useAppStore.getState().addPhase(phase);
  };

  const createStep = async (phaseId: string, title: string) => {
    const stepOrder = useAppStore.getState().stepOrder[phaseId] ?? [];
    const order = stepOrder.length;
    const step = await ipc['step:create']({
      buildId, phaseId, title, description: '', priority: 'medium',
      dueDate: null, order, createdBy: null,
    });
    useAppStore.getState().addStep(step);
  };

  const deleteStep = async (id: string) => {
    const step = useAppStore.getState().steps[id];
    if (!step) return;
    useAppStore.getState().removeStep(id);
    await ipc['step:delete'](id);
  };

  return { phases, handleDragEnd, createPhase, createStep, deleteStep };
}
```

`renderer/hooks/use-crews.ts`:
```typescript
import { useEffect } from 'react';
import { useAppStore } from '../stores/app-store';
import { ipc } from '../lib/ipc-client';

export function useCrews() {
  const crews = useAppStore((s) => Object.values(s.crews));
  const setCrews = useAppStore((s) => s.setCrews);

  useEffect(() => {
    ipc['crew:list']().then(setCrews);
  }, [setCrews]);

  const createCrew = async (name: string, role?: string) => {
    const crew = await ipc['crew:create']({ name, email: null, role: role ?? null, avatarUrl: null });
    useAppStore.getState().addCrew(crew);
    return crew;
  };

  const deleteCrew = async (id: string) => {
    await ipc['crew:delete'](id);
    useAppStore.getState().removeCrew(id);
  };

  return { crews, createCrew, deleteCrew };
}
```

- [ ] **Step 4: 커밋**

```bash
git add renderer/stores/app-store.ts renderer/hooks/
git commit -m "feat: extend Zustand store with kanban actions and add data hooks"
```

---

### Task 2: 빌드 목록 페이지

**Files:**
- Create: `renderer/pages/builds/index.tsx`
- Create: `renderer/components/build/BuildList.tsx`
- Create: `renderer/components/build/CreateBuildDialog.tsx`
- Modify: `renderer/components/layout/Shell.tsx` — 사이드바 네비게이션에 라우팅 추가

- [ ] **Step 1: Next.js 라우터 확인**

Nextron은 파일 기반 라우팅을 사용한다. `renderer/pages/builds/index.tsx` → `/builds` 경로.

```bash
mkdir -p renderer/pages/builds renderer/components/build
```

- [ ] **Step 2: CreateBuildDialog 컴포넌트**

```tsx
// renderer/components/build/CreateBuildDialog.tsx
import { useState, type FormEvent } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string) => Promise<void>;
}

export function CreateBuildDialog({ open, onClose, onCreate }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    await onCreate(name.trim(), description.trim());
    setName('');
    setDescription('');
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="bg-surface-raised rounded-lg p-6 w-96 shadow-xl"
      >
        <h3 className="text-lg font-semibold text-text-primary mb-4">새 빌드 만들기</h3>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="빌드 이름"
          className="w-full px-3 py-2 rounded border border-border bg-surface text-text-primary placeholder:text-text-secondary mb-3 outline-none focus:border-accent"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="설명 (선택)"
          rows={3}
          className="w-full px-3 py-2 rounded border border-border bg-surface text-text-primary placeholder:text-text-secondary mb-4 outline-none focus:border-accent resize-none"
        />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary">
            취소
          </button>
          <button
            type="submit"
            disabled={!name.trim() || loading}
            className="px-4 py-2 text-sm bg-accent text-surface-raised rounded hover:bg-accent-hover disabled:opacity-50"
          >
            {loading ? '생성 중...' : '만들기'}
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: BuildList 컴포넌트**

```tsx
// renderer/components/build/BuildList.tsx
import { useState } from 'react';
import { useRouter } from 'next/router';
import { useBuilds } from '../../hooks/use-builds';
import { CreateBuildDialog } from './CreateBuildDialog';

export function BuildList() {
  const { builds, createBuild, deleteBuild } = useBuilds();
  const [showCreate, setShowCreate] = useState(false);
  const router = useRouter();

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-text-primary">빌드</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 text-sm bg-accent text-surface-raised rounded hover:bg-accent-hover"
        >
          + 새 빌드
        </button>
      </div>

      {builds.length === 0 ? (
        <div className="text-center py-16 text-text-secondary">
          <p className="text-lg mb-2">아직 빌드가 없습니다</p>
          <p className="text-sm mb-4">새 빌드를 만들어 프로젝트를 시작하세요</p>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 text-sm bg-accent text-surface-raised rounded hover:bg-accent-hover"
          >
            첫 빌드 만들기
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {builds.map((build) => (
            <div
              key={build.id}
              onClick={() => router.push(`/builds/${build.id}`)}
              className="flex items-center justify-between p-4 rounded-lg border border-border bg-surface-raised hover:border-accent cursor-pointer transition-colors"
            >
              <div>
                <h3 className="font-medium text-text-primary">{build.name}</h3>
                {build.description && (
                  <p className="text-sm text-text-secondary mt-1">{build.description}</p>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`"${build.name}" 빌드를 삭제하시겠습니까?\n휴지통에서 30일간 복원 가능합니다.`)) {
                    deleteBuild(build.id);
                  }
                }}
                className="text-text-secondary hover:text-danger text-sm px-2 py-1"
              >
                삭제
              </button>
            </div>
          ))}
        </div>
      )}

      <CreateBuildDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={async (name, description) => {
          const build = await createBuild(name, description);
          router.push(`/builds/${build.id}`);
        }}
      />
    </div>
  );
}
```

- [ ] **Step 4: 빌드 목록 페이지**

```tsx
// renderer/pages/builds/index.tsx
import { BuildList } from '../../components/build/BuildList';

export default function BuildsPage() {
  return <BuildList />;
}
```

- [ ] **Step 5: Shell.tsx 사이드바에 라우팅 추가**

Shell.tsx의 사이드바 `<li>` 항목들을 Next.js `Link`로 교체한다:

```tsx
// Shell.tsx 수정 — import 추가
import Link from 'next/link';
import { useRouter } from 'next/router';

// <ul> 내부를 다음으로 교체:
const router = useRouter();
const navItems = [
  { href: '/home', label: '홈' },
  { href: '/builds', label: '빌드' },
  { href: '/calendar', label: '캘린더' },
];

// ... ul 내부:
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
```

- [ ] **Step 6: 앱 실행 확인**

```bash
pnpm dev
```

Expected: 사이드바에서 "빌드" 클릭 → 빌드 목록 페이지, "새 빌드" 클릭 → 다이얼로그, 생성 후 이동

- [ ] **Step 7: 커밋**

```bash
git add renderer/pages/builds/ renderer/components/build/ renderer/components/layout/Shell.tsx
git commit -m "feat: build list page with create dialog and sidebar navigation"
```

---

### Task 3: 칸반 보드 — 페이즈 컬럼 + 스텝 카드

**Files:**
- Create: `renderer/pages/builds/[id].tsx`
- Create: `renderer/components/kanban/Board.tsx`
- Create: `renderer/components/kanban/PhaseColumn.tsx`
- Create: `renderer/components/kanban/StepCard.tsx`
- Create: `renderer/components/kanban/CreateStepInput.tsx`
- Create: `renderer/components/kanban/CreatePhaseButton.tsx`

- [ ] **Step 1: 디렉토리 생성**

```bash
mkdir -p renderer/components/kanban
```

- [ ] **Step 2: StepCard 컴포넌트 (memo 적용)**

```tsx
// renderer/components/kanban/StepCard.tsx
import { memo, useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAppStore } from '../../stores/app-store';

interface Props {
  stepId: string;
}

export const StepCard = memo(function StepCard({ stepId }: Props) {
  const step = useAppStore(useCallback((s) => s.steps[stepId], [stepId]));
  const setSelectedStep = useAppStore((s) => s.setSelectedStep);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: stepId,
    data: { phaseId: step?.phaseId },
  });

  if (!step) return null;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const priorityColors = {
    critical: 'border-l-danger',
    high: 'border-l-warning',
    medium: 'border-l-accent',
    low: 'border-l-border',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => setSelectedStep(stepId)}
      className={`p-3 rounded-lg border border-border bg-surface-raised cursor-grab active:cursor-grabbing hover:border-accent transition-colors border-l-4 ${priorityColors[step.priority]}`}
    >
      <p className="text-sm text-text-primary font-medium">{step.title}</p>
      {step.dueDate && (
        <p className="text-xs text-text-secondary mt-1">
          마감: {new Date(step.dueDate).toLocaleDateString('ko-KR')}
        </p>
      )}
    </div>
  );
});
```

- [ ] **Step 3: CreateStepInput 컴포넌트**

```tsx
// renderer/components/kanban/CreateStepInput.tsx
import { useState, type KeyboardEvent } from 'react';

interface Props {
  onSubmit: (title: string) => void;
}

export function CreateStepInput({ onSubmit }: Props) {
  const [title, setTitle] = useState('');
  const [editing, setEditing] = useState(false);

  const handleSubmit = () => {
    if (!title.trim()) return;
    onSubmit(title.trim());
    setTitle('');
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      setEditing(false);
      setTitle('');
    }
  };

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="w-full text-left text-sm text-text-secondary hover:text-text-primary px-3 py-2 rounded hover:bg-surface transition-colors"
      >
        + 스텝 추가
      </button>
    );
  }

  return (
    <input
      autoFocus
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => { handleSubmit(); setEditing(false); }}
      placeholder="스텝 제목 입력 후 Enter"
      className="w-full text-sm px-3 py-2 rounded border border-accent bg-surface text-text-primary placeholder:text-text-secondary outline-none"
    />
  );
}
```

- [ ] **Step 4: PhaseColumn 컴포넌트 (memo 적용)**

```tsx
// renderer/components/kanban/PhaseColumn.tsx
import { memo, useCallback } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useAppStore } from '../../stores/app-store';
import { StepCard } from './StepCard';
import { CreateStepInput } from './CreateStepInput';

interface Props {
  phaseId: string;
  onCreateStep: (phaseId: string, title: string) => void;
}

export const PhaseColumn = memo(function PhaseColumn({ phaseId, onCreateStep }: Props) {
  const phase = useAppStore(useCallback((s) => s.phases[phaseId], [phaseId]));
  const stepIds = useAppStore(useCallback((s) => s.stepOrder[phaseId] ?? [], [phaseId]));

  const { setNodeRef, isOver } = useDroppable({
    id: phaseId,
    data: { phaseId },
  });

  if (!phase) return null;

  return (
    <div className="flex-shrink-0 w-72">
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="text-sm font-semibold text-text-primary">{phase.name}</h3>
        <span className="text-xs text-text-secondary">{stepIds.length}</span>
      </div>

      <div
        ref={setNodeRef}
        className={`space-y-2 min-h-[200px] p-2 rounded-lg transition-colors ${
          isOver ? 'bg-accent/10' : 'bg-transparent'
        }`}
      >
        <SortableContext items={stepIds} strategy={verticalListSortingStrategy}>
          {stepIds.map((id) => (
            <StepCard key={id} stepId={id} />
          ))}
        </SortableContext>

        <CreateStepInput onSubmit={(title) => onCreateStep(phaseId, title)} />
      </div>
    </div>
  );
});
```

- [ ] **Step 5: CreatePhaseButton 컴포넌트**

```tsx
// renderer/components/kanban/CreatePhaseButton.tsx
import { useState, type KeyboardEvent } from 'react';

interface Props {
  onSubmit: (name: string) => void;
}

export function CreatePhaseButton({ onSubmit }: Props) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSubmit(name.trim());
    setName('');
    setEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); }
    if (e.key === 'Escape') { setEditing(false); setName(''); }
  };

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="flex-shrink-0 w-72 h-12 rounded-lg border border-dashed border-border text-text-secondary hover:text-text-primary hover:border-accent transition-colors text-sm"
      >
        + 페이즈 추가
      </button>
    );
  }

  return (
    <div className="flex-shrink-0 w-72">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { handleSubmit(); setEditing(false); }}
        placeholder="페이즈 이름"
        className="w-full text-sm px-3 py-2 rounded border border-accent bg-surface text-text-primary outline-none"
      />
    </div>
  );
}
```

- [ ] **Step 6: Board 컴포넌트 (DnD Context)**

```tsx
// renderer/components/kanban/Board.tsx
import {
  DndContext,
  DragOverlay,
  closestCorners,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useState } from 'react';
import { useKanban } from '../../hooks/use-kanban';
import { PhaseColumn } from './PhaseColumn';
import { CreatePhaseButton } from './CreatePhaseButton';
import { StepCard } from './StepCard';

interface Props {
  buildId: string;
}

export function Board({ buildId }: Props) {
  const { phases, handleDragEnd, createPhase, createStep } = useKanban(buildId);
  const [activeId, setActiveId] = useState<string | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  return (
    <DndContext
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={(e) => { handleDragEnd(e); setActiveId(null); }}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex gap-4 overflow-x-auto p-6 h-full items-start">
        {phases.map((phase) => (
          <PhaseColumn
            key={phase.id}
            phaseId={phase.id}
            onCreateStep={createStep}
          />
        ))}
        <CreatePhaseButton onSubmit={createPhase} />
      </div>

      <DragOverlay>
        {activeId ? <StepCard stepId={activeId} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
```

- [ ] **Step 7: 빌드 상세 페이지 (칸반 보드)**

```tsx
// renderer/pages/builds/[id].tsx
import { useRouter } from 'next/router';
import { Board } from '../../components/kanban/Board';
import { useAppStore } from '../../stores/app-store';

export default function BuildPage() {
  const router = useRouter();
  const buildId = router.query.id as string;
  const build = useAppStore((s) => s.builds[buildId]);

  if (!buildId) return null;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <h2 className="text-xl font-semibold text-text-primary">
          {build?.name ?? '로딩 중...'}
        </h2>
      </div>
      <Board buildId={buildId} />
    </div>
  );
}
```

- [ ] **Step 8: 앱 실행 확인**

```bash
pnpm dev
```

Expected:
- 빌드 목록에서 빌드 클릭 → 칸반 보드 표시
- 페이즈 추가 → 새 컬럼 생성
- 스텝 추가 → 카드 생성 (인라인 입력)
- 카드 드래그 → 컬럼 간 이동 (optimistic)

- [ ] **Step 9: 커밋**

```bash
git add renderer/pages/builds/ renderer/components/kanban/
git commit -m "feat: kanban board with phases, step cards, and drag-and-drop"
```

---

### Task 4: 스텝 상세 사이드 패널

**Files:**
- Create: `renderer/components/kanban/StepDetail.tsx`
- Modify: `renderer/pages/builds/[id].tsx` — 상세 패널 연동

- [ ] **Step 1: StepDetail 컴포넌트**

스텝 카드 클릭 시 오른쪽에서 슬라이드하는 사이드 패널. 제목 수정, 설명 수정, 우선순위 변경, 마감일 설정, 삭제 기능.

```tsx
// renderer/components/kanban/StepDetail.tsx
import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../../stores/app-store';
import { ipc } from '../../lib/ipc-client';

export function StepDetail() {
  const selectedStepId = useAppStore((s) => s.selectedStepId);
  const step = useAppStore(useCallback((s) => selectedStepId ? s.steps[selectedStepId] : null, [selectedStepId]));
  const setSelectedStep = useAppStore((s) => s.setSelectedStep);
  const updateStep = useAppStore((s) => s.updateStep);
  const removeStep = useAppStore((s) => s.removeStep);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (step) {
      setTitle(step.title);
      setDescription(step.description);
    }
  }, [step]);

  if (!step || !selectedStepId) return null;

  const save = async (changes: Record<string, unknown>) => {
    updateStep(selectedStepId, changes);
    await ipc['step:update'](selectedStepId, changes);
  };

  const handleDelete = async () => {
    if (!confirm('이 스텝을 삭제하시겠습니까?\n휴지통에서 30일간 복원 가능합니다.')) return;
    setSelectedStep(null);
    removeStep(selectedStepId);
    await ipc['step:delete'](selectedStepId);
  };

  const priorities = [
    { value: 'critical', label: 'Critical', color: 'text-danger' },
    { value: 'high', label: 'High', color: 'text-warning' },
    { value: 'medium', label: 'Medium', color: 'text-accent' },
    { value: 'low', label: 'Low', color: 'text-text-secondary' },
  ] as const;

  return (
    <div className="w-96 border-l border-border bg-surface-raised flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="text-sm font-semibold text-text-secondary">스텝 상세</h3>
        <button onClick={() => setSelectedStep(null)} className="text-text-secondary hover:text-text-primary">
          ✕
        </button>
      </div>

      {/* 내용 */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* 제목 */}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title !== step.title && save({ title })}
          className="w-full text-lg font-semibold bg-transparent text-text-primary outline-none border-b border-transparent focus:border-accent pb-1"
        />

        {/* 우선순위 */}
        <div>
          <label className="text-xs text-text-secondary block mb-1">우선순위</label>
          <div className="flex gap-2">
            {priorities.map((p) => (
              <button
                key={p.value}
                onClick={() => save({ priority: p.value })}
                className={`text-xs px-2 py-1 rounded border ${
                  step.priority === p.value
                    ? 'border-accent bg-accent/10 font-medium'
                    : 'border-border hover:border-accent'
                } ${p.color}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* 마감일 */}
        <div>
          <label className="text-xs text-text-secondary block mb-1">마감일</label>
          <input
            type="date"
            value={step.dueDate?.split('T')[0] ?? ''}
            onChange={(e) => save({ dueDate: e.target.value ? new Date(e.target.value).toISOString() : null })}
            className="text-sm px-3 py-1.5 rounded border border-border bg-surface text-text-primary outline-none focus:border-accent"
          />
        </div>

        {/* 설명 */}
        <div>
          <label className="text-xs text-text-secondary block mb-1">설명</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => description !== step.description && save({ description })}
            rows={6}
            placeholder="스텝 설명을 입력하세요..."
            className="w-full text-sm px-3 py-2 rounded border border-border bg-surface text-text-primary placeholder:text-text-secondary outline-none focus:border-accent resize-none"
          />
        </div>
      </div>

      {/* 삭제 */}
      <div className="p-4 border-t border-border">
        <button
          onClick={handleDelete}
          className="text-sm text-danger hover:text-danger/80"
        >
          스텝 삭제
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 빌드 페이지에 상세 패널 연동**

`renderer/pages/builds/[id].tsx`를 수정하여 `StepDetail`을 Board 옆에 배치:

```tsx
// [id].tsx에 추가
import { StepDetail } from '../../components/kanban/StepDetail';
import { useAppStore } from '../../stores/app-store';

// return 부분 수정:
const selectedStepId = useAppStore((s) => s.selectedStepId);

return (
  <div className="flex flex-col h-full">
    <div className="flex items-center justify-between px-6 py-4 border-b border-border">
      <h2 className="text-xl font-semibold text-text-primary">
        {build?.name ?? '로딩 중...'}
      </h2>
    </div>
    <div className="flex flex-1 overflow-hidden">
      <div className="flex-1 overflow-auto">
        <Board buildId={buildId} />
      </div>
      {selectedStepId && <StepDetail />}
    </div>
  </div>
);
```

- [ ] **Step 3: step:update IPC 핸들러 확인**

`main/ipc/register.ts`에 `step:update` 핸들러가 있는지 확인한다. 없으면 추가:

```typescript
handle('step:update', (id, changes) => {
  const step = stmts.getStep.get(id) as Record<string, unknown> | undefined;
  if (!step) throw new Error(`Step not found: ${id}`);

  const updatable = ['title', 'description', 'priority', 'due_date'] as const;
  const setClauses: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(changes)) {
    const snakeKey = key.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`);
    if (updatable.includes(snakeKey as any)) {
      setClauses.push(`"${snakeKey}" = ?`);
      values.push(value);
    }
  }

  if (setClauses.length > 0) {
    setClauses.push('"updated_at" = ?');
    values.push(now());
    values.push(id);
    db.prepare(`UPDATE steps SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
  }

  const updated = stmts.getStep.get(id) as Step;
  bus.emit('step:updated', { stepId: id, changes: changes as Partial<Step> });
  return updated;
});
```

- [ ] **Step 4: 앱 실행 확인**

```bash
pnpm dev
```

Expected: 스텝 카드 클릭 → 오른쪽 상세 패널 표시, 제목/우선순위/마감일/설명 편집 가능, ✕로 닫기

- [ ] **Step 5: 커밋**

```bash
git add renderer/components/kanban/StepDetail.tsx renderer/pages/builds/ main/ipc/register.ts
git commit -m "feat: step detail side panel with inline editing"
```

---

### Task 5: 크루 관리 + 배정

**Files:**
- Create: `renderer/components/crew/CrewList.tsx`
- Create: `renderer/components/crew/CrewAvatar.tsx`
- Create: `renderer/components/crew/CrewAssignPopover.tsx`
- Modify: `renderer/components/kanban/StepCard.tsx` — 크루 아바타 표시
- Modify: `renderer/components/kanban/StepDetail.tsx` — 크루 배정 UI
- Modify: `renderer/components/layout/Shell.tsx` — 사이드바에 크루 섹션

- [ ] **Step 1: 디렉토리 생성**

```bash
mkdir -p renderer/components/crew
```

- [ ] **Step 2: CrewAvatar 컴포넌트**

```tsx
// renderer/components/crew/CrewAvatar.tsx
import { memo } from 'react';

interface Props {
  name: string;
  size?: 'sm' | 'md';
}

export const CrewAvatar = memo(function CrewAvatar({ name, size = 'sm' }: Props) {
  const initial = name.charAt(0).toUpperCase();
  const sizeClass = size === 'sm' ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm';

  // 이름 기반 결정론적 색상
  const hue = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;

  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center font-medium text-white shrink-0`}
      style={{ backgroundColor: `oklch(0.6 0.15 ${hue})` }}
      title={name}
    >
      {initial}
    </div>
  );
});
```

- [ ] **Step 3: CrewAssignPopover 컴포넌트**

```tsx
// renderer/components/crew/CrewAssignPopover.tsx
import { useState } from 'react';
import { useCrews } from '../../hooks/use-crews';
import { CrewAvatar } from './CrewAvatar';
import { ipc } from '../../lib/ipc-client';

interface Props {
  stepId: string;
  assignedCrewIds: string[];
  onUpdate: () => void;
}

export function CrewAssignPopover({ stepId, assignedCrewIds, onUpdate }: Props) {
  const { crews } = useCrews();
  const [open, setOpen] = useState(false);

  const toggle = async (crewId: string) => {
    const current = new Set(assignedCrewIds);
    if (current.has(crewId)) {
      current.delete(crewId);
    } else {
      current.add(crewId);
    }
    await ipc['step:assignCrew'](stepId, [...current]);
    onUpdate();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-text-secondary hover:text-text-primary"
      >
        + 크루 배정
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-6 left-0 z-50 w-48 bg-surface-raised border border-border rounded-lg shadow-lg py-1">
            {crews.length === 0 ? (
              <p className="text-xs text-text-secondary px-3 py-2">크루가 없습니다</p>
            ) : (
              crews.map((crew) => (
                <button
                  key={crew.id}
                  onClick={() => toggle(crew.id)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-text-primary hover:bg-surface"
                >
                  <CrewAvatar name={crew.name} size="sm" />
                  <span className="flex-1 text-left">{crew.name}</span>
                  {assignedCrewIds.includes(crew.id) && <span className="text-accent">✓</span>}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: step:assignCrew IPC 핸들러 확인/추가**

`main/ipc/register.ts`에 추가:

```typescript
handle('step:assignCrew', (stepId, crewIds) => {
  const txn = db.transaction(() => {
    db.prepare('DELETE FROM step_assignees WHERE step_id = ?').run(stepId);
    const insert = db.prepare('INSERT INTO step_assignees (step_id, crew_id) VALUES (?, ?)');
    for (const crewId of crewIds) {
      insert.run(stepId, crewId);
    }
  });
  txn();
});
```

- [ ] **Step 5: StepCard에 크루 아바타 표시**

StepCard.tsx를 수정하여 배정된 크루 아바타를 하단에 표시. 크루 배정 데이터를 IPC로 별도 조회하거나, Zustand에 step-crew 매핑을 추가.

간단한 접근: StepCard에서 step_assignees를 직접 조회하는 것은 비용이 크므로, 스토어에 `stepAssignees: Record<string, string[]>` (stepId → crewIds) 맵을 추가하고, useKanban hook에서 초기 로드 시 함께 조회.

스토어에 추가:
```typescript
stepAssignees: Record<string, string[]>;
setStepAssignees: (stepId: string, crewIds: string[]) => void;
```

- [ ] **Step 6: StepDetail에 크루 배정 UI 추가**

StepDetail.tsx의 마감일 섹션 아래에 CrewAssignPopover 추가.

- [ ] **Step 7: 앱 실행 확인**

```bash
pnpm dev
```

Expected: 스텝 상세에서 크루 배정 가능, 카드에 아바타 표시

- [ ] **Step 8: 커밋**

```bash
git add renderer/components/crew/ renderer/components/kanban/ renderer/stores/app-store.ts renderer/hooks/ main/ipc/register.ts
git commit -m "feat: crew management with avatar and step assignment"
```

---

### Task 6: 최종 통합 테스트 + 정리

**Files:**
- Modify: `renderer/pages/home.tsx` — 빌드 카운트 표시
- 전체 동작 확인

- [ ] **Step 1: 홈 페이지에 빌드 링크 추가**

```tsx
// renderer/pages/home.tsx
import Link from 'next/link';
import { useBuilds } from '../hooks/use-builds';

export default function Home() {
  const { builds } = useBuilds();

  return (
    <div className="p-8">
      <h2 className="text-2xl font-semibold text-text-primary mb-4">홈 대시보드</h2>
      <p className="text-text-secondary mb-6">Plan 4에서 전체 구현 예정</p>

      <div className="p-4 rounded-lg border border-border bg-surface-raised">
        <h3 className="text-sm font-semibold text-text-primary mb-2">빌드</h3>
        <p className="text-2xl font-bold text-accent">{builds.length}</p>
        <Link href="/builds" className="text-sm text-accent hover:text-accent-hover mt-2 inline-block">
          빌드 보기 →
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 전체 테스트 실행**

```bash
pnpm vitest run
```

Expected: 기존 12개 테스트 전부 PASS (새 UI 컴포넌트는 Vitest 유닛 테스트 대상 아님 — E2E는 추후)

- [ ] **Step 3: 앱 E2E 동작 확인**

```bash
pnpm dev
```

전체 시나리오 확인:
1. 앱 시작 → 스플래시 → 홈 대시보드
2. 사이드바 "빌드" → 빌드 목록 (Empty State)
3. "새 빌드" → 다이얼로그 → 생성 → 칸반 보드 이동
4. "페이즈 추가" → "To Do", "In Progress", "Done" 3개 생성
5. 각 페이즈에 스텝 추가 (인라인 입력)
6. 스텝 카드 드래그 → 페이즈 간 이동
7. 스텝 클릭 → 상세 패널 → 제목/우선순위/마감일/설명 편집
8. Deep Work 토글 → 사이드바 숨김 + 다크 테마
9. AI 버튼 → (아직 동작 없음, 표시만 확인)

- [ ] **Step 4: 커밋 + 푸쉬**

```bash
git add -A
git commit -m "feat: complete kanban board with build list, phases, step cards, DnD, crew assignment, and detail panel"
git push
```

---

## Summary

| Task | 내용 | 핵심 파일 |
|---|---|---|
| 1 | Zustand 확장 + hooks + @dnd-kit 설치 | app-store.ts, hooks/ |
| 2 | 빌드 목록 + 생성 다이얼로그 + 사이드바 라우팅 | builds/index.tsx, BuildList, Shell |
| 3 | 칸반 보드 — 페이즈 컬럼 + 스텝 카드 + DnD | Board, PhaseColumn, StepCard |
| 4 | 스텝 상세 사이드 패널 | StepDetail |
| 5 | 크루 관리 + 배정 | CrewAvatar, CrewAssignPopover |
| 6 | 통합 테스트 + 홈 연동 + 푸쉬 | home.tsx, E2E 확인 |

**전체 커밋: 6회, 신규 컴포넌트: 10개**
