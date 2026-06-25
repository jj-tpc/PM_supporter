import Database from 'better-sqlite3';
import { v4 as uuid } from 'uuid';
import type { Statements } from './statements';

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
    const item = this.stmts.getDeletedItem.get(deletedItemId) as any;
    if (!item) throw new Error(`Deleted item not found: ${deletedItemId}`);

    const table = TABLE_MAP[item.item_type];
    if (!table) throw new Error(`Unknown item type: ${item.item_type}`);

    const data = JSON.parse(item.item_data);
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
    const items = this.stmts.getDeletedByBatch.all(batchId) as any[];
    const txn = this.db.transaction(() => {
      for (const item of items) {
        this.restore(item.id);
      }
    });
    txn();
  }

  list(): any[] {
    return this.stmts.listDeletedItems.all();
  }

  purgeExpired(): number {
    const now = new Date().toISOString();
    const result = this.stmts.purgeExpired.run(now);
    return result.changes;
  }
}
