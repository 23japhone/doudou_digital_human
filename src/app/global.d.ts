import type { DoudouAppBridge } from "./app-types.js";

declare global {
  interface Window {
    doudouApp: DoudouAppBridge;
  }
}

export {};
