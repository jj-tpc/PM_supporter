import { useEffect } from 'react';
import { useAppStore } from '../stores/app-store';
import { ipc } from '../lib/ipc-client';

export function useBuilds() {
  const builds = useAppStore((s) => Object.values(s.builds));
  const setBuilds = useAppStore((s) => s.setBuilds);

  useEffect(() => {
    ipc['build:list']().then(setBuilds);
  }, [setBuilds]);

  const createBuild = async (name: string, description: string) => {
    const build = await ipc['build:create']({ name, description });
    useAppStore.getState().addBuild(build);
    return build;
  };

  const deleteBuild = async (id: string) => {
    await ipc['build:delete'](id);
    useAppStore.getState().removeBuild(id);
  };

  return { builds, createBuild, deleteBuild };
}
