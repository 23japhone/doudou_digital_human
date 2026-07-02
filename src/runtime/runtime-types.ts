import type { PetManifest } from "../pet_bundle/manifest.js";
import type { DefaultDoudouEmotionId, DefaultDoudouEmotionScenario } from "./default-doudou-emotions.js";
import type { ScreenPoint } from "./drag.js";
import type { RuntimeScaleLimits } from "./scale.js";
import type { RuntimePetMotionCue, RuntimePetState } from "./state.js";
import type { RuntimeMotionTuning, RuntimeMotionTuningPreset } from "./tuning.js";

export interface RuntimeAtlas {
  id: string;
  url: string;
}

export type RuntimeScaleSource = "pointer" | "wheel";

export interface RuntimeCursorHitTestResult {
  canvasPoint?: {
    x: number;
    y: number;
  };
  canvasSize?: {
    width: number;
    height: number;
  };
  visible: boolean;
}

export interface RuntimeBundle {
  manifest: PetManifest;
  atlases: RuntimeAtlas[];
  previewUrl: string;
  scale: number;
  scaleLimits: RuntimeScaleLimits;
  smoke: boolean;
  motionTuning: RuntimeMotionTuning;
  motionTuningEnabled: boolean;
  motionTuningPresets: RuntimeMotionTuningPreset[];
}

export interface PetRuntimeBridge {
  copyMotionTuningPreset(text: string): Promise<boolean>;
  dragWindowTo(pointer: ScreenPoint): void;
  endWindowDrag(): void;
  getBundle(): Promise<RuntimeBundle>;
  listMotionTuningPresets(): Promise<RuntimeMotionTuningPreset[]>;
  onCursorHitTest(callback: (screenPoint: ScreenPoint) => RuntimeCursorHitTestResult): () => void;
  onMotionState(callback: (cue: RuntimePetMotionCue) => void): () => void;
  quit(): void;
  recordPoke(point?: ScreenPoint): void;
  reportSmokeResult(result: RuntimeSmokeResult): void;
  saveMotionTuningPreset(name: string, tuning: Partial<RuntimeMotionTuning>): Promise<RuntimeMotionTuningPreset[]>;
  setMotionTuning(patch: Partial<RuntimeMotionTuning>): Promise<RuntimeMotionTuning>;
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
  passiveCursorMovedWindow: boolean;
  cursorFollowAlphaHitTested: boolean;
  defaultDoudouEmotionIdsObserved: DefaultDoudouEmotionId[];
  defaultDoudouEmotionScenariosObserved: DefaultDoudouEmotionScenario[];
  emotionMotionPhasesObserved: string[];
  motionTuningApplied: boolean;
  motionTuningPanelVisible: boolean;
  motionTuningPresetButtonVisible: boolean;
  motionTuningPresetApplied: boolean;
  motionTuningPresetCopied: boolean;
  motionTuningPresetNames: string[];
  motionTuningPresetSaved: boolean;
  motionTuningPresetText: string;
  motionTuningSnapshot: RuntimeMotionTuning;
  maxEmotionWariness: number;
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
