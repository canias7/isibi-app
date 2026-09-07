// EVERY SITE THIS ACCOUNT OWNS, not just the ones one browser built.
//
// The start screen listed `localStorage` and `sitesSave` keeps twenty rows; the
// account this shipped for owns 51 sites in `site_backends`. So the screen
// could show a fraction of them, in one browser, and none on a phone.
//
// The decision that matters is not "merge two lists" — it is WHICH WAY THE
// MERGE FAILS. A server list that could not be read is not an empty one, and
// getting that backwards blanks a customer's whole screen during a blip. That
// is the case with the most drivers here.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.join(here, p), "utf8");

// The module runs in the browser and here, exactly as edit-poll.js does.
const SiteList = (await import("../public/site-list.js")).default
  || (await import("../public/site-list.js"));

/** Comments blanked, length preserved — prose names the paths it describes. */
function blankComments(src) {
  return src.split("\n").map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? " ".repeat(l.length) : l)).join("\n");
}

const row = (slug, over = {}) => ({ slug, name: slug, brief: "", createdAt: 1000, updatedAt: 2000, ...over });
const local = (id, over = {}) => ({ id, name: id, msgs: [{ r: "u", t: "hi" }], createdAt: 1, updatedAt: 1, ...over });

// ── THE FAILURE DIRECTION ───────────────────────────────────────────────────

test("a server list that could not be read leaves the local list untouched", () => {
  const mine = [local("a", { slug: "one" }), local("b", { slug: "two" })];
  const out = SiteList.merge(mine, null, false);
  assert.equal(out.length, 2, "a failed read must not drop a single card");
  assert.deepEqual(out.map((s) => s.slug), ["one", "two"]);
  // And it must not be the SAME array, or a caller mutating the screen list
  // would be mutating the store.
  assert.notEqual(out, mine);
});

test("an EMPTY server list is a real answer and is not the same as a failed one", () => {
  const mine = [local("a", { slug: "one" })];
  assert.equal(SiteList.merge(mine, [], true).length, 0, "this account owns nothing");
  assert.equal(SiteList.merge(mine, [], false).length, 1, "we could not ask");
});

// ── WHAT EACH SIDE IS RIGHT ABOUT ───────────────────────────────────────────

test("the server decides which sites exist; the local record keeps the thread", () => {
  const mine = [local("a", { slug: "one", msgs: [{ r: "u", t: "make it blue" }] })];
  const out = SiteList.merge(mine, [row("one"), row("two")], true);
  assert.equal(out.length, 2);
  const one = out.find((s) => s.slug === "one");
  assert.equal(one.msgs.length, 1, "the thread this browser holds survives the merge");
  assert.equal(one.msgs[0].t, "make it blue");
  assert.equal(one.id, "a", "and so does its local id, so an open workspace keeps working");
  const two = out.find((s) => s.slug === "two");
  assert.deepEqual(two.msgs, [], "a site this browser never saw starts with no thread");
});

test("a renamed site shows the address it answers at, not its storage slug", () => {
  const out = SiteList.merge([], [row("fretwork-1", { name: "crookes-guitar" })], true);
  assert.equal(out[0].slug, "fretwork-1", "the storage key is what the API is called with");
  assert.equal(out[0].name, "crookes-guitar");
  assert.equal(out[0].url, "https://crookes-guitar.gofarther.app/",
    "the thumbnail and the name cannot disagree: both come off the alias");
});

test("a local site with NO slug is a build in flight and is never dropped", () => {
  const mine = [local("fresh")]; // no slug yet — the design has not landed
  const out = SiteList.merge(mine, [row("one")], true);
  assert.equal(out.length, 2, "the card must not vanish while the customer watches it build");
  assert.ok(out.some((s) => s.id === "fresh"));
});

test("a local site the server did not list is not shown", () => {
  // Deleted elsewhere, or another account is signed in on this browser.
  const out = SiteList.merge([local("a", { slug: "gone" })], [row("one")], true);
  assert.deepEqual(out.map((s) => s.slug), ["one"]);
});

test("newest first, and a duplicate server row is taken once", () => {
  const out = SiteList.merge([], [row("old", { updatedAt: 10 }), row("new", { updatedAt: 99 }), row("old", { updatedAt: 10 })], true);
  assert.deepEqual(out.map((s) => s.slug), ["new", "old"]);
});

// ── COERCION, THE RECORDED TRAP ─────────────────────────────────────────────

test("a non-string slug is refused rather than coerced", () => {
  // `String(["a"])` is "a" — a one-element array must not become a slug.
  assert.equal(SiteList.fromRow({ slug: ["one"] }), null);
  assert.equal(SiteList.fromRow({ slug: 7 }), null);
  assert.equal(SiteList.fromRow(null), null);
  assert.equal(SiteList.cleanSlug(["a"]), "");
});

test("a hostile slug cannot escape its own host", () => {
  const made = SiteList.fromRow({ slug: "ok/../evil.com", name: "ok/../evil.com" });
  assert.ok(made, "it is cleaned, not refused, because the letters are still a slug");
  assert.equal(new URL(made.url).host, made.name + ".gofarther.app",
    "the address parses to the host we meant — never a different site");
});

// ── THE ROUTE ───────────────────────────────────────────────────────────────

// DRIVEN THROUGH THE REAL ROUTER, not read. A route asserted by reading is
// asserted at the layer below the break — this repo's own recorded trap, and
// the reason the rename's canonical hop shipped dead for a day.
const USER = { id: "11111111-1111-1111-1111-111111111111", email: "o@example.com" };
async function callList({ user = USER, backends, aliases = [], builds = [], fail = null } = {}) {
  const worker = await loadWorker();
  const asked = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const u = String((input && input.url) || input || "");
    const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
    if (u.includes("/auth/v1/user")) return user ? json(user) : new Response("no", { status: 401 });
    if (u.includes("/rest/v1/site_backends")) { asked.push(u); return fail === "backends" ? new Response("x", { status: 500 }) : json(backends); }
    if (u.includes("/rest/v1/site_aliases")) { asked.push(u); return fail === "aliases" ? new Response("x", { status: 500 }) : json(aliases); }
    if (u.includes("/rest/v1/site_builds")) { asked.push(u); return fail === "builds" ? new Response("x", { status: 500 }) : json(builds); }
    return new Response("unavailable", { status: 503 });
  };
  try {
    const req = new Request("https://gofarther.dev/api/site/list", {
      headers: user ? { Authorization: "Bearer some-token" } : {},
    });
    const res = await worker.fetch(req, { SUPABASE_SERVICE_KEY: "svc" }, makeCtx());
    return { status: res.status, body: await res.json().catch(() => null), asked };
  } finally { globalThis.fetch = real; }
}

test("DRIVEN: signed out is 401, and nothing is read", async () => {
  const r = await callList({ user: null, backends: [] });
  assert.equal(r.status, 401);
  assert.equal(r.asked.length, 0, "an unauthenticated caller never reaches the database");
});

test("DRIVEN: every read is filtered on the caller's OWN uid", async () => {
  const r = await callList({ backends: [{ slug: "one", created_at: "2026-09-01T00:00:00Z", brief: "b" }] });
  assert.equal(r.status, 200);
  assert.equal(r.asked.length, 3, "backends, aliases, builds");
  for (const u of r.asked) {
    assert.ok(u.includes("uid=eq." + USER.id),
      "a read that is not uid-scoped could return another account's sites: " + u);
  }
});

test("DRIVEN: the list carries the alias as the name and the latest build as the date", async () => {
  const r = await callList({
    backends: [{ slug: "fretwork-1", created_at: "2026-08-01T00:00:00Z", brief: "guitar lessons" }],
    aliases: [{ slug: "fretwork-1", alias: "crookes-guitar" }],
    builds: [{ slug: "fretwork-1", updated_at: "2026-09-07T04:40:00Z" }],
  });
  assert.equal(r.status, 200);
  const s = r.body.sites[0];
  assert.equal(s.slug, "fretwork-1");
  assert.equal(s.name, "crookes-guitar", "the address it answers at, not the storage key");
  assert.equal(s.brief, "guitar lessons");
  assert.ok(s.updatedAt > s.createdAt, "the build date wins over the created date");
});

test("DRIVEN: an unreadable backends list is a 503, never an empty list", async () => {
  const r = await callList({ fail: "backends", backends: [] });
  assert.equal(r.status, 503, "a 200 with `sites: []` here blanks the customer's screen");
  assert.equal(r.body.ok, false);
});

test("DRIVEN: a failed alias or build read leaves the list standing", async () => {
  for (const fail of ["aliases", "builds"]) {
    const r = await callList({
      fail,
      backends: [{ slug: "one", created_at: "2026-08-01T00:00:00Z", brief: "" }],
    });
    assert.equal(r.status, 200, `a failed ${fail} read must not refuse the whole screen`);
    assert.equal(r.body.sites.length, 1);
    assert.equal(r.body.sites[0].name, "one", "it falls back to the storage slug");
    assert.ok(r.body.sites[0].createdAt > 0, "and to the created date");
  }
});

test("DRIVEN: the newest build wins when a site has several", async () => {
  const r = await callList({
    backends: [{ slug: "one", created_at: "2026-08-01T00:00:00Z", brief: "" }],
    // Postgres is asked newest-first, so the FIRST row seen is the latest.
    builds: [
      { slug: "one", updated_at: "2026-09-07T00:00:00Z" },
      { slug: "one", updated_at: "2026-01-01T00:00:00Z" },
    ],
  });
  assert.equal(new Date(r.body.sites[0].updatedAt).getUTCMonth(), 8, "September, not January");
});

test("the route takes no slug, so it cannot be pointed at another account's site", () => {
  const w = blankComments(read("../worker.js"));
  const at = w.indexOf('url.pathname === "/api/site/list"');
  assert.ok(at > 0, "the route exists");
  const body = w.slice(at, at + 2600);
  assert.ok(!/searchParams\.get\("slug"\)/.test(body));
});

test("only site_backends is load-bearing; a failed enrichment does not refuse the list", () => {
  const w = blankComments(read("../worker.js"));
  const at = w.indexOf('url.pathname === "/api/site/list"');
  const body = w.slice(at, at + 2600);
  // The backends read is the one that can 503.
  assert.ok(/if \(!backends\) return Response\.json\(\{ ok: false, error: "read" \}, \{ status: 503 \}\)/.test(body),
    "an unreadable backends list is a 503, never `sites: []`");
  // The other two are read through `|| []`, so null (could not ask) is empty
  // enrichment rather than a refusal.
  assert.equal((body.match(/\(await lrows\(l[ad]\)\) \|\| \[\]/g) || []).length, 2,
    "the alias and build reads degrade to nothing rather than failing the screen");
});

test("the cap is one number and headroom over the biggest real account", () => {
  const w = read("../worker.js");
  const m = w.match(/const MAX_SITE_LIST = (\d+);/);
  assert.ok(m, "the cap is declared once");
  assert.ok(Number(m[1]) >= 51, "the largest account measured holds 51 sites");
  const body = blankComments(w);
  assert.ok(/limit=\$\{MAX_SITE_LIST\}/.test(body), "the query uses the constant, not a second copy");
});

// ── THE BROWSER'S HOPS ──────────────────────────────────────────────────────

test("the start screen merges instead of reading localStorage alone", () => {
  const c = blankComments(read("../public/chat.js"));
  assert.ok(/SiteList\.merge\(sitesLoad\(\), sitesRemote, sitesRemote !== null\)/.test(c),
    "the grid is the merged list, and `null` is what marks a list never answered");
  assert.ok(/sitesFetchRemote\(\);/.test(c), "and the fetch is started from the render");
});

test("a failed fetch leaves the remote list as it was", () => {
  const c = blankComments(read("../public/chat.js"));
  const at = c.indexOf("async function sitesFetchRemote");
  const body = c.slice(at, c.indexOf("function siteAdopt"));
  assert.ok(at > 0 && body.length > 100);
  // The ONLY assignment of `sitesRemote` inside the fetch is under the ok test.
  const assigns = body.match(/sitesRemote = /g) || [];
  assert.equal(assigns.length, 1, "one assignment, and it sits inside the success branch");
  assert.ok(/if \(r\.ok && d && d\.ok && Array\.isArray\(d\.sites\)\)/.test(body));
});

test("every card hop resolves through the merged list, never localStorage alone", () => {
  const c = blankComments(read("../public/chat.js"));
  const at = c.indexOf("const cardEntry = (id) =>");
  assert.ok(at > 0, "the resolver exists");
  const body = c.slice(at, at + 1800);
  // The thumbnail, the click and the delete — the three that would each have
  // silently done nothing for a site this browser has no record of.
  assert.ok(/const s = cardEntry\(card\.dataset\.open\)/.test(body), "thumbnail");
  // COUNTED, not merely present. A sweep reverted the CLICK handler alone and
  // this passed, because `cardOpen` still appeared on the keydown line one row
  // below — the recorded "a guard proves the branch it drives" shape. Both
  // handlers must route through the adopting opener, and the old spelling must
  // be gone from the block entirely.
  assert.equal((body.match(/cardOpen\(card\.dataset\.open\)/g) || []).length, 2,
    "the click AND the Enter key both go through the adopting opener");
  assert.ok(!/siteOpenId = card\.dataset\.open/.test(body),
    "neither handler opens by the card's own id: for a site this browser has no "
    + "record of that id is `srv_<slug>`, which `siteById` can never find");
  assert.ok(/const s = siteAdopt\(cardEntry\(id\)\)/.test(body), "delete");
  assert.ok(!/const s = siteById\(id\);/.test(body),
    "the delete no longer looks the site up in localStorage alone");
});

test("adopting is idempotent and writes what a finished build writes", () => {
  const c = blankComments(read("../public/chat.js"));
  const at = c.indexOf("function siteAdopt");
  const body = c.slice(at, c.indexOf("function siteCreate"));
  assert.ok(/all\.find\(\(s\) => s\.slug === entry\.slug\)/.test(body), "a slug already held is returned as it stands");
  for (const f of ["slug:", "url:", "react: true", "msgs: []"]) {
    assert.ok(body.includes(f), `an adopted record carries ${f}`);
  }
  assert.ok(/sitesSave\(\)/.test(body));
});

test("the module is loaded before chat.js, which calls into it", () => {
  const h = read("../public/index.html");
  const a = h.indexOf('src="/site-list.js"');
  const b = h.indexOf('src="/chat.js"');
  assert.ok(a > 0, "the page loads it");
  assert.ok(a < b, "before chat.js");
});
