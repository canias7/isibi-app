// WHAT THE PAGE MAY ASK OF THE APP (2026-11-11: routing Gloopy's browser through this computer). Only this: start, stop
// or nudge the link, and read how it is doing. The app answers only gofarther.dev's own pages (main.js checks).
"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("gofartherDesktop", {
  route: {
    start: (o) => ipcRenderer.invoke("route:start", { url: String((o && o.url) || ""), ticket: String((o && o.ticket) || "") }),
    stop: () => ipcRenderer.invoke("route:stop"),
    kick: () => ipcRenderer.invoke("route:kick"),
    status: () => ipcRenderer.invoke("route:status"),
  },
});
