// THE PUBLIC ADDRESS REACHES THE HEAD — driven, not read.
//
// Run 17 (2026-09-02), the first live rename: fretwork-1 → crookes-guitar.
// The alias rows landed and both addresses answered the right way, and the
// canonical served at the new address still named the old one. Two hops were
// missing at once: the rename lane republished to move the head, and the
// publish spine wrote the sidecar's `origin` FROM THE STORAGE SLUG — so the
// republish would have baked the old address back in anyway, and every later
// colour change would have too. Nothing on the platform consumed
// `publicNameFor`. `test/site-alias.test.mjs` read the chain and certified it,
// which is this repo's "a chain asserted by reading is a chain asserted at the
// layer below the break" trap, word for word.
//
// So these drive `worker.fetch` at the real edit route with stubs on every
// wire, and read the SIDECAR WRITE — the one key the site's own Worker reads
// its head out of — rather than the reply.
import test from "node:test";
import assert from "node:assert/strict";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { siteMetaKey } from "../site-meta.mjs";
import { siteUrlFor, APP_ZONE } from "../site-domains.mjs";
import { RENAME_TOOL } from "../builder/site-alias.mjs";

const USER = { id: "u-public-url-1", email: "owner@example.com" };
const TOKEN = "Bearer some-token";
const PAGES = [{ path: "src/routes/index.tsx", source: "export default function Home(){return null}" }];
const STORED_CSS = ":root{--background:oklch(100% 0 0)}\nfooter{background-color:#000}";
const STORED_LOOK = { brand: "Paperless", theme: "broadsheet" };
// THE ADDRESS, FROM ITS REAL PRODUCER. A hand-typed `https://x.gofarther.app`
// is a second copy of what an address looks like, and the og:url fixture that
// dropped the trailing slash certified `//menu` for a day.
const addressOf = (name) => siteUrlFor(name, "https://" + APP_ZONE);

function bucket(slug) {
  const store = new Map([
    ["source/" + slug + "/pages.json", JSON.stringify(PAGES)],
    [CONFIG_KEY(slug), JSON.stringify({ look: { ...STORED_LOOK }, css: STORED_CSS })],
    // The sidecar as a publish leaves it: the head's publish-time half, with
    // the origin the site was built under.
    [siteMetaKey(slug), JSON.stringify({ description: "A stationer.", image: "", origin: addressOf(slug), routesCsv: "/", redirectsCsv: "", verify: [] })],
  ]);
  const writes = [];
  return {
    store, writes,
    async get(k) { const v = store.get(k); return v === undefined ? null : { text: async () => v, arrayBuffer: async () => new TextEncoder().encode(v).buffer }; },
    async put(k, v) { writes.push([k, String(v)]); store.set(k, String(v)); },
    async delete(k) { store.delete(k); },
    async list() { return { objects: [], truncated: false }; },
  };
}

/**
 * Every wire the edit route reaches, answered in shape. `aliases` is what the
 * alias table says: `current` answers the site's own current-name read, and
 * `fail` makes every alias read a 500 — the cannot-tell case.
 */
function withWire({ answers = {}, current = [], fail = false, former = [] } = {}, run) {
  const real = globalThis.fetch;
  const calls = [];
  const aliasWrites = [];
  const deletes = [];
  globalThis.fetch = async (input, init) => {
    const url = String((input && input.url) || input || "");
    const method = String((init && init.method) || "GET").toUpperCase();
    const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
    if (url.includes("/auth/v1/user")) return json(USER);
    if (url.includes("/rest/v1/site_project")) return json([]);
    // A HEALTHY LEDGER, answering what was asked for: since 2026-09-05 (stage
    // 1a-iii) the synchronous route counts a collect that threw as a refused
    // reservation and the spine stops on it (`unbilled`), so the catch-all
    // 503 below read as a dead ledger and no edit here published. A case about
    // a dead or short ledger stubs its own (test/edit-reserve-refused.test.mjs).
    if (url.includes("/rpc/use_credits")) {
      let want = 0;
      try { want = Number(JSON.parse(String(init && init.body) || "{}").cost) || 0; } catch { want = 0; }
      return json(want);
    }
    // THE WANTED NAME IS FREE; the site's own slug is owned. One stub answering
    // the owner row for every slug would refuse every rename as "taken".
    if (url.includes("/rest/v1/site_backends")) return json(/sunset-shoes/.test(url) ? [] : [{ uid: USER.id, brief: "" }]);
    if (url.includes("/rest/v1/site_aliases")) {
      if (fail) return new Response("boom", { status: 500 });
      if (method === "POST") { try { aliasWrites.push(JSON.parse(String(init.body))); } catch { aliasWrites.push(null); } return json([], 201); }
      // A FORGET'S DELETE hands back what it removed, as PostgREST does: the
      // row when the name is one of the configured old names AND the request
      // asked for a non-current row, nothing otherwise.
      if (method === "DELETE") {
        deletes.push(url);
        const m = /alias=eq\.([^&]+)/.exec(url);
        const a = m ? decodeURIComponent(m[1]) : "";
        return json(former.includes(a) && /current=is\.false/.test(url) ? [{ alias: a, current: false }] : []);
      }
      if (/current=is\.true/.test(url)) return json(current);
      if (/current=is\.false/.test(url)) return json(former.map((a) => ({ alias: a })));
      return json([]);
    }
    if (url.includes("/v1/messages")) {
      let body = {};
      try { body = JSON.parse(String(init && init.body) || "{}"); } catch { body = {}; }
      const tool = body.tool_choice?.name || "";
      calls.push({ tool, body });
      if (!Object.hasOwn(answers, tool)) return new Response("no stub for tool " + tool, { status: 503 });
      return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input: answers[tool] }], usage: { input_tokens: 10, output_tokens: 5 } });
    }
    return new Response("unavailable", { status: 503 });
  };
  return (async () => {
    try { return await run({ calls, aliasWrites, deletes }); } finally { globalThis.fetch = real; }
  })();
}

async function edit(slug, instruction, { store, layer }) {
  const worker = await loadWorker();
  const req = new Request("https://gofarther.dev/api/site/" + slug + "/edit", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: TOKEN },
    body: JSON.stringify({ layer, page: "", remove: false, rename: "", tab: false, instruction, picker: "sonnet" }),
  });
  // WITH A SERVICE KEY, because the alias readers refuse to ask without one:
  // `publicNameFor` answers the slug and `aliasRowFor` answers "cannot tell",
  // which the rename lane rightly reads as "not a free name". Without it these
  // tests drive the platform-without-aliases path and prove nothing about the
  // hop they exist for. The stub answers the wire either way.
  const res = await worker.fetch(req, { SITES_BUCKET: store, ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key", SUPABASE_SERVICE_KEY: "test-service-key" }, makeCtx());
  return { status: res.status, body: await res.json().catch(() => null) };
}

/** The sidecar as the route left it, parsed off the LAST write to its key. */
function sidecarWritten(store, slug) {
  const w = [...store.writes].reverse().find(([k]) => k === siteMetaKey(slug));
  return w ? JSON.parse(w[1]) : null;
}

test("a rename patches the head's origin in R2 and compiles nothing", async () => {
  const slug = "pub-url-rename";
  const c = installCompiler();
  try {
    await withWire({ answers: { [RENAME_TOOL.name]: { name: "Sunset Shoes" } } }, async ({ aliasWrites }) => {
      const store = bucket(slug);
      const { status, body } = await edit(slug, 'Change the site address to "sunset shoes"', { store, layer: "rename" });
      assert.equal(status, 200, "the rename did not go through: " + JSON.stringify(body));
      assert.equal(body && body.layer, "rename", "not the rename lane's reply: " + JSON.stringify(body));
      // THE ADDRESS IS READ OFF `url`, which the route's one-reply builder
      // carries; the branch's own `renamed` is not one of the fields it keeps.
      assert.equal(body.url, addressOf("sunset-shoes"), "the reply's address is not the new one: " + JSON.stringify(body));
      // THE OLD NAME FIRST, THEN THE NEW ONE MADE CURRENT — the recovery story
      // site-alias.test.mjs asserts on the rows, seen here on the wire.
      assert.deepEqual(aliasWrites.map((r) => r && [r.alias, r.current]), [[slug, false], ["sunset-shoes", true]],
        "the alias rows did not land in the old-then-new order: " + JSON.stringify(aliasWrites));
      // THE HEAD FOLLOWED: the sidecar's origin is the new address, and the
      // rest of the sidecar is exactly as the publish left it.
      const side = sidecarWritten(store, slug);
      assert.ok(side, "the rename never wrote the sidecar, so the canonical still names the old address");
      assert.equal(side.origin, addressOf("sunset-shoes"), "the sidecar's origin is not the new address: " + side.origin);
      assert.equal(side.description, "A stationer.", "patching the origin lost the rest of the head");
      assert.equal(body.live, true, "the reply does not say the head is live");
      // AND NOTHING COMPILED. A rename used to republish — a compile a lost
      // lease can leave half-done, for a head one R2 write deploys.
      assert.equal(c.calls.length, 0, "a rename still compiles (" + c.calls.length + " container calls)");
    });
  } finally { c.uninstall(); }
});

test("a site may return to its own storage name, and the head follows it back", async () => {
  // RUN 18 (2026-09-02): the harness asked crookes-guitar back to fretwork-1
  // and the lane answered "That name is already taken by another site" —
  // the storage slug is a site, this one, and the site check did not know
  // whose. The way back is the one rename that can never conflict.
  const slug = "pub-url-back";
  const c = installCompiler();
  try {
    await withWire({ answers: { [RENAME_TOOL.name]: { name: slug } }, current: [{ alias: "sunset-shoes" }] }, async ({ aliasWrites }) => {
      const store = bucket(slug);
      // The sidecar as the rename left it: naming the alias the site is at now.
      store.store.set(siteMetaKey(slug), JSON.stringify({ description: "A stationer.", image: "", origin: addressOf("sunset-shoes"), routesCsv: "/", redirectsCsv: "", verify: [] }));
      const { status, body } = await edit(slug, `Change the site address back to "${slug}"`, { store, layer: "rename" });
      assert.equal(status, 200, "the way back to the storage name was refused: " + JSON.stringify(body));
      assert.equal(body && body.url, addressOf(slug), "the reply's address is not the storage name: " + JSON.stringify(body));
      assert.deepEqual(aliasWrites.map((r) => r && [r.alias, r.current]), [["sunset-shoes", false], [slug, true]],
        "the rows did not demote the alias and promote the storage name: " + JSON.stringify(aliasWrites));
      const side = sidecarWritten(store, slug);
      assert.ok(side, "the way back never wrote the sidecar");
      assert.equal(side.origin, addressOf(slug), "the head did not follow the site back: " + side.origin);
      assert.equal(c.calls.length, 0, "the way back compiled");
    });
  } finally { c.uninstall(); }
});

// ── FORGETTING AN OLD ADDRESS (owner, 2026-09-02: "i want that") ──────────

test("forgetting an old address deletes its row, scoped to this site, and compiles nothing", async () => {
  const slug = "pub-url-forget";
  const c = installCompiler();
  try {
    await withWire({ answers: { [RENAME_TOOL.name]: { forget: "sunset-shoes" } }, current: [], former: ["sunset-shoes"] }, async ({ calls, deletes, aliasWrites }) => {
      const store = bucket(slug);
      const { status, body } = await edit(slug, 'Forget the old address "sunset-shoes"', { store, layer: "rename" });
      assert.equal(status, 200, "the forget did not go through: " + JSON.stringify(body));
      assert.equal(body && body.ok, true, JSON.stringify(body));
      assert.match(String(body.msg || ""), /no longer answers/, "the reply does not say the address stopped: " + JSON.stringify(body));
      assert.match(String(body.msg || ""), /Anyone can claim/, "the reply does not say the name is free");
      // ONE DELETE, SCOPED THREE WAYS: the name, this site, not current.
      assert.equal(deletes.length, 1, "expected exactly one delete: " + JSON.stringify(deletes));
      assert.match(deletes[0], /alias=eq\.sunset-shoes/);
      assert.match(deletes[0], new RegExp("slug=eq\\." + slug));
      assert.match(deletes[0], /current=is\.false/);
      assert.equal(aliasWrites.length, 0, "a forget wrote alias rows");
      // The head names the current address and must not move; nothing compiles.
      assert.equal(sidecarWritten(store, slug), null, "a forget rewrote the head");
      assert.equal(c.calls.length, 0, "a forget compiled");
      // The model was shown the old name it could forget.
      const sent = JSON.stringify(calls.find((x) => x.tool === RENAME_TOOL.name).body.messages);
      assert.ok(sent.includes("sunset-shoes"), "the model was not shown the site's old names");
    });
  } finally { c.uninstall(); }
});

test("forgetting the CURRENT address is refused by name, and a stranger by the empty delete", async () => {
  for (const [slug, forget, former, current, sentence, expectDeletes] of [
    ["pub-url-forget-live", "sunset-shoes", ["pub-url-forget-live"], [{ alias: "sunset-shoes" }], /answers at now/, 0],
    ["pub-url-forget-stranger", "someone-else", ["sunset-shoes"], [], /not one of this site's old addresses/, 1],
  ]) {
    await withWire({ answers: { [RENAME_TOOL.name]: { forget } }, current, former }, async ({ deletes }) => {
      const store = bucket(slug);
      const { status, body } = await edit(slug, `Forget the old address "${forget}"`, { store, layer: "rename" });
      assert.equal(status, 422, slug + ": expected a refusal: " + JSON.stringify(body));
      assert.match(String(body && body.msg), sentence, slug + ": the wrong sentence: " + JSON.stringify(body));
      assert.equal(deletes.length, expectDeletes, slug + ": deletes " + JSON.stringify(deletes));
    });
  }
});

test("a new address in the same answer wins over a forget", async () => {
  const slug = "pub-url-forget-both";
  const c = installCompiler();
  try {
    await withWire({ answers: { [RENAME_TOOL.name]: { name: "Sunset Shoes", forget: slug } }, current: [], former: [] }, async ({ deletes, aliasWrites }) => {
      const store = bucket(slug);
      const { body } = await edit(slug, "rename it to sunset shoes and drop the old one", { store, layer: "rename" });
      assert.equal(body && body.ok, true, JSON.stringify(body));
      assert.equal(deletes.length, 0, "a forget ran beside a rename");
      assert.equal(aliasWrites.length, 2, "the rename did not write its rows");
    });
  } finally { c.uninstall(); }
});

test("every later publish keeps the new address: the spine asks the alias table", async () => {
  // A site renamed to sunset-shoes, then a colour change: the sidecar the
  // publish rewrites whole must carry the NEW address, or the first edit after
  // a rename puts the old canonical straight back. This is the hop run 17
  // found missing.
  const c = installCompiler();
  try {
    await withWire(
      { answers: { pick_lanes: { fields: ["css"] }, edit_site: { css: "footer{color:#fff}" } }, current: [{ alias: "sunset-shoes" }] },
      async () => {
        const slug = "pub-url-renamed";
        const store = bucket(slug);
        const { body } = await edit(slug, "make the footer text white", { store, layer: "look" });
        assert.equal(body && body.ok, true, "the edit did not go through: " + JSON.stringify(body));
        assert.ok(c.calls.length >= 1, "the edit never compiled, so nothing below is a publish");
        const side = sidecarWritten(store, slug);
        assert.ok(side, "the publish never wrote the sidecar");
        assert.equal(side.origin, addressOf("sunset-shoes"),
          "a publish after a rename baked the STORAGE slug back into the canonical: " + side.origin);
      },
    );
  } finally { c.uninstall(); }
});

test("a site that was never renamed publishes under its slug, and so does one whose alias cannot be read", async () => {
  // THE SLUG IS THE HONEST FALLBACK: no alias row means the site IS addressed
  // by its slug, and a row we could not read is one we cannot say a new name
  // for. Both answer the slug; neither answers nothing, and neither throws.
  for (const [slug, opts] of [["pub-url-plain", { current: [] }], ["pub-url-blind", { fail: true }]]) {
    const c = installCompiler();
    try {
      await withWire({ answers: { pick_lanes: { fields: ["css"] }, edit_site: { css: "footer{color:#fff}" } }, ...opts }, async () => {
        const store = bucket(slug);
        const { body } = await edit(slug, "make the footer text white", { store, layer: "look" });
        assert.equal(body && body.ok, true, slug + ": the edit did not go through: " + JSON.stringify(body));
        const side = sidecarWritten(store, slug);
        assert.ok(side, slug + ": the publish never wrote the sidecar");
        assert.equal(side.origin, addressOf(slug), slug + ": the origin is not the site's own address: " + side.origin);
      });
    } finally { c.uninstall(); }
  }
});
