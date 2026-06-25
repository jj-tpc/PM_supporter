import { useState, type KeyboardEvent } from 'react';

interface Props {
  onSubmit: (title: string) => void;
}

export function CreateStepInput({ onSubmit }: Props) {
  const [title, setTitle] = useState('');
  const [editing, setEditing] = useState(false);

  const handleSubmit = () => {
    if (!title.trim()) return;
    onSubmit(title.trim());
    setTitle('');
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      setEditing(false);
      setTitle('');
    }
  };

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="w-full text-left text-sm text-text-secondary hover:text-text-primary px-3 py-2 rounded hover:bg-surface transition-colors"
      >
        + 스텝 추가
      </button>
    );
  }

  return (
    <input
      autoFocus
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => { handleSubmit(); setEditing(false); }}
      placeholder="스텝 제목 입력 후 Enter"
      className="w-full text-sm px-3 py-2 rounded border border-accent bg-surface text-text-primary placeholder:text-text-secondary outline-none"
    />
  );
}
