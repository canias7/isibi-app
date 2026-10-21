// THE APP KIT (2026-10-21, phase A of docs/plans/2026-10-21-expo-apps.md): a
// pinned Expo template, themed from one file, with our own components. The
// static cases always run; the compile-and-export case runs where the
// template's dependencies are installed, like `sheet-rtl`'s browser cases.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, mkdtempSync, cpSync, symlinkSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

const T = new URL("../app-builder/expo/", import.meta.url).pathname;
const F = new URL("./fixtures/expo-harbour/", import.meta.url).pathname;
const read = (p) => readFileSync(path.join(T, p), "utf8");

test("the template is pinned: Expo, Expo Router, React Native, NativeWind, with a lockfile and no EAS", () => {
  const pkg = JSON.parse(read("package.json"));
  for (const d of ["expo", "expo-router", "react-native", "react-native-web", "nativewind"]) assert.ok(pkg.dependencies[d], d);
  assert.ok(pkg.devDependencies.tailwindcss.startsWith("^3."), "NativeWind 4 needs Tailwind 3");
  assert.ok(existsSync(path.join(T, "package-lock.json")));
  assert.ok(!existsSync(path.join(T, "eas.json")), "builds go through Codemagic, not EAS");
  assert.equal(JSON.parse(read("app.json")).expo.web.output, "single", "the web version is one static page for the phones");
});

test("the look is one file: every theme key reaches the classes, and the kit uses no colour of its own", () => {
  const theme = JSON.parse(read("theme.json"));
  const tw = read("tailwind.config.js");
  for (const k of ["paper", "card", "ink", "soft", "line", "primary", "onPrimary", "accent", "good", "radius"]) {
    assert.ok(k in theme, k);
    assert.match(tw, new RegExp("t\\." + k + "\\b"), k + " reaches tailwind");
  }
  for (const f of readdirSync(path.join(T, "components/app"))) {
    assert.doesNotMatch(readFileSync(path.join(T, "components/app", f), "utf8"), /#[0-9a-f]{3,6}\b/i, f + " has a hard-coded colour");
  }
});

test("the kit exports what a screen needs, from one place", () => {
  const idx = read("components/app/index.ts");
  for (const n of ["AppTabs", "Screen", "Title", "Heading", "Body", "Button", "ListRow", "Group", "GroupRow", "Chips", "Card", "Badge", "Thumb", "Stepper", "Toggle", "BottomSheet", "OpenNow", "HoursList"]) {
    assert.match(idx, new RegExp("\\b" + n + "\\b"), n);
  }
  assert.match(read("app/(tabs)/_layout.tsx"), /<AppTabs tabs=\{/);
  assert.match(read("app/_layout.tsx"), /import "\.\.\/global\.css";/);
});

test("open-now reads the phone's clock against the week", async () => {
  // The rule, restated from hours.tsx's `openState`, is held to the source's own landmarks.
  const src = read("components/app/hours.tsx");
  assert.match(src, /t >= mins\(today\.open\) && t < mins\(today\.close\)/);
  assert.match(src, /for \(let i = 1; i <= 7; i\+\+\)/);
});

const installed = existsSync(path.join(T, "node_modules/expo/package.json"));
test("the Harbour Loaf fixture, written only with the kit, typechecks and exports for the web", { skip: !installed && "the template's dependencies are not installed", timeout: 900_000 }, () => {
  const w = mkdtempSync(path.join(tmpdir(), "expo-kit-"));
  try {
    cpSync(T, w, { recursive: true, filter: (s) => !/[\\/](node_modules|dist|\.expo)([\\/]|$)/.test(s.slice(T.length - 1)) });
    rmSync(path.join(w, "app/(tabs)"), { recursive: true, force: true });
    cpSync(F, w, { recursive: true });
    symlinkSync(path.join(T, "node_modules"), path.join(w, "node_modules"));
    execFileSync("npx", ["tsc", "--noEmit"], { cwd: w, stdio: "pipe" });
    execFileSync("npx", ["expo", "export", "-p", "web"], { cwd: w, stdio: "pipe", env: { ...process.env, CI: "1" } });
    const html = readFileSync(path.join(w, "dist/index.html"), "utf8");
    assert.match(html, /<script src="\/_expo\/static\/js\/web\/entry-[a-f0-9]+\.js" defer><\/script>/);
  } finally {
    rmSync(w, { recursive: true, force: true });
  }
});
