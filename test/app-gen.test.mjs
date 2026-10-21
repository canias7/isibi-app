// THE APP WRITER (phase C): what the model is told matches the kit it writes
// against, its answer is read by the app builder's own reader, and the design's
// look always becomes a whole, valid theme.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { APP_KIT_API, appWriterSystem, appFilesFrom, appThemeFrom, DEFAULT_APP_THEME, WRITE_APP_TOOL } from "../builder/app-gen.mjs";
import { readExpoRequest } from "../app-builder/expo-preview.mjs";

const idx = readFileSync(new URL("../app-builder/expo/components/app/index.ts", import.meta.url), "utf8");
const kitNames = [...idx.matchAll(/export \{([^}]+)\}/g)].flatMap((m) => m[1].split(",")).map((s) => s.trim()).filter((s) => s && !s.startsWith("type ")).filter((s) => s !== "TAB_ICONS");

test("the writer is told exactly the kit: every export named, nothing the kit lacks", () => {
  assert.ok(kitNames.length >= 18, "the observer read the kit");
  assert.deepEqual(APP_KIT_API.map(([n]) => n).sort(), [...kitNames].sort());
  const sys = appWriterSystem();
  for (const n of kitNames) assert.match(sys, new RegExp("- " + n + "\\b"), n);
  const icons = readFileSync(new URL("../app-builder/expo/components/app/tabs.tsx", import.meta.url), "utf8").match(/TAB_ICONS = \{([\s\S]*?)\} as const/)[1];
  const iconNames = [...icons.matchAll(/(\w+): \[/g)].map((m) => m[1]);
  assert.ok(iconNames.length >= 10);
  assert.match(sys, new RegExp("TabIcon is one of: " + iconNames.join(" ") + "\\."), "the icons the writer may name are the kit's");
});

test("the writer's answer is read by the app builder's own reader", () => {
  assert.deepEqual(WRITE_APP_TOOL.input_schema.required, ["files"]);
  assert.match(appFilesFrom({ files: [{ path: "components/app/button.tsx", source: "x" }] }).error, /not a file/);
  assert.match(appFilesFrom(null).error, /no files/);
  assert.match(appFilesFrom({ files: [{ path: "app/(tabs)/index.tsx", source: "x" }] }).error, /tabs/);
  const ok = appFilesFrom({ files: [{ path: "app/(tabs)/_layout.tsx", source: "x" }, { path: "lib/data.ts", source: "y" }] });
  assert.equal(ok.files.length, 2);
});

test("the design's colours become a whole theme the app builder accepts; unreadable colours keep the default", () => {
  const base = { baseUrl: "/app-preview/a/" + "0".repeat(32), files: [{ path: "app/(tabs)/_layout.tsx", source: "x" }] };
  const t = appThemeFrom({ "--background": "rgb(241, 230, 214)", foreground: "#2b2118", primary: "#1f5fa8", border: "#ddd" }, 18);
  assert.equal(t.paper, "#f1e6d6"); assert.equal(t.primary, "#1f5fa8"); assert.equal(t.line, "#dddddd"); assert.equal(t.radius, 18);
  assert.equal(t.onPrimary, "#ffffff", "white on a dark primary");
  assert.equal(readExpoRequest({ ...base, theme: t }).error, undefined);
  assert.deepEqual(appThemeFrom(null), DEFAULT_APP_THEME);
  assert.equal(readExpoRequest({ ...base, theme: appThemeFrom({ background: "oklch(0.9 0.02 80)", primary: "#ffe066" }) }).error, undefined);
  assert.equal(appThemeFrom({ primary: "#ffe066" }).onPrimary, "#111111", "dark text on a light primary");
});
