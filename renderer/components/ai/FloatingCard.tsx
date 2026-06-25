// renderer/components/ai/FloatingCard.tsx
import { useRef, useEffect } from 'react';
import { useAiChat } from '../../hooks/use-ai-chat';
import { ChatMessage } from './ChatMessage';
import { StructuredResult } from './StructuredResult';
import { ChatInput } from './ChatInput';

export function FloatingCard() {
  const { isOpen, messages, streaming, streamBuffer, close, send } = useAiChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, streamBuffer]);

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-20 left-6 w-96 max-h-[70vh] bg-surface-raised border border-border rounded-xl shadow-2xl flex flex-col z-50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-text-primary">AI</h3>
        <button onClick={close} className="text-text-secondary hover:text-text-primary text-sm px-1">✕</button>
      </div>
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
        {streaming && streamBuffer && (
          <div>
            <ChatMessage role="assistant" content={streamBuffer} />
            <StructuredResult content={streamBuffer} />
          </div>
        )}
        {streaming && !streamBuffer && (
          <div className="flex justify-start">
            <div className="px-3 py-2 rounded-lg bg-surface border border-border text-sm text-text-secondary">생각하는 중...</div>
          </div>
        )}
      </div>
      <ChatInput onSend={send} disabled={streaming} />
    </div>
  );
}
