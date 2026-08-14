// Runtime error telemetry, end to end in shape: the template's reporter POSTs,
// the Worker stores into the site's own `_errors`, the owner reads it in
// Cloud → Errors. Before this the report was built, packaged and delivered to
// nobody (2026-08-14 audit) — the owner learned a page was broken when
// customers went quiet.
//
// Plus rule 18 (structured data), which closes the other half of the same
// audit group: seo-jsonld.tsx was on disk, documented, and cited by zero rules
// — the repo's own recorded "reachable by nothing" class.
import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";

import { hit } from "./fixtures/worker-harness.mjs";

const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const schema = fs.readFileSync(new URL("../site-schema.mjs", import.meta.url), "utf8");
const reporter = fs.readFileSync(new URL("../builder/lovable/template/src/lib/error-reporting.ts", import.meta.url), "utf8");
const chat = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");

// ── The public write route, driven through the real router ──────────────────

test("POST /api/db/<slug>/error answers 204 whatever happened", async () => {
  // Fire-and-forget telemetry: an error response would only produce a second
  // console error about reporting the first, and a distinct status for "no
  // such site" would let a stranger probe slugs through an unauthenticated
  // endpoint. With an empty env the store step can only fail — and the caller
  // must still get 204.
  const r = await hit("/api/db/some-site/error", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: "boom", route: "/book", source: "onerror" }),
  });
  assert.equal(r.status, 204);
  assert.equal(r.text, "");
});

test("the error route refuses GET and junk bodies stay 204", async () => {
  const g = await hit("/api/db/some-site/error", { method: "GET" });
  assert.equal(g.status, 405, "a misconfigured sender should learn its verb is wrong");
  const junk = await hit("/api/db/some-site/error", { method: "POST", body: "not json at all" });
  assert.equal(junk.status, 204, "a junk body is dropped, never negotiated with");
});

test("THE ERROR ROUTE SWALLOWS NO SIBLING under the shared /api/db/ prefix", async () => {
  // Its outer guard is `endsWith("/error")` inside a block full of sibling
  // routes, and it sits ABOVE auth, turnstile, checkout and uploads. So
  // `/api/db/x/auth/error` enters this branch first, and only the inner regex —
  // slug immediately followed by `/error` — stops it being answered here and
  // never reaching the auth proxy. Adding an endsWith route to a shared prefix
  // block is exactly how a sibling gets swallowed, so it is proven rather than
  // reasoned: the real router, one request each.
  const mine = await hit("/api/db/x/error", { method: "POST", body: "{}" });
  assert.equal(mine.status, 204, "the exact shape no longer reaches the error route");

  for (const p of ["/api/db/x/auth/error", "/api/db/x/data/error", "/api/db/x/hook/error"]) {
    let reached = "error-route";
    try {
      const r = await hit(p, { method: "POST", body: "{}" });
      // 204 with an empty body is THIS route's answer and nothing else's here.
      reached = (r.status === 204 && r.text === "") ? "error-route" : "elsewhere";
    } catch {
      // Its own handler tried to reach a binding the harness does not supply,
      // which is proof it got there — this route needs no binding to answer.
      reached = "elsewhere";
    }
    assert.equal(reached, "elsewhere", p + " was swallowed by the error route");
  }
});

test("GET /api/site/<slug>/errors exists and refuses an unauthenticated caller", async () => {
  // 401, not the router's bottom 404 — the whole point of the harness. This is
  // the check that would have caught the twelve wiring deaths.
  const r = await hit("/api/site/some-site/errors");
  assert.equal(r.status, 401, "the owner route is unrouted or ungated — got " + r.status + " " + r.text.slice(0, 80));
});

// ── The write path's discipline (source-reads) ──────────────────────────────

test("the rate limit fires BEFORE the body is read, and the write rides waitUntil", () => {
  const at = worker.indexOf('url.pathname.endsWith("/error")');
  assert.ok(at > 0, "the error route is gone");
  const block = worker.slice(at, worker.indexOf("/turnstile", at));
  const limit = block.indexOf("_dataLimiter.hit(");
  const read = block.indexOf("readJsonBody(request");
  assert.ok(limit > 0 && read > limit, "the body is buffered before the rate limit — a flood costs us the read");
  // AND THE ANSWER IS ACTED ON. Calling the limiter and ignoring it passes the
  // ordering check perfectly — a mutant deleting the refusal survived the whole
  // suite, leaving a flood free to buffer bodies and wake the site's database on
  // every request. Ordering is worthless without the refusal it orders.
  const refuse = block.indexOf("if (!ehit.ok)");
  assert.ok(refuse > limit && refuse < read,
    "the rate limit's verdict is computed and discarded — it bounds nothing");
  // The audit-log lesson: a detached promise nobody holds is cancelled with
  // the request, and a log that keeps a random subset is worse than none.
  const wait = block.indexOf("ctx.waitUntil(");
  const insert = block.indexOf("INSERT INTO _errors");
  assert.ok(wait > 0 && insert > wait, "the store write is not held by waitUntil — reports vanish mid-flight");
  // The source field is an allow-list of the reporter's own three values, so a
  // stranger cannot write arbitrary strings into the owner's panel labels.
  assert.match(block, /\["error_boundary", "onerror", "unhandledrejection"\]\.includes\(body\.source\)/);
  // Prune on the WRITE — a table only trimmed when the panel opens grows
  // without bound on every site nobody looks at.
  assert.match(block, /DELETE FROM _errors WHERE id NOT IN \(SELECT id FROM _errors ORDER BY id DESC LIMIT 500\)/);
});

test("A SITE THAT NEVER RUNS A FULL BUILD STILL GETS ITS ERRORS RECORDED", () => {
  // `_errors` is created by `applySiteSchema`, which only the build, addon and
  // rules lanes run — every cheap edit lane (text, look, picture, logo, data)
  // publishes through `recompileAndPublish` and never applies a schema. So an
  // owner who has only ever changed wording and colours would never get the
  // table: every report throws `relation "_errors" does not exist` into a
  // swallowing catch, and the panel says **"Nothing has gone wrong"** — the
  // exact failure this feature exists to prevent, wearing a reassuring
  // sentence. The write path heals it on first use.
  const at = worker.indexOf('url.pathname.endsWith("/error")');
  const block = worker.slice(at, worker.indexOf("THE ONE PART OF SPAM PROTECTION", at));
  // Anchored on the PROPERTY — a missing table is detected, and anything else
  // rethrows — rather than on the spelling of the condition, which this test
  // pinned in a first draft and then failed on a correct change of my own.
  assert.match(block, /does not exist/i,
    "a missing table is not detected — reports are dropped on every pre-existing site");
  assert.match(block, /if \(!\w+\) throw e;|throw e;/,
    "a failure that is NOT a missing table is swallowed instead of surfacing");
  assert.match(block, /CREATE TABLE IF NOT EXISTS _errors/,
    "nothing creates the table on the write path — it heals nowhere");
  // THE SQLSTATE TOO, on both the write heal and the owner read. `42P01` is
  // undefined_table and is what Postgres actually promises; the message is
  // English prose a driver upgrade could reword, and matching only that would
  // leave the heal dead on every existing site — the precise state it exists to
  // end — with no live database here to discover it on.
  assert.match(block, /\(e && e\.code\) === "42P01"/,
    "the write heal matches the message only — a reworded driver error kills it silently");
  const ownerAt = worker.indexOf("} else if (er) {");
  const ownerBlock = worker.slice(ownerAt, worker.indexOf("} else if (", ownerAt + 10));
  assert.match(ownerBlock, /\(e && e\.code\) === "42P01"/,
    "the owner read matches the message only — a pre-table site would 503 instead of reading empty");
  // CREATE-AND-RETRY, not create-first: the ordinary path must stay ONE
  // statement, so the extra round trip is paid once per site rather than on
  // every report a busy site sends.
  const firstInsert = block.indexOf("await insert();");
  const create = block.indexOf("CREATE TABLE IF NOT EXISTS _errors");
  assert.ok(firstInsert > 0 && create > firstInsert,
    "the table is created BEFORE the insert — every report pays a DDL round trip");
  // And a failure that is NOT a missing table still surfaces rather than being
  // silently retried into the same wall.
  assert.match(block, /throw e;/);
});

test("_errors is created by every build, beside _secrets, and granted to nobody", () => {
  // EXECUTED, not merely present. A mutant replacing `sqlQuery(uuid, "CREATE
  // TABLE …")` with `Promise.resolve("CREATE TABLE …")` left the DDL string
  // exactly where it was and survived the whole suite — the table would never
  // be created and this assertion would never know. Anchor on the CALL.
  assert.match(schema, /await sqlQuery\(uuid, "CREATE TABLE IF NOT EXISTS _errors \(id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, at TEXT, message TEXT, stack TEXT, route TEXT, source TEXT\)"\)/,
    "the _errors DDL is not executed — every report insert fails on every site");
  // The `_sessions` lesson: created where every build runs, or it exists only
  // where the feature happened to fire and 500s everywhere else.
  const secrets = schema.indexOf("CREATE TABLE IF NOT EXISTS _secrets");
  const errors = schema.indexOf("CREATE TABLE IF NOT EXISTS _errors");
  assert.ok(secrets > 0 && errors > secrets, "_errors moved away from the always-runs block");
  // Never through grantsFor — underscore tables are unreachable by the Data
  // API by construction, and naming this one anywhere near a grant would be
  // the start of unlearning that. COMMENTS ARE BLANKED FIRST: the DDL's own
  // comment says "never passed through grantsFor", and an absence guard that
  // reads prose matches its own fix's explanation (the og-guard lesson).
  const code = schema.replace(/\/\/[^\n]*/g, "");
  assert.ok(!/grantsFor[\s\S]{0,400}_errors|_errors[\s\S]{0,400}grantsFor/.test(code),
    "_errors appears near the grant machinery");
});

test("the owner read is gated, GET-only, and an old site answers an empty list", () => {
  const at = worker.indexOf("} else if (er) {");
  assert.ok(at > 0, "the er handler is gone");
  const block = worker.slice(at, worker.indexOf("} else if (", at + 10));
  const gate = block.indexOf("assertOwner(ownerDeps, eslug, ou.id)");
  const verb = block.indexOf('request.method !== "GET"');
  const read = block.indexOf("SELECT id, at, message, route, source");
  assert.ok(gate > 0 && verb > gate && read > verb, "ownership is not checked before anything else");
  // A site built before `_errors` existed must read as "nothing reported", not
  // as a 500 — the table arrives with its next build either way.
  assert.match(block, /does not exist/i);
  assert.match(block, /ok: true, errors: \[\]/);
});

// ── The template's sender ───────────────────────────────────────────────────

test("the reporter POSTs same-origin, capped, keepalive, and never from a bare preview", () => {
  assert.match(reporter, /fetch\(`\/api\/db\/\$\{slug\}\/error`/,
    "the report never leaves the browser — the delivered-to-nobody state is back");
  assert.match(reporter, /import \{ siteSlug \} from "\.\/rows"/,
    "the slug is not the one reader every data call already uses");
  assert.match(reporter, /slug !== "preview"/,
    "a local dev build would report against a site named 'preview'");
  assert.match(reporter, /sentReports < MAX_REPORTS_PER_LOAD/,
    "a render loop can flood the endpoint from one tab");
  assert.match(reporter, /keepalive: true/,
    "a report racing the navigation the error caused is dropped by the browser");
  // Clipped in the sender as well as the server — but the server is the one
  // that counts, since the sender is anyone with curl. Asserted there too.
  assert.match(reporter, /message: report\.message\.slice\(0, 300\)/);
});

test("THE REPORTED ROUTE IS THE PAGE, not whichever anchor was last clicked", () => {
  // `currentRoute()` preferred `location.hash`, which was right under the hash
  // router removed on 2026-08-09. The hash is an ordinary in-page anchor now —
  // PAGE_RULES blesses `#prices`, the lint exempts it, and the REFERENCE page
  // puts three in the site header, so they are on every page of a
  // reference-shaped site. Harmless while the value only reached the console;
  // Round 7 made it the ONE field saying where the site broke, so a visitor who
  // had clicked "Prices" was reported against `prices` — a section anchor that
  // is not a page, plausible enough that nobody could tell.
  //
  // Driven rather than read: the expression is short and the failure is a wrong
  // STRING, which a source-match cannot judge.
  const src = reporter.slice(reporter.indexOf("const currentRoute"), reporter.indexOf("export function reportAppError"));
  const body = src.slice(src.indexOf("{"), src.lastIndexOf("}") + 1);
  const route = new Function("window", "return (() => " + body + ")()");

  // The workspace mount and the customer's own domain must report the SAME
  // page, or one fault reads as two.
  assert.equal(route({ location: { pathname: "/s/sharp-fade/book", hash: "" } }), "/book");
  assert.equal(route({ location: { pathname: "/book", hash: "" } }), "/book");
  // A clicked anchor rides along as a suffix — real information, not the page.
  assert.equal(route({ location: { pathname: "/", hash: "#prices" } }), "/#prices");
  assert.notEqual(route({ location: { pathname: "/", hash: "#prices" } }), "prices",
    "the anchor is being reported as though it were the page");
  // The site root stays a path rather than collapsing to empty.
  assert.equal(route({ location: { pathname: "/s/sharp-fade", hash: "" } }), "/");
});

// ── The owner's panel ───────────────────────────────────────────────────────

test("the Errors card exists, dispatches, and the panel renders what it fetched", () => {
  assert.match(chat, /'Errors', dataLive \? 'Problems visitors hit on your live site'/,
    "the Cloud card is gone — the read half is unreachable from the product");
  assert.match(chat, /b\.dataset\.cloud === 'errors'\) siteErrors\(site\)/,
    "the card dispatches to nothing — the dead-panel class");
  const at = chat.indexOf("async function siteErrors(site)");
  assert.ok(at > 0, "the panel function is gone");
  const panel = chat.slice(at, chat.indexOf("async function siteBackups"));
  assert.match(panel, /apiFetch\('\/api\/site\/' \+ encodeURIComponent\(slug\) \+ '\/errors'\)/,
    "the panel never calls the route");
  // The M15 lesson: anchor on the MARKUP the rows land in, not the fetch — a
  // list fetched and rendered nowhere passed the last guard written this way.
  assert.match(panel, /<div id="erList">/, "the panel has nowhere to render the list");
  assert.match(panel, /getElementById\('erList'\)/);
  assert.match(panel, /No errors reported/, "an empty log has no honest empty state");
  // WHAT IT COST THE VISITOR, in words. `source` is the only severity signal
  // there is — "they saw a broken page" vs "something failed in the background"
  // — and printing the raw enum tells a barber nothing. Every stored value must
  // have a sentence, and an unknown one must degrade rather than print raw.
  const felt = panel.match(/const felt = \{[^}]+\}/);
  assert.ok(felt, "the panel prints the raw source enum — 'unhandledrejection' at a barber");
  for (const s of ["error_boundary", "onerror", "unhandledrejection"]) {
    assert.ok(felt[0].includes(s + ":"), "no plain-language sentence for source " + s);
  }
  assert.match(panel, /felt\[e2\.source\] \|\| 'Something went wrong'/,
    "an unrecognised source has no fallback — it would render as undefined");
  // An unreadable log is NOT an empty one — "no errors" is the one wrong
  // answer this panel can give.
  assert.match(panel, /Couldn(\\u2019|’)t load the error log/, "a failed load reads as all-clear");
});

// ── Rule 18: the structured data the kit always had ─────────────────────────

test("rule 18 points the generator at SeoJsonLd, facts-from-the-brief only", () => {
  const gen = fs.readFileSync(new URL("../builder/page-gen.mjs", import.meta.url), "utf8");
  const at = gen.indexOf("18. THE HOME PAGE CARRIES THE BUSINESS'S STRUCTURED DATA");
  assert.ok(at > 0, "rule 18 is gone — seo-jsonld is back to reachable-by-nothing");
  const rule = gen.slice(at, at + 1200);
  assert.match(rule, /SeoJsonLd, localBusinessJsonLd/, "the rule does not name both exports");
  assert.match(rule, /@\/components\/ui\/seo-jsonld/, "the rule does not name the module path");
  // The half that keeps it safe: invented facts in structured data get rich
  // results switched off for the whole site. The rule must forbid them and
  // must say to OMIT when the brief is silent. Whitespace-flexible, because
  // the rules are hard-wrapped and a phrase legitimately spans two lines —
  // pinning the line break is a test about formatting, not about the rule.
  assert.match(rule, /ONLY\s+facts\s+the\s+brief\s+actually\s+states/);
  assert.match(rule, /means\s+no\s+\\`SeoJsonLd\\`\s+at\s+all/);
});

test("both exports rule 18 cites really exist in the kit", () => {
  // Derived, so a rename in the component fails here rather than compiling
  // every generated page into a TS2305.
  const src = fs.readFileSync(new URL("../builder/lovable/template/src/components/ui/seo-jsonld.tsx", import.meta.url), "utf8");
  assert.match(src, /export function SeoJsonLd\(/);
  assert.match(src, /export function localBusinessJsonLd\(/);
});

test("RULE 18 SHOWS THE ARGUMENT SHAPE, because nothing else in the prompt can", () => {
  // A first draft wrote the call as ES6 shorthand — `localBusinessJsonLd({ name,
  // telephone, address, openingHours })` — which reads as four scalars. The real
  // signature nests `address` and takes `openingHours` as a string ARRAY, and
  // that shape appears NOWHERE the model can see: COMPONENT_API's entry for
  // this module is truncated and never mentions the helper, COMPONENT_TYPES has
  // no entry, and no reference page or family exemplar uses it. So the natural
  // call is `address: "42 High Street, Leeds"` → TS2322 → and because rule 18
  // puts it on the HOME page, which salvage refuses to stub, the customer loses
  // THE WHOLE SITE to the placeholder. The `fallbackSeed` and `useUpdateRow`
  // class, for the third time: the model reaches for a shape we never gave it.
  const gen = fs.readFileSync(new URL("../builder/page-gen.mjs", import.meta.url), "utf8");
  const at = gen.indexOf("18. THE HOME PAGE CARRIES THE BUSINESS'S STRUCTURED DATA");
  const rule = gen.slice(at, gen.indexOf("## Reading rows", at));
  assert.ok(rule.length > 400, "the rule 18 window collapsed");

  // The two shapes that a shorthand cannot convey, stated in the rule…
  assert.match(rule, /address:\s*\{\s*street:/, "the rule does not show address as an OBJECT");
  assert.match(rule, /openingHours:\s*\[/, "the rule does not show openingHours as an ARRAY");

  // …and DERIVED from the component, so a change to the real signature fails
  // here rather than in a customer's build. Both directions: the field names
  // the rule uses must be ones the helper actually declares.
  const src = fs.readFileSync(new URL("../builder/lovable/template/src/components/ui/seo-jsonld.tsx", import.meta.url), "utf8");
  const sig = src.slice(src.indexOf("export function localBusinessJsonLd"), src.indexOf("): Record<string, unknown>"));
  assert.match(sig, /address\?:\s*\{/, "the helper stopped nesting address — the rule now teaches a type error");
  assert.match(sig, /openingHours\?:\s*string\[\]/, "the helper's hours type changed under the rule");
  for (const f of ["street", "city", "postcode", "country"]) {
    assert.ok(sig.includes(f + "?:"), "the rule names address." + f + " and the helper does not declare it");
  }
});
