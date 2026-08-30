// How the landing page names the models the platform runs.
//
// Until 2026-08-29 it named them TWICE: a dropdown hanging off an "AI models"
// nav item, and the pipeline drawn down the left of the showcase. Both read the
// same records, so neither could go stale against the other — but they were two
// answers to one question, and the nav item was the one nobody needed once the
// pipeline listed every model on the page itself. The menu, its markup, its
// stylesheet block and the group headings it existed to print are gone.
//
// What is left is one renderer, and these are the properties that fail SILENTLY
// in it. The unit suite never loads chat.js, so nothing else here would notice.
//
// 1. NO MODEL ID MAY REACH THE DOM. The labels are already public — the in-app
//    picker shows "Veo 3.1" — but the ids behind them are `fal-ai/veo3.1` and
//    `bytedance/seedance-2.0/…`, and naming the provider is the one thing
//    worker.js's director prompt forbids outright. A marketing page that leaks
//    `fal-ai/` undoes that rule on the most public surface we have, and it would
//    look completely normal on screen.
//
// 2. THE LIST MUST NOT BE A SECOND COPY. Video/image/audio come from
//    MODEL_LISTS, the array the picker itself renders. Restated here, the two
//    drift the moment a model is added or dropped — Ray 3.2 and OmniHuman were
//    removed on 2026-07-17, and a hand-written marketing list would still be
//    advertising both.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const CHAT = fs.readFileSync(path.join(import.meta.dirname, "..", "public", "chat.js"), "utf8");
const HTML = fs.readFileSync(path.join(import.meta.dirname, "..", "public", "index.html"), "utf8");
const CSS = fs.readFileSync(path.join(import.meta.dirname, "..", "public", "styles.css"), "utf8");

// The renderer, isolated. Read as a slice rather than by importing, because
// chat.js is a browser script with no exports.
const renderer = (() => {
  const i = CHAT.indexOf("function initPipeModels");
  assert.ok(i > 0, "initPipeModels must exist — every check below is about it");
  const j = CHAT.indexOf("\nfunction initReel", i);
  assert.ok(j > i, "initPipeModels must be followed by initReel");
  return CHAT.slice(i, j);
})();

test("no model id reaches the DOM", () => {
  // An id IS read here — it is how the provider's logo is chosen — so the check
  // cannot be "the word id does not appear". What must hold is that every read
  // of one is consumed by providerOf and never carried any further: the row
  // objects the markup is built from have a fixed, id-free shape.
  const reads = renderer.match(/\bm\.id\b/g) || [];
  const consumed = renderer.match(/providerOf\(\s*m\.id\b/g) || [];
  assert.equal(reads.length, consumed.length,
    "every m.id must be an argument to providerOf; " + (reads.length - consumed.length) +
    " read go somewhere else");
  // And every field read off a row is one of the three that are safe to print.
  //
  // This was first written to scan for interpolations — a quote, a `+`, then an
  // identifier — and it had a hole exactly where it mattered: `r.label` is
  // preceded by `'')` rather than by a bare quote, so the scan saw only
  // `r.brand.logo` and `r.note` and would have passed a renderer that printed
  // an id in the name's place. It passed its own >0 vacuity floor while blind
  // to the one field the rule is about. Scan the row object's USES instead —
  // there is no punctuation to get wrong — and floor the check on seeing the
  // name, not on seeing anything at all.
  const fields = [...new Set([...renderer.matchAll(/\br\.([\w.$]+)/g)].map((m) => m[1]))];
  assert.ok(fields.includes("label"), "the renderer must read r.label, or this check is vacuous");
  for (const f of fields) {
    assert.match(f, /^(label|note|brand\.logo)$/,
      "the pipeline may read a label, a note and a logo path off a row — not r." + f);
  }
});

test("every model name links to its own page, addressed by LABEL", () => {
  // Each model gets a page at /models/<slug>. The slug is made from the label
  // and never from the id, which is the same rule that governs what the row
  // PRINTS — an id-derived address would put `fal-ai/` in the URL bar of a page
  // anyone can link to, which is the leak the print rule exists to prevent,
  // wearing a different hat.
  const src = /const modelSlug = ([\s\S]*?);\n/.exec(CHAT);
  assert.ok(src, "modelSlug must exist — the links are built with it");
  assert.match(renderer, /href="\/models\/' \+ modelSlug\(r\.label\)/,
    "the href must be /models/ + the slug of the LABEL");
  assert.equal(/modelSlug\(\s*(m|r)\.id\b/.test(CHAT), false, "a slug may never be made from an id");
});

test("no two models share a page, and none is addressed by nothing", () => {
  // Two labels that slug the same would silently point two rows at one page —
  // and it would look completely correct until somebody opened both. An empty
  // slug is the other half: a link to /models/ that leads nowhere.
  const src = /const modelSlug = ([\s\S]*?);\n/.exec(CHAT)[1];
  const slug = eval("(" + src + ")");                 // the real function, not a re-typed copy
  // Scanned over the LISTS THE PIPELINE RENDERS, not over all of chat.js.
  // Scanning the file pulls in GROUP_META, whose picker headings repeat labels
  // like 'Veo 3.1' legitimately — which forced a "same label is fine" excuse
  // into the check, and that excuse hid the second half of the bug: two ROWS
  // sharing one name is also two rows sharing one page. Window the right set
  // and uniqueness is plain, with nothing to excuse.
  const between = (open, close) => {
    const i = CHAT.indexOf(open);
    assert.ok(i > 0, "missing " + open);
    const j = CHAT.indexOf(close, i);
    assert.ok(j > i, open + " must be closed");
    return CHAT.slice(i, j);
  };
  const pool = between("const MODEL_LISTS = {", "\n};") + between("const LLM_MODELS = [", "\n];") +
    // the pipeline appends Grok itself; it gets a link like every other row
    between("if (key === 'llm') rows.push(", ");");
  const names = [...pool.matchAll(/\blabel: '([^']+)'/g)].map((m) => m[1]);
  assert.ok(names.length >= 19, "expected the platform's models, found " + names.length + " labels");
  const seen = new Map();
  for (const l of names) {
    const sl = slug(l);
    assert.ok(sl.length > 0, "'" + l + "' slugs to nothing — its link would go to /models/");
    assert.match(sl, /^[a-z0-9-]+$/,
      "'" + l + "' slugs to '" + sl + "'; a slug outside [a-z0-9-] can break out of the href");
    assert.equal(seen.has(sl), false,
      "'" + l + "' and '" + seen.get(sl) + "' both slug to '" + sl + "' — one page, two models");
    seen.set(sl, l);
  }
});

test("the models are listed in ONE place", () => {
  // The whole point of deleting the nav menu. Two renderers over one table is
  // this repo's most repeated failure shape: they do not disagree on day one,
  // they disagree on the day somebody edits one of them.
  const consumers = (CHAT.match(/\bMODELS_TAB\b/g) || []).length;
  assert.equal(consumers, 2,
    "MODELS_TAB should be its declaration and exactly one reader; found " + consumers + " mentions");
  assert.match(renderer, /MODELS_TAB\[key\]/, "the one reader is the pipeline");
});

test("video, image and audio come FROM MODEL_LISTS, not a second copy", () => {
  const i = CHAT.indexOf("const MODELS_TAB");
  const tabs = CHAT.slice(i, CHAT.indexOf("\n};", i));
  for (const kind of ["video", "image", "audio"]) {
    assert.match(tabs, new RegExp("MODEL_LISTS\\." + kind + "\\b"),
      kind + " must read MODEL_LISTS." + kind + " — a restated list drifts from the picker");
  }
});

test("every group the order names is a group the pipeline can render", () => {
  // Derived at both ends. MODELS_ORDER drives the render loop, so a key in it
  // with no MODELS_TAB entry is a group that silently never appears — and
  // silently-absent is exactly how a whole tier of this codebase has died
  // before. Checked the other way too: a defined group left out of the order is
  // written and unreachable.
  const i = CHAT.indexOf("const MODELS_ORDER");
  const order = [...CHAT.slice(i, CHAT.indexOf("\n", i)).matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
  assert.ok(order.length >= 4, "expected four groups in MODELS_ORDER, found " + order.length);
  const j = CHAT.indexOf("const MODELS_TAB");
  const tabs = CHAT.slice(j, CHAT.indexOf("\n};", j));
  const defined = [...tabs.matchAll(/^\s*([a-z]+):\s*\{/gm)].map((m) => m[1]);
  for (const k of order) {
    assert.ok(defined.includes(k), "MODELS_ORDER names '" + k + "' but MODELS_TAB has no such key");
  }
  for (const k of defined) {
    assert.ok(order.includes(k), "MODELS_TAB defines '" + k + "' but MODELS_ORDER never renders it");
  }
});

test("the deleted menu left nothing behind", () => {
  // Half a deletion is worse than none: markup with no renderer is an empty box
  // on hover, and a renderer with no markup is a boot-time no-op nobody sees
  // fail. Whichever half survives, it survives silently.
  for (const ghost of ["mkt-drop", "mdl-drop", "mdlList", "mdlSub", "modelsPanel",
                       "fillModelsMenu", "wireModelsMenu", "data-models"]) {
    for (const [name, src] of [["chat.js", CHAT], ["index.html", HTML], ["styles.css", CSS]]) {
      assert.equal(src.includes(ghost), false, name + " still mentions " + ghost);
    }
  }
});

test("the nav stacks above the landing headline", () => {
  // .crt-topbar and .crt-crest were BOTH z-index 3, and the crest comes later
  // in the DOM — so "Generate the impossible." painted straight through the nav
  // (and, while it existed, through the middle of the open model menu). Every
  // geometry and DOM check passed while it did.
  const zi = (sel) => {
    // Anchored at LINE START. Unanchored, `.crt-crest` first matched
    // `.mkt-crt .crt-crest{top:…}` — a compound selector carrying no z-index —
    // and the check failed on a rule it was never asking about.
    const m = CSS.match(new RegExp("^\\" + sel + "\\s*\\{([^}]*)\\}", "m"));
    assert.ok(m, sel + " must exist as a rule of its own");
    const z = m[1].match(/z-index\s*:\s*(\d+)/);
    assert.ok(z, sel + " must declare a z-index for this comparison to mean anything");
    return +z[1];
  };
  assert.ok(zi(".crt-topbar") > zi(".crt-crest"),
    "the nav must paint above the headline, or its buttons are unreachable");
});

test("the landing's CSS uses only tokens this theme actually defines", () => {
  // `--surface` was once written here and does not exist in this theme: the
  // rows fell back to transparent, the list's hairline colour showed through,
  // and twelve rows rendered as one grey block. It passed every check and was
  // found by looking — the same failure as the 70 charts that rendered grey.
  //
  // Anchored on the palette's own first token and running to the END of the
  // file, so everything appended after it is covered too.
  //
  // Two anchors have alreadyfailed here. `.mkt-drop{` was the menu's first
  // rule and this deletion removed it — a guard anchored on something deletable
  // stops guarding the moment it is deleted, and `slice(-1)` passes every
  // assertion inside it. `.mkt.mkt-crt{` looked safer and is worse: FOUR rules
  // carry that selector, indexOf found the earliest, and the window swallowed
  // 600 lines of the games UI, reporting its `--faint` as a landing bug. The
  // anchor has to be unique as well as durable, so it is the token that only
  // this block declares. Hence the vacuity floor below.
  const defined = new Set([...CSS.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map((m) => m[1]));
  const at = CSS.indexOf("--paper:");
  assert.ok(at > 0, "the landing's pencil palette must be findable by its own first token");
  assert.equal(CSS.indexOf("--paper:", at + 1), -1, "the anchor must be unique to be a window edge");
  const block = CSS.slice(at);
  const used = new Set([...block.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((m) => m[1]));
  const missing = [...used].filter((v) => !defined.has(v));
  assert.deepEqual(missing, [], "undefined CSS variables in the landing block: " + missing.join(", "));
  assert.ok(used.size > 8, "the block must actually use tokens, or this check is vacuous");
});

test("a long note cannot push the model name out of its row", () => {
  // The flex min-width trap, hit three times in this file already. The note
  // ("Anthropic · deep reasoning") sits under the name inside one flex child;
  // without min-width:0 a long one widens the child instead of wrapping, and
  // pushes the name out past the pipe it is labelling.
  const i = CSS.indexOf(".mkt-crt .gf-pipe-txt{");
  assert.ok(i > 0, ".gf-pipe-txt must exist — it is the row this is about");
  const row = CSS.slice(i, CSS.indexOf("}", i));
  assert.match(row, /min-width\s*:\s*0/, ".gf-pipe-txt needs min-width:0 or a long note overflows");
});
