import type Database from 'better-sqlite3';
import type { Statements } from '../db/statements';
import type { EventBus } from './bus';

export function registerCrossLinks(db: Database.Database, stmts: Statements, bus: EventBus) {
  // #1: Step due date set → log (Phase 2 adds calendar marker)
  bus.on('step:updated', ({ stepId, changes }) => {
    if ('dueDate' in changes && changes.dueDate) {
      console.log(`[CrossLink #1] Step ${stepId} due date: ${changes.dueDate}`);
    }
  });

  // #5: Deep Work ended → update completed count
  bus.on('deepwork:ended', ({ sessionId, stepsCompleted }) => {
    if (stepsCompleted.length > 0) {
      db.prepare('UPDATE deep_work_sessions SET tasks_completed = ? WHERE id = ?')
        .run(stepsCompleted.length, sessionId);
      console.log(`[CrossLink #5] Deep Work ${sessionId}: ${stepsCompleted.length} steps`);
    }
  });

  // #8: Build created → log
  bus.on('build:created', ({ buildId }) => {
    console.log(`[CrossLink #8] Build ${buildId} created`);
  });
}
