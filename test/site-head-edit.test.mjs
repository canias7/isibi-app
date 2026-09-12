// SEO & SOCIAL — the tab that answered three questions wrongly about somebody
// else's business (2026-09-12, owner, shown it: "WHAT IS THIS").
//
// It was eleven lines of hardcoded markup: a title drawn as `<name> — built
// with Go Farther`, a suffix NO SITE HAS EVER SERVED; a sentence of grey prose
// where a real description was already stored; and "Generate · soon" for a
// 1200×630 card the container has composed on every build for weeks. Measured
// on `hebden-bike-repair` the same day: `<title>Hebden Bike Repair</title>`, a
// real description, an `og:image` at a card that really is 1200×630.
//
// That is a step past this repo's own dead-control finding. A dead control does
// nothing; this one ANSWERED — and the obvious next thought on reading it is
// "how do I get your branding off my title", about a thing that was never
// there.
//
// NOT `test/site-seo.test.mjs`, WHICH IS A DIFFERENT SUBJECT and was very
// nearly clobbered by this file. `site-seo.mjs` is the PUBLISHED SITE's
// crawling surface — sitemap, robots, the route manifest, the honest 404 — and
// this is the OWNER's head-editing panel. Two neighbours of one word, and the
// pair is named here so the next session does not fold them together.
//
// WHAT IS DRIVEN AND WHAT IS READ, said once. `site-head-edit.mjs` is driven
// whole. The browser's twin of it is CARRIED OUT OF chat.js and driven against
// the module, because chat.js cannot be imported and a second copy of a number
// is this repo's recorded "two lists of the same thing". The ROUTE is driven
// through `worker.fetch` against a fake bucket and a stubbed wire — reading it
// would certify the layer below the break, which is the trap that has cost
// twelve features here. Only the panel's own hops are read, and each of those
// reads a CALL rather than a position.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { siteMetaKey } from "../site-meta.mjs";
import { uploadIsImage } from "../site-uploads.mjs";
import {
  MAX_HEAD_DESCRIPTION, GOOD_DESCRIPTION,
  cleanHeadDescription, describeLength, pickableImages, headAnswer,
} from "../site-head-edit.mjs";

const CHAT = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
const CSS = fs.readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
const WORKER = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");

// The comments around all three spell out the very things asserted below (the
// recorded "prose contains the thing it forbids", ten-plus instances), so every
// scan that FORBIDS a spelling runs over a length-preserving blank. Line
// comments first: `chat.js` carries `// Every /api/* call …`, whose `/*` opened
// a false block that swallowed 71,729 characters on 2026-09-12.
const blank = (src) => src
  .replace(/^([^\n]*?)\/\/[^\n]*$/gm, (m, head) => head + " ".repeat(m.length - head.length))
  .replace(/^\s*\/\*[\s\S]*?\*\//gm, (m) => m.replace(/[^\n]/g, " "));

// AND THE STYLESHEET NEEDS ITS OWN, which the first run of this file proved:
// the comment introducing the SEO block NAMES the five dead classes it is
// explaining the removal of, so an absence check over raw CSS reported them as
// still present. CSS has one comment form, so this is the whole of it.
const blankCss = (src) => src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
const SHEET = blankCss(CSS);

/* ── the module ──────────────────────────────────────────────────────────── */

test("cleanHeadDescription refuses a non-string rather than coercing it", () => {
  // `String(["hello"])` is `"hello"` and this codebase has shipped that
  // coercion as a real bug three times — a one-element array passing as a role,
  // an access level, a language. A panel posts JSON, which is exactly where an
  // array arrives looking like a string.
  for (const bad of [["hello"], 12, null, undefined, { toString: () => "hi" }, true]) {
    const r = cleanHeadDescription(bad);
    assert.equal(r.ok, false, JSON.stringify(bad) + " was accepted as a description");
    assert.ok(r.error, "a refusal with no sentence");
  }
});

test("cleanHeadDescription collapses the shape of a textarea and caps at the store's own bound", () => {
  assert.deepEqual(cleanHeadDescription("  two   lines\nhere  "), { ok: true, value: "two lines here" });
  // AN EMPTY STRING IS A REAL ANSWER: it means "take the description off", and
  // `__root.tsx` emits no tag for a falsy one, so clearing has to reach the same
  // state as never having had one.
  assert.deepEqual(cleanHeadDescription(""), { ok: true, value: "" });
  assert.deepEqual(cleanHeadDescription("   \n  "), { ok: true, value: "" });
  // Exactly at the cap passes; one over is named with both numbers, so the
  // owner is not left guessing by how much.
  const at = "x".repeat(MAX_HEAD_DESCRIPTION);
  assert.deepEqual(cleanHeadDescription(at), { ok: true, value: at });
  const over = cleanHeadDescription("x".repeat(MAX_HEAD_DESCRIPTION + 1));
  assert.equal(over.ok, false);
  assert.match(over.error, new RegExp(String(MAX_HEAD_DESCRIPTION)));
  assert.match(over.error, new RegExp(String(MAX_HEAD_DESCRIPTION + 1)));
});

test("the cap IS the build path's own slice, not a second opinion about it", () => {
  // worker.js slices `look.description` when it composes a publish. A panel
  // that accepted more would store what the next publish silently truncates —
  // the owner's words changing on their own, which is this repo's "a failure
  // that cannot name itself".
  const slices = [...blank(WORKER).matchAll(/description[^\n]*?\.slice\(0,\s*(\d+)\)/g)].map((m) => Number(m[1]));
  assert.ok(slices.length, "no description slice found in worker.js — rescope this guard");
  for (const n of slices) {
    assert.ok(n >= MAX_HEAD_DESCRIPTION,
      "the publish path truncates a description at " + n + " but the panel stores up to " + MAX_HEAD_DESCRIPTION);
  }
});

test("describeLength: empty is its own state, and the band's edges are the band's", () => {
  // `''` must never read as `short`: a site with no description and a site with
  // a six-word one need different sentences, because one is missing a thing and
  // the other has a weak version of it.
  assert.deepEqual(describeLength(""), { state: "empty", chars: 0 });
  assert.deepEqual(describeLength(null), { state: "empty", chars: 0 });
  assert.equal(describeLength("x".repeat(GOOD_DESCRIPTION.min - 1)).state, "short");
  assert.equal(describeLength("x".repeat(GOOD_DESCRIPTION.min)).state, "good");
  assert.equal(describeLength("x".repeat(GOOD_DESCRIPTION.max)).state, "good");
  assert.equal(describeLength("x".repeat(GOOD_DESCRIPTION.max + 1)).state, "long");
  assert.equal(describeLength("x".repeat(GOOD_DESCRIPTION.max + 1)).chars, GOOD_DESCRIPTION.max + 1);
});

test("pickableImages drops a visitor's file and a document, and `isImage` is really asked", () => {
  // Both filters are load-bearing and for different reasons. A stranger's form
  // upload must never become the business's link preview (the 2026-08-13 audit
  // finding); and an og:image pointing at a PDF renders NOTHING in a chat app,
  // silently, so offering one here is inviting the share route's refusal.
  const objs = [
    { key: "uploads/s/zebra.jpg", size: 10 },
    { key: "uploads/s/alpha.png", size: 20 },
    { key: "uploads/s/menu.pdf", size: 30 },
    { key: "uploads/s/stranger.jpg", size: 40, visitor: true },
    null,
    { key: "", size: 1 },
  ];
  const out = pickableImages(objs, uploadIsImage);
  assert.deepEqual(out.map((o) => o.name), ["alpha.png", "zebra.jpg"],
    "a visitor's file, a document or a nameless object reached the picker, or the order is not stable");
  assert.equal(out[0].size, 20);
  // INJECTED, NOT IMPORTED — one home for "what counts as a picture", shared
  // with the share route's own validation. A reader that ignored the argument
  // would pass every case above off `uploadIsImage`'s real answers.
  const asked = [];
  pickableImages([{ key: "uploads/s/a.jpg" }], (n) => { asked.push(n); return false; });
  assert.deepEqual(asked, ["a.jpg"], "the injected reader was never asked, or was asked the whole key");
  assert.deepEqual(pickableImages([{ key: "uploads/s/a.jpg" }], (n) => false), [],
    "the injected reader's refusal was ignored");
  // A listing that could not be read is no pictures, never a throw: the tab
  // must still draw its two fields.
  assert.deepEqual(pickableImages(null, uploadIsImage), []);
});

test("headAnswer gives every field a value, and keeps `share` apart from `image`", () => {
  // An absent input answers `""`/`[]` and never `undefined`, which JSON drops:
  // a key that vanishes reads at the panel exactly like a key it forgot to send.
  const bare = headAnswer({});
  assert.deepEqual(bare, { ok: true, title: "", description: "", image: "", share: "", uploads: [] });
  for (const k of Object.keys(bare)) assert.notEqual(bare[k], undefined);
  // `share` empty WITH `image` set is the ordinary state — nobody has chosen
  // and the platform's composed card is what a chat app unfurls. Collapsing the
  // two is how the old mockup drew "no image" over a site that had one.
  const a = headAnswer({ title: "T", description: "D", image: "https://x/card.png", share: "", uploads: [{ name: "a.jpg" }] });
  assert.equal(a.share, "");
  assert.equal(a.image, "https://x/card.png");
  assert.deepEqual(a.uploads, [{ name: "a.jpg" }]);
  assert.deepEqual(headAnswer({ uploads: "nope" }).uploads, []);
});

/* ── the browser's twin ──────────────────────────────────────────────────── */

/** One top-level `const NAME = …` line, carried out of chat.js. */
function konst(name) {
  const m = new RegExp("^const " + name + " = [^\\n]*$", "m").exec(CHAT);
  assert.ok(m, "chat.js no longer declares " + name + " at top level");
  return m[0];
}
/** One top-level function, carried out of chat.js by brace depth. */
function fnOf(head) {
  const at = CHAT.indexOf(head);
  assert.ok(at >= 0, "chat.js no longer declares " + head);
  let d = 0, i = CHAT.indexOf("{", at);
  for (; i < CHAT.length; i++) {
    if (CHAT[i] === "{") d++;
    else if (CHAT[i] === "}") { d--; if (!d) break; }
  }
  return CHAT.slice(at, i + 1);
}

const BROWSER = new Function([
  konst("ST_SEO_MAX"), konst("ST_SEO_GOOD"), fnOf("function stSeoLength("),
  "return { ST_SEO_MAX, ST_SEO_GOOD, stSeoLength };",
].join("\n"))();

test("the browser's two numbers ARE the module's, so the textarea cannot outrun the store", () => {
  // chat.js is a classic script and cannot import, so these are a second copy
  // by construction. Held equal here rather than by habit — the habit is what
  // "two lists of the same thing" describes, and the two drift silently: a
  // maxlength above the cap turns every long paste into a server refusal, one
  // below it silently shortens what an owner is allowed to write.
  assert.equal(BROWSER.ST_SEO_MAX, MAX_HEAD_DESCRIPTION);
  assert.deepEqual(BROWSER.ST_SEO_GOOD, GOOD_DESCRIPTION);
});

test("stSeoLength agrees with describeLength on every state, at the edges", () => {
  // Derived from the module's own band rather than typed, so moving the band
  // moves both sides of this comparison and the case cannot go quiet.
  const lens = [0, 1, GOOD_DESCRIPTION.min - 1, GOOD_DESCRIPTION.min, GOOD_DESCRIPTION.min + 1,
    GOOD_DESCRIPTION.max - 1, GOOD_DESCRIPTION.max, GOOD_DESCRIPTION.max + 1, MAX_HEAD_DESCRIPTION];
  const seen = new Set();
  for (const n of lens) {
    const v = "x".repeat(n);
    const mine = BROWSER.stSeoLength(v);
    assert.equal(mine.state, describeLength(v).state, "the two length readers disagree at " + n + " characters");
    assert.ok(mine.label, "the counter has no words to show at " + n);
    seen.add(mine.state);
  }
  // The observer is alive: all four states were really reached, so a reader
  // that answered one state for everything cannot pass the comparison above.
  assert.deepEqual([...seen].sort(), ["empty", "good", "long", "short"]);
  // And the counter's words separate the two quiet states, because they share
  // the muted colour: the words are what carries the difference.
  assert.notEqual(BROWSER.stSeoLength("").label, BROWSER.stSeoLength("x".repeat(10)).label);
});

/* ── the route, driven ───────────────────────────────────────────────────── */

const SLUG = "seo-driven";
const OWNER = { id: "u-seo-owner", email: "owner@example.com" };
const LOOK = { brand: "Hebden Bike Repair", theme: "broadsheet", description: "An old sentence.", langs: ["en", "cy"], wordmark: { form: "text" } };
const CARD = "uploads-card";

function bucket({ look = LOOK, share = "", uploads = [], card = true } = {}) {
  const store = new Map([
    [CONFIG_KEY(SLUG), JSON.stringify({ look: { ...look }, css: "a{}", share })],
    [siteMetaKey(SLUG), JSON.stringify({ description: look.description || "", image: "", origin: "https://" + SLUG + ".gofarther.app/", routesCsv: "/", redirectsCsv: "", verify: [] })],
  ]);
  const writes = [];
  return {
    store, writes,
    async get(k) { const v = store.get(k); return v === undefined ? null : { text: async () => v, arrayBuffer: async () => new TextEncoder().encode(v).buffer }; },
    async head(k) { return card && /card\.png$/.test(k) ? { key: k } : null; },
    async put(k, v) { writes.push([k, String(v)]); store.set(k, String(v)); },
    async delete(k) { store.delete(k); },
    async list({ prefix } = {}) {
      if (!String(prefix || "").startsWith("uploads/")) return { objects: [], truncated: false };
      return { objects: uploads.map((u) => ({ key: "uploads/" + SLUG + "/" + u.name, size: u.size || 1, customMetadata: u.visitor ? { visitor: "1" } : {} })), truncated: false };
    },
  };
}

/** Every wire the route reaches, answered in shape. `uid` is who owns the row. */
function withWire({ uid = OWNER.id, rows = null } = {}, run) {
  const real = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String((input && input.url) || input || "");
    const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
    if (url.includes("/auth/v1/user")) return json(OWNER);
    if (url.includes("/rest/v1/site_backends")) return json(rows === null ? [{ uid, neon_db: null, brief: "" }] : rows);
    if (url.includes("/rest/v1/site_project")) return json([]);
    return new Response("unavailable", { status: 503 });
  };
  return (async () => { try { return await run(); } finally { globalThis.fetch = real; } })();
}

async function seo(store, { method = "GET", body } = {}) {
  const worker = await loadWorker();
  const req = new Request("https://gofarther.dev/api/site/" + SLUG + "/seo", {
    method,
    headers: { "content-type": "application/json", Authorization: "Bearer some-token" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const res = await worker.fetch(req, { SITES_BUCKET: store, SUPABASE_SERVICE_KEY: "test-service-key" }, makeCtx());
  return { status: res.status, body: await res.json().catch(() => null) };
}

const configOf = (store) => JSON.parse(store.store.get(CONFIG_KEY(SLUG)));
const sidecarOf = (store) => JSON.parse(store.store.get(siteMetaKey(SLUG)));

test("GET answers the three real values and the owner's own pictures", async () => {
  const store = bucket({ uploads: [{ name: "shopfront.jpg" }, { name: "menu.pdf" }, { name: "stranger.jpg", visitor: true }] });
  const got = await withWire({}, () => seo(store));
  assert.equal(got.status, 200);
  assert.equal(got.body.ok, true);
  // The BUSINESS'S name, which is what the `<title>` says — not a suffixed
  // invention. The mockup's own three false facts, each asserted against.
  assert.equal(got.body.title, LOOK.brand);
  assert.equal(got.body.description, LOOK.description);
  assert.equal(got.body.share, "");
  // RESOLVED through `siteOgImage`, the one reader of the precedence, so the
  // panel draws exactly what a chat app will unfurl rather than a second
  // opinion about it. With an upload present that is what the precedence picks.
  assert.match(got.body.image, /shopfront\.jpg$/);
  assert.deepEqual(got.body.uploads.map((u) => u.name), ["shopfront.jpg"],
    "the picker was offered a document or a stranger's file");
  // A READ, so nothing was written.
  assert.deepEqual(store.writes, []);
});

test("a stranger's site is a 404, the same answer a missing one gets", async () => {
  const store = bucket();
  const got = await withWire({ uid: "someone-else" }, () => seo(store));
  assert.equal(got.status, 404);
  assert.deepEqual(store.writes, []);
});

test("a POST stores the description by READING AND MERGING the look, never replacing it", async () => {
  // `withConfig` replaces a named field WHOLE, so a bare `{ look: { description } }`
  // takes the theme, the brand, the mark and every language off the site — the
  // exact defect the logo rung shipped, recorded in its own comment.
  const store = bucket();
  const got = await withWire({}, () => seo(store, { method: "POST", body: { description: "  A new   sentence.\n" } }));
  assert.equal(got.status, 200);
  assert.equal(got.body.description, "A new sentence.", "the textarea's shape was stored");
  const look = configOf(store).look;
  assert.equal(look.description, "A new sentence.");
  for (const k of ["brand", "theme", "langs", "wordmark"]) {
    assert.deepEqual(look[k], LOOK[k], "the look's `" + k + "` was destroyed by a description edit");
  }
  assert.equal(configOf(store).css, "a{}", "the stylesheet went with it");
});

test("the POST patches the sidecar, which IS the deployment, and says which happened", async () => {
  // The published site's own script reads its head out of this key on every
  // request — the rename lane's pattern and the share picker's. No container,
  // no compile, no credits.
  const store = bucket();
  const got = await withWire({}, () => seo(store, { method: "POST", body: { description: "Live at once." } }));
  assert.equal(got.body.live, true);
  assert.equal(sidecarOf(store).description, "Live at once.");
  // AND THE REST OF THE HEAD SURVIVES: the sidecar is read, one key changed,
  // written back — not composed afresh from what this route happens to know.
  assert.equal(sidecarOf(store).origin, "https://" + SLUG + ".gofarther.app/");
  assert.equal(sidecarOf(store).routesCsv, "/");
});

test("clearing is a real answer, and reaches the sidecar as an empty string", async () => {
  const store = bucket();
  const got = await withWire({}, () => seo(store, { method: "POST", body: { description: "   " } }));
  assert.equal(got.status, 200);
  assert.equal(got.body.description, "");
  assert.equal(configOf(store).look.description, "");
  assert.equal(sidecarOf(store).description, "", "the key was omitted rather than emptied, so the old sentence stands");
});

test("a POST that names nothing this route owns is refused, not answered ok", async () => {
  // A caller that posted a title thinks it changed something. Answering `ok` to
  // it is a silent drop, and the title arrives here the day somebody wires the
  // follow-up.
  const store = bucket();
  const got = await withWire({}, () => seo(store, { method: "POST", body: { title: "Something else" } }));
  assert.equal(got.status, 400);
  assert.deepEqual(store.writes, []);
});

test("a non-string description is refused by the route, not coerced on its way in", async () => {
  const store = bucket();
  const got = await withWire({}, () => seo(store, { method: "POST", body: { description: ["sneaky"] } }));
  assert.equal(got.status, 400);
  assert.ok(got.body.error);
  assert.deepEqual(store.writes, [], "an array was stored as a description");
  const over = await withWire({}, () => seo(store, { method: "POST", body: { description: "x".repeat(MAX_HEAD_DESCRIPTION + 5) } }));
  assert.equal(over.status, 400);
  assert.deepEqual(store.writes, []);
});

test("a bucket blip costs the picture and the picker, never the two fields beside them", async () => {
  // A tab that refuses whole because a LISTING failed is a tab that stops an
  // owner fixing their description — and the description is the thing this tab
  // is for. Both R2 reads are best-effort on purpose.
  const store = bucket();
  store.list = async () => { throw new Error("r2 down"); };
  store.head = async () => { throw new Error("r2 down"); };
  const got = await withWire({}, () => seo(store));
  assert.equal(got.status, 200);
  assert.equal(got.body.title, LOOK.brand);
  assert.equal(got.body.description, LOOK.description);
  assert.deepEqual(got.body.uploads, []);
});

test("a site whose settings cannot be resolved is a 503, never a fresh config written over them", async () => {
  // The share route's own reasoning: a null from the backend read cannot tell
  // "no database" from "could not resolve one", and on the WRITE that
  // difference is a new R2 config written over a pre-migration site's `_meta`
  // look. `siteBackendRowFresh` THROWS rather than answering null, and the
  // route must say so rather than carry on.
  const store = bucket();
  const got = await withWire({ rows: null }, async () => {
    const real = globalThis.fetch;
    const wrapped = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const url = String((input && input.url) || input || "");
      if (url.includes("/rest/v1/site_backends")) return new Response("boom", { status: 500 });
      return wrapped(input, init);
    };
    try { return await seo(store, { method: "POST", body: { description: "nope" } }); }
    finally { globalThis.fetch = real; }
  });
  assert.equal(got.status, 503);
  assert.deepEqual(store.writes, []);
});

/* ── the panel ───────────────────────────────────────────────────────────── */

const PANEL = fnOf("async function loadSiteSeo(");
const SHELL = fnOf("function moreSeo(");

test("the shell draws a frame and no fields, and the mockup's three claims are gone", () => {
  // The shell is composed while `renderSites` is still building markup, so it
  // cannot hold a real value yet. It holds NO field rather than a disabled one
  // carrying a guess — a box with a plausible wrong value in it is what this
  // tab is being rebuilt for.
  for (const id of ["stSeoPanel", "stSeoLoad", "stSeoBody"]) {
    assert.ok(SHELL.includes('id="' + id + '"'), "the shell no longer carries #" + id);
  }
  assert.ok(!/<textarea|<input/.test(SHELL), "the shell drew an editable field before the answer arrived");
  // Each of the three false facts, by the spelling it shipped under. Over the
  // WHOLE file, because a mockup moved one function over is a mockup still.
  const c = blank(CHAT);
  assert.ok(!c.includes("built with Go Farther"), "the invented title suffix is back");
  assert.ok(!c.includes("Generate · soon"), "the dead generate button is back");
  assert.ok(!/A short, on-brand description of your site/.test(c), "the grey placeholder prose is back");
});

test("the tab asks the server once, and the render hook is the thing that asks", () => {
  // A hop that exists in the file and never runs is this repo's own recorded
  // bug, so the hook is read as a CALL with its own condition — `if (false)`
  // leaves a call exactly where a position check looks for it.
  const c = blank(CHAT);
  assert.match(c, /if \(siteView === 'more' && siteMoreTab === 'seo' && site\.slug\) loadSiteSeo\(site\);/,
    "nothing calls loadSiteSeo, so the tab draws its frame and stops");
  // ONE FETCH for the whole tab: four facts live in three stores and four round
  // trips from the browser would each have their own half-drawn panel.
  const gets = [...PANEL.matchAll(/apiFetch\('\/api\/site\/' \+ encodeURIComponent\(slug\) \+ '\/seo'\)/g)];
  assert.equal(gets.length, 2, "the /seo read is no longer exactly the first draw plus the re-read after a share change");
});

test("the description save posts to /seo and the picture posts to /share — never a second copy of either", () => {
  // The share route validates the name against this site's own LIVE uploads,
  // refuses a stranger's file and a document, and recomputes the sidecar
  // through the one reader of the precedence. Re-implementing any of that in
  // the browser is how the two drift.
  assert.match(PANEL, /apiFetch\('\/api\/site\/' \+ encodeURIComponent\(slug\) \+ '\/seo', \{\s*method: 'POST'/,
    "the Save button no longer posts the description");
  assert.match(PANEL, /apiFetch\('\/api\/site\/' \+ encodeURIComponent\(slug\) \+ '\/share', \{\s*method: 'POST'/,
    "the picker no longer goes through the share route");
  assert.ok(!/uploadIsImage|\.pdf|visitor/.test(blank(PANEL)),
    "the panel started deciding for itself what may be a preview picture");
});

test("a share change RE-READS, because the picture that serves is the precedence's answer", () => {
  // Clearing the choice falls back to the built card, and only the server knows
  // whether one exists. Guessing here is how a panel shows a picture the unfurl
  // has not got.
  const pick = PANEL.slice(PANEL.indexOf("querySelectorAll('[data-share]')"));
  assert.ok(pick.length > 200, "the picker's handler moved — rescope this guard");
  assert.match(pick, /'\/seo'\)/, "the picker stopped re-reading after it changed the choice");
  assert.match(pick, /d = dd/, "the re-read's answer is thrown away");
});

test("Save is dead until something changed, and the comparison is against the STORED value", () => {
  // A button that is always live invites a write that stores what is already
  // stored — a publish-shaped no-op the owner then has to wonder about.
  assert.match(PANEL, /id="stSeoSave"[^>]*disabled/, "Save is drawn live before anything has been typed");
  assert.match(PANEL, /saveEl\.disabled = v\.replace\([^)]*\)\.trim\(\) === String\(d\.description \|\| ''\)/,
    "Save's enabled state stopped comparing against what is stored");
});

test("the picture hint has three cases, because there are three", () => {
  // Chosen; nothing chosen and the platform's card serving; and nothing chosen
  // and NOTHING serving — a site published before the card existed, or one
  // whose card write failed. Saying "using the card made for you" over that
  // third state is the mockup's own mistake in a new place.
  const hint = PANEL.slice(PANEL.indexOf("<label>Social image</label>"), PANEL.indexOf('id="stSeoPick"'));
  assert.ok(hint.length > 200, "the Social image field moved — rescope this guard");
  assert.match(hint, /d\.share\s*\n?\s*\?/, "the chosen case is gone");
  assert.match(hint, /:\s*d\.image/, "the panel stopped asking whether anything is actually serving");
  assert.match(hint, /No picture yet/, "a site with no picture at all is told it has a card");
});

/* ── the sheet ───────────────────────────────────────────────────────────── */

test("every class the panel writes is painted, and the mockup's own rules went with it", () => {
  // A CSS rule can be correct and still lose, and a class can be written and
  // painted by nothing at all — neither is visible to any assertion about the
  // markup. Derived from what the panel really writes rather than a list typed
  // beside it.
  // THE BLANKING IS PROVED ALIVE FIRST. A blanker that swallowed the block
  // would make every absence below pass and every presence below fail, and only
  // one of those two is loud.
  assert.ok(SHEET.includes(".st-seo-load "), "the CSS blanker ate the SEO block — every check here is now meaningless");
  const written = new Set([...PANEL.matchAll(/class="(st-seo-[a-z-]+)/g)].map((m) => m[1]));
  for (const m of SHELL.matchAll(/class="(st-seo-[a-z-]+)/g)) written.add(m[1]);
  assert.ok(written.size >= 10, "the class scan found only " + written.size + " — it has stopped reading the panel");
  for (const cls of written) {
    assert.ok(SHEET.includes("." + cls + " ") || SHEET.includes("." + cls + ","),
      "." + cls + " is written by the panel and painted by nothing");
  }
  // The four states the counter can be in are written by name from the length
  // reader, so they are derived rather than found in the markup above.
  assert.ok(SHEET.includes(".st-seo-good "), ".st-seo-good is written by the counter and painted by nothing");
  assert.ok(SHEET.includes(".st-seo-long "), ".st-seo-long is written by the counter and painted by nothing");
  // AND THE MOCKUP'S OWN RULES WENT WITH IT. Each was the deleted markup's own
  // class, counted at zero readers across everything the app serves — not a
  // scan over the stylesheet, which this repo has measured as not yet good
  // enough to cut by.
  for (const dead of ["st-inp-area", "st-social", "st-social-ph", "st-social-btns", "st-gen2"]) {
    assert.ok(!SHEET.includes("." + dead), "." + dead + " outlived the mockup that was its only reader");
    assert.ok(!blank(CHAT).includes(dead), dead + " is still written somewhere in the app");
  }
  // `.st-inp` SURVIVES, and its one reader is the read-only title box: the look
  // this rule was written for. An absence check with no live observer passes on
  // an empty file.
  assert.ok(SHEET.includes(".st-inp "), ".st-inp went with the mockup, taking the read-only title box's look");
  assert.match(PANEL, /class="st-inp st-seo-ro"/, "the title box stopped using the field look");
});
