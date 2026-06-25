import { ipcMain } from 'electron';
import { v4 as uuid } from 'uuid';
import type { IpcChannels, IpcChannel } from './channels';
import type { Statements } from '../db/statements';
import type { TrashService } from '../db/trash';
import type { EventBus } from '../events/bus';
import type { GoogleAuth } from '../google/auth';
import type { CalendarSync } from '../google/calendar-sync';
import type {
  Build, Phase, Step, Crew, DeletedItem, DeepWorkSession, CalendarEvent,
} from '../../shared/types';
import Database from 'better-sqlite3';

interface RegisterDeps {
  db: Database.Database;
  stmts: Statements;
  trash: TrashService;
  bus: EventBus;
  googleAuth: GoogleAuth;
  calendarSync: CalendarSync;
  mainWindow: Electron.BrowserWindow | null;
}

export function registerIpcHandlers({ db, stmts, trash, bus, googleAuth, calendarSync, mainWindow }: RegisterDeps): void {
  function handle<C extends IpcChannel>(
    channel: C,
    handler: (...args: IpcChannels[C]['args']) => IpcChannels[C]['return'] | Promise<IpcChannels[C]['return']>
  ) {
    ipcMain.handle(channel, (_event: Electron.IpcMainInvokeEvent, ...args: unknown[]) =>
      handler(...(args as IpcChannels[C]['args']))
    );
  }

  const now = () => new Date().toISOString();

  // === Build ===
  handle('build:list', () => stmts.listBuilds.all() as Build[]);
  handle('build:get', (id) => (stmts.getBuild.get(id) as Build | undefined) ?? null);
  handle('build:create', (data) => {
    const id = uuid();
    const ts = now();
    stmts.insertBuild.run(id, data.name, data.description ?? '', ts, ts);
    const build = stmts.getBuild.get(id) as Build;
    bus.emit('build:created', { buildId: id });
    return build;
  });
  handle('build:delete', (id) => {
    trash.softDelete('build', id);
  });

  // === Phase ===
  handle('phase:list', (buildId) => stmts.listPhases.all(buildId) as Phase[]);
  handle('phase:create', (data) => {
    const id = uuid();
    stmts.insertPhase.run(id, data.buildId, data.name, data.order, data.wipLimit ?? null);
    return db.prepare('SELECT * FROM phases WHERE id = ?').get(id) as Phase;
  });
  handle('phase:delete', (id) => {
    trash.softDelete('phase', id);
  });

  // === Step ===
  handle('step:list', (buildId) => stmts.listStepsByBuild.all(buildId) as Step[]);
  handle('step:listByPhase', (phaseId) => stmts.listStepsByPhase.all(phaseId) as Step[]);
  handle('step:get', (id) => (stmts.getStep.get(id) as Step | undefined) ?? null);
  handle('step:create', (data) => {
    const id = uuid();
    const ts = now();
    stmts.insertStep.run(
      id, data.buildId, data.phaseId, data.title, data.description ?? '',
      data.priority ?? 'medium', data.dueDate ?? null, data.order, data.createdBy ?? null, ts, ts
    );
    return stmts.getStep.get(id) as Step;
  });
  handle('step:createBatch', (steps) => {
    const ts = now();
    const results: Step[] = [];
    const txn = db.transaction(() => {
      for (const data of steps) {
        const id = uuid();
        stmts.insertStep.run(
          id, data.buildId, data.phaseId, data.title, data.description ?? '',
          data.priority ?? 'medium', data.dueDate ?? null, data.order, data.createdBy ?? null, ts, ts
        );
        results.push(stmts.getStep.get(id) as Step);
      }
    });
    txn();
    return results;
  });
  handle('step:move', ({ stepId, targetPhaseId, order }) => {
    const step = stmts.getStep.get(stepId) as Record<string, unknown> | undefined;
    if (!step) return;
    const fromPhase = step.phase_id as string;
    stmts.moveStep.run(targetPhaseId, order, now(), stepId);
    bus.emit('step:moved', { stepId, fromPhase, toPhase: targetPhaseId });
  });
  handle('step:update', (id, changes) => {
    const step = stmts.getStep.get(id) as Record<string, unknown> | undefined;
    if (!step) throw new Error(`Step not found: ${id}`);

    const updatable = ['title', 'description', 'priority', 'due_date'] as const;
    const setClauses: string[] = [];
    const values: unknown[] = [];

    for (const [key, value] of Object.entries(changes)) {
      const snakeKey = key.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`);
      if ((updatable as readonly string[]).includes(snakeKey)) {
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
  handle('step:delete', (id) => {
    trash.softDelete('step', id);
    bus.emit('step:deleted', { stepId: id });
  });

  // === Crew ===
  handle('crew:list', () => stmts.listCrews.all() as Crew[]);
  handle('crew:create', (data) => {
    const id = uuid();
    stmts.insertCrew.run(id, data.name, data.email ?? null, data.role ?? null, data.avatarUrl ?? null);
    return db.prepare('SELECT * FROM crews WHERE id = ?').get(id) as Crew;
  });
  handle('crew:delete', (id) => {
    trash.softDelete('crew', id);
  });

  // === Step-Crew Assignment ===
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

  handle('step:getAssignees', (stepId) => {
    return db.prepare('SELECT crew_id FROM step_assignees WHERE step_id = ?')
      .all(stepId)
      .map((r: any) => r.crew_id);
  });

  // === Trash ===
  handle('trash:list', () => trash.list() as DeletedItem[]);
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
    return db.prepare('SELECT * FROM deep_work_sessions WHERE id = ?').get(id) as DeepWorkSession;
  });
  handle('deepwork:end', (sessionId) => {
    const ts = now();
    const session = db.prepare('SELECT * FROM deep_work_sessions WHERE id = ?').get(sessionId) as
      Record<string, unknown> | undefined;
    if (session) {
      const startedAt = new Date(session.started_at as string).getTime();
      const minutes = Math.round((Date.now() - startedAt) / 60000);
      db.prepare(
        'UPDATE deep_work_sessions SET ended_at = ?, total_focus_minutes = ? WHERE id = ?'
      ).run(ts, minutes, sessionId);
    }
    const updated = db.prepare('SELECT * FROM deep_work_sessions WHERE id = ?').get(sessionId) as DeepWorkSession;
    bus.emit('deepwork:ended', { sessionId, stepsCompleted: [] });
    return updated;
  });
  handle('deepwork:getCurrent', () => {
    return (db.prepare(
      'SELECT * FROM deep_work_sessions WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1'
    ).get() as DeepWorkSession | undefined) ?? null;
  });
  handle('deepwork:updateContext', (sessionId, contextNote) => {
    db.prepare('UPDATE deep_work_sessions SET context_note = ? WHERE id = ?').run(contextNote, sessionId);
  });

  // === Google Auth ===
  handle('google:startAuth', async () => {
    const result = await googleAuth.startAuth();
    return stmts.getGoogleAccount.get(result.id) as any;
  });
  handle('google:getAccounts', () => googleAuth.getAccounts() as any);
  handle('google:removeAccount', (id) => googleAuth.removeAccount(id));

  // === Calendar ===
  handle('calendar:getEvents', (range) => {
    return calendarSync.getEventsByRange(range.start, range.end) as any;
  });
  handle('calendar:sync', async () => {
    return calendarSync.sync();
  });
  handle('calendar:getSyncStatus', () => {
    return calendarSync.getStatus();
  });
  handle('calendar:createEvent', async (data) => {
    const accounts = googleAuth.getAccounts() as any[];
    if (accounts.length === 0) throw new Error('No Google account connected');
    const client = googleAuth.getClient(accounts[0].id);
    const { CalendarAPI } = await import('../google/calendar-api');
    const api = new CalendarAPI(client);
    const event = await api.createEvent(data.calendarId || 'primary', {
      summary: data.summary,
      start: { dateTime: data.startTime },
      end: { dateTime: data.endTime },
      description: data.description,
      location: data.location,
    });
    await calendarSync.sync();
    return stmts.getEvent.get(event.id!) as any;
  });
  handle('calendar:updateEvent', async (eventId, changes) => {
    const cached = stmts.getEvent.get(eventId) as any;
    if (!cached) throw new Error(`Event not found: ${eventId}`);
    const accounts = googleAuth.getAccounts() as any[];
    if (accounts.length === 0) throw new Error('No Google account connected');
    const client = googleAuth.getClient(cached.account_id);
    const { CalendarAPI } = await import('../google/calendar-api');
    const api = new CalendarAPI(client);
    const patch: any = {};
    if (changes.summary !== undefined) patch.summary = changes.summary;
    if (changes.startTime !== undefined) patch.start = { dateTime: changes.startTime };
    if (changes.endTime !== undefined) patch.end = { dateTime: changes.endTime };
    if (changes.description !== undefined) patch.description = changes.description;
    if (changes.location !== undefined) patch.location = changes.location;
    await api.updateEvent(cached.calendar_id, eventId, patch);
    await calendarSync.sync();
    return stmts.getEvent.get(eventId) as any;
  });
  handle('calendar:deleteEvent', async (eventId) => {
    const cached = stmts.getEvent.get(eventId) as any;
    if (!cached) throw new Error(`Event not found: ${eventId}`);
    const accounts = googleAuth.getAccounts() as any[];
    if (accounts.length === 0) throw new Error('No Google account connected');
    const client = googleAuth.getClient(cached.account_id);
    const { CalendarAPI } = await import('../google/calendar-api');
    const api = new CalendarAPI(client);
    await api.deleteEvent(cached.calendar_id, eventId);
    stmts.deleteEvent.run(eventId);
    bus.emit('calendar:changed', { eventId, type: 'deleted' });
  });

  // === Dashboard ===
  handle('dashboard:getData', () => {
    const today = new Date().toISOString().split('T')[0];
    const dayStart = `${today}T00:00:00Z`;
    const dayEnd = `${today}T23:59:59Z`;
    const todayEvents = stmts.getEventsByRange.all(dayEnd, dayStart) as CalendarEvent[];

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

    const crewWorkload = (stmts.crewWorkload.all() as any[]).map((row: any) => ({
      crewId: row.crew_id, crewName: row.crew_name,
      total: row.total ?? 0, done: row.done ?? 0,
      inProgress: row.in_progress ?? 0, overdue: row.overdue ?? 0,
    }));

    const onboarding = getOnboardingState();
    return { todayEvents, todaySteps, crewWorkload, onboarding };
  });

  handle('dashboard:getOnboarding', () => getOnboardingState());

  handle('dashboard:dismissOnboarding', () => {
    db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('onboarding_dismissed', ?)").run(now());
  });

  function getOnboardingState(): import('../../shared/types').OnboardingState {
    const buildCount = (stmts.countBuilds.get() as any).cnt;
    const crewCount = (stmts.countCrews.get() as any).cnt;
    const stepCount = (stmts.countSteps.get() as any).cnt;
    const googleAccounts = stmts.listGoogleAccounts.all() as any[];
    const deepWorkCount = (stmts.countDeepWorkSessions.get() as any).cnt;
    const plannerCount = (stmts.countPlannerSessions.get() as any).cnt;
    const dismissed = db.prepare("SELECT value FROM app_settings WHERE key = 'onboarding_dismissed'").get() as any;
    return {
      buildCreated: buildCount > 0, crewAdded: crewCount > 0, stepCreated: stepCount > 0,
      googleConnected: googleAccounts.length > 0, deepWorkTried: deepWorkCount > 0,
      aiUsed: plannerCount > 0, completedAt: dismissed?.value ?? null,
    };
  }

  // === AI Chat ===
  handle('ai:getApiKeyStatus', () => {
    const { isApiKeyConfigured } = require('../ai/claude-client');
    return { configured: isApiKeyConfigured() };
  });

  handle('ai:createSession', ({ buildId, title }) => {
    const id = uuid();
    const ts = now();
    stmts.insertPlannerSession.run(id, buildId ?? null, title, ts, ts);
    return stmts.getPlannerSession.get(id) as import('../../shared/types').PlannerSession;
  });

  handle('ai:listSessions', () => stmts.listPlannerSessions.all() as import('../../shared/types').PlannerSession[]);

  handle('ai:getMessages', (sessionId) => stmts.listPlannerMessages.all(sessionId) as import('../../shared/types').PlannerMessage[]);

  handle('ai:sendMessage', async ({ sessionId, content }) => {
    const msgId = uuid();
    const ts = now();
    stmts.insertPlannerMessage.run(msgId, sessionId, 'user', content, ts);

    const history = (stmts.listPlannerMessages.all(sessionId) as any[])
      .filter((m: any) => m.role !== 'system')
      .map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const session = stmts.getPlannerSession.get(sessionId) as any;
    let contextPrompt = '';
    if (session?.build_id) {
      const build = stmts.getBuild.get(session.build_id) as any;
      const phases = (stmts.listPhases.all(session.build_id) as any[]).map((p: any) => ({
        name: p.name,
        stepCount: (stmts.listStepsByPhase.all(p.id) as any[]).length,
      }));
      const crews = (stmts.listCrews.all() as any[]).map((c: any) => ({
        name: c.name, role: c.role ?? '미지정',
      }));
      const { buildContextPrompt } = await import('../ai/prompts');
      contextPrompt = buildContextPrompt({ buildName: build?.name, phases, crewMembers: crews });
    }

    const { PLANNER_SYSTEM_PROMPT } = await import('../ai/prompts');
    const { streamChat } = await import('../ai/claude-client');

    let fullResponse = '';
    try {
      for await (const chunk of streamChat(PLANNER_SYSTEM_PROMPT + contextPrompt, history)) {
        fullResponse += chunk;
        if (mainWindow) {
          mainWindow.webContents.send('ai:stream', { sessionId, chunk });
        }
      }
    } catch (err: any) {
      fullResponse = `[AI 오류] ${err.message ?? '응답을 생성할 수 없습니다.'}`;
      if (mainWindow) {
        mainWindow.webContents.send('ai:stream', { sessionId, chunk: fullResponse });
      }
    }

    const assistantMsgId = uuid();
    stmts.insertPlannerMessage.run(assistantMsgId, sessionId, 'assistant', fullResponse, now());

    if (mainWindow) {
      mainWindow.webContents.send('ai:streamEnd', { sessionId });
    }

    stmts.updatePlannerSession.run(
      (stmts.getPlannerSession.get(sessionId) as any)?.title ?? 'AI 대화',
      now(),
      sessionId
    );
  });
}
