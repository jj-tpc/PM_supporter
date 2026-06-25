// renderer/components/kanban/StepDetail.tsx
import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../../stores/app-store';
import { ipc } from '../../lib/ipc-client';

export function StepDetail() {
  const selectedStepId = useAppStore((s) => s.selectedStepId);
  const step = useAppStore(useCallback((s) => selectedStepId ? s.steps[selectedStepId] : null, [selectedStepId]));
  const setSelectedStep = useAppStore((s) => s.setSelectedStep);
  const updateStep = useAppStore((s) => s.updateStep);
  const removeStep = useAppStore((s) => s.removeStep);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (step) {
      setTitle(step.title);
      setDescription(step.description);
    }
  }, [step]);

  if (!step || !selectedStepId) return null;

  const save = async (changes: Record<string, unknown>) => {
    updateStep(selectedStepId, changes);
    await ipc['step:update'](selectedStepId, changes);
  };

  const handleDelete = async () => {
    if (!confirm('이 스텝을 삭제하시겠습니까?\n휴지통에서 30일간 복원 가능합니다.')) return;
    setSelectedStep(null);
    removeStep(selectedStepId);
    await ipc['step:delete'](selectedStepId);
  };

  const priorities = [
    { value: 'critical', label: 'Critical', color: 'text-danger' },
    { value: 'high', label: 'High', color: 'text-warning' },
    { value: 'medium', label: 'Medium', color: 'text-accent' },
    { value: 'low', label: 'Low', color: 'text-text-secondary' },
  ] as const;

  return (
    <div className="w-96 border-l border-border bg-surface-raised flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="text-sm font-semibold text-text-secondary">스텝 상세</h3>
        <button onClick={() => setSelectedStep(null)} className="text-text-secondary hover:text-text-primary">
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Title */}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title !== step.title && save({ title })}
          className="w-full text-lg font-semibold bg-transparent text-text-primary outline-none border-b border-transparent focus:border-accent pb-1"
        />

        {/* Priority */}
        <div>
          <label className="text-xs text-text-secondary block mb-1">우선순위</label>
          <div className="flex gap-2">
            {priorities.map((p) => (
              <button
                key={p.value}
                onClick={() => save({ priority: p.value })}
                className={`text-xs px-2 py-1 rounded border ${
                  step.priority === p.value
                    ? 'border-accent bg-accent/10 font-medium'
                    : 'border-border hover:border-accent'
                } ${p.color}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Due date */}
        <div>
          <label className="text-xs text-text-secondary block mb-1">마감일</label>
          <input
            type="date"
            value={step.dueDate?.split('T')[0] ?? ''}
            onChange={(e) => save({ dueDate: e.target.value ? new Date(e.target.value).toISOString() : null })}
            className="text-sm px-3 py-1.5 rounded border border-border bg-surface text-text-primary outline-none focus:border-accent"
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-xs text-text-secondary block mb-1">설명</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => description !== step.description && save({ description })}
            rows={6}
            placeholder="스텝 설명을 입력하세요..."
            className="w-full text-sm px-3 py-2 rounded border border-border bg-surface text-text-primary placeholder:text-text-secondary outline-none focus:border-accent resize-none"
          />
        </div>
      </div>

      {/* Delete */}
      <div className="p-4 border-t border-border">
        <button
          onClick={handleDelete}
          className="text-sm text-danger hover:text-danger/80"
        >
          스텝 삭제
        </button>
      </div>
    </div>
  );
}
