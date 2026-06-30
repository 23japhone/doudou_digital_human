import type { PetManifest } from "../pet_bundle/manifest.js";

export interface RuntimeAtlas {
  id: string;
  url: string;
}

export interface RuntimeBundle {
  manifest: PetManifest;
  atlases: RuntimeAtlas[];
  previewUrl: string;
}

export interface PetRuntimeBridge {
  getBundle(): Promise<RuntimeBundle>;
  quit(): void;
  reportSmokeResult(result: RuntimeSmokeResult): void;
  setIgnoreMouseEvents(ignore: boolean): void;
  showContextMenu(): void;
  rendererReady(): void;
}

export interface RuntimeSmokeResult {
  atlasLoaded: boolean;
  bundleLoaded: boolean;
  idleAdvanced: boolean;
  nonTransparentPixel: boolean;
  renderLoopAdvanced: boolean;
  drawCount: number;
  initialFrameIndex: number;
  currentFrameIndex: number;
}
