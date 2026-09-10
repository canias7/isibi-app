// WHICH SITE A BUILD MADE, ON THE ANSWER, WHICHEVER INVOCATION FINISHED IT
// (2026-09-08, owner on a build that published and reported failure: "the
// problem is that is the build gotta stay in that chat, not make a new one").
//
// A build has two success answers. The inline route composes one from
// route-local variables; the collector — `runResumedSiteBuild`, which finishes
// every build whose generation outlives the POST socket, i.e. every long one —
// composed `{ok, resumed, ...pages}`, and `publishPages`' out object takes the
// slug as an INPUT and never puts it on the output. So a collected build
// carried no slug, failed `public/chat.js`'s success gate, fell past every
// named branch to the catch-all, and told a customer with a live site and 14
// credits gone that it "didn't come together" and they "weren't charged".
// Measured on `hearth-paper`; `plyhouse` before it ended `stage: "resume"` too.
//
// NO GUARD HAD EVER DRIVEN THE RESUMED PATH'S ANSWER SHAPE. Every existing one
// drives the inline route, which is why a whole class of build could fail in
// the browser for as long as the collector has existed without anything going
// red. So the case below drives a REAL resumed build through `worker.queue` to
// a real packed result, and runs that body through chat.js's OWN gate — the
// expression evaluated out of the file, never retyped, because a retyped gate
// is a second copy of the thing under test.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { siteAnswer, pageNotes, ANSWER_FIELDS, NOTE_FIELDS } from "../builder/build-answer.mjs";
import { packResume, resumeKey, genKey, RESUME_KIND } from "../builder/build-resume.mjs";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";

const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const chat = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");

// Whole-line comments blanked, length preserved: worker.js's own prose names
// the defect and quotes the gate, and this file's does too.
const bare = (s) => s.split("\n").map((l) => (/^\s*\/\//.test(l) ? " ".repeat(l.length) : l)).join("\n");
const BARE = bare(W);

// ── THE COMPOSER, DRIVEN ─────────────────────────────────────────────────────

test("DRIVEN: siteAnswer names the site, and says nothing it cannot", () => {
  const full = siteAnswer({
    slug: "hearth-paper", url: "/s/hearth-paper/", backend: true, brand: "Hearth & Paper",
    tables: ["orders"], schema: [{ name: "orders", access: "collect" }],
  });
  assert.deepEqual(full, {
    slug: "hearth-paper", url: "/s/hearth-paper/", backend: true, brand: "Hearth & Paper",
    tables: ["orders"], schema: [{ name: "orders", access: "collect" }],
  });

  // THE URL IS COMPOSED WHEN THE CALLER HAS NONE, in exactly the expression the
  // browser falls back to (`d.url || ('/s/' + d.slug + '/')`), so the collector
  // and the inline route hand the browser the same string.
  assert.equal(siteAnswer({ slug: "hearth-paper" }).url, "/s/hearth-paper/");

  // ABSENT, NOT `undefined`. `JSON.stringify` drops both, so they are identical
  // on the wire and NOT identical to a guard comparing field sets — and this
  // guard's whole job is comparing field sets.
  const bare1 = siteAnswer({ slug: "x" });
  assert.deepEqual(Object.keys(bare1).sort(), ["backend", "slug", "url"]);
  for (const k of ["brand", "tables", "schema"]) assert.equal(k in bare1, false, k + " rode along with nothing to say");

  // `backend` IS AN OBSERVATION AND IS READ STRICTLY. A caller that cannot tell
  // must be wrong in the direction that hides a panel, never the one that
  // promises a database that does not exist.
  for (const v of [undefined, null, false, 0, "", "true", 1, "yes", {}, []]) {
    assert.equal(siteAnswer({ slug: "x", backend: v }).backend, false, JSON.stringify(v) + " was read as a database");
  }
  assert.equal(siteAnswer({ slug: "x", backend: true }).backend, true);

  // A BRAND THAT IS NOT A NAME LEAVES THE PROJECT NAMED WHATEVER THE CUSTOMER
  // TYPED, which is the behaviour before this existed. `String(["a"])` is "a" —
  // the recorded coercion trap — so nothing is coerced.
  for (const v of [undefined, null, "", "   ", 7, ["Hearth"], {}]) {
    assert.equal("brand" in siteAnswer({ slug: "x", brand: v }), false, JSON.stringify(v) + " became a name");
  }
  assert.equal(siteAnswer({ slug: "x", brand: "  Hearth  " }).brand, "Hearth", "the name kept its padding");

  // A LIST IS A LIST OR IT IS ABSENT.
  for (const v of ["orders", 7, {}, null]) {
    assert.equal("tables" in siteAnswer({ slug: "x", tables: v }), false, JSON.stringify(v) + " passed as tables");
    assert.equal("schema" in siteAnswer({ slug: "x", schema: v }), false, JSON.stringify(v) + " passed as schema");
  }

  // NO SLUG IS NOTHING TO SAY. A build that cannot name its site must not
  // answer a half-identity the browser would then record against the project.
  for (const v of [undefined, null, "", "   ", 7, ["x"], {}]) {
    assert.deepEqual(siteAnswer({ slug: v }), {}, JSON.stringify(v) + " was accepted as a slug");
  }
  assert.deepEqual(siteAnswer(), {});
  assert.equal(siteAnswer({ slug: "  hearth-paper  " }).slug, "hearth-paper");
});

test("DRIVEN: pageNotes says what happened to the pages, and stays silent when nothing did", () => {
  assert.deepEqual(pageNotes({ salvageNote: "A page was replaced by a stub." }), { salvageNote: "A page was replaced by a stub." });
  assert.equal(pageNotes({ render: { ok: true, findings: [{ route: "/", kind: "threw", detail: "boom" }] } }).renderNote,
    "I had a look at the finished pages: / threw an error.");
  assert.equal(pageNotes({ images: { made: 1, planned: 2, budget: 2, overflow: 0 } }).imagesNote, "Made 1 photograph for the site.");

  // SILENCE IS A KEY THAT IS NOT THERE, not an empty string: `|| undefined` is
  // what the inline route wrote at each of the three, so an ordinary build's
  // answer is byte-identical to what it was before the composer existed.
  for (const p of [null, undefined, {}, "x", 7, [], { salvageNote: "" }, { render: null }, { images: null }]) {
    assert.deepEqual(pageNotes(p), {}, JSON.stringify(p) + " invented a sentence");
  }
  // A note that is not a string is not a note — `String(["a"])` is "a".
  for (const v of [7, ["A page"], {}, true]) assert.equal("salvageNote" in pageNotes({ salvageNote: v }), false, JSON.stringify(v));
});

// ── CHAT.JS'S OWN GATE, EVALUATED OUT OF THE FILE ────────────────────────────

/**
 * The browser's success gate, lifted from `public/chat.js` rather than retyped.
 *
 * A retyped gate is "two lists of the same thing": the copy here would go on
 * passing after the real one changed, which is precisely the failure this whole
 * change is about — an answer and its reader disagreeing while both look right.
 */
function successGate() {
  const line = "if (r.ok && d && d.error !== true && d.slug) {";
  const at = chat.indexOf(line);
  assert.ok(at > 0, "chat.js's build success gate is gone or has been reworded — re-read it before re-anchoring");
  // ONE gate: a second copy of this expression is a second reader that can
  // disagree with the first.
  assert.equal(chat.indexOf(line, at + 1), -1, "chat.js has two copies of the build success gate");
  const expr = line.slice("if (".length, -") {".length);
  // eslint-disable-next-line no-new-func
  return new Function("r", "d", "return (" + expr + ");");
}

test("DRIVEN: a composed answer passes chat.js's own success gate; an answer without a slug does not", () => {
  const gate = successGate();
  const ok = { status: 200, ok: true };
  // The shape the collector used to send: `publishPages`' out object, spread.
  const pagesOnly = { page: "app", files: ["index.tsx"], notes: "", problems: [], cost: 14, buildMs: 480000 };
  assert.equal(!!gate(ok, { ok: true, resumed: "finish", ...pagesOnly }), false,
    "the pre-fix collector answer passes the gate — this guard cannot see the defect it was written for");
  assert.equal(!!gate(ok, { ok: true, resumed: "finish", ...pagesOnly, ...siteAnswer({ slug: "hearth-paper" }) }), true,
    "a composed answer still fails the browser's success gate");

  // A PLACEHOLDER BUILD IS A SUCCESS THAT CARRIES A REASON — `error` is a
  // STRING there, and the gate refuses only `true`. The comment above the gate
  // says so, and a composer that broke it would send every fallen-back build to
  // the error branch, which is the bug the gate was widened for on 2026-08-09.
  assert.equal(!!gate(ok, { ok: true, error: "typecheck", ...pagesOnly, ...siteAnswer({ slug: "hearth-paper" }) }), true);
  assert.equal(!!gate(ok, { ok: true, error: true, ...siteAnswer({ slug: "hearth-paper" }) }), false);
});


// ── A RESUMED BUILD, DRIVEN END TO END ───────────────────────────────────────
//
// Through `worker.queue` with a real resume message, a real record, a real
// stored generation, the real decision, the real claim and the real
// `buildAndPublishPages` — the only fakes are R2, the queue and Supabase over
// `fetch`. The ledger answers nothing, so `publishPages` takes its own
// credits fallback and returns its out object: that is a REAL terminal
// collector answer, composed by the code that ships, and it is the shape that
// used to reach the customer as "that didn't come together".

const ID = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
const TOKEN = "0f1e2d3c4b5a69788796a5b4c3d2e1f0";
const UID = "11111111-2222-4333-8444-555555555555";
const SLUG = "hearth-paper";

function bucket(entries = {}) {
  const store = new Map(Object.entries(entries));
  return {
    store,
    async get(k) { return store.has(k) ? { key: k, etag: "e-" + k, async text() { return store.get(k); }, async json() { return JSON.parse(store.get(k)); } } : null; },
    async put(k, v) { store.set(k, typeof v === "string" ? v : String(v)); return { key: k, etag: "e-" + k }; },
    async delete(k) { store.delete(k); },
    async head(k) { return store.has(k) ? { key: k, size: 1 } : null; },
    async list() { return { objects: [], truncated: false }; },
  };
}

function stubFetch(answers, seen) {
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const u = String((input && input.url) || input || "");
    const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
    const m = u.match(/\/rest\/v1\/rpc\/(\w+)/);
    if (m) {
      let args = {};
      try { args = JSON.parse(String(init && init.body) || "{}"); } catch { args = {}; }
      delete args.p_mint;
      seen.push({ fn: m[1], args });
      const a = answers[m[1]];
      if (a === undefined) return json({ ok: false, error: "no stub for " + m[1] }, 500);
      return json(typeof a === "function" ? a(args) : a);
    }
    // THE BACKEND READ, WHICH THE COLLECTOR ASKS TO SAY WHETHER THE SITE HAS A
    // DATABASE. `siteBackendRowFresh` THROWS on a non-ok answer, so this is the
    // only way to drive the collector's catch — and until it was driven, a
    // mutant making that catch answer `true` survived: the default fixture's
    // read succeeds with no row, so both readings answer `false` and the
    // fixture cannot tell them apart.
    if (u.includes("site_backends")) {
      if (answers.__backend === "throws") return new Response("boom", { status: 500 });
      return json([]);
    }
    if (u.includes("/rest/v1/")) return json([]);
    return new Response("unavailable", { status: 503 });
  };
  return () => { globalThis.fetch = real; };
}

/** The design a first invocation bought and stored — the fields the collector reads back. */
const DESIGN = {
  slug: SLUG, brand: "Hearth & Paper", brief: "a stationery shop in Sheffield",
  siteDescription: "Handbound notebooks", theme: "ink-and-linen", lang: "en", langs: [],
  spec: { tables: [{ name: "orders", access: "collect" }] },
  plan: { pages: [{ path: "index.tsx" }] },
  picker: "grok",
};

async function driveResume({ backend = "none", storedSlug = SLUG, design = DESIGN } = {}) {
  const record = packResume({
    id: ID, auth: "", uid: UID, slug: storedSlug, lane: "site-" + SLUG, genId: "gen-1",
    report: TOKEN, firedAt: Date.now() - 60_000, charged: ["deposit", "schema"],
    looks: 3, refires: 0, steps: [], design,
  });
  const b = bucket({
    [resumeKey(ID)]: JSON.stringify(record),
    // A FINISHED GENERATION, stored by the container's own report route. This
    // is what makes the decision `finish`, which is the ordinary happy path for
    // every build whose generation outlived the POST socket.
    [genKey(TOKEN)]: JSON.stringify({ state: "done", answer: { pages: [{ path: "index.tsx", source: "export default function I(){return null}" }] } }),
  });
  const seen = [];
  const restore = stubFetch({
    edit_claim: { ok: true, claimed: true, job: { id: ID, uid: UID, slug: SLUG } },
    edit_handoff: { ok: true, uid: UID, slug: SLUG },
    edit_beat: { ok: true },
    edit_finalize: { ok: true },
    edit_refund: { ok: true },
    __backend: backend,
  }, seen);
  const sent = [];
  try {
    const worker = await loadWorker();
    const ctx = makeCtx();
    await worker.queue(
      { messages: [{ body: { kind: RESUME_KIND, id: ID }, ack() {}, retry() {} }] },
      {
        SITES_BUCKET: b,
        BUILD_QUEUE: { async send(msg, opts) { sent.push({ msg, opts: opts || null }); }, async sendBatch() { throw new Error("no batch"); } },
        SUPABASE_SERVICE_KEY: "svc-test", CREDITS_MINT_SECRET: "mint-test",
      },
      ctx,
    );
    await Promise.allSettled(ctx.pending);
  } finally { restore(); }
  return { b, seen, sent };
}

test("DRIVEN END TO END: a collected build's stored answer names its site, and passes chat.js's own success gate", async (t) => {
  const { b } = await driveResume();
  // WHERE THE BROWSER READS IT. `packResult` writes the delete-on-read object
  // the build poll replays byte for byte; whatever is in here is exactly what
  // `followBuildJob` hands to the success gate.
  const key = [...b.store.keys()].find((k) => k.includes(ID) && k.includes("result"));
  assert.ok(key, "the collector stored no result for the build — it stored: " + [...b.store.keys()].join(", "));
  const stored = JSON.parse(b.store.get(key));
  const d = JSON.parse(stored.body);

  // THE DEFECT, DRIVEN. Before the fix this was `{ok, resumed, ...pages}` and
  // `d.slug` was `undefined`.
  assert.equal(d.ok, true, "the collected build did not answer ok: " + stored.body.slice(0, 400));
  assert.equal(d.slug, SLUG, "the collector's answer does not name the site it made");
  assert.equal(d.url, "/s/" + SLUG + "/");
  assert.equal(d.backend, false, "a site whose backend could not be read was promised a database");
  assert.equal(d.brand, "Hearth & Paper");
  assert.deepEqual(d.tables, ["orders"]);
  assert.deepEqual(d.schema, [{ name: "orders", access: "collect" }]);
  assert.equal(d.resumed, "finish", "the branch it took is off the answer");

  // AND THE READER AGREES. The gate is chat.js's own expression, so this
  // cannot pass while the browser fails.
  const gate = successGate();
  assert.equal(!!gate({ ok: true, status: stored.status }, d), true,
    "a real collected build still fails the browser's success gate — the customer is told it did not come together");

  // AND NOTHING ON IT CAME FROM ANYWHERE ELSE. Every key of a real collected
  // answer is the composer's, the note composer's, `publishPages`' out object,
  // or one of the two the collector adds by name — derived, so a field that
  // starts being written inline here has to be a decision somebody made.
  const known = new Set([
    ...ANSWER_FIELDS, ...NOTE_FIELDS, "brand", "tables", "schema",
    ...publishPagesOut(),
    "ok",      // the answer is an answer
    "resumed", // WHICH of the three terminal branches finished it
    // THE GEN PATH, AND THIS CENSUS IS WHY IT IS A DECISION RATHER THAN A DRIFT
    // (2026-09-10). `buildAndPublishPages` has always ended with
    // `if (genPath.tried) out.genTried = 1; if (genPath.via) out.genVia = …`,
    // and on a COLLECTED build both were absent — not because the generation
    // had no path, but because a collector never builds a `genPath` and so
    // never asked. `runResumedSiteBuild` now records what `act === "finish"`
    // proves (the container answered), so the collected reply says what the
    // synchronous reply has always said. The two are one answer composed once;
    // a field present on one shape and missing on the other is the split this
    // whole file exists to close.
    "genTried",
    "genVia",
  ]);
  const stray = Object.keys(d).filter((k) => !known.has(k));
  assert.deepEqual(stray, [], "the collector's answer carries " + stray.join(", ") + " from nowhere the guard can derive");
});

test("DRIVEN: a backend read the collector could not make answers no, and the site it names is the record's", async () => {
  // ADDED AFTER THE SWEEP, and both cases were survivors it found — each a
  // fixture in which the two readings agree, which is this repo's recorded "a
  // guard proves the branch it drives" shape.
  //
  // (1) The read that REFUSES. `siteBackendRowFresh` throws only on a non-ok
  // answer; the ordinary fixture's read succeeds with no row, so the catch
  // never ran and a mutant answering `true` there passed. Getting it backwards
  // puts a Data panel over a database that does not exist — cannot-tell must be
  // wrong in the direction that hides a panel.
  const refused = JSON.parse(JSON.parse(await answerOf(await driveResume({ backend: "throws" }))).body || "null") || {};
  assert.equal(refused.backend, false, "a backend read that failed was reported as a database");
  assert.equal(refused.slug, SLUG, "the refusal cost the answer its slug");

  // (2) THE SITE IS THE RECORD'S, not the design's. The ordinary fixture has
  // them equal — they are, on a first build — so nothing could tell the two
  // readings apart. They differ after a RENAME: the record carries the slug the
  // build claimed, and reading the design's would name a site this build did
  // not publish.
  const renamed = JSON.parse(JSON.parse(await answerOf(await driveResume({ storedSlug: "hearth-paper-2" }))).body || "null") || {};
  assert.equal(renamed.slug, "hearth-paper-2", "the collector named the design's slug rather than the record's");
  assert.equal(renamed.url, "/s/hearth-paper-2/");
});

/** The stored result object a drive left behind, as JSON text. */
async function answerOf({ b }) {
  const key = [...b.store.keys()].find((k) => k.includes(ID) && k.includes("result"));
  assert.ok(key, "the collector stored no result — it stored: " + [...b.store.keys()].join(", "));
  return b.store.get(key);
}


// ── EVERY FIELD THE BROWSER READS HAS SOMEBODY WHO ANSWERS IT ────────────────

test("every answer field chat.js reads on success is composed by somebody — derived from both sides, never listed here", () => {
  // THE CHECK THAT WOULD HAVE CAUGHT THIS AT DESIGN TIME, and the one that
  // found the second gap while it was being written. Subtract what the two
  // composers and `publishPages` produce from what the browser reads, and what
  // is left has to be a decision somebody wrote down.
  //
  // Both sides DERIVED: the reads out of `public/chat.js`, the answers out of
  // `builder/build-answer.mjs` and `builder/publish-pages.mjs`. A list typed
  // here would be a third copy, and drift silently — which is the whole
  // failure this file is about.
  const reads = new Set(fieldsReadOnSuccess());
  assert.ok(reads.size >= 12, "only " + reads.size + " fields read — the success block is not being found, so this proves nothing");

  const composed = new Set([
    ...Object.keys(siteAnswer({ slug: "x", url: "/s/x/", backend: true, brand: "B", tables: [], schema: [] })),
    ...Object.keys(pageNotes({ salvageNote: "s", images: { made: 1, planned: 2, budget: 2, overflow: 0 }, render: { ok: true, findings: [{ route: "/", kind: "threw", detail: "x" }] } })),
    ...publishPagesOut(),
  ]);

  // NAMED, WITH THE REASON. Anything not here and not composed is a field the
  // browser reads that nothing answers.
  const NAMED = {
    // Route-local on the inline path and NOT on the resume record, so the
    // collector cannot honestly say either. `builder/build-answer.mjs` carries
    // the working: `cssNote` wants `cssAsk.usable`, which the stored sheet has
    // already resolved away; `contextNote` wants the link-and-research summary,
    // which is not stored. Adding either means storing a second copy on the
    // record — a bigger change than the sentence is worth.
    cssNote: "route-local: cssAsk is not on the resume record",
    contextNote: "route-local: the context summary is not on the resume record",
    // Every refusal's sentence. Read inside the success block too, harmlessly:
    // a successful build has none, and `renderTail` prints what is there.
    msg: "the refusal sentence, absent on a success",
    // DEAD READS, and worth having written down: nothing in `worker.js` or
    // `builder/publish-pages.mjs` composes either onto a build's answer.
    // `styleNote` exists (`builder/site-style.mjs`) and is composed on the EDIT
    // path; `tokensNote` is named only in a comment. So the browser has two
    // branches that have never rendered. Not fixed here — the sentences are the
    // design step's, and deciding whether a build should carry them is the
    // owner's — but named so the next reader does not take their absence from
    // the answer as this change having dropped them.
    styleNote: "dead read: nothing composes it onto a build's answer",
    tokensNote: "dead read: nothing composes it onto a build's answer",
  };

  const orphans = [...reads].filter((f) => !composed.has(f) && !(f in NAMED));
  assert.deepEqual(orphans, [],
    "chat.js reads " + orphans.join(", ") + " off a build's answer and nothing composes it — either compose it or name it here with the reason");

  // AND THE NAMED LIST CANNOT ROT: a name that stops being read, or starts
  // being composed, is an excuse for something that is no longer true.
  for (const f of Object.keys(NAMED)) {
    assert.ok(reads.has(f), "`" + f + "` is excused here and chat.js no longer reads it");
    assert.equal(composed.has(f), false, "`" + f + "` is excused here and is composed after all");
  }
});

/** Every `d.<field>` the browser reads inside its own success block, by brace depth. */
function fieldsReadOnSuccess() {
  const line = "if (r.ok && d && d.error !== true && d.slug) {";
  const at = chat.indexOf(line);
  assert.ok(at > 0, "chat.js's build success gate is gone");
  let depth = 0;
  let j = at + line.length - 1; // sits on the block's own `{`
  for (; j < chat.length; j++) {
    const c = chat[j];
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) break; }
  }
  assert.ok(j < chat.length, "the success block has no end");
  return [...new Set([...bare(chat.slice(at, j)).matchAll(/\bd\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1]))];
}

/** Every field `publishPages` puts on its out object — its literal plus every later assignment. */
function publishPagesOut() {
  const src = readFileSync(new URL("../builder/publish-pages.mjs", import.meta.url), "utf8");
  const start = src.indexOf('const out = { page: "placeholder"');
  assert.ok(start > 0, "publishPages' out object is gone or reworded");
  const lit = src.slice(start, src.indexOf("\n", start));
  const seeded = [...lit.matchAll(/([A-Za-z_$][\w$]*):/g)].map((m) => m[1]);
  const later = [...bare(src).matchAll(/\bout\.([A-Za-z_$][\w$]*)\s*=/g)].map((m) => m[1]);
  const all = [...new Set([...seeded, ...later])];
  assert.ok(all.length >= 10, "only " + all.length + " out fields found — the scan is not reading the file");
  return all;
}

// ── THE TWO CALL SITES, COUNTED AND NAMED ────────────────────────────────────

test("both of the build's success answers are composed by the one composer, and neither writes its own", () => {
  // COUNTED, because cutting the call out of either leaves the composer perfect
  // and one whole class of build broken in the browser with nothing red. That
  // is this repo's recorded wiring trap and it is exactly how this shipped.
  // THREE SINCE 2026-09-08, and the third is why the count is here rather than a
  // floor: the retry short-circuit answers the site a chat already has, and it
  // must answer it in the SAME shape a fresh build does or the browser will not
  // record it. A fourth writer appearing without a name below is exactly the
  // drift this counts.
  const calls = BARE.split("siteAnswer({").length - 1;
  assert.equal(calls, 3, "the build has " + calls + " composed answers, not three — a new writer can drift again");
  const notes = BARE.split("pageNotes(pages)").length - 1;
  assert.equal(notes, 2, "the build has " + notes + " composed note sets, not two");
  // ANCHORED ON THE PROPERTY, NOT THE SPELLING: what must be true is that both
  // composers come from the one module, however the import list is ordered or
  // whatever else joins it later.
  const imp = /import \{([^}]*)\} from "\.\/builder\/build-answer\.mjs";/.exec(W);
  assert.ok(imp, "worker.js no longer imports from builder/build-answer.mjs");
  const named = imp[1].split(",").map((x) => x.trim()).filter(Boolean);
  for (const n of ["siteAnswer", "pageNotes"]) assert.ok(named.includes(n), "worker.js does not import " + n);

  // NAMED, because a count is satisfied by three calls in one function — which
  // is now literally the case: the retry short-circuit lives INSIDE
  // `runSiteBuild`, above the inline answer, so "the first one in that function"
  // stopped meaning the inline route the day the retry landed. Each is found by
  // something only it says.
  //
  // AND WHAT EACH HANDS THE COMPOSER IS AN OBSERVATION, NOT A LITERAL. `backend`
  // was hardcoded `true` when every build provisioned, and since 2026-08-24 a
  // first build has no database — so a constant here puts a Data panel over
  // nothing. The composer's own strictness cannot see this: `true` is a
  // perfectly good `=== true`. A survivor of the first sweep, because nothing
  // drove or read the ARGUMENT — so every writer's argument is read, not one.
  const inline = at(BARE, "async function runSiteBuild(", "the inline build route");
  assert.ok(inline.includes("...siteAnswer({"), "the inline build route composes its own identity fields again");
  const args = [...inline.matchAll(/\.\.\.siteAnswer\(\{([\s\S]*?)\}\)/g)].map((m) => m[1]);
  assert.equal(args.length, 2, "expected the retry and the inline answer inside runSiteBuild; found " + args.length);
  const backends = args.map((a) => /backend:\s*([^,\n]+)/.exec(a)).map((m) => m && m[1].trim());
  assert.deepEqual(backends.slice().sort(), ["!!db", "!!mine.neon_db"].sort(),
    "a writer hands the composer a constant backend, not the question it asks everywhere else: " + backends.join(" | "));
  const collector = at(BARE, "async function runResumedSiteBuild(", "the collector");
  assert.ok(collector.includes("...siteAnswer({"), "the collector composes its own identity fields again — the defect itself");
  assert.match(collector, /backend: rBackend\b/,
    "the collector hands the composer a constant backend — a site with no database would get a Data panel over nothing");
  for (const [name, body] of [["the inline build route", inline], ["the collector", collector]]) {
    assert.ok(body.includes("...pageNotes(pages)"), name + " does not spread the note composer");
    // AND NEITHER WRITES A NOTE BESIDE IT. A `renderNote:` line back in either
    // answer is the two shapes diverging again, one field over from the slug.
    for (const f of NOTE_FIELDS) {
      assert.equal(new RegExp("(^|[^.\\w])" + f + "\\s*:").test(body), false,
        name + " writes `" + f + "` itself instead of composing it");
    }
  }

  // AND NEITHER WRITES THE FIELDS BESIDE THE CALL. A literal `slug:` back in
  // either answer is the two shapes starting to diverge again.
  for (const [name, body] of [["the collector", collector]]) {
    const start = body.indexOf("out = packResult({");
    assert.ok(start > 0, name + " no longer packs a result");
    const end = body.indexOf("uid: claimed.uid", start);
    assert.ok(end > start, name + "'s packed result has no end landmark");
    const win = body.slice(start, end);
    assert.ok(win.includes("...siteAnswer({"), name + " does not spread the composer into its answer");
    // THE COMPOSER'S OWN ARGUMENTS EXCISED BY BRACE DEPTH, never by a flat
    // match: `slug:` appears inside the call as well as beside it, and a
    // `\(([^)]*)\)`-shaped scan stops at the first `)`, which here is inside a
    // nested call. That is a recorded trap in this repo, written down five
    // times.
    const rest = without(win, "...siteAnswer({");
    for (const f of ANSWER_FIELDS) {
      assert.equal(new RegExp("(^|[^.\\w])" + f + "\\s*:").test(rest), false,
        name + " writes `" + f + "` beside the composer — the two shapes are diverging again");
    }
  }
});

/** A function body, landmark to landmark — never a byte window, which this file's own prose outruns. */
function at(src, head, what) {
  const i = src.indexOf(head);
  assert.ok(i > 0, what + " is gone from worker.js (" + head + ")");
  const end = src.indexOf("\n}", i);
  assert.ok(end > i, what + " has no end");
  return src.slice(i, end + 2);
}

/** A window with one call's arguments cut out, matched by brace depth. */
function without(win, head) {
  const i = win.indexOf(head);
  if (i < 0) return win;
  let depth = 0;
  let j = i + head.length - 1; // sits on the call's own `{`
  for (; j < win.length; j++) {
    const c = win[j];
    if (c === "{" || c === "(") depth++;
    else if (c === "}" || c === ")") { depth--; if (depth === 0) break; }
  }
  assert.ok(j < win.length, "the composer call has no end");
  return win.slice(0, i) + win.slice(j + 1);
}
