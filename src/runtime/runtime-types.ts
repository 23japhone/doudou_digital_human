import type { PetManifest } from "../pet_bundle/manifest.js";
import type { ScreenPoint } from "./drag.js";

export interface RuntimeAtlas {
  id: string;
  url: string;
}

export interface RuntimeBundle {
  manifest: PetManifest;
  atlases: RuntimeAtlas[];
  previewUrl: string;
  smoke: boolean;
}

export interface PetRuntimeBridge {
  dragWindowTo(pointer: ScreenPoint): void;
  endWindowDrag(): void;
  getBundle(): Promise<RuntimeBundle>;
  quit(): void;
  reportSmokeResult(result: RuntimeSmokeResult): void;
  setIgnoreMouseEvents(ignore: boolean): void;
  showContextMenu(): void;
  startWindowDrag(pointer: ScreenPoint): void;
  rendererReady(): void;
}

export interface RuntimeSmokeResult {
  atlasLoaded: boolean;
  bundleLoaded: boolean;
  dragMoved: boolean;
  idleAdvanced: boolean;
  nonTransparentPixel: boolean;
  renderLoopAdvanced: boolean;
  drawCount: number;
  initialFrameIndex: number;
  currentFrameIndex: number;
}
