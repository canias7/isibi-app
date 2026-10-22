// Scene3D (2026-10-22): the kit's one door to a WebGL canvas, so a page never
// hand-writes three.js. These guard what makes it safe to offer at all: the
// poster is what the server renders, three.js never loads on the server or in
// the first download, reduced motion is honoured, colours come from the
// theme, and the prompts point at it without loosening "almost never".
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { COMPONENT_API, COMPONENT_TYPE_NAMES } from "../builder/component-api.mjs";
import { UI_COMPONENTS } from "../builder/ui-components.mjs";
import { PAGE_RULES, sceneOn, sceneDirective } from "../builder/page-gen.mjs";

const FILE = "builder/lovable/template/src/components/ui/scene-3d.tsx";
const src = fs.readFileSync(FILE, "utf8");
/** The code with comments blanked, so prose cannot satisfy or trip a scan. */
const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

test("Scene3D is in the kit, and its signature is what a page is told", () => {
  assert.ok(UI_COMPONENTS.includes("scene-3d"), "scene-3d is not offered as a kit component");
  const sig = COMPONENT_API["scene-3d"];
  assert.ok(sig, "scene-3d has no recorded signature");
  assert.match(sig, /^Scene3D\(label: string,/, "label must be the first prop and required");
  for (const p of [/src\?: string/, /shape\?: .*"knot"/, /poster\?: string/, /height\?: number = 360/, /autoRotate\?: boolean = true/]) {
    assert.match(sig, p, "the signature lost " + p);
  }
  assert.deepEqual(COMPONENT_TYPE_NAMES["scene-3d"], ["Scene3DShape"]);
});

test("three.js loads only in the browser, never in the server render or the first download", () => {
  assert.ok(code.length > 2000, "the blanked source is empty: this guard is reading nothing");
  assert.match(code, /await import\("three"\)/, "three.js is not loaded on demand");
  assert.match(code, /await import\("three\/examples\/jsm\/loaders\/GLTFLoader\.js"\)/, "the glTF loader is not loaded on demand");
  assert.doesNotMatch(code, /^\s*import[^;]*from\s+["']three/m, "a static three.js import puts it in every page's first download and in the server render");
  assert.doesNotMatch(code, /@react-three\/fiber/, "the component must not pull in the React renderer for one object");
  // the dynamic import lives inside an effect: the effect body holds it.
  const effects = code.split("React.useEffect(").slice(1);
  assert.ok(effects.some((e) => e.includes('import("three")')), "three.js is imported outside an effect");
});

test("the poster is what renders first; reduced motion and no WebGL keep it", () => {
  assert.match(code, /prefers-reduced-motion: reduce/, "reduced motion is not asked");
  assert.match(code, /const wanted = near && !failed && \(!reduced \|\| optedIn\)/, "the canvas can start without being near, after a failure, or against reduced motion");
  assert.match(code, /getContext\("webgl2"\) \|\| probe\.getContext\("webgl"\)/, "WebGL is not probed before three.js is fetched");
  assert.match(code, /setFailed\(true\)/, "a failure does not fall back to the poster");
  assert.match(code, /View in 3D/, "reduced motion has no way to opt in");
  assert.match(code, /const spin = autoRotate && !reduced/, "an opted-in reduced-motion visitor still gets a spinning object");
  // initial state is the poster: nothing browser-only decides the first render.
  assert.match(code, /useState\(false\);[\s\S]*const \[failed/, "live does not start false");
  assert.match(code, /\{!live && \(poster \?/, "the poster is not what shows while not live");
});

test("accessible: a labelled picture, buttons beside it, keys turn it, fixed height", () => {
  assert.match(code, /role="img"\s+aria-label=\{label\}/, "the stage is not a labelled picture");
  assert.match(code, /setAttribute\("aria-hidden", "true"\)/, "the canvas is not hidden behind the label");
  assert.match(code, /ArrowLeft/, "the arrow keys do not turn it");
  assert.match(code, /style=\{\{ height \}\}/, "the height is not fixed");
  // a role="img" hides its children: no button may sit inside the stage.
  const from = code.indexOf('role="img"'), to = code.indexOf("{!live && reduced && !optedIn");
  assert.ok(from > 0 && to > from, "the stage or the opt-in button moved: the guard is reading nothing");
  const stage = code.slice(from, to);
  assert.ok(/\)\)\}\s*<\/div>\s*$/.test(stage), "the stage does not close before the buttons");
  assert.doesNotMatch(stage, /<button/, "a button sits inside role=img, where assistive technology cannot reach it");
});

test("theme tokens only: no literal colour in the component", () => {
  assert.match(code, /themeColour\(el, "--primary"\)/, "the object is not painted with the theme");
  assert.doesNotMatch(code, /#[0-9a-fA-F]{3,8}\b/, "a hex colour is written into the component");
  assert.doesNotMatch(code, /\b(?:rgb|hsl|oklch)\(\s*\d/, "a literal colour function is written into the component");
});

test("sceneOn counts a Scene3D as a scene: import AND element, never either alone", () => {
  const IMPORT = 'import { Scene3D } from "@/components/ui/scene-3d";\n';
  assert.equal(sceneOn(IMPORT + '<Scene3D label="x" />'), true, "a Scene3D on the page was not read as a scene");
  assert.equal(sceneOn(IMPORT + "<Scene3D\n  label=\"x\"\n/>"), true, "a Scene3D across lines was not read as a scene");
  assert.equal(sceneOn(IMPORT + "<main />"), false, "a dead import read as a scene");
  assert.equal(sceneOn('<Scene3D label="x" />'), false, "an element with no import read as a scene");
  assert.equal(sceneOn(IMPORT + '<Scene3DLegend />'), false, "a prefix read as the element");
});

test("the prompts point at Scene3D and keep the ceiling", () => {
  assert.match(PAGE_RULES, /3D IS AVAILABLE AND IS ALMOST NEVER RIGHT/, "the ceiling was loosened");
  assert.match(PAGE_RULES, /ONLY where the design step asked for it/, "the design-step condition was dropped");
  assert.match(PAGE_RULES, /NEVER PUT WORDS, A LOGO OR A BACKGROUND EFFECT IN A CANVAS/);
  assert.match(PAGE_RULES, /import \{ Scene3D \} from\s+"@\/components\/ui\/scene-3d"/, "the page writer is not pointed at Scene3D");
  const d = sceneDirective("a chair you can turn");
  assert.match(d, /Scene3D/, "the scene directive still says to hand-write a canvas");
  assert.match(d, /@\/components\/ui\/scene-3d/);
});
