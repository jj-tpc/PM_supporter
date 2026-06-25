import { useEffect, useState } from 'react';
import { ipc } from '../lib/ipc-client';
import type { DashboardData } from '../../shared/types';

export function useDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ipc['dashboard:getData']().then((d) => {
      setData(d);
      setLoading(false);
    });
  }, []);

  const refresh = async () => {
    setLoading(true);
    const d = await ipc['dashboard:getData']();
    setData(d);
    setLoading(false);
  };

  const dismissOnboarding = async () => {
    await ipc['dashboard:dismissOnboarding']();
    await refresh();
  };

  return { data, loading, refresh, dismissOnboarding };
}
