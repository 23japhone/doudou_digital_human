const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("petRuntime", {
  copyMotionTuningPreset: (text) => ipcRenderer.invoke("pet:copy-motion-tuning-preset", sanitizeClipboardText(text)),
  dragWindowTo: (point) => ipcRenderer.send("pet:drag-window-to", sanitizePoint(point)),
  endWindowDrag: () => ipcRenderer.send("pet:end-window-drag"),
  getBundle: () => ipcRenderer.invoke("pet:get-bundle"),
  listMotionTuningPresets: () => ipcRenderer.invoke("pet:list-motion-tuning-presets"),
  onCursorHitTest: (callback) => {
    const listener = (_event, request) => {
      const requestId = Number(request?.requestId);
      if (!Number.isFinite(requestId)) {
        return;
      }
      const result = callback(sanitizePoint(request?.screenPoint));
      ipcRenderer.send("pet:cursor-hit-test-response", {
        canvasPoint: sanitizeOptionalPoint(result?.canvasPoint),
        canvasSize: sanitizeOptionalSize(result?.canvasSize),
        requestId,
        visible: Boolean(result?.visible)
      });
    };
    ipcRenderer.on("pet:cursor-hit-test-request", listener);
    return () => ipcRenderer.off("pet:cursor-hit-test-request", listener);
  },
  onMotionState: (callback) => {
    const listener = (_event, cue) => {
      const sanitizedCue = sanitizeMotionCue(cue);
      if (sanitizedCue) {
        callback(sanitizedCue);
      }
    };
    ipcRenderer.on("pet:motion-state", listener);
    return () => ipcRenderer.off("pet:motion-state", listener);
  },
  quit: () => ipcRenderer.send("pet:quit"),
  recordPoke: (point) => ipcRenderer.send("pet:record-poke", sanitizeOptionalPoint(point)),
  reportSmokeResult: (result) => ipcRenderer.send("pet:smoke-result", result),
  saveMotionTuningPreset: (name, tuning) => ipcRenderer.invoke("pet:save-motion-tuning-preset", {
    name: sanitizePresetName(name),
    tuning: sanitizeMotionTuningPatch(tuning)
  }),
  setMotionTuning: (patch) => ipcRenderer.invoke("pet:set-motion-tuning", sanitizeMotionTuningPatch(patch)),
  setIgnoreMouseEvents: (ignore) => ipcRenderer.send("pet:set-ignore-mouse-events", Boolean(ignore)),
  setWindowScale: (scale, source) => ipcRenderer.invoke("pet:set-window-scale", Number(scale), sanitizeScaleSource(source)),
  showContextMenu: () => ipcRenderer.send("pet:show-context-menu"),
  startWindowDrag: (point) => ipcRenderer.send("pet:start-window-drag", sanitizePoint(point)),
  rendererReady: () => ipcRenderer.send("pet:renderer-ready")
});

function sanitizePoint(point) {
  return {
    x: Number(point?.x),
    y: Number(point?.y)
  };
}

function sanitizeOptionalPoint(point) {
  if (!point) {
    return undefined;
  }
  const sanitized = sanitizePoint(point);
  return Number.isFinite(sanitized.x) && Number.isFinite(sanitized.y) ? sanitized : undefined;
}

function sanitizeOptionalSize(size) {
  if (!size) {
    return undefined;
  }
  const width = Number(size?.width);
  const height = Number(size?.height);
  return Number.isFinite(width) && Number.isFinite(height) ? { width, height } : undefined;
}

function sanitizeScaleSource(source) {
  return source === "pointer" || source === "wheel" ? source : undefined;
}

function sanitizeClipboardText(text) {
  if (typeof text !== "string") {
    return "";
  }
  return text.slice(0, 512);
}

function sanitizePresetName(name) {
  if (typeof name !== "string") {
    return "";
  }
  return name.trim().replace(/\s+/g, " ").slice(0, 32);
}

function sanitizeMotionTuningPatch(patch) {
  if (!patch || typeof patch !== "object") {
    return {};
  }
  return {
    recoverySpeedPixelsPerSecond: optionalNumber(patch?.recoverySpeedPixelsPerSecond),
    retreatDistancePixels: optionalNumber(patch?.retreatDistancePixels),
    watchingPauseMs: optionalNumber(patch?.watchingPauseMs)
  };
}

function optionalNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function sanitizeMotionCue(cue) {
  const state = cue?.state;
  if (
    state !== "approaching" &&
    state !== "dodging" &&
    state !== "retreating" &&
    state !== "stopped" &&
    state !== "watching"
  ) {
    return undefined;
  }
  return {
    direction: sanitizeMotionDirection(cue?.direction),
    motionIntensity: clamp01(Number(cue?.motionIntensity)),
    state
  };
}

function sanitizeMotionDirection(direction) {
  return direction === "left" || direction === "right" || direction === "up" || direction === "down"
    ? direction
    : "none";
}

function clamp01(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}
