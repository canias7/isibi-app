// GO FARTHER FOR MAC AND WINDOWS (owner, 2026-11-06: "start making the desktop
// apps and mobile apps … so we don't stay behind"). Like Claude's desktop app:
// the site (gofarther.dev) in its own window, so every feature built on the
// site is here at once, with what only an app has on top: its own icon and
// window, a menu with the usual shortcuts, and links that open in the browser.
"use strict";

const { app, BrowserWindow, Menu, shell, session } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { HOME, isInsideApp, isSafeOutside } = require("./links");

// ONE WINDOW: opening the app again brings it to the front.
if (!app.requestSingleInstanceLock()) app.quit();

let win = null;
const stateFile = () => path.join(app.getPath("userData"), "window.json");
const readState = () => { try { return JSON.parse(fs.readFileSync(stateFile(), "utf8")); } catch { return {}; } };

function openOutside(url) { if (isSafeOutside(url)) shell.openExternal(url); }

function createWindow() {
  const st = readState();
  win = new BrowserWindow({
    width: st.width || 1280, height: st.height || 860, x: st.x, y: st.y,
    minWidth: 380, minHeight: 520,
    title: "Go Farther", backgroundColor: "#faf9f7", show: false,
    autoHideMenuBar: process.platform !== "darwin",
    // backgroundThrottling off: a minimized window still watches the chats for Coder's notifications (owner item 8).
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: true, backgroundThrottling: false },
  });
  win.once("ready-to-show", () => { if (st.maximized) win.maximize(); win.show(); });
  win.on("close", () => { try { fs.writeFileSync(stateFile(), JSON.stringify({ ...win.getNormalBounds(), maximized: win.isMaximized() })); } catch { /* not saved */ } });
  win.on("closed", () => { win = null; });

  // LINKS: the app's own pages (and GitHub's sign-in) stay; everything else opens in the browser.
  win.webContents.setWindowOpenHandler(({ url }) => { if (isInsideApp(url)) win.loadURL(url); else openOutside(url); return { action: "deny" }; });
  win.webContents.on("will-navigate", (e, url) => { if (!isInsideApp(url)) { e.preventDefault(); openOutside(url); } });
  win.webContents.on("will-redirect", (e, url) => { if (!isInsideApp(url)) { e.preventDefault(); openOutside(url); } });

  // NO INTERNET: a small page with "Try again" instead of a blank window.
  win.webContents.on("did-fail-load", (_e, code, _desc, url, isMain) => {
    if (isMain && code !== -3 /* cancelled */ && isInsideApp(url)) win.loadFile(path.join(__dirname, "offline.html"));
  });
  win.loadURL(HOME);
}

function buildMenu() {
  const mac = process.platform === "darwin";
  const template = [
    ...(mac ? [{ role: "appMenu" }] : []),
    { label: "File", submenu: [{ label: "New chat", accelerator: "CmdOrCtrl+N", click: () => win && win.loadURL(HOME) }, { type: "separator" }, mac ? { role: "close" } : { role: "quit" }] },
    // Copy, paste and the rest only work on a Mac when the menu has them.
    { role: "editMenu" },
    { label: "View", submenu: [{ role: "reload" }, { type: "separator" }, { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" }, { type: "separator" }, { role: "togglefullscreen" }] },
    { label: "History", submenu: [{ label: "Back", accelerator: mac ? "Cmd+[" : "Alt+Left", click: () => win && win.webContents.navigationHistory.canGoBack() && win.webContents.navigationHistory.goBack() }, { label: "Forward", accelerator: mac ? "Cmd+]" : "Alt+Right", click: () => win && win.webContents.navigationHistory.canGoForward() && win.webContents.navigationHistory.goForward() }] },
    { role: "windowMenu" },
    { role: "help", submenu: [{ label: "Go Farther on the web", click: () => shell.openExternal(HOME) }] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// THE PAGE KNOWS IT IS IN THE APP (it hides "Download for Mac / Windows").
app.userAgentFallback = app.userAgentFallback + " GoFartherDesktop/" + app.getVersion();

app.whenReady().then(() => {
  // ONLY WHAT THE SITE NEEDS: notifications and copying; nothing else (camera, location…).
  session.defaultSession.setPermissionRequestHandler((_wc, permission, done) => done(["notifications", "clipboard-sanitized-write"].includes(permission)));
  buildMenu();
  createWindow();
  app.on("activate", () => { if (!win) createWindow(); });
});
app.on("second-instance", () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
// No other window or frame may load anything but the app and GitHub's sign-in.
app.on("web-contents-created", (_e, wc) => {
  wc.on("will-attach-webview", (e) => e.preventDefault());
});
