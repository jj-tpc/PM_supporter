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
