const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("petRuntime", {
  dragWindowTo: (point) => ipcRenderer.send("pet:drag-window-to", sanitizePoint(point)),
  endWindowDrag: () => ipcRenderer.send("pet:end-window-drag"),
  getBundle: () => ipcRenderer.invoke("pet:get-bundle"),
  onCursorHitTest: (callback) => {
    const listener = (_event, request) => {
      const requestId = Number(request?.requestId);
      if (!Number.isFinite(requestId)) {
        return;
      }
      const result = callback(sanitizePoint(request?.screenPoint));
      ipcRenderer.send("pet:cursor-hit-test-response", {
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
  reportSmokeResult: (result) => ipcRenderer.send("pet:smoke-result", result),
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

function sanitizeScaleSource(source) {
  return source === "pointer" || source === "wheel" ? source : undefined;
}

function sanitizeMotionCue(cue) {
  const state = cue?.state;
  if (state !== "approaching" && state !== "stopped") {
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
