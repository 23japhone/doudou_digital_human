const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("petRuntime", {
  dragWindowTo: (point) => ipcRenderer.send("pet:drag-window-to", sanitizePoint(point)),
  endWindowDrag: () => ipcRenderer.send("pet:end-window-drag"),
  getBundle: () => ipcRenderer.invoke("pet:get-bundle"),
  quit: () => ipcRenderer.send("pet:quit"),
  reportSmokeResult: (result) => ipcRenderer.send("pet:smoke-result", result),
  setIgnoreMouseEvents: (ignore) => ipcRenderer.send("pet:set-ignore-mouse-events", Boolean(ignore)),
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
