import { useState } from 'react';
import { useCrews } from '../../hooks/use-crews';
import { CrewAvatar } from './CrewAvatar';
import { ipc } from '../../lib/ipc-client';

interface Props {
  stepId: string;
  assignedCrewIds: string[];
  onUpdate: () => void;
}

export function CrewAssignPopover({ stepId, assignedCrewIds, onUpdate }: Props) {
  const { crews } = useCrews();
  const [open, setOpen] = useState(false);

  const toggle = async (crewId: string) => {
    const current = new Set(assignedCrewIds);
    if (current.has(crewId)) {
      current.delete(crewId);
    } else {
      current.add(crewId);
    }
    await ipc['step:assignCrew'](stepId, [...current]);
    onUpdate();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-text-secondary hover:text-text-primary"
      >
        + 크루 배정
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-6 left-0 z-50 w-48 bg-surface-raised border border-border rounded-lg shadow-lg py-1">
            {crews.length === 0 ? (
              <p className="text-xs text-text-secondary px-3 py-2">크루가 없습니다</p>
            ) : (
              crews.map((crew) => (
                <button
                  key={crew.id}
                  onClick={() => toggle(crew.id)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-text-primary hover:bg-surface"
                >
                  <CrewAvatar name={crew.name} size="sm" />
                  <span className="flex-1 text-left">{crew.name}</span>
                  {assignedCrewIds.includes(crew.id) && <span className="text-accent">&#10003;</span>}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
