// shared/types.ts

// ============================================================
// 앱 고유 용어 체계 (여정×건축 메타포)
// 내부 코드에서도 이 용어를 사용한다.
// ============================================================

/** 스텝 = 태스크. 프로젝트의 한 걸음. */
export interface Step {
  id: string;
  buildId: string;
  phaseId: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  dueDate: string | null;
  order: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 빌드 = 프로젝트/보드. 짓고 있는 것. */
export interface Build {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

/** 페이즈 = 컬럼/작업 단계. */
export interface Phase {
  id: string;
  buildId: string;
  name: string;
  order: number;
  wipLimit: number | null;
}

/** 크루 = 팀원. */
export interface Crew {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
  avatarUrl: string | null;
}

/** 뷰포인트 = 저장된 필터 뷰. */
export interface Viewpoint {
  id: string;
  buildId: string;
  name: string;
  filters: ViewpointFilters;
  sortBy: 'priority' | 'due_date' | 'updated_at' | null;
  createdAt: string;
}

export interface ViewpointFilters {
  assignees?: string[];
  labels?: string[];
  priority?: Step['priority'][];
  due?: 'overdue' | 'today' | 'this_week' | null;
}

/** 라벨 */
export interface Label {
  id: string;
  buildId: string;
  name: string;
  color: string;
}

/** 체크리스트 아이템 */
export interface ChecklistItem {
  id: string;
  stepId: string;
  text: string;
  isChecked: boolean;
  order: number;
}

/** 코멘트 */
export interface Comment {
  id: string;
  stepId: string;
  authorId: string;
  content: string;
  createdAt: string;
}

/** Deep Work 세션 */
export interface DeepWorkSession {
  id: string;
  startedAt: string;
  endedAt: string | null;
  tasksCompleted: number;
  totalFocusMinutes: number;
  contextNote: string | null;
  lastStepId: string | null;
  lastChecklistItemId: string | null;
}

/** 가이드 = 팀 오더/지시 */
export interface Guide {
  id: string;
  type: 'daily' | 'weekly' | 'monthly' | 'sprint';
  crewId: string | null;
  buildId: string;
  content: string;
  additionalInstructions: string | null;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
}

/** 휴지통 아이템 */
export interface DeletedItem {
  id: string;
  itemType: 'step' | 'build' | 'phase' | 'crew' | 'batch';
  itemId: string;
  itemData: string; // JSON
  batchId: string | null;
  deletedAt: string;
  expiresAt: string;
}

/** 이벤트 버스 이벤트 타입 */
export type AppEvents = {
  'step:updated': { stepId: string; changes: Partial<Step> };
  'step:moved': { stepId: string; fromPhase: string; toPhase: string };
  'step:completed': { stepId: string };
  'step:deleted': { stepId: string };
  'build:created': { buildId: string };
  'calendar:changed': { eventId: string; type: 'created' | 'updated' | 'deleted' };
  'deepwork:started': { sessionId: string };
  'deepwork:ended': { sessionId: string; stepsCompleted: string[] };
  'routine:generated': { routineId: string; type: string };
  'sync:status': { status: 'synced' | 'syncing' | 'offline' | 'error' };
};

/** 앱 설정 */
export interface AppSettings {
  deepWork: {
    fullscreen: boolean;
    darkMode: boolean;
    focusAssist: boolean;
    ambientSound: boolean;
    pomodoroMinutes: number;
  };
  notifications: {
    urgentEnabled: boolean;
    normalBatchMinutes: number;
    infoEnabled: boolean;
  };
}

/** Google Calendar 이벤트 (로컬 캐시 형태) */
export interface CalendarEvent {
  id: string;
  accountId: string;
  calendarId: string;
  summary: string;
  description: string;
  startTime: string;
  endTime: string;
  location: string;
  attendees: string;
  recurrence: string;
  rawData: string;
  syncedAt: string;
}

/** Google 계정 */
export interface GoogleAccount {
  id: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiry: string;
  calendarsSynced: string | null;
}

/** 캘린더 뷰 타입 */
export type CalendarViewType = 'day' | 'week' | 'month';

/** 캘린더 뷰 날짜 범위 */
export interface DateRange {
  start: string;
  end: string;
}

/** 온보딩 체크리스트 상태 */
export interface OnboardingState {
  buildCreated: boolean;
  crewAdded: boolean;
  stepCreated: boolean;
  googleConnected: boolean;
  deepWorkTried: boolean;
  aiUsed: boolean;
  completedAt: string | null;
}

/** 대시보드 데이터 */
export interface DashboardData {
  todayEvents: CalendarEvent[];
  todaySteps: Array<{ step: Step; buildName: string }>;
  crewWorkload: Array<{ crewId: string; crewName: string; total: number; done: number; inProgress: number; overdue: number }>;
  onboarding: OnboardingState;
}

/** AI 채팅 메시지 */
export interface PlannerMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
}

/** AI 채팅 세션 */
export interface PlannerSession {
  id: string;
  buildId: string | null;
  title: string;
  createdAt: string;
  updatedAt: string;
}

/** AI 구조화 출력: 로드맵 */
export interface AIRoadmap {
  phases: AIRoadmapPhase[];
}

export interface AIRoadmapPhase {
  name: string;
  durationWeeks?: number;
  steps: AIRoadmapStep[];
}

export interface AIRoadmapStep {
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  estimatedHours?: number;
  suggestedRole?: string;
}
