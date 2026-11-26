import { EventEmitter } from "node:events";

/** Process-wide event bus: store changes and live run output go to every open dashboard tab. */
const g = globalThis as unknown as { __loBus?: EventEmitter };
export const bus = (g.__loBus ??= Object.assign(new EventEmitter(), {}));
bus.setMaxListeners(100);
