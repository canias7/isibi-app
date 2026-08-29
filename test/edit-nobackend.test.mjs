// THE CHEAP LANES REALLY RUN FOR A SITE WITH NO DATABASE — driven, not read.
//
// The `look` and `logo` lanes each opened with `if (!xdb) return
// escalate("no-backend")`, and a first build has provisioned no database since
// the frontend-first change — so that refused MOST sites on the platform and
// sent every colour change and every logo swap up to the full page rewrite.
// Measured live on `shoeroom-1`: "make the footer black" cost 17 credits on a
// rung meant to cost under one, and the logo rung is meant to cost nothing.
//
// WHY DRIVEN AND NOT READ. `test/site-apply.test.mjs` holds the same property by
// scanning the edit block, and a scan is the weaker evidence twice over: it is
// satisfied by a refusal that moved three lines away, and — because the fix's
// own comments quote the refusal they removed — it can be satisfied by PROSE.
// This file answers the question the customer actually has: a site with no
// database asks for a colour change; does the cheap lane serve it?
//
// WHAT IT DELIBERATELY DOES NOT DO: reach a model. The design call is the step
// AFTER the gate, so letting it fail is what proves the gate was passed — the
// lane gets far enough to need a model and says so. `ANTHROPIC_API_KEY` is set
// (an unset one escalates as `unconfigured` long before the gate) and every
// outbound call that is not GoTrue or Supabase is refused, so nothing here can
// spend a credit or reach the network.

import test from "node:test";
import assert from "node:assert/strict";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { CONFIG_KEY } from "../site-config.mjs";

// A SLUG PER CASE, and this is not tidiness. `siteBackendBySlug` is memoized on
// the slug for five minutes, so a shared name lets the FIRST case's answer serve
// every later one: the "with a database" control below silently read the
// databaseless result and became a copy of the test it exists to check. Caught
// by restoring the gate and watching that control fail for the wrong reason.
const USER = { id: "u-nobackend-1", email: "owner@example.com" };
const TOKEN = "Bearer some-token";

// A REAL STORED SITE, in the shapes its own producers write: the source under
// `source/<slug>/pages.json`, the look and the stylesheet under the key
// `CONFIG_KEY` names — imported rather than typed, so a rename cannot leave this
// fixture describing a site the code would read as never having had a look.
const PAGES = [{ path: "src/routes/index.tsx", source: "export default function Home(){return null}" }];
const STORED_CSS = ':root{--background:oklch(100% 0 0)}\nfooter{background-color:#000}';

function bucket(slug) {
  const store = new Map([
    ["source/" + slug + "/pages.json", JSON.stringify(PAGES)],
    [CONFIG_KEY(slug), JSON.stringify({ look: { brand: "Paperless" }, css: STORED_CSS })],
  ]);
  return {
    store,
    async get(k) { const v = store.get(k); return v === undefined ? null : { text: async () => v }; },
    async put(k, v) { store.set(k, String(v)); },
    async delete(k) { store.delete(k); },
    async list() { return { objects: [], truncated: false }; },
  };
}

/**
 * THE SITE EXISTS, IS THEIRS, AND EITHER HAS A DATABASE OR DOES NOT.
 *
 * THE SHAPES ARE THE REAL ONES, and the first draft's were not. It answered
 * `site_backends` with `{ uid, conn }`, which reads plausibly and is a column
 * this platform does not have: `siteBackendRowFresh` selects `neon_db,uid,brief`
 * and resolves the connection in a SECOND read of `site_project`, joining
 * `neon_conn` to `neon_db`. So the invented row always produced `conn: null` and
 * the "with a database" control was a databaseless run wearing a label — a
 * fixture the pipeline never produces, which is this repo's own recorded trap,
 * walked into inside the test written to avoid it. It was caught only by
 * restoring the gate and reading WHY the control failed.
 *
 * `hasDb: false` therefore means `neon_db` absent, which is exactly what a
 * frontend-only site's row looks like.
 */
async function withSite(run, { hasDb = false } = {}) {
  const real = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (input, init) => {
    const url = String((input && input.url) || input || "");
    seen.push(url);
    if (url.includes("/auth/v1/user")) {
      return new Response(JSON.stringify(USER), { status: 200, headers: { "content-type": "application/json" } });
    }
    // THE PROJECT READ COMES FIRST in this chain of ifs because both URLs
    // contain `/rest/v1/`, and `site_project` is the more specific match.
    if (url.includes("/rest/v1/site_project")) {
      return new Response(JSON.stringify(hasDb
        ? [{ uid: USER.id, neon_project: "proj-1", neon_branch: "br-1", neon_role: "owner", neon_conn: "postgres://u:p@ep.neon.tech/neondb" }]
        : []), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("/rest/v1/site_backends")) {
      return new Response(JSON.stringify([{ uid: USER.id, brief: "", ...(hasDb ? { neon_db: "sitedb" } : {}) }]),
        { status: 200, headers: { "content-type": "application/json" } });
    }
    // EVERYTHING ELSE REFUSED, including the model. A stub that answered every
    // call would let the lane wander past the thing under test.
    return new Response("unavailable", { status: 503 });
  };
  try { return await run(seen); } finally { globalThis.fetch = real; }
}

async function edit(slug, layer, instruction, { store = null } = {}) {
  const worker = await loadWorker();
  const req = new Request(`https://gofarther.dev/api/site/${slug}/edit`, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: TOKEN },
    body: JSON.stringify({ layer, page: "", remove: false, rename: "", tab: false, instruction }),
  });
  const res = await worker.fetch(req, {
    SITES_BUCKET: store || bucket(slug),
    // SET, because an absent key escalates as `unconfigured` BEFORE the gate —
    // which would make this test pass while proving nothing about it.
    ANTHROPIC_API_KEY: "test-key-not-used",
  }, makeCtx());
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

test("a look edit on a site with NO database is not refused for having none", async () => {
  await withSite(async () => {
    const { body } = await edit("paperless-look", "look", "make the footer dark green");
    assert.ok(body, "the lane answered nothing at all");
    // ASSERTED POSITIVELY, because every negative here would also be satisfied
    // by the lane falling over somewhere earlier. `error: "design"` is the model
    // call — the step immediately AFTER the gate — so reaching it is proof the
    // gate was passed, the stored config was read, and the thin-look check let
    // it through. The design call then fails only because this env has no model
    // key, which is what keeps the test free.
    assert.equal(body.error, "design",
      "the look lane did not reach its model call on a databaseless site — it stopped somewhere before: "
        + JSON.stringify(body));
    // And neither refusal is what came back — including the one the gate turns
    // into when the `_meta` read is left unguarded, which is the same refusal
    // renamed and would make the whole fix measure as nothing.
    assert.notEqual(body.reason, "no-backend", "the look lane still refuses a databaseless site");
    assert.notEqual(body.reason, "no-meta", "the refusal came back renamed as no-meta");
  });
});

test("…and the logo lane, the rung that is supposed to be free, is not refused either", async () => {
  await withSite(async () => {
    const { body } = await edit("paperless-logo", "logo", "use this as our logo");
    assert.ok(body, "the lane answered nothing at all");
    // POSITIVE AGAIN: `error: "none"` is the lane telling the customer to attach
    // a picture, which is the correct answer to this request — no image was
    // sent. Reaching that reply means it read the site and got to its own
    // logic, which is everything past the gate.
    assert.equal(body.error, "none",
      "the logo lane did not reach its attachment check on a databaseless site: " + JSON.stringify(body));
    assert.notEqual(body.reason, "no-backend",
      "the logo lane still refuses a databaseless site — a free rung turned into a ~17-credit rewrite");
  });
});

test("the lanes that really do query a database still require one", async () => {
  // THE OTHER DIRECTION, so the fix is bounded rather than a blanket relaxation.
  // `data` reads rows and `rules` enforces them in Postgres: neither can do its
  // job without a connection, and escalating is the right answer for both.
  await withSite(async () => {
    for (const layer of ["data", "rules"]) {
      const { body } = await edit("paperless-" + layer, layer, "put the prices up by ten percent");
      assert.ok(body, layer + " answered nothing at all");
      assert.equal(body.reason, "no-backend",
        layer + " stopped requiring the database it actually queries");
    }
  });
});

test("the proof is not vacuous: the same lane still refuses a site with no stored look", async () => {
  // A POSITIVE ASSERTION NEEDS A CONTROL TOO. Every check above says the lane
  // reached a late step; none of them shows the lane can still STOP. If some
  // fixture mistake made every request answer `design`, they would all pass.
  //
  // So: the same lane, the same databaseless site, with the stored config
  // emptied — which must escalate `no-look`, because a site with neither a look
  // nor a stylesheet genuinely has nothing for this rung to edit. That is the
  // check the gate used to make unreachable, and it proves two things at once:
  // the lane still discriminates, and `design` above was earned rather than
  // returned to everything.
  //
  // THE "WITH A DATABASE" CONTROL THIS REPLACES COULD NOT WORK HERE, and that is
  // worth recording: given a real connection the lane queries `_meta` over the
  // network, so in a unit environment it always fails at the schema read and
  // escalates `no-meta`. It measured the absence of Postgres, not the fix.
  await withSite(async () => {
    const bare = bucket("paperless-bare");
    bare.store.set(CONFIG_KEY("paperless-bare"), JSON.stringify({}));
    const { body } = await edit("paperless-bare", "look", "make the footer dark green", { store: bare });
    assert.ok(body, "the lane answered nothing at all");
    assert.equal(body.reason, "no-look",
      "a site with no look and no stylesheet was not refused — the lane answers the same thing to everything: "
        + JSON.stringify(body));
  });
});
