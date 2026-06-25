import type { IpcChannels, IpcChannel } from '../../main/ipc/channels';

type IpcApi = {
  [C in IpcChannel]: (...args: IpcChannels[C]['args']) => Promise<IpcChannels[C]['return']>;
};

interface EventsApi {
  on: (channel: string, callback: (...args: any[]) => void) => () => void;
}

declare global {
  interface Window {
    api: IpcApi;
    events: EventsApi;
  }
}

export const ipc: IpcApi = typeof window !== 'undefined'
  ? window.api
  : (new Proxy({}, { get: () => () => Promise.reject('No IPC in SSR') }) as IpcApi);

export const events: EventsApi = typeof window !== 'undefined'
  ? window.events
  : { on: () => () => {} };
