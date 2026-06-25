# Plan 3: Calendar — Google OAuth + 캘린더 뷰 + 일정 CRUD + 동기화

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Google OAuth 인증 후 Google Calendar의 일정을 일/주/월 뷰로 조회하고, 일정을 생성/수정/삭제하며, syncToken 기반 증분 동기화로 로컬 캐시를 유지한다.

**Architecture:** Main process에서 googleapis 라이브러리로 Google Calendar API v3를 호출하고, 결과를 SQLite 로컬 캐시에 저장한다. Renderer는 로컬 캐시를 IPC로 읽어 즉시 렌더링하고, 백그라운드에서 동기화를 트리거한다. OAuth 토큰은 Electron safeStorage로 암호화 저장한다.

**Tech Stack:** googleapis (npm), Electron safeStorage, 기존 SQLite/IPC/Zustand 인프라

**Dependencies:** Plan 1 완료 필수, Plan 2 완료 권장 (크로스 연동 #1: 마감일→캘린더)

---

## File Structure (Plan 3에서 생성/수정하는 파일)

```
main/
├── google/
│   ├── auth.ts                    # OAuth 2.0 인증 플로우 (BrowserWindow 팝업)
│   ├── calendar-api.ts            # Google Calendar API 래퍼
│   └── calendar-sync.ts           # syncToken 기반 증분 동기화 엔진
├── ipc/
│   ├── channels.ts                # (수정) 캘린더 IPC 채널 추가
│   └── register.ts                # (수정) 캘린더 핸들러 추가
└── db/
    └── statements.ts              # (수정) 캘린더 prepared statements 추가
renderer/
├── pages/
│   └── calendar.tsx               # 캘린더 페이지
├── components/
│   └── calendar/
│       ├── CalendarView.tsx        # 뷰 전환 컨테이너 (일/주/월)
│       ├── MonthView.tsx           # 월간 뷰
│       ├── WeekView.tsx            # 주간 뷰
│       ├── DayView.tsx             # 일간 뷰
│       ├── EventChip.tsx           # 이벤트 칩 (재사용)
│       ├── EventDetail.tsx         # 이벤트 상세/편집 사이드 패널
│       └── CreateEventDialog.tsx   # 일정 생성 다이얼로그
├── hooks/
│   └── use-calendar.ts            # 캘린더 데이터 + 동기화 hook
└── stores/
    └── app-store.ts               # (수정) 캘린더 상태 추가
shared/
└── types.ts                       # (수정) CalendarEvent 타입 추가
tests/
└── main/
    └── calendar-sync.test.ts      # 동기화 로직 테스트
```

---

### Task 1: googleapis 설치 + CalendarEvent 타입 + IPC 채널

**Files:**
- Modify: `shared/types.ts` — CalendarEvent 타입 추가
- Modify: `main/ipc/channels.ts` — 캘린더 채널 추가
- Modify: `main/db/statements.ts` — 캘린더 prepared statements 추가

- [ ] **Step 1: googleapis 설치**

```bash
cd /c/Users/twoja/project_tpc/PM_supporter
pnpm add googleapis
```

- [ ] **Step 2: CalendarEvent 타입 추가**

`shared/types.ts`에 추가:

```typescript
/** Google Calendar 이벤트 (로컬 캐시 형태) */
export interface CalendarEvent {
  id: string;              // Google event ID
  accountId: string;
  calendarId: string;
  summary: string;
  description: string;
  startTime: string;       // ISO 8601
  endTime: string;         // ISO 8601
  location: string;
  attendees: string;       // JSON array
  recurrence: string;      // JSON array
  rawData: string;         // 원본 Google API 응답 JSON
  syncedAt: string;
}

/** Google 계정 */
export interface GoogleAccount {
  id: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiry: string;
  calendarsSynced: string | null;  // JSON array of calendar IDs
}

/** 캘린더 뷰 타입 */
export type CalendarViewType = 'day' | 'week' | 'month';

/** 캘린더 뷰 날짜 범위 */
export interface DateRange {
  start: string;  // ISO 8601
  end: string;    // ISO 8601
}
```

- [ ] **Step 3: IPC 채널 추가**

`main/ipc/channels.ts`에 추가 (기존 채널 유지, import에 CalendarEvent, GoogleAccount, DateRange 추가):

```typescript
  // === Google Auth ===
  'google:startAuth': { args: []; return: GoogleAccount };
  'google:getAccounts': { args: []; return: GoogleAccount[] };
  'google:removeAccount': { args: [string]; return: void };

  // === Calendar ===
  'calendar:getEvents': { args: [DateRange]; return: CalendarEvent[] };
  'calendar:createEvent': { args: [{ calendarId: string; summary: string; startTime: string; endTime: string; description?: string; location?: string }]; return: CalendarEvent };
  'calendar:updateEvent': { args: [string, Partial<{ summary: string; startTime: string; endTime: string; description: string; location: string }>]; return: CalendarEvent };
  'calendar:deleteEvent': { args: [string]; return: void };
  'calendar:sync': { args: []; return: { added: number; updated: number; deleted: number } };
  'calendar:getSyncStatus': { args: []; return: { lastSynced: string | null; status: 'idle' | 'syncing' | 'error' } };
```

- [ ] **Step 4: 캘린더 prepared statements 추가**

`main/db/statements.ts`의 `createStatements` 반환 객체에 추가:

```typescript
    // Calendar cache
    getEventsByRange: db.prepare(
      'SELECT * FROM calendar_events_cache WHERE start_time < ? AND end_time > ? ORDER BY start_time'
    ),
    getEvent: db.prepare('SELECT * FROM calendar_events_cache WHERE id = ?'),
    upsertEvent: db.prepare(
      `INSERT INTO calendar_events_cache (id, account_id, calendar_id, summary, description, start_time, end_time, location, attendees, recurrence, raw_data, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         summary=excluded.summary, description=excluded.description,
         start_time=excluded.start_time, end_time=excluded.end_time,
         location=excluded.location, attendees=excluded.attendees,
         recurrence=excluded.recurrence, raw_data=excluded.raw_data,
         synced_at=excluded.synced_at`
    ),
    deleteEvent: db.prepare('DELETE FROM calendar_events_cache WHERE id = ?'),
    deleteEventsByAccount: db.prepare('DELETE FROM calendar_events_cache WHERE account_id = ?'),

    // Google accounts
    getGoogleAccount: db.prepare('SELECT * FROM google_accounts WHERE id = ?'),
    listGoogleAccounts: db.prepare('SELECT * FROM google_accounts'),
    upsertGoogleAccount: db.prepare(
      `INSERT INTO google_accounts (id, email, access_token, refresh_token, token_expiry, calendars_synced)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         access_token=excluded.access_token, refresh_token=excluded.refresh_token,
         token_expiry=excluded.token_expiry, calendars_synced=excluded.calendars_synced`
    ),
    deleteGoogleAccount: db.prepare('DELETE FROM google_accounts WHERE id = ?'),
```

- [ ] **Step 5: 커밋**

```bash
git add shared/types.ts main/ipc/channels.ts main/db/statements.ts package.json pnpm-lock.yaml
git commit -m "feat: add CalendarEvent types, IPC channels, and calendar DB statements"
```

---

### Task 2: Google OAuth 인증

**Files:**
- Create: `main/google/auth.ts`

- [ ] **Step 1: OAuth 인증 모듈**

Google OAuth 2.0 인증을 Electron BrowserWindow 팝업으로 구현한다.

```typescript
// main/google/auth.ts
import { BrowserWindow } from 'electron';
import { google } from 'googleapis';
import type Database from 'better-sqlite3';
import { v4 as uuid } from 'uuid';
import type { Statements } from '../db/statements';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
];

export class GoogleAuth {
  private oauth2Client;

  constructor(
    private db: Database.Database,
    private stmts: Statements,
  ) {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'http://localhost:3333/callback'
    );
  }

  async startAuth(): Promise<{ id: string; email: string }> {
    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
    });

    const code = await this.openAuthWindow(authUrl);
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);

    // Get user email
    const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
    const { data } = await oauth2.userinfo.get();
    const email = data.email!;

    // Save to DB
    const id = uuid();
    const expiry = tokens.expiry_date
      ? new Date(tokens.expiry_date).toISOString()
      : new Date(Date.now() + 3600 * 1000).toISOString();

    this.stmts.upsertGoogleAccount.run(
      id, email,
      tokens.access_token ?? '',
      tokens.refresh_token ?? '',
      expiry,
      JSON.stringify(['primary'])
    );

    return { id, email };
  }

  private openAuthWindow(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const win = new BrowserWindow({
        width: 500,
        height: 700,
        webPreferences: { nodeIntegration: false, contextIsolation: true },
      });

      win.loadURL(url);

      win.webContents.on('will-redirect', (_event, redirectUrl) => {
        const parsed = new URL(redirectUrl);
        const code = parsed.searchParams.get('code');
        if (code) {
          resolve(code);
          win.close();
        }
        const error = parsed.searchParams.get('error');
        if (error) {
          reject(new Error(`OAuth error: ${error}`));
          win.close();
        }
      });

      win.on('closed', () => {
        reject(new Error('Auth window closed'));
      });
    });
  }

  getClient(accountId: string) {
    const account = this.stmts.getGoogleAccount.get(accountId) as any;
    if (!account) throw new Error(`Account not found: ${accountId}`);

    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'http://localhost:3333/callback'
    );

    client.setCredentials({
      access_token: account.access_token,
      refresh_token: account.refresh_token,
      expiry_date: new Date(account.token_expiry).getTime(),
    });

    // Auto-refresh: save new tokens
    client.on('tokens', (tokens) => {
      const expiry = tokens.expiry_date
        ? new Date(tokens.expiry_date).toISOString()
        : new Date(Date.now() + 3600 * 1000).toISOString();

      this.db.prepare(
        'UPDATE google_accounts SET access_token = ?, token_expiry = ? WHERE id = ?'
      ).run(tokens.access_token ?? account.access_token, expiry, accountId);
    });

    return client;
  }

  getAccounts() {
    return this.stmts.listGoogleAccounts.all();
  }

  removeAccount(accountId: string) {
    this.stmts.deleteEventsByAccount.run(accountId);
    this.stmts.deleteGoogleAccount.run(accountId);
  }
}
```

- [ ] **Step 2: 커밋**

```bash
git add main/google/auth.ts
git commit -m "feat: Google OAuth 2.0 authentication with Electron popup"
```

---

### Task 3: Calendar API 래퍼 + 증분 동기화

**Files:**
- Create: `main/google/calendar-api.ts`
- Create: `main/google/calendar-sync.ts`
- Test: `tests/main/calendar-sync.test.ts`

- [ ] **Step 1: Calendar API 래퍼**

```typescript
// main/google/calendar-api.ts
import { google, type calendar_v3 } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';

export class CalendarAPI {
  private calendar: calendar_v3.Calendar;

  constructor(auth: OAuth2Client) {
    this.calendar = google.calendar({ version: 'v3', auth });
  }

  async listEvents(calendarId: string, timeMin: string, timeMax: string, syncToken?: string) {
    const params: calendar_v3.Params$Resource$Events$List = {
      calendarId,
      maxResults: 2500,
      singleEvents: true,
      orderBy: 'startTime',
    };

    if (syncToken) {
      params.syncToken = syncToken;
    } else {
      params.timeMin = timeMin;
      params.timeMax = timeMax;
    }

    try {
      const res = await this.calendar.events.list(params);
      return {
        events: res.data.items ?? [],
        nextSyncToken: res.data.nextSyncToken ?? null,
        nextPageToken: res.data.nextPageToken ?? null,
      };
    } catch (err: any) {
      if (err.code === 410) {
        // syncToken expired — full sync needed
        return { events: [], nextSyncToken: null, nextPageToken: null, fullSyncRequired: true };
      }
      throw err;
    }
  }

  async createEvent(calendarId: string, event: {
    summary: string;
    start: { dateTime: string; timeZone?: string };
    end: { dateTime: string; timeZone?: string };
    description?: string;
    location?: string;
  }) {
    const res = await this.calendar.events.insert({
      calendarId,
      requestBody: event,
    });
    return res.data;
  }

  async updateEvent(calendarId: string, eventId: string, event: Partial<{
    summary: string;
    start: { dateTime: string; timeZone?: string };
    end: { dateTime: string; timeZone?: string };
    description: string;
    location: string;
  }>) {
    const res = await this.calendar.events.patch({
      calendarId,
      eventId,
      requestBody: event,
    });
    return res.data;
  }

  async deleteEvent(calendarId: string, eventId: string) {
    await this.calendar.events.delete({ calendarId, eventId });
  }
}
```

- [ ] **Step 2: 증분 동기화 엔진**

```typescript
// main/google/calendar-sync.ts
import type Database from 'better-sqlite3';
import type { Statements } from '../db/statements';
import type { EventBus } from '../events/bus';
import { GoogleAuth } from './auth';
import { CalendarAPI } from './calendar-api';

interface SyncResult {
  added: number;
  updated: number;
  deleted: number;
}

export class CalendarSync {
  private syncTokens = new Map<string, string>(); // calendarId → syncToken
  private status: 'idle' | 'syncing' | 'error' = 'idle';
  private lastSynced: string | null = null;

  constructor(
    private db: Database.Database,
    private stmts: Statements,
    private auth: GoogleAuth,
    private bus: EventBus,
  ) {}

  getStatus() {
    return { lastSynced: this.lastSynced, status: this.status };
  }

  async sync(): Promise<SyncResult> {
    this.status = 'syncing';
    this.bus.emit('sync:status', { status: 'syncing' });

    const result: SyncResult = { added: 0, updated: 0, deleted: 0 };

    try {
      const accounts = this.auth.getAccounts() as any[];

      for (const account of accounts) {
        const client = this.auth.getClient(account.id);
        const api = new CalendarAPI(client);
        const calendars = JSON.parse(account.calendars_synced || '["primary"]') as string[];

        for (const calendarId of calendars) {
          const syncToken = this.syncTokens.get(`${account.id}:${calendarId}`);

          const now = new Date();
          const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString();
          const threeMonthsAhead = new Date(now.getFullYear(), now.getMonth() + 3, 1).toISOString();

          const res = await api.listEvents(
            calendarId,
            threeMonthsAgo,
            threeMonthsAhead,
            syncToken
          );

          if ((res as any).fullSyncRequired) {
            // syncToken expired — do full sync
            this.syncTokens.delete(`${account.id}:${calendarId}`);
            const fullRes = await api.listEvents(calendarId, threeMonthsAgo, threeMonthsAhead);
            this.processEvents(account.id, calendarId, fullRes.events, result);
            if (fullRes.nextSyncToken) {
              this.syncTokens.set(`${account.id}:${calendarId}`, fullRes.nextSyncToken);
            }
          } else {
            this.processEvents(account.id, calendarId, res.events, result);
            if (res.nextSyncToken) {
              this.syncTokens.set(`${account.id}:${calendarId}`, res.nextSyncToken);
            }
          }
        }
      }

      this.status = 'idle';
      this.lastSynced = new Date().toISOString();
      this.bus.emit('sync:status', { status: 'synced' });
    } catch (err) {
      this.status = 'error';
      this.bus.emit('sync:status', { status: 'error' });
      throw err;
    }

    return result;
  }

  private processEvents(
    accountId: string,
    calendarId: string,
    events: any[],
    result: SyncResult
  ) {
    const now = new Date().toISOString();
    const txn = this.db.transaction(() => {
      for (const event of events) {
        if (event.status === 'cancelled') {
          const existing = this.stmts.getEvent.get(event.id);
          if (existing) {
            this.stmts.deleteEvent.run(event.id);
            result.deleted++;
          }
          continue;
        }

        const startTime = event.start?.dateTime ?? event.start?.date ?? '';
        const endTime = event.end?.dateTime ?? event.end?.date ?? '';

        const existing = this.stmts.getEvent.get(event.id);

        this.stmts.upsertEvent.run(
          event.id,
          accountId,
          calendarId,
          event.summary ?? '',
          event.description ?? '',
          startTime,
          endTime,
          event.location ?? '',
          JSON.stringify(event.attendees ?? []),
          JSON.stringify(event.recurrence ?? []),
          JSON.stringify(event),
          now,
        );

        if (existing) {
          result.updated++;
        } else {
          result.added++;
        }

        this.bus.emit('calendar:changed', {
          eventId: event.id,
          type: existing ? 'updated' : 'created',
        });
      }
    });
    txn();
  }

  getEventsByRange(start: string, end: string) {
    // SQLite query: events where start_time < range_end AND end_time > range_start
    return this.stmts.getEventsByRange.all(end, start);
  }
}
```

- [ ] **Step 3: 동기화 테스트 (로컬 캐시 로직)**

```typescript
// tests/main/calendar-sync.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { createConnection } from '../../main/db/connection';
import { applySchema } from '../../main/db/schema';
import { createStatements } from '../../main/db/statements';

describe('Calendar Cache', () => {
  let db: Database.Database;
  let stmts: ReturnType<typeof createStatements>;

  beforeEach(() => {
    db = createConnection(':memory:');
    applySchema(db);
    stmts = createStatements(db);
  });

  it('should upsert and retrieve calendar events', () => {
    stmts.upsertGoogleAccount.run('acc1', 'test@gmail.com', 'token', 'refresh', '2026-12-31T00:00:00Z', '["primary"]');

    stmts.upsertEvent.run(
      'evt1', 'acc1', 'primary', 'Team Meeting', 'Weekly sync',
      '2026-06-25T09:00:00Z', '2026-06-25T10:00:00Z',
      'Room A', '[]', '[]', '{}', '2026-06-25T00:00:00Z'
    );

    const event = stmts.getEvent.get('evt1') as any;
    expect(event.summary).toBe('Team Meeting');
    expect(event.account_id).toBe('acc1');
  });

  it('should query events by date range', () => {
    stmts.upsertGoogleAccount.run('acc1', 'test@gmail.com', 'token', 'refresh', '2026-12-31T00:00:00Z', '["primary"]');

    // Event on June 25
    stmts.upsertEvent.run('evt1', 'acc1', 'primary', 'Event 1', '', '2026-06-25T09:00:00Z', '2026-06-25T10:00:00Z', '', '[]', '[]', '{}', '2026-06-25T00:00:00Z');
    // Event on June 26
    stmts.upsertEvent.run('evt2', 'acc1', 'primary', 'Event 2', '', '2026-06-26T14:00:00Z', '2026-06-26T15:00:00Z', '', '[]', '[]', '{}', '2026-06-25T00:00:00Z');
    // Event on July 1 (outside range)
    stmts.upsertEvent.run('evt3', 'acc1', 'primary', 'Event 3', '', '2026-07-01T09:00:00Z', '2026-07-01T10:00:00Z', '', '[]', '[]', '{}', '2026-06-25T00:00:00Z');

    // Query June 25-26
    const events = stmts.getEventsByRange.all('2026-06-27T00:00:00Z', '2026-06-25T00:00:00Z') as any[];
    expect(events).toHaveLength(2);
    expect(events[0].summary).toBe('Event 1');
    expect(events[1].summary).toBe('Event 2');
  });

  it('should upsert (update existing event)', () => {
    stmts.upsertGoogleAccount.run('acc1', 'test@gmail.com', 'token', 'refresh', '2026-12-31T00:00:00Z', '["primary"]');

    stmts.upsertEvent.run('evt1', 'acc1', 'primary', 'Original', '', '2026-06-25T09:00:00Z', '2026-06-25T10:00:00Z', '', '[]', '[]', '{}', '2026-06-25T00:00:00Z');
    stmts.upsertEvent.run('evt1', 'acc1', 'primary', 'Updated', '', '2026-06-25T09:00:00Z', '2026-06-25T10:00:00Z', '', '[]', '[]', '{}', '2026-06-25T01:00:00Z');

    const event = stmts.getEvent.get('evt1') as any;
    expect(event.summary).toBe('Updated');
  });

  it('should delete event', () => {
    stmts.upsertGoogleAccount.run('acc1', 'test@gmail.com', 'token', 'refresh', '2026-12-31T00:00:00Z', '["primary"]');
    stmts.upsertEvent.run('evt1', 'acc1', 'primary', 'To Delete', '', '2026-06-25T09:00:00Z', '2026-06-25T10:00:00Z', '', '[]', '[]', '{}', '2026-06-25T00:00:00Z');

    stmts.deleteEvent.run('evt1');
    const event = stmts.getEvent.get('evt1');
    expect(event).toBeUndefined();
  });
});
```

- [ ] **Step 4: 테스트 실행**

```bash
pnpm vitest run tests/main/calendar-sync.test.ts
```

Expected: 4 tests PASS

- [ ] **Step 5: 커밋**

```bash
git add main/google/ tests/main/calendar-sync.test.ts
git commit -m "feat: Google Calendar API wrapper, sync engine, and cache tests"
```

---

### Task 4: 캘린더 IPC 핸들러 등록

**Files:**
- Modify: `main/ipc/register.ts` — 캘린더 핸들러 추가
- Modify: `main/main.ts` — GoogleAuth, CalendarSync 초기화 추가

- [ ] **Step 1: IPC 핸들러 추가**

`main/ipc/register.ts`의 `RegisterDeps` 인터페이스와 `registerIpcHandlers` 함수에 추가:

```typescript
// RegisterDeps에 추가:
import type { GoogleAuth } from '../google/auth';
import type { CalendarSync } from '../google/calendar-sync';

interface RegisterDeps {
  // ... 기존 필드 유지
  googleAuth: GoogleAuth;
  calendarSync: CalendarSync;
}

// registerIpcHandlers 함수 내에 추가:

  // === Google Auth ===
  handle('google:startAuth', async () => {
    const result = await deps.googleAuth.startAuth();
    return deps.stmts.getGoogleAccount.get(result.id);
  });
  handle('google:getAccounts', () => deps.googleAuth.getAccounts());
  handle('google:removeAccount', (id) => deps.googleAuth.removeAccount(id));

  // === Calendar ===
  handle('calendar:getEvents', (range) => {
    return deps.calendarSync.getEventsByRange(range.start, range.end);
  });
  handle('calendar:sync', async () => {
    return deps.calendarSync.sync();
  });
  handle('calendar:getSyncStatus', () => {
    return deps.calendarSync.getStatus();
  });
  handle('calendar:createEvent', async (data) => {
    const accounts = deps.googleAuth.getAccounts() as any[];
    if (accounts.length === 0) throw new Error('No Google account connected');
    const client = deps.googleAuth.getClient(accounts[0].id);
    const api = new (await import('../google/calendar-api')).CalendarAPI(client);
    const event = await api.createEvent(data.calendarId || 'primary', {
      summary: data.summary,
      start: { dateTime: data.startTime },
      end: { dateTime: data.endTime },
      description: data.description,
      location: data.location,
    });
    // Sync to get the event in cache
    await deps.calendarSync.sync();
    return deps.stmts.getEvent.get(event.id!);
  });
  handle('calendar:updateEvent', async (eventId, changes) => {
    const cached = deps.stmts.getEvent.get(eventId) as any;
    if (!cached) throw new Error(`Event not found: ${eventId}`);
    const accounts = deps.googleAuth.getAccounts() as any[];
    if (accounts.length === 0) throw new Error('No Google account connected');
    const client = deps.googleAuth.getClient(cached.account_id);
    const api = new (await import('../google/calendar-api')).CalendarAPI(client);
    const patch: any = {};
    if (changes.summary !== undefined) patch.summary = changes.summary;
    if (changes.startTime !== undefined) patch.start = { dateTime: changes.startTime };
    if (changes.endTime !== undefined) patch.end = { dateTime: changes.endTime };
    if (changes.description !== undefined) patch.description = changes.description;
    if (changes.location !== undefined) patch.location = changes.location;
    await api.updateEvent(cached.calendar_id, eventId, patch);
    await deps.calendarSync.sync();
    return deps.stmts.getEvent.get(eventId);
  });
  handle('calendar:deleteEvent', async (eventId) => {
    const cached = deps.stmts.getEvent.get(eventId) as any;
    if (!cached) throw new Error(`Event not found: ${eventId}`);
    const accounts = deps.googleAuth.getAccounts() as any[];
    if (accounts.length === 0) throw new Error('No Google account connected');
    const client = deps.googleAuth.getClient(cached.account_id);
    const api = new (await import('../google/calendar-api')).CalendarAPI(client);
    await api.deleteEvent(cached.calendar_id, eventId);
    deps.stmts.deleteEvent.run(eventId);
    deps.bus.emit('calendar:changed', { eventId, type: 'deleted' });
  });
```

- [ ] **Step 2: main.ts에 GoogleAuth, CalendarSync 초기화 추가**

`main/main.ts`에서 DB 초기화 직후에:

```typescript
const { GoogleAuth } = await import('./google/auth');
const { CalendarSync } = await import('./google/calendar-sync');
const googleAuth = new GoogleAuth(db, stmts);
const calendarSync = new CalendarSync(db, stmts, googleAuth, bus);

registerIpcHandlers({ db, stmts, trash, bus, googleAuth, calendarSync });

// 앱 시작 후 백그라운드 동기화
calendarSync.sync().catch(console.error);
```

- [ ] **Step 3: 커밋**

```bash
git add main/ipc/register.ts main/main.ts
git commit -m "feat: calendar IPC handlers and main process initialization"
```

---

### Task 5: 캘린더 UI — 월/주/일 뷰 + 이벤트 칩

**Files:**
- Create: `renderer/hooks/use-calendar.ts`
- Create: `renderer/components/calendar/CalendarView.tsx`
- Create: `renderer/components/calendar/MonthView.tsx`
- Create: `renderer/components/calendar/WeekView.tsx`
- Create: `renderer/components/calendar/DayView.tsx`
- Create: `renderer/components/calendar/EventChip.tsx`
- Create: `renderer/pages/calendar.tsx`
- Modify: `renderer/stores/app-store.ts` — 캘린더 상태 추가

- [ ] **Step 1: Zustand 캘린더 상태 추가**

`renderer/stores/app-store.ts`에 추가:

```typescript
// 새 필드
calendarEvents: Record<string, CalendarEvent>;  // eventId → event
calendarView: CalendarViewType;
calendarDate: string;  // 현재 포커스 날짜 ISO string
googleConnected: boolean;

// 새 액션
setCalendarEvents: (events: CalendarEvent[]) => void;
setCalendarView: (view: CalendarViewType) => void;
setCalendarDate: (date: string) => void;
setGoogleConnected: (connected: boolean) => void;
```

- [ ] **Step 2: use-calendar hook**

```typescript
// renderer/hooks/use-calendar.ts
import { useEffect, useMemo, useCallback } from 'react';
import { useAppStore } from '../stores/app-store';
import { ipc } from '../lib/ipc-client';
import type { CalendarViewType } from '../../shared/types';

function getViewRange(view: CalendarViewType, dateStr: string) {
  const date = new Date(dateStr);
  let start: Date, end: Date;

  switch (view) {
    case 'day':
      start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      break;
    case 'week':
      const dayOfWeek = date.getDay();
      start = new Date(date.getFullYear(), date.getMonth(), date.getDate() - dayOfWeek);
      end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      start = new Date(date.getFullYear(), date.getMonth(), 1);
      end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
      break;
  }

  return { start: start.toISOString(), end: end.toISOString() };
}

export function useCalendar() {
  const events = useAppStore((s) => s.calendarEvents);
  const view = useAppStore((s) => s.calendarView);
  const dateStr = useAppStore((s) => s.calendarDate);
  const setCalendarEvents = useAppStore((s) => s.setCalendarEvents);
  const setCalendarView = useAppStore((s) => s.setCalendarView);
  const setCalendarDate = useAppStore((s) => s.setCalendarDate);
  const googleConnected = useAppStore((s) => s.googleConnected);
  const setGoogleConnected = useAppStore((s) => s.setGoogleConnected);

  const range = useMemo(() => getViewRange(view, dateStr), [view, dateStr]);

  useEffect(() => {
    ipc['calendar:getEvents'](range).then(setCalendarEvents);
  }, [range, setCalendarEvents]);

  useEffect(() => {
    ipc['google:getAccounts']().then((accounts) => {
      setGoogleConnected(accounts.length > 0);
    });
  }, [setGoogleConnected]);

  const eventList = useMemo(() => Object.values(events), [events]);

  const navigate = useCallback((direction: -1 | 0 | 1) => {
    if (direction === 0) {
      setCalendarDate(new Date().toISOString());
      return;
    }
    const current = new Date(dateStr);
    switch (view) {
      case 'day': current.setDate(current.getDate() + direction); break;
      case 'week': current.setDate(current.getDate() + 7 * direction); break;
      case 'month': current.setMonth(current.getMonth() + direction); break;
    }
    setCalendarDate(current.toISOString());
  }, [dateStr, view, setCalendarDate]);

  const connectGoogle = async () => {
    await ipc['google:startAuth']();
    setGoogleConnected(true);
    await ipc['calendar:sync']();
    const evts = await ipc['calendar:getEvents'](range);
    setCalendarEvents(evts);
  };

  const syncNow = async () => {
    await ipc['calendar:sync']();
    const evts = await ipc['calendar:getEvents'](range);
    setCalendarEvents(evts);
  };

  return {
    events: eventList, view, dateStr, range,
    setView: setCalendarView, navigate, connectGoogle, syncNow,
    googleConnected,
  };
}
```

- [ ] **Step 3: EventChip 컴포넌트**

```tsx
// renderer/components/calendar/EventChip.tsx
import { memo } from 'react';

interface Props {
  summary: string;
  startTime: string;
  onClick?: () => void;
}

export const EventChip = memo(function EventChip({ summary, startTime, onClick }: Props) {
  const time = new Date(startTime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

  return (
    <button
      onClick={onClick}
      className="w-full text-left text-xs px-2 py-1 rounded bg-accent/15 text-accent hover:bg-accent/25 transition-colors truncate"
    >
      <span className="font-medium">{time}</span> {summary}
    </button>
  );
});
```

- [ ] **Step 4: MonthView 컴포넌트**

```tsx
// renderer/components/calendar/MonthView.tsx
import { memo, useMemo } from 'react';
import { EventChip } from './EventChip';
import type { CalendarEvent } from '../../../shared/types';

interface Props {
  dateStr: string;
  events: CalendarEvent[];
  onSelectEvent: (id: string) => void;
}

export const MonthView = memo(function MonthView({ dateStr, events, onSelectEvent }: Props) {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = date.getMonth();

  const grid = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: { day: number; isCurrentMonth: boolean; date: Date }[] = [];

    // Previous month padding
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDay - 1; i >= 0; i--) {
      cells.push({ day: prevMonthDays - i, isCurrentMonth: false, date: new Date(year, month - 1, prevMonthDays - i) });
    }
    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, isCurrentMonth: true, date: new Date(year, month, d) });
    }
    // Next month padding
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
      cells.push({ day: d, isCurrentMonth: false, date: new Date(year, month + 1, d) });
    }

    return cells;
  }, [year, month]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const key = new Date(event.startTime).toISOString().split('T')[0];
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(event);
    }
    return map;
  }, [events]);

  const today = new Date().toISOString().split('T')[0];
  const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <div className="h-full flex flex-col">
      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 border-b border-border">
        {weekDays.map((d) => (
          <div key={d} className="py-2 text-center text-xs font-medium text-text-secondary">{d}</div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7 flex-1">
        {grid.map((cell, i) => {
          const dateKey = cell.date.toISOString().split('T')[0];
          const dayEvents = eventsByDate.get(dateKey) ?? [];
          const isToday = dateKey === today;

          return (
            <div
              key={i}
              className={`border-b border-r border-border p-1 min-h-[80px] ${
                cell.isCurrentMonth ? '' : 'opacity-40'
              }`}
            >
              <span className={`text-xs inline-flex w-6 h-6 items-center justify-center rounded-full ${
                isToday ? 'bg-accent text-surface-raised font-bold' : 'text-text-secondary'
              }`}>
                {cell.day}
              </span>
              <div className="space-y-0.5 mt-1">
                {dayEvents.slice(0, 3).map((evt) => (
                  <EventChip
                    key={evt.id}
                    summary={evt.summary}
                    startTime={evt.startTime}
                    onClick={() => onSelectEvent(evt.id)}
                  />
                ))}
                {dayEvents.length > 3 && (
                  <span className="text-xs text-text-secondary px-2">+{dayEvents.length - 3}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
```

- [ ] **Step 5: WeekView 컴포넌트**

```tsx
// renderer/components/calendar/WeekView.tsx
import { memo, useMemo } from 'react';
import { EventChip } from './EventChip';
import type { CalendarEvent } from '../../../shared/types';

interface Props {
  dateStr: string;
  events: CalendarEvent[];
  onSelectEvent: (id: string) => void;
}

export const WeekView = memo(function WeekView({ dateStr, events, onSelectEvent }: Props) {
  const date = new Date(dateStr);
  const dayOfWeek = date.getDay();
  const weekStart = new Date(date.getFullYear(), date.getMonth(), date.getDate() - dayOfWeek);

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart.getTime() + i * 24 * 60 * 60 * 1000);
      return d;
    });
  }, [weekStart.getTime()]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const key = new Date(event.startTime).toISOString().split('T')[0];
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(event);
    }
    return map;
  }, [events]);

  const today = new Date().toISOString().split('T')[0];
  const weekDayNames = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <div className="grid grid-cols-7 h-full">
      {days.map((d, i) => {
        const dateKey = d.toISOString().split('T')[0];
        const dayEvents = eventsByDate.get(dateKey) ?? [];
        const isToday = dateKey === today;

        return (
          <div key={i} className="border-r border-border flex flex-col">
            <div className={`text-center py-3 border-b border-border ${isToday ? 'bg-accent/10' : ''}`}>
              <div className="text-xs text-text-secondary">{weekDayNames[i]}</div>
              <div className={`text-lg font-semibold ${isToday ? 'text-accent' : 'text-text-primary'}`}>
                {d.getDate()}
              </div>
            </div>
            <div className="flex-1 overflow-auto p-2 space-y-1">
              {dayEvents.map((evt) => (
                <EventChip
                  key={evt.id}
                  summary={evt.summary}
                  startTime={evt.startTime}
                  onClick={() => onSelectEvent(evt.id)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
});
```

- [ ] **Step 6: DayView 컴포넌트**

```tsx
// renderer/components/calendar/DayView.tsx
import { memo, useMemo } from 'react';
import type { CalendarEvent } from '../../../shared/types';

interface Props {
  dateStr: string;
  events: CalendarEvent[];
  onSelectEvent: (id: string) => void;
}

export const DayView = memo(function DayView({ dateStr, events, onSelectEvent }: Props) {
  const date = new Date(dateStr);
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const dayKey = date.toISOString().split('T')[0];
  const dayEvents = useMemo(() =>
    events.filter(e => new Date(e.startTime).toISOString().split('T')[0] === dayKey),
    [events, dayKey]
  );

  return (
    <div className="h-full overflow-auto">
      <div className="text-center py-4 border-b border-border">
        <div className="text-lg font-semibold text-text-primary">
          {date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
        </div>
      </div>
      <div className="relative">
        {hours.map((hour) => {
          const hourEvents = dayEvents.filter(e => new Date(e.startTime).getHours() === hour);
          return (
            <div key={hour} className="flex border-b border-border min-h-[60px]">
              <div className="w-16 text-right pr-3 py-2 text-xs text-text-secondary shrink-0">
                {hour.toString().padStart(2, '0')}:00
              </div>
              <div className="flex-1 py-1 px-2 space-y-1">
                {hourEvents.map((evt) => (
                  <button
                    key={evt.id}
                    onClick={() => onSelectEvent(evt.id)}
                    className="w-full text-left text-sm px-3 py-2 rounded bg-accent/15 text-accent hover:bg-accent/25 transition-colors"
                  >
                    <span className="font-medium">
                      {new Date(evt.startTime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {' '}{evt.summary}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
```

- [ ] **Step 7: CalendarView 컨테이너**

```tsx
// renderer/components/calendar/CalendarView.tsx
import { useState, useCallback } from 'react';
import { useCalendar } from '../../hooks/use-calendar';
import { MonthView } from './MonthView';
import { WeekView } from './WeekView';
import { DayView } from './DayView';
import type { CalendarViewType } from '../../../shared/types';

export function CalendarView() {
  const { events, view, dateStr, setView, navigate, googleConnected, connectGoogle, syncNow } = useCalendar();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const viewLabel = () => {
    const d = new Date(dateStr);
    switch (view) {
      case 'month': return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' });
      case 'week': return `${d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} 주`;
      case 'day': return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
    }
  };

  const viewOptions: { value: CalendarViewType; label: string }[] = [
    { value: 'month', label: '월' },
    { value: 'week', label: '주' },
    { value: 'day', label: '일' },
  ];

  if (!googleConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <p className="text-lg text-text-primary mb-2">Google 캘린더를 연결하세요</p>
        <p className="text-sm text-text-secondary mb-4">일정을 확인하고 관리하려면 Google 계정 연결이 필요합니다</p>
        <button onClick={connectGoogle} className="px-4 py-2 bg-accent text-surface-raised rounded hover:bg-accent-hover">
          Google 계정 연결
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-text-secondary hover:text-text-primary px-2 py-1">←</button>
          <h2 className="text-lg font-semibold text-text-primary min-w-[200px] text-center">{viewLabel()}</h2>
          <button onClick={() => navigate(1)} className="text-text-secondary hover:text-text-primary px-2 py-1">→</button>
          <button onClick={() => navigate(0)} className="text-sm text-accent hover:text-accent-hover ml-2">오늘</button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded border border-border">
            {viewOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setView(opt.value)}
                className={`px-3 py-1.5 text-sm ${
                  view === opt.value
                    ? 'bg-accent text-surface-raised'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button onClick={syncNow} className="text-sm text-text-secondary hover:text-text-primary px-2" title="동기화">🔄</button>
        </div>
      </div>

      {/* 뷰 */}
      <div className="flex-1 overflow-hidden">
        {view === 'month' && <MonthView dateStr={dateStr} events={events} onSelectEvent={setSelectedEventId} />}
        {view === 'week' && <WeekView dateStr={dateStr} events={events} onSelectEvent={setSelectedEventId} />}
        {view === 'day' && <DayView dateStr={dateStr} events={events} onSelectEvent={setSelectedEventId} />}
      </div>
    </div>
  );
}
```

- [ ] **Step 8: 캘린더 페이지**

```tsx
// renderer/pages/calendar.tsx
import { CalendarView } from '../components/calendar/CalendarView';

export default function CalendarPage() {
  return <CalendarView />;
}
```

- [ ] **Step 9: 커밋**

```bash
git add renderer/components/calendar/ renderer/hooks/use-calendar.ts renderer/pages/calendar.tsx renderer/stores/app-store.ts
git commit -m "feat: calendar UI with month/week/day views and Google sync"
```

---

### Task 6: 통합 테스트 + .env 가이드 + 푸쉬

**Files:**
- Modify: `renderer/pages/home.tsx` — 오늘 일정 표시
- 전체 테스트 + 푸쉬

- [ ] **Step 1: 홈에 오늘 일정 섹션 추가**

`renderer/pages/home.tsx`를 수정하여 캘린더 이벤트 카운트를 추가:

```tsx
// 기존 빌드 카운트 옆에:
<div className="p-4 rounded-lg border border-border bg-surface-raised">
  <h3 className="text-sm font-semibold text-text-primary mb-2">오늘 일정</h3>
  <p className="text-2xl font-bold text-accent">{todayEventCount}</p>
  <Link href="/calendar" className="text-sm text-accent hover:text-accent-hover mt-2 inline-block">
    캘린더 보기 →
  </Link>
</div>
```

- [ ] **Step 2: 전체 테스트 실행**

```bash
pnpm vitest run
```

Expected: 16 tests PASS (기존 12 + calendar cache 4)

- [ ] **Step 3: 커밋 + 푸쉬**

```bash
git add -A
git commit -m "feat: complete calendar with Google OAuth, sync, month/week/day views"
git push
```

---

## Summary

| Task | 내용 | 핵심 파일 |
|---|---|---|
| 1 | googleapis + 타입 + IPC 채널 + DB statements | types.ts, channels.ts, statements.ts |
| 2 | Google OAuth 인증 (Electron BrowserWindow 팝업) | google/auth.ts |
| 3 | Calendar API 래퍼 + 증분 동기화 + 캐시 테스트 | google/calendar-api.ts, calendar-sync.ts, 4 tests |
| 4 | 캘린더 IPC 핸들러 + main.ts 초기화 | register.ts, main.ts |
| 5 | 캘린더 UI — 월/주/일 뷰 + EventChip + 네비게이션 | 7 컴포넌트 + hook |
| 6 | 통합 + 홈 연동 + 푸쉬 | home.tsx, E2E |

**전체 커밋: 6회, 신규 테스트: 4개 (누적 16), 신규 컴포넌트: 7개**

**Fan-out 기회:**
- Task 1 (타입+채널) → Task 2 (OAuth)와 Task 3 (API+동기화) **병렬 가능** (파일 겹침 없음)
- Task 4 (IPC) → Task 5 (UI): 순차
