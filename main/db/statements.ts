import Database from 'better-sqlite3';

export function createStatements(db: Database.Database) {
  return {
    // Build
    getBuild: db.prepare('SELECT * FROM builds WHERE id = ?'),
    listBuilds: db.prepare('SELECT * FROM builds ORDER BY updated_at DESC'),
    insertBuild: db.prepare(
      'INSERT INTO builds (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    ),
    updateBuild: db.prepare(
      'UPDATE builds SET name = ?, description = ?, updated_at = ? WHERE id = ?'
    ),

    // Phase
    listPhases: db.prepare('SELECT * FROM phases WHERE build_id = ? ORDER BY "order"'),
    insertPhase: db.prepare(
      'INSERT INTO phases (id, build_id, name, "order", wip_limit) VALUES (?, ?, ?, ?, ?)'
    ),

    // Step
    listStepsByPhase: db.prepare('SELECT * FROM steps WHERE phase_id = ? ORDER BY "order"'),
    listStepsByBuild: db.prepare('SELECT * FROM steps WHERE build_id = ? ORDER BY "order"'),
    getStep: db.prepare('SELECT * FROM steps WHERE id = ?'),
    insertStep: db.prepare(
      'INSERT INTO steps (id, build_id, phase_id, title, description, priority, due_date, "order", created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ),
    moveStep: db.prepare(
      'UPDATE steps SET phase_id = ?, "order" = ?, updated_at = ? WHERE id = ?'
    ),

    // Crew
    listCrews: db.prepare('SELECT * FROM crews ORDER BY name'),
    insertCrew: db.prepare(
      'INSERT INTO crews (id, name, email, role, avatar_url) VALUES (?, ?, ?, ?, ?)'
    ),

    // Trash
    insertDeletedItem: db.prepare(
      'INSERT INTO deleted_items (id, item_type, item_id, item_data, batch_id, deleted_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ),
    listDeletedItems: db.prepare('SELECT * FROM deleted_items ORDER BY deleted_at DESC'),
    getDeletedItem: db.prepare('SELECT * FROM deleted_items WHERE id = ?'),
    removeDeletedItem: db.prepare('DELETE FROM deleted_items WHERE id = ?'),
    purgeExpired: db.prepare('DELETE FROM deleted_items WHERE expires_at < ?'),
    getDeletedByBatch: db.prepare('SELECT * FROM deleted_items WHERE batch_id = ?'),

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

    // Dashboard queries
    todaySteps: db.prepare(
      `SELECT s.*, b.name as build_name FROM steps s
       JOIN builds b ON s.build_id = b.id
       WHERE s.due_date IS NOT NULL
       AND date(s.due_date) = date('now')
       ORDER BY s.priority DESC, s."order"`
    ),
    crewWorkload: db.prepare(
      `SELECT
         c.id as crew_id, c.name as crew_name,
         COUNT(sa.step_id) as total,
         SUM(CASE WHEN p.name = 'Done' OR p.name = '완료' THEN 1 ELSE 0 END) as done,
         SUM(CASE WHEN p.name = 'In Progress' OR p.name = '진행 중' THEN 1 ELSE 0 END) as in_progress,
         SUM(CASE WHEN s.due_date IS NOT NULL AND s.due_date < datetime('now') AND p.name != 'Done' AND p.name != '완료' THEN 1 ELSE 0 END) as overdue
       FROM crews c
       LEFT JOIN step_assignees sa ON c.id = sa.crew_id
       LEFT JOIN steps s ON sa.step_id = s.id
       LEFT JOIN phases p ON s.phase_id = p.id
       GROUP BY c.id
       ORDER BY c.name`
    ),
    countBuilds: db.prepare('SELECT COUNT(*) as cnt FROM builds'),
    countCrews: db.prepare('SELECT COUNT(*) as cnt FROM crews'),
    countSteps: db.prepare('SELECT COUNT(*) as cnt FROM steps'),
    countDeepWorkSessions: db.prepare('SELECT COUNT(*) as cnt FROM deep_work_sessions'),
    countPlannerSessions: db.prepare('SELECT COUNT(*) as cnt FROM planner_sessions'),
  } as const;
}

export type Statements = ReturnType<typeof createStatements>;
