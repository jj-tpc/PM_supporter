import { ipcMain } from 'electron';
import { v4 as uuid } from 'uuid';
import type { IpcChannels, IpcChannel } from './channels';
import type { Statements } from '../db/statements';
import type { TrashService } from '../db/trash';
import type { EventBus } from '../events/bus';
import type { GoogleAuth } from '../google/auth';
import type { CalendarSync } from '../google/calendar-sync';
import type {
  Build, Phase, Step, Crew, DeletedItem, DeepWorkSession,
} from '../../shared/types';
import Database from 'better-sqlite3';

interface RegisterDeps {
  db: Database.Database;
  stmts: Statements;
  trash: TrashService;
  bus: EventBus;
  googleAuth: GoogleAuth;
  calendarSync: CalendarSync;
}

export function registerIpcHandlers({ db, stmts, trash, bus, googleAuth, calendarSync }: RegisterDeps): void {
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
}
