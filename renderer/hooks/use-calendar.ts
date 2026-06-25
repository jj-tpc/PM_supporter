// renderer/hooks/use-calendar.ts
import { useEffect, useMemo, useCallback } from 'react';
import { useAppStore } from '../stores/app-store';
import { ipc } from '../lib/ipc-client';
import type { CalendarViewType } from '../../shared/types';

function getViewRange(view: CalendarViewType, dateStr: string) {
  const date = new Date(dateStr);
  let start: Date, end: Date;

  switch (view) {
    case 'day':
      start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      break;
    case 'week':
      const dayOfWeek = date.getDay();
      start = new Date(date.getFullYear(), date.getMonth(), date.getDate() - dayOfWeek);
      end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      start = new Date(date.getFullYear(), date.getMonth(), 1);
      end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
      break;
  }

  return { start: start.toISOString(), end: end.toISOString() };
}

export function useCalendar() {
  const events = useAppStore((s) => s.calendarEvents);
  const view = useAppStore((s) => s.calendarView);
  const dateStr = useAppStore((s) => s.calendarDate);
  const setCalendarEvents = useAppStore((s) => s.setCalendarEvents);
  const setCalendarView = useAppStore((s) => s.setCalendarView);
  const setCalendarDate = useAppStore((s) => s.setCalendarDate);
  const googleConnected = useAppStore((s) => s.googleConnected);
  const setGoogleConnected = useAppStore((s) => s.setGoogleConnected);

  const range = useMemo(() => getViewRange(view, dateStr), [view, dateStr]);

  useEffect(() => {
    ipc['calendar:getEvents'](range).then(setCalendarEvents);
  }, [range, setCalendarEvents]);

  useEffect(() => {
    ipc['google:getAccounts']().then((accounts) => {
      setGoogleConnected(accounts.length > 0);
    });
  }, [setGoogleConnected]);

  const eventList = useMemo(() => Object.values(events), [events]);

  const navigate = useCallback((direction: -1 | 0 | 1) => {
    if (direction === 0) {
      setCalendarDate(new Date().toISOString());
      return;
    }
    const current = new Date(dateStr);
    switch (view) {
      case 'day': current.setDate(current.getDate() + direction); break;
      case 'week': current.setDate(current.getDate() + 7 * direction); break;
      case 'month': current.setMonth(current.getMonth() + direction); break;
    }
    setCalendarDate(current.toISOString());
  }, [dateStr, view, setCalendarDate]);

  const connectGoogle = async () => {
    await ipc['google:startAuth']();
    setGoogleConnected(true);
    await ipc['calendar:sync']();
    const evts = await ipc['calendar:getEvents'](range);
    setCalendarEvents(evts);
  };

  const syncNow = async () => {
    await ipc['calendar:sync']();
    const evts = await ipc['calendar:getEvents'](range);
    setCalendarEvents(evts);
  };

  return {
    events: eventList, view, dateStr, range,
    setView: setCalendarView, navigate, connectGoogle, syncNow,
    googleConnected,
  };
}
