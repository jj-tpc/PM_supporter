# Plan 4: Home Dashboard — 온보딩 + 브리핑 + 일정/스텝 + 팀 현황 + 크로스 연동

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PM이 앱을 열면 "오늘 뭘 해야 하는가"를 즉시 답하는 홈 대시보드를 구현한다. 온보딩 체크리스트, 오늘의 일정/스텝, 팀 현황 스냅샷, 크로스 연동(마감일↔캘린더, Deep Work→칸반, AI Planner→칸반+캘린더)을 포함한다.

**Architecture:** 홈 대시보드는 독립 컴포넌트들로 구성하고, 각 섹션이 Zustand selector로 자기 데이터만 구독한다. 크로스 연동은 Main process 이벤트 버스 핸들러로 구현하고, Renderer에는 IPC 이벤트 수신으로 반영한다.

**Tech Stack:** React 19, Zustand (기존), Tailwind CSS 4, IPC client (기존)

**Dependencies:** Plan 1~3 완료 필수

---

## File Structure

```
renderer/
├── pages/
│   └── home.tsx                    # (전면 재작성)
├── components/
│   └── home/
│       ├── Dashboard.tsx           # 대시보드 컨테이너
│       ├── OnboardingChecklist.tsx  # 온보딩 체크리스트 위젯
│       ├── TodaySchedule.tsx       # 오늘의 일정 (②-L)
│       ├── TodaySteps.tsx          # 오늘의 스텝 (②-R)
│       ├── CrewSnapshot.tsx        # 팀 현황 스냅샷 (③)
│       └── WelcomeCard.tsx         # 정적 환영 메시지 (① MVP 대체)
├── hooks/
│   └── use-dashboard.ts            # 대시보드 데이터 로딩 hook
└── stores/
    └── app-store.ts                # (수정) 온보딩 상태 추가
main/
├── ipc/
│   ├── channels.ts                 # (수정) 대시보드/온보딩 IPC 채널 추가
│   └── register.ts                 # (수정) 대시보드 핸들러 추가
├── events/
│   └── cross-links.ts              # 크로스 연동 핸들러 (연동 #1, #5, #8)
└── db/
    └── statements.ts               # (수정) 대시보드 쿼리 추가
shared/
└── types.ts                        # (수정) OnboardingState 타입 추가
```

---

### Task 1: 대시보드 타입 + IPC 채널 + DB 쿼리

**Files:**
- Modify: `shared/types.ts` — OnboardingState 추가
- Modify: `main/ipc/channels.ts` — 대시보드 채널 추가
- Modify: `main/db/statements.ts` — 대시보드 쿼리 추가

- [ ] **Step 1: OnboardingState 타입 추가**

`shared/types.ts`에 추가:

```typescript
/** 온보딩 체크리스트 상태 */
export interface OnboardingState {
  buildCreated: boolean;
  crewAdded: boolean;
  stepCreated: boolean;
  googleConnected: boolean;
  deepWorkTried: boolean;
  aiUsed: boolean;
  completedAt: string | null;  // 전체 완료 시 타임스탬프, null이면 미완료
}

/** 대시보드 데이터 */
export interface DashboardData {
  todayEvents: CalendarEvent[];
  todaySteps: Array<{ step: Step; buildName: string }>;
  crewWorkload: Array<{ crewId: string; crewName: string; total: number; done: number; inProgress: number; overdue: number }>;
  onboarding: OnboardingState;
}
```

- [ ] **Step 2: IPC 채널 추가**

`main/ipc/channels.ts`에 추가 (import에 DashboardData, OnboardingState 추가):

```typescript
  // === Dashboard ===
  'dashboard:getData': { args: []; return: DashboardData };
  'dashboard:getOnboarding': { args: []; return: OnboardingState };
  'dashboard:dismissOnboarding': { args: []; return: void };
```

- [ ] **Step 3: 대시보드 DB 쿼리 추가**

`main/db/statements.ts`에 추가:

```typescript
    // Dashboard queries
    todaySteps: db.prepare(
      `SELECT s.*, b.name as build_name FROM steps s
       JOIN builds b ON s.build_id = b.id
       WHERE s.due_date IS NOT NULL
       AND date(s.due_date) = date('now')
       ORDER BY s.priority DESC, s."order"`
    ),
    crewWorkload: db.prepare(
      `SELECT
         c.id as crew_id, c.name as crew_name,
         COUNT(sa.step_id) as total,
         SUM(CASE WHEN p.name = 'Done' OR p.name = '완료' THEN 1 ELSE 0 END) as done,
         SUM(CASE WHEN p.name = 'In Progress' OR p.name = '진행 중' THEN 1 ELSE 0 END) as in_progress,
         SUM(CASE WHEN s.due_date IS NOT NULL AND s.due_date < datetime('now') AND p.name != 'Done' AND p.name != '완료' THEN 1 ELSE 0 END) as overdue
       FROM crews c
       LEFT JOIN step_assignees sa ON c.id = sa.crew_id
       LEFT JOIN steps s ON sa.step_id = s.id
       LEFT JOIN phases p ON s.phase_id = p.id
       GROUP BY c.id
       ORDER BY c.name`
    ),
    countBuilds: db.prepare('SELECT COUNT(*) as cnt FROM builds'),
    countCrews: db.prepare('SELECT COUNT(*) as cnt FROM crews'),
    countSteps: db.prepare('SELECT COUNT(*) as cnt FROM steps'),
    countDeepWorkSessions: db.prepare('SELECT COUNT(*) as cnt FROM deep_work_sessions'),
    countPlannerSessions: db.prepare('SELECT COUNT(*) as cnt FROM planner_sessions'),
```

- [ ] **Step 4: 커밋**

```bash
git add shared/types.ts main/ipc/channels.ts main/db/statements.ts
git commit -m "feat: dashboard types, IPC channels, and DB queries"
```

---

### Task 2: 대시보드 IPC 핸들러 + 온보딩 로직

**Files:**
- Modify: `main/ipc/register.ts` — 대시보드 핸들러 추가

- [ ] **Step 1: 대시보드 핸들러 추가**

`main/ipc/register.ts`에 추가:

```typescript
  // === Dashboard ===
  handle('dashboard:getData', () => {
    const today = new Date().toISOString().split('T')[0];

    // Today's events from cache
    const dayStart = `${today}T00:00:00Z`;
    const dayEnd = `${today}T23:59:59Z`;
    const todayEvents = stmts.getEventsByRange.all(dayEnd, dayStart);

    // Today's steps (due today)
    const todayStepsRaw = stmts.todaySteps.all() as any[];
    const todaySteps = todayStepsRaw.map((row: any) => ({
      step: {
        id: row.id, buildId: row.build_id, phaseId: row.phase_id,
        title: row.title, description: row.description, priority: row.priority,
        dueDate: row.due_date, order: row.order, createdBy: row.created_by,
        createdAt: row.created_at, updatedAt: row.updated_at,
      },
      buildName: row.build_name,
    }));

    // Crew workload
    const crewWorkload = (stmts.crewWorkload.all() as any[]).map((row: any) => ({
      crewId: row.crew_id,
      crewName: row.crew_name,
      total: row.total ?? 0,
      done: row.done ?? 0,
      inProgress: row.in_progress ?? 0,
      overdue: row.overdue ?? 0,
    }));

    // Onboarding state
    const onboarding = getOnboardingState();

    return { todayEvents, todaySteps, crewWorkload, onboarding };
  });

  handle('dashboard:getOnboarding', () => getOnboardingState());

  handle('dashboard:dismissOnboarding', () => {
    db.prepare(
      "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('onboarding_dismissed', ?)"
    ).run(now());
  });

  function getOnboardingState(): import('../../shared/types').OnboardingState {
    const buildCount = (stmts.countBuilds.get() as any).cnt;
    const crewCount = (stmts.countCrews.get() as any).cnt;
    const stepCount = (stmts.countSteps.get() as any).cnt;
    const googleAccounts = stmts.listGoogleAccounts.all() as any[];
    const deepWorkCount = (stmts.countDeepWorkSessions.get() as any).cnt;
    const plannerCount = (stmts.countPlannerSessions.get() as any).cnt;

    const dismissed = db.prepare(
      "SELECT value FROM app_settings WHERE key = 'onboarding_dismissed'"
    ).get() as any;

    return {
      buildCreated: buildCount > 0,
      crewAdded: crewCount > 0,
      stepCreated: stepCount > 0,
      googleConnected: googleAccounts.length > 0,
      deepWorkTried: deepWorkCount > 0,
      aiUsed: plannerCount > 0,
      completedAt: dismissed?.value ?? null,
    };
  }
```

- [ ] **Step 2: 커밋**

```bash
git add main/ipc/register.ts
git commit -m "feat: dashboard IPC handlers with onboarding state"
```

---

### Task 3: 크로스 연동 핸들러 (#1, #5, #8)

**Files:**
- Create: `main/events/cross-links.ts`
- Modify: `main/main.ts` — 크로스 연동 등록

- [ ] **Step 1: 크로스 연동 핸들러 생성**

```typescript
// main/events/cross-links.ts
import type Database from 'better-sqlite3';
import type { Statements } from '../db/statements';
import type { EventBus } from './bus';

/**
 * 크로스 연동 핸들러 등록.
 * Phase 1 연동: #1 마감일→캘린더, #5 Deep Work→칸반, #8 AI→칸반+캘린더
 */
export function registerCrossLinks(
  db: Database.Database,
  stmts: Statements,
  bus: EventBus,
) {
  // 연동 #1: 스텝에 마감일 설정 시 → (로그만, 캘린더 마커는 UI에서 처리)
  bus.on('step:updated', ({ stepId, changes }) => {
    if ('dueDate' in changes && changes.dueDate) {
      console.log(`[CrossLink #1] Step ${stepId} due date set to ${changes.dueDate}`);
      // Phase 2에서 캘린더에 실제 마커 생성 로직 추가 예정
    }
  });

  // 연동 #5: Deep Work 세션 완료 시 → 완료된 스텝 카운트 갱신
  bus.on('deepwork:ended', ({ sessionId, stepsCompleted }) => {
    if (stepsCompleted.length > 0) {
      db.prepare(
        'UPDATE deep_work_sessions SET tasks_completed = ? WHERE id = ?'
      ).run(stepsCompleted.length, sessionId);
      console.log(`[CrossLink #5] Deep Work ${sessionId}: ${stepsCompleted.length} steps completed`);
    }
  });

  // 연동 #8: AI Planner 태스크 생성 시 → (빌드 생성 이벤트 로그)
  bus.on('build:created', ({ buildId }) => {
    console.log(`[CrossLink #8] Build ${buildId} created — steps may be added by AI`);
  });
}
```

- [ ] **Step 2: main.ts에 크로스 연동 등록**

`main/main.ts`에서 `registerIpcHandlers` 호출 직후에 추가:

```typescript
const { registerCrossLinks } = await import('./events/cross-links');
registerCrossLinks(db, stmts, bus);
```

- [ ] **Step 3: 커밋**

```bash
git add main/events/cross-links.ts main/main.ts
git commit -m "feat: cross-link event handlers (#1 due date, #5 deep work, #8 AI)"
```

---

### Task 4: 대시보드 UI 컴포넌트 — 온보딩 + 환영 + 일정 + 스텝

**Files:**
- Create: `renderer/hooks/use-dashboard.ts`
- Create: `renderer/components/home/OnboardingChecklist.tsx`
- Create: `renderer/components/home/WelcomeCard.tsx`
- Create: `renderer/components/home/TodaySchedule.tsx`
- Create: `renderer/components/home/TodaySteps.tsx`

- [ ] **Step 1: use-dashboard hook**

```typescript
// renderer/hooks/use-dashboard.ts
import { useEffect, useState } from 'react';
import { ipc } from '../lib/ipc-client';
import type { DashboardData } from '../../shared/types';

export function useDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ipc['dashboard:getData']().then((d) => {
      setData(d);
      setLoading(false);
    });
  }, []);

  const refresh = async () => {
    setLoading(true);
    const d = await ipc['dashboard:getData']();
    setData(d);
    setLoading(false);
  };

  const dismissOnboarding = async () => {
    await ipc['dashboard:dismissOnboarding']();
    await refresh();
  };

  return { data, loading, refresh, dismissOnboarding };
}
```

- [ ] **Step 2: OnboardingChecklist 컴포넌트**

```tsx
// renderer/components/home/OnboardingChecklist.tsx
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
```

- [ ] **Step 3: WelcomeCard 컴포넌트**

```tsx
// renderer/components/home/WelcomeCard.tsx
import { memo } from 'react';

export const WelcomeCard = memo(function WelcomeCard() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? '좋은 아침이에요' : hour < 18 ? '좋은 오후예요' : '수고하셨어요';

  return (
    <div className="rounded-lg border border-accent/20 bg-accent/5 p-4">
      <p className="text-lg font-semibold text-text-primary">{greeting}</p>
      <p className="text-sm text-text-secondary mt-1">
        오늘 하루도 PM Supporter와 함께 해요.
      </p>
    </div>
  );
});
```

- [ ] **Step 4: TodaySchedule 컴포넌트**

```tsx
// renderer/components/home/TodaySchedule.tsx
import { memo } from 'react';
import Link from 'next/link';
import type { CalendarEvent } from '../../../shared/types';

interface Props {
  events: CalendarEvent[];
}

export const TodaySchedule = memo(function TodaySchedule({ events }: Props) {
  return (
    <div className="rounded-lg border border-border bg-surface-raised p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-primary">오늘의 일정</h3>
        <Link href="/calendar" className="text-xs text-accent hover:text-accent-hover">
          캘린더 →
        </Link>
      </div>
      {events.length === 0 ? (
        <p className="text-sm text-text-secondary">오늘 일정이 없습니다</p>
      ) : (
        <ul className="space-y-2">
          {events.slice(0, 5).map((event) => (
            <li key={event.id} className="flex items-start gap-3">
              <span className="text-xs text-accent font-medium w-12 shrink-0 pt-0.5">
                {new Date(event.startTime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="text-sm text-text-primary">{event.summary}</span>
            </li>
          ))}
          {events.length > 5 && (
            <li className="text-xs text-text-secondary">+{events.length - 5}개 더</li>
          )}
        </ul>
      )}
    </div>
  );
});
```

- [ ] **Step 5: TodaySteps 컴포넌트**

```tsx
// renderer/components/home/TodaySteps.tsx
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

const priorityColors: Record<string, string> = {
  critical: 'text-danger',
  high: 'text-warning',
  medium: 'text-accent',
  low: 'text-text-secondary',
};

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
```

- [ ] **Step 6: 커밋**

```bash
git add renderer/hooks/use-dashboard.ts renderer/components/home/
git commit -m "feat: dashboard components — onboarding, welcome, schedule, steps"
```

---

### Task 5: 팀 현황 스냅샷 + Dashboard 컨테이너 + 홈 페이지 재작성

**Files:**
- Create: `renderer/components/home/CrewSnapshot.tsx`
- Create: `renderer/components/home/Dashboard.tsx`
- Modify: `renderer/pages/home.tsx` — 전면 재작성

- [ ] **Step 1: CrewSnapshot 컴포넌트**

```tsx
// renderer/components/home/CrewSnapshot.tsx
import { memo } from 'react';
import { CrewAvatar } from '../crew/CrewAvatar';

interface CrewWorkload {
  crewId: string;
  crewName: string;
  total: number;
  done: number;
  inProgress: number;
  overdue: number;
}

interface Props {
  workload: CrewWorkload[];
}

export const CrewSnapshot = memo(function CrewSnapshot({ workload }: Props) {
  if (workload.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface-raised p-4">
        <h3 className="text-sm font-semibold text-text-primary mb-3">크루 현황</h3>
        <p className="text-sm text-text-secondary">등록된 크루가 없습니다</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface-raised p-4">
      <h3 className="text-sm font-semibold text-text-primary mb-3">크루 현황</h3>
      <div className="space-y-3">
        {workload.map((crew) => {
          const progress = crew.total > 0 ? (crew.done / crew.total) * 100 : 0;
          return (
            <div key={crew.crewId} className="flex items-center gap-3">
              <CrewAvatar name={crew.crewName} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-text-primary truncate">{crew.crewName}</span>
                  <span className="text-xs text-text-secondary shrink-0 ml-2">
                    {crew.done}/{crew.total}
                    {crew.overdue > 0 && (
                      <span className="text-danger ml-1">({crew.overdue} 지연)</span>
                    )}
                  </span>
                </div>
                <div className="h-1.5 bg-border rounded-full">
                  <div
                    className="h-full bg-accent rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
```

- [ ] **Step 2: Dashboard 컨테이너**

```tsx
// renderer/components/home/Dashboard.tsx
import { useDashboard } from '../../hooks/use-dashboard';
import { OnboardingChecklist } from './OnboardingChecklist';
import { WelcomeCard } from './WelcomeCard';
import { TodaySchedule } from './TodaySchedule';
import { TodaySteps } from './TodaySteps';
import { CrewSnapshot } from './CrewSnapshot';

export function Dashboard() {
  const { data, loading, dismissOnboarding } = useDashboard();

  if (loading || !data) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-border rounded w-48" />
          <div className="h-24 bg-border rounded" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-48 bg-border rounded" />
            <div className="h-48 bg-border rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl space-y-4">
      {/* ⓪ 온보딩 체크리스트 */}
      <OnboardingChecklist state={data.onboarding} onDismiss={dismissOnboarding} />

      {/* ① 환영 카드 (MVP — Phase 2에서 AI 브리핑으로 교체) */}
      <WelcomeCard />

      {/* ②-L, ②-R 오늘의 일정 + 스텝 */}
      <div className="grid grid-cols-2 gap-4">
        <TodaySchedule events={data.todayEvents} />
        <TodaySteps steps={data.todaySteps} />
      </div>

      {/* ③ 크루 현황 */}
      <CrewSnapshot workload={data.crewWorkload} />
    </div>
  );
}
```

- [ ] **Step 3: 홈 페이지 재작성**

```tsx
// renderer/pages/home.tsx
import { Dashboard } from '../components/home/Dashboard';

export default function Home() {
  return <Dashboard />;
}
```

- [ ] **Step 4: 앱 실행 확인**

```bash
pnpm dev
```

Expected:
- 홈 → 온보딩 체크리스트 표시 (빌드/크루/스텝 미완료)
- 환영 카드 (시간대별 인사)
- 오늘의 일정 (Google 미연결 시 "오늘 일정이 없습니다")
- 오늘의 스텝 (마감 없으면 "오늘 마감인 스텝이 없습니다")
- 크루 현황 (크루 없으면 "등록된 크루가 없습니다")
- 빌드 만들면 체크리스트 "첫 빌드 만들기" 자동 체크

- [ ] **Step 5: 커밋**

```bash
git add renderer/components/home/ renderer/pages/home.tsx
git commit -m "feat: home dashboard with onboarding, schedule, steps, crew snapshot"
```

---

### Task 6: 통합 테스트 + 푸쉬

**Files:** 전체 확인

- [ ] **Step 1: 전체 테스트**

```bash
pnpm vitest run
```

Expected: 16 tests PASS (기존 유지)

- [ ] **Step 2: 커밋 + 푸쉬**

```bash
git status
# 미커밋 파일 있으면 추가
git push
```

---

## Summary

| Task | 내용 | 핵심 파일 |
|---|---|---|
| 1 | 타입 + IPC 채널 + DB 쿼리 | types.ts, channels.ts, statements.ts |
| 2 | 대시보드 IPC 핸들러 + 온보딩 로직 | register.ts |
| 3 | 크로스 연동 (#1, #5, #8) | cross-links.ts, main.ts |
| 4 | UI — 온보딩 + 환영 + 일정 + 스텝 | 4 컴포넌트 + hook |
| 5 | UI — 크루 현황 + Dashboard 컨테이너 + 홈 재작성 | 2 컴포넌트 + home.tsx |
| 6 | 통합 + 푸쉬 | 전체 확인 |

**전체 커밋: 6회, 신규 컴포넌트: 6개**

**Fan-out 기회:**
- T1 (타입) → T2 (핸들러)와 T3 (크로스 연동) **병렬 가능**
- T4 (UI 컴포넌트)와 T3 (크로스 연동) **병렬 가능** (파일 겹침 없음)
- T5 (Dashboard + 홈) → T6 (통합): 순차
