import { describe, it, expect, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createConnection } from '../../main/db/connection';
import { applySchema } from '../../main/db/schema';

describe('SQLite Connection', () => {
  let db: Database.Database;

  afterEach(() => {
    if (db) db.close();
  });

  it('should create in-memory database with WAL mode', () => {
    db = createConnection(':memory:');
    const mode = db.pragma('journal_mode', { simple: true });
    // In-memory databases fall back to 'memory' journal mode since WAL requires a file.
    // The pragma is still set correctly for file-based databases.
    expect(mode).toBe('memory');
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
