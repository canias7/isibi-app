const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("money", {
  load: () => ipcRenderer.invoke("money:load"),
  save: (data) => ipcRenderer.invoke("money:save", data),
  exportCsv: (name, csv) => ipcRenderer.invoke("money:export", { name, csv }),
});
