// Waiting until a site's script is actually the one we just uploaded.
//
// WHY THIS EXISTS AT ALL: an accepted upload is not a live script. Measured on
// two consecutive live `build smoke` runs — the publish route returned 200, the
// site was read 0.2s later, and it answered with the PREVIOUS build's document.
// The builder reloads its preview the moment the route returns, so the customer
// sees the build before their change and concludes it did nothing.
//
// Every dependency is injected, so all of this runs with no Cloudflare account,
// no namespace and no clock.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { confirmSiteWorker } from "../builder/site-dispatch.mjs";
import { archiveVersion, rollbackVersion, versionId } from "../site-versions.mjs";

/** A dispatch stub that answers with `builds[i]` on the i-th fetch, last one sticking. */
function stubbing(builds, opts = {}) {
  let i = 0;
  const calls = [];
  const paths = [];
  const stubFor = (name) => {
    calls.push(name);
    return {
      fetch: async (req) => {
        paths.push(new URL(req.url).pathname);
        const b = builds[Math.min(i, builds.length - 1)];
        i++;
        if (b === "throw") throw new Error("no such script in namespace");
        return new Response("", { status: opts.status || 200, headers: b == null ? {} : { "x-site-build": b } });
      },
    };
  };
  return { stubFor, calls, paths };
}

/** A clock and a wait that never actually sleeps, so the tests run instantly. */
function fakeClock() {
  let t = 0;
  return { now: () => t, wait: async (ms) => { t += ms; } };
}

test("it confirms as soon as the stub answers with the build it was given", async () => {
  const { stubFor } = stubbing(["b2"]);
  const out = await confirmSiteWorker({ stubFor, name: "site-x", build: "b2" }, fakeClock());
  assert.equal(out.confirmed, true);
  assert.equal(out.tried, 1, "it should not poll again once it has the answer");
});

test("it waits out the old script and confirms when the new one appears", async () => {
  // THE FAILURE THIS IS FOR. The previous build answers first — same script
  // name, older code — and the wait is what turns that into a correct publish
  // rather than a customer looking at their old site.
  const { stubFor } = stubbing(["b1", "b1", "b1", "b2"]);
  const clock = fakeClock();
  const out = await confirmSiteWorker({ stubFor, name: "site-x", build: "b2" }, clock);
  assert.equal(out.confirmed, true);
  assert.equal(out.tried, 4);
  assert.ok(out.ms > 0, "it reports how long the wait took, which is the measurement");
});

test("a script that never updates gives up and says so, rather than hanging", async () => {
  const { stubFor } = stubbing(["b1"]);
  const out = await confirmSiteWorker({ stubFor, name: "site-x", build: "b2" }, { ...fakeClock(), budgetMs: 1000, stepMs: 250 });
  assert.equal(out.confirmed, false);
  assert.ok(out.tried >= 2 && out.tried <= 5, "tried " + out.tried);
  assert.ok(out.ms <= 1000, "it must not run past its budget: " + out.ms);
});

test("a throwing stub is a retry, not an answer", async () => {
  // The commonest reason to throw is the namespace not holding the name yet,
  // which is precisely the state being waited out — so a throw must not be
  // read as a verdict.
  const { stubFor } = stubbing(["throw", "throw", "b2"]);
  const out = await confirmSiteWorker({ stubFor, name: "site-x", build: "b2" }, fakeClock());
  assert.equal(out.confirmed, true);
  assert.equal(out.tried, 3);
});

test("a stub that throws forever ends at the budget rather than propagating", async () => {
  const { stubFor } = stubbing(["throw"]);
  const out = await confirmSiteWorker({ stubFor, name: "site-x", build: "b2" }, { ...fakeClock(), budgetMs: 800, stepMs: 200 });
  assert.equal(out.confirmed, false);
});

test("a response with no stamp at all is not a confirmation", async () => {
  // Every site built before this shipped answers without the header. Reading a
  // missing header as a match would confirm instantly and always, which is the
  // same as not having the wait — and it would look like it was working.
  const { stubFor } = stubbing([null]);
  const out = await confirmSiteWorker({ stubFor, name: "site-x", build: "b2" }, { ...fakeClock(), budgetMs: 600, stepMs: 200 });
  assert.equal(out.confirmed, false);
});

test("the status is not read — a 404 carrying the right stamp confirms", async () => {
  // A FIRST BUILD uploads its script before the site is browsable, and the
  // entry's take-down probe answers 404 until the files are there. Requiring a
  // 200 would time out on exactly the build that most needs confirming.
  const { stubFor } = stubbing(["b2"], { status: 404 });
  const out = await confirmSiteWorker({ stubFor, name: "site-x", build: "b2" }, fakeClock());
  assert.equal(out.confirmed, true);
});

test("nothing to confirm is not a failure to confirm — and costs no calls", async () => {
  // A deployment with no binding, a build that packaged no script, or a
  // container rolled back to before the stamp existed. All three must behave
  // exactly as this did before it existed: no wait, no error, no calls.
  for (const args of [
    { stubFor: null, name: "site-x", build: "b2" },
    { stubFor: stubbing(["b2"]).stubFor, name: "", build: "b2" },
    { stubFor: stubbing(["b2"]).stubFor, name: "site-x", build: "" },
  ]) {
    const out = await confirmSiteWorker(args, fakeClock());
    assert.deepEqual(out, { confirmed: false, ms: 0, tried: 0 }, JSON.stringify(Object.keys(args)));
  }
});

test("it asks for the name it was given, every time", async () => {
  const s = stubbing(["b1", "b2"]);
  await confirmSiteWorker({ stubFor: s.stubFor, name: "site-abc", build: "b2" }, fakeClock());
  assert.deepEqual(s.calls, ["site-abc", "site-abc"]);
});

test("it probes a FILE, so a poll does not render a page each time", async () => {
  // The entry's asset branch is its first: one R2 get, a miss, a 404 — no React
  // render at all. Asking for `/` instead would render a whole document per
  // attempt, and this polls. The extension is what puts the request down that
  // branch, so it is the part worth asserting.
  const s = stubbing(["b1", "b2"]);
  await confirmSiteWorker({ stubFor: s.stubFor, name: "site-abc", build: "b2" }, fakeClock());
  assert.ok(s.paths.length >= 2, JSON.stringify(s.paths));
  for (const p of s.paths) {
    assert.ok(/\.[a-z0-9]+$/i.test(p), "a path with no extension is served as a page: " + p);
  }
});

test("the default budget is bounded and the default step is not zero", async () => {
  // A publish waits on this, so an unbounded budget is a publish that can hang
  // and a zero step is a spin. Both asserted through the real defaults rather
  // than restated, since the call site passes neither.
  const { stubFor } = stubbing(["b1"]);
  const clock = fakeClock();
  const out = await confirmSiteWorker({ stubFor, name: "site-x", build: "b2" }, clock);
  assert.ok(out.tried > 1, "a default step of zero would spin rather than poll");
  assert.ok(out.ms > 0 && out.ms <= 10000, "default budget out of range: " + out.ms);
});

test("the publish path waits, and cannot be failed by the wait", async () => {
  // THE WIRING, which is where this repo has recorded a dozen features shipping
  // dead. `putSiteWorker` is the ONE place every publish path uploads through —
  // the build route, the cheap-edit spine and a version rollback — so the wait
  // belongs there and not at three call sites that can each forget it.
  const src = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const i = src.indexOf("async function putSiteWorker(");
  assert.ok(i > 0, "putSiteWorker is gone — re-point this");
  const body = src.slice(i, src.indexOf("\n}\n", i));
  assert.match(body, /confirmSiteWorker\(\{/, "the upload does not wait for the script to serve");
  assert.match(body, /\.catch\(/, "an unhandled rejection here would fail a publish that really succeeded");
  // AND IT MUST NOT GATE ANYTHING. A confirmation that can refuse turns a
  // cosmetic lag into a lost edit.
  assert.doesNotMatch(body, /if\s*\(\s*!\s*c\.confirmed\s*\)\s*return\s+\{\s*ok:\s*false/,
    "a slow confirmation must never fail a publish that uploaded fine");
});

test("the stamp the platform waits for is the one the container writes", async () => {
  // TWO FILES HAVE TO AGREE and neither can import the other: the container
  // writes `SITE_BUILD` into the template, the template returns it as a header,
  // and the platform matches on that header's name. A disagreement is silent —
  // the wait simply never confirms, on every publish, and the only symptom is
  // the lag this exists to remove.
  const gen = readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8");
  const entry = readFileSync(new URL("../builder/lovable/template/src/server.ts", import.meta.url), "utf8");
  const dispatch = readFileSync(new URL("../builder/site-dispatch.mjs", import.meta.url), "utf8");
  assert.match(gen, /export const SITE_BUILD = /, "the container no longer writes the stamp");
  assert.match(entry, /SITE_BUILD/, "the entry no longer reads the stamp");
  assert.match(entry, /h\.set\("x-site-build", SITE_BUILD\)/, "the entry no longer returns the stamp as a header");
  assert.match(dispatch, /get\("x-site-build"\)/, "the wait reads a different header than the entry sets");
});

test("the poll has an exit, and no test can prove it by running", async () => {
  // THE ONE PROPERTY HERE THAT MUST BE READ RATHER THAN DRIVEN, and the reason
  // is worth keeping. Delete the budget check and `for (;;)` has no exit — a
  // publish awaits this, so it becomes a request that never returns. Measured
  // in a mutation sweep: it ran the suite for 27 minutes and then reported
  // itself SURVIVED, because a runner that never finishes never says "failed".
  //
  // A per-test timeout does NOT catch it either, tried and measured: the loop
  // spins on microtasks (`await` on a resolved promise), which starves the
  // macrotask queue, so the runner's own timer never fires. Any test that CALLS
  // the function hangs with it. So the exit is asserted on the source — the
  // only instrument left — rather than left to a guard that cannot fire.
  const src = readFileSync(new URL("../builder/site-dispatch.mjs", import.meta.url), "utf8");
  const i = src.indexOf("export async function confirmSiteWorker(");
  assert.ok(i > 0, "confirmSiteWorker is gone — re-point this");
  const body = src.slice(i, src.indexOf("\n}\n", i));
  assert.match(body, /for \(;;\)/, "the loop this guards is gone — re-point this");
  assert.match(body, /budgetMs\)\s*return \{ confirmed: false/,
    "the poll has no bounded exit: a publish awaits it, so this hangs the request");
});

test("a version remembers which build its script is, and hands it back", async () => {
  // A ROLLBACK IS A PUBLISH and gets the same wait — but it deliberately serves
  // an OLD build, so what it must watch for is THAT build's stamp, not one made
  // now. Only the manifest can carry it: the alternative is matching a string
  // literal inside a megabyte of minified JavaScript.
  const store = new Map();
  const deps = {
    list: async (p) => [...store.keys()].filter((k) => k.startsWith(p)).map((k) => ({ key: k })),
    copy: async (a, b) => { store.set(b, store.get(a) ?? ""); },
    remove: async (k) => { store.delete(k); },
    put: async (k, v) => { store.set(k, v); },
    read: async (k) => { if (!store.has(k)) throw new Error("no " + k); return store.get(k); },
  };
  store.set("sites/s/index.html", "<html>");
  const a = await archiveVersion(deps, {
    slug: "s", id: versionId(1, "aaaaaa"), label: "One",
    files: ["index.html"], worker: "export default {}", build: "bld-1",
  });
  assert.equal(a.ok, true, JSON.stringify(a));
  const back = await rollbackVersion(deps, { slug: "s", id: versionId(1, "aaaaaa") });
  assert.equal(back.ok, true, JSON.stringify(back));
  assert.equal(back.build, "bld-1", "the version's own stamp did not survive the round trip");

  // A VERSION ARCHIVED BEFORE THIS EXISTED has none, and must roll back exactly
  // as it did — no wait, no error. Being wrong here would refuse a restore.
  store.set("sites/s/index.html", "<html>");
  await archiveVersion(deps, { slug: "s", id: versionId(2, "bbbbbb"), label: "Two", files: ["index.html"], worker: "export default {}" });
  const old = await rollbackVersion(deps, { slug: "s", id: versionId(2, "bbbbbb") });
  assert.equal(old.ok, true, JSON.stringify(old));
  assert.equal(old.build, "", "a version with no stamp must answer with none, not undefined-ish junk");
});

test("every archive call site carries the stamp, and the restore passes it on", async () => {
  // Derived over the call sites rather than the two known today: an archive that
  // forgets it produces a version that can never be waited for, silently, and a
  // restore that forgets it waits for the wrong build — which times out on every
  // rollback and reads as the lag this exists to remove.
  // THE ARGUMENT OBJECT, matched by BRACE DEPTH rather than by a byte window.
  // A window is a bet on how much prose sits inside the call, and this repo
  // documents its reasoning inline — the first draft of this check used 900
  // characters and silently saw ONE of the two call sites. Whole-line comments
  // are blanked first for the same reason the scope scanner blanks them: a
  // brace in prose moves the end of the object.
  const raw = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const src = raw.split("\n").map((l) => (/^\s*(\/\/|\*)/.test(l) ? "" : l)).join("\n");
  const argsOf = (open) => {
    let d = 0;
    for (let i = open; i < src.length; i++) {
      if (src[i] === "{") d++;
      else if (src[i] === "}") { d--; if (!d) return src.slice(open, i + 1); }
    }
    return "";
  };
  const calls = [];
  for (const m of src.matchAll(/archiveVersion\(versionDeps\(env\), (\{)/g)) {
    calls.push(argsOf(m.index + m[0].length - 1));
  }
  assert.ok(calls.length >= 2, "found " + calls.length + " archiveVersion calls — the scan for them broke");
  for (const c of calls) {
    assert.ok(c.length > 40, "the argument object did not close — the brace walk broke");
    assert.match(c, /\bbuild:/, "an archive that stores a script without its stamp: " + c.slice(0, 140));
  }
  assert.match(src, /code: rb\.worker, build: rb\.build/, "the restore uploads a script without saying which build it is");
});

test("the stamp rides back on the packaged script, or nothing can wait for it", async () => {
  const gen = readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8");
  assert.match(gen, /worker\.build = brandUsed\.build/, "the build id never reaches the caller that uploads the script");
  const worker = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(worker, /build: worker\.build/, "putSiteWorker waits on something other than this build's own id");
});
