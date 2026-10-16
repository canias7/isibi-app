// THE INTEGRATED DRAFT / PUBLISH / MEDIA VERIFICATION (2026-10-16), PREPARED
// AND NOT PRESSED. Run by `.github/workflows/draft-verify.yml` (dispatch only).
//
// It judges, on the deployed Worker, what the offline batch
// (`test/parallel-publish-media.test.mjs`, `test/draft-handoff.test.mjs`,
// `test/canary-draft.test.mjs`) can only show against stand-ins: that builder
// work and media changes stay in the draft, that the preview shows the draft,
// that the owner's explicit Publish makes exactly the approved revision live —
// once — and that nothing is left for recovery. The judging is
// `scripts/canary-draft.mjs`'s; this file only reads, sends and records.
//
// EVERY CHECK IS pass, fail OR unverified. A reading that could not be taken is
// unverified and can never become a pass. The run exits 0 only when every
// check passed; 3 when nothing failed but something is unverified; 1 on a
// failure, a stop or an unknown charge; 2 on a refusal before anything was
// done. The evidence (`draft-verify.json`) is kept either way.
//
// MODES, AND WHAT EACH MAY DO (the boxes are checked BEFORE any write or send):
//   rehearsal  read-only, free: the switches, the draft and its publishing
//              evidence, the balance, and what each other mode would refuse on.
//   send       PAID: one image-free message (the `message` box) to an existing
//              site; needs spend=yes, a max_credits ceiling, DRAFT_FIRST on at
//              the Worker (sending with it off would publish live), image
//              purchases OFF, and `expect_revisions`. It never publishes.
//   media      STORAGE-WRITING, no model call, free: a small recording uploaded
//              to the library and then replaced; under draft-first on a live
//              site the replacement must be held (live keeps the old bytes, the
//              preview plays the new ones). Needs mutate=yes and DRAFT_FIRST on.
//              The recording is new and played by no page.
//   publish    PUBLISHES: the explicit Publish of the revision in the
//              `revision` box, pressed twice (the second must say `already`);
//              revisions saved after it must stay unpublished. Needs
//              publish=yes and the revision to be one the draft lists. Free of
//              model calls; the balance is read before and after.
//   recovery   read-only, free: nothing left half-done (recovery notes, an open
//              journal, the running script against the pointer).
//
// NOTHING HERE TURNS A SWITCH, APPLIES SQL, BUILDS AN IMAGE OR BUYS A PICTURE.
import fs from "node:fs";
import {
  combine, readDraftEvidence, readPreview, isolationChecks, previewChecks,
  publishPress, publishChecks, recoveryChecks, switchChecks,
} from "./canary-draft.mjs";

export const MODES = Object.freeze(["rehearsal", "send", "media", "publish", "recovery"]);
const PAID = new Set(["send"]);
const WRITES = new Set(["media"]);
const PUBLISHES = new Set(["publish"]);
/** Sites this harness never writes to or spends on (the help-needed fixtures). */
export const GUARDED_SITES = Object.freeze(["fretwork-1", "lido-axes-b"]);

const pass = (why) => ({ verdict: "pass", why });
const fail = (why) => ({ verdict: "fail", why });
const unverified = (why) => ({ verdict: "unverified", why });

/** The boxes, read strictly: `{ ok, opts }` or `{ ok: false, refused }`. Nothing is guessed. */
export function readBoxes(env) {
  const s = (k) => String(env[k] || "").trim();
  const mode = s("DV_MODE") || "rehearsal";
  if (!MODES.includes(mode)) return { ok: false, refused: "mode " + JSON.stringify(mode) + " is none of " + MODES.join(", ") };
  const slug = s("DV_SITE").toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,80}$/.test(slug)) return { ok: false, refused: "a site slug is required" };
  const int = (k) => { const v = s(k); return /^\d{1,6}$/.test(v) ? Number(v) : null; };
  const opts = {
    mode, slug,
    spend: s("DV_SPEND").toLowerCase(), mutate: s("DV_MUTATE").toLowerCase(), publish: s("DV_PUBLISH").toLowerCase(),
    maxCredits: int("DV_MAX_CREDITS"), revision: int("DV_REVISION"), expectRevisions: int("DV_EXPECT_REVISIONS"),
    expectHeld: s("DV_EXPECT_HELD") ? s("DV_EXPECT_HELD").split(",").map((x) => x.trim()).filter(Boolean) : [],
    message: s("DV_MESSAGE"), picker: s("DV_PICKER") || "grok",
  };
  // A BOX FILLED FOR ANOTHER MODE is refused, never quietly ignored: a press
  // that meant to publish and ran a rehearsal would read as a pass of nothing.
  const filledFor = [];
  if (opts.message && mode !== "send") filledFor.push("message");
  if (opts.revision !== null && mode !== "publish") filledFor.push("revision");
  if (opts.publish === "yes" && mode !== "publish") filledFor.push("publish");
  if (opts.spend === "yes" && mode !== "send") filledFor.push("spend");
  if (filledFor.length) return { ok: false, refused: "box(es) " + filledFor.join(", ") + " filled beside mode " + mode };
  return { ok: true, opts };
}

/** What the mode would refuse on, from the readings already taken. Empty means clear. */
export function unmetFor(opts, { runtime, balance, draft }) {
  const unmet = [];
  const rt = runtime && runtime.status === 200 && runtime.body ? runtime.body : null;
  if (!rt) unmet.push("the runtime route did not answer");
  if (GUARDED_SITES.includes(opts.slug) && opts.mode !== "rehearsal" && opts.mode !== "recovery") unmet.push(opts.slug + " is a help-needed fixture: never written to or spent on here");
  if (PAID.has(opts.mode)) {
    if (opts.spend !== "yes") unmet.push("this mode calls models: spend must be yes");
    if (!(Number.isInteger(opts.maxCredits) && opts.maxCredits > 0)) unmet.push("max_credits must be a positive whole number (the harness's ceiling; the platform caps nothing)");
    if (!opts.message) unmet.push("the message box is empty");
    if (!(Number.isInteger(opts.expectRevisions) && opts.expectRevisions > 0)) unmet.push("expect_revisions must name how many draft revisions the message should save");
    if (!rt || rt.imagePurchases !== false) unmet.push("image purchases must read OFF at the Worker (read " + (rt ? rt.imagePurchases : "nothing") + ")");
    if (balance === null) unmet.push("the balance could not be read");
  }
  if (PAID.has(opts.mode) || WRITES.has(opts.mode)) {
    // WITH THE SWITCH OFF, a builder change PUBLISHES LIVE: never sent here.
    if (!rt || rt.draftFirst !== true) unmet.push("DRAFT_FIRST must read on at the Worker (read " + (rt ? rt.draftFirst : "nothing") + "): with it off this would change the live site");
  }
  if (WRITES.has(opts.mode) && opts.mutate !== "yes") unmet.push("this mode writes to the site's library: mutate must be yes");
  if (PUBLISHES.has(opts.mode)) {
    if (opts.publish !== "yes") unmet.push("this mode publishes: publish must be yes");
    if (!(Number.isInteger(opts.revision) && opts.revision > 0)) unmet.push("the revision box must name the revision to publish");
    else if (draft && draft.ok && Array.isArray(draft.state.revisions) && !draft.state.revisions.some((r) => r.revision === opts.revision)) unmet.push("revision " + opts.revision + " is not an unpublished revision of this draft");
    if (balance === null) unmet.push("the balance could not be read (Publish must charge nothing)");
  }
  if ((PUBLISHES.has(opts.mode) || PAID.has(opts.mode)) && !(draft && draft.ok)) unmet.push("the draft and its publishing evidence could not be read: " + ((draft && draft.why) || "no reading"));
  return unmet;
}

/** A money check: spent nothing beyond `ceiling` (0 for a free mode); a reading missing is unverified. */
export function moneyCheck(before, after, ceiling) {
  if (!Number.isFinite(before) || !Number.isFinite(after)) return unverified("the balance was not read both times (" + before + " / " + after + ")");
  const spent = before - after;
  if (spent < 0) return unverified("the balance rose by " + -spent + " during the run — another change of the account, not judged");
  return spent <= ceiling ? pass("spent " + spent + " (ceiling " + ceiling + ")") : fail("spent " + spent + ", above the ceiling of " + ceiling);
}

/** Wait until the draft stops processing and holds `want` more revisions, or the bound; answers the last reading. */
export async function awaitDraft(read, { from, want, boundMs, sleep, now = () => Date.now(), pollMs = 15000 }) {
  const end = now() + boundMs;
  let last = null;
  while (now() < end) {
    await sleep(pollMs);
    last = await read();
    if (!last.ok) continue;
    const n = Array.isArray(last.state.revisions) ? last.state.revisions.length : 0;
    if (last.state.state !== "processing" && n - from >= want) return { done: true, last };
  }
  return { done: false, last };
}

/**
 * THE RUN. `io` is `{ call(method, path, {json, body, headers}), fetchPage(url),
 * sleep(ms), now(), log(line), media?: { bytes, other, name } }` so the whole
 * run is driven offline against the real Worker in the tests.
 */
export async function runDraftVerify(opts, io) {
  const results = { mode: opts.mode, site: opts.slug, checks: {}, readings: {}, refused: null, stopped: null };
  const log = io.log || (() => {});
  const call = io.call;
  const readBalance = async () => { try { const b = await call("GET", "/api/credits"); return b.status === 200 && b.body && Number.isFinite(Number(b.body.balance)) ? Number(b.body.balance) : null; } catch { return null; } };
  const api = (method, path, body) => call(method, path, body === undefined ? {} : { json: body }).then((r) => ({ status: r.status, body: r.body }));

  const runtime = await call("GET", "/api/site/runtime?slug=" + encodeURIComponent(opts.slug)).catch(() => ({ status: 0 }));
  const balance0 = await readBalance();
  const before = await readDraftEvidence(api, opts.slug);
  results.readings.runtime = runtime && runtime.body ? { draftFirst: runtime.body.draftFirst, parallelWrites: runtime.body.parallelWrites, jobDraftFirst: runtime.body.jobDraftFirst, jobParallelWrites: runtime.body.jobParallelWrites, imagePurchases: runtime.body.imagePurchases, deploy: runtime.body.deploy } : null;
  results.readings.balanceAtStart = balance0;
  results.readings.draftBefore = before.ok ? { state: before.state.state, revision: before.state.revision, applied: before.state.applied, revisions: before.state.revisions, inspect: before.state.inspect } : { unreadable: before.why };
  // THE SWITCHES, CALCULATED ONLY: the container's observed answer is the job
  // probe's (`job-probe.yml`, shape env); without it that check is unverified.
  Object.assign(results.checks, prefix("switch", switchChecks(runtime && runtime.body, null, { draftFirst: true, parallelWrites: !!(runtime && runtime.body && runtime.body.parallelWrites) })));
  const unmet = unmetFor(opts, { runtime, balance: balance0, draft: before });
  results.unmet = unmet;
  log("mode " + opts.mode + "  site " + opts.slug + "  balance " + balance0 + "  draftFirst " + (runtime && runtime.body && runtime.body.draftFirst));
  if (opts.mode === "rehearsal") {
    results.wouldRefuse = Object.fromEntries(MODES.filter((m) => m !== "rehearsal").map((m) => [m, unmetFor({ ...opts, mode: m }, { runtime, balance: balance0, draft: before })]));
    return finish(results);
  }
  if (unmet.length) { results.refused = unmet; return finish(results); }

  if (opts.mode === "recovery") {
    Object.assign(results.checks, prefix("recovery", recoveryChecks(before)));
    return finish(results);
  }

  if (opts.mode === "send") {
    const from = before.state.revisions.length;
    let r;
    // ONE REQUEST KEY, AS THE PAGE MINTS IT (`rq` and 20 hex): the request is
    // then the server's to finish, and a repeated send names the same request.
    const idem = "rq" + [...crypto.getRandomValues(new Uint8Array(10))].map((x) => x.toString(16).padStart(2, "0")).join("");
    try { r = await call("POST", "/api/site/route", { json: { message: opts.message, slug: opts.slug, picker: opts.picker, hasSite: true, firstBuild: false, picked: false, history: [], files: [], brief: opts.message, qa: [], answering: false, idem } }); }
    catch (e) { results.stopped = "the send failed and its charge is unknown: " + String((e && e.message) || e).slice(0, 160); return finish(results); }
    results.readings.sent = { status: r.status, intent: r.body && r.body.intent, key: r.body && (r.body.key || r.body.request) };
    if (r.status >= 400) { results.checks["send.accepted"] = fail("the route answered " + r.status); return finish(results); }
    const waited = await awaitDraft(() => readDraftEvidence(api, opts.slug), { from, want: opts.expectRevisions, boundMs: 30 * 60_000, sleep: io.sleep, now: io.now });
    const after = waited.last && waited.last.ok ? waited.last : await readDraftEvidence(api, opts.slug);
    if (!waited.done) results.checks["send.finished"] = unverified("the draft did not settle with " + opts.expectRevisions + " new revision(s) inside the bound");
    Object.assign(results.checks, prefix("isolation", isolationChecks(before, after, { expectRevisions: opts.expectRevisions, expectHeld: opts.expectHeld })));
    Object.assign(results.checks, prefix("preview", previewChecks(after, await readPreview(io.fetchPage, after.ok ? after.state : null))));
    const balance1 = await readBalance();
    results.readings.balanceAtEnd = balance1;
    results.checks["money"] = moneyCheck(balance0, balance1, opts.maxCredits);
    results.readings.draftAfter = after.ok ? { state: after.state.state, revisions: after.state.revisions } : { unreadable: after.why };
    return finish(results);
  }

  if (opts.mode === "media") {
    const m = io.media;
    if (!m || !m.bytes || !m.other) { results.refused = ["no media fixture was given"]; return finish(results); }
    const up = await uploadMedia(call, opts.slug, m.bytes, m.name, {});
    if (!up.done || up.done.status >= 300) { results.checks["media.upload"] = fail("the recording did not upload: " + JSON.stringify((up.done || up.st || {}).body || {}).slice(0, 200)); return finish(results); }
    results.checks["media.upload"] = pass("uploaded " + up.done.body.name);
    const name = up.done.body.name, url = up.done.body.url;
    results.readings.media = { name, url };
    const rep = await uploadMedia(call, opts.slug, m.other, m.name, { replace: name });
    const d = rep.done && rep.done.body;
    results.checks["media.held"] = !d ? unverified("the replacement's finish was not read")
      : d.held === true && d.replaces === name && d.name !== name ? pass("held in the draft as revision " + (d.draft && d.draft.revision))
      : fail("the replacement was not held: " + JSON.stringify(d).slice(0, 240));
    const site = await io.fetchPage("https://" + opts.slug + ".gofarther.app" + url, { bytes: true }).catch(() => null);
    results.checks["media.live"] = !site || !site.bytes ? unverified("the live address was not read")
      : equalBytes(site.bytes, m.bytes) ? pass("the live address still plays the original") : equalBytes(site.bytes, m.other) ? fail("the live address plays the replacement before Publish") : unverified("the live address answered other bytes (" + site.status + ")");
    const after = await readDraftEvidence(api, opts.slug);
    const pv = after.ok && after.state.preview ? await io.fetchPage(after.state.preview.replace(/\/$/, "") + url, { bytes: true }).catch(() => null) : null;
    results.checks["media.preview"] = !pv || !pv.bytes ? unverified("the preview's copy was not read")
      : equalBytes(pv.bytes, m.other) ? pass("the preview plays the replacement at the old address") : fail("the preview does not play the draft's replacement (" + pv.status + ")");
    return finish(results);
  }

  if (opts.mode === "publish") {
    const chosen = before.state.revisions.find((r) => r.revision === opts.revision);
    const later = before.state.revisions.filter((r) => r.revision > opts.revision).map((r) => ({ revision: r.revision, version: r.version }));
    const press = await publishPress(api, opts.slug, { revision: chosen.revision, version: chosen.version, confirm: true });
    const after = await readDraftEvidence(api, opts.slug);
    const repeat = await publishPress(api, opts.slug, { revision: chosen.revision, version: chosen.version, confirm: true });
    Object.assign(results.checks, prefix("publish", publishChecks({ chosen: { revision: chosen.revision, version: chosen.version }, press, after, repeat, later })));
    Object.assign(results.checks, prefix("recovery", recoveryChecks(await readDraftEvidence(api, opts.slug))));
    const balance1 = await readBalance();
    results.readings.balanceAtEnd = balance1;
    results.checks["money"] = moneyCheck(balance0, balance1, 0);
    return finish(results);
  }
  results.refused = ["no such mode"];
  return finish(results);
}

const prefix = (p, checks) => Object.fromEntries(Object.entries(checks).map(([k, v]) => [p + "." + k, v]));
const equalBytes = (a, b) => a && b && a.length === b.length && a.every((x, i) => x === b[i]);

async function uploadMedia(call, slug, bytes, name, extra) {
  const base = "/api/site/" + slug + "/media";
  const st = await call("POST", base, { json: { name, size: bytes.length, type: "", ...extra } });
  if (!st || st.status >= 300 || !st.body) return { st };
  const size = st.body.partBytes;
  const parts = [];
  for (let n = 1; n <= st.body.parts; n++) {
    const p = await call("PUT", base + "/" + st.body.session + "/" + n, { body: bytes.subarray((n - 1) * size, n * size) });
    if (!p || p.status >= 300) return { st, p };
    parts.push({ n, etag: p.body.etag });
  }
  const done = await call("POST", base + "/" + st.body.session + "/complete", { json: { parts } });
  return { st, done };
}

/** The verdict and the exit code: 2 refused, 1 failed or stopped, 3 unverified, 0 passed. */
export function finish(results) {
  if (results.refused) { results.verdict = { verdict: "refused", why: results.refused.join("; ") }; results.exit = 2; return results; }
  const v = Object.keys(results.checks).length ? combine(results.checks) : unverified("no check was made");
  results.verdict = results.stopped ? fail(results.stopped) : v;
  results.exit = results.stopped || results.verdict.verdict === "fail" ? 1 : results.verdict.verdict === "unverified" ? 3 : 0;
  return results;
}

// ── THE PRESS ───────────────────────────────────────────────────────────────

async function main() {
  const boxes = readBoxes(process.env);
  const out = (r) => { fs.writeFileSync("draft-verify.json", JSON.stringify(r, null, 2)); console.log(JSON.stringify(r.verdict)); for (const [k, c] of Object.entries(r.checks || {})) console.log(c.verdict.toUpperCase().padEnd(11) + k + ": " + c.why); process.exit(r.exit); };
  if (!boxes.ok) out({ refused: [boxes.refused], checks: {}, verdict: { verdict: "refused", why: boxes.refused }, exit: 2 });
  const { ownerSession } = await import("./owner-session.mjs");
  const { anonKeyFromFrontend } = await import("./anon-key.mjs");
  const base = process.env.OWNER_BASE_URL || "https://gofarther.dev";
  const supabaseUrl = process.env.SUPABASE_URL || "https://ujrqdmmtcptvimazlhom.supabase.co";
  const anonKey = process.env.SUPABASE_ANON_KEY || anonKeyFromFrontend();
  const s = await ownerSession({ supabaseUrl, serviceKey: process.env.SUPABASE_SERVICE_KEY, anonKey, email: process.env.OWNER_EMAIL, log: (l) => console.log(l) });
  const call = async (method, path, { json, body, headers = {} } = {}) => {
    const init = { method, headers: { ...s.auth, ...headers } };
    if (json !== undefined) { init.body = JSON.stringify(json); init.headers["content-type"] = "application/json"; }
    if (body !== undefined) { init.body = body; init.headers["content-type"] = "application/octet-stream"; }
    const r = await fetch(base + path, init);
    const text = await r.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch { parsed = null; }
    return { status: r.status, body: parsed };
  };
  const fetchPage = async (url, { bytes = false } = {}) => {
    const r = await fetch(url, { redirect: "manual" });
    return { status: r.status, headers: r.headers, ...(bytes ? { bytes: new Uint8Array(await r.arrayBuffer()) } : {}) };
  };
  const tone = new Uint8Array(fs.readFileSync(new URL("../test/fixtures/media/tone.mp3", import.meta.url)));
  const other = new Uint8Array(tone); for (let i = other.length - 64; i < other.length; i++) other[i] ^= 0x5a;
  const r = await runDraftVerify(boxes.opts, { call, fetchPage, sleep: (ms) => new Promise((ok) => setTimeout(ok, ms)), now: () => Date.now(), log: (l) => console.log(l), media: { bytes: tone, other, name: "draft-verify tone.mp3" } });
  out(r);
}

if (import.meta.url === "file://" + process.argv[1]) main().catch((e) => { console.error(e); process.exit(1); });
