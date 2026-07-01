const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("doudouApp", {
  getState: () => ipcRenderer.invoke("app:get-state"),
  setGenerationSettings: (settings) => ipcRenderer.invoke("app:set-generation-settings", settings),
  selectSourceImage: () => ipcRenderer.invoke("app:select-source-image"),
  createDeveloperPreview: () => ipcRenderer.invoke("app:create-developer-preview"),
  generatePet: () => ipcRenderer.invoke("app:generate-pet"),
  createReview: () => ipcRenderer.invoke("app:create-review"),
  acceptPet: () => ipcRenderer.invoke("app:accept-pet"),
  launchPet: () => ipcRenderer.invoke("app:launch-pet"),
  stopPet: () => ipcRenderer.invoke("app:stop-pet"),
  deleteDraftAssets: () => ipcRenderer.invoke("app:delete-draft-assets"),
  deleteAcceptedPet: () => ipcRenderer.invoke("app:delete-accepted-pet"),
  getSmokeConfig: () => ipcRenderer.invoke("app:get-smoke-config"),
  reportSmokeResult: (result) => ipcRenderer.send("app:smoke-result", result)
});
