// THE SSRF GUARD IS A LOOP, AND THE LOOP WAS COVERED BY NOTHING.
//
// `hostIsBlocked` is well tested against lists of blocked and allowed hosts. The
// property that makes `safeFetch` actually safe is different and lives one level
// up: it is re-checked on EVERY redirect hop, so a perfectly public URL cannot
// 302 onto 169.254.169.254, onto a private address, or onto an internal name.
//
// The only guard on that was `assert.match(worker, /hostIsBlocked\(/)` in
// site-webhooks.test.mjs — which any single call site satisfies. A refactor that
// validated only the FIRST hop would pass the entire suite, and that is not a
// hypothetical shape: the 2026-08-08 audit confirmed exactly it in `callApi`
// ("making the SSRF guard a check on the first hop only").
//
// DRIVEN, NOT READ, with the global fetch replaced — the redirect is chosen by
// whoever owns a page a customer pasted, so what matters is which addresses we
// END UP requesting, and only running it can answer that.
//
// ── WHAT THE SUBJECT IS NOW, AND WHY IT CHANGED (2026-09-12) ────────────────
//
// It used to drive `POST /api/import/fetch` — the gallery importer, the most
// attacker-chosen URL on the platform — and that route left with the media
// side. There is no longer ANY route whose body is a URL we then fetch, so the
// vehicle is gone and the property is not: `safeFetch` still has two live
// callers, and both take a URL a customer typed.
//
//   · `siteReadUrl`, the "read this page" link out of a build brief. It is
//     reached from `readLinkedPages` on the build path rather than from a route
//     of its own, so it is EVALUATED out of worker.js here — the pattern
//     `test/lane-stream.test.mjs` uses on `quickSend`, for the same reason: a
//     source read certifies the layer below the break, and this file's whole
//     argument is that only running it answers the question.
//   · the outbound webhook (`site-webhooks.mjs`), whose URL is typed by a site
//     owner and pointed wherever they like. Its own suite reads that it calls
//     `safeFetch`; the loop's behaviour is what this file proves, once, for
//     both of them.
//
// EVALUATED RATHER THAN IMPORTED, because worker.js exports none of this. Every
// free identifier in the lifted sources has to be supplied, so a name that
// moves fails here loudly instead of being stubbed into silence — and
// `hostIsBlocked` is handed in as the REAL module's, never a stand-in: a
// gentler copy would make all nine of these pass over a guard that blocks
// nothing.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { hostIsBlocked, resolvesBlocked } from "../site-ssrf.mjs";

const ROOT = path.join(import.meta.dirname, "..");
const WORKER = fs.readFileSync(path.join(ROOT, "worker.js"), "utf8");

/**
 * One top-level declaration's source, bounded by the next one.
 *
 * Never by a byte count and never by a named neighbour: this repo has been
 * outrun by both, and by a `slice(start, -1)` that swallowed the rest of the
 * file when its closing landmark was deleted — which is exactly what happened
 * to the guard in `rebuild-job.test.mjs` on the same day this file moved.
 */
// `export default` IS ONE OF THE BOUNDARIES, and leaving it out cost a run.
// worker.js declares its handler object at line ~1234, thousands of lines above
// the router it calls, so `readCapped` — which sits just before it — swallowed
// the whole `export default { fetch, scheduled, queue }` block and the lifted
// source failed to parse with "Unexpected token 'export'". A boundary list is a
// hand-typed list and this is the entry it is missing by default.
const BOUNDARY = /\n(?:\/\*\*|export default|(?:export )?(?:async )?(?:function|class|const|let) )/;

function lift(decl) {
  const from = WORKER.indexOf(decl);
  assert.ok(from >= 0, decl + " is gone from worker.js — this driver has nothing to run");
  const after = WORKER.slice(from + 1);
  const next = after.match(BOUNDARY);
  const src = WORKER[from] + (next ? after.slice(0, next.index) : after);
  // BOUNDED AT THE LIFT, not only in the self-test at the bottom: a runaway
  // window throws inside `new Function` at module load, which reports as "test
  // failed" with no case name and no assertion. Failing here names the piece.
  assert.ok(src.length < 4000,
    `${decl} lifted ${src.length} characters — its window ran past its own declaration`);
  return src;
}

// The chain, in dependency order. `siteReadUrl` → `safeFetch` → `hostIsBlocked`
// (handed in), plus the two values each reads.
const SRC = [
  lift('const CHROME_UA = "Mozilla/5.0'),
  lift("async function safeFetch(startUrl, opts = {}, max = 4) {"),
  lift("async function readCapped(resp, maxBytes) {"),
  lift("const SITE_LINK_BYTES = "),
  lift("async function siteReadUrl(url) {"),
].join("\n");

const { siteReadUrl } = new Function("hostIsBlocked", "resolvesBlocked", SRC + "\nreturn { siteReadUrl, safeFetch };")(hostIsBlocked, resolvesBlocked);

/**
 * Replace the global fetch and RECORD every URL asked for.
 *
 * The recording is the assertion. "It refused" is satisfied by a guard that
 * refuses everything, and equally by one that fetched the metadata address and
 * merely disliked the answer; "169.254.169.254 was never requested" is not.
 */
async function withFetch(handler, run) {
  const real = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : (input && input.url) || String(input);
    seen.push(url);
    return handler(url, init);
  };
  try { return { out: await run(), seen }; } finally { globalThis.fetch = real; }
}

const read = (url) => siteReadUrl(url);

// EVERY RECORDED CALL IS THE CUSTOMER'S URL NOW. Through the route there were
// two of our own first (the session check and the quota RPC) and this filtered
// them out; driving the reader directly there are none, so the filter is kept
// only as a wall against a future hop being added inside the chain and read as
// an extra redirect.
const outbound = (seen) => seen.filter((u) => !u.includes("/auth/v1/user") && !u.includes("/rpc/"));

// The addresses that matter, one per class the guard names.
const INTERNAL = [
  ["cloud metadata", "http://169.254.169.254/latest/meta-data/iam/security-credentials/"],
  ["loopback", "http://127.0.0.1:8787/admin"],
  ["RFC1918", "http://10.0.0.5/internal"],
  ["CGNAT", "http://100.64.0.1/"],
  ["an internal name", "http://localhost:5432/"],
];

for (const [what, target] of INTERNAL) {
  test(`a public URL cannot redirect onto ${what}`, async () => {
    const { out, seen } = await withFetch(
      async (url) => {
        if (url.startsWith("https://example.com/")) {
          return new Response(null, { status: 302, headers: { location: target } });
        }
        // Reaching here IS the bug. Answering plausibly rather than throwing
        // makes the failure show up as the assertion below rather than as a
        // network error that could be mistaken for the harness.
        return new Response("SECRET", { status: 200, headers: { "content-type": "text/html" } });
      },
      () => read("https://example.com/photo"),
    );
    const asked = outbound(seen);
    assert.ok(!asked.some((u) => u.includes(new URL(target).hostname)),
      `the redirect target was actually requested: ${JSON.stringify(asked)}`);
    assert.equal(asked.length, 1, `more than the first hop was fetched: ${JSON.stringify(asked)}`);
    // `safeFetch` answers null for a blocked host, and the reader turns that
    // into `ok: false` WITH NO STATUS — deliberately, so a prober cannot tell
    // which hosts we refuse from which we simply could not reach.
    assert.equal(out.ok, false, "a refused redirect must not read as a page we read");
    assert.equal(out.status, undefined, "a refusal must not carry a status — that tells a prober what we block");
  });
}

test("a redirect to another PUBLIC host IS followed", async () => {
  // WITHOUT THIS THE FIVE ABOVE PROVE NOTHING. A `safeFetch` that refused every
  // redirect, or that failed to make any request at all, passes all of them —
  // and would silently break the ordinary case, which is a CDN or a shortener
  // bouncing a URL one hop.
  const { out, seen } = await withFetch(
    async (url) => {
      if (url.startsWith("https://example.com/")) {
        return new Response(null, { status: 302, headers: { location: "https://cdn.example.org/real.html" } });
      }
      return new Response("<h1>Brackwell Joinery</h1>", { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
    },
    () => read("https://example.com/photo"),
  );
  const asked = outbound(seen);
  assert.equal(asked.length, 2, `the redirect was not followed: ${JSON.stringify(asked)}`);
  assert.ok(asked[1].includes("cdn.example.org"), `the second hop went somewhere else: ${asked[1]}`);
  assert.equal(out.ok, true, JSON.stringify(out).slice(0, 200));
  assert.match(out.body || "", /Brackwell Joinery/, "the page was reached but its bytes were not read");
});

test("a redirect CHAIN is checked at every hop, not just the first and last", async () => {
  // The shape a first-hop-only check gets wrong in the most natural way: two
  // innocent public hops and then the internal address, which is what an
  // attacker with a page on a real domain would actually write.
  const chain = {
    "https://example.com/a": "https://example.org/b",
    "https://example.org/b": "https://example.net/c",
    "https://example.net/c": "http://169.254.169.254/latest/meta-data/",
  };
  const { out, seen } = await withFetch(
    async (url) => {
      if (chain[url]) return new Response(null, { status: 302, headers: { location: chain[url] } });
      return new Response("SECRET", { status: 200, headers: { "content-type": "text/html" } });
    },
    () => read("https://example.com/a"),
  );
  const asked = outbound(seen);
  assert.ok(!asked.some((u) => u.includes("169.254")), `the chain reached metadata: ${JSON.stringify(asked)}`);
  assert.equal(asked.length, 3, `wrong number of hops before the refusal: ${JSON.stringify(asked)}`);
  assert.equal(out.ok, false);
});

test("a redirect loop is bounded rather than followed forever", async () => {
  // Not an SSRF property, but the same loop, and the failure is a Worker pinned
  // on somebody else's redirect until it is killed.
  const { out, seen } = await withFetch(
    async () => new Response(null, { status: 302, headers: { location: "https://example.com/round" } }),
    () => read("https://example.com/round"),
  );
  assert.ok(outbound(seen).length <= 6, `unbounded: ${outbound(seen).length} hops`);
  assert.equal(out.ok, false);
});

test("the target itself is refused, not only a redirect onto it", async () => {
  // The first hop was always checked; this is the half that WAS covered, kept so
  // a change that moves the check into the loop cannot drop it from the entry.
  const { out, seen } = await withFetch(
    async () => new Response("SECRET", { status: 200, headers: { "content-type": "text/html" } }),
    () => read("http://169.254.169.254/latest/meta-data/"),
  );
  assert.deepEqual(outbound(seen), [], "the metadata address was requested directly");
  assert.equal(out.ok, false);
});

test("the driver really is worker.js's own reader, and its guard is the real one", () => {
  // A SELF-TEST, because this file's subject is now lifted source rather than a
  // route, and a lift that quietly went wrong would make all nine cases pass
  // over something that is not the product. Two halves:
  //
  // the LIFT reached the real chain — every piece named, and each bounded to
  // its own declaration rather than running on to the next…
  assert.match(SRC, /async function safeFetch\(/);
  assert.match(SRC, /async function siteReadUrl\(/);
  assert.match(SRC, /hostIsBlocked\(u\.hostname\)/, "safeFetch no longer asks the SSRF guard about the host it is about to fetch");
  assert.ok(SRC.length > 1500 && SRC.length < 12000, `the lifted chain is ${SRC.length} characters — a bound has slipped`);
  assert.ok(!/async function siteReadUrl[\s\S]*async function /.test(SRC.slice(SRC.indexOf("async function siteReadUrl"))),
    "the last lift ran on past its own declaration");

  // …and the guard handed in is the module's, proved by asking it rather than
  // by trusting the import: a stand-in that blocked nothing is the one way
  // every case above passes for the wrong reason.
  assert.equal(hostIsBlocked("169.254.169.254"), true);
  assert.equal(hostIsBlocked("cdn.example.org"), false);
});

// ── WHERE THE NAME GOES (2026-10-23, audit A16-5) ───────────────────────────
//
// Inside the container a fetch resolves the name itself, so a public-looking
// name that resolves to loopback reached the build service next door. The
// container installs `__SITE_RESOLVE_HOST`; driven here with a stand-in.
async function withResolver(map, run) {
  const had = Object.hasOwn(globalThis, "__SITE_RESOLVE_HOST");
  globalThis.__SITE_RESOLVE_HOST = async (h) => { if (!Object.hasOwn(map, h)) throw new Error("ENOTFOUND"); return map[h]; };
  try { return await run(); } finally { if (!had) delete globalThis.__SITE_RESOLVE_HOST; }
}
const PAGE = async () => new Response("<p>hello</p>", { status: 200, headers: { "content-type": "text/html" } });

test("A16-5: a name that resolves to a blocked address is never fetched, on the first hop or a redirect", async () => {
  const map = { "127.0.0.1.nip.io": ["127.0.0.1"], "meta.example.net": ["93.184.216.34", "169.254.169.254"], "example.com": ["93.184.216.34"], "bench.example.net": ["198.18.0.5"] };
  for (const target of ["http://127.0.0.1.nip.io:8080/egress", "http://meta.example.net/", "http://bench.example.net/", "http://nowhere.example/"]) {
    const { out, seen } = await withResolver(map, () => withFetch(PAGE, () => read(target)));
    assert.deepEqual(outbound(seen), [], target + " was fetched");
    assert.equal(out.ok, false);
  }
  const hop = await withResolver(map, () => withFetch(async (url) => url.startsWith("https://example.com/")
    ? new Response(null, { status: 302, headers: { location: "http://127.0.0.1.nip.io:8080/model/result?id=x" } }) : PAGE(), () => read("https://example.com/a")));
  assert.deepEqual(outbound(hop.seen), ["https://example.com/a"], "a redirect onto a name resolving to loopback was followed");
  // A public name resolving to public addresses is read as before.
  const ok = await withResolver(map, () => withFetch(PAGE, () => read("https://example.com/b")));
  assert.deepEqual(outbound(ok.seen), ["https://example.com/b"]);
  assert.equal(ok.out.ok, true);
});

test("A16-5: resolvesBlocked — cannot tell is blocked, no resolver is the Worker's string check alone, the special-use ranges are blocked", async () => {
  assert.equal(await resolvesBlocked("example.com", undefined), false);
  assert.equal(await resolvesBlocked("example.com", async () => ["93.184.216.34"]), false);
  assert.equal(await resolvesBlocked("example.com", async () => []), true);
  assert.equal(await resolvesBlocked("example.com", async () => { throw new Error("x"); }), true);
  assert.equal(await resolvesBlocked("example.com", async () => ["::1"]), true);
  for (const ip of ["192.0.0.8", "198.18.0.1", "198.19.255.255", "224.0.0.1", "239.1.1.1", "240.0.0.1", "255.255.255.255"]) assert.equal(hostIsBlocked(ip), true, ip);
  for (const ip of ["192.0.2.1", "198.17.0.1", "198.20.0.1", "223.255.255.1", "8.8.8.8"]) assert.equal(hostIsBlocked(ip), false, ip);
});
