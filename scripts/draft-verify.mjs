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
//   media-setup  STORAGE-WRITING, no model call, free (2026-10-17, the live
//              batch): the three fixtures uploaded to the site's library — a
//              video, an audio file and a disposable audio file — each read
//              back live whole and by range (206). A new file is not a held
//              change, so it serves at once and saves no draft revision; the
//              run prints the FILES line the next two modes take.
//   media-held   STORAGE-WRITING, no model call, free: with the FILES box, the
//              video and the audio replaced (each held), the disposable file
//              deleted (held), and a longer upload started and cancelled. Live
//              keeps every original byte for byte and the disposable file;
//              the preview plays both replacements and answers 404 for the
//              deleted one; the cancelled upload cannot be completed.
//   media-check  read-only, free: with the FILES box, after the owner's
//              Publish — both replacements play live (whole and by range) and
//              the disposable file answers 404 live.
//
// NOTHING HERE TURNS A SWITCH, APPLIES SQL, BUILDS AN IMAGE OR BUYS A PICTURE.
import fs from "node:fs";
import {
  combine, readDraftEvidence, readPreview, isolationChecks, previewChecks,
  publishPress, publishChecks, recoveryChecks, switchChecks,
} from "./canary-draft.mjs";

export const MODES = Object.freeze(["rehearsal", "send", "media", "publish", "recovery", "media-setup", "media-held", "media-check"]);
const PAID = new Set(["send"]);
const WRITES = new Set(["media", "media-setup", "media-held"]);
/** The modes that read the FILES box (the names `media-setup` printed). */
const NEEDS_FILES = new Set(["media-held", "media-check"]);
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
    files: s("DV_FILES"),
  };
  // A BOX FILLED FOR ANOTHER MODE is refused, never quietly ignored: a press
  // that meant to publish and ran a rehearsal would read as a pass of nothing.
  const filledFor = [];
  if (opts.message && mode !== "send") filledFor.push("message");
  if (opts.revision !== null && mode !== "publish") filledFor.push("revision");
  if (opts.publish === "yes" && mode !== "publish") filledFor.push("publish");
  if (opts.spend === "yes" && mode !== "send") filledFor.push("spend");
  if (opts.files && !NEEDS_FILES.has(mode)) filledFor.push("files");
  if (filledFor.length) return { ok: false, refused: "box(es) " + filledFor.join(", ") + " filled beside mode " + mode };
  if (NEEDS_FILES.has(mode)) {
    const f = readFiles(opts.files);
    if (!f) return { ok: false, refused: "the files box must read video=<name>,audio=<name>,disposable=<name> as media-setup printed it" };
    opts.files = f;
  }
  return { ok: true, opts };
}

/** The FILES box, strictly: `{ video, audio, disposable }` (library names), or null. */
export function readFiles(v) {
  const out = {};
  for (const part of String(v || "").split(",").map((x) => x.trim()).filter(Boolean)) {
    const m = part.match(/^(video|audio|disposable)=([a-f0-9]{32}\.[a-z0-9]{2,5})$/);
    if (!m || Object.hasOwn(out, m[1])) return null;
    out[m[1]] = m[2];
  }
  return out.video && out.audio && out.disposable ? out : null;
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

  // ── THE LIVE BATCH'S MEDIA (2026-10-17): the owner's video and audio
  //    hosting, without a hand in the Files panel ─────────────────────────
  if (opts.mode === "media-setup") {
    const fx = io.fixtures;
    if (!fx || !fx.video || !fx.audio || !fx.disposable) { results.refused = ["no media fixtures were given"]; return finish(results); }
    const files = {};
    for (const [role, bytes, name] of [["video", fx.video, "draft-verify video.mp4"], ["audio", fx.audio, "draft-verify audio.mp3"], ["disposable", fx.disposable, "draft-verify disposable.m4a"]]) {
      const up = await uploadMedia(call, opts.slug, bytes, name, {});
      const d = up.done && up.done.body;
      if (!d || up.done.status >= 300 || typeof d.name !== "string") { results.checks["setup." + role + ".upload"] = fail("did not upload: " + JSON.stringify((up.done || up.p || up.st || {}).body || {}).slice(0, 200)); return finish(results); }
      results.checks["setup." + role + ".upload"] = pass("uploaded as " + d.name);
      results.checks["setup." + role + ".notHeld"] = d.held === true ? fail("a new file was held, which no held kind describes") : pass("a new file serves at once (not a held change)");
      files[role] = { name: d.name, url: d.url || ("/u/" + opts.slug + "/" + d.name), bytes: bytes.length };
      Object.assign(results.checks, prefix("setup." + role + ".live", await playsAs(io, liveUrl(opts.slug, files[role].url), bytes)));
    }
    const after = await readDraftEvidence(api, opts.slug);
    const n0 = before.ok ? before.state.revisions.length : null, n1 = after.ok ? after.state.revisions.length : null;
    results.checks["setup.noRevision"] = n0 === null || n1 === null ? unverified("the draft was not read both times") : n1 === n0 ? pass("no draft revision was saved by the uploads (" + n0 + " before and after)") : fail("the uploads saved " + (n1 - n0) + " draft revision(s)");
    results.readings.files = files;
    results.readings.filesBox = "video=" + files.video.name + ",audio=" + files.audio.name + ",disposable=" + files.disposable.name;
    log("FILES " + results.readings.filesBox);
    return finish(results);
  }

  if (opts.mode === "media-held") {
    const fx = io.fixtures, f = opts.files;
    if (!fx || !fx.video || !fx.audio || !fx.disposable || !fx.videoB || !fx.audioB) { results.refused = ["no media fixtures were given"]; return finish(results); }
    const pointer0 = await liveVersion(io, opts.slug);
    for (const [role, bytes] of [["video", fx.videoB], ["audio", fx.audioB]]) {
      const ext = f[role].split(".").pop();
      const rep = await uploadMedia(call, opts.slug, bytes, "draft-verify " + role + " replacement." + ext, { replace: f[role] });
      const d = rep.done && rep.done.body;
      results.checks["held." + role + ".replace"] = !d ? fail("the replacement did not finish: " + JSON.stringify((rep.p || rep.st || {}).body || {}).slice(0, 200))
        : d.held === true && d.replaces === f[role] && d.name !== f[role] ? pass("held in the draft as revision " + (d.draft && d.draft.revision))
        : fail("the replacement was not held: " + JSON.stringify(d).slice(0, 240));
      results.readings[role + "Revision"] = d && d.draft ? d.draft.revision : null;
    }
    const del = await call("DELETE", "/api/site/" + opts.slug + "/uploads/" + f.disposable);
    results.checks["held.disposable.delete"] = del && del.status < 300 && del.body && del.body.held === true ? pass("the deletion is held in the draft as revision " + (del.body.draft && del.body.draft.revision))
      : fail("the deletion was not held: " + (del ? del.status : 0) + " " + JSON.stringify(del && del.body).slice(0, 200));
    results.readings.deleteRevision = del && del.body && del.body.draft ? del.body.draft.revision : null;
    // A LONGER UPLOAD STARTED AND CANCELLED: one part sent, then aborted; it
    // can no longer be completed, so nothing of it is ever kept.
    results.checks["held.cancel"] = await cancelUpload(call, opts.slug, fx.video);
    // LIVE: every original, byte for byte, and the disposable file still there.
    Object.assign(results.checks, prefix("held.live.video", await playsAs(io, liveUrl(opts.slug, "/u/" + opts.slug + "/" + f.video), fx.video)));
    Object.assign(results.checks, prefix("held.live.audio", await playsAs(io, liveUrl(opts.slug, "/u/" + opts.slug + "/" + f.audio), fx.audio)));
    Object.assign(results.checks, prefix("held.live.disposable", await playsAs(io, liveUrl(opts.slug, "/u/" + opts.slug + "/" + f.disposable), fx.disposable)));
    const pointer1 = await liveVersion(io, opts.slug);
    results.checks["held.pointer"] = !pointer0 || !pointer1 ? unverified("the live version was not read both times") : pointer0 === pointer1 ? pass("the live version did not move (" + pointer0 + ")") : fail("the live version moved: " + pointer0 + " → " + pointer1);
    // PREVIEW: both replacements at the old addresses; the deleted file gone.
    const after = await readDraftEvidence(api, opts.slug);
    const pv = after.ok && typeof after.state.preview === "string" ? after.state.preview.replace(/\/$/, "") : "";
    results.readings.preview = pv || null;
    results.readings.draftAfter = after.ok ? { state: after.state.state, revisions: after.state.revisions } : { unreadable: after.why };
    if (!pv) results.checks["held.preview"] = unverified("the draft has no preview address");
    else {
      Object.assign(results.checks, prefix("held.preview.video", await playsAs(io, pv + "/u/" + opts.slug + "/" + f.video, fx.videoB)));
      Object.assign(results.checks, prefix("held.preview.audio", await playsAs(io, pv + "/u/" + opts.slug + "/" + f.audio, fx.audioB)));
      const gone = await io.fetchPage(pv + "/u/" + opts.slug + "/" + f.disposable, { bytes: false }).catch(() => null);
      results.checks["held.preview.disposable"] = !gone ? unverified("the preview was not read") : gone.status === 404 ? pass("the preview answers 404 for the deleted file") : fail("the preview answered " + gone.status + " for the deleted file");
    }
    return finish(results);
  }

  if (opts.mode === "media-check") {
    const fx = io.fixtures, f = opts.files;
    if (!fx || !fx.videoB || !fx.audioB) { results.refused = ["no media fixtures were given"]; return finish(results); }
    Object.assign(results.checks, prefix("check.live.video", await playsAs(io, liveUrl(opts.slug, "/u/" + opts.slug + "/" + f.video), fx.videoB)));
    Object.assign(results.checks, prefix("check.live.audio", await playsAs(io, liveUrl(opts.slug, "/u/" + opts.slug + "/" + f.audio), fx.audioB)));
    const gone = await io.fetchPage(liveUrl(opts.slug, "/u/" + opts.slug + "/" + f.disposable), { bytes: false }).catch(() => null);
    results.checks["check.live.disposable"] = !gone ? unverified("the live address was not read") : gone.status === 404 ? pass("the disposable file answers 404 live") : fail("the disposable file answered " + gone.status + " live");
    Object.assign(results.checks, prefix("recovery", recoveryChecks(before)));
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

const liveUrl = (slug, path) => "https://" + slug + ".gofarther.app" + path;

/** The live site's version, from its home page's `x-site-version` header, or "". */
async function liveVersion(io, slug) {
  try { const r = await io.fetchPage(liveUrl(slug, "/"), { bytes: false }); return (r.headers && r.headers.get && r.headers.get("x-site-version")) || ""; } catch { return ""; }
}

/**
 * WHETHER AN ADDRESS PLAYS `want`: the whole file byte for byte, and a range
 * (the first 100 bytes) answered 206 with exactly those bytes — what a player
 * asks when it seeks. Each reading not taken is unverified, never a pass.
 */
export async function playsAs(io, url, want) {
  const out = {};
  const whole = await io.fetchPage(url, { bytes: true }).catch(() => null);
  out.whole = !whole || !whole.bytes ? unverified("not read: " + url)
    : whole.status === 200 && equalBytes(whole.bytes, want) ? pass("200, " + want.length + " bytes, byte for byte")
    : fail("answered " + whole.status + " with " + (whole.bytes ? whole.bytes.length : 0) + " bytes that are not the expected file");
  const part = await io.fetchPage(url, { bytes: true, range: "bytes=0-99" }).catch(() => null);
  const head = want.subarray(0, 100);
  out.range = !part || !part.bytes ? unverified("the range was not read")
    : part.status === 206 && equalBytes(part.bytes, head) ? pass("206 for bytes 0-99 (" + ((part.headers && part.headers.get && part.headers.get("content-range")) || "no content-range") + ")")
    : fail("the range answered " + part.status + " with " + part.bytes.length + " bytes");
  return out;
}

/** A longer upload started, one part sent, then cancelled; a completion afterwards must be refused. */
async function cancelUpload(call, slug, head) {
  const base = "/api/site/" + slug + "/media";
  const size = 9 * 1024 * 1024;
  const st = await call("POST", base, { json: { name: "draft-verify cancelled.mp4", size, type: "" } });
  if (!st || st.status >= 300 || !st.body || typeof st.body.session !== "string") return fail("the longer upload did not start: " + (st ? st.status : 0));
  const first = Math.min(st.body.partBytes, size);
  // THE PART BEGINS AS A REAL MP4 DOES (the route checks a file's first bytes).
  const part = new Uint8Array(first); part.set(head.subarray(0, Math.min(head.length, first)));
  const p = await call("PUT", base + "/" + st.body.session + "/1", { body: part });
  if (!p || p.status >= 300) return fail("its first part was not taken: " + (p ? p.status : 0));
  const ab = await call("DELETE", base + "/" + st.body.session);
  if (!ab || ab.status >= 300) return fail("the cancel answered " + (ab ? ab.status : 0));
  const late = await call("POST", base + "/" + st.body.session + "/complete", { json: { parts: [{ n: 1, etag: p.body && p.body.etag }] } });
  return late && late.status >= 400 ? pass("cancelled after one part; a completion afterwards was refused (" + late.status + ")") : fail("the cancelled upload still completed (" + (late ? late.status : 0) + ")");
}

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
  const fetchPage = async (url, { bytes = false, range = "" } = {}) => {
    const r = await fetch(url, { redirect: "manual", headers: range ? { range } : {} });
    return { status: r.status, headers: r.headers, ...(bytes ? { bytes: new Uint8Array(await r.arrayBuffer()) } : {}) };
  };
  const tone = new Uint8Array(fs.readFileSync(new URL("../test/fixtures/media/tone.mp3", import.meta.url)));
  const other = new Uint8Array(tone); for (let i = other.length - 64; i < other.length; i++) other[i] ^= 0x5a;
  const fixture = (f) => new Uint8Array(fs.readFileSync(new URL("../test/fixtures/media/" + f, import.meta.url)));
  const fixtures = { video: fixture("clip.mp4"), audio: tone, disposable: fixture("tone.m4a"), videoB: fixture("clip-b.mp4"), audioB: fixture("tone-b.mp3") };
  const r = await runDraftVerify(boxes.opts, { call, fetchPage, sleep: (ms) => new Promise((ok) => setTimeout(ok, ms)), now: () => Date.now(), log: (l) => console.log(l), media: { bytes: tone, other, name: "draft-verify tone.mp3" }, fixtures });
  out(r);
}

if (import.meta.url === "file://" + process.argv[1]) main().catch((e) => { console.error(e); process.exit(1); });
