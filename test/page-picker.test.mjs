// THE PAGE PICKER KNOWS WHICH PAGES A SITE HAS, ON ANY MACHINE (2026-09-13).
//
// Owner, looking at `lido-free-a` — a live three-page site, `/`, `/menu`,
// `/book` — with the workspace picker reading a dead "Homepage":
// *"OK THIS SITE SUPPOSLTY HAS COU7PLE PAGES , RIGHT ?"* → *"YES FIX THE PICKER"*.
//
// THE PAGE LIST ONLY EVER EXISTED IN THE BROWSER THAT BUILT THE SITE. `sitePages`
// reads `site.pages` out of localStorage, and its one recovery path for an older
// React site derives the list from the FILES on a build message in the chat
// thread. A site adopted off `/api/site/list` has neither — `fromRow` in
// `site-list.js` carries id, slug, name, url, brief, backend, chat, offline and
// createdAt, and no pages — so `sitePages()` answered `[]`, `siteActivePage()`
// answered `null`, and the picker rendered its `pages.length > 1` fallback,
// which is a label. Every page but the home page was unreachable in the preview
// on every machine except the one that typed the brief.
//
// Nothing failed and nothing logged: a label is a legitimate rendering of an
// empty list. What these guards hold:
//
//   • the route answers the site's own routes, owner-gated, with a stranger
//     getting the 404 a missing site gets and "nothing stored" never wearing it;
//   • it ships PATHS and never source — the whole reason it is its own route
//     rather than a second reader of `/api/site/source`;
//   • a part is never offered as a page, because that is a 404 in a customer's
//     own menu;
//   • one namer for a route whichever door told us it exists;
//   • the browser's fetch is latched, never overwrites a list this browser has,
//     and is silent on every failure.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
// THE REAL ROUTE READER the Worker uses, so "a part is not a page" and
// "`__root` is not a page" are the container's own rules rather than this
// file's opinion of them.
import { routeOf } from "../builder/site-addon.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.join(HERE, p), "utf8");
const CHAT = read("../public/chat.js");
const WORKER = read("../worker.js");

/**
 * Whole-line comments blanked, LENGTH PRESERVED so offsets still line up.
 *
 * This change's own comments name "Homepage", `fromRow`, `/api/site/source` and
 * `-parts` while explaining each — the recorded "prose contains the thing it
 * forbids", which without this would let the scans below match an explanation
 * instead of code.
 */
const bare = (s) => s.split("\n").map((l) => (/^\s*\/\//.test(l) ? " ".repeat(l.length) : l)).join("\n");
const BARE = bare(CHAT);
const BARE_WORKER = bare(WORKER);

// AND THE BLANKER'S OWN LANDMARKS ARE ASSERTED TO HAVE SURVIVED IT. A blanker
// that swallowed the file would make every scan below pass over nothing — the
// recorded trap, measured at 37.1% survival the last time it fired here.
assert.ok(BARE.includes("function pageFromPath("), "the blanker ate pageFromPath");
assert.ok(BARE.includes("function siteRoutesFetch("), "the blanker ate siteRoutesFetch");
assert.ok(BARE_WORKER.includes('"/api/site/routes"'), "the blanker ate the route matcher");

/** A named function's source, out of a file. */
function fn(head, src = BARE) {
  const at = src.indexOf(head);
  assert.ok(at > 0, head + " is gone");
  const end = src.indexOf("\n}", at);
  assert.ok(end > at, head + " has no end");
  return src.slice(at, end + 2);
}

/** A top-level one-line `const NAME = …;`, out of a file. */
function konst(name, src = BARE) {
  const m = src.match(new RegExp("^const " + name + " = .*;$", "m"));
  assert.ok(m, "const " + name + " is gone");
  return m[0];
}

// ── THE ROUTE ───────────────────────────────────────────────────────────────

const USER = { id: "u-owner" };

// EVERY CASE GETS ITS OWN SLUG, and that is not tidiness — it is the recorded
// trap from the neighbouring file. `siteOwnerBySlug` is memoized per slug for
// five minutes across the whole module, so a case that answers "somebody else
// owns this" decides every later case reusing the name.
let caseNo = 0;
async function callRoutes({ user = USER, slug = "gf-pick-" + (++caseNo), owner = "u-owner", pages, bucketFails = false } = {}) {
  const worker = await loadWorker();
  const reads = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const u = String((input && input.url) || input || "");
    const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
    if (u.includes("/auth/v1/user")) return user ? json(user) : new Response("no", { status: 401 });
    if (u.includes("/rest/v1/site_backends")) return json(owner ? [{ uid: owner }] : []);
    return new Response("unavailable", { status: 503 });
  };
  const SITES_BUCKET = {
    async get(key) {
      reads.push(key);
      if (bucketFails) throw new Error("r2 down");
      if (key.endsWith("/pages.json")) return pages === undefined ? null : { text: async () => JSON.stringify(pages) };
      return null;
    },
  };
  try {
    const req = new Request("https://gofarther.dev/api/site/routes?slug=" + encodeURIComponent(slug), {
      headers: user ? { Authorization: "Bearer t" } : {},
    });
    const res = await worker.fetch(req, { SUPABASE_SERVICE_KEY: "svc", SITES_BUCKET }, makeCtx());
    return { status: res.status, body: await res.json().catch(() => null), reads };
  } finally { globalThis.fetch = real; }
}

// THE FIXTURE IS THE STORE'S OWN SHAPE. `source/<slug>/pages.json` holds
// `{path, source}` with a BARE path — `cleanPath` in page-gen.mjs strips
// `src/routes/` on the way in and the container puts it back when it writes the
// files. A fixture carrying the prefix is the recorded "a fixture in a different
// shape from reality", and it is the exact shape that hid a dead `page` edit
// layer for a fortnight.
const LIDO = [
  { path: "index.tsx", source: "export const Route = createFileRoute('/')({})" },
  { path: "menu.tsx", source: "export const Route = createFileRoute('/menu')({})" },
  { path: "book.tsx", source: "export const Route = createFileRoute('/book')({})" },
];

test("DRIVEN: signed out is 401 and nothing of the site is read", async () => {
  const r = await callRoutes({ user: null });
  assert.equal(r.status, 401);
  assert.equal(r.reads.length, 0, "an unauthenticated caller reached the store");
});

test("DRIVEN: a site that is not yours is the 404 a missing site gets", async () => {
  // NOT A 403, the source route's rule verbatim: a distinct refusal tells
  // whoever asks that the slug exists and is taken, and a slug is claimable by
  // whoever builds it first.
  const r = await callRoutes({ owner: "someone-else", pages: LIDO });
  assert.equal(r.status, 404);
  assert.equal(r.body && r.body.error, "not found");
  assert.equal(r.reads.length, 0, "a stranger's request reached the store");
});

test("DRIVEN: the owner gets every route the site has, home first", async () => {
  const r = await callRoutes({ pages: LIDO });
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.deepEqual(r.body.routes, ["/", "/menu", "/book"], "the three real pages of lido-free-a did not come back");
});

test("DRIVEN: home is first even when the store has it last", async () => {
  // A FIXTURE THAT SEPARATES THE TWO READINGS. `LIDO` above is already stored
  // home-first, so the sort is a no-op against it and a mutant that drops the
  // sort entirely survives — the recorded "a fixture too shallow to separate the
  // two readings", found by the sweep on this file's first pass. `pages.json`
  // keeps the order the model wrote, which is not a promise about home.
  const r = await callRoutes({
    pages: [
      { path: "menu.tsx", source: "" },
      { path: "book.tsx", source: "" },
      { path: "index.tsx", source: "" },
    ],
  });
  assert.equal(r.body.routes[0], "/", "home is not first — the preview opens on it, so it is the one the picker shows selected");
  // AND THE REST KEEP THE ORDER THE MODEL WROTE, which matches a site's own nav
  // far more often than alphabetical would. Without this the sort is free to be
  // a full re-order.
  assert.deepEqual(r.body.routes, ["/", "/menu", "/book"], "the sort moved more than home");
});

test("DRIVEN: one page is offered once, however many files resolve to it", async () => {
  // TanStack reads BOTH `menu.tsx` and `menu/index.tsx` as `/menu`, so a store
  // holding both is a real shape rather than an invented one — and the picker
  // showing one page twice is a menu with a row that does nothing new. `LIDO`
  // carries no duplicate, so the de-dup was a no-op against every other case
  // here and its mutant survived the first sweep.
  const r = await callRoutes({
    pages: [
      { path: "index.tsx", source: "" },
      { path: "menu.tsx", source: "" },
      { path: "menu/index.tsx", source: "" },
    ],
  });
  assert.deepEqual(r.body.routes, ["/", "/menu"], "one page came back twice");
});

test("DRIVEN: the answer is PATHS, never source — the reason this route is its own", async () => {
  // `/api/site/source` hands back the whole project: the page source, the
  // parts, the kit closure, the assets and the 25 shared files (489,100 bytes of
  // bundle alone). This route exists so the picker costs a few dozen bytes
  // instead. A later edit that "helpfully" adds the source back would undo the
  // whole reason it is separate, silently and with every test green.
  const r = await callRoutes({ pages: LIDO });
  const wire = JSON.stringify(r.body);
  assert.ok(!wire.includes("createFileRoute"), "the page SOURCE is on the wire — this route is a second /api/site/source now");
  assert.ok(!/"(pages|parts|shared|kit|assets)"/.test(wire), "the route is answering the project, not the page list");
  assert.ok(wire.length < 400, "the answer grew past a page list: " + wire.length + " bytes");
});

test("DRIVEN: a part is never offered as a page, and neither is __root", async () => {
  // A PART IS A 404 IN THE CUSTOMER'S OWN MENU. `render-check.mjs` already
  // records `/-parts/...` as a finding; offering one here puts that finding in
  // the page picker instead of a report. The rule is the container's own —
  // `routeFileIgnorePrefix` is `-`, so a leading `-` on any segment is what
  // keeps a component from being published as a route.
  const r = await callRoutes({
    pages: [
      { path: "index.tsx", source: "" },
      { path: "-parts/tide-window-chart.tsx", source: "" },
      { path: "__root.tsx", source: "" },
      { path: "book-a-table.tsx", source: "" },
    ],
  });
  assert.deepEqual(r.body.routes, ["/", "/book-a-table"], "a part or the root leaked into the page list");
  // AND THE OBSERVER IS ALIVE: a hyphen INSIDE a segment is an ordinary page,
  // so the filter must not be "contains a hyphen". Without this case a rule
  // that dropped every hyphenated route would pass the assertion above.
  assert.ok(r.body.routes.includes("/book-a-table"), "an ordinary hyphenated route was dropped as if it were a part");
});

test("DRIVEN: a site that has never published says so, and never wears the 404", async () => {
  // The recorded "a failure that cannot name itself": answering 404 here says
  // "not your site" about a site they own.
  const r = await callRoutes({ pages: undefined });
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.deepEqual(r.body.routes, []);
  assert.match(String(r.body.why || ""), /has not published/, "a site with nothing stored got no sentence");
});

test("DRIVEN: a bucket that blew up is an empty list, not a 500", async () => {
  // `loadSiteSource` catches its own read failure and answers null, so the
  // picker stays exactly as it was. Cannot-tell reads as nothing-to-add here,
  // which is safe precisely because the browser only ever ADDS from this answer.
  const r = await callRoutes({ pages: LIDO, bucketFails: true });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.routes, []);
});

test("the route reads the store and never repairs it", () => {
  // `loadSiteSourceForEdit` takes a lease and can make a site busy; this route
  // only SHOWS what is stored. The source route beside it makes the same choice
  // and says so.
  const at = BARE_WORKER.indexOf('url.pathname === "/api/site/routes"');
  assert.ok(at > 0, "the routes matcher is gone");
  const end = BARE_WORKER.indexOf("\n    }", at);
  assert.ok(end > at, "the routes block has no end");
  const block = BARE_WORKER.slice(at, end);
  assert.ok(block.includes("loadSiteSource(env, rslug)"), "the route stopped reading the store");
  assert.ok(!block.includes("loadSiteSourceForEdit"), "the picker's read takes a lease — it can make a site busy now");
});

// ── ONE NAMER ───────────────────────────────────────────────────────────────

test("pageFromPath is the ONE namer, and reactRoutePages uses it", () => {
  const pageFromPath = new Function(fn("function pageFromPath(") + "\nreturn pageFromPath;")();
  assert.deepEqual(pageFromPath("/"), { path: "/", name: "Home", html: "" });
  assert.deepEqual(pageFromPath("/menu"), { path: "/menu", name: "Menu", html: "" });
  assert.deepEqual(pageFromPath("/book-a-table"), { path: "/book-a-table", name: "Book a table", html: "" });
  assert.deepEqual(pageFromPath("/shop/gear"), { path: "/shop/gear", name: "Gear", html: "" });
  // `html: ''` IS PART OF THE SHAPE, not an omission: `switchSitePage` branches
  // on `target.html` to choose the stored-draft loader over the live frame, so a
  // React page carrying `undefined` there would take the draft branch and the
  // frame would never move.
  assert.equal(pageFromPath("/menu").html, "", "a page with no stored HTML must carry the empty string");
  // AND AN EMPTY PATH IS HOME, never a page at "" — `sitePreviewSrc`'s own
  // default one file over, for the same reason: `String(null)` is "null".
  assert.equal(pageFromPath("").path, "/");
  assert.equal(pageFromPath(null).path, "/");

  // THE TWO PRODUCERS MUST AGREE, and the check is DERIVED rather than typed:
  // the build-message path and the server path are two doors to one picker, and
  // a label that changes with the door is the recorded "two lists of the same
  // thing" with a display name as its subject.
  const reactRoutePages = new Function(
    fn("function pageFromPath(") + "\n" + fn("function reactRoutePages(") + "\nreturn reactRoutePages;")();
  const fromFiles = reactRoutePages([{ path: "src/routes/index.tsx" }, { path: "src/routes/menu.tsx" }, { path: "src/routes/book.tsx" }]);
  assert.deepEqual(fromFiles, ["/", "/menu", "/book"].map(pageFromPath), "the two page-list producers name a route differently");
});

// ── THE BROWSER'S FETCH ─────────────────────────────────────────────────────

/**
 * The real `siteRoutesFetch`, in a scope whose every dependency is a fake.
 *
 * `siteRoutesAsked` is CARRIED rather than handed in, and re-evaluated per case,
 * so each case gets its own latch — a shared one would make the second case's
 * request vanish and read as the code refusing to fetch.
 */
function driveFetch({ answer, status = 200, throws = false, record } = {}) {
  const calls = [];
  const renders = [];
  const saved = [];
  const store = record !== undefined ? record : { id: "s1", slug: "lido-free-a", react: true, url: "https://x/", pages: [] };
  const apiFetch = async (u) => {
    calls.push(u);
    if (throws) throw new Error("offline");
    return { ok: status === 200, status, json: async () => answer };
  };
  const run = new Function("deps", [
    "const { apiFetch, siteById, sitesSave, renderSites } = deps;",
    "let siteOpenId = deps.siteOpenId;",
    konst("siteRoutesAsked"),
    // THE SHARED READ AND ITS APPLY, which the fetch now goes through (2026-09-24:
    // one read per slug in the air, shared with a message sent before the list
    // arrived). Carried, not faked, so every case below still drives the real
    // filter, the real apply-time check and the real latch.
    konst("SITE_ROUTES_WAIT_MS"),
    konst("siteRoutesPending"),
    fn("function siteRoutesRead("),
    fn("function siteRoutesApply("),
    fn("function pageFromPath("),
    fn("function siteRoutesFetch("),
    "return siteRoutesFetch;",
  ].join("\n"))({
    apiFetch,
    siteById: (id) => (store && store.id === id ? store : null),
    sitesSave: () => saved.push(JSON.parse(JSON.stringify(store.pages || []))),
    renderSites: () => renders.push(1),
    siteOpenId: "s1",
  });
  return { run, calls, renders, saved, store };
}

test("DRIVEN: the server's answer becomes the picker's pages, and the workspace re-renders", async () => {
  const d = driveFetch({ answer: { ok: true, slug: "lido-free-a", routes: ["/", "/menu", "/book"] } });
  d.run(d.store);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(d.calls.length, 1, "the route was not asked");
  assert.match(d.calls[0], /^\/api\/site\/routes\?slug=lido-free-a$/, "asked for the wrong thing: " + d.calls[0]);
  assert.deepEqual(d.store.pages.map((p) => p.path), ["/", "/menu", "/book"], "the pages did not land on the record");
  assert.deepEqual(d.store.pages.map((p) => p.name), ["Home", "Menu", "Book"], "the pages landed unnamed");
  assert.equal(d.saved.length, 1, "the record was not saved");
  assert.equal(d.renders.length, 1, "the workspace was not re-rendered, so the picker stays a label until something else redraws");
});

test("DRIVEN: it never overwrites a list this browser already has", async () => {
  // The check is at APPLY time rather than at fetch time: a build can land while
  // the request is in the air, and that list is the better one — it is what was
  // just written, where this answer is what was last published.
  const mine = [{ path: "/", name: "Home", html: "" }, { path: "/gear", name: "Gear", html: "" }];
  const d = driveFetch({
    answer: { ok: true, routes: ["/", "/menu", "/book"] },
    record: { id: "s1", slug: "lido-free-a", react: true, url: "https://x/", pages: mine },
  });
  d.run(d.store);
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(d.store.pages.map((p) => p.path), ["/", "/gear"], "the server's answer clobbered a list this browser built");
  assert.equal(d.saved.length, 0, "a no-op wrote to storage");
});

test("DRIVEN: once per slug, however many times the workspace renders", async () => {
  // `renderSiteWorkspace` runs on every render and every reply triggers one, so
  // without the latch this is a request per render.
  const d = driveFetch({ answer: { ok: true, routes: ["/"] } });
  d.run(d.store); d.run(d.store); d.run(d.store);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(d.calls.length, 1, "the picker asks the server on every render: " + d.calls.length + " requests");
  // AND AFTER IT ANSWERED. Renders arrive over time, not only in one burst: a
  // read still in the air is shared by construction (2026-09-24), so only a
  // render AFTER the answer shows whether the latch itself holds. This site
  // answered one page, which keeps the workspace's gate open.
  d.run(d.store); d.run(d.store);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(d.calls.length, 1, "the picker asks again once its answer has landed: " + d.calls.length + " requests");
});

test("DRIVEN: every failure is silent, and the picker stays as it was", async () => {
  for (const bad of [
    { label: "a throwing fetch", opts: { throws: true } },
    { label: "a 503", opts: { status: 503, answer: { ok: false } } },
    { label: "ok:false", opts: { answer: { ok: false, routes: ["/", "/menu"] } } },
    { label: "no routes field", opts: { answer: { ok: true } } },
    { label: "an empty list", opts: { answer: { ok: true, routes: [] } } },
    // `String(["/menu"])` is "/menu" — the recorded coercion, shipped here three
    // times. A shape we did not send is dropped, never made into a page.
    { label: "routes that are not strings", opts: { answer: { ok: true, routes: [["/menu"], 7, null, {}] } } },
    { label: "routes that are not paths", opts: { answer: { ok: true, routes: ["menu", "https://evil/x"] } } },
  ]) {
    const d = driveFetch(bad.opts);
    d.run(d.store);
    await new Promise((r) => setTimeout(r, 0));
    assert.deepEqual(d.store.pages, [], bad.label + " changed the picker's pages");
    assert.equal(d.saved.length, 0, bad.label + " wrote to storage");
    assert.equal(d.renders.length, 0, bad.label + " re-rendered the workspace for nothing");
  }
});

test("DRIVEN: a site with no slug, or one this browser has no record of, is never asked", async () => {
  for (const rec of [
    { id: "s1", slug: "", react: true, pages: [] },
    { id: "s1", slug: "x", react: false, pages: [] },
    { id: "", slug: "x", react: true, pages: [] },
  ]) {
    const d = driveFetch({ answer: { ok: true, routes: ["/"] }, record: rec });
    d.run(rec);
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(d.calls.length, 0, "asked the server about a site it cannot name: " + JSON.stringify(rec));
  }
});

// ── THE CALL SITE ───────────────────────────────────────────────────────────

test("the workspace asks, and only when the list it holds is short", () => {
  // A POSITION IS NOT A BEHAVIOUR — the recorded trap: `if (false) siteRoutesFetch(site)`
  // leaves the call exactly where a position check finds it. The call's OWN
  // condition is what is read.
  const block = fn("function renderSiteWorkspace(");
  const m = block.match(/if \(([^)]*)\) siteRoutesFetch\(site\);/);
  assert.ok(m, "renderSiteWorkspace does not call siteRoutesFetch under a condition of its own");
  assert.match(m[1], /pages\.length <= 1/, "the fetch is not gated on the list being short: " + m[1]);
  // AND IT IS ASKED AFTER THE LIST IS READ, or the gate reads an undefined
  // length and the branch is decided by a value that does not exist yet.
  assert.ok(block.indexOf("const pages = sitePages(site)") < block.indexOf("siteRoutesFetch(site)"),
    "the fetch is gated on a list that has not been read yet");
});
