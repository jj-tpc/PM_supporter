import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { createConnection } from '../../main/db/connection';
import { applySchema } from '../../main/db/schema';
import { createStatements } from '../../main/db/statements';
import { TrashService } from '../../main/db/trash';

describe('TrashService', () => {
  let db: Database.Database;
  let trash: TrashService;
  let stmts: ReturnType<typeof createStatements>;

  beforeEach(() => {
    db = createConnection(':memory:');
    applySchema(db);
    stmts = createStatements(db);
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
    expect(items[0].item_type).toBe('step');
    expect(items[0].item_id).toBe('s1');
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

    // force expiry to past
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
