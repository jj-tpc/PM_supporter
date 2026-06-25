# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**PM Supporter** — A one-stop desktop application for Project Managers. Aimed at making PM workflows accessible even to complete beginners ("PM 왕초보도 이거면 다 된다").

- **License:** AGPL-3.0
- **Stack:** Nextron (Electron 41 + Next.js 16) + TypeScript 5.9, SQLite (better-sqlite3), Zustand, Tailwind CSS 4

## Development Commands

```bash
pnpm dev                                    # 개발 모드 (Electron + Next.js hot reload)
pnpm build                                  # 프로덕션 빌드
pnpm vitest run                             # 전체 테스트
pnpm vitest run tests/main/db.test.ts       # 단일 테스트
```

## Architecture

- `main/` — Electron main process (DB, IPC handlers, event bus)
  - `main/db/` — SQLite connection, schema, statements, trash service
  - `main/ipc/` — IPC channel types and handler registration
  - `main/events/` — Typed event bus
- `renderer/` — Next.js renderer (React UI, Zustand store, Tailwind)
  - `renderer/stores/` — Zustand normalized store
  - `renderer/components/` — React components
  - `renderer/lib/` — IPC client, utilities
- `shared/` — Main/Renderer shared types (app terminology)
- `tests/` — Vitest unit tests

## App Terminology

코드에서도 앱 고유 용어를 사용한다: Step(태스크), Build(프로젝트), Phase(컬럼), Crew(팀원), Guide(팀 오더), Viewpoint(필터 뷰), Stage(스프린트), Checkpoint(마일스톤), Roadmap(WBS). 상세: `shared/types.ts`

## Key Documents

- `docs/PRD.md` — Product Requirements Document
- `docs/superpowers/specs/2026-06-24-pm-supporter-expansion-design.md` — Expansion Design Spec (v2.0)
- `docs/senior_tips.md` — Electron 성능 최적화 가이드

## Performance Rules

이 프로젝트는 Electron 기반이므로 성능 최적화가 핵심이다. 코드를 작성할 때 `docs/senior_tips.md`를 참조하라.

1. Main Process에서 무거운 모듈을 top-level import 금지 → lazy `import()` 사용
2. IPC로 대량 데이터 전송 금지 → 변경분 전송, 페이지네이션, 배치 처리
3. Zustand selector로 정확한 범위만 구독 → `memo` + 정규화된 스토어 필수
4. SQLite: WAL 모드, prepared statement 재사용, 인덱스 확인
5. 큰 리스트에 가상화(`@tanstack/react-virtual`) 적용
6. DnD: optimistic update (UI 즉시 → DB 비동기)
