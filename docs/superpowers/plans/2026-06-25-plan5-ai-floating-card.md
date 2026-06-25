# Plan 5: AI Floating Card — 정육각형 버튼 + 플로팅 AI 카드 + Claude API

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 좌하단 정육각형 버튼 클릭 시 플로팅 AI 카드가 올라오고, Claude API와 스트리밍 대화를 하며, 구조화된 결과(로드맵, 스텝 목록)를 빌드에 적용할 수 있게 한다.

**Architecture:** Main process에서 Anthropic SDK로 Claude API를 호출하고, 스트리밍 응답을 IPC로 Renderer에 전달한다. 대화 이력은 SQLite planner_sessions/planner_messages에 저장한다. 플로팅 카드는 Shell.tsx 레벨에서 관리하여 모든 페이지에서 접근 가능하다.

**Tech Stack:** @anthropic-ai/sdk, React 19, Zustand, Tailwind CSS 4, IPC (기존)

**Dependencies:** Plan 1~2 완료 필수 (SQLite, IPC, Zustand, 칸반)

---

## File Structure

```
main/
├── ai/
│   ├── claude-client.ts            # Anthropic SDK 래퍼
│   └── prompts.ts                  # 시스템 프롬프트 템플릿
├── ipc/
│   ├── channels.ts                 # (수정) AI 채널 추가
│   └── register.ts                 # (수정) AI 핸들러 추가
└── db/
    └── statements.ts               # (수정) planner statements 추가
renderer/
├── components/
│   ├── layout/
│   │   └── Shell.tsx               # (수정) 정육각형 버튼 → 플로팅 카드 연동
│   └── ai/
│       ├── FloatingCard.tsx         # 플로팅 AI 카드 컨테이너
│       ├── ChatMessage.tsx          # 메시지 버블 (user/assistant)
│       ├── StructuredResult.tsx     # 구조화된 결과 카드 (로드맵, 스텝 목록)
│       └── ChatInput.tsx           # 입력 영역
├── hooks/
│   └── use-ai-chat.ts             # AI 채팅 hook (스트리밍 + 이력)
└── stores/
    └── app-store.ts               # (수정) AI 상태 추가
shared/
└── types.ts                       # (수정) AI 관련 타입 추가
```

---

### Task 1: Anthropic SDK + AI 타입 + IPC 채널 + DB statements

**Files:**
- Modify: `shared/types.ts`
- Modify: `main/ipc/channels.ts`
- Modify: `main/db/statements.ts`

- [ ] **Step 1: Anthropic SDK 설치**

```bash
cd /c/Users/twoja/project_tpc/PM_supporter
pnpm add @anthropic-ai/sdk
```

- [ ] **Step 2: AI 타입 추가**

`shared/types.ts`에 추가:

```typescript
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
```

- [ ] **Step 3: IPC 채널 추가**

`main/ipc/channels.ts`에 추가 (import에 PlannerSession, PlannerMessage 추가):

```typescript
  // === AI Chat ===
  'ai:createSession': { args: [{ buildId?: string; title: string }]; return: PlannerSession };
  'ai:listSessions': { args: []; return: PlannerSession[] };
  'ai:getMessages': { args: [string]; return: PlannerMessage[] };  // sessionId
  'ai:sendMessage': { args: [{ sessionId: string; content: string }]; return: void };  // response comes via IPC event stream
  'ai:getApiKeyStatus': { args: []; return: { configured: boolean } };
```

- [ ] **Step 4: Planner DB statements 추가**

`main/db/statements.ts`에 추가:

```typescript
    // Planner sessions
    listPlannerSessions: db.prepare('SELECT * FROM planner_sessions ORDER BY updated_at DESC'),
    getPlannerSession: db.prepare('SELECT * FROM planner_sessions WHERE id = ?'),
    insertPlannerSession: db.prepare(
      'INSERT INTO planner_sessions (id, build_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    ),
    updatePlannerSession: db.prepare(
      'UPDATE planner_sessions SET title = ?, updated_at = ? WHERE id = ?'
    ),

    // Planner messages
    listPlannerMessages: db.prepare(
      'SELECT * FROM planner_messages WHERE session_id = ? ORDER BY created_at'
    ),
    insertPlannerMessage: db.prepare(
      'INSERT INTO planner_messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)'
    ),
```

- [ ] **Step 5: 커밋**

```bash
git add shared/types.ts main/ipc/channels.ts main/db/statements.ts package.json pnpm-lock.yaml
git commit -m "feat: Anthropic SDK, AI chat types, IPC channels, planner DB statements"
```

---

### Task 2: Claude API 클라이언트 + 시스템 프롬프트

**Files:**
- Create: `main/ai/claude-client.ts`
- Create: `main/ai/prompts.ts`

- [ ] **Step 1: 시스템 프롬프트 템플릿**

```typescript
// main/ai/prompts.ts

export const PLANNER_SYSTEM_PROMPT = `당신은 PM Supporter 앱의 AI 비서입니다. PM이 프로젝트를 계획하고 관리하는 것을 돕습니다.

## 역할
- 프로젝트 설명을 받으면 로드맵(WBS)을 생성합니다
- 기존 빌드의 스텝을 분석하고 개선안을 제안합니다
- PM의 질문에 전문적이고 실용적으로 답합니다

## 용어
이 앱에서는 고유 용어를 사용합니다:
- 스텝(Step) = 태스크
- 빌드(Build) = 프로젝트/보드
- 페이즈(Phase) = 작업 단계 (컬럼)
- 크루(Crew) = 팀원
- 로드맵(Roadmap) = WBS
- 가이드(Guide) = 팀 지시/오더
- 스테이지(Stage) = 스프린트
- 체크포인트(Checkpoint) = 마일스톤

## 응답 규칙
- 한국어로 답합니다
- 간결하고 구조적으로 답합니다
- 로드맵 생성 시 JSON 블록을 포함합니다 (아래 형식)
- 불필요한 인사말이나 부연 없이 바로 본론으로 들어갑니다

## 로드맵 JSON 형식
로드맵을 생성할 때는 반드시 아래 형식의 JSON을 \`\`\`json 블록으로 포함하세요:

\`\`\`json
{
  "type": "roadmap",
  "phases": [
    {
      "name": "페이즈 이름",
      "durationWeeks": 2,
      "steps": [
        {
          "title": "스텝 제목",
          "description": "스텝 설명",
          "priority": "high",
          "estimatedHours": 8,
          "suggestedRole": "프론트엔드"
        }
      ]
    }
  ]
}
\`\`\`
`;

export function buildContextPrompt(context: {
  buildName?: string;
  phases?: { name: string; stepCount: number }[];
  crewMembers?: { name: string; role: string }[];
}): string {
  const parts: string[] = [];

  if (context.buildName) {
    parts.push(`현재 빌드: ${context.buildName}`);
  }

  if (context.phases?.length) {
    parts.push(`페이즈: ${context.phases.map(p => `${p.name}(${p.stepCount}개 스텝)`).join(', ')}`);
  }

  if (context.crewMembers?.length) {
    parts.push(`크루: ${context.crewMembers.map(c => `${c.name}(${c.role})`).join(', ')}`);
  }

  return parts.length > 0 ? `\n\n## 현재 프로젝트 컨텍스트\n${parts.join('\n')}` : '';
}
```

- [ ] **Step 2: Claude API 클라이언트**

```typescript
// main/ai/claude-client.ts
import Anthropic from '@anthropic-ai/sdk';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
    client = new Anthropic({ apiKey });
  }
  return client;
}

export function isApiKeyConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export async function* streamChat(
  systemPrompt: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
): AsyncGenerator<string, void, unknown> {
  const anthropic = getClient();

  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 16000,
    system: [{
      type: 'text',
      text: systemPrompt,
      cache_control: { type: 'ephemeral' },
    }],
    messages,
    thinking: { type: 'adaptive' },
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      yield event.delta.text;
    }
  }
}
```

- [ ] **Step 3: 커밋**

```bash
git add main/ai/
git commit -m "feat: Claude API client with streaming and PM system prompt"
```

---

### Task 3: AI IPC 핸들러 (스트리밍)

**Files:**
- Modify: `main/ipc/register.ts`
- Modify: `main/main.ts` — mainWindow 참조 전달

- [ ] **Step 1: AI 핸들러 추가**

`main/ipc/register.ts` — RegisterDeps에 `mainWindow: Electron.BrowserWindow | null` 추가. 그리고 AI 핸들러:

```typescript
  // === AI Chat ===
  handle('ai:getApiKeyStatus', () => {
    const { isApiKeyConfigured } = require('../ai/claude-client');
    return { configured: isApiKeyConfigured() };
  });

  handle('ai:createSession', ({ buildId, title }) => {
    const id = uuid();
    const ts = now();
    stmts.insertPlannerSession.run(id, buildId ?? null, title, ts, ts);
    return stmts.getPlannerSession.get(id);
  });

  handle('ai:listSessions', () => stmts.listPlannerSessions.all());

  handle('ai:getMessages', (sessionId) => stmts.listPlannerMessages.all(sessionId));

  handle('ai:sendMessage', async ({ sessionId, content }) => {
    const msgId = uuid();
    const ts = now();

    // Save user message
    stmts.insertPlannerMessage.run(msgId, sessionId, 'user', content, ts);

    // Get conversation history
    const history = (stmts.listPlannerMessages.all(sessionId) as any[])
      .filter((m: any) => m.role !== 'system')
      .map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    // Build context
    const session = stmts.getPlannerSession.get(sessionId) as any;
    let contextPrompt = '';
    if (session?.build_id) {
      const build = stmts.getBuild.get(session.build_id) as any;
      const phases = (stmts.listPhases.all(session.build_id) as any[]).map((p: any) => ({
        name: p.name,
        stepCount: (stmts.listStepsByPhase.all(p.id) as any[]).length,
      }));
      const crews = (stmts.listCrews.all() as any[]).map((c: any) => ({
        name: c.name, role: c.role ?? '미지정',
      }));
      const { buildContextPrompt } = await import('../ai/prompts');
      contextPrompt = buildContextPrompt({
        buildName: build?.name,
        phases,
        crewMembers: crews,
      });
    }

    // Stream response
    const { PLANNER_SYSTEM_PROMPT } = await import('../ai/prompts');
    const { streamChat } = await import('../ai/claude-client');

    let fullResponse = '';
    try {
      for await (const chunk of streamChat(PLANNER_SYSTEM_PROMPT + contextPrompt, history)) {
        fullResponse += chunk;
        // Stream chunk to renderer
        if (deps.mainWindow) {
          deps.mainWindow.webContents.send('ai:stream', { sessionId, chunk });
        }
      }
    } catch (err: any) {
      fullResponse = `[AI 오류] ${err.message ?? '응답을 생성할 수 없습니다.'}`;
      if (deps.mainWindow) {
        deps.mainWindow.webContents.send('ai:stream', { sessionId, chunk: fullResponse });
      }
    }

    // Save assistant message
    const assistantMsgId = uuid();
    stmts.insertPlannerMessage.run(assistantMsgId, sessionId, 'assistant', fullResponse, now());

    // Signal completion
    if (deps.mainWindow) {
      deps.mainWindow.webContents.send('ai:streamEnd', { sessionId });
    }

    // Update session timestamp
    stmts.updatePlannerSession.run(
      (stmts.getPlannerSession.get(sessionId) as any)?.title ?? 'AI 대화',
      now(),
      sessionId
    );
  });
```

IMPORTANT: `deps` needs to be accessible — destructure from the function parameter or make deps a variable in scope.

Also add `mainWindow` to the RegisterDeps interface:

```typescript
interface RegisterDeps {
  // ... existing
  mainWindow: Electron.BrowserWindow | null;
}
```

- [ ] **Step 2: main.ts — mainWindow 전달**

`main/main.ts`에서 `registerIpcHandlers` 호출 시 `mainWindow`를 전달:

```typescript
registerIpcHandlers({ db, stmts, trash, bus, googleAuth, calendarSync, mainWindow });
```

- [ ] **Step 3: 커밋**

```bash
git add main/ipc/register.ts main/main.ts
git commit -m "feat: AI chat IPC handlers with Claude streaming"
```

---

### Task 4: Renderer — AI 상태 + 채팅 hook

**Files:**
- Modify: `renderer/stores/app-store.ts`
- Create: `renderer/hooks/use-ai-chat.ts`

- [ ] **Step 1: Zustand AI 상태 추가**

`renderer/stores/app-store.ts`에 추가:

```typescript
// State
aiCardOpen: boolean;
aiSessionId: string | null;
aiMessages: PlannerMessage[];
aiStreaming: boolean;
aiStreamBuffer: string;

// Actions
setAiCardOpen: (open: boolean) => void;
setAiSessionId: (id: string | null) => void;
setAiMessages: (messages: PlannerMessage[]) => void;
addAiMessage: (message: PlannerMessage) => void;
setAiStreaming: (streaming: boolean) => void;
appendAiStreamBuffer: (chunk: string) => void;
clearAiStreamBuffer: () => void;
```

Import PlannerMessage from shared/types.

Default values: aiCardOpen false, aiSessionId null, aiMessages [], aiStreaming false, aiStreamBuffer ''.

- [ ] **Step 2: use-ai-chat hook**

```typescript
// renderer/hooks/use-ai-chat.ts
import { useEffect, useCallback } from 'react';
import { useAppStore } from '../stores/app-store';
import { ipc, events } from '../lib/ipc-client';
import type { PlannerMessage } from '../../shared/types';

export function useAiChat() {
  const {
    aiCardOpen, aiSessionId, aiMessages, aiStreaming, aiStreamBuffer,
    setAiCardOpen, setAiSessionId, setAiMessages, addAiMessage,
    setAiStreaming, appendAiStreamBuffer, clearAiStreamBuffer,
  } = useAppStore();

  // Listen for streaming events
  useEffect(() => {
    const offStream = events.on('ai:stream', (data: { sessionId: string; chunk: string }) => {
      if (data.sessionId === aiSessionId) {
        appendAiStreamBuffer(data.chunk);
      }
    });

    const offEnd = events.on('ai:streamEnd', (data: { sessionId: string }) => {
      if (data.sessionId === aiSessionId) {
        setAiStreaming(false);
        // Reload messages to get the saved assistant message
        if (aiSessionId) {
          ipc['ai:getMessages'](aiSessionId).then(setAiMessages);
        }
        clearAiStreamBuffer();
      }
    });

    return () => { offStream(); offEnd(); };
  }, [aiSessionId, appendAiStreamBuffer, clearAiStreamBuffer, setAiStreaming, setAiMessages]);

  const open = useCallback(async () => {
    setAiCardOpen(true);
    if (!aiSessionId) {
      const session = await ipc['ai:createSession']({ title: 'AI 대화' });
      setAiSessionId(session.id);
      setAiMessages([]);
    }
  }, [aiSessionId, setAiCardOpen, setAiSessionId, setAiMessages]);

  const close = useCallback(() => {
    setAiCardOpen(false);
  }, [setAiCardOpen]);

  const send = useCallback(async (content: string) => {
    if (!aiSessionId || !content.trim()) return;

    // Optimistic: add user message to UI
    const tempMsg: PlannerMessage = {
      id: `temp-${Date.now()}`,
      sessionId: aiSessionId,
      role: 'user',
      content: content.trim(),
      createdAt: new Date().toISOString(),
    };
    addAiMessage(tempMsg);
    setAiStreaming(true);
    clearAiStreamBuffer();

    // Send to main process
    await ipc['ai:sendMessage']({ sessionId: aiSessionId, content: content.trim() });
  }, [aiSessionId, addAiMessage, setAiStreaming, clearAiStreamBuffer]);

  const newSession = useCallback(async (buildId?: string) => {
    const session = await ipc['ai:createSession']({ buildId, title: 'AI 대화' });
    setAiSessionId(session.id);
    setAiMessages([]);
    setAiCardOpen(true);
  }, [setAiSessionId, setAiMessages, setAiCardOpen]);

  return {
    isOpen: aiCardOpen,
    messages: aiMessages,
    streaming: aiStreaming,
    streamBuffer: aiStreamBuffer,
    open, close, send, newSession,
  };
}
```

- [ ] **Step 3: 커밋**

```bash
git add renderer/stores/app-store.ts renderer/hooks/use-ai-chat.ts
git commit -m "feat: AI chat Zustand state and streaming hook"
```

---

### Task 5: Renderer — 플로팅 카드 UI 컴포넌트

**Files:**
- Create: `renderer/components/ai/ChatMessage.tsx`
- Create: `renderer/components/ai/StructuredResult.tsx`
- Create: `renderer/components/ai/ChatInput.tsx`
- Create: `renderer/components/ai/FloatingCard.tsx`
- Modify: `renderer/components/layout/Shell.tsx`

- [ ] **Step 1: 디렉토리 생성**

```bash
mkdir -p renderer/components/ai
```

- [ ] **Step 2: ChatMessage 컴포넌트**

```tsx
// renderer/components/ai/ChatMessage.tsx
import { memo } from 'react';

interface Props {
  role: 'user' | 'assistant';
  content: string;
}

export const ChatMessage = memo(function ChatMessage({ role, content }: Props) {
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] px-3 py-2 rounded-lg bg-accent text-surface-raised text-sm">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] px-3 py-2 rounded-lg bg-surface border border-border text-sm text-text-primary whitespace-pre-wrap">
        {content}
      </div>
    </div>
  );
});
```

- [ ] **Step 3: StructuredResult 컴포넌트**

AI 응답에서 ```json 블록을 파싱하여 로드맵 카드로 렌더링. "빌드에 적용" 버튼 포함.

```tsx
// renderer/components/ai/StructuredResult.tsx
import { memo, useMemo } from 'react';
import { ipc } from '../../lib/ipc-client';
import { useAppStore } from '../../stores/app-store';
import type { AIRoadmap } from '../../../shared/types';

interface Props {
  content: string;
}

export const StructuredResult = memo(function StructuredResult({ content }: Props) {
  const activeBuildId = useAppStore((s) => s.activeBuildId);

  const roadmap = useMemo(() => {
    const match = content.match(/```json\s*([\s\S]*?)```/);
    if (!match) return null;
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.type === 'roadmap' && Array.isArray(parsed.phases)) {
        return parsed as AIRoadmap;
      }
    } catch {}
    return null;
  }, [content]);

  if (!roadmap) return null;

  const applyToBuild = async () => {
    if (!activeBuildId) return;
    const stepsToCreate: any[] = [];
    for (const phase of roadmap.phases) {
      // Create phase
      const createdPhase = await ipc['phase:create']({
        buildId: activeBuildId,
        name: phase.name,
        order: roadmap.phases.indexOf(phase),
        wipLimit: null,
      });

      // Create steps for this phase
      for (let i = 0; i < phase.steps.length; i++) {
        const step = phase.steps[i];
        stepsToCreate.push({
          buildId: activeBuildId,
          phaseId: createdPhase.id,
          title: step.title,
          description: step.description,
          priority: step.priority,
          dueDate: null,
          order: i,
          createdBy: 'ai',
        });
      }
    }

    if (stepsToCreate.length > 0) {
      await ipc['step:createBatch'](stepsToCreate);
    }

    alert(`${roadmap.phases.length}개 페이즈, ${stepsToCreate.length}개 스텝이 빌드에 추가되었습니다.`);
  };

  return (
    <div className="my-2 rounded-lg border border-accent/30 bg-accent/5 p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-accent">로드맵</h4>
        {activeBuildId && (
          <button
            onClick={applyToBuild}
            className="text-xs px-2 py-1 bg-accent text-surface-raised rounded hover:bg-accent-hover"
          >
            빌드에 적용
          </button>
        )}
      </div>
      {roadmap.phases.map((phase, i) => (
        <div key={i} className="mb-2">
          <p className="text-xs font-medium text-text-primary">
            {phase.name} {phase.durationWeeks && `(${phase.durationWeeks}주)`}
          </p>
          <ul className="ml-3 mt-1 space-y-0.5">
            {phase.steps.map((step, j) => (
              <li key={j} className="text-xs text-text-secondary">
                • {step.title}
                <span className="text-text-secondary/60 ml-1">
                  [{step.priority}]
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
});
```

- [ ] **Step 4: ChatInput 컴포넌트**

```tsx
// renderer/components/ai/ChatInput.tsx
import { useState, type KeyboardEvent } from 'react';

interface Props {
  onSend: (content: string) => void;
  disabled: boolean;
}

export function ChatInput({ onSend, disabled }: Props) {
  const [value, setValue] = useState('');

  const handleSend = () => {
    if (!value.trim() || disabled) return;
    onSend(value.trim());
    setValue('');
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex gap-2 p-3 border-t border-border">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="AI에게 질문하세요..."
        disabled={disabled}
        rows={1}
        className="flex-1 text-sm px-3 py-2 rounded border border-border bg-surface text-text-primary placeholder:text-text-secondary outline-none focus:border-accent resize-none disabled:opacity-50"
      />
      <button
        onClick={handleSend}
        disabled={!value.trim() || disabled}
        className="px-3 py-2 text-sm bg-accent text-surface-raised rounded hover:bg-accent-hover disabled:opacity-50"
      >
        전송
      </button>
    </div>
  );
}
```

- [ ] **Step 5: FloatingCard 컨테이너**

```tsx
// renderer/components/ai/FloatingCard.tsx
import { useRef, useEffect } from 'react';
import { useAiChat } from '../../hooks/use-ai-chat';
import { ChatMessage } from './ChatMessage';
import { StructuredResult } from './StructuredResult';
import { ChatInput } from './ChatInput';

export function FloatingCard() {
  const { isOpen, messages, streaming, streamBuffer, close, send } = useAiChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamBuffer]);

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-20 left-6 w-96 max-h-[70vh] bg-surface-raised border border-border rounded-xl shadow-2xl flex flex-col z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-text-primary">AI</h3>
        <div className="flex gap-1">
          <button onClick={close} className="text-text-secondary hover:text-text-primary text-sm px-1">
            ✕
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-auto p-4 space-y-3">
        {messages.length === 0 && !streaming && (
          <div className="text-center text-sm text-text-secondary py-8">
            <p>프로젝트에 대해 설명해주세요.</p>
            <p className="mt-1 text-xs">로드맵을 생성하거나, 스텝을 분석하거나, 질문에 답해드릴게요.</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id}>
            <ChatMessage role={msg.role as 'user' | 'assistant'} content={msg.content} />
            {msg.role === 'assistant' && <StructuredResult content={msg.content} />}
          </div>
        ))}

        {/* Streaming buffer */}
        {streaming && streamBuffer && (
          <div>
            <ChatMessage role="assistant" content={streamBuffer} />
            <StructuredResult content={streamBuffer} />
          </div>
        )}

        {streaming && !streamBuffer && (
          <div className="flex justify-start">
            <div className="px-3 py-2 rounded-lg bg-surface border border-border text-sm text-text-secondary">
              생각하는 중...
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInput onSend={send} disabled={streaming} />
    </div>
  );
}
```

- [ ] **Step 6: Shell.tsx 수정 — 정육각형 버튼 연동**

`renderer/components/layout/Shell.tsx`를 수정:

1. 기존 정육각형 버튼에 onClick 추가
2. FloatingCard 컴포넌트 렌더
3. AI 불가 시 뱃지 표시

```tsx
// Shell.tsx에 추가
import { FloatingCard } from '../ai/FloatingCard';
import { useAiChat } from '../../hooks/use-ai-chat';

// Shell 컴포넌트 내부:
const { isOpen: aiOpen, open: openAi } = useAiChat();

// 정육각형 버튼 교체:
<button
  onClick={openAi}
  className={`fixed bottom-6 left-6 w-12 h-12 ${
    aiOpen ? 'bg-accent-hover' : 'bg-accent hover:bg-accent-hover'
  } text-surface-raised rounded-xl flex items-center justify-center shadow-lg transition-colors z-50`}
  style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}
  title="AI"
>
  AI
</button>

{/* FloatingCard 추가 */}
<FloatingCard />
```

- [ ] **Step 7: 커밋**

```bash
git add renderer/components/ai/ renderer/components/layout/Shell.tsx
git commit -m "feat: floating AI card with streaming chat, structured results, and apply-to-build"
```

---

### Task 6: 통합 테스트 + 푸쉬

**Files:** 전체 확인

- [ ] **Step 1: 전체 테스트**

```bash
pnpm vitest run
```

Expected: 16 tests PASS

- [ ] **Step 2: 앱 실행 확인**

```bash
pnpm dev
```

확인 사항:
1. 좌하단 정육각형 AI 버튼 → 클릭 → 플로팅 카드 올라옴
2. 카드 안에서 텍스트 입력 + Enter → (API 키 없으면 에러 메시지 표시, 있으면 스트리밍 응답)
3. ✕로 카드 닫기
4. 다시 클릭 → 이전 대화 유지
5. 칸반 페이지에서도 동일하게 동작

- [ ] **Step 3: 푸쉬**

```bash
git push
```

---

## Summary

| Task | 내용 | 핵심 파일 |
|---|---|---|
| 1 | Anthropic SDK + AI 타입 + IPC 채널 + DB statements | types, channels, statements |
| 2 | Claude API 클라이언트 + 시스템 프롬프트 | claude-client.ts, prompts.ts |
| 3 | AI IPC 핸들러 (스트리밍) | register.ts, main.ts |
| 4 | Zustand AI 상태 + 채팅 hook | app-store.ts, use-ai-chat.ts |
| 5 | 플로팅 카드 UI (4 컴포넌트 + Shell 연동) | FloatingCard, ChatMessage, StructuredResult, ChatInput, Shell |
| 6 | 통합 + 푸쉬 | 전체 확인 |

**전체 커밋: 6회, 신규 컴포넌트: 4개**

**Fan-out 기회:**
- T1 (타입) → T2 (클라이언트)와 T4 (Zustand+hook) **병렬 가능**
- T3 (IPC)은 T2 이후
- T5 (UI)는 T3+T4 이후
