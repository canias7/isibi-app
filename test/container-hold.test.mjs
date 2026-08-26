// A CONTAINER NOBODY IS CONNECTED TO MUST NOT BE STOPPED MID-BUILD.
//
// Three layers, because each fails differently and two of them are silent:
//
//   • the RULE (`holdDecision`) — arithmetic, driven with literals
//   • the CONTAINER (`/busy`) — driven against the real server over HTTP,
//     because `build-server.mjs` listens at import time and cannot be imported
//   • the WIRING — a source-read, because the class extends `Container` from the
//     library and is constructed by the runtime, so nothing can drive it here.
//     This is the layer twelve features in this repo have shipped dead in.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import net from "node:net";
import { spawn } from "node:child_process";
import { holdDecision, MAX_BUSY_HOLD_MS, BUSY_PROBE_MS } from "../builder/container-hold.mjs";
import { anonKeyFromFrontend } from "../scripts/anon-key.mjs";

const worker = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const server = readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8");

// ── THE RULE ────────────────────────────────────────────────────────────────

test("a busy container is held", () => {
  const d = holdDecision({ busy: true, jobs: 1, sinceMs: 60_000 });
  assert.equal(d.hold, true);
  assert.equal(d.why, "busy");
});

test("an idle container is stopped, and that is the ordinary path", () => {
  const d = holdDecision({ busy: false, jobs: 0, sinceMs: 0 });
  assert.equal(d.hold, false);
  assert.equal(d.why, "idle");
});

// COULD NOT ASK → STOP. The library only calls the hook on a container it
// believes is RUNNING, so silence is a wedge rather than a cold start — and
// holding an unreachable container makes it unreclaimable for ever.
test("a container that would not answer is stopped, whatever shape the silence took", () => {
  for (const junk of [null, undefined, "", 0, false, "busy", 42, NaN]) {
    const d = holdDecision(junk);
    assert.equal(d.hold, false, "held on " + JSON.stringify(junk));
    assert.equal(d.why, "no-answer", "wrong reason for " + JSON.stringify(junk));
  }
});

// STRICTLY `=== true`. Anything merely truthy keeping a container alive is a
// billing decision made by a typo, and this repo has shipped that exact
// coercion as a real bug three times (a role, an access level, a plan lookup).
test("only a real boolean true holds — nothing merely truthy", () => {
  for (const truthy of ["true", "false", 1, {}, [], "yes"]) {
    const d = holdDecision({ busy: truthy, sinceMs: 1000 });
    assert.equal(d.hold, false, "held on busy=" + JSON.stringify(truthy));
    assert.equal(d.why, "idle");
  }
});

// A PROTOTYPE KEY IS NOT AN ANSWER. `{}.constructor` is truthy and a function;
// reading it as "busy" would hold a container for ever on a malformed reply.
//
// NO `Object.hasOwn` CHECK, AND THAT WAS MEASURED RATHER THAN ASSUMED. The first
// draft of this test also demanded that an INHERITED `busy: true` be refused,
// which `holdDecision` does not do — so the question was whether to harden the
// rule or drop the assertion. `state` is always `await r.json()`, and
// `JSON.parse` cannot produce an inherited property: measured, even
// `{"__proto__": {"busy": true}}` yields an OWN key named `__proto__` and leaves
// `Object.prototype` untouched. A `hasOwn` guard here could therefore never
// fire, which is the "protection that reads real and is not" this repo refuses
// everywhere else. The assertion went instead.
test("a prototype key cannot hold a container", () => {
  assert.equal(holdDecision({ busy: {}.constructor, sinceMs: 1 }).hold, false);
  assert.equal(holdDecision({ busy: Object.prototype.hasOwnProperty, sinceMs: 1 }).hold, false);
});

// A CONTAINER THAT CANNOT SAY HOW LONG IT HAS BEEN BUSY CANNOT BE CAPPED.
// Reported apart from `no-answer` because they are different faults: one would
// not speak, this one said something we do not understand — a version skew
// between the image and the Worker, which is a deploy problem.
test("busy with an unreadable duration is stopped, and says which fault it was", () => {
  for (const bad of [undefined, null, "60000", NaN, Infinity, -1, {}]) {
    const d = holdDecision({ busy: true, sinceMs: bad });
    assert.equal(d.hold, false, "held on sinceMs=" + JSON.stringify(bad));
    assert.equal(d.why, "unreadable", "wrong reason for sinceMs=" + JSON.stringify(bad));
  }
});

test("busy for longer than any real build is stopped, and is NOT reported as idle", () => {
  const d = holdDecision({ busy: true, sinceMs: MAX_BUSY_HOLD_MS + 1 });
  assert.equal(d.hold, false);
  assert.equal(d.why, "stuck");
  // The boundary itself still holds — a cap that fires AT the limit would stop a
  // build one millisecond before it was going to be stopped anyway, for no
  // reason anybody could explain from the log.
  assert.equal(holdDecision({ busy: true, sinceMs: MAX_BUSY_HOLD_MS }).hold, true);
});

// A NONSENSE CAP FALLS BACK TO THE DEFAULT RATHER THAN DISABLING THE CAP. The
// failure direction is the point: read as "no ceiling", a hung container is held
// for ever. Same rule `pruneVersions` and the audit-log retention already use.
test("a nonsense cap is the default cap, never an absent one", () => {
  for (const bad of [0, -1, NaN, Infinity, "30m", null, {}]) {
    assert.equal(holdDecision({ busy: true, sinceMs: MAX_BUSY_HOLD_MS + 1 }, { maxHoldMs: bad }).why, "stuck",
      "a maxHoldMs of " + JSON.stringify(bad) + " disabled the cap");
  }
  // …and `undefined` still means "use the default" through the parameter.
  assert.equal(holdDecision({ busy: true, sinceMs: MAX_BUSY_HOLD_MS + 1 }, { maxHoldMs: undefined }).why, "stuck");
});

test("the cap and the probe bound are sane relative to a real build", () => {
  // A build is 7-12 minutes once generation moves in. A cap under that would
  // stop working containers; a probe bound over a few seconds would let a wedged
  // one hold the Durable Object's alarm.
  assert.ok(MAX_BUSY_HOLD_MS >= 20 * 60 * 1000, "the cap is under any real build: " + MAX_BUSY_HOLD_MS);
  assert.ok(BUSY_PROBE_MS >= 1000 && BUSY_PROBE_MS <= 15000, "probe bound out of range: " + BUSY_PROBE_MS);
});

// ── THE CONTAINER, DRIVEN ───────────────────────────────────────────────────

function freePort() {
  // NEVER A FIXED PORT. `site-build.mjs` binds 8123 and two runs at once die
  // with EADDRINUSE — a failure that reads exactly like a code regression and is
  // not one. Asking the OS for a free one costs nothing and cannot collide with
  // another harness.
  return new Promise((res, rej) => {
    const s = net.createServer();
    s.on("error", rej);
    s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => res(port)); });
  });
}

async function withServer(fn) {
  const port = await freePort();
  const child = spawn(process.execPath, [new URL("../builder/build-server.mjs", import.meta.url).pathname], {
    env: { ...process.env, PORT: String(port), APP_DIR: "/nonexistent-app" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const base = "http://127.0.0.1:" + port;
  try {
    // Wait for it to answer rather than sleeping a guessed amount. `/health`
    // must start with "ok " — a stale server squatting on the port would answer
    // SOMETHING, and counting any response as "up" is the trap this repo already
    // recorded once, where a design mirror was POSTed a build and the parse error
    // was reported instead of "wrong server".
    for (let i = 0; i < 100; i++) {
      try {
        const r = await fetch(base + "/health");
        if (r.ok && (await r.text()).startsWith("ok ")) break;
      } catch { /* not listening yet */ }
      await new Promise((r) => setTimeout(r, 50));
    }
    await fn(base);
  } finally {
    child.kill("SIGKILL");
  }
}

test("the container reports itself idle, busy, and idle again", async () => {
  await withServer(async (base) => {
    const busy = async () => (await fetch(base + "/busy")).json();

    const before = await busy();
    assert.deepEqual({ busy: before.busy, jobs: before.jobs }, { busy: false, jobs: 0 },
      "a fresh container should be idle: " + JSON.stringify(before));
    assert.equal(before.sinceMs, 0, "an idle container has been busy for no time at all");

    // The hold ANSWERS AT ONCE and keeps working — which is the property the
    // whole probe rests on. If this awaited the hold, the caller could not walk
    // away and the mechanism could not be observed.
    const started = Date.now();
    const held = await (await fetch(base + "/hold?ms=600", { method: "POST" })).json();
    assert.deepEqual(held, { held: true, ms: 600 });
    assert.ok(Date.now() - started < 400, "the hold replied only when it finished — it must reply immediately");

    const during = await busy();
    assert.equal(during.busy, true, "the container did not report the hold as work: " + JSON.stringify(during));
    assert.equal(during.jobs, 1);
    assert.ok(during.sinceMs >= 0 && during.sinceMs < 600, "sinceMs out of range: " + during.sinceMs);

    await new Promise((r) => setTimeout(r, 900));
    const after = await busy();
    assert.equal(after.busy, false, "the container stayed busy after the hold finished — the counter leaks");
    assert.equal(after.jobs, 0);
    assert.equal(after.sinceMs, 0);
  });
});

test("a QUEUED job counts as busy, not just the running one", async () => {
  // A container stopped while a job is queued loses it exactly as surely as one
  // stopped mid-compile, so `oneAtATime`'s waiting room is work this container
  // owes. Counted at the door for that reason.
  await withServer(async (base) => {
    await fetch(base + "/hold?ms=700", { method: "POST" });
    await fetch(base + "/hold?ms=700", { method: "POST" });
    const s = await (await fetch(base + "/busy")).json();
    assert.equal(s.busy, true);
    assert.equal(s.jobs, 2, "a queued job was not counted: " + JSON.stringify(s));
  });
});

test("the hold is capped by the container, not only by its caller", async () => {
  await withServer(async (base) => {
    const r = await (await fetch(base + "/hold?ms=99999999", { method: "POST" })).json();
    assert.ok(r.ms <= 900000, "the container accepted an unbounded hold: " + r.ms);
    // …and junk does not become a very long hold.
    const j = await (await fetch(base + "/hold?ms=abc", { method: "POST" })).json();
    assert.ok(j.ms > 0 && j.ms <= 900000, "a junk ms became " + j.ms);
  });
});

test("the egress probe answers a NAMED outcome for BOTH providers, either way", async () => {
  // SHAPE, NOT REACHABILITY. Whether THIS machine can reach the providers says
  // nothing about a Cloudflare container — this dev box goes through an outbound
  // proxy and CI has its own network — so asserting `reached: true` here would
  // be asserting the wrong network, and it would go red for a reason unrelated
  // to the thing under test. What must hold is that the endpoint answers, covers
  // both hosts, and NAMES what happened rather than collapsing four different
  // causes into one word.
  await withServer(async (base) => {
    const r = await fetch(base + "/egress");
    assert.equal(r.status, 200, "the egress probe did not answer");
    const out = await r.json();
    // BOTH, because they are different hosts on different networks and
    // `DEFAULT_PICKER` is grok — a probe covering only Anthropic would say
    // nothing about the provider every build actually uses.
    for (const name of ["anthropic", "xai"]) {
      const v = out[name];
      assert.ok(v && typeof v === "object", name + " is missing from the report: " + JSON.stringify(out));
      assert.equal(typeof v.ms, "number", name + " did not time itself");
      if (v.reached === true) {
        assert.equal(typeof v.status, "number", name + " claims it was reached and names no status");
      } else {
        assert.equal(v.reached, false, name + " answered neither reached nor not: " + JSON.stringify(v));
        // The whole point of the failure branch: a timeout, a DNS miss and a
        // refused connection want different answers, so each has to say which.
        assert.ok(v.kind && v.why, name + " failed without saying how: " + JSON.stringify(v));
      }
    }
  });
});

test("THE EGRESS PROBE CARRIES NO CREDENTIAL — a 401 is the proof, so a key would spend", () => {
  // Sending a key would make this billable and would put a secret in an image
  // that holds none today. The proof is precisely that an UNAUTHENTICATED
  // request is answered: only DNS, TLS, routing and a live server can produce a
  // 401. Asserted as an absence, because adding auth here is the tidy-looking
  // edit that turns a free probe into a paid one.
  const i = server.indexOf('req.url === "/egress"');
  assert.ok(i > 0, "the egress probe is gone — the second unknown becomes unprovable");
  const blk = server.slice(i, server.indexOf("/build", i));
  assert.ok(!/authorization|x-api-key|API_KEY/i.test(blk),
    "the egress probe sends a credential — it must not, or it stops being free and starts leaking");
  assert.match(blk, /api\.anthropic\.com/, "the probe stopped covering Anthropic");
  assert.match(blk, /api\.x\.ai/, "the probe stopped covering xAI — the DEFAULT picker");
  assert.match(blk, /AbortSignal\.timeout\(/,
    "the egress probe is unbounded — a blocked network would hang the container's own request handler");
});

// ── THE WIRING ──────────────────────────────────────────────────────────────

test("SiteBuildContainer overrides onActivityExpired and asks before stopping", () => {
  const i = worker.indexOf("export class SiteBuildContainer");
  assert.ok(i > 0, "the container class is gone");
  // Bounded by the class's own close rather than a byte count — this repo has
  // lost three guards to a window somebody's comment outran.
  const end = worker.indexOf("\n}", i);
  assert.ok(end > i, "could not find the end of the class");
  const cls = worker.slice(i, end);
  assert.match(cls, /async onActivityExpired\s*\(/, "the hook is not overridden — the default STOPS the container");
  assert.match(cls, /\/busy/, "the override does not ask the container whether it is busy");
  assert.match(cls, /holdDecision\(/, "the override does not use the shared rule");
  assert.match(cls, /super\.onActivityExpired\(\)/, "nothing ever stops an idle container — it would linger for ever");
  assert.match(cls, /BUSY_PROBE_MS/, "the probe is unbounded, which would wedge the alarm as well as the container");
});

test("the rule is imported rather than restated", () => {
  assert.match(worker, /import \{[^}]*holdDecision[^}]*\} from "\.\/builder\/container-hold\.mjs"/,
    "worker.js does not import the rule — a second copy is a second thing that can disagree");
});

test("the container answers /busy, and the queue is what it counts", () => {
  assert.match(server, /req\.url === "\/busy"/, "the container has no /busy endpoint");
  assert.match(server, /function busyState\(\)/, "nothing composes the busy answer");
  // The counter must be incremented inside `oneAtATime`, or it measures
  // something other than the queue — and a `/busy` that does not track the queue
  // is a container that reports itself idle while it compiles.
  const q = server.indexOf("function oneAtATime(");
  assert.ok(q > 0, "oneAtATime is gone");
  const body = server.slice(q, server.indexOf("\n}", q));
  assert.match(body, /_busy\+\+/, "oneAtATime does not count the job it just accepted");
  assert.match(body, /release/, "oneAtATime never releases the counter — it would claim to be busy for ever");
});

test("the probe route exists, is gated, and can occupy only one lane", () => {
  const i = worker.indexOf('url.pathname === "/api/_hold"');
  assert.ok(i > 0, "the hold probe route is gone — the mechanism becomes unprovable");
  const blk = worker.slice(i, worker.indexOf('url.pathname === "/api/_slow"', i));
  assert.match(blk, /authUser\(request\)/, "the probe is unauthenticated — it occupies a build lane");
  // ANCHORED ON THE CALL, NOT ON A MENTION. `laneName("hold-probe")` appears
  // twice in this block — once picking the container and once in the response's
  // own `lane:` field — so a bare match is satisfied by the REPORT while the
  // actual `getContainer` argument becomes caller-controlled. Found by mutation:
  // that is exactly what survived. A presence standing in for a property.
  assert.match(blk, /getContainer\(env\.SITE_BUILD_CONTAINER,\s*laneName\("hold-probe"\)\)/,
    "the probe does not pin its CONTAINER to one lane — a caller-chosen lane could starve every build");
  assert.ok(!/await c\.fetch\(new Request\("http:\/\/build\/hold/.test(blk),
    "the probe AWAITS the hold — an awaited fetch keeps inflightRequests above zero, " +
    "so the alarm never fires and the thing under test never happens");

  // THE READ MAY BE AIMED AND THE HOLD MAY NOT, and the difference is what each
  // one does to the platform. Reading the hook's record wakes a Durable Object
  // and reads storage — it starts no container and occupies no lane — so it is
  // addressable by slug, which is the only way the record can be read for a
  // build that really happened. Holding OCCUPIES a lane, so a caller-chosen one
  // there is a probe that can starve a customer's build. Asserted apart,
  // because the natural tidy-up is to hoist the slug to the top and let both
  // use it, and that reads like a simplification.
  const holdCall = blk.indexOf('c.fetch(new Request("http://build/hold');
  assert.ok(holdCall > 0, "the hold fetch is gone — rescope this guard");
  const logBranch = blk.indexOf('url.searchParams.get("log")');
  assert.ok(logBranch > 0 && logBranch < holdCall, "the log branch is gone or has moved below the hold — rescope this guard");
  const aimed = [...blk.matchAll(/getContainer\(env\.SITE_BUILD_CONTAINER,\s*laneName\(([^)]*)\)\)/g)];
  // THE PROPERTY, NOT A COUNT. This was `aimed.length >= 2` and the mutant that
  // switched the whole addressable read off SURVIVED: the block already holds
  // TWO pinned `laneName("hold-probe")` calls, so the floor was satisfied by
  // them while the slug was read, ignored, and every probe answered about the
  // wrong lane — silently, which is the shape this feature exists to end. A
  // count standing in for a property, in the guard written for it.
  assert.ok(aimed.some((m) => m[1].trim() === "forSlug"),
    `the log branch resolves no slug-addressed container — every probe would answer about the hold-probe's own lane. Found: ${aimed.map((m) => m[1].trim()).join(" | ")}`);
  for (const m of aimed) {
    const arg = m[1].trim();
    if (arg === '"hold-probe"') continue;
    // Anything that is NOT the pinned literal has to live inside the log
    // branch AND above the hold, so it can never be what gets held.
    assert.ok(m.index > logBranch && m.index < holdCall,
      `a container is resolved from ${arg} outside the log branch — a caller-chosen lane must never be one this route can OCCUPY`);
  }
});

test("THE HOLD IS HELD ON ctx.waitUntil — an abandoned fetch is CANCELLED", () => {
  // The first live run reported NOT PROVEN and this is the likeliest reason. A
  // Worker tears the request context down once the response is returned, so a
  // promise nobody holds is cancelled mid-flight — this repo already lost most
  // of an audit log to exactly that, and here it means the hold may never reach
  // the container at all. The hook then correctly finds it idle and correctly
  // stops it, and the probe measures its own plumbing.
  //
  // IT DOES NOT MAKE THE PROBE VACUOUS, which is the thing that has to stay
  // true: `/hold` answers IMMEDIATELY, so `containerFetch` settles in
  // milliseconds and `inflightRequests` is back to zero long before the idle
  // window matters. Asserted at the container end too, one test up.
  const i = worker.indexOf('url.pathname === "/api/_hold"');
  const blk = worker.slice(i, worker.indexOf('url.pathname === "/api/_egress"', i));
  assert.match(blk, /ctx\.waitUntil\(held\)/,
    "the hold probe abandons its fetch — a Worker cancels it, so the container may never be told");
  // ANCHORED ON THE BINDING, not on a mention: `ctx.waitUntil` appears in prose
  // in this block explaining the bug, and prose containing the thing it asserts
  // is this repo's most repeated own-goal.
  assert.match(blk, /const held = c\.fetch\(new Request\("http:\/\/build\/hold/,
    "the hold fetch is no longer bound, so nothing can hold it");
});

test("THE HOOK RECORDS ITS DECISION WHERE THE CONTAINER CANNOT ERASE IT", () => {
  // A probe that can only answer PROVEN or NOT PROVEN cannot say WHY, and four
  // causes wear that one word. The container's own memory cannot answer it — a
  // stopped container loses precisely the evidence — so it goes to Durable
  // Object storage, which outlives the container by design.
  const i = worker.indexOf("export class SiteBuildContainer");
  const blk = worker.slice(i, worker.indexOf("\n}", worker.indexOf("async lastExpiry()", i)));
  assert.match(blk, /this\.ctx\.storage\.put\("lastExpiry"/,
    "the hook no longer records what it decided — a NOT PROVEN cannot name its cause");
  assert.match(blk, /async lastExpiry\(\)/, "nothing can read the record back");
  // WRITTEN BEFORE THE DECISION IS ACTED ON, or the one branch that matters
  // most — the container being stopped — is the branch that records nothing.
  const put = blk.indexOf('this.ctx.storage.put("lastExpiry"');
  const stop = blk.indexOf("return super.onActivityExpired()");
  assert.ok(put > 0 && stop > put,
    `the record is written at ${put} and the stop at ${stop} — a stopped container must still say why`);
  // AND IT MUST NOT BE ABLE TO THROW. The alarm awaits this hook, so an
  // exception escaping takes the Durable Object's whole lifecycle with it —
  // which would turn a diagnostic into an outage.
  const around = blk.slice(Math.max(0, put - 400), put);
  assert.match(around, /try \{/, "the record write is not fenced — this hook must never throw");
});

test("THE PROBE REPORTS THE CAUSE, not only the verdict", () => {
  const probe = readFileSync(new URL("../scripts/container-hold-probe.mjs", import.meta.url), "utf8");
  assert.match(probe, /_hold\?log=1/, "the probe never asks the hook what it did");
  // Every branch of the verdict must carry the diagnosis, or the one run that
  // needs it is the one that does not print it.
  const calls = (probe.match(/whyLine\(/g) || []).length;
  assert.ok(calls >= 4, `whyLine is used ${calls} times — it must ride on every verdict plus its own definition`);
  // THE VERDICT IS THREADED IN, and the live PROVEN run is why. One sentence for
  // both outcomes printed "so something else stopped it" directly beneath "the
  // container was still working" — a diagnosis contradicting the verdict above
  // it, which leaves the reader deciding which half to believe.
  assert.match(probe, /function whyLine\(heldOk\)/, "whyLine cannot tell which verdict it is explaining");
  assert.match(probe, /log\(whyLine\(true\)\);/, "the PROVEN branch does not tell whyLine it succeeded");
  // AND THE SUCCESS BRANCH MUST ADD EVIDENCE RATHER THAN REPEAT THE VERDICT. The
  // hook's own sinceMs is the whole claim: an alarm firing AT the sleepAfter
  // window is the mechanism working, where a container merely being up is not.
  assert.match(probe, /The alarm fired \$\{at\}ms into the hold/,
    "the success diagnosis no longer reports WHEN the alarm fired, which is the evidence");
  // AND IT MUST DISCRIMINATE. A diagnosis that says the same thing whatever the
  // hook recorded is a sentence rather than an instrument.
  for (const why of ["idle", "no-answer", "stuck"]) {
    assert.ok(probe.includes(`"${why}"`), `the probe cannot report the "${why}" cause`);
  }
  assert.match(probe, /THE HOOK NEVER RAN/,
    "the probe cannot distinguish a hook that never ran — which is a cause in itself");
});

test("THE PROBE ASKS ABOUT EGRESS AND REPORTS IT SEPARATELY", () => {
  const probe = readFileSync(new URL("../scripts/container-hold-probe.mjs", import.meta.url), "utf8");
  assert.match(probe, /api\/_egress/, "the probe never asks whether the container can reach the providers");
  // BEFORE the idle pre-check, or that check reads a lane this probe just
  // warmed and can no longer establish the lane was quiet before we started.
  const eg = probe.indexOf("api/_egress");
  const pre = probe.indexOf("step 3 — lane before");
  assert.ok(eg > 0 && pre > eg, `egress at ${eg} runs after the idle pre-check at ${pre}, which it warms`);
  // ITS OWN VERDICT, and NOT this run's exit status. The two questions are
  // independent — a container can survive its idle timeout whether or not it
  // can reach a provider — and reporting one as the other makes a green run
  // about the wrong thing.
  for (const v of ["EGRESS: PROVEN", "EGRESS: BLOCKED", "EGRESS: PARTIAL", "EGRESS: UNKNOWN"]) {
    assert.ok(probe.includes(v), `the egress verdict cannot report "${v}"`);
  }
  // BOTH PROVIDERS MUST COUNT. `DEFAULT_PICKER` is grok, so a probe satisfied by
  // Anthropic alone would report PROVEN about the provider builds do not use.
  assert.match(probe, /reached\.length === 2/, "PROVEN does not require both providers");
  assert.match(probe, /\["anthropic", "xai"\]\.filter/, "the verdict is not derived from both providers");
  // AND "unreadable" MUST NOT READ AS "blocked". One is a fault in the probe and
  // the other is a fact about Cloudflare's network; collapsing them reports a
  // working thing as broken.
  const unknown = probe.indexOf("EGRESS: UNKNOWN");
  const blocked = probe.indexOf("EGRESS: BLOCKED");
  assert.ok(unknown > 0 && blocked > 0 && unknown !== blocked,
    "an unreadable egress answer is collapsed into the blocked verdict");
});

// ── THE CREDENTIAL, WHICH KILLED THE FIRST LIVE RUN IN 0.0 SECONDS ──────────
//
// `secrets.SUPABASE_ANON_KEY` HAS NEVER EXISTED in this repo. Five workflows
// name it and it comes through EMPTY in all five — `build-as-owner`'s first run
// died on exactly this and its own comment records it, and I then wrote a new
// script without inheriting the fallback. The anon key is the PUBLIC client key,
// so the answer is not a secret to be found: it is to read our own frontend.
//
// DRIVEN, NOT RESTATED. The first draft of this test carried its OWN copy of the
// regex — so mutating the probe's copy left it perfectly green, measured, it
// SURVIVED. A test that restates what it is checking asserts itself. The
// extraction is a module now and this calls it.
test("THE ANON KEY IS READ OUT OF public/auth.js, and every copy of it agrees", () => {
  const key = anonKeyFromFrontend();
  assert.ok(key, "the anon key is no longer readable from public/auth.js — the probe dies at its own guard");
  // A JWT, so a pattern that matches something else fails here rather than in a
  // live run against Supabase, where it surfaces as an opaque 401.
  assert.equal(key.split(".").length, 3, "the extracted value is not a JWT");
  assert.ok(key.length > 100, `the extracted key is ${key.length} chars — too short to be the real one`);

  // The probe must IMPORT that reading. Anchored on the import rather than on a
  // call: `anonKeyFromFrontend()` appeared in the probe's own function
  // DECLARATION, so a match on the name was satisfied while the probe stopped
  // using it — found by mutation, it survived. A presence standing in for a
  // property, this repo's most repeated own-goal.
  const probe = readFileSync(new URL("../scripts/container-hold-probe.mjs", import.meta.url), "utf8");
  assert.match(probe, /import \{ anonKeyFromFrontend \} from "\.\/anon-key\.mjs"/,
    "the probe stopped importing the shared reading");
  assert.match(probe, /SUPABASE_ANON_KEY \|\| anonKeyFromFrontend\(\)/,
    "the probe no longer falls back to the frontend's key — it will die on the unset secret");
  assert.ok(!probe.includes(key), "the probe carries a hardcoded copy of the anon key — a fourth one");

  // AND THE TWO THAT DO CARRY A LITERAL MUST STILL AGREE WITH IT. They predate
  // this and are deliberately not rewritten — `build-as-owner` is the harness
  // that spends ~130 credits a run, and a refactor bug there costs a real build.
  // What must not happen is a rotation leaving one of them sending a dead key,
  // which surfaces at `/auth/v1/verify` as something that names nothing.
  let literals = 0;
  for (const f of ["../scripts/build-as-owner.mjs", "../scripts/wall-probe.mjs"]) {
    const src = readFileSync(new URL(f, import.meta.url), "utf8");
    const lit = src.match(/SUPABASE_ANON_KEY \|\| "([A-Za-z0-9._-]+)"/);
    assert.ok(lit, `${f} no longer falls back to a literal anon key — it will die on the unset secret`);
    assert.equal(lit[1], key, `${f} carries an anon key that disagrees with public/auth.js`);
    literals++;
  }
  assert.equal(literals, 2, "the scan found a different number of fallbacks than the two that exist");
});

// ── THE PLATFORM'S KILL IS SURVIVED, NOT DECLINED ───────────────────────────
//
// Cloudflare stops an instance with SIGTERM and waits up to FIFTEEN MINUTES
// before SIGKILL; Node's default disposition exits immediately. Until the
// drain existed, every platform stop — an image rollout, a host drain — killed
// a five-to-ten-minute generation on the spot, declining a grace window longer
// than any generation ever measured. Run 41 lost two generations at identical
// ~7-8 minute instance ages minutes after an image deploy. These guards hold
// the drain as SOURCE properties (the server listens at import time and cannot
// be imported); comments are blanked first, because the prose above the
// handler necessarily spells the thing being asserted.
const SRV_BARE = server.split("\n").map((l) => (l.trim().startsWith("//") ? "" : l)).join("\n");

function handlerWindow(name) {
  const at = SRV_BARE.indexOf('process.on("' + name + '"');
  assert.ok(at > 0, "build-server has no " + name + " handler — the platform's grace window is being declined again");
  let d = 0, end = -1;
  for (let i = SRV_BARE.indexOf("(", at); i < SRV_BARE.length; i++) {
    const c = SRV_BARE[i];
    if (c === "(" || c === "{") d++;
    else if (c === ")" || c === "}") { d--; if (!d) { end = i; break; } }
  }
  assert.ok(end > at, "the " + name + " handler never closes — the scan cannot read it");
  return SRV_BARE.slice(at, end + 1);
}

test("SIGTERM with work in flight refuses to exit, bounded inside the grace", () => {
  const h = handlerWindow("SIGTERM");
  // IDLE DIES AT ONCE — a stopped idle instance is the ordinary lifecycle, and
  // holding it open is a container billing for nothing.
  assert.match(h, /_busy === 0/, "the handler never asks the busy counter, so it treats a mid-generation kill like an idle one");
  assert.match(h, /process\.exit\(0\)/, "the handler can never exit, so the grace always ends in SIGKILL at a moment nobody chose");
  // THE EXIT IS BOUNDED UNDER THE PLATFORM'S FIFTEEN MINUTES, read off the
  // constant's own arithmetic rather than restated.
  const m = SRV_BARE.match(/const TERM_DRAIN_MS = (\d+) \* 60 \* 1000/);
  assert.ok(m, "TERM_DRAIN_MS is gone or no longer minutes-shaped — rescope this guard");
  assert.ok(Number(m[1]) < 15, `TERM_DRAIN_MS is ${m[1]} minutes — at or past the platform's grace, so the drain ends in SIGKILL anyway`);
  assert.match(h, /TERM_DRAIN_MS/, "the drain never reads its own bound");
  // AND SOMETHING KEEPS THE LOOP ALIVE — refusing to exit is a wish unless a
  // timer holds the event loop open.
  assert.match(h, /setInterval/, "nothing holds the event loop open, so a drained queue exits early anyway");
});

test("a crash names itself, and does not cost an in-flight generation", () => {
  const ue = handlerWindow("uncaughtException");
  // Logged WITH the stack — observability now retains it, and a crash that
  // cannot name itself is exactly what runs 40 and 41 looked like from outside.
  assert.match(ue, /stack/, "an uncaught exception is logged without its stack — the one fact worth having");
  // The exit is GATED ON IDLE: a possibly-wounded container that lands a paid
  // answer beats a clean corpse that loses it. MAX_BUSY_HOLD_MS upstream still
  // bounds a container that goes truly wrong.
  assert.match(ue, /if \(_busy === 0\) process\.exit\(1\)/, "an uncaught exception exits unconditionally — a paid generation dies with it");
  const ur = handlerWindow("unhandledRejection");
  assert.match(ur, /stack/, "an unhandled rejection is logged without its stack");
  assert.ok(!/process\.exit/.test(ur), "an unhandled rejection exits the process — Node's default kill, reinstated by hand");
});
