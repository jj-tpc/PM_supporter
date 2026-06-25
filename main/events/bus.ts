import type { AppEvents } from '../../shared/types';

type Handler<T> = (payload: T) => void;

export class EventBus {
  private handlers = new Map<string, Set<Handler<any>>>();

  on<K extends keyof AppEvents>(event: K, handler: Handler<AppEvents[K]>): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  off<K extends keyof AppEvents>(event: K, handler: Handler<AppEvents[K]>): void {
    this.handlers.get(event)?.delete(handler);
  }

  emit<K extends keyof AppEvents>(event: K, payload: AppEvents[K]): void {
    const eventHandlers = this.handlers.get(event);
    if (!eventHandlers) return;

    for (const handler of eventHandlers) {
      try {
        handler(payload);
      } catch (err) {
        console.error(`[EventBus] Handler error for "${String(event)}":`, err);
      }
    }
  }
}

/** 싱글톤 인스턴스 — Main process에서 사용 */
export const appBus = new EventBus();
