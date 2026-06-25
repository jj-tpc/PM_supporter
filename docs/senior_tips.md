# Senior Engineering Tips — Electron + Next.js 성능 최적화

> 이 문서는 PM Supporter 앱의 구현 과정에서 반드시 참고해야 하는 성능 최적화 가이드이다.
> Electron은 기본적으로 Chromium + Node.js를 통째로 올리므로, 아무 생각 없이 만들면 느리다.
> 아래 원칙들을 코드 전반에 걸쳐 적용한다.

---

## 1. 앱 시작 속도

### 1.1 Main Process 부팅 최소화

```typescript
// BAD — 앱 시작 시 모든 모듈을 동기적으로 불러옴
import { initDB } from './db';
import { initGoogleAuth } from './google';
import { initLLM } from './llm';

// GOOD — BrowserWindow 먼저 띄우고, 나머지는 lazy load
app.whenReady().then(async () => {
  const win = createWindow(); // 화면 먼저 보여줌
  win.once('ready-to-show', () => win.show());

  // 나머지는 idle 타이밍에 점진적 로드
  const { initDB } = await import('./db');
  await initDB();
  // ...
});
```

**핵심 원칙:**
- `BrowserWindow` 생성은 최우선 — 사용자에게 화면을 먼저 보여준다
- 무거운 초기화(DB, OAuth, API 클라이언트)는 `ready-to-show` 이후 lazy import
- `require()` / top-level `import`를 줄이고, 동적 `import()`를 적극 활용
- `v8-compile-cache` 또는 V8 snapshot 활용 고려

### 1.2 Preload Script 경량화

```typescript
// preload.ts — 여기에 무거운 로직 넣지 말 것
// IPC 브릿지만 노출하고 끝
contextBridge.exposeInMainWorld('api', {
  calendar: {
    getEvents: (range: DateRange) => ipcRenderer.invoke('calendar:getEvents', range),
    createEvent: (event: EventData) => ipcRenderer.invoke('calendar:createEvent', event),
    // ...
  },
  // ...
});
```

### 1.3 Splash Screen 패턴

```typescript
// 메인 윈도우 로딩 동안 경량 splash 표시
const splash = new BrowserWindow({
  width: 400, height: 300,
  transparent: true, frame: false,
  webPreferences: { /* minimal */ }
});
splash.loadFile('splash.html'); // 순수 HTML, 번들 없음

const mainWindow = new BrowserWindow({ show: false, /* ... */ });
mainWindow.loadURL('http://localhost:3000');
mainWindow.once('ready-to-show', () => {
  splash.destroy();
  mainWindow.show();
});
```

---

## 2. 렌더러 프로세스 (React/Next.js) 최적화

### 2.1 번들 크기 관리

- **next.config.js** 에서 `output: 'export'` 사용 시 불필요한 서버 코드 제거
- `@next/bundle-analyzer`로 번들 크기를 주기적으로 모니터링
- **Tree shaking이 안 되는 라이브러리 주의:**
  - `lodash` → `lodash-es` 또는 개별 import (`lodash/debounce`)
  - `moment` → `date-fns` 또는 `dayjs`
  - `@mui/*` 등 거대 UI 라이브러리 지양 — Tailwind 직접 사용

### 2.2 React 렌더링 최적화

```typescript
// BAD — 보드 전체가 카드 하나 움직일 때마다 리렌더
function Board({ tasks }: { tasks: Task[] }) {
  return (
    <div>
      {columns.map(col => (
        <Column key={col.id}>
          {tasks.filter(t => t.columnId === col.id).map(t => (
            <TaskCard key={t.id} task={t} />
          ))}
        </Column>
      ))}
    </div>
  );
}

// GOOD — 컬럼 단위로 분리, 각 컬럼이 자기 태스크만 구독
function Column({ columnId }: { columnId: string }) {
  // Zustand selector로 해당 컬럼의 태스크만 구독
  const tasks = useStore(
    useCallback(s => s.tasks.filter(t => t.columnId === columnId), [columnId])
  );
  return (
    <div>
      {tasks.map(t => <TaskCard key={t.id} taskId={t.id} />)}
    </div>
  );
}

// TaskCard도 ID로만 구독 — 다른 카드 변경 시 리렌더 안 됨
const TaskCard = memo(function TaskCard({ taskId }: { taskId: string }) {
  const task = useStore(useCallback(s => s.tasks.find(t => t.id === taskId), [taskId]));
  if (!task) return null;
  return <div>{task.title}</div>;
});
```

**칸반 보드 특화 규칙:**
- 컬럼/카드를 **정규화된 구조**로 저장 (`Record<id, entity>`)하고, 셀렉터로 필요한 것만 구독
- `filter()` 결과가 매번 새 배열이면 리렌더 유발 → `useMemo` 또는 Zustand의 `shallow` 비교 사용
- DnD 중에는 실제 상태 업데이트를 지연시키고, 시각적 피드백만 먼저 처리 (optimistic UI)

### 2.3 Zustand 상태 설계 — 정규화 필수

```typescript
// BAD — 중첩 구조, 카드 하나 바꿔도 보드 전체 참조 변경
interface BadStore {
  boards: {
    id: string;
    columns: {
      id: string;
      tasks: Task[]; // 여기 하나 바뀌면 board → column → tasks 전부 새 참조
    }[];
  }[];
}

// GOOD — 정규화, 독립 업데이트
interface Store {
  boards: Record<string, Board>;
  columns: Record<string, Column>;
  tasks: Record<string, Task>;
  columnOrder: Record<string, string[]>;   // boardId → columnId[]
  taskOrder: Record<string, string[]>;     // columnId → taskId[]
}
```

### 2.4 가상화 (Virtualization)

칸반 보드에 카드가 수십~수백 개 쌓이면 DOM 노드가 폭증한다.

```typescript
// 긴 리스트가 있는 컬럼에 가상 스크롤 적용
import { useVirtualizer } from '@tanstack/react-virtual';

function VirtualizedColumn({ taskIds }: { taskIds: string[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: taskIds.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80, // 카드 높이 추정값
    overscan: 5,
  });

  return (
    <div ref={parentRef} style={{ height: '100%', overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map(vi => (
          <TaskCard key={taskIds[vi.index]} taskId={taskIds[vi.index]}
            style={{ transform: `translateY(${vi.start}px)`, position: 'absolute' }}
          />
        ))}
      </div>
    </div>
  );
}
```

**적용 기준:**
- 컬럼 내 카드 20개 이상이면 가상화 ON
- 캘린더 월간 뷰의 이벤트 목록
- Gmail 이메일 목록
- AI Planner 긴 대화 로그

---

## 3. IPC 통신 최적화

### 3.1 직렬화 비용 최소화

Electron IPC는 `structuredClone`으로 데이터를 복사한다. 큰 객체를 통째로 넘기면 병목이 된다.

```typescript
// BAD — 태스크 500개를 매번 전부 전송
ipcMain.handle('tasks:getAll', () => db.getAllTasks()); // 500개 직렬화

// GOOD — 변경분만 전송
ipcMain.handle('tasks:getChanged', (_, since: string) => {
  return db.getTasksChangedSince(since); // 마지막 동기화 이후 변경분만
});

// GOOD — 무거운 데이터는 페이지네이션
ipcMain.handle('emails:list', (_, { offset, limit }) => {
  return db.getEmails({ offset, limit }); // 한 번에 50개씩
});
```

### 3.2 배치 처리

```typescript
// BAD — 카드 30개를 개별 IPC로 생성
for (const task of tasks) {
  await window.api.tasks.create(task); // IPC 30회 왕복
}

// GOOD — 한 번에 배치
await window.api.tasks.createBatch(tasks); // IPC 1회
```

### 3.3 IPC 채널 타입 안전성

```typescript
// shared/ipc-types.ts — Main/Renderer 모두 참조
export interface IpcChannels {
  'calendar:getEvents': { args: [DateRange]; return: CalendarEvent[] };
  'calendar:createEvent': { args: [CreateEventInput]; return: CalendarEvent };
  'tasks:move': { args: [{ taskId: string; targetColumnId: string; order: number }]; return: void };
  // ...
}

// Main Process
type Handler<C extends keyof IpcChannels> =
  (event: IpcMainInvokeEvent, ...args: IpcChannels[C]['args']) => Promise<IpcChannels[C]['return']>;

// Renderer (preload에서 노출)
type Invoker<C extends keyof IpcChannels> =
  (...args: IpcChannels[C]['args']) => Promise<IpcChannels[C]['return']>;
```

---

## 4. SQLite 최적화

### 4.1 WAL 모드 필수

```typescript
// DB 초기화 시 가장 먼저 실행
db.pragma('journal_mode = WAL');      // 읽기/쓰기 동시성 향상
db.pragma('synchronous = NORMAL');    // fsync 빈도 줄여 쓰기 속도 향상 (WAL과 함께 안전)
db.pragma('cache_size = -64000');     // 64MB 캐시 (기본값 2MB는 너무 작음)
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');     // 락 대기 5초
```

### 4.2 인덱스 전략

```sql
-- 칸반 보드 핵심 쿼리 패턴에 맞춘 인덱스
CREATE INDEX idx_tasks_column_order ON tasks(column_id, "order");
CREATE INDEX idx_tasks_board ON tasks(board_id);
CREATE INDEX idx_tasks_updated ON tasks(updated_at);
CREATE INDEX idx_task_assignees_member ON task_assignees(member_id);
CREATE INDEX idx_calendar_cache_time ON calendar_events_cache(start_time, end_time);
CREATE INDEX idx_calendar_cache_account ON calendar_events_cache(account_id, calendar_id);
CREATE INDEX idx_planner_messages_session ON planner_messages(session_id, created_at);
```

### 4.3 Prepared Statement 재사용

```typescript
// BAD — 매번 prepare
function getTask(id: string) {
  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
}

// GOOD — 한 번 prepare, 계속 재사용
const statements = {
  getTask: db.prepare('SELECT * FROM tasks WHERE id = ?'),
  getColumnTasks: db.prepare('SELECT * FROM tasks WHERE column_id = ? ORDER BY "order"'),
  moveTask: db.prepare('UPDATE tasks SET column_id = ?, "order" = ?, updated_at = ? WHERE id = ?'),
} as const;

function getTask(id: string) {
  return statements.getTask.get(id);
}
```

### 4.4 트랜잭션 묶기

```typescript
// AI Planner가 태스크 20개를 한꺼번에 생성할 때
const insertMany = db.transaction((tasks: NewTask[]) => {
  const stmt = db.prepare(
    'INSERT INTO tasks (id, board_id, column_id, title, description, priority, "order", created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  for (const t of tasks) {
    stmt.run(t.id, t.boardId, t.columnId, t.title, t.description, t.priority, t.order, t.createdAt, t.updatedAt);
  }
});
insertMany(tasks); // 자동 BEGIN/COMMIT, 실패 시 자동 ROLLBACK
```

---

## 5. Google API 최적화

### 5.1 증분 동기화 (Incremental Sync)

```typescript
// BAD — 매번 전체 이벤트 목록을 가져옴
const events = await calendar.events.list({ calendarId: 'primary' });

// GOOD — syncToken으로 변경분만 가져옴
let syncToken = getSavedSyncToken();
const events = await calendar.events.list({
  calendarId: 'primary',
  syncToken,           // 이전 동기화 이후 변경분만
  maxResults: 2500,
});
saveSyncToken(events.data.nextSyncToken);
// syncToken 만료(410 Gone) 시 전체 동기화 1회 후 재개
```

### 5.2 배치 요청

```typescript
// 복수 캘린더를 동시에 동기화할 때
const results = await Promise.all(
  calendarIds.map(id =>
    calendar.events.list({ calendarId: id, syncToken: tokens[id] })
  )
);
// Google API batch endpoint 활용도 고려
```

### 5.3 로컬 캐시 우선 (Cache-First)

```
사용자가 캘린더 뷰 열기
  → 1) 로컬 SQLite 캐시에서 즉시 렌더링
  → 2) 백그라운드에서 Google API 증분 동기화
  → 3) 변경분 있으면 UI 갱신
```

이 패턴으로 오프라인 동작과 빠른 초기 렌더를 모두 확보한다.

---

## 6. LLM (Claude API) 최적화

### 6.1 스트리밍 필수

```typescript
// BAD — 전체 응답 대기 후 표시 (수 초 동안 화면 멈춤)
const response = await anthropic.messages.create({ stream: false, ... });

// GOOD — 스트리밍으로 토큰 단위 실시간 표시
const stream = anthropic.messages.stream({
  model: 'claude-sonnet-4-6',
  max_tokens: 16000,
  messages,
});

for await (const event of stream) {
  if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
    // Renderer로 실시간 전송
    mainWindow.webContents.send('planner:stream', event.delta.text);
  }
}
```

### 6.2 컨텍스트 효율화

```typescript
// BAD — 매 요청마다 전체 태스크 목록을 컨텍스트에 포함
const allTasks = db.getAllTasks(); // 500개
messages.push({ role: 'user', content: `현재 태스크: ${JSON.stringify(allTasks)}` });

// GOOD — 관련 태스크만 요약하여 포함
const summary = buildProjectSummary(boardId); // 구조화된 요약
messages.push({
  role: 'system',
  content: `프로젝트 현황:\n${summary}` // 토큰 수 1/10로 감소
});
```

### 6.3 프롬프트 캐싱 활용

```typescript
// 시스템 프롬프트를 캐싱하여 반복 호출 비용 절감
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 16000,
  system: [{
    type: 'text',
    text: PLANNER_SYSTEM_PROMPT, // 큰 시스템 프롬프트
    cache_control: { type: 'ephemeral' },
  }],
  messages,
});
```

### 6.4 구조화된 출력

```typescript
// AI가 생성한 태스크를 칸반에 바로 넣으려면 구조화된 JSON이 필수
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 16000,
  output_config: {
    format: {
      type: 'json_schema',
      schema: {
        type: 'object',
        properties: {
          phases: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                duration_weeks: { type: 'number' },
                tasks: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string' },
                      description: { type: 'string' },
                      priority: { type: 'string', enum: ['critical','high','medium','low'] },
                      estimated_hours: { type: 'number' },
                      suggested_role: { type: 'string' },
                    },
                    required: ['title','description','priority'],
                    additionalProperties: false,
                  }
                }
              },
              required: ['name','tasks'],
              additionalProperties: false,
            }
          }
        },
        required: ['phases'],
        additionalProperties: false,
      }
    }
  },
  messages,
});
```

---

## 7. 드래그 앤 드롭 (칸반) 성능

### 7.1 Optimistic Update

```typescript
// DnD 완료 시 — UI 먼저, DB/API는 나중
function onDragEnd(result: DragEndResult) {
  const { taskId, sourceCol, targetCol, newOrder } = result;

  // 1. Zustand 상태 즉시 업데이트 (UI 반영 <16ms)
  store.moveTask(taskId, targetCol, newOrder);

  // 2. DB 저장은 비동기 (IPC)
  window.api.tasks.move({ taskId, targetColumnId: targetCol, order: newOrder })
    .catch(() => {
      // 실패 시 롤백
      store.moveTask(taskId, sourceCol, originalOrder);
      toast.error('이동 실패');
    });
}
```

### 7.2 DnD 중 리렌더 최소화

```typescript
// @dnd-kit의 DragOverlay 사용 — 드래그 중인 카드는 별도 레이어
// 원래 위치의 카드는 placeholder로 대체, 다른 카드는 리렌더 안 됨
<DndContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
  <SortableContext items={taskIds}>
    {taskIds.map(id => <SortableCard key={id} taskId={id} />)}
  </SortableContext>
  <DragOverlay>
    {activeId ? <TaskCard taskId={activeId} isDragOverlay /> : null}
  </DragOverlay>
</DndContext>
```

---

## 8. 캘린더 뷰 렌더링 최적화

### 8.1 시간 범위 기반 쿼리

```typescript
// 현재 뷰에 보이는 범위만 로드
function useVisibleEvents(view: 'day' | 'week' | 'month', date: Date) {
  const range = useMemo(() => getViewRange(view, date), [view, date]);

  // SQLite에서 범위 쿼리 — 인덱스 활용
  const events = useQuery(['events', range], () =>
    window.api.calendar.getEvents(range)
  );
  return events;
}
```

### 8.2 월간 뷰 — 셀 단위 메모이제이션

```typescript
// 월간 뷰의 각 날짜 셀을 독립적으로 메모이제이션
const DayCell = memo(function DayCell({ date, events }: DayCellProps) {
  return (
    <div className="day-cell">
      <span>{date.getDate()}</span>
      {events.slice(0, 3).map(e => <EventChip key={e.id} event={e} />)}
      {events.length > 3 && <span>+{events.length - 3} more</span>}
    </div>
  );
}, (prev, next) => {
  // 날짜와 이벤트 목록이 같으면 리렌더 스킵
  return prev.date.getTime() === next.date.getTime()
    && prev.events.length === next.events.length
    && prev.events.every((e, i) => e.id === next.events[i].id);
});
```

---

## 9. 메모리 관리

### 9.1 Electron 메모리 주의점

- Electron 앱은 최소 ~100MB 기본 점유. 관리 안 하면 500MB+ 쉽게 도달
- `BrowserWindow`를 파괴하지 않고 숨기면 메모리가 해제되지 않음
- DevTools 열린 채로 두면 메모리 2배

### 9.2 실천 항목

```typescript
// 큰 데이터는 사용 후 참조 해제
let largeResponse: LLMResponse | null = await getLLMResponse();
processAndSaveTasks(largeResponse);
largeResponse = null; // GC 대상으로 만듦

// 이벤트 리스너 정리
useEffect(() => {
  const handler = (_: any, data: StreamChunk) => appendMessage(data);
  window.electron.on('planner:stream', handler);
  return () => window.electron.off('planner:stream', handler);
}, []);

// 안 보이는 탭의 데이터는 캐시에서 제거
// React Query의 gcTime, staleTime 활용
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,  // 5분
      gcTime: 10 * 60 * 1000,    // 10분 후 GC
    },
  },
});
```

---

## 10. 빌드 & 배포 최적화

### 10.1 ASAR 압축

```javascript
// electron-builder.config.js
module.exports = {
  asar: true,
  asarUnpack: [
    'node_modules/better-sqlite3/**', // 네이티브 모듈은 unpack
  ],
};
```

### 10.2 네이티브 모듈 관리

`better-sqlite3`는 네이티브(C++) 모듈이므로:
- `electron-rebuild`로 Electron 버전에 맞게 빌드
- CI에서 플랫폼별 빌드 필수
- `postinstall` 스크립트에 rebuild 포함

### 10.3 코드 분할 (Next.js)

```typescript
// 무거운 뷰는 dynamic import
const KanbanBoard = dynamic(() => import('@/components/kanban/Board'), {
  loading: () => <BoardSkeleton />,
});
const CalendarView = dynamic(() => import('@/components/calendar/CalendarView'), {
  loading: () => <CalendarSkeleton />,
});
const AIPlanner = dynamic(() => import('@/components/planner/AIPlanner'), {
  loading: () => <PlannerSkeleton />,
});
```

---

## 체크리스트 — 코드 리뷰 시 확인

PR/코드 작성 시 아래 항목을 체크한다:

- [ ] Main Process에 무거운 동기 작업이 없는가?
- [ ] IPC로 대량 데이터를 보내고 있지 않은가? (변경분/페이지네이션 사용)
- [ ] React 컴포넌트가 필요 이상으로 리렌더되지 않는가? (React DevTools Profiler로 확인)
- [ ] Zustand selector가 정확한 범위만 구독하는가?
- [ ] SQLite 쿼리가 인덱스를 타는가? (`EXPLAIN QUERY PLAN`으로 확인)
- [ ] LLM 호출이 스트리밍을 사용하는가?
- [ ] 큰 리스트에 가상화가 적용되어 있는가?
- [ ] `useEffect` cleanup이 빠져있지 않은가?
- [ ] 네이티브 모듈(`better-sqlite3`)이 올바르게 rebuild 되는가?
