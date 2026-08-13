// WHAT THE KIT LOOKS LIKE, with the real stylesheet, measured rather than seen.
//
// WHY THIS EXISTS. Everything else in this repo checks the kit as STRUCTURE —
// it compiles, it renders, it mounts, its controls have names. None of that can
// see a colour. And colour is where this codebase has been hurt worst: all 70
// charts once rendered GREY while typechecking perfectly, because they asked for
// `hsl(var(--chart-1))` against a v4 token that already holds a complete colour,
// so every declaration was invalid and every series fell back to the same
// default. Thirteen components rendered their modal panels SEE-THROUGH, with the
// page's own headings legible straight through them. Eight reference lines were
// red on a monochrome kit. Every one was found by a person looking at a render,
// long afterwards, and every one is a number a machine can compute.
//
// SO: real CSS, both modes, and one question a picture cannot be argued with —
// CAN THIS TEXT BE READ. WCAG's contrast ratio over the composited background,
// 4.5:1 for body text and 3:1 for large or bold, which is the line the standard
// draws and not one invented here.
//
// THE STYLESHEET IS THE WHOLE DIFFICULTY. Without it every class is inert, the
// page is black on white, and a contrast check passes over nothing while looking
// exactly like a clean result. `styles.css` says `@source "../src"`, so Tailwind
// scans the entire kit — building it once gives CSS covering every class any
// component uses.
//
// $0: no model call, no container, no Neon project.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { TEMPLATE, OUT, CANNOT_RENDER, chartEntries, entries, renderAll } from "./kit-harness.mjs";

const { chromium } = createRequire(path.join(TEMPLATE, "package.json"))("playwright");

let failed = 0;
const ok = (m) => console.log("  ok   " + m);
const bad = (m, d) => { failed++; console.log("  FAIL " + m + (d ? "\n" + d : "")); };

console.log(`kit paint — ${entries.length} ui + ${chartEntries.length} chart components, light and dark`);

// ---- the real stylesheet ---------------------------------------------------
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "css.js"), 'import "../src/styles.css";\n');

const vite = await import(path.join(TEMPLATE, "node_modules/vite/dist/node/index.js"));
const tailwind = (await import(path.join(TEMPLATE, "node_modules/@tailwindcss/vite/dist/index.mjs"))).default;
await vite.build({
  root: TEMPLATE,
  configFile: false,
  logLevel: "error",
  plugins: [tailwind()],
  build: {
    outDir: path.join(OUT, "css"),
    emptyOutDir: true,
    rollupOptions: { input: path.join(OUT, "css.js") },
  },
});
const cssFile = fs.readdirSync(path.join(OUT, "css/assets")).find((f) => f.endsWith(".css"));
const css = fs.readFileSync(path.join(OUT, "css/assets", cssFile), "utf8");
// A FLOOR ON THE STYLESHEET ITSELF. An empty or near-empty build would leave
// every class inert and every assertion below passing over a black-on-white
// page — the most reassuring possible way to check nothing.
if (css.length > 50_000 && /--background/.test(css)) ok(`the real stylesheet built (${Math.round(css.length / 1024)} KB)`);
else bad(`the stylesheet is ${css.length} bytes — every class below is inert, so nothing is being checked`);

// THE CHARTS ARE IN, and leaving them out was the wrong way round: the whole
// reason this file exists is that all 70 charts once rendered GREY while
// typechecking perfectly, because they asked for `hsl(var(--chart-1))` against
// a v4 token that already holds a complete colour. `renderAll` defaults to the
// ui list, so a first version of this checked 2,007 of the kit's 2,925
// components and silently skipped the tier with the worst colour history.
//
// `truncated` signatures are dropped from the chart pass for the reason
// `kit-render` drops them: an ellipsis makes the prop list look complete when
// it is not, so the props synthesised for one are a guess.
const rendered = [
  ...renderAll("full"),
  ...renderAll("full", chartEntries.filter((e) => !e.truncated)),
].filter((r) => r.html && !CANNOT_RENDER[r.k]);
const CHART_KEYS = new Set(chartEntries.map((e) => `${e.mod}.${e.name}`));

// KNOWN ANSWERS, through the same code path as the kit.
//
// Every assertion below is "nothing came back bad", and that is exactly the
// shape that passes when the measurement has quietly stopped measuring — which
// already happened once here: a hand-written colour parser rejected every
// `oklch()` in the kit and the check reported a clean result over an empty set.
// A control that MUST be reported unreadable is the only thing that tells a
// working check from a broken one.
//
// They also pin the two exemptions in BOTH directions, which nothing else can:
// with the real components now fixed, a mutation widening "decoration" back to
// bare `aria-hidden` would change no other line of this output.
//
// Backgrounds are set explicitly so every expectation holds in both modes.
const CONTROLS = [
  // The measurement can fail at all.
  { k: "control:grey on white", expect: "fail", html: `<p style="color:#999;background:#fff;font-size:14px;padding:4px">unreadable</p>` },
  { k: "control:black on white", expect: "pass", html: `<p style="color:#000;background:#fff;font-size:14px;padding:4px">readable</p>` },
  // WCAG's large-text threshold: the same ink passes at 30px and fails at 14px.
  { k: "control:mid grey small", expect: "fail", html: `<p style="color:#8e8e8e;background:#fff;font-size:14px;padding:4px">small</p>` },
  { k: "control:mid grey large", expect: "pass", html: `<p style="color:#8e8e8e;background:#fff;font-size:30px;padding:4px">large</p>` },
  // A translucent INK is composited before it is judged.
  { k: "control:translucent ink", expect: "fail", html: `<p style="color:rgba(0,0,0,.25);background:#fff;font-size:14px;padding:4px">faint</p>` },
  // A translucent BACKGROUND is composited over what is under it. Judged against
  // the page instead of the black beneath, this one passes — so it is what
  // holds `behind()` walking the whole ancestor stack.
  { k: "control:translucent layer", expect: "fail", html: `<div style="background:#000;padding:4px"><div style="background:rgba(255,255,255,.15);padding:4px"><p style="color:#333;font-size:14px">stacked</p></div></div>` },
  // ONE BAD LINE AMONG GOOD ONES. Only the worst piece of text in a component
  // is reported, and with every control carrying a single line — and the kit
  // itself now green — nothing else here can tell "worst" from "best": a
  // mutation flipping that comparison survived the entire sweep. This is the
  // case that discriminates, and it is the ordinary shape of a real defect,
  // where one label in a working component is the unreadable one.
  { k: "control:one bad line among good", expect: "fail", html: `<div style="background:#fff;padding:4px"><p style="color:#000;font-size:14px">readable</p><p style="color:#999;font-size:14px">unreadable</p></div>` },
  // AN SVG GLYPH IS PAINTED BY `fill`, NOT `color`. Dark `color`, white `fill`,
  // on white: reading `color` scores 21:1 and passes, reading `fill` scores
  // 1:1 and fails. So `expect: "fail"` is what holds the right property being
  // read — and this is a real disagreement in this kit rather than a contrived
  // one, since `lean` carries exactly that pair.
  { k: "control:svg text is filled not coloured", expect: "fail", html: `<div style="background:#fff;padding:4px"><svg width="80" height="20"><text x="0" y="14" style="color:#000;fill:#fff;font-size:14px">svg</text></svg></div>` },
  // `fill: none` paints no glyph, so there is nothing to judge.
  { k: "control:svg fill none", expect: "exempt", html: `<div style="background:#fff;padding:4px"><svg width="80" height="20"><text x="0" y="14" style="color:#000;fill:none;font-size:14px">svg</text></svg></div>` },
  // The two exemptions, each way round.
  { k: "control:decoration", expect: "exempt", html: `<p aria-hidden="true" style="pointer-events:none;color:#eee;background:#fff;font-size:14px;padding:4px">ghost</p>` },
  { k: "control:hidden but clickable", expect: "fail", html: `<p aria-hidden="true" style="color:#eee;background:#fff;font-size:14px;padding:4px">hint</p>` },
  { k: "control:inactive", expect: "exempt", html: `<button disabled style="color:#eee;background:#fff;font-size:14px;padding:4px">off</button>` },
];

// EVERY CUSTOM PROPERTY THE STYLESHEET DECLARES, so a failure can be reported
// against the token that caused it rather than an `oklch()` triple nobody can
// search for. Whether each one is a colour is decided IN THE PAGE, by whether
// the browser can parse its value — reading that off the text here would mean a
// second, worse copy of the parser that already exists down there.
const tokens = [...new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]))];

let browser;
try {
  browser = await chromium.launch(chromiumOptions());
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });

  const results = {};
  for (const mode of ["light", "dark"]) {
    await page.setContent(`<!doctype html><html class="${mode === "dark" ? "dark" : ""}"><head><style>${css}</style></head>` +
      `<body class="bg-background text-foreground"><div id="host"></div></body></html>`, { waitUntil: "domcontentloaded" });
    results[mode] = await page.evaluate(measure, {
      pairs: [...CONTROLS.map((c) => [c.k, c.html]), ...rendered.map((r) => [r.k, r.html])],
      tokens,
    });
  }

  for (const mode of ["light", "dark"]) {
    const { components: all, pairs } = results[mode];
    const verdict = (r) => (r.checked === 0 && !r.worst) ? "exempt"
      : (r.worst && r.worst.ratio < r.worst.need) ? "fail" : "pass";

    // The controls first: if these are wrong, nothing below means anything.
    const wrong = CONTROLS.map((c) => ({ c, got: verdict(all.find((r) => r.k === c.k)) }))
      .filter((x) => x.got !== x.c.expect);
    if (wrong.length === 0) ok(`${mode}: all ${CONTROLS.length} known-answer controls came out right`);
    else bad(`${mode}: ${wrong.length} controls came out wrong — the measurement is broken, so every result below is meaningless`,
      wrong.map((x) => `    ${x.c.k}: expected ${x.c.expect}, got ${x.got}`).join("\n"));

    const res = all.filter((r) => !r.k.startsWith("control:"));

    // A FLOOR ON THE PAIRS TOO. `--muted`/`--primary`/`--destructive` are
    // always there, so a handful of pairs means the token scan stopped working
    // and the assertion below is about an empty list.
    if (pairs.length >= 8) ok(`${mode}: checked ${pairs.length} of the kit's own colour pairings`);
    else bad(`${mode}: only ${pairs.length} colour pairings were found — the token scan is broken, not the palette`);

    const badPairs = pairs.filter((p) => p.ratio < 4.5).sort((a, b) => a.ratio - b.ratio);
    if (badPairs.length === 0) ok(`${mode}: every bg-x/text-x-foreground pairing is readable`);
    else bad(`${mode}: ${badPairs.length} of the kit's own colour pairings cannot be read`, badPairs
      .map((p) => `    ${p.name} + ${p.name}-foreground  ${p.ratio.toFixed(2)}:1 (needs 4.5)\n      ${p.bg} under ${p.fg}`)
      .join("\n"));

    const checked = res.reduce((n, r) => n + r.checked, 0);
    const exempt = res.reduce((n, r) => n + r.exempt, 0);
    // The same floor one level down: if nothing had readable text, the ratios
    // below are a statement about an empty set.
    // The exempt count is PRINTED rather than swallowed: an exemption nobody can
    // see is how a check quietly stops covering the thing it was written for.
    if (checked > 3000) ok(`${mode}: read the contrast of ${checked} pieces of text (${exempt} exempt: decoration or an inactive control)`);
    else bad(`${mode}: only ${checked} pieces of text were measured — the render or the CSS is broken, not the kit`);

    // CHART TEXT IS REPORTED, NOT ASSERTED, and the reason is a limit of the
    // method rather than a judgement about the charts.
    //
    // A chart label sits on marks the ancestor chain cannot see — an SVG shape
    // paints with `fill`, has no `background-color`, and is a SIBLING of the
    // label rather than a parent. Hit-testing the label's box was tried and is
    // worse, because the box overlaps marks that are beside the glyphs. Until
    // there is a method that can say what is behind a glyph, asserting here
    // would fail correct components, which is the one thing this check may not
    // do. The candidates are PRINTED so the tier is not silently uncovered.
    const isChart = (r) => CHART_KEYS.has(r.k);

    // THE CHARTS ARE REALLY IN THE PASS. Reporting-not-asserting a tier means
    // the tier stops being able to fail, so nothing else here would notice it
    // silently dropping out — and it HAD silently dropped out, which is the
    // whole reason for this round: `renderAll` defaults to the ui list, so a
    // first version checked 2,007 of the kit's 2,925 components and skipped
    // the tier with the worst colour history in this repo. A mutation deleting
    // the chart render survived every other assertion in this file.
    const chartsSeen = res.filter(isChart).length;
    if (chartsSeen >= chartEntries.length / 2) ok(`${mode}: the pass included ${chartsSeen} chart components`);
    else bad(`${mode}: only ${chartsSeen} of ${chartEntries.length} chart components reached the browser — the chart tier has dropped out of this check`);

    const suspect = res.filter(isChart).filter((r) => r.worst && r.worst.ratio < r.worst.need);
    if (suspect.length) {
      console.log(`  note ${mode}: ${suspect.length} chart components have text this method reads as unreadable — ` +
        `unverified, see the comment above (${[...new Set(suspect.map((r) => r.k.split(".")[0]))].slice(0, 8).join(", ")}…)`);
    }

    const failing = res.filter((r) => !isChart(r)).filter((r) => r.worst && r.worst.ratio < r.worst.need);
    if (failing.length === 0) { ok(`${mode}: every piece of text in the ui kit clears the contrast its size requires`); continue; }

    // GROUPED BY THE INK, because that is the shape the answer takes. A colour
    // token used as text by fifty components fails in fifty places for ONE
    // reason, and fifty lines of it buries the two that are genuinely their
    // own. The group names the token so the fix has an address.
    const byInk = new Map();
    for (const r of failing) {
      const g = byInk.get(r.worst.fg) || { fg: r.worst.fg, token: r.worst.token, rows: [] };
      g.rows.push(r);
      byInk.set(r.worst.fg, g);
    }
    const groups = [...byInk.values()].map((g) => {
      g.rows.sort((a, b) => a.worst.ratio - b.worst.ratio);
      return g;
    }).sort((a, b) => a.rows[0].worst.ratio - b.rows[0].worst.ratio);

    bad(`${mode}: ${failing.length} components have text that cannot be read`, groups.map((g) => {
      const w = g.rows[0].worst;
      const names = g.rows.map((r) => r.k.split(".")[0]);
      const shown = names.slice(0, 6).join(", ") + (names.length > 6 ? ` and ${names.length - 6} more` : "");
      return `    ${g.token ? g.token + " " : ""}${g.fg}  ${w.ratio.toFixed(2)}:1 (needs ${w.need}) on ${w.bg}\n` +
        `      ${g.rows.length} component${g.rows.length === 1 ? "" : "s"}: ${shown}`;
    }).join("\n"));
  }
} finally {
  if (browser) await browser.close();
  fs.rmSync(OUT, { recursive: true, force: true });
}

/**
 * Runs INSIDE the page. For each component: put its html in the host, walk every
 * element that has its own text, and compute the WCAG ratio of that text against
 * the background actually behind it.
 *
 * THE BACKGROUND HAS TO BE COMPOSITED, which is most of the work and the reason
 * a naive version of this is wrong. `bg-muted/40` is a translucent fill over
 * whatever is under it, and a huge part of this kit is translucent by design —
 * `openRootCss` re-emits `--background` at 35% alpha for a backdrop theme. So
 * the effective background is every ancestor's fill blended in order, not the
 * nearest one.
 */
function measure({ pairs, tokens }) {
  const host = document.getElementById("host");
  // THE BROWSER DOES THE CONVERSION, on a 1x1 canvas.
  //
  // Parsing the string by hand was the first attempt and measured NOTHING: this
  // template is Tailwind v4, whose palette is `oklch()`, and a computed style
  // serialises in the syntax it was written in — so an `/^rgba?\(/` reader
  // rejected every colour in the kit and the check reported a clean result over
  // an empty set. A canvas fill accepts any syntax the browser accepts,
  // including `color-mix()`, which this kit also uses.
  const cvs = document.createElement("canvas");
  cvs.width = cvs.height = 1;
  const ctx = cvs.getContext("2d", { willReadFrequently: true });
  const parse = (c) => {
    if (!c || c === "transparent" || c === "none") return { r: 0, g: 0, b: 0, a: 0 };
    ctx.fillStyle = "#000";
    ctx.fillStyle = c;
    // An unparseable value leaves fillStyle at the previous one, which is how a
    // colour the browser itself refused is told apart from black.
    if (ctx.fillStyle === "#000000" && !/^(#000|black|rgb\(0, ?0, ?0)/.test(c)) return null;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
  };
  const over = (top, bottom) => ({
    r: top.r * top.a + bottom.r * (1 - top.a),
    g: top.g * top.a + bottom.g * (1 - top.a),
    b: top.b * top.a + bottom.b * (1 - top.a),
    a: 1,
  });
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  // WHAT ACTUALLY PAINTS THIS TEXT. An HTML element's ink is `color`; an SVG
  // `<text>`'s is `fill`, and the two genuinely disagree in this kit — `lean`
  // has a dark `color` and a WHITE `fill`, so reading `color` there measured a
  // property nothing draws with.
  //
  // ONE LINE, because the two branches this started with were both measured to
  // be inert and removed rather than left as protection that reads local and
  // is not. A `currentColor` case: a COMPUTED `fill` is already resolved, so
  // `fill: currentColor` over `color: #eee` reads back as `rgb(238, 238, 238)`
  // and the keyword never arrives. A `none` case: `parse` already maps it to
  // zero alpha, which the caller skips. Each survived its own mutation by
  // changing nothing; the behaviour they described is still asserted by the
  // controls, which is where it belongs.
  const inkOf = (el, cs) => parse(el.closest("svg") ? cs.fill : cs.color);

  /**
   * Everything painted behind this element, blended bottom-up.
   *
   * THE ANCESTOR CHAIN, not a hit test, and that was measured rather than
   * assumed: `elementsFromPoint` at the text's bounding-box centre was tried
   * and made the chart results WORSE (24 flagged became 39), because a chart
   * label's box overlaps marks that are beside its glyphs rather than under
   * them. What is behind a glyph inside an SVG is decided by shape geometry,
   * and neither method answers it — which is why chart text is reported below
   * rather than asserted.
   */
  const behind = (el) => {
    const stack = [];
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0) stack.push(c);
    }
    let base = parse(getComputedStyle(document.body).backgroundColor);
    if (!base || base.a === 0) base = { r: 255, g: 255, b: 255, a: 1 };
    let acc = base.a < 1 ? over(base, { r: 255, g: 255, b: 255, a: 1 }) : base;
    for (let i = stack.length - 1; i >= 0; i--) acc = over(stack[i], acc);
    return acc;
  };

  // WCAG 1.4.3 EXEMPTS TWO THINGS BY NAME, and both are real in this kit.
  // "Text ... that is part of an inactive user interface component, or that is
  // pure decoration ... has no contrast requirement." Without them the check
  // reports a disabled letter and a watermark as unreadable text, which is a
  // false alarm on correct code — and this repo's own bar is that a rule which
  // cries wolf teaches people away from a component that is perfectly fine.
  //
  // Both are asked of the DOM as PROPERTIES rather than kept as a list of the
  // two components that trip them today, so a component that acquires one later
  // is exempt for the same stated reason instead of needing to be remembered.
  //
  // DECORATION NEEDS BOTH HALVES OF THE STANDARD'S OWN DEFINITION — "serving
  // only an aesthetic purpose, PROVIDING NO INFORMATION, and HAVING NO
  // FUNCTIONALITY". `aria-hidden` alone is not it, and taking it alone was
  // measured to go wrong immediately: `command-item` marks its keyboard
  // shortcut `aria-hidden`, and that hint is visible, meaningful, and really
  // was unreadable at 4.23:1 on the inverted selected row. Exempting on the one
  // attribute hid a true finding. Requiring `pointer-events: none` with it
  // separates the ghosted DRAFT overlay — hidden from assistive tech,
  // unclickable, unselectable — from an ordinary hint that merely happens to be
  // announced elsewhere.
  const exemptReason = (el) => {
    for (let n = el; n && n !== host; n = n.parentElement) {
      if (n.hasAttribute("disabled") || n.getAttribute("aria-disabled") === "true") return "inactive";
      if (n.getAttribute("aria-hidden") === "true" && getComputedStyle(n).pointerEvents === "none") return "decoration";
    }
    return null;
  };

  // WHICH TOKEN IS THIS INK. Resolved against the mode currently on <html>, so
  // the same colour reports as `--muted-foreground` in light and dark even
  // though the two are different values. Keyed on the composited rgb rather
  // than the string, because a computed `color` and a token's declared value
  // can be written differently and mean the same paint.
  const rootStyle = getComputedStyle(document.documentElement);
  const tokenOf = new Map();
  for (const name of tokens) {
    const c = parse(rootStyle.getPropertyValue(name).trim());
    if (!c || c.a === 0) continue;
    const key = `${c.r | 0},${c.g | 0},${c.b | 0}`;
    // First declaration wins: `--color-x` aliases of the same paint would
    // otherwise rename the token the kit is actually written against.
    if (!tokenOf.has(key)) tokenOf.set(key, name);
  }

  // THE KIT'S OWN PAIRINGS, asked of the palette rather than of a component.
  //
  // `bg-destructive text-destructive-foreground` is the shape every generated
  // page is told to write, and it is one fact about two tokens — so if it does
  // not contrast, EVERY component using it is unreadable and the finding turns
  // up wherever a synthesised prop happened to switch it on. Checking the pair
  // at the source says it once, with an address, instead of once per component
  // and never for the pairings nothing in the kit happened to render today.
  //
  // Derived from the stylesheet: every `--x` that has an `--x-foreground`.
  const pairRatios = [];
  for (const name of tokens) {
    if (!tokens.includes(name + "-foreground")) continue;
    const bg = parse(rootStyle.getPropertyValue(name).trim());
    const fg = parse(rootStyle.getPropertyValue(name + "-foreground").trim());
    if (!bg || !fg || !bg.a || !fg.a) continue;
    pairRatios.push({ name, ratio: ratio(fg, bg), bg: rootStyle.getPropertyValue(name).trim(), fg: rootStyle.getPropertyValue(name + "-foreground").trim() });
  }

  const out = [];
  for (const [k, html] of pairs) {
    host.innerHTML = html;
    let worst = null, checked = 0, exempt = 0;
    for (const el of host.querySelectorAll("*")) {
      // ITS OWN text, not a descendant's — otherwise every wrapper is judged on
      // text it does not paint, against a background it does not have.
      const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim();
      if (!text) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) continue;
      // `sr-only` is CLIPPED TO A PIXEL ON PURPOSE — it is for a screen reader
      // and its contrast is meaningless. Detected by the clip rather than the
      // class name, so a hand-rolled one counts too.
      const r = el.getBoundingClientRect();
      if (r.width <= 1 || r.height <= 1) continue;
      if (exemptReason(el)) { exempt++; continue; }
      const fg = inkOf(el, cs);
      if (!fg || fg.a === 0) continue;
      const bg = behind(el);
      const on = fg.a < 1 ? over(fg, bg) : fg;
      const px = parseFloat(cs.fontSize), bold = Number(cs.fontWeight) >= 700;
      // WCAG's own thresholds: large text is 18.66px bold or 24px, and it needs
      // 3:1 rather than 4.5:1.
      const need = px >= 24 || (bold && px >= 18.66) ? 3 : 4.5;
      const got = ratio(on, bg);
      checked++;
      if (!worst || got - need < worst.ratio - worst.need) {
        worst = {
          ratio: got, need, text: text.slice(0, 40), fg: cs.color,
          token: tokenOf.get(`${fg.r | 0},${fg.g | 0},${fg.b | 0}`) || null,
          bg: `rgb(${bg.r | 0}, ${bg.g | 0}, ${bg.b | 0})`,
        };
      }
    }
    out.push({ k, checked, exempt, worst });
  }
  host.innerHTML = "";
  return { components: out, pairs: pairRatios };
}

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
