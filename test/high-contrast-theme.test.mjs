// Audit A34-1 (2026-10-23): high contrast on a THEMED site. A build appends the
// theme's own `:root` and `.dark` palette after the template's stylesheet, so
// the contrast overrides, which tied with them on specificity, lost on source
// order: the OS "Increase contrast" setting (both modes) and the kit's toggle
// (light mode) changed nothing. Measured in a real Chromium on the template's
// contrast block with a registry theme appended after it, the order a build
// writes them in.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { themeCss } from "../builder/site-theme.mjs";
import { resolveTheme } from "../builder/site-theme-registry.mjs";

const EXE = "/opt/pw-browsers/chromium";
let chromium = null;
try { ({ chromium } = await import("playwright-core")); } catch { chromium = null; }
const HAVE = !!chromium && existsSync(EXE);

const SHEET = readFileSync(new URL("../builder/lovable/template/src/styles.css", import.meta.url), "utf8");
const from = SHEET.indexOf("/* Contrast:");
const to = SHEET.indexOf("/* ====", from);
const CONTRAST = SHEET.slice(from, to);
const THEME = themeCss(resolveTheme("ballet"));

test("A34-1 landmarks: the contrast block and a themed palette that sets the same tokens", () => {
  assert.ok(from > 0 && to > from && /prefers-contrast: more/.test(CONTRAST), "the contrast block moved");
  assert.match(THEME, /:root\s*\{[^}]*--foreground:/, "the theme no longer declares --foreground on :root");
  assert.match(THEME, /\.dark\s*\{[^}]*--foreground:/, "the theme no longer declares --foreground on .dark");
});

test("A34-1 high contrast wins over the theme appended after it — toggle and OS setting, light and dark", { skip: !HAVE && "no Chromium here" }, async () => {
  const b = await chromium.launch({ executablePath: EXE });
  try {
    const page = await b.newPage();
    await page.setContent("<!doctype html><html><head><style>" + CONTRAST + "\n" + THEME + "</style></head><body></body></html>");
    const fg = (cls) => page.evaluate((c) => {
      document.documentElement.className = c;
      return getComputedStyle(document.documentElement).getPropertyValue("--foreground").trim();
    }, cls);
    const themeLight = await fg("");
    const themeDark = await fg("dark");
    assert.notEqual(themeLight, "oklch(0 0 0)", "the theme's own ink is already black: this proves nothing");
    // The kit's toggle (the class on <html>).
    assert.equal(await fg("app-high-contrast"), "oklch(0 0 0)", "the toggle lost to the theme in light mode");
    assert.equal(await fg("dark app-high-contrast"), "oklch(1 0 0)", "the toggle lost to the theme in dark mode");
    // The OS setting.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-contrast", value: "more" }] });
    assert.equal(await page.evaluate(() => matchMedia("(prefers-contrast: more)").matches), true, "the emulation did not take");
    assert.equal(await fg(""), "oklch(0 0 0)", "Increase contrast lost to the theme in light mode");
    assert.equal(await fg("dark"), "oklch(1 0 0)", "Increase contrast lost to the theme in dark mode");
    await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-contrast", value: "no-preference" }] });
    assert.equal(await fg(""), themeLight, "without the setting the theme's palette is not left alone");
    assert.equal(await fg("dark"), themeDark);
  } finally { await b.close(); }
});
