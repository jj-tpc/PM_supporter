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
