import { app, BrowserWindow, ipcMain, Menu } from "electron";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validatePetBundle, type ValidatedPetBundle } from "../pet_bundle/validate.js";
import {
  calculateDraggedWindowPosition,
  createWindowDragSession,
  type ScreenPoint,
  type WindowDragSession
} from "./drag.js";
import type { RuntimeBundle, RuntimeScaleSource, RuntimeSmokeResult } from "./runtime-types.js";
import {
  RUNTIME_SCALE_LIMITS,
  calculateCenteredFramedWindowBounds,
  calculateFramedWindowSize,
  calculateRuntimeScaleFromFramedWindowSize,
  clampRuntimeScale
} from "./scale.js";

const currentDir = dirname(fileURLToPath(import.meta.url));

interface RuntimeOptions {
  bundleDir: string;
  readySignal: boolean;
  smoke: boolean;
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
let smokeTimeout: NodeJS.Timeout | null = null;

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (!options.bundleDir) {
    console.error("Usage: electron dist/src/runtime/main.js --bundle <bundle-dir> [--smoke]");
    process.exit(2);
  }

  smokeMode = options.smoke ?? false;
  readySignalMode = options.readySignal ?? false;

  try {
    currentBundle = await validatePetBundle(options.bundleDir);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  await app.whenReady();
  createWindow(currentBundle);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0 && currentBundle) {
      createWindow(currentBundle);
    }
  });
}

function parseArgs(args: string[]): Partial<RuntimeOptions> {
  const options: Partial<RuntimeOptions> = { readySignal: false, smoke: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--bundle") {
      options.bundleDir = args[index + 1];
      index += 1;
    } else if (arg === "--smoke") {
      options.smoke = true;
    } else if (arg === "--ready-signal") {
      options.readySignal = true;
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
    previewUrl: pathToFileURL(join(currentBundle.rootDir, manifest.assets.preview)).href,
    scale: runtimeScale,
    scaleLimits: RUNTIME_SCALE_LIMITS,
    smoke: smokeMode
  };
  return runtimeBundle;
});

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

ipcMain.on("pet:start-window-drag", (_event, pointer: ScreenPoint) => {
  if (!mainWindow || !isFiniteScreenPoint(pointer)) {
    return;
  }
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
        wheelScaleChanged: smokeWheelScaleChanged
      })}`
    );
    setTimeout(() => app.quit(), 250);
  }
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
