import { contextBridge, ipcRenderer } from 'electron';

const api = new Proxy({} as Record<string, (...args: any[]) => Promise<any>>, {
  get(_target, channel: string) {
    return (...args: any[]) => ipcRenderer.invoke(channel, ...args);
  },
});

const events = {
  on: (channel: string, callback: (...args: any[]) => void) => {
    const listener = (_event: any, ...args: any[]) => callback(...args);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
};

contextBridge.exposeInMainWorld('api', api);
contextBridge.exposeInMainWorld('events', events);
