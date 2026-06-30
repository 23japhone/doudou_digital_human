const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("petRuntime", {
  getBundle: () => ipcRenderer.invoke("pet:get-bundle"),
  quit: () => ipcRenderer.send("pet:quit"),
  reportSmokeResult: (result) => ipcRenderer.send("pet:smoke-result", result),
  setIgnoreMouseEvents: (ignore) => ipcRenderer.send("pet:set-ignore-mouse-events", Boolean(ignore)),
  showContextMenu: () => ipcRenderer.send("pet:show-context-menu"),
  rendererReady: () => ipcRenderer.send("pet:renderer-ready")
});
