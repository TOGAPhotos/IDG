import PubSub from "pubsub-js";
import Log from "../loger.js";


type EventHandler<P> = (msg: string, data: P) => Promise<void> | void;
export type AnyEventMap = Record<string, unknown>;
export interface AppEvents extends AnyEventMap {
  'user:delete': { userId: number };
  'user:ban': { userId: number };
  'photo:delete': { photoId: number };
  'cdn:refresh': { path: string };

}

export class EventBus<E extends AppEvents> {

  subscribe<K extends keyof E>(event: K, handler: EventHandler<E[K]>): string {
    return PubSub.subscribe(String(event), handler);
  }

  publish<K extends keyof E>(event: K, data: E[K]): boolean {
    return PubSub.publish(String(event), data);
  }

  unsubscribe(token: string): void {
    PubSub.unsubscribe(token);
  }
}
