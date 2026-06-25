// renderer/components/build/CreateBuildDialog.tsx
import { useState, type FormEvent } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string) => Promise<void>;
}

export function CreateBuildDialog({ open, onClose, onCreate }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    await onCreate(name.trim(), description.trim());
    setName('');
    setDescription('');
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="bg-surface-raised rounded-lg p-6 w-96 shadow-xl"
      >
        <h3 className="text-lg font-semibold text-text-primary mb-4">새 빌드 만들기</h3>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="빌드 이름"
          className="w-full px-3 py-2 rounded border border-border bg-surface text-text-primary placeholder:text-text-secondary mb-3 outline-none focus:border-accent"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="설명 (선택)"
          rows={3}
          className="w-full px-3 py-2 rounded border border-border bg-surface text-text-primary placeholder:text-text-secondary mb-4 outline-none focus:border-accent resize-none"
        />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary">
            취소
          </button>
          <button
            type="submit"
            disabled={!name.trim() || loading}
            className="px-4 py-2 text-sm bg-accent text-surface-raised rounded hover:bg-accent-hover disabled:opacity-50"
          >
            {loading ? '생성 중...' : '만들기'}
          </button>
        </div>
      </form>
    </div>
  );
}
