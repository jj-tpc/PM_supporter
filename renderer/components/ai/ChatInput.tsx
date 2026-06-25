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
      <textarea value={value} onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown} placeholder="AI에게 질문하세요..."
        disabled={disabled} rows={1}
        className="flex-1 text-sm px-3 py-2 rounded border border-border bg-surface text-text-primary placeholder:text-text-secondary outline-none focus:border-accent resize-none disabled:opacity-50"
      />
      <button onClick={handleSend} disabled={!value.trim() || disabled}
        className="px-3 py-2 text-sm bg-accent text-surface-raised rounded hover:bg-accent-hover disabled:opacity-50">
        전송
      </button>
    </div>
  );
}
