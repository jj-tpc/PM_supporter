import Database from 'better-sqlite3';

export function applySchema(db: Database.Database): void {
  db.exec(`
    -- 빌드 (프로젝트/보드)
    CREATE TABLE IF NOT EXISTS builds (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- 페이즈 (컬럼/작업 단계)
    CREATE TABLE IF NOT EXISTS phases (
      id TEXT PRIMARY KEY,
      build_id TEXT NOT NULL REFERENCES builds(id),
      name TEXT NOT NULL,
      "order" INTEGER NOT NULL,
      wip_limit INTEGER
    );

    -- 스텝 (태스크 카드)
    CREATE TABLE IF NOT EXISTS steps (
      id TEXT PRIMARY KEY,
      build_id TEXT NOT NULL REFERENCES builds(id),
      phase_id TEXT NOT NULL REFERENCES phases(id),
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      priority TEXT CHECK(priority IN ('critical','high','medium','low')) DEFAULT 'medium',
      due_date TEXT,
      "order" INTEGER NOT NULL,
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- 크루 (팀원)
    CREATE TABLE IF NOT EXISTS crews (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      role TEXT,
      avatar_url TEXT
    );

    -- 스텝-크루 매핑
    CREATE TABLE IF NOT EXISTS step_assignees (
      step_id TEXT NOT NULL REFERENCES steps(id),
      crew_id TEXT NOT NULL REFERENCES crews(id),
      PRIMARY KEY (step_id, crew_id)
    );

    -- 라벨
    CREATE TABLE IF NOT EXISTS labels (
      id TEXT PRIMARY KEY,
      build_id TEXT NOT NULL REFERENCES builds(id),
      name TEXT NOT NULL,
      color TEXT NOT NULL
    );

    -- 스텝-라벨 매핑
    CREATE TABLE IF NOT EXISTS step_labels (
      step_id TEXT NOT NULL REFERENCES steps(id),
      label_id TEXT NOT NULL REFERENCES labels(id),
      PRIMARY KEY (step_id, label_id)
    );

    -- 체크리스트
    CREATE TABLE IF NOT EXISTS checklist_items (
      id TEXT PRIMARY KEY,
      step_id TEXT NOT NULL REFERENCES steps(id),
      text TEXT NOT NULL,
      is_checked INTEGER NOT NULL DEFAULT 0,
      "order" INTEGER NOT NULL
    );

    -- 코멘트
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      step_id TEXT NOT NULL REFERENCES steps(id),
      author_id TEXT NOT NULL REFERENCES crews(id),
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    -- Deep Work 세션
    CREATE TABLE IF NOT EXISTS deep_work_sessions (
      id TEXT PRIMARY KEY,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      tasks_completed INTEGER DEFAULT 0,
      total_focus_minutes INTEGER DEFAULT 0,
      context_note TEXT,
      last_step_id TEXT REFERENCES steps(id),
      last_checklist_item_id TEXT REFERENCES checklist_items(id)
    );

    -- 루틴 설정
    CREATE TABLE IF NOT EXISTS routines (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('daily_briefing','meeting_prep','daily_wrapup','weekly_review','sprint_retro')),
      trigger_type TEXT NOT NULL CHECK(trigger_type IN ('auto','scheduled','manual')),
      trigger_config TEXT,
      enabled INTEGER DEFAULT 1,
      created_at TEXT NOT NULL
    );

    -- 루틴 출력
    CREATE TABLE IF NOT EXISTS routine_outputs (
      id TEXT PRIMARY KEY,
      routine_id TEXT NOT NULL REFERENCES routines(id),
      content TEXT NOT NULL,
      source_data TEXT,
      generated_at TEXT NOT NULL
    );

    -- 캘린더-스텝 링크
    CREATE TABLE IF NOT EXISTS event_step_links (
      event_id TEXT NOT NULL,
      step_id TEXT NOT NULL REFERENCES steps(id),
      link_type TEXT NOT NULL CHECK(link_type IN ('manual','auto','ai_suggested')),
      PRIMARY KEY (event_id, step_id)
    );

    -- 가이드 (팀 오더)
    CREATE TABLE IF NOT EXISTS guides (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('daily','weekly','monthly','sprint')),
      crew_id TEXT REFERENCES crews(id),
      build_id TEXT NOT NULL REFERENCES builds(id),
      content TEXT NOT NULL,
      additional_instructions TEXT,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    -- 뷰포인트 (저장된 필터 뷰)
    CREATE TABLE IF NOT EXISTS viewpoints (
      id TEXT PRIMARY KEY,
      build_id TEXT NOT NULL REFERENCES builds(id),
      name TEXT NOT NULL,
      filters TEXT NOT NULL,
      sort_by TEXT,
      created_at TEXT NOT NULL
    );

    -- 휴지통 (Soft Delete)
    CREATE TABLE IF NOT EXISTS deleted_items (
      id TEXT PRIMARY KEY,
      item_type TEXT NOT NULL CHECK(item_type IN ('step','build','phase','crew','batch')),
      item_id TEXT NOT NULL,
      item_data TEXT NOT NULL,
      batch_id TEXT,
      deleted_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    -- Google 계정
    CREATE TABLE IF NOT EXISTS google_accounts (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      token_expiry TEXT NOT NULL,
      calendars_synced TEXT
    );

    -- 캘린더 이벤트 캐시
    CREATE TABLE IF NOT EXISTS calendar_events_cache (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES google_accounts(id),
      calendar_id TEXT NOT NULL,
      summary TEXT,
      description TEXT,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      location TEXT,
      attendees TEXT,
      recurrence TEXT,
      raw_data TEXT NOT NULL,
      synced_at TEXT NOT NULL
    );

    -- AI 대화 기록
    CREATE TABLE IF NOT EXISTS planner_sessions (
      id TEXT PRIMARY KEY,
      build_id TEXT REFERENCES builds(id),
      title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS planner_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES planner_sessions(id),
      role TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    -- 앱 설정
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- ========== 인덱스 ==========
    CREATE INDEX IF NOT EXISTS idx_phases_build ON phases(build_id, "order");
    CREATE INDEX IF NOT EXISTS idx_steps_phase_order ON steps(phase_id, "order");
    CREATE INDEX IF NOT EXISTS idx_steps_build ON steps(build_id);
    CREATE INDEX IF NOT EXISTS idx_steps_updated ON steps(updated_at);
    CREATE INDEX IF NOT EXISTS idx_step_assignees_crew ON step_assignees(crew_id);
    CREATE INDEX IF NOT EXISTS idx_checklist_step ON checklist_items(step_id, "order");
    CREATE INDEX IF NOT EXISTS idx_comments_step ON comments(step_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_deep_work_started ON deep_work_sessions(started_at);
    CREATE INDEX IF NOT EXISTS idx_routine_outputs_generated ON routine_outputs(generated_at);
    CREATE INDEX IF NOT EXISTS idx_routine_outputs_routine ON routine_outputs(routine_id);
    CREATE INDEX IF NOT EXISTS idx_event_step_links_step ON event_step_links(step_id);
    CREATE INDEX IF NOT EXISTS idx_guides_build_period ON guides(build_id, period_start);
    CREATE INDEX IF NOT EXISTS idx_guides_crew ON guides(crew_id);
    CREATE INDEX IF NOT EXISTS idx_viewpoints_build ON viewpoints(build_id);
    CREATE INDEX IF NOT EXISTS idx_deleted_items_expires ON deleted_items(expires_at);
    CREATE INDEX IF NOT EXISTS idx_calendar_cache_time ON calendar_events_cache(start_time, end_time);
    CREATE INDEX IF NOT EXISTS idx_calendar_cache_account ON calendar_events_cache(account_id, calendar_id);
    CREATE INDEX IF NOT EXISTS idx_planner_messages_session ON planner_messages(session_id, created_at);
  `);
}
