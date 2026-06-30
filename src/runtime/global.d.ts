import type { PetRuntimeBridge } from "./runtime-types.js";

declare global {
  interface Window {
    petRuntime: PetRuntimeBridge;
  }
}

export {};
