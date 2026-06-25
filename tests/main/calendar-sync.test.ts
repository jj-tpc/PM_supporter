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
