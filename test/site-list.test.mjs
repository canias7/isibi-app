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
  // LANDMARK TO LANDMARK, not a byte window. This case sliced 2600 bytes and
  // the route has grown twice since; a window measured in bytes is outrun by
  // the next comment, which is this repository's most-repeated own goal.
  const end = w.indexOf("sites: backends.filter(", at);
  assert.ok(at > 0 && end > at, "the list route's own landmarks moved — re-derive this window");
  const body = w.slice(at, end);
  // The backends read is the one that can 503.
  assert.ok(/if \(!backends\) return Response\.json\(\{ ok: false, error: "read" \}, \{ status: 503 \}\)/.test(body),
    "an unreadable backends list is a 503, never `sites: []`");
  // AND THE OTHER TWO DEGRADE TO NOTHING. Re-anchored 2026-09-08: this counted
  // two `(await lrows(lX)) || []` spellings, and the build read is now taken in
  // two steps — `const buildRows = await lrows(ld)` and then `buildRows || []`
  // — because `offline` is decided by comparing the switch against the latest
  // build, and `|| []` throws away the one thing that answer needs: whether the
  // read answered at all. The PROPERTY is unchanged and is what is asserted
  // here: neither read can refuse the list, and neither is allowed to become a
  // `return`.
  assert.match(body, /\(await lrows\(la\)\) \|\| \[\]/, "the alias read no longer degrades to nothing");
  assert.match(body, /const buildRows = await lrows\(ld\);/, "the build read no longer keeps its own answer");
  assert.match(body, /for \(const b of buildRows \|\| \[\]\)/, "an unreadable build list is no longer read as no builds");
  for (const which of ["la", "ld"]) {
    assert.ok(!new RegExp("if \\(!(await )?lrows\\(" + which + "\\)").test(body),
      "the " + which + " read refuses the screen — only site_backends may do that");
  }
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
  // LANDMARK TO LANDMARK, NOT A BYTE COUNT. This was `at + 1800` and went red
  // the day the three action buttons landed between the card loop and the
  // delete: the window ended before the delete's own adopt, so the guard
  // reported a hop as missing that had not moved. The recorded byte-window
  // trap, in the guard whose comment below records fighting a different one.
  // Both ends are asserted, because `indexOf` answering -1 makes `slice` return
  // "" and every assertion inside a window pass on nothing.
  const to = c.indexOf("Delete this site for good?", at);
  assert.ok(to > at, "the delete's confirmation is gone — re-anchor this window");
  const body = c.slice(at, to);
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

// ── THE THREE ON EVERY CARD ─────────────────────────────────────────────────
//
// database · site · mobile app (owner, 2026-09-07). Two things are worth
// driving and one is worth reading:
//
//   1. the credential. The card needs to know WHETHER the site has a database,
//      and the column that answers it is the connection to that database. The
//      boolean goes out; the string must not, and a whole-payload search is the
//      only assertion that survives somebody spreading the row later.
//   2. the disabled states, off the REAL `cardActs` — a first build has no
//      database, so that is the ordinary card and not an edge.
//   3. that each button goes somewhere that exists. This repo already carries
//      an open finding about controls pointing at where they already are; three
//      of them on every card would be that finding fifty-one times over.

const DB_URL = "postgres://user:sup3rsecret@ep-x.neon.tech/neondb";

test("DRIVEN: the wire says WHETHER there is a database, never the connection", async () => {
  const r = await callList({
    backends: [
      { slug: "with-db", created_at: "2026-09-01T00:00:00Z", brief: "", neon_db: DB_URL },
      { slug: "no-db", created_at: "2026-09-01T00:00:00Z", brief: "", neon_db: null },
      { slug: "empty-db", created_at: "2026-09-01T00:00:00Z", brief: "", neon_db: "" },
    ],
  });
  assert.equal(r.status, 200);
  const by = Object.fromEntries(r.body.sites.map((s) => [s.slug, s]));
  assert.equal(by["with-db"].db, true);
  // A ROW THAT EXISTS WITH `neon_db` EMPTY IS A FRONTEND-ONLY SITE, which most
  // first builds are — the majority case, not an edge.
  assert.equal(by["no-db"].db, false, "no connection is no database");
  assert.equal(by["empty-db"].db, false, "an empty connection is no database");
  // THE WHOLE PAYLOAD, not the field: a future edit that spreads the row would
  // pass a field-level check and ship a credential to the browser.
  const wire = JSON.stringify(r.body);
  assert.ok(!wire.includes("sup3rsecret"), "the connection reached the browser");
  assert.ok(!wire.includes("neon_db"), "the column reached the browser under its own name");
});

test("DRIVEN: the column is asked for, or the answer would always be false", async () => {
  const r = await callList({ backends: [] });
  const backendsRead = r.asked.find((u) => u.includes("site_backends"));
  assert.ok(/select=[^&]*\bneon_db\b/.test(backendsRead),
    "PostgREST returns only the selected columns, so a `db` computed off an "
    + "unselected one is false for every site on the platform: " + backendsRead);
});

test("a row's `db` is read strictly — nothing but a real true is a yes", () => {
  assert.equal(SiteList.fromRow({ slug: "a", db: true }).backend, true);
  for (const bad of ["true", "yes", 1, [true], {}, "postgres://x"]) {
    assert.equal(SiteList.fromRow({ slug: "a", db: bad }).backend, false,
      "a `db` of " + JSON.stringify(bad) + " read as a database");
  }
  assert.equal(SiteList.fromRow({ slug: "a" }).backend, false, "absent is no");
});

test("either side saying there is a database is a yes", () => {
  const one = (srv, loc) => SiteList.merge(
    [{ id: "x", slug: "s", backend: loc, updatedAt: 1 }],
    [{ slug: "s", db: srv }], true)[0].backend;
  assert.equal(one(true, false), true, "the server knows");
  // A BUILD THAT JUST FINISHED sets this locally and the server list is a
  // minute stale; no path ever takes a database away, so a disagreement is the
  // local record being AHEAD, never the server correcting it.
  assert.equal(one(false, true), true, "the local record is ahead, not wrong");
  assert.equal(one(true, true), true);
  assert.equal(one(false, false), false, "and two noes stay a no — without this "
    + "the merge would say yes for every site and the control would never dim");
});

/** The real `cardActs`, evaluated out of chat.js — it cannot be imported. */
function loadCardActs() {
  const chat = read("../public/chat.js");
  const cut = (name) => {
    const at = chat.indexOf("function " + name + "(");
    assert.ok(at > 0, name + " is gone from chat.js");
    const end = chat.indexOf("\n}", at);
    assert.ok(end > at, name + " has no end");
    return chat.slice(at, end + 2);
  };
  const iAt = chat.indexOf("const ST_ICONS = {");
  assert.ok(iAt > 0, "the icon table is gone");
  const iEnd = chat.indexOf("\n};", iAt);
  assert.ok(iEnd > iAt, "the icon table has no end");
  return new Function(chat.slice(iAt, iEnd + 3) + "\n" + cut("esc") + "\n" + cut("ic")
    + "\n" + cut("cardActs") + "\nreturn cardActs;")();
}

/**
 * ONE BUTTON, CUT BY ITS OWN TAGS.
 *
 * Every case below used to window from one `data-act` to the NEXT one, which is
 * the recorded landmark trap in its nastiest form: when the mobile-app button
 * came off on 2026-09-09 one such window became `slice(n, -1)` and swallowed
 * the rest of the markup — and PASSED, while reading something else entirely.
 * The case directly under it had both ends asserted and went honestly red, and
 * the difference between the two is the whole argument. A button cut from its
 * own `<button` to its own `</button>` cannot be broken by a neighbour arriving
 * or leaving at all.
 */
function btn(html, act) {
  const at = html.indexOf('data-act="' + act + '"');
  assert.ok(at > 0, "there is no " + act + " button");
  const open = html.lastIndexOf("<button", at);
  const close = html.indexOf("</button>", at);
  assert.ok(open >= 0 && close > at, "the " + act + " button is not a whole element");
  return html.slice(open, close + "</button>".length);
}

test("DRIVEN: one button per thing, each named on the element", () => {
  const cardActs = loadCardActs();
  const html = cardActs({ id: "s1", react: true, backend: true, url: "https://x.gofarther.app/" });
  // TWO SINCE 2026-09-09 — the mobile-app icon came off when the phone moved
  // beside the card. Everything below is derived from this list, so a third act
  // is one edit here rather than several numbers that can disagree.
  const ACTS = ["data", "live"];
  for (const act of ACTS) {
    assert.equal((html.match(new RegExp('data-act="' + act + '"', "g")) || []).length, 1,
      "exactly one " + act + " button");
  }
  assert.equal((html.match(/<button/g) || []).length, ACTS.length, "and no others");
  // ONE SET, drawn through the app's own icon helper rather than pasted: a
  // hand-written <svg> here would drift from the 1.85 stroke every other glyph
  // in the chrome uses, and the pair would read as imported.
  assert.equal((html.match(/class="st-svg"/g) || []).length, ACTS.length);
  assert.equal((html.match(/stroke-width="1\.85"/g) || []).length, ACTS.length);
  // Both are live on a published site with a database — asserted here so the
  // disabled-state cases below have a demonstrably awake observer.
  for (const act of ACTS) assert.ok(!/ disabled/.test(btn(html, act)), "the " + act + " button is live");
});

test("DRIVEN: the mobile app moved off the card, and still says it does not exist", () => {
  // Owner, 2026-09-07: "LEAVE IT THERE BUT OFF SINCE WE HAVENT DONE THE MOBILE
  // APP THING YET" — and 2026-09-09: "one square with the site , and one wiht
  // the mobile app" → "the phone same height as the square".
  //
  // THIS CASE IS INVERTED RATHER THAN DELETED, and the property it guards has
  // not moved at all: the mobile app is on this screen and says it is not built
  // yet. What moved is WHERE it says it — a tile beside the card instead of a
  // greyed 15px glyph on it, because a tile and an icon carrying one sentence is
  // that sentence twice (three times, counting the icon's `aria-label`).
  const cardActs = loadCardActs();
  for (const site of [
    { id: "s1", react: true, backend: true, url: "https://x/" },   // everything a site can have
    { id: "s2", react: true, backend: false, url: "" },            // and nothing
  ]) {
    const html = cardActs(site);
    assert.ok(!/phone/.test(html), "the card draws a mobile-app control again");
    // THE OBSERVER IS AWAKE: this same read still finds the acts that stayed,
    // so the absence above is an absence rather than an empty string.
    assert.ok(/data-act="data"/.test(html) && /data-act="live"/.test(html),
      "the card draws no actions at all — re-anchor this");
  }
  // AND THE SENTENCE SURVIVED THE MOVE. Without this line the case passes on a
  // tree where the button came off and NOTHING replaced it, which is precisely
  // what the 2026-09-07 instruction was against. `test/site-card-phone.test.mjs`
  // drives the tile itself; this is the tripwire that the feature did not go.
  assert.match(read("../public/chat.js"), /not built yet/,
    "the mobile app stopped saying anything at all");
});

test("a disabled card action LOOKS disabled", () => {
  // A sweep took `opacity` off this rule and every assertion above stayed
  // green: the markup was right and three identical-looking icons would have
  // shipped, one of them doing nothing when clicked. Nothing else in this file
  // reads the stylesheet, so nothing else can see that.
  const css = read("../public/styles.css");
  const at = css.indexOf(".st-card-act:disabled");
  assert.ok(at > 0, "the disabled rule is gone");
  const rule = css.slice(at, css.indexOf("}", at));
  const op = /opacity:\s*([\d.]+)/.exec(rule);
  assert.ok(op, "a disabled action must be visibly dimmed, not merely inert");
  assert.ok(Number(op[1]) < 0.7, "dimmed enough to read as off: " + op[1]);
  // The observer is alive: the base rule these override is still here.
  assert.ok(/\.st-card-act\s*\{/.test(css), "the base rule is gone — re-anchor this");
});

test("DRIVEN: a site with no database keeps the button and says why", () => {
  const cardActs = loadCardActs();
  const html = cardActs({ id: "s1", react: true, backend: false, url: "https://x/" });
  const dataBtn = btn(html, "data");
  assert.ok(/ disabled/.test(dataBtn), "a site with no database must not offer a live data button");
  // HIDING IT IS HOW A CUSTOMER NEVER LEARNS THE FEATURE IS THERE TO ASK FOR.
  assert.match(dataBtn, /No database yet/, "the tooltip says what to do about it");
  // The live-site button beside it is unaffected — and this read USED to window
  // from `live` to `phone`, so when the phone came off it became `slice(n, -1)`,
  // still contained the right button, and passed for the wrong reason. It is cut
  // from its own tags now and cannot be fooled by a neighbour going.
  assert.ok(!/ disabled/.test(btn(html, "live")), "the live-site button beside it is unaffected");
});

test("DRIVEN: an unpublished site cannot be opened, and says so", () => {
  const cardActs = loadCardActs();
  const html = cardActs({ id: "s1", react: true, backend: true, url: "" });
  // THIS WINDOW IS THE ONE THAT WENT HONESTLY RED. It ran from `live` to
  // `phone` with BOTH ends asserted, so when the mobile-app button came off on
  // 2026-09-09 it failed and said so, where the case above it — which asserted
  // only its opening landmark — passed on a window running to `-1`. Both cut
  // from their own tags now, which removes the question.
  const live = btn(html, "live");
  assert.ok(/ disabled/.test(live), "there is no address to open");
  assert.match(live, /Not published yet/);
  // And the data button beside it is untouched — the observer is alive.
  assert.ok(!/ disabled/.test(btn(html, "data")));
});

test("DRIVEN: the id is escaped into the attribute, never concatenated raw", () => {
  const cardActs = loadCardActs();
  const html = cardActs({ id: 'x" onclick="steal()', react: true, backend: true, url: "https://x/" });
  assert.ok(!html.includes('onclick="steal()'), "a hostile id closed the attribute");
  assert.ok(html.includes("&quot;"), "it is escaped rather than dropped");
});

test("each button that ACTS goes somewhere that exists, and nothing else acts", () => {
  const c = blankComments(read("../public/chat.js"));
  const at = c.indexOf("view.querySelectorAll('.st-card-act')");
  assert.ok(at > 0, "the handlers are gone");
  const body = c.slice(at, c.indexOf("view.querySelectorAll('[data-del]')", at));
  assert.ok(body.length > 200 && body.length < 1400, "the handler block was not found whole");
  // ADOPTED FIRST, like the open and the delete: a card the server listed and
  // this browser has never seen has no local record to act on.
  assert.ok(/siteAdopt\(cardEntry\(b\.dataset\.sid\)\)/.test(body), "adopts");
  assert.ok(/window\.open\(rec\.url/.test(body), "the live site opens at its own address");
  assert.ok(/siteView = 'data'/.test(body), "the data button opens the Data view");
  // ONLY THE ACTS WE DRAW DO ANYTHING. The data branch was an `else` while the
  // phone button existed; leaving it one when that came off would have made any
  // unknown `data-act` open the Data view.
  assert.ok(/b\.dataset\.act !== 'data'/.test(body),
    "an act this card does not draw must fall out, not land on the last branch");
  assert.ok(!/\belse\b/.test(body), "no catch-all branch is left");
  // THE MOBILE-APP BUTTON HAS NO BRANCH AND MUST NOT BE GIVEN ONE: it is
  // permanently `disabled`, so it fires no click, and what it will DO is not
  // designed — a branch here would be a guess written down as code. Asserted
  // beside the two live ones above, so the absence has an awake observer.
  assert.ok(!/siteDevice/.test(body), "the disabled button has no behaviour to run");
  assert.ok(!/'phone'/.test(body), "and the handler names it nowhere");
  assert.ok(/e\.stopPropagation\(\)/.test(body), "a click on a button is not also a click on the card");
});

test("the card's click guard covers every button on it, not a list of them", () => {
  const c = blankComments(read("../public/chat.js"));
  const at = c.indexOf("card.onclick = (e) =>");
  assert.ok(at > 0);
  const line = c.slice(at, c.indexOf("\n", at));
  assert.ok(/closest\('button'\)/.test(line),
    "one rule for every control on the card — a named list drifts the next time "
    + "one is added, which is exactly how these three arrived");
  assert.ok(!/data-del/.test(line), "the old single-control spelling is gone");
});

test("the cylinder is in the icon table, and the set that was chosen is intact", () => {
  const c = read("../public/chat.js");
  const iAt = c.indexOf("const ST_ICONS = {");
  const table = c.slice(iAt, c.indexOf("\n};", iAt));
  // `phone` is here on purpose with its card button off: the workspace's own
  // device switch draws it, and it is what a restore of that button reaches for.
  // Deleting a glyph because one of its callers went quiet is how a feature
  // becomes expensive to put back.
  for (const name of ["database", "globe", "phone"]) {
    assert.ok(new RegExp("\\n\\s*" + name + ":").test(table), name + " is not in ST_ICONS");
  }
  assert.ok(/ic\('phone', 16\)/.test(c), "the workspace's device switch still draws it");
  // The chosen database mark is the three-band cylinder, and it is drawn on the
  // same 24×24 grid as every other glyph — a viewBox is not a thing `ic` sets
  // per icon, so a path outside 0..24 would render clipped and nothing would say so.
  const db = table.slice(table.indexOf("\n  database:"), table.indexOf("\n", table.indexOf("\n  database:") + 1));
  assert.equal((db.match(/<path/g) || []).length, 2, "the body and the middle band");
  assert.equal((db.match(/<ellipse/g) || []).length, 1, "the top disc");
  for (const n of db.match(/-?\d+(\.\d+)?/g) || []) {
    assert.ok(Math.abs(Number(n)) <= 24, "a coordinate outside the 24×24 grid: " + n);
  }
});

test("the card actually draws them — the one hop every other guard misses", () => {
  // A SWEEP FOUND THIS. Every assertion above drives `cardActs` directly, so
  // cutting its ONE call site out of the card markup left all of them green
  // and the three icons off every card: the wiring trap in its purest form —
  // the function perfect, the hop gone, nothing failing.
  const c = blankComments(read("../public/chat.js"));
  const at = c.indexOf("'<div class=\"st-card\" data-open=");
  assert.ok(at > 0, "the card markup is gone");
  const to = c.indexOf('class="sch-del st-card-del"', at);
  assert.ok(to > at, "the delete button is gone — re-anchor this window");
  const card = c.slice(at, to);
  assert.equal((card.match(/cardActs\(s\)/g) || []).length, 1,
    "the card must call cardActs exactly once");
  // And inside the meta row, where the name and the date are — not floating
  // over the thumbnail, which is where the delete lives.
  assert.ok(card.indexOf('st-card-meta') < card.indexOf("cardActs(s)"),
    "the actions belong to the meta row");
});

// ── THE TWO ICONS THAT CAME OFF THE WORKSPACE TOP BAR ───────────────────────
//
// Owner, 2026-09-07: "DELETE THIS 2 THINGS" — the Form submissions icon and
// the Site members icon. Both were SECOND doors to a Cloud card that already
// exists and describes itself, so what went is the duplicate, not the panel.
//
// AND ONE WAS ALREADY DEAD: `stMembers` was drawn with a title and an
// aria-label and looked up into a variable nothing used. It looked live to
// every customer and did nothing — this repo's open dead-control finding,
// found in its own chrome.

test("the top bar no longer draws the submissions or members icons", () => {
  const c = blankComments(read("../public/chat.js"));
  for (const id of ["stInbox", "stMembers"]) {
    assert.ok(!c.includes('id="' + id + '"'), id + " is back on the top bar");
    assert.ok(!c.includes("getElementById('" + id + "')"), id + " is looked up again");
  }
  // THE OBSERVER IS ALIVE. An absence proves nothing unless the same read can
  // see the bar it is reading: these three sit in that group and stay.
  for (const id of ["stReload", "stDl", "stShare"]) {
    assert.ok(c.includes('id="' + id + '"'), "the top bar itself is gone — re-anchor this");
  }
});

test("but both panels are still reachable, from the card that describes them", () => {
  const c = blankComments(read("../public/chat.js"));
  // The dispatch: the Members card names its own handler, and the fallback is
  // still the submissions modal. Removing a duplicate door must not remove the
  // feature — the panels are worth more than the icons were.
  assert.ok(/b\.dataset\.cloud === 'members'\) siteMembers\(site\)/.test(c), "the Members card");
  assert.ok(/else siteInbox\(site\)/.test(c), "the Submissions card falls here");
  assert.ok(/async function siteInbox\(/.test(c), "the submissions panel");
  assert.ok(/async function siteMembers\(/.test(c), "the members panel");
  // And both cards are still offered, so the dispatch above has something to
  // dispatch: a handler with no card is as dead as a card with no handler.
  //
  // MATCHED AT THE KEY'S OWN POSITION — the LAST element of the row, which is
  // what `data-cloud` is built from. A sweep renamed the Submissions key and
  // this passed, because `'inbox'` is also that card's ICON NAME at position 0
  // and a plain `includes` cannot tell the two apart. `'members'` happened to
  // be unambiguous (its icon is `users`), which is exactly the luck a guard
  // must not rest on.
  const cards = c.slice(c.indexOf("const cards = ["), c.indexOf("\n  ];", c.indexOf("const cards = [")));
  assert.ok(/,\s*'members'\],/.test(cards), "the Members card is gone from Cloud");
  assert.ok(/,\s*'inbox'\],/.test(cards), "the Submissions card is gone from Cloud");
});
