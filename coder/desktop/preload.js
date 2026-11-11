// WHAT THE PAGE MAY ASK OF THE APP (2026-11-11: routing Gloopy's browser through this computer; your security key). Only
// this: start, stop or nudge the link, read how it is doing, and have your key sign a sign-in a page in Gloopy's browser
// asked for. The app answers only gofarther.dev's own pages (main.js checks).
"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("gofartherDesktop", {
  route: {
    start: (o) => ipcRenderer.invoke("route:start", { url: String((o && o.url) || ""), ticket: String((o && o.ticket) || "") }),
    stop: () => ipcRenderer.invoke("route:stop"),
    kick: () => ipcRenderer.invoke("route:kick"),
    status: () => ipcRenderer.invoke("route:status"),
  },
  // YOUR SECURITY KEY (2026-11-11): sign a page's request in Gloopy's browser, for that page's site (key.js).
  securityKey: {
    get: (o) => ipcRenderer.invoke("key:get", { origin: String((o && o.origin) || ""), request: o && typeof o.request === "object" ? o.request : {} }),
  },
});
