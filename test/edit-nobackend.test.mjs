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
import fs from "node:fs";
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

/**
 * THE SAME SITE, WITH THE MODEL ANSWERING — so the lane runs past its own gate
 * and reaches the PUBLISH SPINE, which is where the second copy of this bug
 * lived and where the tests above cannot see.
 *
 * Everything above lets the design call fail on a missing key, which proves the
 * lane's gate is gone and stops one step too early to notice that
 * `recompileAndPublish` refused the same site for the same reason. That gap is
 * why the fix was reported as complete when the ladder was still shut: two live
 * edits on `shoeroom-1` died in the spine after the lane gates were removed.
 *
 * A MINIMAL, HONEST TOOL ANSWER: one `tool_use` block carrying only `css`, which
 * is what a colour change really returns — every other field omitted, which is
 * the edit contract's own "absent means unchanged".
 *
 * ── AND IT ANSWERS THE TOOL IT WAS ACTUALLY ASKED FOR (2026-08-29) ──────────
 *
 * The edit path is two calls now — `pick_lanes` names which part of the site
 * the message is about, then `edit_site` changes it — and this stub answered
 * BOTH with a `design_schema` block carrying `css`. The router read that for a
 * `fields` array, found none, and every case here escalated `no-lane`: a stub
 * more capable in one direction and useless in another, which is precisely the
 * fixture-in-a-different-shape trap this file already carries a paragraph about.
 *
 * So the branch is on `tool_choice.name` off the REQUEST — the real producer —
 * rather than on a guess about call order. Order is what changed underneath it
 * once already.
 */
async function withModel(run, { hasDb = false, owned = true } = {}) {
  const real = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (input, init) => {
    const url = String((input && input.url) || input || "");
    seen.push(url);
    if (url.includes("/auth/v1/user")) {
      return new Response(JSON.stringify(USER), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("/rest/v1/site_project")) {
      return new Response(JSON.stringify([]), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("/rest/v1/site_backends")) {
      // `owned:false` is a slug NOBODY owns — the deleted-site case the refusal
      // genuinely exists for, and the control that keeps the fix bounded.
      return new Response(JSON.stringify(owned ? [{ uid: USER.id, brief: "", ...(hasDb ? { neon_db: "sitedb" } : {}) }] : []),
        { status: 200, headers: { "content-type": "application/json" } });
    }
    // BOTH PROVIDERS, SINCE 2026-08-31. The small calls route on the model now
    // (`callBuilderModel`) and the default picker is Grok, so a stub that
    // answered only Anthropic's endpoint made every lane fail at the send and
    // look broken — which is exactly what it did when the change landed. The
    // shapes differ, so each endpoint is answered in its OWN shape rather than
    // one being pushed through the other.
    const anthropic = url.includes("/v1/messages");
    const xai = url.includes("/v1/chat/completions");
    if (anthropic || xai) {
      // WHICH TOOL WAS ASKED FOR, read off the request rather than assumed —
      // and the two providers spell that differently.
      const asked = (() => {
        try {
          const b = JSON.parse(String(init && init.body) || "{}");
          return b.tool_choice?.name || b.tool_choice?.function?.name || "";
        } catch { return ""; }
      })();
      const input = asked === "pick_lanes"
        ? { fields: ["css"] }
        : { css: "footer{background-color:#0b3d2e}" };
      const body = anthropic
        ? { stop_reason: "tool_use",
            content: [{ type: "tool_use", name: asked || "edit_site", input }],
            usage: { input_tokens: 10, output_tokens: 5 } }
        : { choices: [{ message: { content: "", tool_calls: [{ id: "c1", function: { name: asked || "edit_site", arguments: JSON.stringify(input) } }] }, finish_reason: "stop" }],
            usage: { prompt_tokens: 10, completion_tokens: 5 } };
      return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response("unavailable", { status: 503 });
  };
  try { return await run(seen); } finally { globalThis.fetch = real; }
}

/** The spine's existence check — `select=uid&limit=1`, which ONLY it issues. */
const askedIfSiteExists = (seen) => seen.some((u) => u.includes("select=uid") && u.includes("limit=1"));

async function edit(slug, layer, instruction, { store = null, picker = "", keys = null } = {}) {
  const worker = await loadWorker();
  const req = new Request(`https://gofarther.dev/api/site/${slug}/edit`, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: TOKEN },
    body: JSON.stringify({ layer, page: "", remove: false, rename: "", tab: false, instruction, ...(picker ? { picker } : {}) }),
  });
  const res = await worker.fetch(req, {
    SITES_BUCKET: store || bucket(slug),
    // BOTH SET BY DEFAULT, because an absent key escalates as `unconfigured`
    // BEFORE the gate — which would make these tests pass while proving nothing
    // about them. `keys` overrides for the two cases that are ABOUT the gate.
    ...(keys || { ANTHROPIC_API_KEY: "test-key-not-used", XAI_API_KEY: "test-key-not-used" }),
  }, makeCtx());
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

/**
 * THE SAME SITE, WITH THE MODEL CALL TIMING OUT — the failure run 95 spent a
 * live edit on and could not name.
 *
 * `AbortSignal.timeout` rejects with a DOMException named `TimeoutError`, so
 * that NAME is the whole signal: there is no HTTP response, `status` is
 * undefined, and `upstreamKind` has nothing to read. Thrown here rather than
 * simulated with a slow response, because what is under test is how the route
 * reads the throw — and a real 60-second wait is not something a test may buy.
 *
 * NAMED, NOT MESSAGED. `isCallTimeout` asks `e.name` precisely because the
 * message differs between workerd and Node; a fixture that matched on the
 * message would certify a check that cannot fire in production.
 */
async function withTimingOutModel(run) {
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String((input && input.url) || input || "");
    if (url.includes("/auth/v1/user")) {
      return new Response(JSON.stringify(USER), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("/rest/v1/site_project")) {
      return new Response(JSON.stringify([]), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("/rest/v1/site_backends")) {
      return new Response(JSON.stringify([{ uid: USER.id, brief: "" }]), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("/v1/messages") || url.includes("/v1/chat/completions")) {
      throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    }
    return new Response("unavailable", { status: 503 });
  };
  try { return await run(); } finally { globalThis.fetch = real; }
}

test("a look edit on a site with NO database is not refused for having none", async () => {
  await withSite(async () => {
    const { body } = await edit("paperless-look", "look", "make the footer dark green");
    assert.ok(body, "the lane answered nothing at all");
    // ASSERTED POSITIVELY, because every negative here would also be satisfied
    // by the lane falling over somewhere earlier. `error: "send"` is the MODEL
    // CALL — the step immediately AFTER the gate — so reaching it is proof the
    // gate was passed, the stored config was read, and the thin-look check let
    // it through. The call then fails only because this env has no model key,
    // which is what keeps the test free.
    //
    // IT WAS `"design"` UNTIL 2026-08-29 and the rename is the change itself:
    // the step after the gate is no longer the BUILD's designer but the edit
    // path's own router, which reports through `modelDown` like every other
    // cheap lane. The property — "it got as far as needing a model" — is
    // unchanged; only which model call it is has moved.
    assert.equal(body.error, "send",
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
  // THE MODEL HAS TO ANSWER FOR THIS ONE, since 2026-08-29. `pick_lanes` is the
  // front door and runs BEFORE any layer's own gates — it has to, because which
  // layer runs is what it decides — so on the model-less `withSite` stub this
  // case now dies at the router with `error: "send"` and never reaches the
  // check it exists to make. `withModel` answers the router, which lets the
  // look lane run far enough to refuse for its own reason.
  //
  // THE ORDERING CHANGE IS A REAL ONE AND IT IS AN IMPROVEMENT: a message about
  // a PHOTOGRAPH on a site with no stored look used to be refused `no-look` by
  // a lane that was never going to handle it. It is now dispatched to the
  // `picture` layer, which does not need a look at all.
  await withModel(async (seen) => {
    const bare = bucket("paperless-bare");
    bare.store.set(CONFIG_KEY("paperless-bare"), JSON.stringify({}));
    const { body } = await edit("paperless-bare", "look", "make the footer dark green", { store: bare });
    // ── THE SEND GOES TO THE PROVIDER THE MODEL BELONGS TO (2026-08-31) ──────
    //
    // THE BUG THIS CATCHES COST RUN 94, and it is the wiring trap in its purest
    // form. Every classifier and rung was moved onto the picked model — and the
    // sender was still `anthropicMessages`, which posts to api.anthropic.com
    // unconditionally. So `model: "grok-4.6"` was addressed to Anthropic, which
    // answered the same billing refusal as before and made a correct fix look
    // like it had done nothing. The model name moved; the door did not.
    //
    // Asserted on the URLs the stub actually saw, because that is the one place
    // the mistake is visible: every static read of the code looked right.
    const model = seen.filter((u) => u.includes("/v1/messages") || u.includes("/v1/chat/completions"));
    assert.ok(model.length > 0, "no model call was made at all — this assertion is watching nothing");
    for (const u of model) {
      assert.ok(u.includes("/v1/chat/completions"),
        "a small call on the default (Grok) picker went to " + u + " — the model routes by provider, the sender did not");
    }
    assert.ok(body, "the lane answered nothing at all");
    assert.equal(body.reason, "no-look",
      "a site with no look and no stylesheet was not refused — the lane answers the same thing to everything: "
        + JSON.stringify(body));
  });
});

/* ── the PUBLISH SPINE, one layer below the lanes ─────────────────────────── */

test("the publish spine serves a databaseless site too — the layer the lane tests cannot see", async () => {
  // `recompileAndPublish` carried its own `if (!db) return refuse`, and every
  // publishing lane goes through it, so removing the lanes' gates only moved
  // the refusal one level down. This drives the lane far enough to reach it.
  //
  // THE DISCRIMINATOR IS THE EXISTENCE LOOKUP, not the outer error: the lane
  // relabels every publish failure as `compile`, so a spine refusal and a real
  // container failure answer identically from outside — the very thing that
  // made this bug take two live runs to find. `select=uid&limit=1` is issued by
  // nothing but the spine's new check, and it runs only when there is no
  // connection, so seeing it means execution got past the old refusal.
  await withModel(async (seen) => {
    const { body } = await edit("spine-nodb", "look", "make the footer dark green", { picker: "sonnet" });

    // THE BEHAVIOUR, NOT THE QUESTION. Asserting only that the existence lookup
    // HAPPENED is satisfied by a spine that asks and then does the opposite with
    // the answer: a mutation sweep inverted the condition — refusing exactly the
    // sites this fix exists to serve — and that assertion passed, because the
    // lookup sits inside the condition either way. What must be true is that the
    // request got THROUGH.
    //
    // `detail` says so in its own words. Past the gate the spine runs on to the
    // container, which a routing test does not have, and the failure names
    // itself: "this request reached a real build". A spine that refused would
    // answer the read-refusal instead, and `ours: true` would route the message
    // to "our build service was restarting" — the sentence the live runs got.
    assert.match(String(body && body.detail || ""), /reached a real build/,
      "the spine did not get past its own gate — a databaseless site still cannot publish: "
        + JSON.stringify(body));
    assert.doesNotMatch(String(body && body.msg || ""), /build service was restarting/,
      "the spine answered its own refusal, wearing the message that cost two live runs to see through");

    // And the question really was asked — kept as the secondary check, since the
    // primary above proves what was done with the answer.
    assert.ok(askedIfSiteExists(seen),
      "the spine never asked whether the site exists, so it is guessing rather than checking");
  });
});

test("…and a slug nobody owns never reaches the spine at all", async () => {
  // THE BOUND, asserted where it actually lives. Relaxing the connection check
  // must not let a deleted site publish stripped of its theme and archive that
  // as a success — the failure the original guard was written against.
  //
  // On THIS path that protection is upstream and older: the route's ownership
  // check answers 404 "no such site" before a lane runs, so the spine is never
  // asked. Which means the connection test it used to make was protecting
  // nothing here — the edit path was already covered, and the check only cost
  // the 20 databaseless sites their whole edit ladder.
  //
  // The spine's own existence check still earns its place for the OTHER caller:
  // the platform `rebuild` path takes slugs from `site_rebuilds` and verifies no
  // ownership, so there it is the only thing standing between a vanished site
  // and a stripped publish. Asserted here as the property that matters — this
  // request is refused and no publish is attempted.
  await withModel(async (seen) => {
    const { status, body } = await edit("spine-orphan", "look", "make the footer dark green", { picker: "sonnet" });
    assert.equal(status, 404, "an unowned slug was not refused: " + JSON.stringify(body));
    assert.ok(!askedIfSiteExists(seen),
      "the request reached the publish spine despite the site being unowned — the ownership check above it is gone");
  }, { owned: false });
});

/* ── the two "our fault" failures must stay tellable apart ────────────────── */

test("a read-refusal and a killed container do not wear the same sentence", async () => {
  // FOUR CAUSES, ONE SENTENCE was what made this bug take two live runs. The
  // spine refused a databaseless site, the lane relabelled it `compile`, and
  // `compileMsg` answered "our build service was restarting" — so the diagnosis
  // went to container churn and the next change was a settle delay that fixed
  // nothing, because nothing had restarted.
  //
  // DRIVEN THROUGH THE REAL FUNCTION, not read: the module is loaded and
  // `compileMsg` is exercised with the two shapes the spine actually returns, so
  // this holds the BEHAVIOUR rather than the presence of a branch.
  const { loadWorkerModule } = await import("./fixtures/worker-harness.mjs");
  const mod = await loadWorkerModule();
  const compileMsg = mod.compileMsg || mod.default?.compileMsg;
  if (typeof compileMsg !== "function") {
    // Not exported — hold the property on the source instead, and say so rather
    // than passing quietly, which would be a guard that tests nothing.
    const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
    const i = src.indexOf("function compileMsg(");
    assert.ok(i > 0, "compileMsg is gone");
    const body = src.slice(i, src.indexOf("\n}", i));
    assert.match(body, /pub\.error === "read"/,
      "compileMsg no longer splits a read-refusal from a compile failure — they answer identically again");
    assert.match(body, /couldn't read your site's saved design/,
      "the read-refusal has no sentence of its own");
    assert.match(body, /build service was restarting/,
      "the container-restart sentence is gone, so a real restart now reports as something else");
    return;
  }
  const read = compileMsg({ ours: true, error: "read" }, "theirs");
  const compile = compileMsg({ ours: true, error: "compile" }, "theirs");
  assert.notEqual(read, compile,
    "a read-refusal and a killed container answer identically — the failure cannot name itself");
  assert.match(compile, /restarting/, "the container failure lost its own sentence");
  assert.doesNotMatch(read, /restarting/, "a read-refusal still claims the build service restarted");
  assert.equal(compileMsg({ ours: false, error: "compile" }, "theirs"), "theirs",
    "a failure that is NOT ours stopped deferring to the lane's own wording");
});

// ── OUR OWN CEILING MUST NOT WEAR THE PROVIDER'S COSTUME (run 95) ───────────
//
// The sibling above splits a read-refusal from a killed container. This is the
// same rule one door over, and run 95 is what it cost to learn: `pick_lanes`
// was cut off by `QUICK_CALL_MS` — a bound of OURS — and the customer was told
// "The editor is busy — try again in a moment," which blames the model and
// sends them back into the identical wait. `isCallTimeout` had existed for the
// build path the whole time; the edit path's `modelDown` never asked it.

test("a timeout on OUR ceiling is reported as ours, not as the model being busy", async () => {
  await withTimingOutModel(async () => {
    const { body } = await edit("paperless-timeout", "look", "make the header button forest green");
    assert.ok(body, "the lane answered nothing at all");
    assert.equal(body.error, "send", "the lane did not reach its model call: " + JSON.stringify(body));

    // THE FACT, on the wire, in a field a reader cannot miss.
    assert.equal(body.timeout, true,
      "a timeout on our own ceiling is not marked as ours: " + JSON.stringify(body));
    assert.ok(Number(body.waitedMs) > 0,
      "the response does not say how long we waited, so the ceiling cannot be told from a hang");

    // AND IT IS NOT MISREPORTED AS THE PROVIDER'S. A timeout carries no HTTP
    // response, so anything claiming a provider status here is invented.
    assert.equal(body.upstream, null,
      "a timeout is reporting an upstream status it cannot have had: " + JSON.stringify(body));
    assert.notEqual(body.billing, true, "a timeout is being reported as a billing refusal");

    // AND THE SENTENCE. Not "busy", which is the model; not "try again in a
    // moment", which is an invitation back into the same 60 seconds.
    assert.doesNotMatch(String(body.msg), /busy/i,
      "our ceiling still tells the customer the model is busy: " + body.msg);
    assert.doesNotMatch(String(body.msg), /try again in a moment/i,
      "our ceiling still sends the customer straight back into the same wait: " + body.msg);
  });
});

test("…and the proof is not vacuous: a real provider refusal is still NOT marked as our timeout", async () => {
  // THE CONTROL. Without it, `timeout: true` on every failure would pass the
  // test above — a flag that is always set says nothing. `withSite` answers the
  // model 503, which is a provider's own answer and must read as one.
  await withSite(async () => {
    const { body } = await edit("paperless-503", "look", "make the header button forest green");
    assert.equal(body.error, "send", "the lane did not reach its model call: " + JSON.stringify(body));
    assert.notEqual(body.timeout, true,
      "a 503 from the provider is being reported as our own ceiling: " + JSON.stringify(body));
    assert.equal(body.waitedMs, undefined,
      "a provider refusal carries a wait time it never waited");
  });
});

// ── THE GATE ASKS ABOUT THE KEY THE PICKED MODEL NEEDS ──────────────────────
//
// Both edit routes opened with `if (!env.ANTHROPIC_API_KEY)`, which was the
// same fact as "we can call a model" only while every small call was Anthropic's.
// Left as it was, it refuses a Grok customer whose platform is fine and — the
// direction that actually bites — waves through an account whose xAI key is the
// missing one, into a send that throws.

test("a Grok edit is not refused for a missing ANTHROPIC key it never needed", async () => {
  await withSite(async () => {
    const { body } = await edit("paperless-xai", "look", "make the header button forest green", {
      picker: "grok",
      keys: { XAI_API_KEY: "test-key-not-used" },
    });
    assert.ok(body, "the lane answered nothing at all");
    // POSITIVE: reaching the model call is proof the gate was passed. The send
    // then fails on the stub's 503, which is what keeps this free.
    assert.equal(body.error, "send",
      "a Grok edit was refused before its model call with only the xAI key set: " + JSON.stringify(body));
    assert.notEqual(body.reason, "unconfigured",
      "the gate still refuses a Grok customer for the key their path never touches");
  });
});

test("…and the direction that bites: a Grok edit with ONLY the Anthropic key set is refused up front", async () => {
  await withSite(async () => {
    const { body } = await edit("paperless-noxai", "look", "make the header button forest green", {
      picker: "grok",
      keys: { ANTHROPIC_API_KEY: "test-key-not-used" },
    });
    assert.ok(body, "the lane answered nothing at all");
    // The refusal has to happen HERE, before the send — a key we forgot to set
    // is a deploy to fix, and letting it through turns it into a throw that
    // reads like the provider refused us.
    assert.equal(body.reason, "unconfigured",
      "a Grok edit with no xAI key was allowed through to the send: " + JSON.stringify(body));
    assert.equal(body.escalate, true, "the refusal is not the escalate shape every other gate uses");
  });
});

test("…and it reads the CUSTOMER'S picker, not the default one", async () => {
  // BOTH CASES ABOVE DRIVE `grok`, WHICH IS ALSO `DEFAULT_PICKER` — so
  // `modelsFor(eb.picker)` and `modelsFor()` are the same object for them, and a
  // gate that ignored the body entirely would pass both. The sweep proved it:
  // replacing the customer's picker with the default SURVIVED. This repo's own
  // recorded trap, and the third time in one session that an assertion anchored
  // on the default picker was checked against a fixture driving the default.
  //
  // `sonnet` is a NON-default picker, so the two readings genuinely differ here.
  await withSite(async () => {
    const { body } = await edit("paperless-sonnet", "look", "make the header button forest green", {
      picker: "sonnet",
      keys: { XAI_API_KEY: "test-key-not-used" },
    });
    assert.ok(body, "the lane answered nothing at all");
    assert.equal(body.reason, "unconfigured",
      "a Sonnet customer with only an xAI key set was allowed through to the send — the gate is reading " +
      "the default picker rather than theirs: " + JSON.stringify(body));
  });

  // AND THE OTHER DIRECTION, so this is not satisfied by a gate that simply
  // refuses every non-default picker.
  await withSite(async () => {
    const { body } = await edit("paperless-sonnet-ok", "look", "make the header button forest green", {
      picker: "sonnet",
      keys: { ANTHROPIC_API_KEY: "test-key-not-used" },
    });
    assert.equal(body.error, "send",
      "a Sonnet customer with the Anthropic key set was refused before their model call: " + JSON.stringify(body));
  });
});

// ── THE SITE'S OWN CSS REACHES THE LANE THAT EDITS CSS (run 96) ─────────────
//
// Owner, 2026-08-31: "you need to show the whole css of the site… the css step
// in the edit css path need to be able to edit everything possible that contains
// css, and im pretty sure that the theme code has css inside, otherwise it
// wouldnt be a theme."
//
// DRIVEN, AND IT HAS TO BE. This is the wiring class — a value computed,
// forwarded and delivered to the wrong hop — which has shipped twelve-plus
// features dead in this repo, twice in this session alone. Reading worker.js for
// `themeNote(` proves the call site exists; only driving the route and opening
// the request proves the bytes arrive.
//
// THE EXPECTATION IS DERIVED FROM THE REAL PRODUCER. `themeCss` is the only
// thing that renders a theme, so the assertion asks IT what the site wears
// rather than carrying a hand-typed copy of a token — the fixture-in-a-different
// -shape trap, which in this repo has already certified a wrong `og:url` for a
// day by comparing a value against a constant assembled the same wrong way.
const THEMED = "broadsheet";

function themedBucket(slug) {
  const store = new Map([
    ["source/" + slug + "/pages.json", JSON.stringify(PAGES)],
    [CONFIG_KEY(slug), JSON.stringify({ look: { brand: "Paperless", theme: THEMED }, css: "" })],
  ]);
  return {
    store,
    async get(k) { const v = store.get(k); return v === undefined ? null : { text: async () => v }; },
    async put(k, v) { store.set(k, String(v)); },
    async delete(k) { store.delete(k); },
    async list() { return { objects: [], truncated: false }; },
  };
}

/** Every model request the route made, with its body — which `withModel` does not keep. */
async function withBodies(run, { fields = ["css"], answer = { css: "header a{color:red}" } } = {}) {
  const real = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init) => {
    const url = String((input && input.url) || input || "");
    if (url.includes("/auth/v1/user")) {
      return new Response(JSON.stringify(USER), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("/rest/v1/site_project")) {
      return new Response(JSON.stringify([]), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("/rest/v1/site_backends")) {
      return new Response(JSON.stringify([{ uid: USER.id, brief: "" }]), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("/v1/messages") || url.includes("/v1/chat/completions")) {
      let body = {};
      try { body = JSON.parse(String(init && init.body) || "{}"); } catch {}
      const asked = body.tool_choice?.name || body.tool_choice?.function?.name || "";
      calls.push({ url, asked, body });
      const input = asked === "pick_lanes" ? { fields } : answer;
      const anthropic = url.includes("/v1/messages");
      return new Response(JSON.stringify(anthropic
        ? { stop_reason: "tool_use", content: [{ type: "tool_use", name: asked || "edit_site", input }], usage: { input_tokens: 10, output_tokens: 5 } }
        : { choices: [{ message: { content: "", tool_calls: [{ id: "c1", function: { name: asked || "edit_site", arguments: JSON.stringify(input) } }] }, finish_reason: "stop" }], usage: { prompt_tokens: 10, completion_tokens: 5 } }),
        { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response("unavailable", { status: 503 });
  };
  try { return await run(calls); } finally { globalThis.fetch = real; }
}

/** The text of a captured request, whichever provider shape it went out in. */
const bodyText = (c) => JSON.stringify(c.body);

test("the css lane is shown the site's THEME css, not just the free-css layer", async () => {
  const { themeCss } = await import("../builder/site-theme.mjs");
  const { resolveTheme } = await import("../builder/site-theme-registry.mjs");
  const theme = resolveTheme(THEMED);
  assert.ok(theme, "the fixture names a theme the registry does not have");
  const sheet = themeCss(theme);
  // A REAL DECLARATION OUT OF THAT SHEET, so the assertion cannot pass on a
  // token name this test invented. Long enough to be unmistakable.
  const decl = (sheet.match(/--background:\s*[^;]+;/) || [])[0];
  assert.ok(decl && decl.length > 20, "could not derive a token declaration from the rendered theme");

  await withBodies(async (calls) => {
    await edit("themed-1", "look", "make the header link a deep forest green", { store: themedBucket("themed-1") });
    const lane = calls.find((c) => c.asked === "edit_site");
    assert.ok(lane, "the css lane never ran: " + JSON.stringify(calls.map((c) => c.asked)));
    const text = bodyText(lane);
    assert.ok(text.includes(decl),
      "the lane's request does not carry the site's own theme CSS — it is still being shown the free-CSS " +
      "layer alone, which on a site like this one is empty: " + decl);
  });
});

test("…and it is told not to copy that block back, which is what stops the theme being frozen", async () => {
  // THE LOAD-BEARING HALF. The lane's answer REPLACES the stored free-CSS layer,
  // so a model that returns the theme with one line changed writes a copy of the
  // theme into a layer that outranks it and no longer follows it — a later theme
  // change would then apply to nothing. Worse than ignoring the edit.
  await withBodies(async (calls) => {
    await edit("themed-2", "look", "make the header link a deep forest green", { store: themedBucket("themed-2") });
    const lane = calls.find((c) => c.asked === "edit_site");
    const text = bodyText(lane);
    assert.match(text, /Do not copy it back/,
      "the theme block is shown with no instruction against returning it");
    assert.match(text, /written LAST/,
      "the note does not say the answer wins, so an override reads as pointless");
  });
});

test("…and no OTHER lane is handed a stylesheet it has no use for", async () => {
  // BOUNDED, so this is a change to ONE lane rather than a stylesheet stapled to
  // every edit on the platform. `brand` edits a short string; a theme in front of
  // it is per-call bytes bought for nothing, on a call whose prefix is cached.
  await withBodies(async (calls) => {
    await edit("themed-3", "look", "call us Paperless Press from now on", { store: themedBucket("themed-3") });
    const lane = calls.find((c) => c.asked === "edit_site");
    assert.ok(lane, "the brand lane never ran: " + JSON.stringify(calls.map((c) => c.asked)));
    assert.doesNotMatch(bodyText(lane), /THE SITE.S CURRENT STYLING/,
      "the brand lane is being handed the site's stylesheet, which it has no use for");
  }, { fields: ["brand"], answer: { brand: "Paperless Press" } });
});

test("themeNote itself: the heading is there, the ceiling holds, and a non-string is refused", async () => {
  const { themeNote, MAX_THEME_NOTE } = await import("../builder/site-lanes.mjs");

  // THE POSITIVE COUNTERPART to the `doesNotMatch` above, and the sweep is what
  // asked for it: deleting the heading survived, because a test that only ever
  // asserts a string is ABSENT is satisfied by that string never existing. This
  // repo's "a negative assertion must prove its observer is alive", found inside
  // the guard written to bound the change.
  const note = themeNote(":root{--primary:oklch(0.5 0.14 30)}");
  assert.match(note, /THE SITE'S CURRENT STYLING/,
    "the note lost the heading that tells the model what the block IS");
  assert.match(note, /ON THE PAGE right now/,
    "the note no longer says these rules are live, so they read as a draft to improve");
  assert.ok(note.includes(":root{--primary:oklch(0.5 0.14 30)}"),
    "the note does not actually contain the stylesheet it was given");

  // A NON-STRING IS REFUSED, NEVER COERCED. `String(["a{}"])` is `"a{}"` — a
  // perfectly good stylesheet assembled out of a shape mistake — and this repo
  // has shipped that exact coercion as a real bug three times.
  assert.equal(themeNote(["a{}"]), "", "an array was coerced into a stylesheet");
  assert.equal(themeNote(null), "", "null produced a note");
  assert.equal(themeNote(""), "", "an empty sheet produced a note");
  assert.equal(themeNote("   "), "", "whitespace produced a note");

  // AND THE CEILING CUTS AT A RULE BOUNDARY, so the tail is never half a
  // declaration the model then tries to finish. Built from real rules rather
  // than a run of one character, because the boundary is what is under test.
  const big = ":root{--a:1}\n".repeat(4000);
  assert.ok(big.length > MAX_THEME_NOTE, "the fixture is not large enough to reach the ceiling");
  const cut = themeNote(big);
  assert.ok(cut.includes("/* … */"), "an over-long sheet was not marked as cut");
  const body = cut.slice(cut.indexOf("\n") + 1, cut.indexOf("/* … */"));
  assert.ok(body.trimEnd().endsWith("}"), "the sheet was cut mid-rule: " + JSON.stringify(body.slice(-40)));
});

// ── THE LANDMARK MAP REACHES THE LANE, AND A DEAD RULE IS CORRECTED ─────────
//
// Owner, 2026-08-31: a general element-targeting system, plus zero-match
// validation that does not publish until the selector is corrected.
//
// DRIVEN, for the reason every guard in this file is: reading worker.js for
// `landmarkNote(` proves a call site exists. Only opening the request proves the
// rows arrive, and only driving the publish proves a dead rule stops it.

const MARKS = [
  { name: "header-button", selector: '[data-slot="site-link"]', tag: "a", section: "header",
    role: "button", text: "Get your first lesson free", href: "tel:+441144960123", route: "/" },
  { name: "cta-band-button", selector: '[data-slot="cta-band"] [data-slot="button"]', tag: "a",
    section: "cta-band", role: "button", text: "Get your first lesson free", route: "/" },
];

function markedBucket(slug) {
  const store = new Map([
    ["source/" + slug + "/pages.json", JSON.stringify(PAGES)],
    ["source/" + slug + "/landmarks.json", JSON.stringify({ at: "now", slug, marks: MARKS })],
    [CONFIG_KEY(slug), JSON.stringify({ look: { brand: "Paperless", theme: THEMED }, css: "" })],
  ]);
  return {
    store,
    async get(k) { const v = store.get(k); return v === undefined ? null : { text: async () => v }; },
    async put(k, v) { store.set(k, String(v)); },
    async delete(k) { store.delete(k); },
    async list() { return { objects: [], truncated: false }; },
  };
}

test("the css lane is handed the page's real elements, with a selector for each", async () => {
  await withBodies(async (calls) => {
    await edit("marked-1", "look", "make the button in the header forest green", { store: markedBucket("marked-1") });
    const lane = calls.find((c) => c.asked === "edit_site");
    assert.ok(lane, "the css lane never ran: " + JSON.stringify(calls.map((c) => c.asked)));
    const text = bodyText(lane);
    // THE SELECTOR COLUMN IS THE LOAD-BEARING ONE — the whole point is that the
    // model is handed something that already works rather than asked to invent
    // one. Asserted through JSON.stringify's escaping, which is how it really
    // rides on the wire.
    assert.ok(text.includes('[data-slot=\\"site-link\\"]'),
      "the header control's verified selector is not in the request: " + text.slice(0, 400));
    assert.match(text, /header-button/, "the landmark's stable name is missing");
    assert.match(text, /cta-band-button/, "the other control is missing, so nothing disambiguates them");
    // AND THE RULE THAT MAKES IT USABLE. Without this the map is a table the
    // model may read past — runs 96 and 98 both wrote `header button` unprompted.
    assert.match(text, /not a `<button>`|is usually not a `<button>`/,
      "nothing tells the model that what a customer calls a button may not be one");
  });
});

test("…and a site with no stored map is served exactly as before", async () => {
  // THE 47 LIVE SITES. None has been published since this shipped, so none has a
  // map; the lane must behave as it did rather than refusing or sending an empty
  // table that reads as "this page has no elements".
  await withBodies(async (calls) => {
    await edit("themed-4", "look", "make the header link forest green", { store: themedBucket("themed-4") });
    const lane = calls.find((c) => c.asked === "edit_site");
    assert.ok(lane, "the lane never ran without a map");
    assert.doesNotMatch(bodyText(lane), /WHAT IS ACTUALLY ON THEIR PAGE/,
      "a site with no landmarks was sent an empty map, which reads as a page with no elements");
  });
});

test("a rule matching nothing does NOT publish — it is corrected first, once", async () => {
  const { landmarkNote } = await import("../builder/site-lanes.mjs");
  assert.ok(landmarkNote(MARKS).includes('[data-slot="site-link"]'), "the note builder dropped the selector");

  // THE SPINE'S OWN CONTRACT, driven with literals: `verifyCss` on plus a dead
  // selector must answer WITHOUT publishing, and must carry both the dead list
  // and the map the correction round needs.
  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = src.indexOf("async function recompileAndPublish(");
  assert.ok(at > 0, "the publish spine is gone");
  const body = src.slice(at, src.indexOf("\nasync function", at + 10));
  const gate = body.indexOf('error: "dead-css"');
  const publish = body.indexOf("writeSiteDistToR2(");
  assert.ok(gate > 0, "the spine no longer withholds a publish for a dead selector");
  assert.ok(publish > 0, "the publish itself is gone");
  // ORDER IS THE WHOLE PROPERTY: refusing AFTER the write would mean the
  // customer had already seen the dead version. Both anchors proved present
  // above, so this is not the vacuous `-1 < anything` comparison.
  assert.ok(gate < publish,
    "the dead-selector gate now sits AFTER the publish, so a dead rule ships and the correction is a second publish over it");
  // AND IT IS OPT-IN, or every text fix buys a second build to check a
  // stylesheet nobody touched.
  assert.match(body, /verifyCss/, "the gate is no longer opt-in");
});

test("a timeout says WHICH call ran out, not just that one did", async () => {
  // RUN 99 IS WHY. Its log said a call had exceeded our ceiling and could not
  // say whether that was the lane picker or the lane itself — two calls, one
  // sentence, and a different next move for each, so the diagnosis was an
  // inference again. That is the "failure that cannot name itself" trap landing
  // on the diagnostic written to close the previous instance of it.
  //
  // AND THE SWEEP IS WHY THIS TEST EXISTS: deleting the naming, and deleting the
  // field that carries it to the wire, both SURVIVED. A diagnostic with no test
  // is a diagnostic that quietly stops working the first time somebody edits
  // near it — which is exactly how run 99 came to need it.
  await withTimingOutModel(async () => {
    const { body } = await edit("named-timeout", "look", "make the header button forest green");
    assert.equal(body.error, "send", "the lane did not reach its model call: " + JSON.stringify(body));
    assert.equal(body.timeout, true, "the timeout is no longer marked as ours");
    assert.ok(body.call, "the response does not say which call timed out: " + JSON.stringify(body));
    // THE FIRST CALL A `look` EDIT MAKES is the lane picker, so that is the one
    // a timeout here must name. Asserted as the real value rather than "some
    // truthy string", or a sender that named every call `"lane"` would pass.
    assert.equal(body.call, "pick_lanes",
      "the timeout named `" + body.call + "`, but the first call a look edit makes is the lane picker");
  });
});

test("the lane's own rule never promises a table that may not be sent", async () => {
  // RUN 100, AND IT COST 2 CREDITS FOR NOTHING. The rule said "AIM BY THE
  // LANDMARK TABLE… it lists the page's real elements" — in the CACHED TOOL
  // DESCRIPTION, so it went out on every css edit. The table itself rides in the
  // per-call note and is only present when the site has a stored map.
  // `fretwork-1` had none, so the model was told to aim by a table it was never
  // given. It answered nothing, published nothing, and billed: `ok=true`,
  // `moved: []`, 39.9s with no build at all.
  //
  // THE FIX IS STRUCTURAL, NOT WORDING. The instruction to use the table now
  // lives IN the table's own note, so it exists exactly when the table does; the
  // always-sent rule keeps only the principle that survives without one — read
  // their wording as a role, not a tag.
  //
  // My earlier guard checked that the NOTE was absent without a map, and never
  // that the RULE stopped referring to it. Half the property.
  const { laneRule, landmarkNote } = await import("../builder/site-lanes.mjs");
  const rule = laneRule("css");
  assert.ok(rule && rule.length > 100, "the css lane lost its rule");
  assert.doesNotMatch(rule, /THIS TABLE|THE LANDMARK TABLE|the table below/i,
    "the always-sent rule points at a table that is only sometimes sent: " + rule.slice(0, 300));
  // AND THE PRINCIPLE SURVIVES WITHOUT ONE, or a site with no map loses the one
  // instruction that would have stopped runs 96 and 98.
  assert.match(rule, /role/i, "the rule no longer says to read their wording as a role");
  assert.match(rule, /not a `<button>`|usually not a `<button>`/,
    "the rule no longer warns that what they call a button may not be one");
  // THE TABLE'S OWN NOTE CARRIES THE AIMING INSTRUCTION, so it arrives with it.
  assert.match(landmarkNote(MARKS), /AIM BY THIS TABLE/,
    "the note no longer tells the model to use the table it is handing over");
});
