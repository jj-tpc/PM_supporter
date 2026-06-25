# PM Supporter - Product Requirements Document

> **문서 버전:** v0.1.0  
> **최종 수정일:** 2026-06-24  
> **작성자:** jj-tpc  
> **상태:** Draft

---

## 1. 제품 개요

### 1.1 비전

PM 왕초보도 이거면 다 된다 — 프로젝트 매니저를 위한 원스톱 데스크톱 애플리케이션.

### 1.2 문제 정의

PM은 일상적으로 다음 도구들을 오가며 업무를 수행한다:

- **일정 관리**: Google Calendar, Outlook 등
- **이메일/커뮤니케이션**: Gmail, Slack 등
- **작업 관리**: Jira, Notion, Trello 등
- **계획 수립**: 스프레드시트, 문서, 회의

이 도구들이 분산되어 있어 컨텍스트 스위칭 비용이 크고, 특히 신입 PM은 "무엇을 어디서 관리해야 하는지"조차 파악하기 어렵다.

### 1.3 해결 방안

하나의 데스크톱 앱에서 **일정 관리**, **팀 작업 현황 추적**, **LLM 기반 프로젝트 계획 수립**을 통합 제공한다.

### 1.4 타겟 사용자

| 사용자 유형 | 설명 |
|---|---|
| **Primary** | 주니어~미드레벨 PM (1~5년차) |
| **Secondary** | 팀 리드, 시니어 PM |
| **Tertiary** | 팀원 (칸반 보드 참여자) |

---

## 2. 핵심 기능

### Feature 1: 캘린더 & 이메일 허브

Google Calendar와 Gmail을 연동하여 일정 및 메일을 앱 내에서 직접 관리한다.

#### 2.1.1 Google Calendar 연동

**목표:** Google Calendar와 동일한 스펙의 일정 관리를 앱 내에서 제공한다.

| 기능 | 설명 | 우선순위 |
|---|---|---|
| 일정 조회 | 일/주/월 뷰로 캘린더 조회 | P0 |
| 일정 생성 | 제목, 시간, 장소, 참석자, 설명, 반복 설정 포함 일정 생성 | P0 |
| 일정 수정 | 기존 일정의 모든 필드 수정 (단일/반복 일정 개별·전체 수정) | P0 |
| 일정 삭제 | 단일/반복 일정 삭제 (개별·이후 전체·전체) | P0 |
| 드래그 앤 드롭 | 일정을 드래그하여 시간/날짜 변경 | P1 |
| 멀티 캘린더 | 복수 Google 계정 및 캘린더 지원, 캘린더별 색상 구분 | P1 |
| 알림 | 일정 전 알림 (데스크톱 네이티브 알림) | P1 |
| 빠른 일정 추가 | 자연어 입력으로 일정 생성 (예: "내일 오후 2시 팀 미팅") | P2 |

**동기화 방식:**
- Google Calendar API v3 사용
- OAuth 2.0 인증
- 양방향 실시간 동기화 (Push Notification via webhook 또는 주기적 polling)
- 오프라인 시 로컬 캐시 후 온라인 복귀 시 동기화

#### 2.1.2 Gmail 연동

**목표:** PM 업무와 관련된 이메일을 캘린더와 연계하여 확인한다.

| 기능 | 설명 | 우선순위 |
|---|---|---|
| 이메일 목록 조회 | 받은편지함, 라벨별 이메일 목록 조회 | P0 |
| 이메일 본문 읽기 | 개별 이메일 본문 확인 | P0 |
| 이메일 작성/답장/전달 | 기본적인 이메일 송수신 | P1 |
| 이메일 → 일정 변환 | 이메일 내용에서 일정 자동 추출 및 캘린더 등록 | P2 |
| 이메일 → 태스크 변환 | 이메일 내용을 칸반 보드 태스크로 변환 | P2 |

**동기화 방식:**
- Gmail API 사용
- OAuth 2.0 인증 (Calendar와 동일 세션)
- 읽기 중심, 주기적 polling으로 새 메일 확인

---

### Feature 2: 칸반 보드 (팀 작업 현황)

팀원별 작업 현황을 칸반 스타일로 시각화하고 관리한다.

#### 2.2.1 보드 구조

```
┌─────────────────────────────────────────────────────────────────┐
│  프로젝트 A - Sprint 3                              [+ 컬럼 추가] │
├──────────┬──────────┬──────────┬──────────┬──────────┤
│ Backlog  │ To Do    │ In Progress │ Review  │ Done     │
├──────────┼──────────┼──────────┼──────────┼──────────┤
│ [카드]   │ [카드]   │ [카드]      │ [카드]  │ [카드]   │
│ [카드]   │ [카드]   │ [카드]      │         │ [카드]   │
│          │          │             │         │ [카드]   │
└──────────┴──────────┴──────────┴──────────┴──────────┘
```

#### 2.2.2 핵심 기능

| 기능 | 설명 | 우선순위 |
|---|---|---|
| 보드 생성/관리 | 프로젝트별 보드 생성, 이름/설명 설정 | P0 |
| 컬럼 관리 | 컬럼 추가/삭제/순서변경/이름변경, 기본 컬럼 템플릿 제공 | P0 |
| 카드 CRUD | 태스크 카드 생성/조회/수정/삭제 | P0 |
| 드래그 앤 드롭 | 카드를 컬럼 간 이동 (상태 변경) | P0 |
| 담당자 지정 | 카드에 팀원 할당 (복수 가능) | P0 |
| 팀원별 필터 | 특정 팀원의 작업만 필터링하여 조회 | P0 |
| 페이지화/저장 | 보드를 "페이지"로 저장하여 복수의 보드(뷰) 관리 | P0 |
| 카드 상세 | 제목, 설명, 담당자, 우선순위, 마감일, 라벨, 체크리스트, 코멘트 | P1 |
| WIP 제한 | 컬럼별 진행 중 작업 수 제한 설정 | P1 |
| 스윔레인 | 팀원별/우선순위별 가로 구분선 | P2 |

#### 2.2.3 카드(태스크) 데이터 모델

```
Task {
  id: string (UUID)
  title: string
  description: string (Markdown 지원)
  status: string (컬럼에 매핑)
  assignees: string[] (팀원 ID 목록)
  priority: 'critical' | 'high' | 'medium' | 'low'
  labels: string[]
  due_date: datetime | null
  checklist: ChecklistItem[]
  comments: Comment[]
  created_at: datetime
  updated_at: datetime
  created_by: string
  order: number (컬럼 내 정렬 순서)
  board_id: string
}
```

#### 2.2.4 팀원 현황 뷰

칸반 보드와 별도로, **팀원 중심의 대시보드 뷰**를 제공한다:

| 뷰 | 설명 | 우선순위 |
|---|---|---|
| 팀 오버뷰 | 팀원별로 현재 담당 중인 태스크 수와 상태 비율을 한눈에 조회 | P0 |
| 개인 워크로드 | 특정 팀원 클릭 시 해당 팀원의 전체 태스크 목록 및 진행 상태 | P1 |
| 타임라인 뷰 | 간트 차트 스타일로 팀원별 작업 일정 시각화 | P2 |

---

### Feature 3: LLM 기반 프로젝트 플래너 (AI Planner)

TaskMaster의 개념을 차용/활용하여, LLM이 프로젝트 계획 수립부터 태스크 분배까지 지원한다.

#### 2.3.1 핵심 컨셉

```
사용자 입력 (프로젝트 설명, 목표, 제약조건)
        ↓
   LLM 분석 & 계획 수립
        ↓
   태스크 트리 자동 생성
        ↓
   칸반 보드에 자동 배치
        ↓
   팀원에게 자동/수동 분배
```

#### 2.3.2 기능 목록

| 기능 | 설명 | 우선순위 |
|---|---|---|
| 프로젝트 초기 세팅 | 프로젝트 설명을 입력하면 LLM이 WBS(Work Breakdown Structure) 자동 생성 | P0 |
| 태스크 자동 생성 | WBS 기반으로 칸반 보드에 태스크 카드 자동 생성 | P0 |
| 태스크 디테일 생성 | 각 태스크의 설명, 수용 기준(Acceptance Criteria), 체크리스트를 LLM이 작성 | P0 |
| 태스크 분배 제안 | 팀원 역할/스킬 정보 기반으로 담당자 배정 추천 | P1 |
| 우선순위/의존성 설정 | 태스크 간 의존관계와 우선순위를 LLM이 분석하여 제안 | P1 |
| 일정 추정 | 각 태스크의 소요 시간 추정 및 전체 프로젝트 타임라인 산출 | P1 |
| 계획 수정 대화 | 생성된 계획에 대해 자연어로 수정 요청 (예: "백엔드 태스크를 더 세분화해줘") | P0 |
| PRD → 태스크 변환 | PRD/기획문서를 입력하면 태스크로 변환 | P2 |
| 리스크 분석 | 프로젝트 계획의 잠재적 리스크를 LLM이 식별하고 대응 방안 제안 | P2 |
| 회고 지원 | 스프린트/프로젝트 완료 후 진행 데이터 기반 회고 리포트 생성 | P2 |

#### 2.3.3 LLM 인터랙션 모델

**채팅 인터페이스** 형태로 제공한다:

```
┌──────────────────────────────────────────┐
│ AI Planner                               │
├──────────────────────────────────────────┤
│ [AI] 프로젝트에 대해 설명해주세요.         │
│                                          │
│ [User] 3개월 내에 모바일 앱을 만들 건데,   │
│ 프론트 2명, 백엔드 1명, 디자이너 1명이야.  │
│                                          │
│ [AI] 분석 결과, 다음과 같은 WBS를          │
│ 제안합니다:                               │
│                                          │
│ Phase 1: 기획 & 디자인 (2주)              │
│   ├─ 요구사항 정의 [PM]                   │
│   ├─ 와이어프레임 [디자이너]               │
│   └─ 기술 스택 결정 [백엔드]              │
│ Phase 2: 개발 (8주)                      │
│   ├─ API 설계 [백엔드]                    │
│   ├─ UI 구현 [프론트 2명]                 │
│   └─ ...                                 │
│                                          │
│ [이 계획을 보드에 적용] [수정 요청]         │
├──────────────────────────────────────────┤
│ 입력: ____________________________  [전송] │
└──────────────────────────────────────────┘
```

#### 2.3.4 LLM 연동 방식

| 항목 | 상세 |
|---|---|
| 모델 | Claude API (Anthropic) — 기본 모델, 추후 다중 모델 지원 고려 |
| 호출 방식 | 백엔드(메인 프로세스)에서 API 직접 호출 |
| 컨텍스트 관리 | 프로젝트 정보, 팀 구성, 기존 태스크를 컨텍스트로 포함 |
| 프롬프트 관리 | 기능별 시스템 프롬프트 템플릿 분리 관리 |
| 스트리밍 | 응답 스트리밍으로 실시간 출력 |

---

## 3. 기술 스택

| 영역 | 기술 | 비고 |
|---|---|---|
| **프레임워크** | Electron + Next.js | 데스크톱 네이티브 앱 |
| **언어** | TypeScript | 전체 코드베이스 |
| **UI** | React + Tailwind CSS | 컴포넌트 기반 UI |
| **상태 관리** | Zustand | 경량 상태 관리 |
| **로컬 DB** | SQLite (via better-sqlite3) | 오프라인 데이터 저장 |
| **Google API** | googleapis (npm) | Calendar API v3, Gmail API |
| **인증** | OAuth 2.0 (Google) | 토큰 로컬 저장 |
| **LLM** | Anthropic Claude API | AI Planner 기능 |
| **드래그앤드롭** | @dnd-kit | 칸반 보드 DnD |
| **테스트** | Vitest + Playwright | 유닛/E2E |
| **빌드/패키징** | electron-builder | 크로스 플랫폼 배포 |

---

## 4. 아키텍처 개요

```
┌──────────────────────────────────────────────────────┐
│                  Electron App                         │
│                                                      │
│  ┌─────────────────────┐  ┌───────────────────────┐  │
│  │   Renderer Process  │  │    Main Process        │  │
│  │   (Next.js + React) │  │                        │  │
│  │                     │  │  ┌──────────────────┐  │  │
│  │  ┌───────────────┐  │  │  │ Google API Client│  │  │
│  │  │ Calendar View │  │  │  │ (OAuth, Calendar,│  │  │
│  │  │               │  │  │  │  Gmail)          │  │  │
│  │  ├───────────────┤  │  │  └──────────────────┘  │  │
│  │  │ Kanban Board  │  │  │                        │  │
│  │  │               │◄─┼──┤  ┌──────────────────┐  │  │
│  │  ├───────────────┤  │  │  │ LLM Service      │  │  │
│  │  │ AI Planner    │  │  │  │ (Claude API)     │  │  │
│  │  │ (Chat UI)     │  │  │  └──────────────────┘  │  │
│  │  └───────────────┘  │  │                        │  │
│  │                     │  │  ┌──────────────────┐  │  │
│  │  Zustand Store      │  │  │ SQLite DB        │  │  │
│  │                     │  │  │ (로컬 데이터)      │  │  │
│  └─────────────────────┘  │  └──────────────────┘  │  │
│         IPC Bridge        │                        │  │
│  ◄───────────────────────►│                        │  │
└──────────────────────────────────────────────────────┘
```

**핵심 원칙:**
- **Main Process**: Google API 호출, LLM API 호출, SQLite 접근 등 모든 I/O와 민감 데이터 처리
- **Renderer Process**: UI 렌더링과 사용자 인터랙션만 담당
- **IPC Bridge**: Main ↔ Renderer 간 타입 안전한 통신 채널

---

## 5. 데이터 모델 개요

### 5.1 로컬 DB 스키마 (SQLite)

```sql
-- 프로젝트/보드
CREATE TABLE boards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 컬럼
CREATE TABLE columns (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES boards(id),
  name TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  wip_limit INTEGER
);

-- 태스크 카드
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES boards(id),
  column_id TEXT NOT NULL REFERENCES columns(id),
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT CHECK(priority IN ('critical','high','medium','low')),
  due_date TEXT,
  "order" INTEGER NOT NULL,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 팀원
CREATE TABLE members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT,
  avatar_url TEXT
);

-- 태스크-담당자 매핑
CREATE TABLE task_assignees (
  task_id TEXT NOT NULL REFERENCES tasks(id),
  member_id TEXT NOT NULL REFERENCES members(id),
  PRIMARY KEY (task_id, member_id)
);

-- 라벨
CREATE TABLE labels (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES boards(id),
  name TEXT NOT NULL,
  color TEXT NOT NULL
);

-- 태스크-라벨 매핑
CREATE TABLE task_labels (
  task_id TEXT NOT NULL REFERENCES tasks(id),
  label_id TEXT NOT NULL REFERENCES labels(id),
  PRIMARY KEY (task_id, label_id)
);

-- 체크리스트
CREATE TABLE checklist_items (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  text TEXT NOT NULL,
  is_checked INTEGER NOT NULL DEFAULT 0,
  "order" INTEGER NOT NULL
);

-- 코멘트
CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  author_id TEXT NOT NULL REFERENCES members(id),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- AI Planner 대화 기록
CREATE TABLE planner_sessions (
  id TEXT PRIMARY KEY,
  board_id TEXT REFERENCES boards(id),
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE planner_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES planner_sessions(id),
  role TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Google 계정 연동 정보
CREATE TABLE google_accounts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TEXT NOT NULL,
  calendars_synced TEXT  -- JSON array of calendar IDs
);

-- 캘린더 이벤트 로컬 캐시
CREATE TABLE calendar_events_cache (
  id TEXT PRIMARY KEY,           -- Google event ID
  account_id TEXT NOT NULL REFERENCES google_accounts(id),
  calendar_id TEXT NOT NULL,
  summary TEXT,
  description TEXT,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  location TEXT,
  attendees TEXT,                -- JSON
  recurrence TEXT,               -- JSON
  raw_data TEXT NOT NULL,        -- 원본 Google API 응답 JSON
  synced_at TEXT NOT NULL
);
```

---

## 6. 사용자 시나리오

### 시나리오 1: 프로젝트 시작

1. PM이 앱을 열고 "새 프로젝트" 생성
2. AI Planner 채팅에서 프로젝트 개요 입력: "B2B SaaS 대시보드 개발, 프론트 3명 백엔드 2명, 3개월"
3. LLM이 WBS 생성 → PM이 확인/수정
4. "보드에 적용" 클릭 → 칸반 보드에 태스크 카드 자동 생성
5. 각 태스크에 담당자 배정 (LLM 추천 기반)

### 시나리오 2: 일상 업무

1. PM이 앱을 열면 오늘의 캘린더 일정이 사이드바에 표시
2. 칸반 보드에서 팀원별 진행 상황 확인
3. "In Progress" 컬럼에 있는 카드 클릭 → 상세 내용 확인/코멘트 추가
4. 새로운 이메일 알림 → 이메일 내용을 태스크로 변환

### 시나리오 3: 주간 리뷰

1. 팀 오버뷰에서 전체 팀원 워크로드 확인
2. 특정 팀원 클릭 → 해당 팀원의 태스크가 지연 중인 것 확인
3. AI Planner에 "백엔드 일정이 2주 밀렸는데 대안은?" 질문
4. LLM이 리소스 재배분 또는 스코프 축소 방안 제안

---

## 7. 마일스톤

### Phase 1: MVP (8주)

**목표:** 핵심 기능의 최소 동작 버전

- [ ] Electron + Next.js 보일러플레이트 세팅
- [ ] SQLite 로컬 DB 세팅 및 기본 스키마
- [ ] Google OAuth 인증 플로우
- [ ] Google Calendar 일/주/월 뷰 조회
- [ ] Google Calendar 일정 CRUD
- [ ] 칸반 보드 기본 기능 (보드/컬럼/카드 CRUD, DnD)
- [ ] 팀원 관리 및 담당자 지정
- [ ] AI Planner 채팅 UI + Claude API 연동
- [ ] AI Planner 프로젝트 세팅 → 태스크 자동 생성 플로우

### Phase 2: 연동 강화 (4주)

- [ ] Gmail 연동 (목록 조회, 본문 읽기)
- [ ] 캘린더 드래그 앤 드롭
- [ ] 멀티 캘린더 지원
- [ ] 카드 상세 (체크리스트, 코멘트, 라벨)
- [ ] AI 태스크 분배 제안
- [ ] AI 우선순위/의존성 분석

### Phase 3: 고도화 (4주)

- [ ] 데스크톱 알림
- [ ] 팀원 현황 대시보드 (워크로드 뷰)
- [ ] 이메일 작성/답장
- [ ] 빠른 일정 추가 (자연어)
- [ ] 이메일 → 일정/태스크 변환
- [ ] 타임라인(간트 차트) 뷰

### Phase 4: 확장 (TBD)

- [ ] PRD → 태스크 자동 변환
- [ ] 리스크 분석
- [ ] 회고 리포트 생성
- [ ] 다중 LLM 모델 지원
- [ ] 팀 협업 (로컬 네트워크 또는 클라우드 동기화)

---

## 8. 비기능 요구사항

| 항목 | 요구사항 |
|---|---|
| **성능** | 앱 시작 3초 이내, 보드 전환 500ms 이내 |
| **오프라인** | 칸반 보드와 캐시된 캘린더 데이터는 오프라인에서 동작, 온라인 복귀 시 자동 동기화 |
| **보안** | API 키와 OAuth 토큰은 OS keychain에 저장 (electron-keytar 또는 safeStorage), 로컬 DB 암호화 |
| **플랫폼** | Windows 우선 (macOS, Linux 추후 지원) |
| **접근성** | 키보드 내비게이션 지원, 충분한 색상 대비 |
| **데이터** | 모든 데이터 로컬 우선 저장, 사용자 데이터가 외부 서버에 저장되지 않음 (LLM API 호출 제외) |

---

## 9. 제약사항 및 의존성

| 항목 | 상세 |
|---|---|
| Google API 할당량 | Calendar API: 1,000,000 쿼리/일, Gmail API: 250 쿼리/유저/초 |
| Anthropic API 비용 | Claude API 호출 비용 발생 — 사용자가 자체 API 키를 입력하는 방식 |
| Electron 보안 | `contextIsolation: true`, `nodeIntegration: false` 필수 |
| 라이선스 | AGPL-3.0 — 모든 기여 코드에 동일 라이선스 적용 |

---

## 10. 성공 지표

| 지표 | 목표 |
|---|---|
| MVP 완성 | Phase 1 기능 전체 동작 |
| 일정 동기화 정합성 | Google Calendar ↔ 앱 간 데이터 불일치 0건 |
| AI 태스크 생성 정확도 | LLM 생성 태스크의 80% 이상이 수정 없이 사용 가능 |
| 앱 안정성 | 크래시 없이 8시간 연속 사용 가능 |

---

## 부록 A: 용어 정리

| 용어 | 설명 |
|---|---|
| **보드(Board)** | 하나의 프로젝트에 대응하는 칸반 보드 |
| **컬럼(Column)** | 작업 단계를 나타내는 세로 열 (예: To Do, In Progress, Done) |
| **카드(Card/Task)** | 개별 작업 항목 |
| **페이지(Page)** | 저장된 보드 뷰 — 같은 프로젝트에 대해 여러 필터/뷰를 저장 |
| **WBS** | Work Breakdown Structure — 프로젝트를 계층적으로 분해한 구조 |
| **WIP 제한** | Work In Progress Limit — 동시에 진행 가능한 작업 수 제한 |
| **스윔레인** | 칸반 보드의 가로 구분선 (팀원별, 우선순위별 등) |
