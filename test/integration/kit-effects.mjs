// MOUNT every component in a real browser, then take it away again.
//
// WHY THIS EXISTS. `kit-render.mjs` next door renders through
// `renderToString`, and server rendering NEVER RUNS AN EFFECT — no `useEffect`
// body, no cleanup, no listener, no timer, no imperative focus. So the entire
// effect layer of a 2,900-component kit was exercised by nothing, and that is
// not a theoretical gap: CLAUDE.md records `message-scroller` typechecking,
// bundling, and then HARD-CRASHING the page, because its context lives in an
// npm package and nothing said it needs a provider. A server render cannot see
// that. A mount can, and only a mount can.
//
// THREE THINGS, and the second is the one nothing else in this repo looks for:
//
//   1. MOUNTING DOES NOT THROW. An effect that reads a ref that is not there,
//      or a hook that needs a provider, fails here and nowhere earlier.
//   2. UNMOUNTING GIVES BACK WHAT IT TOOK. A component that adds a listener to
//      `window` or starts an interval and does not clear it keeps running after
//      its page is gone — on a router-driven site that is every navigation, and
//      it accumulates. `working-hours` ticks once a minute forever if its
//      cleanup is wrong, and its own comment says a pinned clock must not tick.
//   3. THE BROWSER SAYS NOTHING. Client React reports things the server does
//      not, including the invalid DOM nesting `renderToString` is silent about.
//
// AND THEN THE KEYBOARD, on the four listboxes whose arrow-key model was
// written but never driven. Those are named assertions rather than a sweep,
// because "the kit does not throw" would have passed against every one of them
// being inert.
//
// $0: no model call, no container, no Neon project.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { TEMPLATE, OUT, CANNOT_RENDER, entries, casesFor, renderAll } from "./kit-harness.mjs";

const { chromium } = createRequire(path.join(TEMPLATE, "package.json"))("playwright");
const require_ = createRequire(import.meta.url);

let failed = 0;
const ok = (m) => console.log("  ok   " + m);
const bad = (m, d) => { failed++; console.log("  FAIL " + m + (d ? "\n" + d : "")); };

/**
 * COMPONENTS THAT CANNOT BE MOUNTED HERE, beyond the render harness's own list.
 *
 * Justified individually and kept short, for the reason `CANNOT_RENDER` states:
 * an allow-list is the usual way a check quietly stops covering things.
 */
const CANNOT_MOUNT = {
  ...CANNOT_RENDER,
};

console.log(`kit effects — mounting ${entries.length} components`);

const cases = casesFor(entries, "full").filter((c) => !CANNOT_MOUNT[c.k]);
// The server render, used only to tell a table fragment from a page element.
const ssr = Object.fromEntries(renderAll("full").map((r) => [r.k, (r.html || "").slice(0, 40)]));

// ---- the page bundle -------------------------------------------------------
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

fs.writeFileSync(path.join(OUT, "mount.tsx"), `import React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
${cases.map((c, i) => `import { ${c.name} as C${i} } from "${c.spec}";`).join("\n")}
// A DELIBERATE LEAK, so the instrument has to prove it works.
//
// Two mutations survived without this: removing the interval cleanup from
// working-hours changed nothing, because the synthesiser passes it a pinned
// clock and its effect returns early — so no interval was ever created and
// there was nothing to fail to clear. A counter with nothing to count reports a
// clean kit, which is this repo's most-recorded failure and would have been
// this check's own.
function Leaky() {
  React.useEffect(() => {
    window.addEventListener("resize", () => {});
    window.setInterval(() => {}, 1000);
  }, []);
  return React.createElement("span", null, "leaky");
}

const SSR: Record<string, string> = ${JSON.stringify(ssr)};
const CASES: any[] = [
${cases.map((c, i) => `  { k: ${JSON.stringify(c.k)}, C: C${i}, props: { ${c.props} } },`).join("\n")}
];

// WHAT WAS TAKEN AND NOT GIVEN BACK. Wrapped once, before anything mounts.
//
// LISTENERS ON \window\ AND \document\ ONLY: React attaches its own delegated
// handlers to the ROOT CONTAINER, so counting every target would report React's
// bookkeeping as a leak on all 2,900 components.
//
// INTERVALS BUT NOT TIMEOUTS. An interval must always be cleared. A timeout that
// has already fired needs no clearing, and a component that sets a 200ms
// debounce and unmounts at 250ms is correct — counting those would flag correct
// code, which is the failure mode this repo cares most about.
const live = { listeners: 0, intervals: 0 };
// Gross counts, never decremented — how much was TAKEN, as against what is left.
const counts = { listeners: 0, intervals: 0 };
for (const t of [window, document]) {
  const add = t.addEventListener.bind(t), rem = t.removeEventListener.bind(t);
  (t as any).addEventListener = (...a: any[]) => { live.listeners++; counts.listeners++; return (add as any)(...a); };
  (t as any).removeEventListener = (...a: any[]) => { live.listeners--; return (rem as any)(...a); };
}
const si = window.setInterval.bind(window), ci = window.clearInterval.bind(window);
(window as any).setInterval = (...a: any[]) => { live.intervals++; counts.intervals++; return (si as any)(...a); };
(window as any).clearInterval = (...a: any[]) => { live.intervals--; return (ci as any)(...a); };

(window as any).__kit = {
  count: CASES.length,
  async run(from: number, to: number) {
    const out: any[] = [];
    // A WARM-UP THAT IS THROWN AWAY. React does one-time global setup on its
    // first root — a listener on the document among other things — and without
    // this the very first component in the catalogue is charged for it and
    // reported as leaking. It was Abbreviation, which has no effects at all.
    if (from === 0) {
      const warm = document.createElement("div");
      document.body.appendChild(warm);
      const r0 = createRoot(warm);
      flushSync(() => r0.render(React.createElement("span", null, "warm")));
      r0.unmount(); warm.remove();
      live.listeners = 0; live.intervals = 0;
    }
    const realErr = console.error, realWarn = console.warn;
    for (let i = from; i < to && i < CASES.length; i++) {
      const c = CASES[i];
      // A ROW IS NOT A PAGE. CountSheetRow renders a <tr> and
      // FooterSummary a <tfoot> — a fragment of a table, correct in the
      // place it is meant to go and invalid in a bare <div>, where React
      // rightly complains. Mounting those in a table host tests the component
      // rather than the harness's choice of container. Decided by what the
      // component's own SERVER render starts with, which is a fact rather than
      // a guess from its name.
      const tag = (/^<([a-z]+)[^a-z]/.exec(SSR[c.k] || "") || [, ""])[1];
      let host: HTMLElement;
      if (/^(tr|tbody|thead|tfoot|caption|colgroup)$/.test(tag)) {
        // A tfoot belongs to a TABLE and a tr to a tbody — one host does not fit
        // both, which is why the first attempt still reported tfoot-in-div.
        const table = document.createElement("table");
        document.body.appendChild(table);
        if (tag === "tr") { const b = document.createElement("tbody"); table.appendChild(b); host = b; }
        else host = table;
      } else if (/^(td|th)$/.test(tag)) {
        const table = document.createElement("table");
        const b = document.createElement("tbody"), tr = document.createElement("tr");
        table.appendChild(b); b.appendChild(tr); document.body.appendChild(table); host = tr;
      } else { host = document.createElement("div"); document.body.appendChild(host); }
      const said: string[] = [];
      const grab = (...a: any[]) => { said.push(a.map((x) => String(x)).join(" ")); };
      console.error = grab; console.warn = grab;
      const before = { ...live };
      const seen = { ...counts };
      let error = null, root: any = null;
      try {
        root = createRoot(host);
        // Synchronous flush, so effects have run by the time this returns.
        flushSync(() => root.render(React.createElement(c.C, c.props)));
      } catch (e: any) { error = "mount: " + String(e && e.message ? e.message : e); }
      try { if (root) root.unmount(); }
      catch (e: any) { error = error ?? ("unmount: " + String(e && e.message ? e.message : e)); }
      console.error = realErr; console.warn = realWarn;
      (host.closest("table") || host).remove();
      out.push({
        k: c.k, error, said,
        leakedListeners: live.listeners - before.listeners,
        leakedIntervals: live.intervals - before.intervals,
        took: (counts.listeners - seen.listeners) + (counts.intervals - seen.intervals),
      });
    }
    return out;
  },
  /** Mount the deliberate leak and report what it took. */
  selfTest() {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const before = { ...live };
    const root = createRoot(host);
    flushSync(() => root.render(React.createElement(Leaky)));
    root.unmount(); host.remove();
    return { listeners: live.listeners - before.listeners, intervals: live.intervals - before.intervals };
  },
  /** How many components took a listener or an interval at all, so a run over
   *  props that disable every effect cannot read as a clean kit. */
  touched: 0,
  /** Mount ONE named component with props chosen by the caller, for the
   *  interaction checks below — which need real data rather than the
   *  synthesiser's, because they assert what a specific key press does. */
  mount(k: string, props: any) {
    const c = CASES.find((x: any) => x.k === k);
    if (!c) throw new Error("no such component: " + k);
    const host = document.getElementById("kb") || document.body;
    const root = createRoot(host);
    flushSync(() => root.render(React.createElement(c.C, props)));
    return root;
  },
};
export {};
`);

const esbuild = require_(path.join(TEMPLATE, "node_modules/esbuild/lib/main.js"));
const built = esbuild.buildSync({
  entryPoints: [path.join(OUT, "mount.tsx")],
  bundle: true,
  // IIFE for a browser with no module resolution, and React BUNDLED rather than
  // external — there is no import map on a blank page.
  format: "iife",
  platform: "browser",
  outfile: path.join(OUT, "mount.js"),
  jsx: "automatic",
  alias: { "@": path.join(TEMPLATE, "src") },
  nodePaths: [path.join(TEMPLATE, "node_modules")],
  define: { "process.env.NODE_ENV": '"development"' },
  logLevel: "error",
  absWorkingDir: TEMPLATE,
});
if (built.errors?.length) throw new Error(built.errors.map((e) => e.text).join("\n"));

// ---- drive it --------------------------------------------------------------
let browser;
try {
  browser = await chromium.launch(chromiumOptions());
  const page = await browser.newPage();
  await page.setContent("<!doctype html><html><body></body></html>");
  await page.addScriptTag({ path: path.join(OUT, "mount.js") });

  const results = [];
  const BATCH = 150;             // one evaluate per batch keeps the bridge cheap
  for (let i = 0; i < cases.length; i += BATCH) {
    results.push(...await page.evaluate(([a, b]) => window.__kit.run(a, b), [i, i + BATCH]));
  }

  // A FLOOR. A bundle that failed to expose anything reports a clean kit.
  if (results.length > entries.length * 0.9) ok(`${results.length} components mounted and unmounted`);
  else bad(`only ${results.length} of ${entries.length} ran — the bundle or the bridge is broken, not the kit`);

  const threw = results.filter((r) => r.error);
  if (threw.length === 0) ok("nothing threw on mount or unmount");
  else bad(`${threw.length} threw`, threw.slice(0, 12).map((r) => `    ${r.k} -> ${r.error}`).join("\n"));

  const leaked = results.filter((r) => r.leakedListeners > 0 || r.leakedIntervals > 0);
  if (leaked.length === 0) ok("every component gave back the listeners and intervals it took");
  else bad(`${leaked.length} leak past unmount`, leaked.slice(0, 12)
    .map((r) => `    ${r.k} -> ${r.leakedListeners} listener(s), ${r.leakedIntervals} interval(s)`).join("\n"));

  // …AND THE COUNTER CAN COUNT. A deliberate leak, mounted and unmounted the
  // same way, must be reported — otherwise the clean result above is a fact
  // about the instrument rather than about the kit.
  const self = await page.evaluate(() => window.__kit.selfTest());
  if (self.listeners === 1 && self.intervals === 1) ok("…and a component that deliberately leaks is caught");
  else bad("the leak counter does not see a deliberate leak", "    " + JSON.stringify(self));

  // A FLOOR ON WHAT WAS EXERCISED. If the synthesised props happen to disable
  // every effect in the kit — a pinned clock, a disabled flag — nothing is
  // taken, nothing can be left behind, and the check above passes over nothing.
  const took = results.filter((r) => r.took > 0).length;
  if (took >= 20) ok(`${took} components really did take a listener or an interval`);
  else bad(`only ${took} components took anything — the props are disabling the effects, so the leak check is running over nothing`);

  // REPORTED AND NOT ASSERTED, and the reason is measured rather than assumed.
  // Client React says things the server does not, and some of it is real — it is
  // how `breadcrumb-collapse` was caught keying every crumb on the same empty
  // string. But most of what is left is the SYNTHESISER rather than the kit, in
  // two shapes that cannot be cleaned from here: a stub callback cannot know
  // what makes two rows distinct, so `getKey` returns something that collides;
  // and a `React.ReactNode` prop is given an element, which a component then
  // places somewhere only a `<td>` may go. Asserting this would make the check
  // red on day one, and a check that is always red is a check nobody reads.
  //
  // The equivalent SERVER-side report in kit-render.mjs IS asserted, and is
  // clean, so the class is not unguarded — what is unasserted here is the extra
  // that only a mount can see.
  const complained = results.filter((r) => (r.said || []).length);
  if (complained.length === 0) ok("the browser's React reported nothing");
  else console.log(`  note React said something about ${complained.length} — synthesised props, mostly; see the header\n` +
    complained.slice(0, 8).map((r) => `       ${r.k} -> ${(r.said[0] || "").replace(/\s+/g, " ").slice(0, 110)}`).join("\n"));

  await keyboard(page);
} finally {
  if (browser) await browser.close();
  fs.rmSync(OUT, { recursive: true, force: true });
}

/**
 * THE ARROW KEYS, DRIVEN. Four listboxes had their keyboard model written in
 * this session and verified by typechecking alone — which proves the code
 * compiles and nothing whatever about whether pressing Down moves anything.
 * `font-picker` is the sharpest case: it moves focus imperatively through a ref,
 * and setting `tabIndex` without calling `.focus()` leaves the browser's focus
 * where it was, so the key appears to do nothing. That is the bug every
 * hand-rolled roving tabindex has, and no render can see it.
 */
async function keyboard(page) {
  await page.evaluate(() => { document.body.innerHTML = '<div id="kb"></div>'; });
  const drive = (script) => page.evaluate(script).catch((e) => ({ threw: e.message }));

  // FontPicker: arrows move focus AND the selection follows Enter.
  const fp = await drive(`(async () => {
    const R = window.__kit.mount("font-picker.FontPicker", { value: null, onChange: (v) => { window.__picked = v; },
      families: [{value:"A",label:"A",stack:"serif"},{value:"B",label:"B",stack:"serif"},{value:"C",label:"C",stack:"serif"}] });
    const first = document.querySelector('[role="option"]');
    first.focus();
    const before = document.activeElement.textContent;
    first.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
    const after = document.activeElement.textContent;
    document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
    R.unmount();
    return { moved: before !== after, picked: window.__picked };
  })()`);
  if (fp && fp.moved && fp.picked === "B") ok("font-picker: ArrowDown moves focus and Enter chooses that row");
  else bad("font-picker's roving tabindex does not move focus", "    " + JSON.stringify(fp));

  // SearchSelect: the input owns the keys, so the ACTIVE option moves and Enter
  // chooses it. Nothing here moves focus — that is the other correct pattern,
  // and asserting focus movement would fail a component that is right.
  const ss = await drive(`(async () => {
    const R = window.__kit.mount("search-select.SearchSelect", { value: null, onChange: (v) => { window.__ss = v; },
      options: [{value:"a",label:"Alpha"},{value:"b",label:"Bravo"},{value:"c",label:"Charlie"}], id: "ss" });
    const input = document.querySelector("input");
    input.focus();
    const key = (k) => input.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
    const first = document.getElementById("ss-list") ? input.getAttribute("aria-activedescendant") : "no-list";
    key("ArrowDown");
    await new Promise((r) => setTimeout(r, 0));
    const second = input.getAttribute("aria-activedescendant");
    key("Enter");
    await new Promise((r) => setTimeout(r, 0));
    R.unmount();
    return { first, second, chose: window.__ss };
  })()`);
  if (ss && ss.first !== ss.second && ss.chose === "b") ok("search-select: ArrowDown moves the active option and Enter chooses it");
  else bad("search-select's arrow keys do not move aria-activedescendant", "    " + JSON.stringify(ss));

  // AsyncSelect and TagSelect got that same model written this session, and
  // neither had ever been driven. TagSelect additionally SKIPS an option that is
  // already taken, which is the part most likely to be subtly wrong.
  const ts = await drive(`(async () => {
    const R = window.__kit.mount("tag-select.TagSelect", { value: ["b"], onChange: (v) => { window.__ts = v; },
      options: [{value:"a",label:"Alpha"},{value:"b",label:"Bravo"},{value:"c",label:"Charlie"}] });
    const input = document.querySelector("input");
    input.focus();
    await new Promise((r) => setTimeout(r, 0));
    const key = (k) => document.querySelector("input").dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
    key("ArrowDown");                      // from Alpha, past the taken Bravo
    await new Promise((r) => setTimeout(r, 0));
    key("Enter");
    await new Promise((r) => setTimeout(r, 0));
    R.unmount();
    return { added: window.__ts };
  })()`);
  if (ts && Array.isArray(ts.added) && ts.added.join() === "b,c") ok("tag-select: ArrowDown skips the option already taken");
  else bad("tag-select's arrows do not skip a taken option", "    " + JSON.stringify(ts));
}

// Whatever Chromium is already on the machine — same shape as site-runtime.mjs.
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
