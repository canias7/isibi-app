import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  normalizeHostname, isOwnHostname, claimRefusal, isApex, dnsInstructions, readStatus, OWN_ZONES, servedAtRoot,
  mountRootFor, absolutizeAssets,
} from "../site-domains.mjs";

// ------------------------------------------------- what a hostname reduces to

test("what people actually paste is accepted", () => {
  for (const [given, want] of [
    ["sharpfadebarbers.com", "sharpfadebarbers.com"],
    ["  SharpFadeBarbers.COM  ", "sharpfadebarbers.com"],
    ["https://sharpfadebarbers.com", "sharpfadebarbers.com"],
    ["http://www.sharpfadebarbers.com/book?x=1", "www.sharpfadebarbers.com"],
    ["sharpfadebarbers.com.", "sharpfadebarbers.com"],
    ["sharpfadebarbers.com:443", "sharpfadebarbers.com"],
    ["shop.sharpfadebarbers.co.uk", "shop.sharpfadebarbers.co.uk"],
    ["xn--caf-dma.com", "xn--caf-dma.com"],
    ["a-b-c.example.org", "a-b-c.example.org"],
  ]) {
    assert.equal(normalizeHostname(given), want, JSON.stringify(given));
  }
});

test("anything that is not one ordinary hostname is REFUSED, not repaired", () => {
  // This value becomes a routing key. A guess about what somebody meant is a
  // guess about whose traffic goes where.
  for (const bad of [
    "", " ", null, undefined, 4, {},
    "localhost", "myserver",                     // single label / reserved
    "example.test", "thing.local", "x.invalid",  // reserved TLDs
    "192.168.0.1", "8.8.8.8",                    // an address is not a name
    "*.example.com", "*.com",                    // wildcards
    "user@example.com", "https://u:p@x.com",     // credentials in the authority
    "example.com:8080",                          // a port we cannot serve
    "-example.com", "example-.com", "ex..com",   // malformed labels
    "café.com",                                  // unicode must be punycode
    "a".repeat(64) + ".com",                     // label over 63
    ("a".repeat(60) + ".").repeat(5) + "com",    // name over 253
  ]) {
    assert.equal(normalizeHostname(bad), null, JSON.stringify(bad));
  }
});

test("a hostname exactly at the limits is allowed", () => {
  // An off-by-one here refuses real domains, which is the failure nobody
  // reports because they assume they typed it wrong.
  assert.equal(normalizeHostname("a".repeat(63) + ".com"), "a".repeat(63) + ".com");
  const long = ("a".repeat(49) + ".").repeat(5) + "com";       // 253 exactly
  assert.equal(long.length, 253);
  assert.equal(normalizeHostname(long), long);
});

// ------------------------------------------- the check the platform rests on

test("NOBODY may claim one of our own names", () => {
  // Requests are routed by Host. A stored row saying `gofarther.dev → a-slug`
  // serves a stranger's site in place of the entire platform: the app, the
  // sign-in page, every API route.
  for (const ours of [
    "gofarther.dev", "www.gofarther.dev", "GoFarther.dev", "https://gofarther.dev/",
    "api.gofarther.dev", "anything.at.all.gofarther.dev", "gofarther.dev.",
  ]) {
    assert.equal(isOwnHostname(normalizeHostname(ours)), true, ours);
    assert.ok(claimRefusal(ours), ours);
  }
});

test("…and a name that merely LOOKS like ours stays claimable", () => {
  // `endsWith("gofarther.dev")` without the dot would steal these from their
  // real owners, and the suffix check is the whole mechanism.
  for (const theirs of ["notgofarther.dev", "mygofarther.dev", "gofarther.dev.evil.com", "gofarther.devious.com"]) {
    const h = normalizeHostname(theirs);
    assert.ok(h, theirs);
    assert.equal(isOwnHostname(h), false, theirs);
    assert.equal(claimRefusal(theirs), null, theirs);
  }
});

test("every zone in the list is protected, not just the first", () => {
  // Derived, so adding a second zone cannot leave it unguarded.
  for (const z of OWN_ZONES) {
    assert.equal(isOwnHostname(z), true, z);
    assert.equal(isOwnHostname("www." + z), true, z);
    assert.equal(isOwnHostname("x" + z), false, z);
  }
});

test("a refusal says something the owner can act on", () => {
  assert.match(claimRefusal("not a domain"), /domain/i);
  assert.match(claimRefusal("gofarther.dev"), /platform/i);
  assert.equal(claimRefusal("sharpfadebarbers.com"), null);
});

// ----------------------------------------------------- what the owner must do

test("apex and subdomain are told apart, because the instruction differs", () => {
  assert.equal(isApex("example.com"), true);
  assert.equal(isApex("www.example.com"), false);
  assert.equal(isApex("shop.eu.example.com"), false);
});

test("the apex instruction names the thing that actually blocks people", () => {
  // A plain CNAME is illegal at a zone apex, so an owner whose provider has no
  // ALIAS/ANAME/flattening cannot do what a naive instruction tells them to.
  const a = dnsInstructions("example.com", "saas.gofarther.dev");
  assert.equal(a.apex, true);
  assert.equal(a.records[0].name, "@");
  assert.equal(a.records[0].value, "saas.gofarther.dev");
  assert.match(a.records[0].note, /ALIAS|ANAME|flatten/i);
  assert.match(a.records[0].note, /www/, "and offers the way out");

  const s = dnsInstructions("www.example.com", "saas.gofarther.dev");
  assert.equal(s.apex, false);
  assert.equal(s.records[0].name, "www");
  assert.ok(!/ALIAS/i.test(s.records[0].note), "a subdomain needs none of that");
});

test("the record name is the subdomain part, however deep", () => {
  assert.equal(dnsInstructions("shop.eu.example.com", "t").records[0].name, "shop.eu");
});

test("instructions are DATA, not prose", () => {
  // The owner is about to type this into a form on another website; a
  // paragraph is the wrong shape to copy from.
  const d = dnsInstructions("www.example.com", "saas.gofarther.dev");
  assert.equal(typeof d.records[0].kind, "string");
  assert.equal(typeof d.records[0].name, "string");
  assert.equal(typeof d.records[0].value, "string");
});

// ---------------------------------------------------------------- the status

test("live means BOTH halves, because either alone serves nothing", () => {
  assert.equal(readStatus({ status: "active", ssl: { status: "active" } }).live, true);
  // Verified with no certificate serves nothing…
  assert.equal(readStatus({ status: "active", ssl: { status: "pending_validation" } }).live, false);
  // …and a certificate while DNS points elsewhere also serves nothing.
  assert.equal(readStatus({ status: "pending", ssl: { status: "active" } }).live, false);
});

test("the stage names which half is stuck", () => {
  // An owner shown one number cannot tell which of two independent things to
  // go and fix.
  assert.equal(readStatus({ status: "pending", ssl: { status: "initializing" } }).stage, "waiting for DNS");
  assert.equal(readStatus({ status: "active", ssl: { status: "pending_validation" } }).stage, "issuing the certificate");
  assert.equal(readStatus({ status: "active", ssl: { status: "active" } }).stage, "live");
});

test("pending is NOT failure, and only two things are", () => {
  // Issuing routinely takes minutes and longer while DNS propagates. Calling
  // that failed sends owners to delete and re-add, which restarts the clock.
  for (const s of ["pending", "pending_validation", "initializing", "pending_deployment", "unknown", ""]) {
    assert.equal(readStatus({ status: s, ssl: { status: s } }).failed, false, s);
  }
  assert.equal(readStatus({ status: "moved", ssl: {} }).failed, true);
  assert.equal(readStatus({ status: "deleted", ssl: {} }).failed, true);
  assert.equal(readStatus({ status: "active", ssl: { status: "timing_out" } }).failed, true);
});

test("the records still outstanding are handed over, and only while they are", () => {
  const rec = {
    status: "pending",
    ownership_verification: { type: "txt", name: "_cf-custom-hostname.example.com", value: "abc" },
    ssl: { status: "pending_validation", validation_records: [{ txt_name: "_acme-challenge.example.com", txt_value: "xyz" }] },
  };
  const r = readStatus(rec);
  assert.equal(r.pending.length, 2);
  assert.deepEqual(r.pending[0], { kind: "TXT", name: "_cf-custom-hostname.example.com", value: "abc" });
  assert.equal(r.pending[1].value, "xyz");
  // Once it is live there is nothing left for the owner to add, and showing
  // spent records reads as work outstanding.
  assert.equal(readStatus({ ...rec, status: "active", ssl: { status: "active" } }).pending.length, 0);
});

test("readStatus survives anything a provider sends", () => {
  for (const junk of [null, undefined, {}, { ssl: null }, { ssl: "no" }, { ssl: { validation_records: "no" } }, 4, []]) {
    const r = readStatus(junk);
    assert.equal(r.live, false, JSON.stringify(junk));
    assert.ok(Array.isArray(r.pending));
    assert.equal(typeof r.stage, "string");
  }
});

// ------------------------------------------------------------------- wiring

test("the module is a leaf, like site-access and site-errors", () => {
  // It is read by the request path, so an import here is an import on every
  // visitor request to a custom domain.
  const src = fs.readFileSync(new URL("../site-domains.mjs", import.meta.url), "utf8");
  assert.ok(!/^\s*import\s/m.test(src), "no imports");
});

// ------------------------------------------------------------ worker wiring
//
// Searched RAW. Blanking comments in worker.js eats from any `/*` inside a
// string to the next `*/`, which has bitten this repo twice; every pattern
// below carries a `(` or a quote so it cannot match prose.

const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const has = (re, why) => assert.ok(re.test(worker), why);

test("a custom host is resolved BEFORE anything else runs", () => {
  // It rewrites the path, so every branch below it has to see the rewritten
  // one. Placed later, the app would answer first on somebody's own domain.
  const check = worker.indexOf("if (!isOwnHostname(url.hostname)");
  const handler = worker.indexOf("async function handleRequest(request, env, ctx)");
  const firstRoute = worker.indexOf('if (/^\\/demo-hero');
  assert.ok(check > handler && check < firstRoute, "between the handler opening and the first route");
});

test("the hot path is free when the host is ours", () => {
  // This is on EVERY request to the whole platform. `isOwnHostname` is a string
  // comparison against the zone list; anything awaited before it would put a
  // lookup in front of every page load of the app.
  const i = worker.indexOf("if (!isOwnHostname(url.hostname)");
  const window_ = worker.slice(i, i + 700);
  const await_ = window_.indexOf("await siteForHostname");
  const guard = window_.indexOf("isOwnHostname(url.hostname)");
  assert.ok(guard >= 0 && await_ > guard, "the lookup is inside the guard, not before it");
});

test("root-served paths are left alone on a custom domain", () => {
  // A published bundle calls its own API and loads its own uploads same-origin,
  // so on a custom domain those are `theirdomain.com/api/db/<slug>/…` and
  // `theirdomain.com/u/<slug>/<file>`. The route matchers key on the pathname and
  // never the host, so both already work — rewriting either into `/s/<slug>/…`
  // breaks it.
  //
  // THAT REASONING WAS ALWAYS RIGHT AND THE LIST WAS INCOMPLETE. This test named
  // `/api/` literally, its twin in site-zone.test.mjs named it literally too, and
  // both stayed green while `/u/` was excluded from neither — every uploaded
  // image on every pretty hostname 404'd, measured live on
  // forno-and-co.gofarther.app. Asserted through the shared predicate now, so
  // there is one list and one place to add to it.
  const i = worker.indexOf("if (!isOwnHostname(url.hostname)");
  has(/isOwnHostname\(url\.hostname\) && !servedAtRoot\(url\.pathname\)/, "root-served paths are excluded from the rewrite");
  assert.ok(i > 0);
  assert.equal(servedAtRoot("/api/db/x/data/y"), true);
  assert.equal(servedAtRoot("/u/x/y.jpg"), true);
  assert.equal(servedAtRoot("/book"), false, "a real page must still be rewritten to its site");
});

test("an unmapped host is 404, never the app", () => {
  // Serving the Go Farther workspace on a customer's domain is a far more
  // confusing outcome than a plain not-found — and it would leak our sign-in
  // page onto their brand.
  const i = worker.indexOf("const mapped = await siteForHostname(env, url.hostname);");
  assert.ok(i > 0, "the lookup happens");
  const after = worker.slice(i, i + 500);
  assert.ok(/if \(!mapped\) return new Response\("Not found", \{ status: 404 \}\)/.test(after));
});

test("only a LIVE domain serves anything", () => {
  // A half-configured domain has no certificate yet. Serving it would be an
  // error in the browser rather than a page, and it would look like our fault.
  has(/site_domains\?hostname=eq\.\$\{encodeURIComponent\(host\)\}&status=eq\.live/, "the lookup filters on live");
});

test("the hostname lookup never caches a miss", () => {
  // The rule `siteBackendBySlug` already follows. A miss here is almost always
  // a domain whose row is seconds old, and remembering it keeps a brand-new
  // domain dark for the whole TTL at exactly the moment the owner is
  // refreshing to see whether it worked.
  const i = worker.indexOf("async function siteForHostname(");
  assert.ok(i > 0);
  const fn = worker.slice(i, i + 2000);
  assert.ok(/if \(slug\) hostRoutes\.set\(host, slug\)/.test(fn), "only a hit is stored");
  assert.ok(!/hostRoutes\.set\(host, null\)/.test(fn));
});

test("the row is written BEFORE Cloudflare is called", () => {
  // Registered first and recorded second, a lost response leaves a hostname
  // live on our zone that we have no record of and will never clean up — and
  // Cloudflare for SaaS is billed per hostname.
  const ins = worker.indexOf('const ins = await rest("", { method: "POST"');
  const reg = worker.indexOf('const cf = await cfHostname(env, "POST"');
  assert.ok(ins > 0 && reg > 0, "both anchors exist");
  assert.ok(ins < reg, "the row first");
});

test("deleting a domain releases it at Cloudflare first", () => {
  const i = worker.indexOf('request.method === "DELETE" && dm2[2]');
  assert.ok(i > 0);
  const branch = worker.slice(i, i + 1800);
  const cf = branch.indexOf('cfHostname(env, "DELETE"');
  const row = branch.indexOf('method: "DELETE", headers: { Prefer: "return=minimal" }');
  assert.ok(cf > 0 && row > cf, "Cloudflare, then the row");
  // Already-gone is success, or the row can never be cleared.
  assert.ok(/del\.ok \|\| del\.status === 404/.test(branch));
  // And it must be scoped to this site, or one owner removes another's domain.
  assert.ok(/slug=eq\.\$\{encodeURIComponent\(dslug\)\}/.test(branch), "scoped to the site");
});

test("deleting a SITE releases its domains too", () => {
  // Left behind they are hostnames still registered on our zone, billed per
  // hostname, pointing at nothing — and their rows cascade with the ACCOUNT,
  // not the site, so nothing else would ever find them.
  // THE CONDITION IS PART OF THE ASSERTION. Matching the name alone let a
  // mutant wrapping the whole block in `if (0)` survive — the text was still
  // there and the behaviour was gone. Same family as the webhook cache guard,
  // and the reason to anchor on structure rather than on a word.
  // INDENTATION-AGNOSTIC. This pinned six spaces and broke the moment the
  // delete body moved out of the route into `deleteSiteFor` — a guard that
  // fails on a pure re-indent is the byte-window bug wearing whitespace.
  has(/let domainsReleased = 0;\s*\n\s*try \{/, "the release really runs, not behind a condition");
  const i = worker.indexOf("let domainsReleased = 0;");
  assert.ok(i > 0);
  const block = worker.slice(i, i + 1200);
  assert.ok(/cfHostname\(env, "DELETE"/.test(block), "released at Cloudflare");
  assert.ok(/hostRoutes\.delete\(row\.hostname\)/.test(block), "and forgotten locally");
});

test("the API token is never returned to a caller", () => {
  // `cfHostname` keeps Cloudflare's own message because it says useful things
  // like "already registered on another zone" — but an exception message can
  // quote the request, and the request carries the token.
  const i = worker.indexOf("async function cfHostname(");
  const fn = worker.slice(i, i + 2000);
  assert.ok(/String\(\(e && e\.name\) \|\| "error"\)/.test(fn), "the error NAME, never the message");
  assert.ok(!/e\.message/.test(fn), "the message is never surfaced");
});

test("the published bundle learns its own slug from the head", () => {
  // On a custom domain there is no `/s/<slug>/` in the path, so without this
  // every read and every form would address a DIFFERENT site's API.
  const rows = fs.readFileSync(new URL("../builder/lovable/template/src/lib/rows.ts", import.meta.url), "utf8");
  assert.ok(/meta\[name="site-slug"\]/.test(rows), "the client reads it");
  const meta = fs.readFileSync(new URL("../site-meta.mjs", import.meta.url), "utf8");
  assert.ok(/name="site-slug"/.test(meta), "and publish writes it");
  // …and it must survive a site with no brand and no description, or the whole
  // block is skipped and the tag never ships.
  assert.ok(/!title && !desc && !site/.test(meta), "the slug alone is reason enough to emit the block");
  // Anchored on the CALL and read to its closing brace, not on indentation.
  // The first version of this matched `slug,\n    }),` — an exact whitespace
  // shape — and went red the day the publish dep grew a block body, on a change
  // that had nothing to do with the slug. A guard that breaks on reformatting
  // is a guard somebody deletes.
  const call = worker.indexOf("writeSiteDistToR2(env, slug, dist, {");
  assert.ok(call > 0, "the publish call moved — re-point this guard");
  const args = worker.slice(call, worker.indexOf("});", call));
  assert.match(args, /(^|[\s,{])slug\s*,/m, "and the publisher passes it");
});

// ------------------------------------------- where a site is mounted, and why

test("only the workspace serves a site under a path", () => {
  assert.equal(mountRootFor("gofarther.dev", "barbers"), "/s/barbers/");
  assert.equal(mountRootFor("www.gofarther.dev", "barbers"), "/s/barbers/");
  // The site zone and every custom domain serve the site AT the root, so a
  // prefix there would send the browser to `/s/<slug>/assets/…` on a host
  // where that path does not exist.
  assert.equal(mountRootFor("barbers.gofarther.app", "barbers"), "/");
  assert.equal(mountRootFor("sharpfadebarbers.com", "barbers"), "/");
});

test("a relative asset reference becomes absolute, and that is what stops a blank page", () => {
  // MEASURED on a real container build: every ref in a prerendered document is
  // `./assets/…`, because the template sets vite `base: "./"`. A browser
  // resolves that against the DIRECTORY of the URL it was served at.
  const doc = '<script type="module" crossorigin src="./assets/index-BZW04i8N.js"></script>'
    + '<link rel="stylesheet" href="./assets/index-BGXVLV5r.css">'
    + '<link rel="icon" href="./favicon.svg">';

  const root = absolutizeAssets(doc, "/");
  assert.ok(!/="\.\//.test(root), "nothing relative may survive: " + root);
  assert.match(root, /src="\/assets\/index-BZW04i8N\.js"/);
  assert.match(root, /href="\/favicon\.svg"/);

  // Under the workspace mount the prefix has to come with it, or the bundle
  // 404s on the one mount the builder's own preview uses.
  const mounted = absolutizeAssets(doc, "/s/barbers/");
  assert.match(mounted, /src="\/s\/barbers\/assets\/index-BZW04i8N\.js"/);
  assert.match(mounted, /href="\/s\/barbers\/favicon\.svg"/);
});

test("…and it leaves alone everything that is not a relative asset reference", () => {
  // An already-absolute path, an absolute URL, and a protocol-relative one all
  // mean a specific place. Rewriting any of them breaks a working reference —
  // the false-alarm direction, which this repo rates worse than the miss.
  const keep = '<script src="/assets/a.js"></script>'
    + '<link href="https://fonts.example/x.css">'
    + '<img src="//cdn.example/x.png">'
    + '<a href="/book">Book</a>';
  assert.equal(absolutizeAssets(keep, "/s/barbers/"), keep);

  // THE WHITESPACE ANCHOR IS WHY `data-src` SURVIVES, and that is a real
  // attribute rather than a contrived one: it is how every lazy-loading image
  // and half the carousel components on the web hold their real source. Rewrite
  // it and the picture never loads, on a page that looked fine in the markup.
  // `-src` is not `\ssrc`, so the anchor is the whole protection.
  const data = '<img data-src="./assets/hero.jpg" data-href="./x"><div data-srcset="./a.jpg">';
  assert.equal(absolutizeAssets(data, "/s/barbers/"), data);

  // …and the real attribute right beside it is still rewritten, or the guard
  // above would pass just as well with the rewrite switched off entirely.
  assert.match(absolutizeAssets('<img data-src="./a.jpg" src="./b.jpg">', "/s/barbers/"),
    /data-src="\.\/a\.jpg" src="\/s\/barbers\/b\.jpg"/);

  // No mount is the root, not `undefined/assets/…`.
  assert.match(absolutizeAssets('<script src="./a.js">', undefined), /src="\/a\.js"/);
  assert.equal(absolutizeAssets(null, "/"), "");
});
