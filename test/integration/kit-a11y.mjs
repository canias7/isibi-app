// ASK CHROMIUM WHAT EACH CONTROL IS CALLED, over the whole kit.
//
// WHY A BROWSER AND NOT A SCAN. An accessible name can come from `aria-label`,
// `aria-labelledby`, a `<label for>`, a wrapping `<label>`, the element's own
// text, a `title`, or `value` on a submit button — and the rules differ by role:
// a `role="combobox"` may NOT take its name from its contents, because its
// contents are the value. A hand-written scan of the source reported 152
// controls with "no name" and the first two checked were fine; Chromium's own
// accessibility tree said 25, and every one of those was real.
//
// WHAT IT CATCHES THAT NOTHING ELSE DOES. `role="progressbar"` with
// `aria-valuenow="47"` and no name announces a number with nothing to attach it
// to. A `contenteditable` editor whose only label is a `data-placeholder` drawn
// by a CSS `content:` rule, which is not in the accessibility tree at all. A
// listbox announced as "listbox". None of it typechecks wrong, none of it
// throws, none of it looks wrong on screen, and none of it is visible to
// `kit-render.mjs` — the html is correct html.
//
// $0: no model call, no container, no Neon project.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { TEMPLATE, OUT, CANNOT_RENDER, entries, renderAll } from "./kit-harness.mjs";

// playwright is one of the template's devDependencies, where the browser-driving
// belongs — resolved from there rather than added to the Worker's root
// package.json, which wrangler bundles. Same as site-runtime.mjs next door.
const { chromium } = createRequire(path.join(TEMPLATE, "package.json"))("playwright");

let failed = 0;
const ok = (m) => console.log("  ok   " + m);
const bad = (m, d) => { failed++; console.log("  FAIL " + m + (d ? "\n" + d : "")); };

/** Roles whose whole purpose is to be identified. A `generic` or a `list` needs
 *  no name; a thing somebody operates does. */
const NAMED = new Set(["textbox", "searchbox", "spinbutton", "slider", "combobox", "listbox",
  "checkbox", "radio", "switch", "button", "link", "menuitem", "tab", "progressbar"]);

/**
 * WHETHER THE CALLER CAN NAME IT, decided by the rendered element rather than
 * by the signature.
 *
 * A form field is often labelled from OUTSIDE — the caller renders
 * `<Label htmlFor={id}>` beside it — and that is correct, so an unnamed control
 * there is a division of labour rather than a defect. The question is whether
 * the caller has any route to it, and the honest test is whether the control
 * carries an `id` at all: with one, a `<label for>` reaches it; without one,
 * nothing outside the component can name it, ever.
 *
 * READ OFF THE ELEMENT, because the obvious inference is wrong. "The component
 * accepts an `id` prop" seemed like the same question and is not: `citation-list`
 * uses `id` as a prefix for anchor targets and `comment-anchor` uses it as the
 * comment's own identity, neither of which is a DOM id — and the components that
 * DO delegate mostly write `const fieldId = id ?? auto` and render `id={fieldId}`,
 * which no reading of the signature can see. That rule reported 36 components
 * as broken and at least half were fine.
 */
async function hasDomId(cdp, backendDOMNodeId) {
  try {
    const { object } = await cdp.send("DOM.resolveNode", { backendNodeId: backendDOMNodeId });
    const { result } = await cdp.send("Runtime.callFunctionOn", {
      objectId: object.objectId,
      functionDeclaration: "function () { return !!this.id; }",
      returnByValue: true,
    });
    return result.value === true;
  } catch { return false; }
}

console.log(`kit a11y — ${entries.length} components`);

let browser;
try {
  // The `full` pass only: this is about what a control is CALLED, which does not
  // change when a list is empty, and one pass keeps the browser work to ~2,000
  // page loads rather than 8,000.
  const rendered = renderAll("full").filter((r) => r.html && !CANNOT_RENDER[r.k]);

  browser = await chromium.launch(chromiumOptions());
  const page = await browser.newPage();
  // `page.accessibility` was removed in Playwright 1.62; CDP's
  // `Accessibility.getFullAXTree` is what it was built on and is still there.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Accessibility.enable");

  const missing = [], delegated = [];
  let controls = 0;
  for (const r of rendered) {
    await page.setContent(`<!doctype html><html><body>${r.html}</body></html>`, { waitUntil: "domcontentloaded" });
    const { nodes } = await cdp.send("Accessibility.getFullAXTree");
    for (const n of nodes) {
      if (n.ignored) continue;
      const role = n.role?.value;
      if (!NAMED.has(role)) continue;
      controls++;
      if ((n.name?.value || "").trim()) continue;
      const reachable = await hasDomId(cdp, n.backendDOMNodeId);
      (reachable ? delegated : missing).push(`${r.k}  role=${role}`);
    }
  }
  await browser.close();
  browser = null;

  // A FLOOR, or a harness that stopped rendering anything reports a clean kit.
  if (controls > 1000) ok(`${controls} named controls across ${rendered.length} components`);
  else bad(`only ${controls} controls found — the render or the AX tree is broken, not the kit`);

  const uniq = [...new Set(missing)];
  if (uniq.length === 0) ok("every control that must name itself does");
  else bad(`${uniq.length} controls have no accessible name`, uniq.slice(0, 20).map((m) => "    " + m).join("\n"));

  // Said out loud rather than silently skipped: these are unnamed HERE and
  // carry an id, so whoever renders them names them with a `<label for>`. If
  // that number ever reaches zero the rule has stopped matching anything and
  // this check has quietly narrowed.
  console.log(`  note ${new Set(delegated).size} more are unnamed and carry an id — the caller's <Label> reaches those`);
} finally {
  if (browser) await browser.close();
  fs.rmSync(OUT, { recursive: true, force: true });
}

// Whatever Chromium is already on the machine. The pinned playwright version
// and the pre-installed browser build often disagree, and the build number is
// not what this test is about. Falls back to playwright's own lookup. Same
// shape as site-runtime.mjs — one answer to this, not two.
function findChromium() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  const rels = ["chrome-linux/chrome", "chrome-linux64/chrome",
    "chrome-headless-shell-linux64/chrome-headless-shell", "chrome-linux/headless_shell"];
  const found = [];
  try {
    for (const dir of fs.readdirSync(root)) {
      for (const rel of rels) {
        const p = path.join(root, dir, rel);
        if (fs.existsSync(p)) found.push(p);
      }
    }
  } catch { /* fall through to playwright's own lookup */ }
  found.sort((a, b) => Number(/headless/.test(a)) - Number(/headless/.test(b)));
  return found[0] || null;
}
function chromiumOptions() {
  const exe = findChromium();
  return exe ? { executablePath: exe } : {};
}

console.log(`\n${failed ? failed + " failed" : "all passed"}`);
process.exit(failed ? 1 : 0);
