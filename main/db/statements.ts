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
  } as const;
}

export type Statements = ReturnType<typeof createStatements>;
