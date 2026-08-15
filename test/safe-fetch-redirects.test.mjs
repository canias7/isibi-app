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
// DRIVEN, NOT READ, through a real route with the global fetch replaced — the
// redirect is chosen by whoever owns a page a customer pasted, so what matters
// is which addresses we END UP requesting, and only running it can answer that.
import test from "node:test";
import assert from "node:assert/strict";
import { hit } from "./fixtures/worker-harness.mjs";

// `/api/import/fetch` is the gallery importer: authenticated, quota'd, and its
// whole body is a URL the customer typed. The most attacker-chosen URL on the
// platform, and the reason `siteReadUrl` was pointed at this same helper rather
// than given a second, gentler copy.
const ROUTE = "/api/import/fetch";
const AUTHED = { Authorization: "Bearer t", "content-type": "application/json" };

/**
 * Replace the global fetch and RECORD every URL asked for.
 *
 * The recording is the assertion. "It answered 502" is satisfied by a guard that
 * refuses everything, and equally by one that fetched the metadata address and
 * merely disliked the answer; "169.254.169.254 was never requested" is not.
 */
async function withFetch(handler, run) {
  const real = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : (input && input.url) || String(input);
    seen.push(url);
    // The two calls the route makes before it ever looks at the customer's URL.
    if (url.includes("/auth/v1/user")) {
      return new Response(JSON.stringify({ id: "u1", email: "a@b.c" }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("/rpc/use_quota")) {
      return new Response("true", { status: 200, headers: { "content-type": "application/json" } });
    }
    return handler(url, init);
  };
  try { return { out: await run(), seen }; } finally { globalThis.fetch = real; }
}

const post = (url) => hit(ROUTE, { method: "POST", headers: AUTHED, body: JSON.stringify({ url }) });

/** Everything the customer's URL caused us to request, ignoring our own calls. */
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
        return new Response("SECRET", { status: 200, headers: { "content-type": "image/png" } });
      },
      () => post("https://example.com/photo"),
    );
    const asked = outbound(seen);
    assert.ok(!asked.some((u) => u.includes(new URL(target).hostname)),
      `the redirect target was actually requested: ${JSON.stringify(asked)}`);
    assert.equal(asked.length, 1, `more than the first hop was fetched: ${JSON.stringify(asked)}`);
    assert.equal(out.status, 502, "a refused redirect should read as unreachable");
  });
}

test("a redirect to another PUBLIC host IS followed", async () => {
  // WITHOUT THIS THE FIVE ABOVE PROVE NOTHING. A `safeFetch` that refused every
  // redirect, or that failed to make any request at all, passes all of them —
  // and would silently break the ordinary case, which is a CDN or a shortener
  // bouncing an image URL one hop.
  const { out, seen } = await withFetch(
    async (url) => {
      if (url.startsWith("https://example.com/")) {
        return new Response(null, { status: 302, headers: { location: "https://cdn.example.org/real.png" } });
      }
      // A one-pixel PNG: the route sniffs the bytes, so the magic number has to
      // be real or this passes for the wrong reason.
      const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
      return new Response(png, { status: 200, headers: { "content-type": "image/png" } });
    },
    () => post("https://example.com/photo"),
  );
  const asked = outbound(seen);
  assert.equal(asked.length, 2, `the redirect was not followed: ${JSON.stringify(asked)}`);
  assert.ok(asked[1].includes("cdn.example.org"), `the second hop went somewhere else: ${asked[1]}`);
  assert.equal(out.status, 200, out.text.slice(0, 200));
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
      return new Response("SECRET", { status: 200, headers: { "content-type": "image/png" } });
    },
    () => post("https://example.com/a"),
  );
  const asked = outbound(seen);
  assert.ok(!asked.some((u) => u.includes("169.254")), `the chain reached metadata: ${JSON.stringify(asked)}`);
  assert.equal(asked.length, 3, `wrong number of hops before the refusal: ${JSON.stringify(asked)}`);
  assert.equal(out.status, 502);
});

test("a redirect loop is bounded rather than followed forever", async () => {
  // Not an SSRF property, but the same loop, and the failure is a Worker pinned
  // on somebody else's redirect until it is killed.
  const { out, seen } = await withFetch(
    async () => new Response(null, { status: 302, headers: { location: "https://example.com/round" } }),
    () => post("https://example.com/round"),
  );
  assert.ok(outbound(seen).length <= 6, `unbounded: ${outbound(seen).length} hops`);
  assert.equal(out.status, 502);
});

test("the target itself is refused, not only a redirect onto it", async () => {
  // The first hop was always checked; this is the half that WAS covered, kept so
  // a change that moves the check into the loop cannot drop it from the entry.
  const { out, seen } = await withFetch(
    async () => new Response("SECRET", { status: 200, headers: { "content-type": "image/png" } }),
    () => post("http://169.254.169.254/latest/meta-data/"),
  );
  assert.deepEqual(outbound(seen), [], "the metadata address was requested directly");
  assert.equal(out.status, 502);
});
