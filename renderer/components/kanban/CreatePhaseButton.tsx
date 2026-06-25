import { useState, type KeyboardEvent } from 'react';

interface Props {
  onSubmit: (name: string) => void;
}

export function CreatePhaseButton({ onSubmit }: Props) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSubmit(name.trim());
    setName('');
    setEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); }
    if (e.key === 'Escape') { setEditing(false); setName(''); }
  };

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="flex-shrink-0 w-72 h-12 rounded-lg border border-dashed border-border text-text-secondary hover:text-text-primary hover:border-accent transition-colors text-sm"
      >
        + 페이즈 추가
      </button>
    );
  }

  return (
    <div className="flex-shrink-0 w-72">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { handleSubmit(); setEditing(false); }}
        placeholder="페이즈 이름"
        className="w-full text-sm px-3 py-2 rounded border border-accent bg-surface text-text-primary outline-none"
      />
    </div>
  );
}
