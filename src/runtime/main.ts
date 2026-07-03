import { app, BrowserWindow, clipboard, ipcMain, Menu, screen } from "electron";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validatePetBundle, type ValidatedPetBundle } from "../pet_bundle/validate.js";
import { DEFAULT_DOUDOU_EMOTION_IDS } from "./default-doudou-emotions.js";
import { toDoudouLive2DExp3Json } from "./default-doudou-exp3.js";
import { doudouLive2DExpressionForEmotion } from "./default-doudou-live2d.js";
import {
  resolveDoudouOfficialLive2DRendererRuntime,
  type DoudouOfficialLive2DRendererRuntimeResolution
} from "./default-doudou-live2d-official-sdk-resolver.js";
import {
  calculateDraggedWindowPosition,
  createWindowDragSession,
  type ScreenPoint,
  type WindowDragSession
} from "./drag.js";
import type {
  RuntimeDefaultDoudouLive2DRendererSpikeConfig,
  RuntimeBundle,
  RuntimeCursorHitTestResult,
  RuntimeScaleSource,
  RuntimeSmokeResult
} from "./runtime-types.js";
import {
  RUNTIME_SCALE_LIMITS,
  calculateCenteredFramedWindowBounds,
  calculateFramedWindowSize,
  calculateRuntimeScaleFromFramedWindowSize,
  clampRuntimeScale
} from "./scale.js";
import {
  RUNTIME_CURSOR_DODGE_CONFIG,
  calculateCursorDodgeStep,
  calculateCursorFollowStep,
  createSmokeCursorFollowPoint,
  isCursorInsideRuntimeMotionActivationArea,
  type RuntimeMotionDirection,
  type RuntimeMotionPoint
} from "./motion.js";
import {
  classifyRuntimeEmotionMotionPhase,
  classifyRuntimeAlphaReaction,
  createRuntimeEmotionMemory,
  decayRuntimeEmotionMemory,
  recordRuntimePokeEmotion,
  runtimeMotionIntensityForEmotion,
  type RuntimeAlphaReaction,
  type RuntimeEmotionMotionPhase
} from "./reaction.js";
import type { RuntimeMotionPetState, RuntimePetMotionCue } from "./state.js";
import {
  RUNTIME_MOTION_TUNING_DEFAULTS,
  createRuntimeEmotionPhaseConfig,
  createRuntimeRecoveryFollowConfig,
  resolveRuntimeMotionTuning,
  runtimeRetreatDistanceForTuning,
  type RuntimeMotionTuning,
  type RuntimeMotionTuningPreset
} from "./tuning.js";
import {
  loadRuntimeMotionTuningPresets,
  saveRuntimeMotionTuningPresets,
  upsertRuntimeMotionTuningPreset
} from "./tuning-presets.js";
import { queryDoudouEmotionBehaviorForExplicitRuntimeInput } from "./default-doudou-emotion-trigger.js";

const currentDir = dirname(fileURLToPath(import.meta.url));
const RUNTIME_CURSOR_FOLLOW_INTERVAL_MS = 33;
const RUNTIME_CURSOR_FOLLOW_MAX_DELTA_MS = 100;
const RUNTIME_CURSOR_HIT_TEST_TIMEOUT_MS = 80;
const RUNTIME_CURSOR_FOLLOW_RESUME_DELAY_MS = 220;
const RUNTIME_CLIPBOARD_TEXT_MAX_LENGTH = 512;

interface RuntimeOptions {
  bundleDir: string;
  live2dModelDir?: string;
  live2dRendererSpike: boolean;
  live2dRuntimeModule?: string;
  live2dSdkDir?: string;
  readySignal: boolean;
  smoke: boolean;
  tuning: boolean;
}

let mainWindow: BrowserWindow | null = null;
let currentBundle: ValidatedPetBundle | null = null;
let smokeMode = false;
let readySignalMode = false;
let ignoreMouseEvents = false;
let dragSession: WindowDragSession | null = null;
let runtimeScale = RUNTIME_SCALE_LIMITS.default;
let smokeDragMoved = false;
let smokeScaleChanged = false;
let smokePointerScaleChanged = false;
let smokeWheelScaleChanged = false;
let smokePassiveCursorMovedWindow = false;
let smokeCursorFollowAlphaHitTested = false;
let smokeEmotionMotionPhasesObserved = new Set<RuntimeEmotionMotionPhase>();
let smokeMaxEmotionWariness = 0;
let runtimeMotionTuning = RUNTIME_MOTION_TUNING_DEFAULTS;
let runtimeMotionTuningEnabled = false;
let runtimeMotionTuningPresets: RuntimeMotionTuningPreset[] = [];
let live2DRendererSpikeEnabled = false;
let live2DOfficialRuntimeResolution: DoudouOfficialLive2DRendererRuntimeResolution = {
  available: false,
  configured: false,
  publicEvidence: {
    available: false,
    configured: false,
    reason: "not_configured"
  },
  reason: "not_configured"
};
let smokeTimeout: NodeJS.Timeout | null = null;
let cursorFollowTimer: NodeJS.Timeout | null = null;
let cursorFollowPausedUntil = 0;
let cursorFollowHitTestPending = false;
let cursorHitTestSerial = 0;
let lastCursorFollowTimestamp = 0;
let smokeCursorFollowPoint: RuntimeMotionPoint | null = null;
let lastApproachCue: Pick<RuntimePetMotionCue, "direction" | "motionIntensity"> = {
  direction: "none",
  motionIntensity: 0
};
let runtimeEmotionMemory = createRuntimeEmotionMemory();

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (!options.bundleDir) {
    console.error(
      "Usage: electron dist/src/runtime/main.js --bundle <bundle-dir> [--smoke] [--live2d-renderer-spike] [--live2d-sdk-dir <sdk-dir>] [--live2d-model-dir <model-dir>] [--live2d-runtime-module <module-file>]"
    );
    process.exit(2);
  }

  smokeMode = options.smoke ?? false;
  readySignalMode = options.readySignal ?? false;
  live2DRendererSpikeEnabled = Boolean(options.live2dRendererSpike || process.env.DOUDOU_LIVE2D_RENDERER_SPIKE === "1");
  runtimeMotionTuningEnabled = Boolean(options.tuning || process.env.DOUDOU_RUNTIME_TUNING === "1");
  runtimeMotionTuning = runtimeMotionTuningFromEnv(process.env);
  if (live2DRendererSpikeEnabled) {
    live2DOfficialRuntimeResolution = await resolveDoudouOfficialLive2DRendererRuntime({
      modelDir: options.live2dModelDir ?? process.env.DOUDOU_DEFAULT_DOUDOU_LIVE2D_MODEL_DIR,
      runtimeModuleFile: options.live2dRuntimeModule ?? process.env.DOUDOU_CUBISM_WEB_RUNTIME_MODULE,
      sdkDir: options.live2dSdkDir ?? process.env.DOUDOU_CUBISM_WEB_SDK_DIR
    });
  }
  applyRuntimeUserDataDirFromEnv(process.env);

  try {
    currentBundle = await validatePetBundle(options.bundleDir);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  await app.whenReady();
  runtimeMotionTuningPresets = runtimeMotionTuningEnabled
    ? await loadRuntimeMotionTuningPresets(runtimeMotionTuningPresetsPath())
    : [];
  createWindow(currentBundle);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0 && currentBundle) {
      createWindow(currentBundle);
    }
  });
}

function parseArgs(args: string[]): Partial<RuntimeOptions> {
  const options: Partial<RuntimeOptions> = {
    live2dRendererSpike: false,
    readySignal: false,
    smoke: false,
    tuning: false
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--bundle") {
      options.bundleDir = args[index + 1];
      index += 1;
    } else if (arg === "--smoke") {
      options.smoke = true;
    } else if (arg === "--ready-signal") {
      options.readySignal = true;
    } else if (arg === "--tuning") {
      options.tuning = true;
    } else if (arg === "--live2d-renderer-spike") {
      options.live2dRendererSpike = true;
    } else if (arg === "--live2d-sdk-dir") {
      options.live2dSdkDir = args[index + 1];
      index += 1;
    } else if (arg === "--live2d-model-dir") {
      options.live2dModelDir = args[index + 1];
      index += 1;
    } else if (arg === "--live2d-runtime-module") {
      options.live2dRuntimeModule = args[index + 1];
      index += 1;
    }
  }
  return options;
}

function createWindow(bundle: ValidatedPetBundle): void {
  const manifest = bundle.manifest;
  const rendererIndex = resolve(currentDir, "../../runtime/renderer/index.html");
  const initialSize = calculateFramedWindowSize(manifest.canvas, runtimeScale);

  mainWindow = new BrowserWindow({
    width: initialSize.width,
    height: initialSize.height,
    transparent: true,
    frame: false,
    resizable: false,
    hasShadow: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: "#00000000",
    title: manifest.name,
    webPreferences: {
      preload: join(currentDir, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const minSize = calculateFramedWindowSize(manifest.canvas, RUNTIME_SCALE_LIMITS.min);
  const maxSize = calculateFramedWindowSize(manifest.canvas, RUNTIME_SCALE_LIMITS.max);
  mainWindow.setMinimumSize(minSize.width, minSize.height);
  mainWindow.setMaximumSize(maxSize.width, maxSize.height);
  mainWindow.setAlwaysOnTop(true, "floating");
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setIgnoreMouseEvents(true, { forward: true });
  ignoreMouseEvents = true;
  runtimeEmotionMemory = createRuntimeEmotionMemory();
  smokeEmotionMotionPhasesObserved = new Set<RuntimeEmotionMotionPhase>();
  smokeMaxEmotionWariness = 0;
  smokeCursorFollowPoint = smokeMode ? createSmokeCursorFollowPoint(mainWindow.getBounds()) : null;
  startCursorFollowMotion();

  void mainWindow.loadFile(rendererIndex);
  if (smokeMode) {
    smokeTimeout = setTimeout(() => {
      console.error("runtime smoke: renderer did not become ready within 10s");
      app.exit(1);
    }, 10000);
  }

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription) => {
    console.error(`runtime load failed: ${errorCode} ${errorDescription}`);
    if (smokeMode) {
      app.exit(1);
    }
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error(`runtime renderer gone: ${details.reason}`);
    if (smokeMode) {
      app.exit(1);
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
    dragSession = null;
    stopCursorFollowMotion();
    cursorFollowHitTestPending = false;
    clearPendingCursorHitTests();
  });
}

ipcMain.handle("pet:get-bundle", () => {
  if (!currentBundle) {
    throw new Error("No validated pet bundle is loaded.");
  }
  const manifest = currentBundle.manifest;
  const runtimeBundle: RuntimeBundle = {
    manifest,
    atlases: manifest.assets.atlases.map((atlas) => ({
      id: atlas.id,
      url: pathToFileURL(join(currentBundle!.rootDir, atlas.path)).href
    })),
    live2DRendererSpike: live2DRendererSpikeEnabled ? createRuntimeDefaultDoudouLive2DRendererSpikeConfig() : null,
    previewUrl: pathToFileURL(join(currentBundle.rootDir, manifest.assets.preview)).href,
    scale: runtimeScale,
    scaleLimits: RUNTIME_SCALE_LIMITS,
    smoke: smokeMode,
    motionTuning: runtimeMotionTuning,
    motionTuningEnabled: runtimeMotionTuningEnabled,
    motionTuningPresets: runtimeMotionTuningPresets
  };
  return runtimeBundle;
});

function createRuntimeDefaultDoudouLive2DRendererSpikeConfig(): RuntimeDefaultDoudouLive2DRendererSpikeConfig {
  const byEmotion = {} as RuntimeDefaultDoudouLive2DRendererSpikeConfig["library"]["byEmotion"];
  const loadRequests: RuntimeDefaultDoudouLive2DRendererSpikeConfig["library"]["loadRequests"][number][] = [];
  for (const emotionId of DEFAULT_DOUDOU_EMOTION_IDS) {
    const spec = doudouLive2DExpressionForEmotion(emotionId);
    const expressionJson = toDoudouLive2DExp3Json(spec);
    const request = {
      emotionId,
      expressionName: spec.expressionName,
      expressionFile: spec.expressionFile,
      motionCue: spec.motionCue,
      fadeInTime: expressionJson.FadeInTime,
      fadeOutTime: expressionJson.FadeOutTime,
      parameterCount: expressionJson.Parameters.length,
      expressionJson
    };
    byEmotion[emotionId] = request;
    loadRequests.push(request);
  }
  return {
    library: {
      expressionCount: loadRequests.length,
      loadRequests,
      byEmotion
    },
    model3Json: "default-doudou.model3.json",
    modelId: "default-doudou",
    officialRuntime: {
      publicEvidence: live2DOfficialRuntimeResolution.publicEvidence,
      rendererAssets: live2DOfficialRuntimeResolution.rendererAssets
    }
  };
}

ipcMain.on("pet:set-ignore-mouse-events", (_event, ignore: boolean) => {
  if (!mainWindow || ignore === ignoreMouseEvents) {
    return;
  }
  mainWindow.setIgnoreMouseEvents(ignore, { forward: true });
  ignoreMouseEvents = ignore;
});

ipcMain.handle("pet:set-window-scale", (_event, requestedScale: number, source?: unknown) =>
  applyWindowScale(requestedScale, sanitizeRuntimeScaleSource(source))
);

ipcMain.handle("pet:set-motion-tuning", (_event, patch: Partial<RuntimeMotionTuning>) => {
  if (!runtimeMotionTuningEnabled) {
    return runtimeMotionTuning;
  }
  runtimeMotionTuning = resolveRuntimeMotionTuning(patch, runtimeMotionTuning);
  return runtimeMotionTuning;
});

ipcMain.handle("pet:list-motion-tuning-presets", () => {
  return runtimeMotionTuningEnabled ? runtimeMotionTuningPresets : [];
});

ipcMain.handle("pet:save-motion-tuning-preset", async (_event, input: unknown) => {
  if (!runtimeMotionTuningEnabled) {
    return runtimeMotionTuningPresets;
  }
  const candidate = input && typeof input === "object"
    ? input as { name?: unknown; tuning?: Partial<RuntimeMotionTuning> }
    : {};
  const tuning = resolveRuntimeMotionTuning(candidate.tuning ?? {}, runtimeMotionTuning);
  runtimeMotionTuningPresets = upsertRuntimeMotionTuningPreset(runtimeMotionTuningPresets, {
    name: typeof candidate.name === "string" ? candidate.name : "",
    tuning
  });
  await saveRuntimeMotionTuningPresets(runtimeMotionTuningPresetsPath(), runtimeMotionTuningPresets);
  return runtimeMotionTuningPresets;
});

ipcMain.handle("pet:copy-motion-tuning-preset", (_event, text: unknown) => {
  const presetText = sanitizeClipboardText(text);
  if (!runtimeMotionTuningEnabled || presetText.length === 0) {
    return false;
  }
  clipboard.writeText(presetText);
  return true;
});

ipcMain.handle("pet:request-emotion-behavior", async (_event, input: unknown) =>
  await queryDoudouEmotionBehaviorForExplicitRuntimeInput({
    env: process.env,
    input
  })
);

ipcMain.on("pet:start-window-drag", (_event, pointer: ScreenPoint) => {
  if (!mainWindow || !isFiniteScreenPoint(pointer)) {
    return;
  }
  pauseCursorFollowMotion();
  const [x, y] = mainWindow.getPosition();
  dragSession = createWindowDragSession({
    pointer,
    windowPosition: { x, y }
  });
  if (ignoreMouseEvents) {
    mainWindow.setIgnoreMouseEvents(false, { forward: true });
    ignoreMouseEvents = false;
  }
});

ipcMain.on("pet:drag-window-to", (_event, pointer: ScreenPoint) => {
  if (!mainWindow || !dragSession) {
    return;
  }
  pauseCursorFollowMotion();
  const dragStartPosition = dragSession.windowStart;
  const nextPosition = calculateDraggedWindowPosition(dragSession, pointer);
  if (!nextPosition) {
    return;
  }
  mainWindow.setPosition(nextPosition.x, nextPosition.y, false);
  if (smokeMode) {
    const [x, y] = mainWindow.getPosition();
    smokeDragMoved ||= x !== dragStartPosition.x || y !== dragStartPosition.y;
  }
});

ipcMain.on("pet:end-window-drag", () => {
  dragSession = null;
});

ipcMain.on("pet:show-context-menu", () => {
  if (!mainWindow) {
    return;
  }
  Menu.buildFromTemplate([
    {
      label: "退出",
      click: () => app.quit()
    }
  ]).popup({ window: mainWindow });
});

ipcMain.on("pet:quit", () => {
  app.quit();
});

ipcMain.on("pet:record-poke", (_event, pointer?: ScreenPoint) => {
  if (pointer !== undefined && !isFiniteScreenPoint(pointer)) {
    return;
  }
  runtimeEmotionMemory = recordRuntimePokeEmotion(runtimeEmotionMemory, Date.now());
  if (smokeMode) {
    smokeEmotionMotionPhasesObserved.add("retreating");
  }
  smokeMaxEmotionWariness = Math.max(smokeMaxEmotionWariness, runtimeEmotionMemory.wariness);
});

ipcMain.on("pet:renderer-ready", () => {
  if (readySignalMode) {
    console.log("runtime ready: renderer");
  }
  if (smokeMode) {
    console.log("runtime smoke ready: renderer");
  }
});

ipcMain.on("pet:smoke-result", (_event, result: RuntimeSmokeResult) => {
  if (smokeMode) {
    if (smokeTimeout) {
      clearTimeout(smokeTimeout);
      smokeTimeout = null;
    }
    console.log(
      `runtime smoke: ${JSON.stringify({
        ...result,
        dragMoved: smokeDragMoved,
        scale: runtimeScale,
        scaleChanged: smokeScaleChanged,
        pointerScaleChanged: smokePointerScaleChanged,
        wheelScaleChanged: smokeWheelScaleChanged,
        passiveCursorMovedWindow: smokePassiveCursorMovedWindow,
        cursorFollowAlphaHitTested: smokeCursorFollowAlphaHitTested,
        emotionMotionPhasesObserved: [...smokeEmotionMotionPhasesObserved],
        motionTuningApplied: result.motionTuningApplied,
        motionTuningPanelVisible: result.motionTuningPanelVisible,
        motionTuningSnapshot: runtimeMotionTuning,
        maxEmotionWariness: smokeMaxEmotionWariness
      })}`
    );
    setTimeout(() => app.quit(), 250);
  }
});

ipcMain.on("pet:cursor-hit-test-response", (_event, response: unknown) => {
  resolveCursorHitTestResponse(response);
});

app.on("window-all-closed", () => {
  app.quit();
});

void main();

function isFiniteScreenPoint(point: ScreenPoint): boolean {
  return Number.isFinite(point?.x) && Number.isFinite(point?.y);
}

function applyWindowScale(requestedScale: number, source?: RuntimeScaleSource): number {
  const nextScale = clampRuntimeScale(requestedScale);
  if (source) {
    pauseCursorFollowMotion();
  }
  if (!mainWindow || !currentBundle) {
    runtimeScale = nextScale;
    return runtimeScale;
  }

  const currentBounds = mainWindow.getBounds();
  const nextBounds = calculateCenteredFramedWindowBounds(currentBounds, currentBundle.manifest.canvas, nextScale);
  const boundsChanged =
    nextBounds.x !== currentBounds.x ||
    nextBounds.y !== currentBounds.y ||
    nextBounds.width !== currentBounds.width ||
    nextBounds.height !== currentBounds.height;

  if (boundsChanged) {
    mainWindow.setBounds(nextBounds, false);
  }
  const appliedBounds = mainWindow.getBounds();
  const appliedSizeChanged = appliedBounds.width !== currentBounds.width || appliedBounds.height !== currentBounds.height;
  if (smokeMode && appliedSizeChanged && nextScale !== runtimeScale) {
    smokeScaleChanged = true;
    smokePointerScaleChanged ||= source === "pointer";
    smokeWheelScaleChanged ||= source === "wheel";
  }
  runtimeScale = calculateRuntimeScaleFromFramedWindowSize(appliedBounds, currentBundle.manifest.canvas);
  return runtimeScale;
}

function sanitizeRuntimeScaleSource(source: unknown): RuntimeScaleSource | undefined {
  return source === "pointer" || source === "wheel" ? source : undefined;
}

function startCursorFollowMotion(): void {
  stopCursorFollowMotion();
  lastCursorFollowTimestamp = Date.now();
  cursorFollowTimer = setInterval(tickCursorFollowMotion, RUNTIME_CURSOR_FOLLOW_INTERVAL_MS);
}

function stopCursorFollowMotion(): void {
  if (!cursorFollowTimer) {
    return;
  }
  clearInterval(cursorFollowTimer);
  cursorFollowTimer = null;
}

function pauseCursorFollowMotion(durationMs = RUNTIME_CURSOR_FOLLOW_RESUME_DELAY_MS): void {
  cursorFollowPausedUntil = Math.max(cursorFollowPausedUntil, Date.now() + durationMs);
}

function tickCursorFollowMotion(): void {
  void tickCursorFollowMotionAsync().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
  });
}

async function tickCursorFollowMotionAsync(): Promise<void> {
  if (!mainWindow || !currentBundle) {
    return;
  }
  if (cursorFollowHitTestPending) {
    return;
  }
  const now = Date.now();
  const deltaMs = Math.min(RUNTIME_CURSOR_FOLLOW_MAX_DELTA_MS, Math.max(0, now - lastCursorFollowTimestamp));
  lastCursorFollowTimestamp = now;
  runtimeEmotionMemory = decayRuntimeEmotionMemory(runtimeEmotionMemory, now);
  const emotionPhase = classifyRuntimeEmotionMotionPhase(
    runtimeEmotionMemory,
    now,
    createRuntimeEmotionPhaseConfig(runtimeMotionTuning)
  );
  if (smokeMode && emotionPhase !== "settled") {
    smokeEmotionMotionPhasesObserved.add(emotionPhase);
  }

  if (dragSession || now < cursorFollowPausedUntil) {
    return;
  }

  const currentBounds = mainWindow.getBounds();
  const cursorPoint = smokeMode
    ? smokeCursorFollowPoint ?? createSmokeCursorFollowPoint(currentBounds)
    : screen.getCursorScreenPoint();
  if (!isCursorInsideRuntimeMotionActivationArea(cursorPoint, currentBounds)) {
    return;
  }
  cursorFollowHitTestPending = true;
  try {
    const hitTestResult = await requestCursorHitTest(cursorPoint);
    if (smokeMode) {
      smokeCursorFollowAlphaHitTested = true;
    }
    if (!hitTestResult.visible) {
      if (emotionPhase === "watching") {
        publishCursorMotionCue({
          direction: motionDirectionTowardCursor(cursorPoint, currentBounds),
          motionIntensity: runtimeMotionIntensityForEmotion(0.42, runtimeEmotionMemory),
          state: "watching"
        });
      }
      return;
    }
    const reaction = classifyRuntimeAlphaReaction({ hitTest: hitTestResult, emotionMemory: runtimeEmotionMemory });
    if (reaction === "none") {
      return;
    }
    if (emotionPhase === "watching") {
      publishCursorMotionCue({
        direction: motionDirectionTowardCursor(cursorPoint, currentBounds),
        motionIntensity: runtimeMotionIntensityForEmotion(0.42, runtimeEmotionMemory),
        state: "watching"
      });
      return;
    }
    const effectiveReaction = emotionPhase === "retreating"
      ? "dodge"
      : emotionPhase === "recovering"
        ? "approach"
        : reaction;
    const workArea = screen.getDisplayNearestPoint(cursorPoint).workArea;
    const motionStep = effectiveReaction === "dodge"
      ? calculateCursorDodgeStep({
        cursor: cursorPoint,
        deltaMs,
        config: {
          ...RUNTIME_CURSOR_DODGE_CONFIG,
          dodgeDistance: runtimeRetreatDistanceForTuning(
            runtimeEmotionMemory,
            RUNTIME_CURSOR_DODGE_CONFIG.dodgeDistance,
            runtimeMotionTuning
          )
        },
        windowBounds: currentBounds,
        workArea
      })
      : calculateCursorFollowStep({
        cursor: cursorPoint,
        deltaMs,
        config: emotionPhase === "recovering" ? createRuntimeRecoveryFollowConfig(runtimeMotionTuning) : undefined,
        windowBounds: currentBounds,
        workArea
      });
    publishCursorMotionCue(
      cursorFollowCueFromStep(
        motionStep.state,
        motionStep.direction,
        motionIntensityForEmotionPhase(motionStep.motionIntensity, runtimeEmotionMemory, emotionPhase, effectiveReaction),
        effectiveReaction,
        emotionPhase
      )
    );
  } finally {
    // Passive cursor cues must not move the window; smoke records actual bounds.
    if (smokeMode && mainWindow && shouldRecordPassiveCursorMovementSmoke()) {
      const appliedBounds = mainWindow.getBounds();
      smokePassiveCursorMovedWindow ||= appliedBounds.x !== currentBounds.x || appliedBounds.y !== currentBounds.y;
    }
    cursorFollowHitTestPending = false;
  }
}

function shouldRecordPassiveCursorMovementSmoke(nowMs = Date.now()): boolean {
  return !dragSession && nowMs >= cursorFollowPausedUntil;
}

interface PendingCursorHitTest {
  resolve(result: RuntimeCursorHitTestResult): void;
  timeout: NodeJS.Timeout;
}

const pendingCursorHitTests = new Map<number, PendingCursorHitTest>();

function requestCursorHitTest(screenPoint: RuntimeMotionPoint): Promise<RuntimeCursorHitTestResult> {
  if (!mainWindow || mainWindow.webContents.isDestroyed()) {
    return Promise.resolve({ visible: false });
  }
  const requestId = (cursorHitTestSerial += 1);
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      pendingCursorHitTests.delete(requestId);
      resolve({ visible: false });
    }, RUNTIME_CURSOR_HIT_TEST_TIMEOUT_MS);
    pendingCursorHitTests.set(requestId, { resolve, timeout });
    mainWindow?.webContents.send("pet:cursor-hit-test-request", {
      requestId,
      screenPoint
    });
  });
}

function resolveCursorHitTestResponse(response: unknown): void {
  if (!isCursorHitTestResponse(response)) {
    return;
  }
  const pending = pendingCursorHitTests.get(response.requestId);
  if (!pending) {
    return;
  }
  clearTimeout(pending.timeout);
  pendingCursorHitTests.delete(response.requestId);
  pending.resolve({
    canvasPoint: response.canvasPoint,
    canvasSize: response.canvasSize,
    visible: response.visible
  });
}

function clearPendingCursorHitTests(): void {
  for (const pending of pendingCursorHitTests.values()) {
    clearTimeout(pending.timeout);
    pending.resolve({ visible: false });
  }
  pendingCursorHitTests.clear();
}

function isCursorHitTestResponse(
  response: unknown
): response is RuntimeCursorHitTestResult & { requestId: number } {
  if (!response || typeof response !== "object") {
    return false;
  }
  const candidate = response as { canvasPoint?: unknown; canvasSize?: unknown; requestId?: unknown; visible?: unknown };
  const validPoint = isOptionalFinitePoint(candidate.canvasPoint);
  const validSize = isOptionalFiniteSize(candidate.canvasSize);
  return Number.isFinite(candidate.requestId) && typeof candidate.visible === "boolean" && validPoint && validSize;
}

function isOptionalFinitePoint(point: unknown): boolean {
  if (point === undefined) {
    return true;
  }
  if (!point || typeof point !== "object") {
    return false;
  }
  const candidate = point as { x?: unknown; y?: unknown };
  return Number.isFinite(candidate.x) && Number.isFinite(candidate.y);
}

function isOptionalFiniteSize(size: unknown): boolean {
  if (size === undefined) {
    return true;
  }
  if (!size || typeof size !== "object") {
    return false;
  }
  const candidate = size as { height?: unknown; width?: unknown };
  return Number.isFinite(candidate.width) && Number.isFinite(candidate.height);
}

function publishCursorMotionCue(cue: RuntimePetMotionCue): void {
  if (!mainWindow || mainWindow.webContents.isDestroyed()) {
    return;
  }
  mainWindow.webContents.send("pet:motion-state", cue);
}

function cursorFollowCueFromStep(
  state: "following" | "settled",
  direction: RuntimeMotionDirection,
  motionIntensity: number,
  reaction: RuntimeAlphaReaction = "approach",
  emotionPhase: RuntimeEmotionMotionPhase = "settled"
): RuntimePetMotionCue {
  if (state === "following") {
    lastApproachCue = { direction, motionIntensity };
    return {
      ...lastApproachCue,
      state: motionCueStateForReaction(reaction, emotionPhase)
    };
  }
  return {
    direction: lastApproachCue.direction,
    motionIntensity: lastApproachCue.motionIntensity,
    state: "stopped"
  };
}

function motionCueStateForReaction(
  reaction: RuntimeAlphaReaction,
  emotionPhase: RuntimeEmotionMotionPhase
): RuntimeMotionPetState {
  if (emotionPhase === "retreating") {
    return "retreating";
  }
  return reaction === "dodge" ? "dodging" : "approaching";
}

function motionIntensityForEmotionPhase(
  motionIntensity: number,
  memory: ReturnType<typeof createRuntimeEmotionMemory>,
  emotionPhase: RuntimeEmotionMotionPhase,
  reaction: RuntimeAlphaReaction
): number {
  if (emotionPhase === "recovering") {
    return Math.min(0.48, Math.max(0.22, motionIntensity * 0.65));
  }
  return reaction === "dodge" ? runtimeMotionIntensityForEmotion(motionIntensity, memory) : motionIntensity;
}

function motionDirectionTowardCursor(cursorPoint: RuntimeMotionPoint, windowBounds: RuntimeMotionPoint & { height: number; width: number }): RuntimeMotionDirection {
  const center = {
    x: windowBounds.x + windowBounds.width / 2,
    y: windowBounds.y + windowBounds.height / 2
  };
  const dx = cursorPoint.x - center.x;
  const dy = cursorPoint.y - center.y;
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
    return lastApproachCue.direction;
  }
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? "right" : "left";
  }
  return dy >= 0 ? "down" : "up";
}

function runtimeMotionTuningFromEnv(env: NodeJS.ProcessEnv): RuntimeMotionTuning {
  return resolveRuntimeMotionTuning({
    recoverySpeedPixelsPerSecond: numberFromEnv(env.DOUDOU_RUNTIME_RECOVERY_SPEED),
    retreatDistancePixels: numberFromEnv(env.DOUDOU_RUNTIME_RETREAT_DISTANCE),
    watchingPauseMs: numberFromEnv(env.DOUDOU_RUNTIME_WATCH_MS)
  });
}

function numberFromEnv(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") {
    return undefined;
  }
  return Number(value);
}

function applyRuntimeUserDataDirFromEnv(env: NodeJS.ProcessEnv): void {
  if (!env.DOUDOU_RUNTIME_USER_DATA_DIR) {
    return;
  }
  app.setPath("userData", resolve(env.DOUDOU_RUNTIME_USER_DATA_DIR));
}

function runtimeMotionTuningPresetsPath(): string {
  return join(app.getPath("userData"), "motion-tuning-presets.json");
}

function sanitizeClipboardText(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.slice(0, RUNTIME_CLIPBOARD_TEXT_MAX_LENGTH);
}
