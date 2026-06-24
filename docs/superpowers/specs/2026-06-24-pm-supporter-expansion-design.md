# PM Supporter — Expansion Design Spec

> **문서 버전:** v1.0.0  
> **작성일:** 2026-06-24  
> **상태:** Approved  
> **범위:** 기존 PRD(v0.1.0) 검증 + 확장 기능 설계

---

## 1. 배경 및 목적

기존 PRD는 3대 핵심 기능(캘린더/칸반/AI Planner)을 독립적으로 정의했으나, 다음이 부재했다:

- 기능 간 자동 연동
- PM 루틴(일/주/스프린트) 지원
- 팀원 지시 아웃풋 생성
- AI의 선제적 역할
- 앱 진입 시 첫 화면(홈 대시보드)
- 집중 모드 지원

이 문서는 위 빈 곳을 채우고, 기존 PRD의 우선순위를 재조정한 확장 설계이다.

---

## 2. 설계 원칙

| 원칙 | 설명 |
|---|---|
| **홈 대시보드 중심** | 모든 기능의 허브. 연동도, AI도, 루틴도 홈에서 시작한다 |
| **통합과 AI를 동시에, Phase별로 점진** | 기능 간 연동 깊이와 AI 깊이를 Phase마다 함께 확장 |
| **PM 단독 사용 MVP → 멀티유저 확장** | Phase 1~3은 로컬 단독, Phase 4에서 팀원 참여 |
| **LLM 호출 최소화** | 규칙 기반으로 가능한 것은 로컬 로직, LLM은 생성/분석에만 |
| **Deep Work = 같은 앱의 다른 밀도** | 별도 앱이 아니라 단일 토글로 전환되는 프리미엄 모드 |

---

## 3. 기존 PRD 변경사항

### 유지 (변경 없음)

- Google Calendar CRUD (일/주/월 뷰, OAuth, 양방향 동기화)
- 칸반 보드 기본 (보드/컬럼/카드 CRUD, DnD, 담당자 지정, 팀원별 필터)
- AI Planner 기본 (WBS 생성, 태스크 자동 생성, 대화형 수정)
- 기술 스택 전체 (Electron + Next.js + TypeScript + SQLite + Zustand + Tailwind)

### 수정

| 항목 | 변경 전 | 변경 후 | 이유 |
|---|---|---|---|
| Gmail 연동 | Phase 1 (P0) | Phase 2 (P1) | 홈 대시보드/Deep Work가 MVP에서 더 높은 가치 |
| 칸반 "페이지화/저장" | "페이지" 개념 모호 | "저장된 필터 뷰" — 필터 조합(팀원별, 라벨별, 마감임박 등)을 저장 | 개념 명확화 |
| AI Planner 위치 | 독립 탭 | 홈 대시보드와 칸반 보드 양쪽에서 접근 가능한 사이드 패널 | 컨텍스트 전환 없이 AI 접근 |
| 타임라인(간트) 뷰 | Phase 3 (P2) | Phase 4, 일반 모드 전용 | Deep Work와 충돌 방지, 우선순위 조정 |

### 추가 (신규)

| 기능 | 시작 Phase | 상세 섹션 |
|---|---|---|
| 홈 대시보드 | Phase 1 | 섹션 4 |
| Deep Work 모드 | Phase 1 | 섹션 5 |
| PM 루틴 엔진 | Phase 2 | 섹션 6 |
| 팀 오더 생성기 | Phase 3 | 섹션 7 |
| 기능 간 크로스 연동 | Phase 1 | 섹션 8 |
| 이벤트 버스 (인프라) | Phase 1 | 섹션 8 |

---

## 4. 홈 대시보드

앱을 열면 가장 먼저 보이는 화면. "오늘 PM으로서 뭘 해야 하는가"를 즉시 답한다.

### 구성 요소 (위→아래)

| # | 요소 | 데이터 소스 | 갱신 주기 |
|---|---|---|---|
| ① | AI 브리핑 카드 | 캘린더 + 칸반 + Deep Work 이력 → LLM | 앱 시작 시 1회, 수동 새로고침 가능 |
| ②-L | 오늘의 일정 | Google Calendar 로컬 캐시 | 실시간 (syncToken) |
| ②-R | 오늘의 태스크 | SQLite tasks (내 담당 + due_date = today) | 즉시 (로컬 DB) |
| ③ | 팀 현황 스냅샷 | SQLite tasks + task_assignees 집계 | 즉시 (로컬 DB) |
| ④ | AI 알림 (선제적) | 규칙 기반 + LLM 분석 | 앱 시작 시 + 데이터 변경 시 |

### 설계 원칙

- **스크롤 없이 핵심 파악** — ①②③이 한 화면에 보여야 함. ④는 있을 때만 표시
- **클릭 1회로 상세 진입** — 일정 클릭 → 캘린더 뷰, 태스크 클릭 → 칸반 해당 카드
- **AI 브리핑은 접을 수 있음** — dismiss 가능, 다시 보기도 가능

### Phase별 진화

| Phase | ① 브리핑 | ② 일정/태스크 | ③ 팀 현황 | ④ AI 알림 |
|---|---|---|---|---|
| **1 (MVP)** | 정적 환영 메시지 | 일정 + 태스크 목록 | 팀원별 카드 수 | 없음 |
| **2** | AI 자동 생성 | + 마감 임박 강조 | + 워크로드 바 | 규칙 기반 (WIP, 마감 지연) |
| **3** | + 오더 생성 버튼 | + 회의↔태스크 링크 | + 지연 경고 | + LLM 분석 알림 |

---

## 5. Deep Work 모드

단일 토글 `[🔘 Deep Work]`로 앱 전체가 전환된다. 별도 화면이 아니라 같은 앱의 다른 밀도.

### 전환 시 변화

| 요소 | 일반 모드 | Deep Work ON |
|---|---|---|
| 사이드바/네비게이션 | 전체 표시 | 숨김 (호버 시 일시 표시) |
| 홈 대시보드 | 4개 섹션 전부 | → "지금 이것만" 화면으로 대체 |
| 알림 | 모든 알림 표시 | 다음 일정 알림만 (15분/5분 전) |
| AI 역할 | 분석/계획 모드 | "다음 뭐 하지?" 추천 모드 |
| 캘린더/칸반/메일 탭 | 자유 접근 | 잠금 (해제 후 접근) |

### "지금 이것만" 화면 구성

- 현재 태스크 제목 + 우선순위 + 마감일
- 포모도로 타이머 (기본 25분, 시각적 프로그레스 바)
- 체크리스트 (현재 진행 항목 하이라이트)
- 다음 일정까지 남은 시간
- [태스크 완료] [잠시 멈춤] 버튼

### 6대 기능

**1. "지금 이것만" 포커스**
- Deep Work 진입 시 AI가 가장 해야 할 태스크 1개 자동 선택
- 선택 기준: 우선순위 > 마감 임박 > 의존성 블로커 순
- 사용자 거부 시 후보 3개 제시

**2. 타이머 시스템**
- 기본 25분 포모도로 (설정 변경 가능)
- 시각적 프로그레스 바
- 타이머 종료 시: "5분 쉬기" 또는 "계속하기"
- 강제하지 않음 — 초과해도 경고 없음

**3. AI "다음 뭐 하지?" 추천**
- 태스크 완료 후 AI가 다음 할 일 1개 + 이유 추천
- 맥락 유지 최우선 (같은 프로젝트, 같은 영역)
- "다른 거 할래" 시 후보 3개 제시

**4. 자동 태스크 분해**
- 체크리스트 없는 태스크 선택 시 AI가 15~30분 단위 서브스텝 자동 생성
- "이렇게 쪼개볼까요?" → 승인/수정 후 시작
- 이미 체크리스트 있으면 그대로 사용

**5. 맥락 보존 (Context Parking)**
- [잠시 멈춤] 시 "어디까지 했나요?" — 체크리스트에서 자동 감지 또는 직접 메모
- 재진입 시 "마지막으로 여기서 멈추셨습니다. 이어서 할까요?"

**6. 조용한 성취 피드백**
- 태스크 완료: 체크마크 애니메이션 + 프로그레스 바 채움
- 세션 종료 시: 집중 시간 + 완료 수 + 누적 통계 요약 카드
- 톤: 축하가 아니라 사실 기반 확인. 숫자로 보여줌

### 데이터 모델

```sql
CREATE TABLE deep_work_sessions (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  tasks_completed INTEGER DEFAULT 0,
  total_focus_minutes INTEGER DEFAULT 0,
  context_note TEXT,
  last_task_id TEXT REFERENCES tasks(id),
  last_checklist_item_id TEXT REFERENCES checklist_items(id)
);
```

### Phase별 진화

| Phase | 범위 |
|---|---|
| **1 (MVP)** | 토글 ON/OFF + "지금 이것만" 화면 + 타이머 + 체크리스트 |
| **2** | + AI 다음 추천 + 자동 태스크 분해 + 맥락 보존 |
| **3** | + 세션 통계 + 집중 리포트 + 성취 피드백 |

---

## 6. PM 루틴 엔진

PM의 업무 사이클(일/주/스프린트)에 AI가 자동으로 맞물리는 시스템.

### 루틴 유형

| 루틴 | 트리거 | AI가 하는 일 | 아웃풋 |
|---|---|---|---|
| **데일리 브리핑** | 앱 시작 시 (1회/일) | 오늘 일정 + 마감 태스크 + 어제 미완료 + 리스크 종합 | 홈 ① 브리핑 카드 |
| **회의 준비** | 캘린더 일정 30분 전 | 관련 태스크/이슈/미결 사항 수집 + 논의 안건 추천 | 회의 브리핑 노트 |
| **데일리 랩업** | 사용자 설정 시각 (기본 18:00) | 오늘 완료/미완료 정리 + 내일 추천 | 일간 요약 카드 |
| **주간 리뷰** | 매주 금요일 (설정 가능) | 주간 진척률 + 지연 분석 + 다음 주 예측 | 주간 리포트 |
| **스프린트 회고** | 스프린트 종료일 (수동 트리거 가능) | 완료율 + 병목 분석 + 개선점 제안 | 회고 리포트 |

### 데일리 브리핑 생성 로직

```
입력 데이터 수집 (로컬 우선)
├─ Google Calendar: 오늘 일정 목록
├─ SQLite tasks: due_date = today, status != done
├─ SQLite tasks: 어제 in_progress → 아직 미완료
├─ SQLite tasks: 팀원별 워크로드 집계
└─ deep_work_sessions: 어제 집중 시간
        ↓
LLM 호출 (1회)
├─ 시스템 프롬프트: "PM 비서로서 오늘 브리핑 생성"
├─ 컨텍스트: 위 데이터 구조화 요약
└─ 출력: 3~5문장 브리핑 + 추천 첫 작업
        ↓
홈 대시보드 ① 카드에 표시
```

### 회의 준비 브리핑

- 자동: 회의 참석자 이메일 → 팀원 매칭 → 해당 팀원 진행 중 태스크 수집
- 수동: 캘린더 일정에 태스크 카드 링크
- AI 추론: 회의 제목/설명 분석 → 관련 태스크 추정
- 아웃풋: 관련 태스크 목록 + 논의 추천 + [클립보드 복사] 버튼

### LLM 호출 최소화

| 루틴 | LLM 호출 | 빈도 |
|---|---|---|
| 데일리 브리핑 | 1회 | /일 |
| 회의 준비 | 1회 | /회의 |
| 데일리 랩업 | 1회 | /일 |
| 주간 리뷰 | 1회 | /주 |
| 스프린트 회고 | 1회 | /스프린트 |
| WIP 초과/마감 지연 경고 | 0회 (규칙 기반) | 실시간 |

### 데이터 모델

```sql
CREATE TABLE routines (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('daily_briefing','meeting_prep','daily_wrapup','weekly_review','sprint_retro')),
  trigger_type TEXT NOT NULL CHECK(trigger_type IN ('auto','scheduled','manual')),
  trigger_config TEXT,
  enabled INTEGER DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE routine_outputs (
  id TEXT PRIMARY KEY,
  routine_id TEXT NOT NULL REFERENCES routines(id),
  content TEXT NOT NULL,
  source_data TEXT,
  generated_at TEXT NOT NULL
);

CREATE TABLE event_task_links (
  event_id TEXT NOT NULL,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  link_type TEXT NOT NULL CHECK(link_type IN ('manual','auto','ai_suggested')),
  PRIMARY KEY (event_id, task_id)
);
```

### Phase별 진화

| Phase | 범위 |
|---|---|
| **1 (MVP)** | 없음 |
| **2** | 데일리 브리핑 + 회의 준비 + 규칙 기반 알림 |
| **3** | + 데일리 랩업 + 주간 리뷰 + 스프린트 회고 + AI 선제 알림 |

---

## 7. 팀 오더 생성기

PM의 "파악 → 판단 → 지시" 사이클에서 마지막 단계. AI가 칸반 데이터 기반으로 팀원별 지시 문서를 자동 생성한다.

### 오더 유형

| 유형 | 포함 내용 |
|---|---|
| **일간** | 오늘 할 일(우선순위순) + 블로커 확인 + 어제 이월 항목 |
| **주간** | 주 목표 + 일별 계획 + 태스크 목록(우선순위순) + 의존성 + 지난 주 리뷰 |
| **월간/스프린트** | 스프린트 목표 + R&R + 주별 마일스톤 + 기대치 |

### 생성 플로우

```
PM이 오더 생성 요청
├─ 홈 대시보드 [오더 생성] 버튼
├─ 칸반 보드 → 팀원 우클릭 → "오더 생성"
└─ AI Planner 채팅 → "이번 주 팀원 오더 만들어줘"
        ↓
오더 설정 패널
├─ 대상: 전체 팀 / 개별 팀원 선택
├─ 유형: 일간 / 주간 / 월간·스프린트
└─ 추가 지시: 자유 텍스트 (선택)
        ↓
AI 생성 (스트리밍, 구조화 출력)
├─ 입력: 해당 팀원 태스크 + 보드 상태 + PM 추가 지시
└─ 출력: Markdown 문서
        ↓
PM 확인/수정 (미리보기에서 직접 편집)
        ↓
내보내기: 클립보드 복사 / Markdown 파일 / 이력 저장
```

### 내보내기

| Phase | 방식 |
|---|---|
| **3 (MVP)** | 클립보드 복사 (Markdown/Plain Text), Markdown 파일 저장, SQLite 이력 보관 |
| **4** | + Gmail 발송, Slack 전송, 노션 페이지 생성 |

### 데이터 모델

```sql
CREATE TABLE team_orders (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('daily','weekly','monthly','sprint')),
  member_id TEXT REFERENCES members(id),
  board_id TEXT NOT NULL REFERENCES boards(id),
  content TEXT NOT NULL,
  additional_instructions TEXT,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

### Phase별 진화

| Phase | 범위 |
|---|---|
| **1~2** | 없음 |
| **3** | 일간/주간 오더 + 클립보드/Markdown/이력 |
| **4** | + 월간/스프린트 + 이메일/Slack/노션 발송 |

---

## 8. 기능 간 크로스 연동

### 이벤트 버스 (인프라)

```typescript
type AppEvents = {
  'task:updated':      { taskId: string; changes: Partial<Task> };
  'task:moved':        { taskId: string; fromCol: string; toCol: string };
  'task:completed':    { taskId: string };
  'calendar:changed':  { eventId: string; type: 'created' | 'updated' | 'deleted' };
  'deepwork:ended':    { sessionId: string; tasksCompleted: string[] };
  'routine:generated': { routineId: string; type: RoutineType };
};
```

원칙:
- 모듈 간 직접 호출 금지 — 반드시 이벤트 버스를 통해 통신
- 각 연동은 독립적 핸들러 — 하나가 실패해도 나머지 무관
- 비동기 처리 — UI 블로킹 없음

### 연동 목록

| # | 트리거 | 자동 반응 | Phase |
|---|---|---|---|
| 1 | 칸반 태스크에 due_date 설정 | 캘린더에 마커 자동 표시 | **1** |
| 2 | 캘린더 일정 참석자 → 팀원 매칭 | 회의 준비 시 해당 팀원 태스크 수집 | **2** |
| 3 | 칸반 카드 due_date 초과 + status ≠ done | 홈 ④ 지연 경고 | **2** |
| 4 | 컬럼 WIP 제한 초과 | 홈 ④ 알림 + 컬럼 시각적 경고 | **2** |
| 5 | Deep Work 세션 완료 → 태스크 done | 칸반 카드 자동 이동 + 홈 팀 현황 갱신 | **1** |
| 6 | AI 브리핑 생성 | 캘린더 + 칸반 + Deep Work 이력 종합 참조 | **2** |
| 7 | 오더 생성 | 칸반 태스크 + 캘린더 일정 + 지난 오더 이력 참조 | **3** |
| 8 | AI Planner가 태스크 생성 | 칸반에 카드 추가 + 마감일 있으면 캘린더에도 표시 | **1** |
| 9 | 캘린더 일정 변경/삭제 | 연결된 태스크 마감일 동기화 확인 프롬프트 | **2** |
| 10 | 주간 리뷰 루틴 실행 | 완료율을 오더 생성기 "지난 주 리뷰" 섹션에 주입 | **3** |

### 충돌 해소

| 상황 | 방식 |
|---|---|
| 캘린더 vs 칸반 마감일 변경 | last-write-wins (로컬 단독이므로 동시 수정 불가) |
| AI 태스크 생성 vs 수동 생성 | AI 생성은 항상 "제안" 상태 → 사용자 승인 후 확정 |
| Deep Work 중 알림 | 다음 일정만 허용 (15분/5분 전) |

---

## 9. 수정된 Phase 계획

### Phase 1: MVP (8주) — "열면 바로 쓸 수 있다"

| 영역 | 항목 |
|---|---|
| 인프라 | Electron + Next.js 세팅, SQLite + 전체 스키마, IPC 타입 시스템, 이벤트 버스 |
| 캘린더 | Google OAuth, 일/주/월 뷰 조회, 일정 CRUD |
| 칸반 | 보드/컬럼/카드 CRUD, DnD, 담당자 지정, 팀원별 필터, 저장된 필터 뷰 |
| AI Planner | 채팅 UI (사이드 패널), Claude API 스트리밍, WBS→태스크 자동 생성, 대화형 수정 |
| 홈 대시보드 | 오늘 일정 + 오늘 태스크 + 팀원 카드 수 (정적), 정적 환영 메시지 |
| Deep Work | 토글 ON/OFF, "지금 이것만" 화면, 포모도로 타이머, 체크리스트 표시 |
| 크로스 연동 | #1 마감일→캘린더, #5 Deep Work→칸반, #8 AI Planner→칸반+캘린더 |

### Phase 2: AI 두뇌 (4주) — "AI가 PM의 하루를 읽는다"

| 영역 | 항목 |
|---|---|
| Gmail | 이메일 목록 조회, 본문 읽기 |
| 캘린더 | 드래그 앤 드롭, 멀티 캘린더, 데스크톱 알림 |
| 칸반 | 카드 상세 (체크리스트, 코멘트, 라벨), WIP 제한 |
| AI Planner | 태스크 분배 제안, 우선순위/의존성 분석 |
| 홈 대시보드 | AI 브리핑 카드 (자동 생성), 마감 임박 강조, 워크로드 바, 규칙 기반 알림 |
| Deep Work | AI 다음 추천, 자동 태스크 분해, 맥락 보존 |
| 루틴 엔진 | 데일리 브리핑, 회의 준비 브리핑, 규칙 기반 알림 |
| 크로스 연동 | #2 회의↔팀원, #3 지연 경고, #4 WIP 경고, #6 브리핑 종합, #9 일정↔태스크 동기화 |

### Phase 3: PM 코치 (4주) — "AI가 PM 대신 지시한다"

| 영역 | 항목 |
|---|---|
| Gmail | 이메일 작성/답장, 이메일→일정/태스크 변환 |
| 캘린더 | 자연어 빠른 일정 추가 |
| 칸반 | 팀원 현황 대시보드 (워크로드 뷰), 스윔레인 |
| 홈 대시보드 | AI 선제 알림, 오더 생성 버튼, 회의↔태스크 링크 |
| Deep Work | 세션 통계, 집중 리포트, 성취 피드백 |
| 루틴 엔진 | 데일리 랩업, 주간 리뷰, 스프린트 회고 |
| 오더 생성기 | 일간/주간 오더, 클립보드/Markdown/이력 |
| 크로스 연동 | #7 오더↔칸반+캘린더, #10 주간리뷰→오더 |

### Phase 4: 확장 (TBD) — "팀과 연결된다"

| 영역 | 항목 |
|---|---|
| 오더 생성기 | 월간/스프린트 오더, 이메일/Slack/노션 직접 발송 |
| AI Planner | PRD→태스크 변환, 리스크 분석, 다중 LLM 지원 |
| 칸반 | 타임라인(간트) 뷰 |
| 멀티유저 | 팀원 앱 설치 → 데이터 동기화 (LAN/클라우드) |
| 홈 대시보드 | 주간/월간 리포트 뷰 |

---

## 10. 전체 데이터 모델 추가분

기존 PRD 스키마에 다음을 추가한다:

```sql
-- Deep Work 세션
CREATE TABLE deep_work_sessions (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  tasks_completed INTEGER DEFAULT 0,
  total_focus_minutes INTEGER DEFAULT 0,
  context_note TEXT,
  last_task_id TEXT REFERENCES tasks(id),
  last_checklist_item_id TEXT REFERENCES checklist_items(id)
);

-- 루틴 설정
CREATE TABLE routines (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('daily_briefing','meeting_prep','daily_wrapup','weekly_review','sprint_retro')),
  trigger_type TEXT NOT NULL CHECK(trigger_type IN ('auto','scheduled','manual')),
  trigger_config TEXT,
  enabled INTEGER DEFAULT 1,
  created_at TEXT NOT NULL
);

-- 루틴 생성 결과
CREATE TABLE routine_outputs (
  id TEXT PRIMARY KEY,
  routine_id TEXT NOT NULL REFERENCES routines(id),
  content TEXT NOT NULL,
  source_data TEXT,
  generated_at TEXT NOT NULL
);

-- 캘린더 일정 ↔ 태스크 링크
CREATE TABLE event_task_links (
  event_id TEXT NOT NULL,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  link_type TEXT NOT NULL CHECK(link_type IN ('manual','auto','ai_suggested')),
  PRIMARY KEY (event_id, task_id)
);

-- 팀 오더
CREATE TABLE team_orders (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('daily','weekly','monthly','sprint')),
  member_id TEXT REFERENCES members(id),
  board_id TEXT NOT NULL REFERENCES boards(id),
  content TEXT NOT NULL,
  additional_instructions TEXT,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

### 저장된 필터 뷰 (칸반 "페이지화" 재정의)

```sql
CREATE TABLE saved_views (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES boards(id),
  name TEXT NOT NULL,
  filters TEXT NOT NULL,  -- JSON: {"assignees":["id1"],"labels":["bug"],"priority":["high","critical"],"due":"overdue"}
  sort_by TEXT,           -- "priority" | "due_date" | "updated_at"
  created_at TEXT NOT NULL
);
```

### 인덱스 추가

```sql
CREATE INDEX idx_deep_work_started ON deep_work_sessions(started_at);
CREATE INDEX idx_routine_outputs_generated ON routine_outputs(generated_at);
CREATE INDEX idx_routine_outputs_routine ON routine_outputs(routine_id);
CREATE INDEX idx_event_task_links_task ON event_task_links(task_id);
CREATE INDEX idx_team_orders_board_period ON team_orders(board_id, period_start);
CREATE INDEX idx_team_orders_member ON team_orders(member_id);
CREATE INDEX idx_saved_views_board ON saved_views(board_id);
```
