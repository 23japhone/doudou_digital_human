const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("petRuntime", {
  dragWindowTo: (point) => ipcRenderer.send("pet:drag-window-to", sanitizePoint(point)),
  endWindowDrag: () => ipcRenderer.send("pet:end-window-drag"),
  getBundle: () => ipcRenderer.invoke("pet:get-bundle"),
  onMotionState: (callback) => {
    const listener = (_event, state) => {
      const sanitizedState = sanitizeMotionState(state);
      if (sanitizedState) {
        callback(sanitizedState);
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

function sanitizeMotionState(state) {
  return state === "approaching" || state === "stopped" ? state : undefined;
}
