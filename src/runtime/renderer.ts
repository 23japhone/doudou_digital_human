import { createAnimationPlayer } from "./animation.js";
import type { PetAtlas } from "../pet_bundle/manifest.js";
import type {
  RuntimeBundle,
  RuntimeDefaultDoudouLive2DRendererSpikeConfig,
  RuntimeLive2DOfficialRendererAssetProbe,
  RuntimeLive2DRendererSpikeSmokeResult,
  RuntimeScaleSource,
  RuntimeSmokeResult
} from "./runtime-types.js";
import {
  doudouEmotionForRuntimeScenario,
  doudouEmotionScenarioForRuntimeState,
  type DefaultDoudouEmotionId,
  type DefaultDoudouEmotionScenario
} from "./default-doudou-emotions.js";
import {
  createRuntimeScreenHitTestResult,
  isPointInsideRuntimeHitArea,
  type CanvasAlphaSampler
} from "./hit-area.js";
import {
  RUNTIME_FRAME_PADDING,
  calculateDraggedRuntimeScale,
  createRuntimeScaleDragSession,
  isPointInRuntimeFrame,
  isPointInRuntimeResizeZone,
  mapCssPointToCanvasPoint,
  nextRuntimeScale,
  shouldShowRuntimeFrameAffordance,
  type RuntimeScaleDragSession
} from "./scale.js";
import {
  RUNTIME_PET_STATES,
  createRuntimePetStateMachine,
  runtimePetStateClass,
  type RuntimePetMotionCue,
  type RuntimePetState
} from "./state.js";
import {
  RUNTIME_MOTION_TUNING_DEFAULTS,
  RUNTIME_MOTION_TUNING_LIMITS,
  createRuntimeStateTiming,
  formatRuntimeMotionTuningPreset,
  resolveRuntimeMotionTuning,
  type RuntimeMotionTuning,
  type RuntimeMotionTuningPreset
} from "./tuning.js";
import {
  createDoudouWebCubismRendererSpike,
  type DoudouWebCubismRendererSpike,
  type DoudouWebCubismRendererSpikeRuntime
} from "./default-doudou-live2d-web-renderer-spike.js";
import {
  createDoudouOfficialLive2DRendererHost,
  type DoudouOfficialLive2DRendererHost,
  type DoudouOfficialLive2DRendererHostEvidence,
  type DoudouOfficialLive2DRendererRuntimeModule
} from "./default-doudou-live2d-official-renderer-host.js";
import {
  DOUDOU_LIVE2D_RENDERER_SMOKE_SETTLE_POLL_MS,
  DOUDOU_LIVE2D_RENDERER_SMOKE_SETTLE_TIMEOUT_MS,
  isDoudouLive2DRendererSmokePending,
  isDoudouLive2DRendererSmokeSettledAfterInteractions
} from "./default-doudou-live2d-official-smoke-settle.js";
import "./styles.css";

const canvas = document.querySelector<HTMLCanvasElement>("#pet-canvas");
if (!canvas) {
  throw new Error("Missing pet canvas.");
}
const live2DCanvasElement = document.querySelector<HTMLCanvasElement>("#live2d-canvas");
if (!live2DCanvasElement) {
  throw new Error("Missing Live2D canvas.");
}
const frame = document.querySelector<HTMLElement>("#pet-frame");
if (!frame) {
  throw new Error("Missing pet interaction frame.");
}

const context = canvas.getContext("2d");
if (!context) {
  throw new Error("Unable to create 2D canvas context.");
}
const petCanvas: HTMLCanvasElement = canvas;
const live2DCanvas: HTMLCanvasElement = live2DCanvasElement;
const petFrame: HTMLElement = frame;
const drawingContext: CanvasRenderingContext2D = context;
const RESIZE_AFFORDANCE_CLASS = "is-resize-affordance-visible";

const bundle = await window.petRuntime.getBundle();
console.log(`pet renderer: loaded bundle ${bundle.manifest.id}`);
const player = createAnimationPlayer(bundle.manifest);
let runtimeMotionTuning = resolveRuntimeMotionTuning(bundle.motionTuning);
const runtimeStateTiming = createRuntimeStateTiming(runtimeMotionTuning);
const stateMachine = createRuntimePetStateMachine(runtimeStateTiming);
const atlasImages = await loadAtlases(bundle);
console.log(`pet renderer: loaded ${atlasImages.size} atlas image(s)`);
const canvasAlphaSampler: CanvasAlphaSampler = {
  get width() {
    return petCanvas.width;
  },
  get height() {
    return petCanvas.height;
  },
  alphaAt: (x, y) => {
    try {
      return drawingContext.getImageData(x, y, 1, 1).data[3] ?? 0;
    } catch {
      return null;
    }
  }
};
let lastTimestamp = performance.now();
let drawCount = 0;
let initialFrameIndex: number | null = null;
let currentFrameIndex = -1;
let runtimeScale = bundle.scale;
let smokeInteractionsExercised = false;
let smokeResultReporting = false;
let smokeResultReported = false;
let draggingPointerId: number | null = null;
let scalingPointerId: number | null = null;
let scaleDragSession: RuntimeScaleDragSession | null = null;
let scaleRequestSerial = 0;
let visualState: RuntimePetState = stateMachine.current();
let maxStopRebound = 0;
let smokeMotionTuningApplied = false;
let smokeMotionTuningPanelVisible = false;
let smokeMotionTuningPresetButtonVisible = false;
let smokeMotionTuningPresetApplied = false;
let smokeMotionTuningPresetCopied = false;
let smokeMotionTuningPresetNames: string[] = [];
let smokeMotionTuningPresetSaved = false;
let smokeMotionTuningPresetText = "";
let runtimeMotionTuningPresets: RuntimeMotionTuningPreset[] = bundle.motionTuningPresets;
const motionDirectionsObserved = new Set<string>();
const tapExpressionFramesObserved = new Set<number>();
const defaultDoudouEmotionIdsObserved = new Set<DefaultDoudouEmotionId>();
const defaultDoudouEmotionScenariosObserved = new Set<DefaultDoudouEmotionScenario>();
let live2DRendererSpike: DoudouWebCubismRendererSpike | null = null;
let live2DRendererSpikeActiveEmotionId: DefaultDoudouEmotionId = "calm_idle";
let live2DRendererSpikeSdkCalls: string[] = [];
let live2DOfficialRendererHost: DoudouOfficialLive2DRendererHost | null = null;
let live2DOfficialRendererAssetProbe: RuntimeLive2DOfficialRendererAssetProbe = "not_configured";
const loadedOfficialLive2DCoreScripts = new Set<string>();
type RuntimeMotionTuningKey = keyof RuntimeMotionTuning;
interface RuntimeTuningControl {
  key: RuntimeMotionTuningKey;
  label: string;
  step: number;
  unit: string;
}

const runtimeTuningControls: readonly RuntimeTuningControl[] = [
  { key: "retreatDistancePixels", label: "后退距离", step: 4, unit: "px" },
  { key: "watchingPauseMs", label: "观察停顿", step: 20, unit: "ms" },
  { key: "recoverySpeedPixelsPerSecond", label: "恢复速度", step: 20, unit: "px/s" }
];
const tuningPanelOutputs = new Map<RuntimeMotionTuningKey, HTMLOutputElement>();
const tuningPanelInputs = new Map<RuntimeMotionTuningKey, HTMLInputElement>();
let tuningPresetNameInput: HTMLInputElement | null = null;
let tuningPresetSelect: HTMLSelectElement | null = null;
let tuningPresetStatus: HTMLElement | null = null;

petCanvas.width = bundle.manifest.canvas.width;
petCanvas.height = bundle.manifest.canvas.height;
live2DCanvas.width = bundle.manifest.canvas.width;
live2DCanvas.height = bundle.manifest.canvas.height;
petFrame.style.setProperty("--runtime-frame-padding", `${RUNTIME_FRAME_PADDING}px`);
setupLive2DRendererSpike();
applyRuntimePetState(visualState);
setupRuntimeTuningPanel();

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    window.petRuntime.quit();
  }
});

window.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  window.petRuntime.showContextMenu();
});

window.addEventListener("mousemove", (event) => {
  if (draggingPointerId !== null || scalingPointerId !== null) {
    window.petRuntime.setIgnoreMouseEvents(false);
    return;
  }
  const framePoint = framePointFromMouseEvent(event);
  const insideFrame = isPointInRuntimeFrame(framePoint, frameSize());
  window.petRuntime.setIgnoreMouseEvents(!insideFrame);
  petFrame.style.cursor = cursorForPointer(framePoint, event);
  setFrameResizeAffordanceVisible(insideFrame && shouldShowRuntimeFrameAffordance(framePoint, frameSize(), false));
});

window.addEventListener("mouseleave", () => {
  if (draggingPointerId === null && scalingPointerId === null) {
    window.petRuntime.setIgnoreMouseEvents(true);
    setFrameResizeAffordanceVisible(false);
  }
});

window.petRuntime.onMotionState((state) => {
  applyRuntimePetState(stateMachine.motion(state, performance.now()));
});

window.petRuntime.onCursorHitTest((screenPoint) =>
  createRuntimeScreenHitTestResult({
    canvasClientRect: rectLikeFromDomRect(petCanvas.getBoundingClientRect()),
    canvasSize: bundle.manifest.canvas,
    hitArea: bundle.manifest.hitArea,
    sampler: canvasAlphaSampler,
    screenPoint,
    windowOrigin: { x: window.screenX, y: window.screenY }
  })
);

petFrame.addEventListener("pointerdown", (event) => {
  const framePoint = framePointFromMouseEvent(event);
  if (event.button !== 0 || !isPointInRuntimeFrame(framePoint, frameSize())) {
    return;
  }
  if (shouldStartScaleDrag(framePoint, event)) {
    markRuntimeWorking();
    scalingPointerId = event.pointerId;
    scaleDragSession = createRuntimeScaleDragSession({
      origin: frameCenterScreenPoint(),
      pointer: screenPointFromPointerEvent(event),
      scale: runtimeScale
    }, bundle.scaleLimits);
    petFrame.setPointerCapture(event.pointerId);
    setFrameResizeAffordanceVisible(true);
    window.petRuntime.setIgnoreMouseEvents(false);
    event.preventDefault();
    return;
  }
  draggingPointerId = event.pointerId;
  markRuntimeWorking();
  petFrame.setPointerCapture(event.pointerId);
  window.petRuntime.setIgnoreMouseEvents(false);
  const screenPoint = screenPointFromPointerEvent(event);
  window.petRuntime.startWindowDrag(screenPoint);
  const canvasPoint = canvasPointFromMouseEvent(event);
  if (isInsidePetHitArea(canvasPoint.x, canvasPoint.y, bundle)) {
    window.petRuntime.recordPoke(screenPoint);
    markRuntimePoked();
    player.tap();
  }
});

petFrame.addEventListener("pointermove", (event) => {
  if (scalingPointerId === event.pointerId && scaleDragSession) {
    event.preventDefault();
    const requestedScale = calculateDraggedRuntimeScale(
      scaleDragSession,
      screenPointFromPointerEvent(event),
      bundle.scaleLimits
    );
    if (requestedScale !== null) {
      markRuntimeWorking();
      scheduleRuntimeScale(requestedScale, "pointer");
    }
    return;
  }
  if (draggingPointerId !== event.pointerId) {
    return;
  }
  event.preventDefault();
  markRuntimeWorking();
  window.petRuntime.dragWindowTo(screenPointFromPointerEvent(event));
});

petFrame.addEventListener("pointerup", endDragIfActive);
petFrame.addEventListener("pointercancel", endDragIfActive);
petFrame.addEventListener(
  "wheel",
  (event) => {
    const framePoint = framePointFromMouseEvent(event);
    if (!isPointInRuntimeFrame(framePoint, frameSize())) {
      return;
    }
    event.preventDefault();
    markRuntimeWorking();
    scheduleRuntimeScale(nextRuntimeScale(runtimeScale, event.deltaY, bundle.scaleLimits, event.deltaMode), "wheel");
  },
  { passive: false }
);
window.addEventListener("blur", () => {
  endWindowDrag();
  endScaleDrag();
});

function endDragIfActive(event: PointerEvent): void {
  if (scalingPointerId === event.pointerId) {
    if (petFrame.hasPointerCapture(event.pointerId)) {
      petFrame.releasePointerCapture(event.pointerId);
    }
    endScaleDrag();
    return;
  }
  if (draggingPointerId !== event.pointerId) {
    return;
  }
  if (petFrame.hasPointerCapture(event.pointerId)) {
    petFrame.releasePointerCapture(event.pointerId);
  }
  endWindowDrag();
}

function endWindowDrag(): void {
  if (draggingPointerId === null) {
    return;
  }
  draggingPointerId = null;
  window.petRuntime.endWindowDrag();
}

function endScaleDrag(): void {
  scalingPointerId = null;
  scaleDragSession = null;
  setFrameResizeAffordanceVisible(false);
}

function screenPointFromPointerEvent(event: PointerEvent): { x: number; y: number } {
  return {
    x: event.screenX,
    y: event.screenY
  };
}

function canvasPointFromMouseEvent(event: MouseEvent): { x: number; y: number } {
  const rect = petCanvas.getBoundingClientRect();
  return mapCssPointToCanvasPoint(
    { x: event.clientX - rect.left, y: event.clientY - rect.top },
    { width: rect.width, height: rect.height },
    bundle.manifest.canvas
  );
}

function framePointFromMouseEvent(event: MouseEvent): { x: number; y: number } {
  const rect = petFrame.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function frameSize(): { width: number; height: number } {
  return {
    width: window.innerWidth,
    height: window.innerHeight
  };
}

function frameCenterScreenPoint(): { x: number; y: number } {
  return {
    x: window.screenX + window.innerWidth / 2,
    y: window.screenY + window.innerHeight / 2
  };
}

function shouldStartScaleDrag(point: { x: number; y: number }, event: PointerEvent): boolean {
  return event.shiftKey || isPointInRuntimeResizeZone(point, frameSize());
}

function cursorForPointer(point: { x: number; y: number }, event: MouseEvent): string {
  if (!isPointInRuntimeFrame(point, frameSize())) {
    return "default";
  }
  if (event.shiftKey || isPointInRuntimeResizeZone(point, frameSize())) {
    return "nwse-resize";
  }
  return "grab";
}

function setFrameResizeAffordanceVisible(visible: boolean): void {
  petFrame.classList.toggle(RESIZE_AFFORDANCE_CLASS, visible);
}

function scheduleRuntimeScale(requestedScale: number, source: RuntimeScaleSource): void {
  void applyRuntimeScale(requestedScale, source).catch(logRuntimeError);
}

async function applyRuntimeScale(requestedScale: number, source: RuntimeScaleSource): Promise<number> {
  if (requestedScale === runtimeScale) {
    return runtimeScale;
  }
  const requestSerial = (scaleRequestSerial += 1);
  const appliedScale = await window.petRuntime.setWindowScale(requestedScale, source);
  if (requestSerial === scaleRequestSerial) {
    runtimeScale = appliedScale;
  }
  return appliedScale;
}

function logRuntimeError(error: unknown): void {
  console.error(error instanceof Error ? error.message : String(error));
}

function render(timestamp: number): void {
  const deltaMs = timestamp - lastTimestamp;
  lastTimestamp = timestamp;
  applyRuntimePetState(stateMachine.advance(deltaMs, timestamp));
  player.advance(deltaMs);
  drawCurrentFrame();
  drawLive2DRendererSpikeFrame(timestamp);
  reportSmokeResultIfReady();
  requestAnimationFrame(render);
}

function drawCurrentFrame(): void {
  const animation = bundle.manifest.animations[player.currentAnimationName()];
  const atlas = bundle.manifest.assets.atlases.find((candidate) => candidate.id === animation.atlas);
  if (!atlas) {
    return;
  }
  const image = atlasImages.get(atlas.id);
  if (!image) {
    return;
  }

  const frame = player.currentFrame();
  const sourceX = (frame.index % atlas.columns) * atlas.frameWidth;
  const sourceY = Math.floor(frame.index / atlas.columns) * atlas.frameHeight;

  drawingContext.clearRect(0, 0, petCanvas.width, petCanvas.height);
  drawingContext.drawImage(
    image,
    sourceX,
    sourceY,
    atlas.frameWidth,
    atlas.frameHeight,
    0,
    0,
    bundle.manifest.canvas.width,
    bundle.manifest.canvas.height
  );
  recordDraw(frame.index);
  recordTapExpressionFrame(frame.index);
}

function recordDraw(frameIndex: number): void {
  if (initialFrameIndex === null) {
    initialFrameIndex = frameIndex;
  }
  currentFrameIndex = frameIndex;
  drawCount += 1;
}

function isInsidePetHitArea(x: number, y: number, runtimeBundle: RuntimeBundle): boolean {
  return isPointInsideRuntimeHitArea(x, y, runtimeBundle.manifest.hitArea, canvasAlphaSampler);
}

function rectLikeFromDomRect(rect: DOMRect): { x: number; y: number; width: number; height: number } {
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height
  };
}

async function loadAtlases(runtimeBundle: RuntimeBundle): Promise<Map<string, HTMLImageElement>> {
  const images = new Map<string, HTMLImageElement>();
  await Promise.all(
    runtimeBundle.manifest.assets.atlases.map(async (atlas) => {
      const image = await loadImage(atlas, runtimeBundle);
      images.set(atlas.id, image);
    })
  );
  return images;
}

function loadImage(atlas: PetAtlas, runtimeBundle: RuntimeBundle): Promise<HTMLImageElement> {
  const atlasRef = runtimeBundle.atlases.find((candidate) => candidate.id === atlas.id);
  if (!atlasRef) {
    throw new Error(`Missing runtime URL for atlas ${atlas.id}`);
  }
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load atlas ${atlas.id} from ${atlasRef.url}`));
    image.src = atlasRef.url;
  });
}

drawCurrentFrame();
window.petRuntime.rendererReady();
requestAnimationFrame(render);

function reportSmokeResultIfReady(): void {
  if (smokeResultReported || smokeResultReporting || initialFrameIndex === null) {
    return;
  }
  const renderLoopAdvanced = drawCount >= 2 && currentFrameIndex !== initialFrameIndex;
  if (!renderLoopAdvanced || isLive2DRendererSmokePending()) {
    return;
  }
  smokeResultReporting = true;
  void reportSmokeResultAfterInteractions(renderLoopAdvanced);
}

async function reportSmokeResultAfterInteractions(renderLoopAdvanced: boolean): Promise<void> {
  try {
    await exerciseSmokeInteractionsIfNeeded();
    await waitForLive2DRendererSmokeEvidenceAfterInteractions();
  } catch (error) {
    logRuntimeError(error);
  }
  smokeResultReported = true;
  window.petRuntime.reportSmokeResult(createSmokeResult(renderLoopAdvanced));
}

async function exerciseSmokeInteractionsIfNeeded(): Promise<void> {
  if (!bundle.smoke || smokeInteractionsExercised) {
    return;
  }
  smokeInteractionsExercised = true;
  await exerciseRuntimeMotionTuningForSmoke();
  applyRuntimeMotionCue({
    direction: "right",
    motionIntensity: 0.82,
    state: "approaching"
  });
  applyRuntimeMotionCue({
    direction: "left",
    motionIntensity: 0.72,
    state: "dodging"
  });
  exerciseQuietRecoveryForSmoke();
  applyRuntimeMotionCue({
    direction: "right",
    motionIntensity: 0.82,
    state: "stopped"
  });
  const smokePokePoint = frameCenterScreenPoint();
  window.petRuntime.recordPoke(smokePokePoint);
  window.petRuntime.recordPoke(smokePokePoint);
  await waitForSmokeMotion(1100);
  markRuntimePoked();
  player.tap();
  drawTapExpressionFramesForSmoke();
  window.petRuntime.startWindowDrag({ x: 100, y: 100 });
  markRuntimeWorking();
  window.petRuntime.dragWindowTo({ x: 112, y: 116 });
  window.petRuntime.endWindowDrag();
  runtimeScale = await applyRuntimeScale(nextRuntimeScale(runtimeScale, -24, bundle.scaleLimits), "wheel");
  const scaleSession = createRuntimeScaleDragSession({
    origin: { x: 128, y: 128 },
    pointer: { x: 220, y: 220 },
    scale: runtimeScale
  }, bundle.scaleLimits);
  const pointerScale = calculateDraggedRuntimeScale(scaleSession, { x: 240, y: 240 }, bundle.scaleLimits);
  if (pointerScale !== null) {
    runtimeScale = await applyRuntimeScale(pointerScale, "pointer");
  }
}

function createSmokeResult(renderLoopAdvanced: boolean): RuntimeSmokeResult {
  return {
    atlasLoaded: atlasImages.size === bundle.manifest.assets.atlases.length,
    bundleLoaded: bundle.manifest.schemaVersion.startsWith("0.1."),
    dragMoved: false,
    idleAdvanced: renderLoopAdvanced,
    nonTransparentPixel: canvasHasNonTransparentPixel(),
    renderLoopAdvanced,
    scale: runtimeScale,
    scaleChanged: false,
    pointerScaleChanged: false,
    wheelScaleChanged: false,
    passiveCursorMovedWindow: false,
    cursorFollowAlphaHitTested: false,
    defaultDoudouEmotionIdsObserved: [...defaultDoudouEmotionIdsObserved],
    defaultDoudouEmotionScenariosObserved: [...defaultDoudouEmotionScenariosObserved],
    emotionMotionPhasesObserved: [],
    motionTuningApplied: smokeMotionTuningApplied,
    motionTuningPanelVisible: smokeMotionTuningPanelVisible,
    motionTuningPresetButtonVisible: smokeMotionTuningPresetButtonVisible,
    motionTuningPresetApplied: smokeMotionTuningPresetApplied,
    motionTuningPresetCopied: smokeMotionTuningPresetCopied,
    motionTuningPresetNames: smokeMotionTuningPresetNames,
    motionTuningPresetSaved: smokeMotionTuningPresetSaved,
    motionTuningPresetText: smokeMotionTuningPresetText,
    motionTuningSnapshot: runtimeMotionTuning,
    maxEmotionWariness: 0,
    runtimeStatesObserved: stateMachine.observed(),
    visualStateApplied: isRuntimeVisualStateApplied(),
    motionDirectionsObserved: [...motionDirectionsObserved],
    maxStopRebound,
    tapExpressionFramesObserved: [...tapExpressionFramesObserved],
    drawCount,
    initialFrameIndex: initialFrameIndex ?? -1,
    currentFrameIndex,
    frameHiddenByDefault: isRuntimeFrameHiddenByDefault(),
    frameVisibleOnResizeEdge: isRuntimeFrameVisibleOnResizeEdge(),
    live2DRendererSpike: live2DRendererSpikeSmokeResult()
  };
}

function applyRuntimeMotionCue(cue: RuntimePetMotionCue): void {
  applyRuntimePetState(stateMachine.motion(cue, performance.now()));
}

function exerciseQuietRecoveryForSmoke(): void {
  const nowMs = performance.now();
  applyRuntimePetState(stateMachine.motion({
    direction: "left",
    motionIntensity: 0.88,
    state: "retreating"
  }, nowMs));
  const watchingAtMs = nowMs + runtimeStateTiming.retreatingToWatchingMs;
  applyRuntimePetState(stateMachine.advance(runtimeStateTiming.retreatingToWatchingMs, watchingAtMs));
  const waitingAtMs = watchingAtMs + runtimeStateTiming.watchingToWaitingMs;
  applyRuntimePetState(stateMachine.advance(runtimeStateTiming.watchingToWaitingMs, waitingAtMs));
}

async function exerciseRuntimeMotionTuningForSmoke(): Promise<void> {
  smokeMotionTuningPanelVisible = Boolean(document.querySelector("#runtime-tuning-panel"));
  if (!bundle.motionTuningEnabled) {
    return;
  }
  const appliedTuning = await window.petRuntime.setMotionTuning({
    recoverySpeedPixelsPerSecond: 240,
    retreatDistancePixels: 260,
    watchingPauseMs: 560
  });
  applyRuntimeMotionTuning(appliedTuning);
  smokeMotionTuningApplied =
    runtimeMotionTuning.recoverySpeedPixelsPerSecond === 240 &&
    runtimeMotionTuning.retreatDistancePixels === 260 &&
    runtimeMotionTuning.watchingPauseMs === 560;
  smokeMotionTuningPresetButtonVisible = Boolean(document.querySelector("#runtime-copy-tuning-preset"));
  smokeMotionTuningPresetText = currentRuntimeMotionTuningPresetText();
  smokeMotionTuningPresetCopied = await copyRuntimeMotionTuningPreset();
  const smokePresetName = "烟测节奏";
  runtimeMotionTuningPresets = await window.petRuntime.saveMotionTuningPreset(smokePresetName, runtimeMotionTuning);
  updateRuntimePresetList();
  smokeMotionTuningPresetNames = runtimeMotionTuningPresets.map((preset) => preset.name);
  smokeMotionTuningPresetSaved = smokeMotionTuningPresetNames.includes(smokePresetName);
  smokeMotionTuningPresetApplied = await applyRuntimeMotionTuningPreset(smokePresetName);
}

function setupRuntimeTuningPanel(): void {
  if (!bundle.motionTuningEnabled) {
    return;
  }

  const panel = document.createElement("section");
  panel.id = "runtime-tuning-panel";
  panel.setAttribute("aria-label", "动作调参");
  panel.className = "runtime-tuning-panel";

  const title = document.createElement("h2");
  title.textContent = "动作调参";
  panel.append(title);

  for (const control of runtimeTuningControls) {
    panel.append(createRuntimeTuningControl(control));
  }

  panel.append(createRuntimePresetControls());

  const actionRow = document.createElement("div");
  actionRow.className = "runtime-tuning-actions";

  const copyButton = document.createElement("button");
  copyButton.id = "runtime-copy-tuning-preset";
  copyButton.type = "button";
  copyButton.textContent = "复制预设";
  copyButton.addEventListener("click", () => {
    void copyRuntimeMotionTuningPreset();
  });

  const resetButton = document.createElement("button");
  resetButton.type = "button";
  resetButton.textContent = "重置";
  resetButton.addEventListener("click", () => {
    void updateRuntimeMotionTuning(RUNTIME_MOTION_TUNING_DEFAULTS);
  });
  actionRow.append(copyButton, resetButton);
  panel.append(actionRow);

  tuningPresetStatus = document.createElement("div");
  tuningPresetStatus.className = "runtime-tuning-status";
  tuningPresetStatus.setAttribute("aria-live", "polite");
  panel.append(tuningPresetStatus);

  panel.addEventListener("pointerdown", (event) => event.stopPropagation());
  panel.addEventListener("pointermove", (event) => event.stopPropagation());
  panel.addEventListener("wheel", (event) => event.stopPropagation(), { passive: true });
  petFrame.append(panel);
  smokeMotionTuningPanelVisible = true;
  updateRuntimeTuningPanelValues();
  updateRuntimePresetList();
}

function createRuntimePresetControls(): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "runtime-tuning-presets";

  tuningPresetNameInput = document.createElement("input");
  tuningPresetNameInput.id = "runtime-tuning-preset-name";
  tuningPresetNameInput.type = "text";
  tuningPresetNameInput.maxLength = 32;
  tuningPresetNameInput.placeholder = "预设名称";
  tuningPresetNameInput.setAttribute("aria-label", "预设名称");

  const saveButton = document.createElement("button");
  saveButton.id = "runtime-save-tuning-preset";
  saveButton.type = "button";
  saveButton.textContent = "保存预设";
  saveButton.addEventListener("click", () => {
    void saveRuntimeMotionTuningPresetFromPanel();
  });

  tuningPresetSelect = document.createElement("select");
  tuningPresetSelect.id = "runtime-tuning-preset-list";
  tuningPresetSelect.setAttribute("aria-label", "已保存预设");

  const applyButton = document.createElement("button");
  applyButton.id = "runtime-apply-tuning-preset";
  applyButton.type = "button";
  applyButton.textContent = "套用";
  applyButton.addEventListener("click", () => {
    void applyRuntimeMotionTuningPreset(tuningPresetSelect?.value ?? "");
  });

  wrapper.append(tuningPresetNameInput, saveButton, tuningPresetSelect, applyButton);
  return wrapper;
}

function createRuntimeTuningControl(control: RuntimeTuningControl): HTMLElement {
  const wrapper = document.createElement("label");
  wrapper.className = "runtime-tuning-control";

  const caption = document.createElement("span");
  caption.textContent = control.label;

  const value = document.createElement("output");
  value.setAttribute("for", `runtime-tuning-${control.key}`);

  const input = document.createElement("input");
  input.id = `runtime-tuning-${control.key}`;
  input.type = "range";
  input.min = String(RUNTIME_MOTION_TUNING_LIMITS[control.key].min);
  input.max = String(RUNTIME_MOTION_TUNING_LIMITS[control.key].max);
  input.step = String(control.step);
  input.value = String(runtimeMotionTuning[control.key]);
  input.addEventListener("input", () => {
    void updateRuntimeMotionTuning({
      [control.key]: Number(input.value)
    });
  });

  tuningPanelOutputs.set(control.key, value);
  tuningPanelInputs.set(control.key, input);

  wrapper.append(caption, input, value);
  return wrapper;
}

async function updateRuntimeMotionTuning(patch: Partial<RuntimeMotionTuning>): Promise<void> {
  const appliedTuning = await window.petRuntime.setMotionTuning(patch);
  applyRuntimeMotionTuning(appliedTuning);
}

async function saveRuntimeMotionTuningPresetFromPanel(): Promise<boolean> {
  const name = tuningPresetNameInput?.value.trim() ?? "";
  if (!name) {
    setTuningPresetStatus("请输入预设名");
    return false;
  }
  runtimeMotionTuningPresets = await window.petRuntime.saveMotionTuningPreset(name, runtimeMotionTuning);
  updateRuntimePresetList();
  if (tuningPresetSelect) {
    tuningPresetSelect.value = normalizeRuntimePresetName(name);
  }
  setTuningPresetStatus("已保存预设");
  return true;
}

async function applyRuntimeMotionTuningPreset(name: string): Promise<boolean> {
  const preset = runtimeMotionTuningPresets.find((candidate) => candidate.name === name);
  if (!preset) {
    setTuningPresetStatus("请选择预设");
    return false;
  }
  const appliedTuning = await window.petRuntime.setMotionTuning(preset.tuning);
  applyRuntimeMotionTuning(appliedTuning);
  if (tuningPresetNameInput) {
    tuningPresetNameInput.value = preset.name;
  }
  if (tuningPresetSelect) {
    tuningPresetSelect.value = preset.name;
  }
  setTuningPresetStatus("已套用预设");
  return true;
}

async function copyRuntimeMotionTuningPreset(): Promise<boolean> {
  const presetText = currentRuntimeMotionTuningPresetText();
  const copied = await window.petRuntime.copyMotionTuningPreset(presetText);
  setTuningPresetStatus(copied ? "已复制预设" : "复制失败");
  return copied;
}

function currentRuntimeMotionTuningPresetText(): string {
  return formatRuntimeMotionTuningPreset(runtimeMotionTuning);
}

function applyRuntimeMotionTuning(nextTuning: RuntimeMotionTuning): void {
  runtimeMotionTuning = resolveRuntimeMotionTuning(nextTuning);
  Object.assign(runtimeStateTiming, createRuntimeStateTiming(runtimeMotionTuning));
  setTuningPresetStatus("");
  updateRuntimeTuningPanelValues();
}

function updateRuntimePresetList(): void {
  if (!tuningPresetSelect) {
    return;
  }
  tuningPresetSelect.replaceChildren();
  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent = runtimeMotionTuningPresets.length > 0 ? "选择预设" : "暂无预设";
  tuningPresetSelect.append(emptyOption);
  for (const preset of runtimeMotionTuningPresets) {
    const option = document.createElement("option");
    option.value = preset.name;
    option.textContent = preset.name;
    tuningPresetSelect.append(option);
  }
}

function setTuningPresetStatus(text: string): void {
  if (tuningPresetStatus) {
    tuningPresetStatus.textContent = text;
  }
}

function normalizeRuntimePresetName(name: string): string {
  return name.trim().replace(/\s+/g, " ").slice(0, 32);
}

function updateRuntimeTuningPanelValues(): void {
  for (const control of runtimeTuningControls) {
    const value = runtimeMotionTuning[control.key];
    const input = tuningPanelInputs.get(control.key);
    const output = tuningPanelOutputs.get(control.key);
    if (input) {
      input.value = String(value);
    }
    if (output) {
      output.value = `${value}${control.unit}`;
    }
  }
}

function markRuntimePoked(): void {
  applyRuntimePetState(stateMachine.tap(performance.now()));
}

function markRuntimeWorking(): void {
  applyRuntimePetState(stateMachine.working(performance.now()));
}

function applyRuntimePetState(state: RuntimePetState): void {
  const previousState = visualState;
  visualState = state;
  petFrame.dataset.runtimeState = state;
  recordDefaultDoudouEmotionState(state, previousState);
  for (const candidate of RUNTIME_PET_STATES) {
    petFrame.classList.toggle(runtimePetStateClass(candidate), candidate === state);
  }
  applyRuntimeVisualPose();
}

function recordDefaultDoudouEmotionState(state: RuntimePetState, previousState: RuntimePetState): void {
  const scenario = doudouEmotionScenarioForRuntimeState(state, previousState);
  const scenarioEmotion = doudouEmotionForRuntimeScenario(scenario);
  petFrame.dataset.doudouEmotion = scenarioEmotion.id;
  petFrame.dataset.doudouEmotionLabel = scenarioEmotion.labelZh;
  defaultDoudouEmotionIdsObserved.add(scenarioEmotion.id);
  defaultDoudouEmotionScenariosObserved.add(scenario);
  switchLive2DRendererSpikeExpression(scenarioEmotion.id);
}

function isRuntimeVisualStateApplied(): boolean {
  const currentState = stateMachine.current();
  return (
    petFrame.dataset.runtimeState === currentState &&
    petFrame.classList.contains(runtimePetStateClass(currentState)) &&
    petFrame.style.getPropertyValue("--runtime-approach-scale") !== ""
  );
}

function applyRuntimeVisualPose(): void {
  const pose = stateMachine.pose();
  const directionX = horizontalDirectionMultiplier(pose.direction);
  const motionIntensity = clamp01(pose.motionIntensity);
  const stopRebound = clamp01(pose.stopRebound);
  motionDirectionsObserved.add(pose.direction);
  maxStopRebound = Math.max(maxStopRebound, stopRebound);
  petFrame.dataset.motionDirection = pose.direction;
  petFrame.style.setProperty("--runtime-approach-lift", `${-(3 + motionIntensity * 5).toFixed(2)}px`);
  petFrame.style.setProperty("--runtime-approach-rotate", `${(directionX * (2 + motionIntensity * 5)).toFixed(2)}deg`);
  petFrame.style.setProperty("--runtime-approach-scale", (1 + motionIntensity * 0.028).toFixed(3));
  petFrame.style.setProperty("--runtime-retreat-x", `${(-directionX * (14 + motionIntensity * 18)).toFixed(2)}px`);
  petFrame.style.setProperty("--runtime-retreat-rotate", `${(-directionX * (8 + motionIntensity * 6)).toFixed(2)}deg`);
  petFrame.style.setProperty("--runtime-watch-rotate", `${(directionX * (3 + motionIntensity * 4)).toFixed(2)}deg`);
  petFrame.style.setProperty("--runtime-watch-scale", (1 + motionIntensity * 0.018).toFixed(3));
  petFrame.style.setProperty("--runtime-stop-drop", `${(2 + stopRebound * 5).toFixed(2)}px`);
  petFrame.style.setProperty("--runtime-stop-scale-x", (1 + stopRebound * 0.03).toFixed(3));
  petFrame.style.setProperty("--runtime-stop-scale-y", (1 - stopRebound * 0.045).toFixed(3));
  petFrame.style.setProperty("--runtime-dodge-x", `${(-directionX * (8 + motionIntensity * 10)).toFixed(2)}px`);
  petFrame.style.setProperty("--runtime-dodge-rotate", `${(-directionX * (6 + motionIntensity * 5)).toFixed(2)}deg`);
  petFrame.style.setProperty("--runtime-click-pop", pose.clickExpression === "tap_react" ? "1.075" : "1.04");
}

function horizontalDirectionMultiplier(direction: string): number {
  if (direction === "left") {
    return -1;
  }
  if (direction === "right") {
    return 1;
  }
  return 0;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function recordTapExpressionFrame(frameIndex: number): void {
  if (player.currentAnimationName() === bundle.manifest.behavior.onTap) {
    tapExpressionFramesObserved.add(frameIndex);
  }
}

function drawTapExpressionFramesForSmoke(): void {
  const tapAnimation = bundle.manifest.animations[bundle.manifest.behavior.onTap];
  for (const frame of tapAnimation.frames) {
    drawCurrentFrame();
    player.advance(frame.durationMs);
  }
}

function waitForSmokeMotion(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

async function waitForLive2DRendererSmokeEvidenceAfterInteractions(): Promise<void> {
  const deadlineMs = performance.now() + DOUDOU_LIVE2D_RENDERER_SMOKE_SETTLE_TIMEOUT_MS;
  while (!isLive2DRendererSmokeSettledAfterInteractions() && performance.now() < deadlineMs) {
    await waitForSmokeMotion(DOUDOU_LIVE2D_RENDERER_SMOKE_SETTLE_POLL_MS);
  }
}

function isLive2DRendererSmokeSettledAfterInteractions(): boolean {
  return isDoudouLive2DRendererSmokeSettledAfterInteractions({
    rendererAssetProbe: live2DOfficialRendererAssetProbe,
    runtimeModule: live2DOfficialRendererHostEvidence()
  });
}

function isRuntimeFrameHiddenByDefault(): boolean {
  setFrameResizeAffordanceVisible(false);
  return !isRuntimeFrameAffordanceVisible();
}

function isRuntimeFrameVisibleOnResizeEdge(): boolean {
  setFrameResizeAffordanceVisible(true);
  const visible = isRuntimeFrameAffordanceVisible();
  setFrameResizeAffordanceVisible(false);
  return visible;
}

function isRuntimeFrameAffordanceVisible(): boolean {
  const frameRect = petFrame.getBoundingClientRect();
  const canvasRect = petCanvas.getBoundingClientRect();
  const frameStyle = getComputedStyle(petFrame);
  const cornerOpacity = Number.parseFloat(getComputedStyle(petFrame, "::after").opacity);
  return (
    frameRect.width > canvasRect.width &&
    frameRect.height > canvasRect.height &&
    frameStyle.borderTopColor !== "rgba(0, 0, 0, 0)" &&
    cornerOpacity > 0
  );
}

function canvasHasNonTransparentPixel(): boolean {
  const imageData = drawingContext.getImageData(0, 0, petCanvas.width, petCanvas.height);
  for (let index = 3; index < imageData.data.length; index += 4) {
    if (imageData.data[index] > 0) {
      return true;
    }
  }
  return false;
}

function setupLive2DRendererSpike(): void {
  const config = bundle.live2DRendererSpike;
  if (!config) {
    return;
  }
  live2DRendererSpikeSdkCalls = [];
  live2DRendererSpikeActiveEmotionId = "calm_idle";
  probeOfficialLive2DRendererAssets(config);
  live2DOfficialRendererHost = createDoudouOfficialLive2DRendererHost({
    canvas: live2DCanvas,
    config: config.officialRuntime,
    importRuntimeModule: importOfficialLive2DRendererRuntimeModule,
    loadCoreScript: loadOfficialLive2DCoreScript,
    sampleCanvasSignature: live2DOfficialCanvasPixelSignature
  });
  void live2DOfficialRendererHost.loadDefaultModel(config.library)
    .then(updateOfficialLive2DCanvasRuntimeState)
    .catch(() => {
      updateOfficialLive2DCanvasRuntimeState();
    });
  live2DRendererSpike = createDoudouWebCubismRendererSpike({
    modelId: config.modelId,
    model3Json: config.model3Json,
    runtime: createInstrumentedLive2DRendererSpikeRuntime(config)
  });
  live2DRendererSpike.loadDefaultModel(config.library);
}

async function importOfficialLive2DRendererRuntimeModule(
  moduleUrl: string
): Promise<DoudouOfficialLive2DRendererRuntimeModule> {
  return await import(/* @vite-ignore */ moduleUrl) as DoudouOfficialLive2DRendererRuntimeModule;
}

function loadOfficialLive2DCoreScript(coreScriptUrl: string): Promise<void> {
  if (loadedOfficialLive2DCoreScripts.has(coreScriptUrl)) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.async = true;
    script.src = coreScriptUrl;
    script.onload = () => {
      loadedOfficialLive2DCoreScripts.add(coreScriptUrl);
      resolve();
    };
    script.onerror = () => {
      reject(new Error("Failed to load Live2D Core script."));
    };
    document.head.append(script);
  });
}

function updateOfficialLive2DCanvasRuntimeState(
  evidence = live2DOfficialRendererHostEvidence()
): void {
  petFrame.dataset.live2dOfficialRuntime = evidence.runtimeModuleProbe === "loaded" && evidence.modelLoaded
    ? "loaded"
    : "fallback";
}

function probeOfficialLive2DRendererAssets(config: RuntimeDefaultDoudouLive2DRendererSpikeConfig): void {
  const officialRuntime = config.officialRuntime.publicEvidence;
  const rendererAssets = config.officialRuntime.rendererAssets;
  if (!officialRuntime.configured) {
    live2DOfficialRendererAssetProbe = "not_configured";
    return;
  }
  if (!officialRuntime.available || !rendererAssets) {
    live2DOfficialRendererAssetProbe = "unavailable";
    return;
  }
  live2DOfficialRendererAssetProbe = "model3_fetch_pending";
  void fetch(rendererAssets.model3JsonUrl)
    .then(async (response) => {
      if (!response.ok) {
        live2DOfficialRendererAssetProbe = "model3_fetch_failed";
        return;
      }
      const model3Json = await response.json() as unknown;
      live2DOfficialRendererAssetProbe = isRecord(model3Json) && model3Json.Version === 3
        ? "model3_fetched"
        : "model3_fetch_failed";
    })
    .catch(() => {
      live2DOfficialRendererAssetProbe = "model3_fetch_failed";
    });
}

function createInstrumentedLive2DRendererSpikeRuntime(
  config: RuntimeDefaultDoudouLive2DRendererSpikeConfig
): DoudouWebCubismRendererSpikeRuntime {
  type InstrumentedMotion = {
    emotionId: DefaultDoudouEmotionId;
    id: string;
  };
  let nextExpressionIndex = 0;
  let activeExpressionEmotionId: DefaultDoudouEmotionId = "calm_idle";

  return {
    CubismExpressionMotion: {
      create(buffer, size) {
        const expressionJson = JSON.parse(new TextDecoder().decode(buffer.slice(0, size))) as {
          Parameters?: unknown;
          Type?: unknown;
        };
        const request = config.library.loadRequests[nextExpressionIndex];
        nextExpressionIndex += 1;
        const emotionId = request?.emotionId ?? "calm_idle";
        const parameterCount = Array.isArray(expressionJson.Parameters) ? expressionJson.Parameters.length : 0;
        live2DRendererSpikeSdkCalls.push(
          `CubismExpressionMotion.create:${String(expressionJson.Type)}:${parameterCount}`
        );
        return {
          emotionId,
          id: `renderer-motion:${emotionId}`
        };
      }
    },
    expressionManager: {
      startMotionPriority(motion, autoDelete, priority) {
        const expressionMotion = motion as InstrumentedMotion;
        activeExpressionEmotionId = expressionMotion.emotionId;
        live2DRendererSpikeSdkCalls.push(
          `CubismMotionManager.startMotionPriority:${expressionMotion.id}:${autoDelete}:${priority}`
        );
      },
      updateMotion(_model, deltaTimeSeconds) {
        live2DRendererSpikeSdkCalls.push(`CubismMotionManager.updateMotion:${deltaTimeSeconds.toFixed(3)}`);
        return true;
      }
    },
    model: {
      update() {
        live2DRendererSpikeSdkCalls.push("CubismModel.update");
      }
    },
    renderer: {
      drawModel() {
        live2DRendererSpikeSdkCalls.push("CubismRenderer.drawModel");
        drawLive2DExpressionOverlay(activeExpressionEmotionId);
      }
    }
  };
}

function drawLive2DRendererSpikeFrame(timestamp: number): void {
  if (!live2DRendererSpike) {
    return;
  }
  live2DRendererSpike.renderFrame(timestamp);
  if (live2DOfficialRendererHost) {
    updateOfficialLive2DCanvasRuntimeState(live2DOfficialRendererHost.renderFrame(timestamp));
  }
}

function switchLive2DRendererSpikeExpression(targetEmotionId: DefaultDoudouEmotionId): void {
  const config = bundle.live2DRendererSpike;
  if (!config || !live2DRendererSpike || targetEmotionId === live2DRendererSpikeActiveEmotionId) {
    return;
  }
  const playback = live2DRendererSpike.switchExpression(
    config.library,
    live2DRendererSpikeActiveEmotionId,
    targetEmotionId,
    performance.now(),
    "normal"
  );
  if (playback.ok) {
    live2DRendererSpikeActiveEmotionId = targetEmotionId;
  }
  if (live2DOfficialRendererHost) {
    void live2DOfficialRendererHost.switchExpression(config.library, targetEmotionId)
      .then(() => updateOfficialLive2DCanvasRuntimeState())
      .catch(() => updateOfficialLive2DCanvasRuntimeState());
  }
}

function live2DRendererSpikeSmokeResult(): RuntimeLive2DRendererSpikeSmokeResult | null {
  const config = bundle.live2DRendererSpike;
  if (!live2DRendererSpike || !config) {
    return null;
  }
  return {
    ...live2DRendererSpike.evidence(),
    enabled: true,
    officialRuntime: {
      ...config.officialRuntime.publicEvidence,
      canvasLayerVisible: live2DOfficialCanvasLayerVisible(),
      canvasNonTransparentPixel: live2DOfficialCanvasHasNonTransparentPixel(),
      rendererAssetProbe: live2DOfficialRendererAssetProbe,
      runtimeModule: live2DOfficialRendererHostEvidence()
    },
    sdkCallsObserved: live2DRendererSpikeSdkCalls.slice(0, 96)
  };
}

function live2DOfficialRendererHostEvidence(): DoudouOfficialLive2DRendererHostEvidence {
  const config = bundle.live2DRendererSpike;
  if (live2DOfficialRendererHost) {
    return live2DOfficialRendererHost.evidence();
  }
  return {
    activeEmotionId: "calm_idle",
    drawCalls: 0,
    expressionAppliedAfterFrame: false,
    expressionCanvasChangedAfterFrame: false,
    expressionCount: 0,
    expressionEmotionIdsObserved: [],
    expressionSwitches: 0,
    frameLoopAdvanced: false,
    modelLoaded: false,
    pendingExpressionSwitches: 0,
    runtimeFailureReason: null,
    runtimeLifecycle: {
      drawCalls: 0,
      expressionLoadCalls: 0,
      expressionSetCalls: 0,
      modelUpdateCalls: 0,
      updateMotionCalls: 0
    },
    runtimeModuleProbe: config?.officialRuntime.publicEvidence.runtimeModule?.configured
      ? "load_pending"
      : "not_configured",
    updateCalls: 0
  };
}

function live2DOfficialCanvasLayerVisible(): boolean {
  if (petFrame.dataset.live2dOfficialRuntime !== "loaded") {
    return false;
  }
  const live2DRect = live2DCanvas.getBoundingClientRect();
  if (live2DRect.width <= 0 || live2DRect.height <= 0) {
    return false;
  }
  const petOpacity = Number.parseFloat(getComputedStyle(petCanvas).opacity);
  const live2DOpacity = Number.parseFloat(getComputedStyle(live2DCanvas).opacity);
  return live2DOpacity > 0.5 && petOpacity < 0.5;
}

function live2DOfficialCanvasHasNonTransparentPixel(): boolean {
  if (!live2DOfficialCanvasLayerVisible()) {
    return false;
  }
  return live2DCanvasWebGLHasNonTransparentPixel() || live2DCanvas2DHasNonTransparentPixel();
}

function live2DOfficialCanvasPixelSignature(): string | null {
  if (!live2DOfficialCanvasLayerVisible()) {
    return null;
  }
  return live2DCanvasWebGLPixelSignature() ?? live2DCanvas2DPixelSignature();
}

function live2DCanvas2DHasNonTransparentPixel(): boolean {
  const context2d = live2DCanvas.getContext("2d", { willReadFrequently: true });
  if (!context2d) {
    return false;
  }
  try {
    const imageData = context2d.getImageData(0, 0, live2DCanvas.width, live2DCanvas.height);
    return imageDataHasNonTransparentPixel(imageData.data);
  } catch {
    return false;
  }
}

function live2DCanvas2DPixelSignature(): string | null {
  const context2d = live2DCanvas.getContext("2d", { willReadFrequently: true });
  if (!context2d) {
    return null;
  }
  try {
    const imageData = context2d.getImageData(0, 0, live2DCanvas.width, live2DCanvas.height);
    return pixelDataSignature(imageData.data, live2DCanvas.width, live2DCanvas.height);
  } catch {
    return null;
  }
}

function live2DCanvasWebGLHasNonTransparentPixel(): boolean {
  const gl = live2DCanvas.getContext("webgl2") ?? live2DCanvas.getContext("webgl");
  if (!gl) {
    return false;
  }
  try {
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    if (width <= 0 || height <= 0) {
      return false;
    }
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    return imageDataHasNonTransparentPixel(pixels);
  } catch {
    return false;
  }
}

function live2DCanvasWebGLPixelSignature(): string | null {
  const gl = live2DCanvas.getContext("webgl2") ?? live2DCanvas.getContext("webgl");
  if (!gl) {
    return null;
  }
  try {
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    if (width <= 0 || height <= 0) {
      return null;
    }
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    return pixelDataSignature(pixels, width, height);
  } catch {
    return null;
  }
}

function imageDataHasNonTransparentPixel(data: Uint8ClampedArray | Uint8Array): boolean {
  for (let index = 3; index < data.length; index += 4) {
    if (data[index] > 0) {
      return true;
    }
  }
  return false;
}

function pixelDataSignature(data: Uint8ClampedArray | Uint8Array, width: number, height: number): string {
  let hash = 2166136261;
  for (let index = 0; index < data.length; index += 1) {
    hash ^= data[index] ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return `${width}x${height}:${(hash >>> 0).toString(16)}`;
}

function isLive2DRendererSmokePending(): boolean {
  return isDoudouLive2DRendererSmokePending({
    rendererAssetProbe: live2DOfficialRendererAssetProbe,
    runtimeModule: live2DOfficialRendererHostEvidence()
  });
}

function drawLive2DExpressionOverlay(emotionId: DefaultDoudouEmotionId): void {
  if (!bundle.live2DRendererSpike || emotionId === "calm_idle") {
    return;
  }
  const color = live2DExpressionOverlayColor(emotionId);
  drawingContext.save();
  drawingContext.globalCompositeOperation = "source-over";
  drawingContext.globalAlpha = 0.38;
  drawingContext.fillStyle = color;
  drawingContext.beginPath();
  drawingContext.ellipse(78, 122, 18, 10, -0.18, 0, Math.PI * 2);
  drawingContext.ellipse(178, 122, 18, 10, 0.18, 0, Math.PI * 2);
  drawingContext.fill();
  drawingContext.globalAlpha = 0.48;
  drawingContext.beginPath();
  drawingContext.arc(196, 72, 5, 0, Math.PI * 2);
  drawingContext.arc(206, 88, 3, 0, Math.PI * 2);
  drawingContext.fill();
  drawingContext.restore();
}

function live2DExpressionOverlayColor(emotionId: DefaultDoudouEmotionId): string {
  switch (emotionId) {
    case "annoyed_pout":
      return "#ff8a65";
    case "comfort_soft":
      return "#75d6b5";
    case "curious_tilt":
      return "#78a8ff";
    case "delighted":
    case "happy_smile":
      return "#ffc857";
    case "focused_working":
      return "#72d1ff";
    case "sad_soft":
    case "teary":
      return "#8ab4ff";
    case "shy_blush":
      return "#ff8fb3";
    case "sleepy":
      return "#b49cff";
    case "surprised":
      return "#ffdf7e";
    case "calm_idle":
      return "#ffffff";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
