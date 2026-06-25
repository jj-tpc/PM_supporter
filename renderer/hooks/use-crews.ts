import { useEffect } from 'react';
import { useAppStore } from '../stores/app-store';
import { ipc } from '../lib/ipc-client';

export function useCrews() {
  const crews = useAppStore((s) => Object.values(s.crews));
  const setCrews = useAppStore((s) => s.setCrews);

  useEffect(() => {
    ipc['crew:list']().then(setCrews);
  }, [setCrews]);

  const createCrew = async (name: string, role?: string) => {
    const crew = await ipc['crew:create']({
      name,
      email: null,
      role: role ?? null,
      avatarUrl: null,
    });
    useAppStore.getState().addCrew(crew);
    return crew;
  };

  const deleteCrew = async (id: string) => {
    await ipc['crew:delete'](id);
    useAppStore.getState().removeCrew(id);
  };

  return { crews, createCrew, deleteCrew };
}
