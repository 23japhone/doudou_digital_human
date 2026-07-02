import { createAnimationPlayer } from "./animation.js";
import type { PetAtlas } from "../pet_bundle/manifest.js";
import type { RuntimeBundle, RuntimeScaleSource, RuntimeSmokeResult } from "./runtime-types.js";
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
import "./styles.css";

const canvas = document.querySelector<HTMLCanvasElement>("#pet-canvas");
if (!canvas) {
  throw new Error("Missing pet canvas.");
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
const petFrame: HTMLElement = frame;
const drawingContext: CanvasRenderingContext2D = context;
const RESIZE_AFFORDANCE_CLASS = "is-resize-affordance-visible";

const bundle = await window.petRuntime.getBundle();
console.log(`pet renderer: loaded bundle ${bundle.manifest.id}`);
const player = createAnimationPlayer(bundle.manifest);
const stateMachine = createRuntimePetStateMachine();
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
const motionDirectionsObserved = new Set<string>();
const tapExpressionFramesObserved = new Set<number>();

petCanvas.width = bundle.manifest.canvas.width;
petCanvas.height = bundle.manifest.canvas.height;
petFrame.style.setProperty("--runtime-frame-padding", `${RUNTIME_FRAME_PADDING}px`);
applyRuntimePetState(visualState);

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
  if (!renderLoopAdvanced) {
    return;
  }
  smokeResultReporting = true;
  void reportSmokeResultAfterInteractions(renderLoopAdvanced);
}

async function reportSmokeResultAfterInteractions(renderLoopAdvanced: boolean): Promise<void> {
  try {
    await exerciseSmokeInteractionsIfNeeded();
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
  applyRuntimeMotionCue({
    direction: "left",
    motionIntensity: 0.88,
    state: "retreating"
  });
  applyRuntimeMotionCue({
    direction: "right",
    motionIntensity: 0.64,
    state: "watching"
  });
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
    mouseFollowMoved: false,
    cursorFollowAlphaHitTested: false,
    emotionMotionPhasesObserved: [],
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
    frameVisibleOnResizeEdge: isRuntimeFrameVisibleOnResizeEdge()
  };
}

function applyRuntimeMotionCue(cue: RuntimePetMotionCue): void {
  applyRuntimePetState(stateMachine.motion(cue, performance.now()));
}

function markRuntimePoked(): void {
  applyRuntimePetState(stateMachine.tap(performance.now()));
}

function markRuntimeWorking(): void {
  applyRuntimePetState(stateMachine.working(performance.now()));
}

function applyRuntimePetState(state: RuntimePetState): void {
  visualState = state;
  petFrame.dataset.runtimeState = state;
  for (const candidate of RUNTIME_PET_STATES) {
    petFrame.classList.toggle(runtimePetStateClass(candidate), candidate === state);
  }
  applyRuntimeVisualPose();
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
