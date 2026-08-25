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
