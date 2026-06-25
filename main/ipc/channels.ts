// main/ipc/channels.ts

import type {
  Build, Phase, Step, Crew, Label,
  ChecklistItem, DeletedItem, DeepWorkSession,
  AppSettings, CalendarEvent, GoogleAccount, DateRange,
} from '../../shared/types';

export interface IpcChannels {
  'build:list': { args: []; return: Build[] };
  'build:get': { args: [string]; return: Build | null };
  'build:create': { args: [Omit<Build, 'id' | 'createdAt' | 'updatedAt'>]; return: Build };
  'build:update': { args: [string, Partial<Build>]; return: Build };
  'build:delete': { args: [string]; return: void };

  'phase:list': { args: [string]; return: Phase[] };
  'phase:create': { args: [Omit<Phase, 'id'>]; return: Phase };
  'phase:update': { args: [string, Partial<Phase>]; return: Phase };
  'phase:delete': { args: [string]; return: void };
  'phase:reorder': { args: [string, string[]]; return: void };

  'step:list': { args: [string]; return: Step[] };
  'step:listByPhase': { args: [string]; return: Step[] };
  'step:get': { args: [string]; return: Step | null };
  'step:create': { args: [Omit<Step, 'id' | 'createdAt' | 'updatedAt'>]; return: Step };
  'step:createBatch': { args: [Omit<Step, 'id' | 'createdAt' | 'updatedAt'>[]]; return: Step[] };
  'step:update': { args: [string, Partial<Step>]; return: Step };
  'step:move': { args: [{ stepId: string; targetPhaseId: string; order: number }]; return: void };
  'step:delete': { args: [string]; return: void };

  'crew:list': { args: []; return: Crew[] };
  'crew:create': { args: [Omit<Crew, 'id'>]; return: Crew };
  'crew:update': { args: [string, Partial<Crew>]; return: Crew };
  'crew:delete': { args: [string]; return: void };

  'step:assignCrew': { args: [string, string[]]; return: void };
  'step:getAssignees': { args: [string]; return: string[] };

  'label:list': { args: [string]; return: Label[] };
  'label:create': { args: [Omit<Label, 'id'>]; return: Label };
  'label:delete': { args: [string]; return: void };

  'checklist:list': { args: [string]; return: ChecklistItem[] };
  'checklist:create': { args: [Omit<ChecklistItem, 'id'>]; return: ChecklistItem };
  'checklist:update': { args: [string, Partial<ChecklistItem>]; return: ChecklistItem };
  'checklist:delete': { args: [string]; return: void };

  'trash:list': { args: []; return: DeletedItem[] };
  'trash:restore': { args: [string]; return: void };
  'trash:restoreBatch': { args: [string]; return: void };
  'trash:purge': { args: [string]; return: void };
  'trash:purgeExpired': { args: []; return: number };

  'deepwork:start': { args: [{ stepId: string }]; return: DeepWorkSession };
  'deepwork:end': { args: [string]; return: DeepWorkSession };
  'deepwork:getCurrent': { args: []; return: DeepWorkSession | null };
  'deepwork:updateContext': { args: [string, string]; return: void };

  'app:getSettings': { args: []; return: AppSettings };
  'app:updateSettings': { args: [Partial<AppSettings>]; return: void };

  // === Google Auth ===
  'google:startAuth': { args: []; return: GoogleAccount };
  'google:getAccounts': { args: []; return: GoogleAccount[] };
  'google:removeAccount': { args: [string]; return: void };

  // === Calendar ===
  'calendar:getEvents': { args: [DateRange]; return: CalendarEvent[] };
  'calendar:createEvent': { args: [{ calendarId: string; summary: string; startTime: string; endTime: string; description?: string; location?: string }]; return: CalendarEvent };
  'calendar:updateEvent': { args: [string, Partial<{ summary: string; startTime: string; endTime: string; description: string; location: string }>]; return: CalendarEvent };
  'calendar:deleteEvent': { args: [string]; return: void };
  'calendar:sync': { args: []; return: { added: number; updated: number; deleted: number } };
  'calendar:getSyncStatus': { args: []; return: { lastSynced: string | null; status: 'idle' | 'syncing' | 'error' } };
}

export type IpcChannel = keyof IpcChannels;
