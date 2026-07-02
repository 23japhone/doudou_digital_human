import type { PetManifest } from "../pet_bundle/manifest.js";
import type { ScreenPoint } from "./drag.js";
import type { RuntimeScaleLimits } from "./scale.js";
import type { RuntimePetMotionCue, RuntimePetState } from "./state.js";

export interface RuntimeAtlas {
  id: string;
  url: string;
}

export type RuntimeScaleSource = "pointer" | "wheel";

export interface RuntimeBundle {
  manifest: PetManifest;
  atlases: RuntimeAtlas[];
  previewUrl: string;
  scale: number;
  scaleLimits: RuntimeScaleLimits;
  smoke: boolean;
}

export interface PetRuntimeBridge {
  dragWindowTo(pointer: ScreenPoint): void;
  endWindowDrag(): void;
  getBundle(): Promise<RuntimeBundle>;
  onMotionState(callback: (cue: RuntimePetMotionCue) => void): () => void;
  quit(): void;
  reportSmokeResult(result: RuntimeSmokeResult): void;
  setIgnoreMouseEvents(ignore: boolean): void;
  setWindowScale(scale: number, source?: RuntimeScaleSource): Promise<number>;
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
  scale: number;
  scaleChanged: boolean;
  pointerScaleChanged: boolean;
  wheelScaleChanged: boolean;
  mouseFollowMoved: boolean;
  runtimeStatesObserved: RuntimePetState[];
  visualStateApplied: boolean;
  motionDirectionsObserved: string[];
  maxStopRebound: number;
  tapExpressionFramesObserved: number[];
  drawCount: number;
  initialFrameIndex: number;
  currentFrameIndex: number;
  frameHiddenByDefault: boolean;
  frameVisibleOnResizeEdge: boolean;
}
