# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**PM Supporter** — A one-stop desktop application for Project Managers. Aimed at making PM workflows accessible even to complete beginners ("PM 왕초보도 이거면 다 된다").

- **License:** AGPL-3.0
- **Stack:** Electron + Next.js + TypeScript, SQLite, Zustand, Tailwind CSS

## Key Documents

- `docs/PRD.md` — Product Requirements Document (기능 정의, 아키텍처, 마일스톤)
- `docs/senior_tips.md` — Electron 성능 최적화 가이드 (**아래 규칙 반드시 참고**)

## Performance Rules — 코드 작성 시 반드시 준수

이 프로젝트는 Electron 기반이므로 성능 최적화가 핵심이다. 코드를 작성하거나 수정할 때 반드시 `docs/senior_tips.md`를 참조하라.

### 요약 — 위반하면 안 되는 것들

1. **앱 시작**: Main Process에서 무거운 모듈을 top-level import 금지. `BrowserWindow` 먼저 띄우고 나머지는 lazy `import()` 사용
2. **IPC 통신**: 대량 데이터를 통째로 넘기지 않는다. 변경분 전송, 페이지네이션, 배치 처리 사용
3. **React 렌더링**: Zustand selector로 정확한 범위만 구독. 칸반 카드/컬럼은 `memo` + 정규화된 스토어 필수
4. **SQLite**: WAL 모드, prepared statement 재사용, 인덱스 확인 (`EXPLAIN QUERY PLAN`), 배치는 트랜잭션으로 묶기
5. **Google API**: `syncToken` 기반 증분 동기화, 로컬 캐시 우선 렌더 후 백그라운드 동기화
6. **LLM 호출**: 반드시 스트리밍 사용, 프롬프트 캐싱 활용, 컨텍스트에 전체 데이터 넣지 않고 요약 전송
7. **큰 리스트**: 카드 20개 이상 컬럼, 이메일 목록, 채팅 로그에 가상화(`@tanstack/react-virtual`) 적용
8. **DnD**: optimistic update (UI 즉시 반영 → DB 비동기), `DragOverlay`로 리렌더 최소화
9. **메모리**: 이벤트 리스너 cleanup, 큰 데이터 참조 해제, React Query의 gcTime 설정
