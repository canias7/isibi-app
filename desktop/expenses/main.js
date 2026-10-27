// Go Farther Money: a private desktop sheet of income and expenses.
// Everything is kept in one JSON file in the user's own app-data folder;
// nothing leaves the machine.
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const dataFile = () => path.join(app.getPath("userData"), "money.json");

function load() {
  try { return JSON.parse(fs.readFileSync(dataFile(), "utf8")); } catch { return null; }
}

function save(data) {
  const f = dataFile();
  const tmp = f + ".tmp";
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(data, null, 1));
  fs.renameSync(tmp, f); // a crash mid-write never leaves a half file
  return true;
}

ipcMain.handle("money:load", () => load());
ipcMain.handle("money:save", (_e, data) => save(data));
ipcMain.handle("money:export", async (_e, { name, csv }) => {
  const r = await dialog.showSaveDialog({ defaultPath: name, filters: [{ name: "CSV", extensions: ["csv"] }] });
  if (r.canceled || !r.filePath) return false;
  fs.writeFileSync(r.filePath, csv);
  return true;
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1366, height: 860, minWidth: 980, minHeight: 600,
    title: "Go Farther Money",
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.loadFile("index.html");
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());
