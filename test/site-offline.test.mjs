// IS THIS SITE OFF THE WEB — the server's answer, so every browser agrees
// (2026-09-08, owner: "fix the offline flag on the server too").
//
// "Take it offline" / "Put it back online" worked on the server, and the ONLY
// record of which state a site was in lived in `localStorage`, written by
// `siteSetLive` in the browser that pressed the button. So a site taken off the
// web on a laptop read as live on a phone, and `sitePublishPanel` showed the
// wrong one of its two faces there — offering to take down a site that was
// already down. Giving that panel a Cloud card an hour earlier made the gap
// reachable rather than theoretical.
//
// The three things these guards are for, in order of what each costs:
//
//   • THE RULE. `offline_at` is a TIMESTAMP and a site is off the web only while
//     nothing has been published since — because nothing clears the stamp when a
//     site comes back up some other way, and the paths that republish mostly run
//     inside the site's container, where the job gateway admits no PATCH at all.
//     So the comparison IS the feature, and `null` for "could not tell" is not a
//     rounding error: reading it as "live" tells somebody their site is up while
//     it is down, on the one field whose whole job is to say which.
//
//   • THE HOPS. Four of them — the write, the select, the emit, the read — and
//     this repository has shipped thirteen features with one hop cut. The panel
//     one is the shape that nearly shipped here: `siteById` searches localStorage
//     and nothing else, so a server answer that reached the grid and was preferred
//     there would still never have reached the screen that draws the two faces.
//
//   • THE CREDENTIAL-SHAPED HALF. The wire carries a BOOLEAN. A raw timestamp or
//     the column's own name on the payload is a fact about our schema handed to a
//     browser for no reason, and the `neon_db` guard beside it is the precedent —
//     searched over the WHOLE payload, because a field-level check passes the day
//     somebody spreads the row.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { OFFLINE_COLUMN, offlineStamp, siteOffline } from "../builder/site-offline.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.join(here, p), "utf8");
const WORKER = read("../worker.js");
const CHAT = read("../public/chat.js");
const LIST_JS = read("../public/site-list.js");

const SiteList = (await import("../public/site-list.js")).default
  || (await import("../public/site-list.js"));

/** Comments blanked, LENGTH PRESERVED — this change's prose names every path. */
function blank(src) {
  return src.split("\n").map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? " ".repeat(l.length) : l)).join("\n");
}
const BARE = blank(WORKER);
const BARE_CHAT = blank(CHAT);

const T = (s) => Date.parse(s);

// ── THE RULE ────────────────────────────────────────────────────────────────

test("a timestamp is read strictly, and never coerced", () => {
  assert.equal(offlineStamp("2026-09-08T04:00:00Z"), T("2026-09-08T04:00:00Z"));
  // `String(["a"])` is `"a"` — the recorded coercion trap, and Date.parse of a
  // one-element array of a date string really does parse. Refused as a shape.
  assert.equal(offlineStamp(["2026-09-08T04:00:00Z"]), 0);
  assert.equal(offlineStamp(1757304000000), 0, "a number is not what Postgres sends");
  assert.equal(offlineStamp(null), 0);
  assert.equal(offlineStamp(undefined), 0);
  assert.equal(offlineStamp(""), 0);
  assert.equal(offlineStamp("not a date"), 0, "an unparseable string is 'never switched', not NaN");
  assert.equal(offlineStamp({}), 0);
});

test("no stamp is ONLINE, and it needs no second fact to say so", () => {
  // Every site on the platform today, which is why the unknown answer below is
  // rare by construction rather than by luck.
  assert.equal(siteOffline(null, undefined), false, "an unbuilt read cannot make an unswitched site unknown");
  assert.equal(siteOffline(null, 0), false);
  assert.equal(siteOffline(undefined, undefined), false);
  assert.equal(siteOffline("", 12345), false);
  assert.equal(siteOffline("junk", undefined), false);
});

test("a publish AFTER the switch put the site back up", () => {
  const off = "2026-09-08T04:00:00Z";
  assert.equal(siteOffline(off, T("2026-09-08T05:00:00Z")), false, "built an hour after it went down");
  assert.equal(siteOffline(off, T("2026-09-08T03:00:00Z")), true, "the last build predates the switch");
  assert.equal(siteOffline(off, 0), true, "no build at all, and a stamped switch");
  // STRICTLY AFTER. A build stamped in the same millisecond as the switch is the
  // publish the switch replaced; reading that as "back online" would answer live
  // for a site that had just been taken down.
  assert.equal(siteOffline(off, T(off)), true, "same instant is not 'after'");
  assert.equal(siteOffline(off, T(off) + 1), false, "one millisecond after is after");
});

test("a build read that failed is `null`, and never folded into either answer", () => {
  const off = "2026-09-08T04:00:00Z";
  assert.equal(siteOffline(off, undefined), null, "we cannot tell whether a later publish put it back");
  assert.equal(siteOffline(off, null), null);
  assert.equal(siteOffline(off, NaN), true, "a number that is not one reads as no build, not as unknown");
  // AND THE BUILD TIME IS READ AS STRICTLY AS the stamp beside it. `Number(["…"])`
  // is a number — the recorded coercion trap on the other argument — so a shape
  // we did not send could otherwise answer "a publish happened after the switch"
  // and put a site that is down back on the screen as live. Nothing produces
  // this shape today; the wall is here so nothing has to keep not producing it.
  assert.equal(siteOffline(off, [String(T(off) + 1000)]), true,
    "an array that looks like a later build time was believed as one");
  assert.equal(siteOffline(off, String(T(off) + 1000)), true, "and so was a string");
  // The control: with the stamp absent the same unreadable build answers false,
  // so `null` is really about the comparison and not about the argument's shape.
  assert.equal(siteOffline(null, undefined), false);
});

// ── THE COLUMN, SPELLED ONCE ────────────────────────────────────────────────

test("the column is spelled once, and the migration is the same word", () => {
  assert.equal(OFFLINE_COLUMN, "offline_at");
  const applied = fs.readdirSync(path.join(here, "../supabase/applied"))
    .filter((f) => f.includes("offline"));
  assert.equal(applied.length, 1, "one migration for this column: " + applied.join(", "));
  const sql = read("../supabase/applied/" + applied[0]);
  assert.match(sql, new RegExp("add column if not exists " + OFFLINE_COLUMN + "\\s+timestamptz", "i"),
    "the migration adds a different column, or a different type, from what the code reads");
  assert.ok(!/not null/i.test(sql),
    "the column is NOT NULL — every site that existed before 2026-09-08 has no stamp and must not need one");
  assert.ok(!/default/i.test(sql),
    "a default would stamp every existing site as switched");

  // AND THE WORKER READS THE CONSTANT, never a second copy of the word. A
  // literal here is the recorded "two lists of the same thing", where the drift
  // is silent: the select would come back without the column and every site
  // would quietly read as online.
  const literals = [...BARE.matchAll(/["'`]offline_at["'`]/g)];
  assert.equal(literals.length, 0,
    "worker.js spells the column itself somewhere — import OFFLINE_COLUMN instead");
});

// ── THE WRITE ───────────────────────────────────────────────────────────────

test("there is exactly ONE writer, and it is scoped to the owner as well as the slug", () => {
  const at = BARE.indexOf("async function markSiteOffline(");
  assert.ok(at > 0, "the writer is gone");
  const fn = BARE.slice(at, BARE.indexOf("\n}\n", at));

  assert.match(fn, /method:\s*"PATCH"/, "it no longer writes");
  assert.match(fn, /slug=eq\.\$\{encodeURIComponent\(s\)\}&uid=eq\.\$\{encodeURIComponent\(u\)\}/,
    "the write is not scoped by BOTH the slug and the owner");
  assert.match(fn, /if \(!s \|\| !u\) return false/, "a write with no owner is not refused");
  assert.match(fn, new RegExp("\\[OFFLINE_COLUMN\\]: off \\? new Date\\(\\)\\.toISOString\\(\\) : null"),
    "the write no longer stamps on the way down and clears on the way up");

  // IT ANSWERS, IT NEVER THROWS — the site has really changed state by the time
  // this runs, so a Supabase blip must not turn a completed switch into an error
  // the owner would retry.
  assert.match(fn, /catch \(e\)/, "a failed write escapes and fails a switch that already happened");

  // ONE writer. A second PATCH of this column anywhere is a second place the
  // record can be wrong, and this one is the only one under the ownership check.
  const writes = [...BARE.matchAll(/OFFLINE_COLUMN\]:/g)];
  assert.equal(writes.length, 1, "something else writes the column: " + writes.length + " sites");
  const calls = [...BARE.matchAll(/markSiteOffline\(/g)];
  assert.equal(calls.length, 2, "one definition and one call site, found " + calls.length);
});

// ── THE ROUTE, DRIVEN ───────────────────────────────────────────────────────

// A CONDITION READ IS NOT A CONDITION DRIVEN: `if (false)` leaves the call
// exactly where a source read looks for it, which is how six mutants survived a
// first pass two changes ago. So the switch is driven through the REAL router.
//
// `siteOwnerBySlug` memoizes for five minutes, so every case below takes its own
// slug — the recorded trap, met twice in this repository already.
const USER = { id: "11111111-1111-1111-1111-111111111111", email: "o@example.com" };

/**
 * A bucket with a WAY BACK, which is what decides whether `takeOffline` lands.
 *
 * The site's stored page source is one of the two ways back (the version archive
 * is the other), and it is one key — so a fixture built on it needs no copy of
 * the archive's layout, which would be a second copy of a thing the product
 * already knows and would drift the first time that layout moved.
 */
function fakeBucket(entries = {}) {
  const store = new Map(Object.entries(entries));
  return {
    store,
    async get(k) { return store.has(k) ? { key: k, async text() { return store.get(k); }, async json() { return JSON.parse(store.get(k)); } } : null; },
    async put(k, v) { store.set(k, String(v)); return { key: k }; },
    async delete(k) { store.delete(k); },
    async head(k) { return store.has(k) ? { key: k, size: 1 } : null; },
    async list({ prefix = "", cursor } = {}) {
      const objects = [...store.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key, size: 1, uploaded: new Date() }));
      return { objects, truncated: false, cursor: undefined, delimitedPrefixes: [] };
    },
  };
}

/** The same bucket, carrying that site's page source so it has a way back. */
function withSource(slug, extra = {}) {
  const out = { ["source/" + slug + "/pages.json"]: JSON.stringify([{ path: "index.tsx", source: "export default () => null" }]) };
  for (const [k, v] of Object.entries(extra)) out[k.replace("{s}", slug)] = v;
  return fakeBucket(out);
}

async function callOffline({ slug, on = true, owner = USER.id, bucket = null, patchThrows = false } = {}) {
  const worker = await loadWorker();
  const patched = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const u = String((input && input.url) || input || "");
    const m = String((init && init.method) || "GET").toUpperCase();
    const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
    if (u.includes("/auth/v1/user")) return json(USER);
    if (u.includes("/rest/v1/site_backends")) {
      if (m === "PATCH") {
        patched.push({ url: u, body: JSON.parse(String(init.body || "{}")) });
        if (patchThrows) throw new Error("supabase down");
        return json([]);
      }
      return json(owner ? [{ uid: owner, slug, neon_db: null, brief: "" }] : []);
    }
    if (u.includes("/rest/v1/")) return json([]);
    return new Response("unavailable", { status: 503 });
  };
  try {
    const req = new Request("https://gofarther.dev/api/site/" + slug + "/offline", {
      method: "POST",
      headers: { Authorization: "Bearer t", "Content-Type": "application/json" },
      body: JSON.stringify({ on }),
    });
    const res = await worker.fetch(req, {
      SUPABASE_SERVICE_KEY: "svc",
      SITES_BUCKET: bucket || fakeBucket({}),
    }, makeCtx());
    return { status: res.status, body: await res.json().catch(() => null), patched };
  } finally { globalThis.fetch = real; }
}

test("DRIVEN: a switch that landed is recorded, stamped, and scoped", async () => {
  const slug = "offrec-landed";
  // A site with a version to come back to, so `takeOffline` really goes through.
  const b = withSource(slug, { "sites/{s}/index.html": "<html>" });
  const before = Date.now();
  const r = await callOffline({ slug, on: true, bucket: b });
  assert.equal(r.status, 200, "the switch itself did not land: " + JSON.stringify(r.body));
  assert.equal(r.patched.length, 1, "the switch was not recorded on the server");
  const stamp = r.patched[0].body[OFFLINE_COLUMN];
  assert.equal(typeof stamp, "string", "the column was not stamped with a time");
  assert.ok(Date.parse(stamp) >= before, "the stamp is not the moment of the switch");
  assert.ok(r.patched[0].url.includes("slug=eq." + slug), "the write does not name the site");
  assert.ok(r.patched[0].url.includes("uid=eq." + USER.id), "the write is not scoped to the owner");
});

test("DRIVEN: a write we could not make never fails a switch that happened", async () => {
  // FAIL-SOFT IS ABOUT THE ANSWER, so a source read of the `catch` proves
  // nothing: a catch that rethrows keeps the word and loses the property. The
  // site has really changed state by the time the write runs, and turning a
  // Supabase blip into a 5xx sends the owner round a retry loop on a switch that
  // already worked — which is the exact bug the button this route replaced had.
  const slug = "offrec-blip";
  const r = await callOffline({ slug, on: true, bucket: withSource(slug), patchThrows: true });
  assert.equal(r.status, 200, "a failed record turned a completed switch into an error");
  assert.equal(r.body.ok, true);
  assert.match(r.body.msg, /Taken offline/, "and the customer still gets the switch's own words");
});

test("DRIVEN: a REFUSED switch records nothing", async () => {
  // No version and no source, so `takeOffline` answers `no-way-back` and the
  // site is still up. Marking here would tell every other browser a live site
  // is down — the state the panel then offers to undo on a site nothing
  // happened to.
  const slug = "offrec-refused";
  const r = await callOffline({ slug, on: true, bucket: fakeBucket({}) });
  assert.equal(r.status, 409, "the fixture no longer drives the refusal: " + JSON.stringify(r.body));
  assert.equal(r.body.ok, false);
  assert.equal(r.patched.length, 0, "a refused take-down marked the site as off the web");
});

test("DRIVEN: a REFUSED restore records nothing either", async () => {
  // The other branch's gate. `putBackOnline` on a site with nothing to put back
  // answers `no-way-back` too, and clearing the stamp there would report a site
  // as live that is still down — the mirror of the case above, and the direction
  // that matters more, since the customer is trying to get their site back.
  const slug = "offrec-back-refused";
  const r = await callOffline({ slug, on: false, bucket: fakeBucket({}) });
  assert.equal(r.body.ok, false, "the fixture no longer drives the refusal");
  assert.equal(r.patched.length, 0, "a refused restore said the site was back up");
});

test("EVALUATED: which way the switch went follows the request, not a constant", () => {
  // WHY THIS IS AN EXPRESSION AND NOT A ROUND TRIP, said rather than skipped. A
  // LANDED restore needs `recompileAndPublish` — a real container — or a version
  // archive activated through the dispatch API, so the `on: false` branch cannot
  // reach the writer in any fixture that does not stand in for both. Its GATE is
  // driven above; what is left is the argument, and a hardcoded `true` there
  // would stamp a site as off the web at the moment somebody put it back.
  //
  // So the condition is pulled out of the route and EVALUATED, never matched: a
  // source read passes on `markSiteOffline(env, lslug, ou.id, true)` just as
  // happily, and `if (false)` leaves a call exactly where a regex looks for it —
  // this repository's own recorded trap, six survivors ago.
  const m = BARE.match(/if \(out\.ok\) await markSiteOffline\(env, lslug, ou\.id, ([^)]+)\);/);
  assert.ok(m, "the offline route's own write moved — re-derive this guard");
  const decide = new Function("lb", "return (" + m[1] + ");");
  assert.equal(decide({ on: true }), true, "`on: true` means offline — the route's own name");
  assert.equal(decide({ on: false }), false, "putting a site back must CLEAR the stamp");
  // The route reads a missing `on` as a take-down (`lb.on === false` is the only
  // way back up), so the record has to agree with what the switch actually did.
  assert.equal(decide({}), true, "a body with no `on` takes the site down, and must be recorded as such");
  assert.equal(decide({ on: "false" }), true, "a string is not `false` to the switch, so it must not be to the record");

  // AND IT IS GATED ON THE SWITCH LANDING, which the two driven cases above
  // prove for real; this reads that both share one call site, so neither can
  // grow its own ungated copy.
  assert.equal([...BARE.matchAll(/await markSiteOffline\(/g)].length, 1,
    "there is more than one write site — one of them is not under `out.ok`");
});

test("DRIVEN: a stranger's site is refused before anything is written", async () => {
  const r = await callOffline({ slug: "offrec-stranger", owner: "22222222-2222-2222-2222-222222222222" });
  assert.equal(r.status, 404, "a site that is not yours must answer as a site that does not exist");
  assert.equal(r.patched.length, 0);
});

// ── THE LIST ROUTE, DRIVEN ──────────────────────────────────────────────────

async function callList({ backends, builds = [], failBuilds = false } = {}) {
  const worker = await loadWorker();
  const real = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const u = String((input && input.url) || input || "");
    const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
    if (u.includes("/auth/v1/user")) return json(USER);
    if (u.includes("/rest/v1/site_backends")) return json(backends);
    if (u.includes("/rest/v1/site_aliases")) return json([]);
    if (u.includes("/rest/v1/site_builds")) return failBuilds ? new Response("x", { status: 500 }) : json(builds);
    return new Response("unavailable", { status: 503 });
  };
  try {
    const res = await worker.fetch(
      new Request("https://gofarther.dev/api/site/list", { headers: { Authorization: "Bearer t" } }),
      { SUPABASE_SERVICE_KEY: "svc" }, makeCtx());
    return { status: res.status, body: await res.json().catch(() => null), text: null };
  } finally { globalThis.fetch = real; }
}

const bk = (slug, over = {}) => ({ slug, created_at: "2026-08-01T00:00:00Z", brief: "", neon_db: null, ...over });

test("DRIVEN: the list answers the derived state, all three ways", async () => {
  const r = await callList({
    backends: [
      bk("up-never"),
      bk("down-now", { [OFFLINE_COLUMN]: "2026-09-08T04:00:00Z" }),
      bk("back-up", { [OFFLINE_COLUMN]: "2026-09-08T04:00:00Z" }),
    ],
    builds: [
      { slug: "back-up", updated_at: "2026-09-08T05:00:00Z" },
      { slug: "down-now", updated_at: "2026-09-08T03:00:00Z" },
    ],
  });
  assert.equal(r.status, 200);
  const by = Object.fromEntries(r.body.sites.map((s) => [s.slug, s]));
  assert.equal(by["up-never"].offline, false, "a site never switched is online");
  assert.equal(by["down-now"].offline, true, "its last build predates the switch, so it is still down");
  assert.equal(by["back-up"].offline, false,
    "a publish after the switch put it back up — nothing clears the stamp, so this comparison IS the feature");
});

test("DRIVEN: an unreadable BUILD list makes the answer unknown, never 'online'", async () => {
  const r = await callList({
    backends: [bk("blip-down", { [OFFLINE_COLUMN]: "2026-09-08T04:00:00Z" }), bk("blip-up")],
    failBuilds: true,
  });
  assert.equal(r.status, 200, "a failed build read still leaves the list standing");
  const by = Object.fromEntries(r.body.sites.map((s) => [s.slug, s]));
  assert.equal(by["blip-down"].offline, null,
    "a blip reported somebody's site as live while it was down");
  // THE CONTROL. Without it a route that answered `null` for everything would
  // pass, and every site on the platform would fall back to a browser-local flag.
  assert.equal(by["blip-up"].offline, false,
    "a site that was never switched needs no build read to be called online");
});

test("DRIVEN: the wire carries a BOOLEAN — never the stamp, never the column", async () => {
  const stamp = "2026-09-08T04:00:00Z";
  const r = await callList({ backends: [bk("wire-1", { [OFFLINE_COLUMN]: stamp })] });
  // SEARCHED OVER THE WHOLE PAYLOAD, the `neon_db` precedent: a field-level
  // check passes the day somebody spreads the row into the reply.
  const payload = JSON.stringify(r.body);
  assert.ok(!payload.includes(stamp), "the raw timestamp reached the browser");
  assert.ok(!payload.includes(OFFLINE_COLUMN), "the column's own name reached the browser");
  assert.equal(r.body.sites[0].offline, true, "and the observer is alive: the boolean is there");
});

test("the select really asks for the column", () => {
  // Without this the read is `undefined` for every row, `siteOffline` answers
  // `false` for all of them, and nothing anywhere fails — the quietest possible
  // version of this feature being dead.
  const at = BARE.indexOf("site_backends?uid=eq.${luid}&select=");
  assert.ok(at > 0, "the list route's own select moved");
  const line = BARE.slice(at, BARE.indexOf("\n", at));
  assert.ok(line.includes("${OFFLINE_COLUMN}"), "the list no longer selects the column it derives from");

  // AND THE ROUTE KEEPS "could not read" APART FROM "has never built". Folding
  // them is what would turn a blip into "your site is live".
  assert.match(BARE, /const buildRows = await lrows\(ld\);/, "the build read's own answer is not kept");
  assert.match(BARE, /buildRows \? \(stamp\(builtBy\[r\.slug\]\) \|\| 0\) : undefined/,
    "an unreadable build list is being handed to the rule as a real answer");
});

// ── THE BROWSER ─────────────────────────────────────────────────────────────

test("the wire's three answers are kept apart on the way in", () => {
  assert.equal(SiteList.fromRow({ slug: "a", offline: true }).offline, true);
  assert.equal(SiteList.fromRow({ slug: "a", offline: false }).offline, false);
  assert.equal(SiteList.fromRow({ slug: "a", offline: null }).offline, undefined);
  assert.equal(SiteList.fromRow({ slug: "a" }).offline, undefined);
  // Never coerced: a shape we did not send is not believed as either answer.
  assert.equal(SiteList.fromRow({ slug: "a", offline: "true" }).offline, undefined);
  assert.equal(SiteList.fromRow({ slug: "a", offline: 1 }).offline, undefined);
  assert.equal(SiteList.fromRow({ slug: "a", offline: ["true"] }).offline, undefined);
});

test("the server wins where it can tell, and only there", () => {
  assert.equal(SiteList.offlineNow(true, false), true, "the server says down, this browser says up");
  assert.equal(SiteList.offlineNow(false, true), false,
    "the server says up and this browser is stale — the local flag must not pin a site offline for ever");
  assert.equal(SiteList.offlineNow(undefined, true), true, "cannot tell → the local record stands");
  assert.equal(SiteList.offlineNow(undefined, false), false);
  assert.equal(SiteList.offlineNow(undefined, undefined), false);
  // Strict on both sides.
  assert.equal(SiteList.offlineNow("true", "true"), false, "a coerced answer on either side");
  assert.equal(SiteList.offlineNow(1, 1), false);
});

test("the merge takes the server's answer, and keeps the local one where it could not tell", () => {
  const localRec = (slug, offline) => ({ id: "c-" + slug, name: slug, slug, msgs: [], createdAt: 1, updatedAt: 1, offline });
  const srv = (slug, offline) => ({ slug, name: slug, brief: "", createdAt: 1, updatedAt: 2, offline });

  const out = SiteList.merge(
    [localRec("one", true), localRec("two", false), localRec("three", true)],
    [srv("one", false), srv("two", true), srv("three", null)],
    true,
  );
  const by = Object.fromEntries(out.map((s) => [s.slug, s]));
  assert.equal(by.one.offline, false, "the server put it back and the stale local flag won");
  assert.equal(by.two.offline, true, "the server took it down elsewhere and this browser never heard");
  assert.equal(by.three.offline, true, "cannot-tell dropped the local record's answer");

  // A site the server named that this browser has never seen carries the
  // server's answer straight through.
  const fresh = SiteList.merge([], [srv("new", true)], true);
  assert.equal(fresh[0].offline, true);
});

test("the cached server row is corrected when a switch lands here", () => {
  const rows = [{ slug: "one", offline: false }, { slug: "two", offline: false }];
  const out = SiteList.markOffline(rows, "one", true);
  assert.equal(out[0].offline, true, "the row the switch was about is unchanged");
  assert.equal(out[1].offline, false, "a row it was not about moved");

  // A NEW ARRAY, and the caller's rows untouched: a render already reading the
  // list must not see it change under it.
  assert.notEqual(out, rows);
  assert.equal(rows[0].offline, false, "the caller's own row was mutated");

  // Written strictly, because `fromRow` reads it strictly.
  assert.equal(SiteList.markOffline(rows, "one", "yes")[0].offline, false);

  // A SLUG THAT IS NOT USABLE LEAVES EVERY ROW ALONE, and the row that proves
  // it has to be one whose OWN slug is unusable: a `want` of `""` matches
  // nothing among ordinary slugs whether the wall is there or not, so a fixture
  // of good rows cannot tell the two readings apart — driven rather than
  // assumed, after a sweep found exactly that.
  const odd = [{ slug: ["one"], offline: false }, { slug: "two", offline: false }];
  assert.deepEqual(SiteList.markOffline(odd, "", true), odd,
    "an unusable slug patched a row whose own slug is unusable");
  assert.deepEqual(SiteList.markOffline(odd, ["one"], true), odd);
  assert.deepEqual(SiteList.markOffline(rows, ["one"], true), rows);
  assert.deepEqual(SiteList.markOffline(rows, "", true), rows);
  assert.equal(SiteList.markOffline(null, "one", true), null, "a list we do not have is not a list");
});

test("one site's answer is asked the SAME way the grid asks", () => {
  const rows = [{ slug: "one", offline: true }, { slug: "two", offline: false }];
  assert.equal(SiteList.offlineFor(rows, { slug: "one", offline: false }), true, "the server wins");
  assert.equal(SiteList.offlineFor(rows, { slug: "two", offline: true }), false, "and in the other direction");
  // A site the server did not list, or a list we never got: the local flag.
  assert.equal(SiteList.offlineFor(rows, { slug: "three", offline: true }), true);
  assert.equal(SiteList.offlineFor(null, { slug: "one", offline: true }), true);
  assert.equal(SiteList.offlineFor(rows, { slug: "one", offline: undefined }), true);
  assert.equal(SiteList.offlineFor(rows, null), false);
  // A row whose slug is a hostile shape can never answer for another site.
  assert.equal(SiteList.offlineFor([{ slug: ["one"], offline: true }], { slug: "one", offline: false }), false);

  // AND IT SHARES THE RULE rather than repeating the comparison, so the panel
  // and the grid cannot disagree about a site.
  const at = LIST_JS.indexOf("function offlineFor(");
  const fn = LIST_JS.slice(at, LIST_JS.indexOf("\n  }", at));
  assert.match(fn, /return offlineNow\(/, "offlineFor decides for itself — two copies of one rule");
});

// ── THE HOPS ────────────────────────────────────────────────────────────────

test("the PANEL asks for the answer, which is the hop that would have shipped dead", () => {
  // `sitePublishPanel` gets its `site` from `siteById`, which searches
  // localStorage and nothing else — so the server's answer could reach the grid,
  // be preferred there, and never reach the one screen that draws the two faces.
  // That is this repository's recorded wiring trap: a value forwarded and read by
  // one consumer of two.
  const at = BARE_CHAT.indexOf("function sitePublishPanel(site)");
  assert.ok(at > 0, "the panel is gone");
  const fn = BARE_CHAT.slice(at, BARE_CHAT.indexOf("\n}", at));
  assert.match(fn, /const offline = SiteList\.offlineFor\(sitesRemote, site\)/,
    "the panel is back on a browser-local flag — a site taken offline elsewhere opens the wrong face");
  assert.ok(!/site\.offline === true/.test(fn), "the old local-only read is still there beside the new one");

  // BOTH FACES ARE STILL DRAWN, so the value it now reads correctly has
  // somewhere to land — a negative assertion needs a live observer.
  assert.match(fn, /id="spLive"/, "the back-online button is gone");
  assert.match(fn, /id="spUnpub"/, "the take-offline button is gone");
});

test("a switch made here corrects the cached server list too", () => {
  const at = BARE_CHAT.indexOf("function siteSetLive(site, live)");
  const fn = BARE_CHAT.slice(at, BARE_CHAT.indexOf("\n}", at));
  // The server list is held for a minute. Without this, the merge would spend
  // that minute preferring a row read BEFORE the press, and the card would show
  // the face the press just changed.
  assert.match(fn, /sitesRemote = SiteList\.markOffline\(sitesRemote, slug, !live\)/,
    "the cached server answer is not corrected — a landed switch would be overruled by a stale row");
  assert.match(fn, /s\.offline = !live/,
    "the local record is no longer written, so a signed-out or offline browser has nothing to fall back on");
  // Both writes are inside the success branch: recording a switch that did not
  // happen is the failure the route's own guard above is about.
  const okAt = fn.indexOf("if (r.ok && d.ok)");
  assert.ok(okAt > 0 && okAt < fn.indexOf("markOffline"), "the correction is not gated on the switch landing");
});

test("the module the Worker imports is the one that decides", () => {
  assert.match(BARE, /import \{ OFFLINE_COLUMN, siteOffline \} from "\.\/builder\/site-offline\.mjs"/,
    "the Worker no longer imports the rule");
  const uses = [...BARE.matchAll(/siteOffline\(/g)];
  assert.equal(uses.length, 1, "the rule is asked " + uses.length + " times — it should be exactly the list route");
  // The module is dependency-free, so nothing about it can fail to load inside
  // the site's container the way a Supabase-touching module would.
  const mod = read("../builder/site-offline.mjs");
  assert.ok(!/^import /m.test(mod), "site-offline.mjs took a dependency");
});
