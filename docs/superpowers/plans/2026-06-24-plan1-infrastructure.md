# Plan 1: Infrastructure — Electron + Next.js + SQLite + IPC + Event Bus

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nextron(Electron+Next.js) 프로젝트를 세팅하고, SQLite DB, 타입 안전 IPC, 이벤트 버스, 에러/Undo 기반 인프라를 구축하여 이후 Plan 2~6의 토대를 만든다.

**Architecture:** Nextron이 Electron main process와 Next.js renderer를 분리 관리한다. Main process에서 SQLite, 외부 API, IPC 핸들러를 담당하고, Renderer에서 React UI를 담당한다. 이벤트 버스가 모듈 간 통신을 중재한다. 모든 삭제는 Soft Delete + 30일 휴지통을 거친다.

**Tech Stack:** Nextron 10, Next.js 15, Electron 33+, TypeScript 5, pnpm, better-sqlite3, Zustand, Tailwind CSS 4, Vitest, Playwright

---

## File Structure

```
PM_supporter/
├── main/                          # Electron main process
│   ├── background.ts              # Electron app entry, window creation, splash
│   ├── preload.ts                 # contextBridge IPC 노출
│   ├── ipc/
│   │   ├── channels.ts            # IPC 채널 타입 정의 (shared)
│   │   └── register.ts            # 모든 IPC 핸들러 등록
│   ├── db/
│   │   ├── connection.ts          # SQLite 연결, WAL, pragma 설정
│   │   ├── schema.ts              # 전체 스키마 + 마이그레이션
│   │   ├── statements.ts          # prepared statement 캐시
│   │   └── trash.ts               # Soft Delete + 휴지통 로직
│   └── events/
│       └── bus.ts                 # Main process 이벤트 버스
├── renderer/
│   ├── pages/
│   │   ├── _app.tsx               # Next.js App wrapper (Zustand Provider)
│   │   ├── index.tsx              # 홈 대시보드 (placeholder)
│   │   └── _document.tsx          # HTML document 커스텀
│   ├── stores/
│   │   └── app-store.ts           # Zustand 루트 스토어 (정규화 구조)
│   ├── lib/
│   │   ├── ipc-client.ts          # Renderer → Main IPC 호출 래퍼
│   │   └── event-listener.ts      # Main → Renderer 이벤트 수신
│   ├── styles/
│   │   └── globals.css            # Tailwind 설정 + 테마 변수
│   └── components/
│       └── layout/
│           └── Shell.tsx           # 앱 쉘 (사이드바 + 메인 + AI 버튼)
├── shared/
│   └── types.ts                   # Main/Renderer 공유 타입 (앱 용어)
├── tests/
│   ├── main/
│   │   ├── db.test.ts             # SQLite 테스트
│   │   ├── trash.test.ts          # 휴지통 테스트
│   │   └── event-bus.test.ts      # 이벤트 버스 테스트
│   └── e2e/
│       └── app-launch.test.ts     # Electron 앱 실행 E2E
├── resources/                     # 앱 아이콘, splash 이미지
├── electron-builder.yml           # 빌드/패키징 설정
├── nextron.config.js              # Nextron 설정
├── tailwind.config.ts             # Tailwind 설정
├── vitest.config.ts               # Vitest 설정
├── tsconfig.json                  # 루트 TypeScript
├── .env.example                   # 환경변수 템플릿
└── package.json
```

---

### Task 1: Node.js v20 + pnpm 설치 확인

**Files:** 없음 (환경 설정)

- [ ] **Step 1: Node.js v20 LTS 설치 확인**

현재 Node.js v24가 설치되어 있다. Nextron 10과의 호환성을 위해 v20 LTS가 필요하다.

```bash
# nvm이 있으면:
nvm install 20
nvm use 20
node -v
# 출력: v20.x.x

# nvm이 없으면 https://nodejs.org 에서 v20 LTS 직접 설치
```

Expected: `v20.x.x` 출력

- [ ] **Step 2: pnpm 설치**

```bash
npm install -g pnpm
pnpm --version
```

Expected: `9.x.x` 이상 출력

- [ ] **Step 3: 작업 디렉토리 확인**

```bash
cd /c/Users/twoja/project_tpc/PM_supporter
git status
```

Expected: `On branch main`, clean working tree

---

### Task 2: Nextron 프로젝트 스캐폴딩

**Files:**
- Create: `package.json`, `main/background.ts`, `renderer/`, `nextron.config.js`, `tsconfig.json`
- Create: `electron-builder.yml`

- [ ] **Step 1: Nextron 프로젝트 생성 (임시 디렉토리)**

기존 repo에 Nextron을 직접 초기화할 수 없으므로, 임시로 생성 후 파일을 복사한다.

```bash
cd /c/Users/twoja/project_tpc
npx create-nextron-app pm-supporter-tmp --example with-tailwindcss
```

Expected: `pm-supporter-tmp/` 디렉토리에 Nextron 프로젝트 생성

- [ ] **Step 2: 생성된 파일을 기존 repo로 복사**

```bash
cd /c/Users/twoja/project_tpc
# 기존 repo의 docs, CLAUDE.md 등은 보존하면서 Nextron 파일 복사
cp pm-supporter-tmp/package.json PM_supporter/
cp pm-supporter-tmp/tsconfig.json PM_supporter/
cp pm-supporter-tmp/nextron.config.js PM_supporter/ 2>/dev/null || true
cp pm-supporter-tmp/electron-builder.yml PM_supporter/ 2>/dev/null || true
cp -r pm-supporter-tmp/main PM_supporter/
cp -r pm-supporter-tmp/renderer PM_supporter/
cp -r pm-supporter-tmp/resources PM_supporter/ 2>/dev/null || true

# 임시 디렉토리 삭제
rm -rf pm-supporter-tmp
```

- [ ] **Step 3: pnpm으로 의존성 설치**

```bash
cd /c/Users/twoja/project_tpc/PM_supporter
pnpm install
```

Expected: `node_modules/` 생성, 에러 없이 완료

- [ ] **Step 4: Nextron 기본 실행 확인**

```bash
pnpm dev
```

Expected: Electron 윈도우가 열리고 Next.js 페이지가 표시됨. 확인 후 Ctrl+C로 종료.

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "feat: scaffold Nextron project with TypeScript + Tailwind CSS"
```

---

### Task 3: 프로젝트 구조 재배치 + 공유 타입

**Files:**
- Create: `shared/types.ts`
- Create: `main/ipc/channels.ts`
- Modify: `tsconfig.json` — paths alias 추가

- [ ] **Step 1: shared 디렉토리 + 앱 용어 타입 생성**

```bash
mkdir -p shared
```

```typescript
// shared/types.ts

// ============================================================
// 앱 고유 용어 체계 (여정×건축 메타포)
// 내부 코드에서도 이 용어를 사용한다.
// ============================================================

/** 스텝 = 태스크. 프로젝트의 한 걸음. */
export interface Step {
  id: string;
  buildId: string;
  phaseId: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  dueDate: string | null;
  order: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 빌드 = 프로젝트/보드. 짓고 있는 것. */
export interface Build {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

/** 페이즈 = 컬럼/작업 단계. */
export interface Phase {
  id: string;
  buildId: string;
  name: string;
  order: number;
  wipLimit: number | null;
}

/** 크루 = 팀원. */
export interface Crew {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
  avatarUrl: string | null;
}

/** 뷰포인트 = 저장된 필터 뷰. */
export interface Viewpoint {
  id: string;
  buildId: string;
  name: string;
  filters: ViewpointFilters;
  sortBy: 'priority' | 'due_date' | 'updated_at' | null;
  createdAt: string;
}

export interface ViewpointFilters {
  assignees?: string[];
  labels?: string[];
  priority?: Step['priority'][];
  due?: 'overdue' | 'today' | 'this_week' | null;
}

/** 라벨 */
export interface Label {
  id: string;
  buildId: string;
  name: string;
  color: string;
}

/** 체크리스트 아이템 */
export interface ChecklistItem {
  id: string;
  stepId: string;
  text: string;
  isChecked: boolean;
  order: number;
}

/** 코멘트 */
export interface Comment {
  id: string;
  stepId: string;
  authorId: string;
  content: string;
  createdAt: string;
}

/** Deep Work 세션 */
export interface DeepWorkSession {
  id: string;
  startedAt: string;
  endedAt: string | null;
  tasksCompleted: number;
  totalFocusMinutes: number;
  contextNote: string | null;
  lastStepId: string | null;
  lastChecklistItemId: string | null;
}

/** 가이드 = 팀 오더/지시 */
export interface Guide {
  id: string;
  type: 'daily' | 'weekly' | 'monthly' | 'sprint';
  crewId: string | null;
  buildId: string;
  content: string;
  additionalInstructions: string | null;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
}

/** 휴지통 아이템 */
export interface DeletedItem {
  id: string;
  itemType: 'step' | 'build' | 'phase' | 'crew' | 'batch';
  itemId: string;
  itemData: string; // JSON
  batchId: string | null;
  deletedAt: string;
  expiresAt: string;
}

/** 이벤트 버스 이벤트 타입 */
export type AppEvents = {
  'step:updated': { stepId: string; changes: Partial<Step> };
  'step:moved': { stepId: string; fromPhase: string; toPhase: string };
  'step:completed': { stepId: string };
  'step:deleted': { stepId: string };
  'build:created': { buildId: string };
  'calendar:changed': { eventId: string; type: 'created' | 'updated' | 'deleted' };
  'deepwork:started': { sessionId: string };
  'deepwork:ended': { sessionId: string; stepsCompleted: string[] };
  'routine:generated': { routineId: string; type: string };
  'sync:status': { status: 'synced' | 'syncing' | 'offline' | 'error' };
};

/** 앱 설정 */
export interface AppSettings {
  deepWork: {
    fullscreen: boolean;
    darkMode: boolean;
    focusAssist: boolean;
    ambientSound: boolean;
    pomodoroMinutes: number;
  };
  notifications: {
    urgentEnabled: boolean;
    normalBatchMinutes: number;
    infoEnabled: boolean;
  };
}
```

- [ ] **Step 2: IPC 채널 타입 정의**

```typescript
// main/ipc/channels.ts

import type {
  Build, Phase, Step, Crew, Label, Viewpoint,
  ChecklistItem, Comment, DeletedItem, DeepWorkSession, Guide,
} from '../../shared/types';

/**
 * IPC 채널 정의.
 * Main/Renderer 양쪽에서 import하여 타입 안전성을 보장한다.
 */
export interface IpcChannels {
  // === Build (빌드) ===
  'build:list': { args: []; return: Build[] };
  'build:get': { args: [string]; return: Build | null };
  'build:create': { args: [Omit<Build, 'id' | 'createdAt' | 'updatedAt'>]; return: Build };
  'build:update': { args: [string, Partial<Build>]; return: Build };
  'build:delete': { args: [string]; return: void };

  // === Phase (페이즈) ===
  'phase:list': { args: [string]; return: Phase[] }; // buildId
  'phase:create': { args: [Omit<Phase, 'id'>]; return: Phase };
  'phase:update': { args: [string, Partial<Phase>]; return: Phase };
  'phase:delete': { args: [string]; return: void };
  'phase:reorder': { args: [string, string[]]; return: void }; // buildId, phaseIds

  // === Step (스텝) ===
  'step:list': { args: [string]; return: Step[] }; // buildId
  'step:listByPhase': { args: [string]; return: Step[] }; // phaseId
  'step:get': { args: [string]; return: Step | null };
  'step:create': { args: [Omit<Step, 'id' | 'createdAt' | 'updatedAt'>]; return: Step };
  'step:createBatch': { args: [Omit<Step, 'id' | 'createdAt' | 'updatedAt'>[]]; return: Step[] };
  'step:update': { args: [string, Partial<Step>]; return: Step };
  'step:move': { args: [{ stepId: string; targetPhaseId: string; order: number }]; return: void };
  'step:delete': { args: [string]; return: void };

  // === Crew (크루) ===
  'crew:list': { args: []; return: Crew[] };
  'crew:create': { args: [Omit<Crew, 'id'>]; return: Crew };
  'crew:update': { args: [string, Partial<Crew>]; return: Crew };
  'crew:delete': { args: [string]; return: void };

  // === Step-Crew Assignment ===
  'step:assignCrew': { args: [string, string[]]; return: void }; // stepId, crewIds

  // === Label ===
  'label:list': { args: [string]; return: Label[] }; // buildId
  'label:create': { args: [Omit<Label, 'id'>]; return: Label };
  'label:delete': { args: [string]; return: void };

  // === Checklist ===
  'checklist:list': { args: [string]; return: ChecklistItem[] }; // stepId
  'checklist:create': { args: [Omit<ChecklistItem, 'id'>]; return: ChecklistItem };
  'checklist:update': { args: [string, Partial<ChecklistItem>]; return: ChecklistItem };
  'checklist:delete': { args: [string]; return: void };

  // === Trash (휴지통) ===
  'trash:list': { args: []; return: DeletedItem[] };
  'trash:restore': { args: [string]; return: void }; // deletedItemId
  'trash:restoreBatch': { args: [string]; return: void }; // batchId
  'trash:purge': { args: [string]; return: void }; // deletedItemId (영구 삭제)
  'trash:purgeExpired': { args: []; return: number }; // 만료된 항목 정리, 삭제 건수 반환

  // === Deep Work ===
  'deepwork:start': { args: [{ stepId: string }]; return: DeepWorkSession };
  'deepwork:end': { args: [string]; return: DeepWorkSession }; // sessionId
  'deepwork:getCurrent': { args: []; return: DeepWorkSession | null };
  'deepwork:updateContext': { args: [string, string]; return: void }; // sessionId, contextNote

  // === App ===
  'app:getSettings': { args: []; return: import('../../shared/types').AppSettings };
  'app:updateSettings': { args: [Partial<import('../../shared/types').AppSettings>]; return: void };
}

/** IPC 채널 이름 유니온 타입 */
export type IpcChannel = keyof IpcChannels;
```

- [ ] **Step 3: tsconfig.json에 path alias 추가**

`tsconfig.json`에 다음을 추가한다 (기존 Nextron 생성 tsconfig를 수정):

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["shared/*"],
      "@main/*": ["main/*"],
      "@renderer/*": ["renderer/*"]
    },
    "strict": true,
    "skipLibCheck": true
  }
}
```

주의: Nextron이 생성한 기존 `compilerOptions`는 유지하고, `paths`와 `strict`만 추가/수정한다.

- [ ] **Step 4: 커밋**

```bash
git add shared/types.ts main/ipc/channels.ts tsconfig.json
git commit -m "feat: add shared types (app terminology) and IPC channel definitions"
```

---

### Task 4: SQLite 연결 + 스키마 + Prepared Statements

**Files:**
- Create: `main/db/connection.ts`
- Create: `main/db/schema.ts`
- Create: `main/db/statements.ts`
- Test: `tests/main/db.test.ts`

- [ ] **Step 1: better-sqlite3 + uuid 설치**

```bash
pnpm add better-sqlite3 uuid
pnpm add -D @types/better-sqlite3 @types/uuid electron-rebuild
```

package.json에 postinstall 스크립트 추가:

```json
{
  "scripts": {
    "postinstall": "electron-rebuild -f -w better-sqlite3"
  }
}
```

```bash
pnpm install
```

Expected: better-sqlite3가 Electron 버전에 맞게 빌드됨

- [ ] **Step 2: 테스트 인프라 설치**

```bash
pnpm add -D vitest
mkdir -p tests/main
```

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**'],
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'shared'),
      '@main': path.resolve(__dirname, 'main'),
    },
  },
});
```

- [ ] **Step 3: DB 연결 테스트 작성 (실패 확인)**

```typescript
// tests/main/db.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createConnection } from '@main/db/connection';
import { applySchema } from '@main/db/schema';

describe('SQLite Connection', () => {
  let db: Database.Database;

  afterEach(() => {
    if (db) db.close();
  });

  it('should create in-memory database with WAL mode', () => {
    db = createConnection(':memory:');
    const mode = db.pragma('journal_mode', { simple: true });
    expect(mode).toBe('wal');
  });

  it('should have foreign keys enabled', () => {
    db = createConnection(':memory:');
    const fk = db.pragma('foreign_keys', { simple: true });
    expect(fk).toBe(1);
  });

  it('should apply schema and create all tables', () => {
    db = createConnection(':memory:');
    applySchema(db);

    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all() as { name: string }[];
    const tableNames = tables.map(t => t.name);

    expect(tableNames).toContain('builds');
    expect(tableNames).toContain('phases');
    expect(tableNames).toContain('steps');
    expect(tableNames).toContain('crews');
    expect(tableNames).toContain('step_assignees');
    expect(tableNames).toContain('labels');
    expect(tableNames).toContain('step_labels');
    expect(tableNames).toContain('checklist_items');
    expect(tableNames).toContain('comments');
    expect(tableNames).toContain('deep_work_sessions');
    expect(tableNames).toContain('deleted_items');
    expect(tableNames).toContain('viewpoints');
  });

  it('should insert and retrieve a build', () => {
    db = createConnection(':memory:');
    applySchema(db);

    db.prepare(
      "INSERT INTO builds (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
    ).run('b1', 'Test Build', 'desc', '2026-06-24T00:00:00Z', '2026-06-24T00:00:00Z');

    const row = db.prepare("SELECT * FROM builds WHERE id = ?").get('b1') as any;
    expect(row.name).toBe('Test Build');
  });
});
```

```bash
pnpm vitest run tests/main/db.test.ts
```

Expected: FAIL — `createConnection` and `applySchema` not found

- [ ] **Step 4: DB 연결 구현**

```typescript
// main/db/connection.ts
import Database from 'better-sqlite3';

export function createConnection(dbPath: string): Database.Database {
  const db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = -64000');  // 64MB
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  return db;
}
```

- [ ] **Step 5: 스키마 구현**

```typescript
// main/db/schema.ts
import Database from 'better-sqlite3';

export function applySchema(db: Database.Database): void {
  db.exec(`
    -- 빌드 (프로젝트/보드)
    CREATE TABLE IF NOT EXISTS builds (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- 페이즈 (컬럼/작업 단계)
    CREATE TABLE IF NOT EXISTS phases (
      id TEXT PRIMARY KEY,
      build_id TEXT NOT NULL REFERENCES builds(id),
      name TEXT NOT NULL,
      "order" INTEGER NOT NULL,
      wip_limit INTEGER
    );

    -- 스텝 (태스크 카드)
    CREATE TABLE IF NOT EXISTS steps (
      id TEXT PRIMARY KEY,
      build_id TEXT NOT NULL REFERENCES builds(id),
      phase_id TEXT NOT NULL REFERENCES phases(id),
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      priority TEXT CHECK(priority IN ('critical','high','medium','low')) DEFAULT 'medium',
      due_date TEXT,
      "order" INTEGER NOT NULL,
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- 크루 (팀원)
    CREATE TABLE IF NOT EXISTS crews (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      role TEXT,
      avatar_url TEXT
    );

    -- 스텝-크루 매핑
    CREATE TABLE IF NOT EXISTS step_assignees (
      step_id TEXT NOT NULL REFERENCES steps(id),
      crew_id TEXT NOT NULL REFERENCES crews(id),
      PRIMARY KEY (step_id, crew_id)
    );

    -- 라벨
    CREATE TABLE IF NOT EXISTS labels (
      id TEXT PRIMARY KEY,
      build_id TEXT NOT NULL REFERENCES builds(id),
      name TEXT NOT NULL,
      color TEXT NOT NULL
    );

    -- 스텝-라벨 매핑
    CREATE TABLE IF NOT EXISTS step_labels (
      step_id TEXT NOT NULL REFERENCES steps(id),
      label_id TEXT NOT NULL REFERENCES labels(id),
      PRIMARY KEY (step_id, label_id)
    );

    -- 체크리스트
    CREATE TABLE IF NOT EXISTS checklist_items (
      id TEXT PRIMARY KEY,
      step_id TEXT NOT NULL REFERENCES steps(id),
      text TEXT NOT NULL,
      is_checked INTEGER NOT NULL DEFAULT 0,
      "order" INTEGER NOT NULL
    );

    -- 코멘트
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      step_id TEXT NOT NULL REFERENCES steps(id),
      author_id TEXT NOT NULL REFERENCES crews(id),
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    -- Deep Work 세션
    CREATE TABLE IF NOT EXISTS deep_work_sessions (
      id TEXT PRIMARY KEY,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      tasks_completed INTEGER DEFAULT 0,
      total_focus_minutes INTEGER DEFAULT 0,
      context_note TEXT,
      last_step_id TEXT REFERENCES steps(id),
      last_checklist_item_id TEXT REFERENCES checklist_items(id)
    );

    -- 루틴 설정
    CREATE TABLE IF NOT EXISTS routines (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('daily_briefing','meeting_prep','daily_wrapup','weekly_review','sprint_retro')),
      trigger_type TEXT NOT NULL CHECK(trigger_type IN ('auto','scheduled','manual')),
      trigger_config TEXT,
      enabled INTEGER DEFAULT 1,
      created_at TEXT NOT NULL
    );

    -- 루틴 출력
    CREATE TABLE IF NOT EXISTS routine_outputs (
      id TEXT PRIMARY KEY,
      routine_id TEXT NOT NULL REFERENCES routines(id),
      content TEXT NOT NULL,
      source_data TEXT,
      generated_at TEXT NOT NULL
    );

    -- 캘린더-스텝 링크
    CREATE TABLE IF NOT EXISTS event_step_links (
      event_id TEXT NOT NULL,
      step_id TEXT NOT NULL REFERENCES steps(id),
      link_type TEXT NOT NULL CHECK(link_type IN ('manual','auto','ai_suggested')),
      PRIMARY KEY (event_id, step_id)
    );

    -- 가이드 (팀 오더)
    CREATE TABLE IF NOT EXISTS guides (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('daily','weekly','monthly','sprint')),
      crew_id TEXT REFERENCES crews(id),
      build_id TEXT NOT NULL REFERENCES builds(id),
      content TEXT NOT NULL,
      additional_instructions TEXT,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    -- 뷰포인트 (저장된 필터 뷰)
    CREATE TABLE IF NOT EXISTS viewpoints (
      id TEXT PRIMARY KEY,
      build_id TEXT NOT NULL REFERENCES builds(id),
      name TEXT NOT NULL,
      filters TEXT NOT NULL,
      sort_by TEXT,
      created_at TEXT NOT NULL
    );

    -- 휴지통 (Soft Delete)
    CREATE TABLE IF NOT EXISTS deleted_items (
      id TEXT PRIMARY KEY,
      item_type TEXT NOT NULL CHECK(item_type IN ('step','build','phase','crew','batch')),
      item_id TEXT NOT NULL,
      item_data TEXT NOT NULL,
      batch_id TEXT,
      deleted_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    -- Google 계정
    CREATE TABLE IF NOT EXISTS google_accounts (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      token_expiry TEXT NOT NULL,
      calendars_synced TEXT
    );

    -- 캘린더 이벤트 캐시
    CREATE TABLE IF NOT EXISTS calendar_events_cache (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES google_accounts(id),
      calendar_id TEXT NOT NULL,
      summary TEXT,
      description TEXT,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      location TEXT,
      attendees TEXT,
      recurrence TEXT,
      raw_data TEXT NOT NULL,
      synced_at TEXT NOT NULL
    );

    -- AI 대화 기록
    CREATE TABLE IF NOT EXISTS planner_sessions (
      id TEXT PRIMARY KEY,
      build_id TEXT REFERENCES builds(id),
      title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS planner_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES planner_sessions(id),
      role TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    -- 앱 설정
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- ========== 인덱스 ==========
    CREATE INDEX IF NOT EXISTS idx_phases_build ON phases(build_id, "order");
    CREATE INDEX IF NOT EXISTS idx_steps_phase_order ON steps(phase_id, "order");
    CREATE INDEX IF NOT EXISTS idx_steps_build ON steps(build_id);
    CREATE INDEX IF NOT EXISTS idx_steps_updated ON steps(updated_at);
    CREATE INDEX IF NOT EXISTS idx_step_assignees_crew ON step_assignees(crew_id);
    CREATE INDEX IF NOT EXISTS idx_checklist_step ON checklist_items(step_id, "order");
    CREATE INDEX IF NOT EXISTS idx_comments_step ON comments(step_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_deep_work_started ON deep_work_sessions(started_at);
    CREATE INDEX IF NOT EXISTS idx_routine_outputs_generated ON routine_outputs(generated_at);
    CREATE INDEX IF NOT EXISTS idx_routine_outputs_routine ON routine_outputs(routine_id);
    CREATE INDEX IF NOT EXISTS idx_event_step_links_step ON event_step_links(step_id);
    CREATE INDEX IF NOT EXISTS idx_guides_build_period ON guides(build_id, period_start);
    CREATE INDEX IF NOT EXISTS idx_guides_crew ON guides(crew_id);
    CREATE INDEX IF NOT EXISTS idx_viewpoints_build ON viewpoints(build_id);
    CREATE INDEX IF NOT EXISTS idx_deleted_items_expires ON deleted_items(expires_at);
    CREATE INDEX IF NOT EXISTS idx_calendar_cache_time ON calendar_events_cache(start_time, end_time);
    CREATE INDEX IF NOT EXISTS idx_calendar_cache_account ON calendar_events_cache(account_id, calendar_id);
    CREATE INDEX IF NOT EXISTS idx_planner_messages_session ON planner_messages(session_id, created_at);
  `);
}
```

- [ ] **Step 6: 테스트 실행**

```bash
pnpm vitest run tests/main/db.test.ts
```

Expected: 4 tests PASS

- [ ] **Step 7: Prepared Statement 캐시**

```typescript
// main/db/statements.ts
import Database from 'better-sqlite3';

export function createStatements(db: Database.Database) {
  return {
    // Build
    getBuild: db.prepare('SELECT * FROM builds WHERE id = ?'),
    listBuilds: db.prepare('SELECT * FROM builds ORDER BY updated_at DESC'),
    insertBuild: db.prepare(
      'INSERT INTO builds (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    ),
    updateBuild: db.prepare(
      'UPDATE builds SET name = ?, description = ?, updated_at = ? WHERE id = ?'
    ),

    // Phase
    listPhases: db.prepare('SELECT * FROM phases WHERE build_id = ? ORDER BY "order"'),
    insertPhase: db.prepare(
      'INSERT INTO phases (id, build_id, name, "order", wip_limit) VALUES (?, ?, ?, ?, ?)'
    ),

    // Step
    listStepsByPhase: db.prepare('SELECT * FROM steps WHERE phase_id = ? ORDER BY "order"'),
    listStepsByBuild: db.prepare('SELECT * FROM steps WHERE build_id = ? ORDER BY "order"'),
    getStep: db.prepare('SELECT * FROM steps WHERE id = ?'),
    insertStep: db.prepare(
      'INSERT INTO steps (id, build_id, phase_id, title, description, priority, due_date, "order", created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ),
    moveStep: db.prepare(
      'UPDATE steps SET phase_id = ?, "order" = ?, updated_at = ? WHERE id = ?'
    ),

    // Crew
    listCrews: db.prepare('SELECT * FROM crews ORDER BY name'),
    insertCrew: db.prepare(
      'INSERT INTO crews (id, name, email, role, avatar_url) VALUES (?, ?, ?, ?, ?)'
    ),

    // Trash
    insertDeletedItem: db.prepare(
      'INSERT INTO deleted_items (id, item_type, item_id, item_data, batch_id, deleted_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ),
    listDeletedItems: db.prepare('SELECT * FROM deleted_items ORDER BY deleted_at DESC'),
    getDeletedItem: db.prepare('SELECT * FROM deleted_items WHERE id = ?'),
    removeDeletedItem: db.prepare('DELETE FROM deleted_items WHERE id = ?'),
    purgeExpired: db.prepare('DELETE FROM deleted_items WHERE expires_at < ?'),
    getDeletedByBatch: db.prepare('SELECT * FROM deleted_items WHERE batch_id = ?'),
  } as const;
}

export type Statements = ReturnType<typeof createStatements>;
```

- [ ] **Step 8: 커밋**

```bash
git add main/db/ shared/types.ts main/ipc/channels.ts vitest.config.ts tests/main/db.test.ts
git commit -m "feat: SQLite connection, full schema, prepared statements, and DB tests"
```

---

### Task 5: Soft Delete 휴지통

**Files:**
- Create: `main/db/trash.ts`
- Test: `tests/main/trash.test.ts`

- [ ] **Step 1: 휴지통 테스트 작성 (실패 확인)**

```typescript
// tests/main/trash.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { createConnection } from '@main/db/connection';
import { applySchema } from '@main/db/schema';
import { createStatements } from '@main/db/statements';
import { TrashService } from '@main/db/trash';

describe('TrashService', () => {
  let db: Database.Database;
  let trash: TrashService;

  beforeEach(() => {
    db = createConnection(':memory:');
    applySchema(db);
    const stmts = createStatements(db);
    trash = new TrashService(db, stmts);

    // seed data
    stmts.insertBuild.run('b1', 'Build 1', 'desc', '2026-06-24T00:00:00Z', '2026-06-24T00:00:00Z');
    stmts.insertPhase.run('p1', 'b1', 'To Do', 0, null);
    stmts.insertStep.run('s1', 'b1', 'p1', 'Step 1', 'desc', 'medium', null, 0, null, '2026-06-24T00:00:00Z', '2026-06-24T00:00:00Z');
  });

  it('should soft-delete a step and move to trash', () => {
    trash.softDelete('step', 's1');

    const step = db.prepare('SELECT * FROM steps WHERE id = ?').get('s1');
    expect(step).toBeUndefined();

    const items = trash.list();
    expect(items).toHaveLength(1);
    expect(items[0].itemType).toBe('step');
    expect(items[0].itemId).toBe('s1');
  });

  it('should restore a step from trash', () => {
    trash.softDelete('step', 's1');
    const items = trash.list();
    trash.restore(items[0].id);

    const step = db.prepare('SELECT * FROM steps WHERE id = ?').get('s1') as any;
    expect(step).toBeDefined();
    expect(step.title).toBe('Step 1');

    expect(trash.list()).toHaveLength(0);
  });

  it('should purge expired items', () => {
    trash.softDelete('step', 's1');

    // 만료일을 과거로 수정
    db.prepare('UPDATE deleted_items SET expires_at = ?').run('2020-01-01T00:00:00Z');

    const purged = trash.purgeExpired();
    expect(purged).toBe(1);
    expect(trash.list()).toHaveLength(0);
  });

  it('should batch-delete and batch-restore', () => {
    stmts.insertStep.run('s2', 'b1', 'p1', 'Step 2', '', 'low', null, 1, null, '2026-06-24T00:00:00Z', '2026-06-24T00:00:00Z');

    const batchId = trash.softDeleteBatch('step', ['s1', 's2']);
    expect(trash.list()).toHaveLength(2);

    trash.restoreBatch(batchId);
    expect(trash.list()).toHaveLength(0);

    const s1 = db.prepare('SELECT * FROM steps WHERE id = ?').get('s1');
    const s2 = db.prepare('SELECT * FROM steps WHERE id = ?').get('s2');
    expect(s1).toBeDefined();
    expect(s2).toBeDefined();
  });
});
```

```bash
pnpm vitest run tests/main/trash.test.ts
```

Expected: FAIL — `TrashService` not found

- [ ] **Step 2: TrashService 구현**

```typescript
// main/db/trash.ts
import Database from 'better-sqlite3';
import { v4 as uuid } from 'uuid';
import type { Statements } from './statements';
import type { DeletedItem } from '../../shared/types';

const TABLE_MAP: Record<string, string> = {
  step: 'steps',
  build: 'builds',
  phase: 'phases',
  crew: 'crews',
};

export class TrashService {
  constructor(
    private db: Database.Database,
    private stmts: Statements,
  ) {}

  softDelete(itemType: string, itemId: string, batchId?: string): string {
    const table = TABLE_MAP[itemType];
    if (!table) throw new Error(`Unknown item type: ${itemType}`);

    const row = this.db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(itemId);
    if (!row) throw new Error(`Item not found: ${itemType}/${itemId}`);

    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const deletedItemId = uuid();

    const txn = this.db.transaction(() => {
      this.stmts.insertDeletedItem.run(
        deletedItemId, itemType, itemId, JSON.stringify(row),
        batchId ?? null, now, expiresAt
      );
      this.db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(itemId);
    });
    txn();

    return deletedItemId;
  }

  softDeleteBatch(itemType: string, itemIds: string[]): string {
    const batchId = uuid();
    const txn = this.db.transaction(() => {
      for (const id of itemIds) {
        this.softDelete(itemType, id, batchId);
      }
    });
    txn();
    return batchId;
  }

  restore(deletedItemId: string): void {
    const item = this.stmts.getDeletedItem.get(deletedItemId) as DeletedItem | undefined;
    if (!item) throw new Error(`Deleted item not found: ${deletedItemId}`);

    const table = TABLE_MAP[item.itemType];
    if (!table) throw new Error(`Unknown item type: ${item.itemType}`);

    const data = JSON.parse(item.itemData);
    const columns = Object.keys(data);
    const placeholders = columns.map(() => '?').join(', ');
    const quotedColumns = columns.map(c => `"${c}"`).join(', ');

    const txn = this.db.transaction(() => {
      this.db.prepare(`INSERT INTO ${table} (${quotedColumns}) VALUES (${placeholders})`).run(
        ...columns.map(c => data[c])
      );
      this.stmts.removeDeletedItem.run(deletedItemId);
    });
    txn();
  }

  restoreBatch(batchId: string): void {
    const items = this.stmts.getDeletedByBatch.all(batchId) as DeletedItem[];
    const txn = this.db.transaction(() => {
      for (const item of items) {
        this.restore(item.id);
      }
    });
    txn();
  }

  list(): DeletedItem[] {
    return this.stmts.listDeletedItems.all() as DeletedItem[];
  }

  purgeExpired(): number {
    const now = new Date().toISOString();
    const result = this.stmts.purgeExpired.run(now);
    return result.changes;
  }
}
```

- [ ] **Step 3: 테스트 실행**

```bash
pnpm vitest run tests/main/trash.test.ts
```

Expected: 4 tests PASS

- [ ] **Step 4: 커밋**

```bash
git add main/db/trash.ts tests/main/trash.test.ts
git commit -m "feat: soft delete trash service with batch support and 30-day expiry"
```

---

### Task 6: 이벤트 버스

**Files:**
- Create: `main/events/bus.ts`
- Test: `tests/main/event-bus.test.ts`

- [ ] **Step 1: 이벤트 버스 테스트 작성 (실패 확인)**

```typescript
// tests/main/event-bus.test.ts
import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '@main/events/bus';
import type { AppEvents } from '@shared/types';

describe('EventBus', () => {
  it('should emit and receive events', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.on('step:completed', handler);
    bus.emit('step:completed', { stepId: 's1' });

    expect(handler).toHaveBeenCalledWith({ stepId: 's1' });
  });

  it('should support multiple handlers for same event', () => {
    const bus = new EventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();

    bus.on('step:moved', h1);
    bus.on('step:moved', h2);
    bus.emit('step:moved', { stepId: 's1', fromPhase: 'p1', toPhase: 'p2' });

    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
  });

  it('should unsubscribe with off()', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.on('step:completed', handler);
    bus.off('step:completed', handler);
    bus.emit('step:completed', { stepId: 's1' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('should not throw if handler errors', () => {
    const bus = new EventBus();
    const badHandler = vi.fn(() => { throw new Error('boom'); });
    const goodHandler = vi.fn();

    bus.on('step:completed', badHandler);
    bus.on('step:completed', goodHandler);

    expect(() => bus.emit('step:completed', { stepId: 's1' })).not.toThrow();
    expect(goodHandler).toHaveBeenCalled();
  });
});
```

```bash
pnpm vitest run tests/main/event-bus.test.ts
```

Expected: FAIL — `EventBus` not found

- [ ] **Step 2: EventBus 구현**

```typescript
// main/events/bus.ts
import type { AppEvents } from '../../shared/types';

type Handler<T> = (payload: T) => void;

export class EventBus {
  private handlers = new Map<string, Set<Handler<any>>>();

  on<K extends keyof AppEvents>(event: K, handler: Handler<AppEvents[K]>): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  off<K extends keyof AppEvents>(event: K, handler: Handler<AppEvents[K]>): void {
    this.handlers.get(event)?.delete(handler);
  }

  emit<K extends keyof AppEvents>(event: K, payload: AppEvents[K]): void {
    const eventHandlers = this.handlers.get(event);
    if (!eventHandlers) return;

    for (const handler of eventHandlers) {
      try {
        handler(payload);
      } catch (err) {
        console.error(`[EventBus] Handler error for "${String(event)}":`, err);
      }
    }
  }
}

/** 싱글톤 인스턴스 — Main process에서 사용 */
export const appBus = new EventBus();
```

- [ ] **Step 3: 테스트 실행**

```bash
pnpm vitest run tests/main/event-bus.test.ts
```

Expected: 4 tests PASS

- [ ] **Step 4: 커밋**

```bash
git add main/events/bus.ts tests/main/event-bus.test.ts
git commit -m "feat: typed event bus with error isolation and singleton instance"
```

---

### Task 7: IPC 핸들러 등록 + Preload

**Files:**
- Create: `main/ipc/register.ts`
- Modify: `main/preload.ts`
- Create: `renderer/lib/ipc-client.ts`

- [ ] **Step 1: IPC 핸들러 등록 모듈**

```typescript
// main/ipc/register.ts
import { ipcMain } from 'electron';
import { v4 as uuid } from 'uuid';
import type { IpcChannels, IpcChannel } from './channels';
import type { Statements } from '../db/statements';
import type { TrashService } from '../db/trash';
import type { EventBus } from '../events/bus';
import Database from 'better-sqlite3';

interface RegisterDeps {
  db: Database.Database;
  stmts: Statements;
  trash: TrashService;
  bus: EventBus;
}

export function registerIpcHandlers({ db, stmts, trash, bus }: RegisterDeps): void {
  function handle<C extends IpcChannel>(
    channel: C,
    handler: (...args: IpcChannels[C]['args']) => IpcChannels[C]['return']
  ) {
    ipcMain.handle(channel, (_event, ...args: any[]) => handler(...args));
  }

  const now = () => new Date().toISOString();

  // === Build ===
  handle('build:list', () => stmts.listBuilds.all());
  handle('build:get', (id) => stmts.getBuild.get(id) ?? null);
  handle('build:create', (data) => {
    const id = uuid();
    const ts = now();
    stmts.insertBuild.run(id, data.name, data.description ?? '', ts, ts);
    const build = stmts.getBuild.get(id);
    bus.emit('build:created', { buildId: id });
    return build;
  });
  handle('build:delete', (id) => {
    trash.softDelete('build', id);
  });

  // === Phase ===
  handle('phase:list', (buildId) => stmts.listPhases.all(buildId));
  handle('phase:create', (data) => {
    const id = uuid();
    stmts.insertPhase.run(id, data.buildId, data.name, data.order, data.wipLimit ?? null);
    return db.prepare('SELECT * FROM phases WHERE id = ?').get(id);
  });
  handle('phase:delete', (id) => {
    trash.softDelete('phase', id);
  });

  // === Step ===
  handle('step:list', (buildId) => stmts.listStepsByBuild.all(buildId));
  handle('step:listByPhase', (phaseId) => stmts.listStepsByPhase.all(phaseId));
  handle('step:get', (id) => stmts.getStep.get(id) ?? null);
  handle('step:create', (data) => {
    const id = uuid();
    const ts = now();
    stmts.insertStep.run(
      id, data.buildId, data.phaseId, data.title, data.description ?? '',
      data.priority ?? 'medium', data.dueDate ?? null, data.order, data.createdBy ?? null, ts, ts
    );
    return stmts.getStep.get(id);
  });
  handle('step:createBatch', (steps) => {
    const ts = now();
    const results: any[] = [];
    const txn = db.transaction(() => {
      for (const data of steps) {
        const id = uuid();
        stmts.insertStep.run(
          id, data.buildId, data.phaseId, data.title, data.description ?? '',
          data.priority ?? 'medium', data.dueDate ?? null, data.order, data.createdBy ?? null, ts, ts
        );
        results.push(stmts.getStep.get(id));
      }
    });
    txn();
    return results;
  });
  handle('step:move', ({ stepId, targetPhaseId, order }) => {
    const step = stmts.getStep.get(stepId) as any;
    if (!step) return;
    const fromPhase = step.phase_id;
    stmts.moveStep.run(targetPhaseId, order, now(), stepId);
    bus.emit('step:moved', { stepId, fromPhase, toPhase: targetPhaseId });
  });
  handle('step:delete', (id) => {
    trash.softDelete('step', id);
    bus.emit('step:deleted', { stepId: id });
  });

  // === Crew ===
  handle('crew:list', () => stmts.listCrews.all());
  handle('crew:create', (data) => {
    const id = uuid();
    stmts.insertCrew.run(id, data.name, data.email ?? null, data.role ?? null, data.avatarUrl ?? null);
    return db.prepare('SELECT * FROM crews WHERE id = ?').get(id);
  });
  handle('crew:delete', (id) => {
    trash.softDelete('crew', id);
  });

  // === Trash ===
  handle('trash:list', () => trash.list());
  handle('trash:restore', (id) => trash.restore(id));
  handle('trash:restoreBatch', (batchId) => trash.restoreBatch(batchId));
  handle('trash:purge', (id) => {
    db.prepare('DELETE FROM deleted_items WHERE id = ?').run(id);
  });
  handle('trash:purgeExpired', () => trash.purgeExpired());

  // === Deep Work ===
  handle('deepwork:start', ({ stepId }) => {
    const id = uuid();
    const ts = now();
    db.prepare(
      'INSERT INTO deep_work_sessions (id, started_at, last_step_id) VALUES (?, ?, ?)'
    ).run(id, ts, stepId);
    bus.emit('deepwork:started', { sessionId: id });
    return db.prepare('SELECT * FROM deep_work_sessions WHERE id = ?').get(id);
  });
  handle('deepwork:end', (sessionId) => {
    const ts = now();
    const session = db.prepare('SELECT * FROM deep_work_sessions WHERE id = ?').get(sessionId) as any;
    if (session) {
      const startedAt = new Date(session.started_at).getTime();
      const minutes = Math.round((Date.now() - startedAt) / 60000);
      db.prepare(
        'UPDATE deep_work_sessions SET ended_at = ?, total_focus_minutes = ? WHERE id = ?'
      ).run(ts, minutes, sessionId);
    }
    const updated = db.prepare('SELECT * FROM deep_work_sessions WHERE id = ?').get(sessionId);
    bus.emit('deepwork:ended', { sessionId, stepsCompleted: [] });
    return updated;
  });
  handle('deepwork:getCurrent', () => {
    return db.prepare(
      'SELECT * FROM deep_work_sessions WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1'
    ).get() ?? null;
  });
  handle('deepwork:updateContext', (sessionId, contextNote) => {
    db.prepare('UPDATE deep_work_sessions SET context_note = ? WHERE id = ?').run(contextNote, sessionId);
  });
}
```

- [ ] **Step 2: Preload 스크립트**

Nextron이 생성한 `main/preload.ts`를 다음으로 교체한다:

```typescript
// main/preload.ts
import { contextBridge, ipcRenderer } from 'electron';
import type { IpcChannels, IpcChannel } from './ipc/channels';

type IpcInvoker = {
  [C in IpcChannel]: (...args: IpcChannels[C]['args']) => Promise<IpcChannels[C]['return']>;
};

const api: IpcInvoker = new Proxy({} as IpcInvoker, {
  get(_target, channel: string) {
    return (...args: any[]) => ipcRenderer.invoke(channel, ...args);
  },
});

const events = {
  on: (channel: string, callback: (...args: any[]) => void) => {
    const listener = (_event: any, ...args: any[]) => callback(...args);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
};

contextBridge.exposeInMainWorld('api', api);
contextBridge.exposeInMainWorld('events', events);
```

- [ ] **Step 3: Renderer IPC 클라이언트**

```typescript
// renderer/lib/ipc-client.ts
import type { IpcChannels, IpcChannel } from '../../main/ipc/channels';

type IpcApi = {
  [C in IpcChannel]: (...args: IpcChannels[C]['args']) => Promise<IpcChannels[C]['return']>;
};

interface EventsApi {
  on: (channel: string, callback: (...args: any[]) => void) => () => void;
}

declare global {
  interface Window {
    api: IpcApi;
    events: EventsApi;
  }
}

export const ipc: IpcApi = typeof window !== 'undefined'
  ? window.api
  : (new Proxy({}, { get: () => () => Promise.reject('No IPC in SSR') }) as IpcApi);

export const events: EventsApi = typeof window !== 'undefined'
  ? window.events
  : { on: () => () => {} };
```

- [ ] **Step 4: 커밋**

```bash
git add main/ipc/register.ts main/preload.ts renderer/lib/ipc-client.ts
git commit -m "feat: IPC handler registration, preload bridge, and renderer client"
```

---

### Task 8: Main Process 엔트리 + Splash Screen

**Files:**
- Modify: `main/background.ts`
- Create: `resources/splash.html`

- [ ] **Step 1: Splash Screen HTML**

```html
<!-- resources/splash.html -->
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      margin: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      background: #fafafa;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #333;
    }
    .loader {
      text-align: center;
    }
    .loader h1 {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .loader p {
      font-size: 14px;
      color: #888;
    }
  </style>
</head>
<body>
  <div class="loader">
    <h1>PM Supporter</h1>
    <p>Loading...</p>
  </div>
</body>
</html>
```

- [ ] **Step 2: Main process 엔트리 재작성**

Nextron이 생성한 `main/background.ts`를 다음으로 교체한다:

```typescript
// main/background.ts
import path from 'path';
import { app, BrowserWindow } from 'electron';
import serve from 'electron-serve';
import { createConnection } from './db/connection';
import { applySchema } from './db/schema';
import { createStatements } from './db/statements';
import { TrashService } from './db/trash';
import { EventBus } from './events/bus';
import { registerIpcHandlers } from './ipc/register';

const isProd = process.env.NODE_ENV === 'production';

if (isProd) {
  serve({ directory: 'app' });
}

let mainWindow: BrowserWindow | null = null;

async function createWindow() {
  // 1. Splash 먼저 표시
  const splash = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: false,
    resizable: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  splash.loadFile(path.join(__dirname, '../resources/splash.html'));

  // 2. 메인 윈도우 생성 (숨긴 상태)
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 3. DB 초기화 (lazy — splash 표시 후)
  const dbPath = path.join(app.getPath('userData'), 'pm-supporter.db');
  const db = createConnection(isProd ? dbPath : ':memory:');
  applySchema(db);
  const stmts = createStatements(db);
  const trash = new TrashService(db, stmts);
  const bus = new EventBus();

  // 4. IPC 등록
  registerIpcHandlers({ db, stmts, trash, bus });

  // 5. 페이지 로드
  if (isProd) {
    await mainWindow.loadURL('app://./');
  } else {
    const port = process.argv[2] || 8888;
    await mainWindow.loadURL(`http://localhost:${port}/`);
  }

  // 6. Splash 닫고 메인 표시
  mainWindow.once('ready-to-show', () => {
    splash.destroy();
    mainWindow!.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    db.close();
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
```

- [ ] **Step 3: 커밋**

```bash
git add main/background.ts resources/splash.html
git commit -m "feat: main process entry with splash screen and lazy DB init"
```

---

### Task 9: Zustand 스토어 + Tailwind 테마 + 앱 쉘

**Files:**
- Create: `renderer/stores/app-store.ts`
- Modify: `renderer/styles/globals.css`
- Create: `renderer/components/layout/Shell.tsx`
- Modify: `renderer/pages/_app.tsx`
- Modify: `renderer/pages/index.tsx`

- [ ] **Step 1: Zustand 설치**

```bash
pnpm add zustand
```

- [ ] **Step 2: 정규화된 Zustand 스토어**

```typescript
// renderer/stores/app-store.ts
import { create } from 'zustand';
import type { Build, Phase, Step, Crew } from '@shared/types';

interface AppState {
  // 정규화된 데이터
  builds: Record<string, Build>;
  phases: Record<string, Phase>;
  steps: Record<string, Step>;
  crews: Record<string, Crew>;

  // 순서 정보
  phaseOrder: Record<string, string[]>;  // buildId → phaseIds
  stepOrder: Record<string, string[]>;   // phaseId → stepIds

  // UI 상태
  activeBuildId: string | null;
  isDeepWork: boolean;
  syncStatus: 'synced' | 'syncing' | 'offline' | 'error';

  // 액션
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
    phases: {
      ...state.phases,
      ...Object.fromEntries(phases.map(p => [p.id, p])),
    },
    phaseOrder: {
      ...state.phaseOrder,
      [buildId]: phases.map(p => p.id),
    },
  })),

  setSteps: (phaseId, steps) => set((state) => ({
    steps: {
      ...state.steps,
      ...Object.fromEntries(steps.map(s => [s.id, s])),
    },
    stepOrder: {
      ...state.stepOrder,
      [phaseId]: steps.map(s => s.id),
    },
  })),

  setCrews: (crews) => set({
    crews: Object.fromEntries(crews.map(c => [c.id, c])),
  }),

  setActiveBuild: (id) => set({ activeBuildId: id }),
  setDeepWork: (on) => set({ isDeepWork: on }),
  setSyncStatus: (status) => set({ syncStatus: status }),
}));
```

- [ ] **Step 3: Tailwind 테마 변수 (듀얼 모드)**

Nextron + Tailwind 템플릿이 생성한 `renderer/styles/globals.css`를 다음으로 교체한다:

```css
/* renderer/styles/globals.css */
@import 'tailwindcss';

@theme {
  /* 일반 모드 (라이트) */
  --color-surface: oklch(0.98 0.005 250);
  --color-surface-raised: oklch(1 0 0);
  --color-text-primary: oklch(0.2 0.01 250);
  --color-text-secondary: oklch(0.45 0.01 250);
  --color-accent: oklch(0.55 0.15 250);
  --color-accent-hover: oklch(0.5 0.17 250);
  --color-border: oklch(0.9 0.005 250);
  --color-danger: oklch(0.55 0.2 25);
  --color-warning: oklch(0.7 0.15 70);
  --color-success: oklch(0.6 0.15 150);
}

/* Deep Work 모드 (다크) */
[data-mode='deepwork'] {
  --color-surface: oklch(0.15 0.01 250);
  --color-surface-raised: oklch(0.2 0.01 250);
  --color-text-primary: oklch(0.9 0.005 250);
  --color-text-secondary: oklch(0.6 0.005 250);
  --color-accent: oklch(0.7 0.1 250);
  --color-accent-hover: oklch(0.75 0.12 250);
  --color-border: oklch(0.3 0.01 250);
}

body {
  background-color: var(--color-surface);
  color: var(--color-text-primary);
}
```

- [ ] **Step 4: 앱 쉘 컴포넌트**

```bash
mkdir -p renderer/components/layout
```

```tsx
// renderer/components/layout/Shell.tsx
import { type ReactNode } from 'react';
import { useAppStore } from '../../stores/app-store';

interface ShellProps {
  children: ReactNode;
}

export function Shell({ children }: ShellProps) {
  const isDeepWork = useAppStore((s) => s.isDeepWork);
  const syncStatus = useAppStore((s) => s.syncStatus);
  const setDeepWork = useAppStore((s) => s.setDeepWork);

  return (
    <div data-mode={isDeepWork ? 'deepwork' : 'normal'} className="flex h-screen">
      {/* 사이드바 — Deep Work 시 숨김 */}
      {!isDeepWork && (
        <nav className="w-56 border-r border-border bg-surface-raised flex flex-col p-4">
          <h1 className="text-lg font-semibold text-text-primary mb-6">PM Supporter</h1>
          <ul className="space-y-2 flex-1">
            <li className="text-text-secondary hover:text-text-primary cursor-pointer">홈</li>
            <li className="text-text-secondary hover:text-text-primary cursor-pointer">빌드</li>
            <li className="text-text-secondary hover:text-text-primary cursor-pointer">캘린더</li>
          </ul>
          {/* 동기화 상태 */}
          <div className="text-xs text-text-secondary">
            {syncStatus === 'synced' && '🟢 동기화됨'}
            {syncStatus === 'syncing' && '🔄 동기화 중'}
            {syncStatus === 'offline' && '🟡 오프라인'}
            {syncStatus === 'error' && '🔴 동기화 오류'}
          </div>
        </nav>
      )}

      {/* 메인 콘텐츠 */}
      <main className="flex-1 bg-surface overflow-auto">
        {children}
      </main>

      {/* AI 정육각형 버튼 — 항상 표시 */}
      <button
        className="fixed bottom-6 left-6 w-12 h-12 bg-accent hover:bg-accent-hover text-surface-raised rounded-xl flex items-center justify-center shadow-lg transition-colors z-50"
        style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}
        title="AI"
      >
        AI
      </button>

      {/* Deep Work 토글 */}
      <button
        onClick={() => setDeepWork(!isDeepWork)}
        className="fixed top-4 right-4 px-3 py-1.5 text-sm rounded-full border border-border text-text-secondary hover:text-text-primary hover:border-accent transition-colors z-50"
      >
        {isDeepWork ? '🔴 Deep Work 종료' : '🔘 Deep Work'}
      </button>
    </div>
  );
}
```

- [ ] **Step 5: _app.tsx + index.tsx 수정**

```tsx
// renderer/pages/_app.tsx
import type { AppProps } from 'next/app';
import '../styles/globals.css';
import { Shell } from '../components/layout/Shell';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <Shell>
      <Component {...pageProps} />
    </Shell>
  );
}
```

```tsx
// renderer/pages/index.tsx
export default function Home() {
  return (
    <div className="p-8">
      <h2 className="text-2xl font-semibold text-text-primary mb-4">
        홈 대시보드
      </h2>
      <p className="text-text-secondary">
        Plan 4에서 구현 예정
      </p>
    </div>
  );
}
```

- [ ] **Step 6: 앱 실행 확인**

```bash
pnpm dev
```

Expected:
- Splash 표시 후 메인 윈도우 등장
- 좌측 사이드바 (홈/빌드/캘린더) + 동기화 상태 표시
- 우상단 Deep Work 토글 → 클릭 시 사이드바 숨김 + 테마 다크 전환
- 좌하단 정육각형 AI 버튼 상시 표시

확인 후 Ctrl+C로 종료.

- [ ] **Step 7: 커밋**

```bash
git add renderer/ vitest.config.ts
git commit -m "feat: Zustand store (normalized), Tailwind dual theme, app shell with AI button"
```

---

### Task 10: .env + .gitignore + CLAUDE.md 업데이트

**Files:**
- Create: `.env.example`
- Modify: `.gitignore`
- Modify: `CLAUDE.md`

- [ ] **Step 1: .env.example**

```bash
# .env.example
# Google OAuth (Plan 3에서 사용)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Anthropic API (Plan 5에서 사용)
ANTHROPIC_API_KEY=
```

- [ ] **Step 2: .gitignore 업데이트**

기존 .gitignore에 다음을 추가:

```
# Electron
/app
/dist
*.db

# pnpm
.pnpm-store/

# native modules
/build/Release
```

- [ ] **Step 3: CLAUDE.md 업데이트**

CLAUDE.md에 빌드/개발 커맨드를 추가한다:

```markdown
## Development Commands

```bash
pnpm dev          # 개발 모드 실행 (Electron + Next.js hot reload)
pnpm build        # 프로덕션 빌드
pnpm vitest run   # 전체 테스트
pnpm vitest run tests/main/db.test.ts  # 단일 테스트
```

## Architecture

- `main/` — Electron main process (DB, IPC, API, 이벤트 버스)
- `renderer/` — Next.js renderer (React UI, Zustand, Tailwind)
- `shared/` — Main/Renderer 공유 타입 (앱 고유 용어 체계)
- `tests/` — Vitest 유닛 테스트 + Playwright E2E

## App Terminology

코드에서도 앱 고유 용어를 사용한다: Step(태스크), Build(프로젝트), Phase(컬럼), Crew(팀원), Guide(팀 오더), Viewpoint(필터 뷰), Stage(스프린트), Checkpoint(마일스톤), Roadmap(WBS). 상세: `shared/types.ts`
```

- [ ] **Step 4: 커밋**

```bash
git add .env.example .gitignore CLAUDE.md
git commit -m "chore: add env template, update gitignore and CLAUDE.md with dev commands"
```

---

## Summary

| Task | 내용 | 테스트 |
|---|---|---|
| 1 | Node.js v20 + pnpm 환경 | — |
| 2 | Nextron 스캐폴딩 | 앱 실행 확인 |
| 3 | 공유 타입 + IPC 채널 정의 | 타입 체크 |
| 4 | SQLite 연결 + 스키마 + statements | 4 unit tests |
| 5 | Soft Delete 휴지통 | 4 unit tests |
| 6 | 이벤트 버스 | 4 unit tests |
| 7 | IPC 핸들러 + Preload + Renderer 클라이언트 | — |
| 8 | Main process + Splash screen | 앱 실행 확인 |
| 9 | Zustand + Tailwind 듀얼 테마 + 앱 쉘 | 앱 실행 확인 |
| 10 | .env + .gitignore + CLAUDE.md | — |

**전체 커밋: 9회, 유닛 테스트: 12개**

이 플랜이 완료되면 Plan 2 (칸반)에서 바로 빌드/페이즈/스텝 UI를 구현할 수 있는 토대가 갖춰진다.
