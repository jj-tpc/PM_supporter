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
