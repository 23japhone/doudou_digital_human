import type { PetManifest } from "../pet_bundle/manifest.js";
import type { DefaultDoudouEmotionId, DefaultDoudouEmotionScenario } from "./default-doudou-emotions.js";
import type {
  DoudouOfficialLive2DRendererRuntimeAssets,
  DoudouOfficialLive2DRendererRuntimeEvidence
} from "./default-doudou-live2d-official-sdk-resolver.js";
import type { DoudouOfficialLive2DRendererHostEvidence } from "./default-doudou-live2d-official-renderer-host.js";
import type { DoudouLive2DPreviewLibrary } from "./default-doudou-live2d-preview.js";
import type {
  DoudouRuntimeEmotionBehaviorTriggerInput,
  DoudouRuntimeEmotionBehaviorTriggerResult
} from "./default-doudou-emotion-trigger.js";
import type { DoudouWebCubismRendererSpikeEvidence } from "./default-doudou-live2d-web-renderer-spike.js";
import type { ScreenPoint } from "./drag.js";
import type { RuntimeScaleLimits } from "./scale.js";
import type { RuntimePetMotionCue, RuntimePetState } from "./state.js";
import type { RuntimeMotionTuning, RuntimeMotionTuningPreset } from "./tuning.js";
import type {
  PetInteractionReplayFixtureId,
  PetInteractionReplayEventType
} from "./interaction-replay.js";
import type {
  PetPerformancePlan,
  PetPerformanceTransitionTone
} from "./performance-governor.js";
import type {
  PetAffectStableState,
  PetReactionAct
} from "./presentation.js";
import type { DoudouCubismMotionPriority } from "./default-doudou-live2d-cubism-adapter.js";

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
  live2DRendererSpike: RuntimeDefaultDoudouLive2DRendererSpikeConfig | null;
  previewUrl: string;
  scale: number;
  scaleLimits: RuntimeScaleLimits;
  smoke: boolean;
  emotionDebugPanelEnabled: boolean;
  emotionDebugPanelSmokeConsentEnabled: boolean;
  emotionTraySmokeConsentEnabled: boolean;
  motionTuning: RuntimeMotionTuning;
  motionTuningEnabled: boolean;
  motionTuningPresets: RuntimeMotionTuningPreset[];
  smokeSyntheticReplay: RuntimeSmokeSyntheticReplayPlan | null;
}

export const RUNTIME_SMOKE_SYNTHETIC_REPLAY_SCHEMA_VERSION = "doudou.runtime-smoke.synthetic-replay.v0.1" as const;
export const RUNTIME_SMOKE_SYNTHETIC_REPLAY_PLAN_ENV = "DOUDOU_RUNTIME_SMOKE_SYNTHETIC_REPLAY_PLAN" as const;

export type RuntimeSmokeSyntheticReplayEventType = PetInteractionReplayEventType;

export interface RuntimeSmokeSyntheticReplayEvent {
  atMs: number;
  direction?: RuntimePetMotionCue["direction"];
  fixtureId: PetInteractionReplayFixtureId;
  motionIntensity?: number;
  point?: {
    canvasX: number;
    canvasY: number;
  };
  state?: RuntimePetMotionCue["state"];
  type: RuntimeSmokeSyntheticReplayEventType;
}

export interface RuntimeSmokeSyntheticReplayPlan {
  enabled: true;
  events: RuntimeSmokeSyntheticReplayEvent[];
  fixtureIds: PetInteractionReplayFixtureId[];
  schemaVersion: typeof RUNTIME_SMOKE_SYNTHETIC_REPLAY_SCHEMA_VERSION;
}

export interface RuntimeSmokeSyntheticReplayEvidence {
  appliedEventTypes: RuntimeSmokeSyntheticReplayEventType[];
  completed: boolean;
  domEventsDispatched: number;
  enabled: boolean;
  eventCount: number;
  fixtureIds: string[];
  ipcEventsDispatched: number;
  privacySanitized: boolean;
}

export interface RuntimeDefaultDoudouLive2DRendererSpikeConfig {
  library: DoudouLive2DPreviewLibrary;
  model3Json: "default-doudou.model3.json";
  modelId: "default-doudou";
  officialRuntime: RuntimeOfficialLive2DRendererRuntimeConfig;
}

export interface RuntimeOfficialLive2DRendererRuntimeConfig {
  publicEvidence: DoudouOfficialLive2DRendererRuntimeEvidence;
  rendererAssets?: DoudouOfficialLive2DRendererRuntimeAssets;
}

export type RuntimeLive2DOfficialRendererAssetProbe =
  | "not_configured"
  | "unavailable"
  | "model3_fetch_pending"
  | "model3_fetched"
  | "model3_fetch_failed";

export interface RuntimeLive2DOfficialRendererSmokeEvidence
  extends Omit<DoudouOfficialLive2DRendererRuntimeEvidence, "runtimeModule"> {
  canvasLayerVisible: boolean;
  canvasNonTransparentPixel: boolean;
  rendererAssetProbe: RuntimeLive2DOfficialRendererAssetProbe;
  runtimeModule: DoudouOfficialLive2DRendererHostEvidence;
}

export interface RuntimeLive2DRendererSpikeSmokeResult extends DoudouWebCubismRendererSpikeEvidence {
  enabled: boolean;
  officialRuntime: RuntimeLive2DOfficialRendererSmokeEvidence;
  sdkCallsObserved: string[];
}

export interface PetRuntimeBridge {
  copyMotionTuningPreset(text: string): Promise<boolean>;
  dragWindowTo(pointer: ScreenPoint): void;
  endWindowDrag(): void;
  getBundle(): Promise<RuntimeBundle>;
  listMotionTuningPresets(): Promise<RuntimeMotionTuningPreset[]>;
  onCursorHitTest(callback: (screenPoint: ScreenPoint) => RuntimeCursorHitTestResult): () => void;
  onMotionState(callback: (cue: RuntimePetMotionCue) => void): () => void;
  onTrayEmotionBehaviorRequest(callback: (input: DoudouRuntimeEmotionBehaviorTriggerInput) => void): () => void;
  quit(): void;
  recordPoke(point?: ScreenPoint): void;
  reportSmokeResult(result: RuntimeSmokeResult): void;
  requestEmotionBehavior(input: DoudouRuntimeEmotionBehaviorTriggerInput): Promise<DoudouRuntimeEmotionBehaviorTriggerResult>;
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
  petPerformanceExpressionPrioritiesObserved: DoudouCubismMotionPriority[];
  petPerformanceGovernorSchemaVersionsObserved: string[];
  petPerformanceMotionBudgetsObserved: PetPerformancePlan["motionBudget"][];
  petPerformanceTransitionTonesObserved: PetPerformanceTransitionTone[];
  petPresentationEnvelopeSchemaVersionsObserved: string[];
  petPresentationReactionActsObserved: PetReactionAct[];
  petPresentationStableStatesObserved: PetAffectStableState[];
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
  live2DRendererSpike: RuntimeLive2DRendererSpikeSmokeResult | null;
  emotionModelTrigger?: RuntimeEmotionModelTriggerSmokeResult;
  emotionModelPanel?: RuntimeEmotionModelPanelSmokeResult;
  emotionModelTray?: RuntimeEmotionModelTraySmokeResult;
  syntheticReplay?: RuntimeSmokeSyntheticReplayEvidence;
}

export interface RuntimeEmotionModelTriggerSmokeResult {
  commandApplied: boolean | null;
  explicitConsentGate: boolean;
  providerCalledWithoutConsent: boolean;
}

export interface RuntimeEmotionModelPanelSmokeResult {
  buttonSubmitted: boolean;
  commandApplied: boolean | null;
  consented: boolean;
  panelVisible: boolean;
  providerCalled: boolean | null;
  statusSanitized: boolean;
  statusText: string;
}

export interface RuntimeEmotionModelTraySmokeResult {
  commandApplied: boolean | null;
  consented: boolean;
  menuCreated: boolean;
  menuItemVisible: boolean;
  providerCalled: boolean | null;
  requestDispatched: boolean;
  statusSanitized: boolean;
  statusText: string;
}
