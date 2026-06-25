// renderer/components/deepwork/FocusChecklist.tsx
import { memo, useEffect, useState } from 'react';
import { ipc } from '../../lib/ipc-client';
import type { ChecklistItem } from '../../../shared/types';

interface Props {
  stepId: string;
}

export const FocusChecklist = memo(function FocusChecklist({ stepId }: Props) {
  const [items, setItems] = useState<ChecklistItem[]>([]);

  useEffect(() => {
    ipc['checklist:list'](stepId).then(setItems);
  }, [stepId]);

  const toggle = async (item: ChecklistItem) => {
    const updated = await ipc['checklist:update'](item.id, { isChecked: !item.isChecked });
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  };

  if (items.length === 0) {
    return (
      <p className="text-sm text-text-secondary text-center py-4">
        체크리스트가 없습니다
      </p>
    );
  }

  const completed = items.filter((i) => i.isChecked).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-text-secondary">{completed}/{items.length} 완료</span>
      </div>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-2">
            <button
              onClick={() => toggle(item)}
              className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center text-xs ${
                item.isChecked
                  ? 'bg-accent border-accent text-surface-raised'
                  : 'border-border hover:border-accent'
              }`}
            >
              {item.isChecked && '\u2713'}
            </button>
            <span className={`text-sm ${item.isChecked ? 'text-text-secondary line-through' : 'text-text-primary'}`}>
              {item.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
});
