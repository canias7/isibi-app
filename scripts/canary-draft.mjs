// THE DRAFT-FIRST VERIFIER (2026-10-16): what a press reads, and how it judges,
// when it checks that builder work stays in the draft until the owner presses
// Publish, that Publish makes exactly the approved revision live, and that
// nothing is left half-done for recovery.
//
// EVIDENCE, NEVER ASSUMPTION. Every check answers `pass`, `fail` or
// `unverified`, and says why. A reading that could not be taken (a store that
// did not answer, a script that sent no version header, a preview with no
// address) is `unverified`: it can never become a pass. A combined verdict is
// `fail` if any check failed, `unverified` if any could not be judged, and
// `pass` only when every check passed.
//
// WHAT IT READS (all owner-scoped, all read-only):
//   GET /api/site/<slug>/draft?inspect=1   the draft's state, its revisions and
//       preview address, and `inspect`: the live pointer, the running script's
//       answer, the publication journal, the script recovery notes and each
//       unpublished revision's held changes (worker.js `inspectPublishing`)
//   the preview address                    what the preview serves (its
//       version header), fetched by the caller's own `fetchPage`
// AND THE ONE WRITE: `publishPress` calls POST /api/site/<slug>/publish for a
// named revision, and refuses unless the caller passes `confirm: true` — a
// verifier that publishes by accident would be the bug it is looking for.

export const VERDICTS = Object.freeze(["pass", "fail", "unverified"]);

const pass = (why) => ({ verdict: "pass", why });
const fail = (why) => ({ verdict: "fail", why });
const unverified = (why) => ({ verdict: "unverified", why });

/** Every check's verdict folded into one: any fail fails, any unverified is unverified. */
export function combine(checks) {
  const list = Object.values(checks || {});
  if (!list.length) return unverified("no check was made");
  if (list.some((c) => !c || !VERDICTS.includes(c.verdict))) return unverified("a check answered no verdict");
  if (list.some((c) => c.verdict === "fail")) return fail(Object.entries(checks).filter(([, c]) => c.verdict === "fail").map(([k, c]) => k + ": " + c.why).join("; "));
  if (list.some((c) => c.verdict === "unverified")) return unverified(Object.entries(checks).filter(([, c]) => c.verdict === "unverified").map(([k, c]) => k + ": " + c.why).join("; "));
  return pass("every check passed");
}

/** A version read from an inspect field, or null when the field holds no reading. */
const versionOf = (field) => (field && typeof field === "object" && typeof field.version === "string" && field.version ? field.version : null);
const isReading = (snap) => !!(snap && snap.ok === true && snap.state && snap.state.inspect);

/** Read the draft and its publishing evidence. `api(method, path, body)` answers `{status, body}`. */
export async function readDraftEvidence(api, slug) {
  try {
    const r = await api("GET", "/api/site/" + slug + "/draft?inspect=1");
    if (!r || r.status !== 200 || !r.body || r.body.ok !== true || !r.body.inspect) return { ok: false, why: "the draft route answered " + (r ? r.status : "nothing") };
    return { ok: true, state: r.body };
  } catch (e) {
    return { ok: false, why: "the draft route could not be reached: " + String((e && e.message) || e).slice(0, 120) };
  }
}

/** What the preview serves: its status and version header, or why there is none. */
export async function readPreview(fetchPage, state) {
  const url = state && typeof state.preview === "string" ? state.preview : "";
  if (!url) return { ok: false, why: "the draft has no preview address" };
  try {
    const r = await fetchPage(url);
    return { ok: true, url, status: r.status, version: (r.headers && r.headers.get && r.headers.get("x-site-version")) || "" };
  } catch (e) {
    return { ok: false, url, why: "the preview could not be fetched: " + String((e && e.message) || e).slice(0, 120) };
  }
}

/** The draft's newest unpublished version, or null. */
export function draftVersion(state) {
  const revs = state && Array.isArray(state.revisions) ? state.revisions : [];
  return revs.length && typeof revs[revs.length - 1].version === "string" ? revs[revs.length - 1].version : null;
}

/**
 * DRAFT ISOLATION: builder work since `before` changed nothing visitors see.
 * `expectRevisions` is how many new unpublished revisions the work should
 * have made; `expectHeld` the held-change kinds it should have saved.
 */
export function isolationChecks(before, after, { expectRevisions = 1, expectHeld = [] } = {}) {
  const checks = {};
  if (!isReading(before) || !isReading(after)) {
    const why = !isReading(before) ? "the before-reading was not taken: " + ((before && before.why) || "no reading") : "the after-reading was not taken: " + ((after && after.why) || "no reading");
    return { pointer: unverified(why), liveScript: unverified(why), draft: unverified(why) };
  }
  const bi = before.state.inspect, ai = after.state.inspect;
  const bp = versionOf(bi.pointer), ap = versionOf(ai.pointer);
  checks.pointer = bp && ap ? (bp === ap ? pass("the live pointer stayed on " + ap) : fail("the live pointer moved " + bp + " → " + ap + " before Publish"))
    : unverified("the live pointer was not read both times (" + JSON.stringify(bi.pointer) + " / " + JSON.stringify(ai.pointer) + ")");
  const bs = versionOf(bi.liveScript), as = versionOf(ai.liveScript);
  checks.liveScript = bs && as ? (bs === as ? pass("the running script stayed on " + as) : fail("the running script moved " + bs + " → " + as + " before Publish"))
    : unverified("the running script did not answer with a version both times (" + JSON.stringify(bi.liveScript) + " / " + JSON.stringify(ai.liveScript) + ")");
  const before0 = Array.isArray(before.state.revisions) ? before.state.revisions.length : null;
  const after0 = Array.isArray(after.state.revisions) ? after.state.revisions.length : null;
  checks.draft = before0 === null || after0 === null ? unverified("the revisions were not read")
    : after0 - before0 === expectRevisions && after.state.unpublished === true ? pass(expectRevisions + " new unpublished revision(s)")
    : fail("expected " + expectRevisions + " new unpublished revision(s), saw " + (after0 - before0) + " (unpublished " + after.state.unpublished + ")");
  if (expectHeld.length) {
    if (!Array.isArray(ai.held)) checks.held = unverified("the held changes were not read");
    else {
      const kinds = new Set(ai.held.flatMap((h) => Object.keys(h.kinds || {})));
      const missing = expectHeld.filter((k) => !kinds.has(k));
      checks.held = missing.length ? fail("no held change of kind " + missing.join(", ")) : pass("held: " + [...kinds].join(", "));
    }
  }
  return checks;
}

/** THE PREVIEW: it serves the draft's newest version. */
export function previewChecks(after, preview) {
  if (!isReading(after)) return { preview: unverified("the draft was not read") };
  const want = draftVersion(after.state);
  if (!want) return { preview: unverified("the draft names no unpublished version") };
  if (!preview || preview.ok !== true) return { preview: unverified((preview && preview.why) || "the preview was not fetched") };
  if (preview.status !== 200) return { preview: fail("the preview answered " + preview.status) };
  if (!preview.version) return { preview: unverified("the preview sent no version header") };
  return { preview: preview.version === want ? pass("the preview serves " + want) : fail("the preview serves " + preview.version + ", the draft is " + want) };
}

/**
 * THE EXPLICIT PUBLISH. Calls the owner's route for the named revision, and
 * only with `confirm: true`. Answers `{called, status, body}`.
 */
export async function publishPress(api, slug, { revision, version, confirm = false } = {}) {
  if (confirm !== true) return { called: false, refused: "publishPress needs confirm: true" };
  if (!Number.isSafeInteger(revision) || typeof version !== "string" || !version) return { called: false, refused: "name the revision and its version" };
  const r = await api("POST", "/api/site/" + slug + "/publish", { revision, version });
  return { called: true, status: r ? r.status : 0, body: r ? r.body : null };
}

/**
 * EXPLICIT PUBLISHING: the named revision, and nothing else, went live — once.
 * `later` (2026-10-16): the revisions saved AFTER the click (`{revision,
 * version}` each), which the approval must not have taken in: each still
 * reads unpublished, and the live pointer names none of their versions. Not
 * given, the check says it was not exercised — never a pass.
 */
export function publishChecks({ chosen, press, after, repeat, later = null }) {
  const checks = {};
  const want = chosen && chosen.version;
  checks.answer = !press || !press.called ? unverified("Publish was not called: " + ((press && press.refused) || "no press"))
    : press.status === 200 && press.body && press.body.ok === true && press.body.published === want ? pass("Publish answered " + want)
    : fail("Publish answered " + (press && press.status) + " " + JSON.stringify(press && press.body && { ok: press.body.ok, published: press.body.published, error: press.body.error }));
  if (!isReading(after)) {
    const why = "the after-reading was not taken: " + ((after && after.why) || "no reading");
    Object.assign(checks, { pointer: unverified(why), liveScript: unverified(why), journal: unverified(why), drafted: unverified(why) });
  } else {
    const ai = after.state.inspect;
    const p = versionOf(ai.pointer), s = versionOf(ai.liveScript);
    checks.pointer = p ? (p === want ? pass("the pointer names " + want) : fail("the pointer names " + p + ", not " + want)) : unverified("the pointer was not read: " + JSON.stringify(ai.pointer));
    checks.liveScript = s ? (s === want ? pass("the running script answers " + want) : fail("the running script answers " + s + ", not " + want)) : unverified("the running script answered no version: " + JSON.stringify(ai.liveScript));
    const j = ai.journal || {};
    checks.journal = j.unreadable ? unverified("the journal could not be read") : j.none || j.closed ? pass("no publication left open") : fail("the publication is still at " + j.phase);
    const left = Array.isArray(after.state.revisions) ? after.state.revisions.filter((r) => r.revision <= chosen.revision) : null;
    checks.drafted = left === null ? unverified("the revisions were not read") : left.length ? fail("revisions up to " + chosen.revision + " still read unpublished") : pass("nothing up to revision " + chosen.revision + " is left unpublished");
    if (!Array.isArray(later) || !later.length) checks.later = unverified("no revision was saved after the click, so keeping later drafts out was not exercised");
    else if (!Array.isArray(after.state.revisions)) checks.later = unverified("the revisions were not read");
    else {
      const still = new Set(after.state.revisions.map((r) => r && r.revision));
      const taken = later.filter((l) => !still.has(l.revision));
      const live = later.filter((l) => l.version && l.version === p && l.version !== want);
      checks.later = taken.length ? fail("revision(s) " + taken.map((l) => l.revision).join(", ") + ", saved after the click, no longer read unpublished")
        : live.length ? fail("the live pointer names " + p + ", a version saved after the click")
        : pass(later.length + " revision(s) saved after the click stay unpublished");
    }
  }
  checks.repeat = !repeat || !repeat.called ? unverified("the repeated press was not made")
    : repeat.status === 200 && repeat.body && repeat.body.already === true ? pass("pressed again: already published, nothing redone")
    : fail("pressed again: " + repeat.status + " " + JSON.stringify(repeat.body && { already: repeat.body.already, published: repeat.body.published }));
  return checks;
}

/** RECOVERY LEFT NOTHING: no stale recovery note, no publication stuck open, the running script on the pointer. */
export function recoveryChecks(snap) {
  if (!isReading(snap)) return { notes: unverified("not read"), journal: unverified("not read"), aligned: unverified("not read") };
  const i = snap.state.inspect;
  const checks = {};
  const n = i.notes || {};
  checks.notes = n.unreadable || typeof n.count !== "number" ? unverified("the recovery notes could not be listed")
    : n.count === 0 ? pass("no recovery note left")
    : n.oldestMs > n.windowMs ? fail(n.count + " recovery note(s), the oldest " + Math.round(n.oldestMs / 1000) + " s old, past the " + Math.round(n.windowMs / 1000) + " s window")
    : unverified(n.count + " recovery note(s) still inside their window — an upload may be in flight; read again after it");
  const j = i.journal || {};
  checks.journal = j.unreadable ? unverified("the journal could not be read") : j.none || j.closed ? pass("no publication open")
    : j.running ? unverified("a publication is running (" + j.phase + "); read again after it") : fail("a publication is stopped at " + j.phase + " with no runner");
  const p = versionOf(i.pointer), s = versionOf(i.liveScript);
  checks.aligned = p && s ? (p === s ? pass("the running script is on the pointer (" + p + ")") : fail("the running script answers " + s + ", the pointer names " + p))
    : unverified("the pointer or the running script gave no version (" + JSON.stringify(i.pointer) + " / " + JSON.stringify(i.liveScript) + ")");
  return checks;
}

/**
 * THE SWITCHES BEFORE A PRESS (2026-10-16): `runtime` is `/api/site/runtime`'s
 * answer; `probe` the container's `env` probe line (`{probe: "env",
 * draftFirst, parallelWrites}`) read back from `/api/site/job-probe?id=…`, or
 * null when none was read. `want` is `{draftFirst, parallelWrites}`.
 *
 * THREE READINGS, KEPT APART: the Worker's own (`draftFirst`), the job's by
 * CALCULATION (`jobDraftFirst`: what `jobSecrets` would hand a launch), and the
 * job's as OBSERVED in a real job child (the probe). Only the probe is the
 * container's answer; without it the observed check is unverified, however
 * the calculated one reads.
 */
export function switchChecks(runtime, probe, want) {
  const checks = {};
  // THE MONEY SWITCH (audit A25-6, 2026-10-23) is checked when a wanted
  // value is given for it, so an older caller's two-switch `want` reads as before.
  const pairs = [["draftFirst", "jobDraftFirst"], ["parallelWrites", "jobParallelWrites"], ...(want && typeof want.imagePurchases === "boolean" ? [["imagePurchases", "jobImagePurchases"]] : [])];
  for (const [w, j] of pairs) {
    const r = runtime && typeof runtime === "object" ? runtime : {};
    checks[w + ".worker"] = typeof r[w] !== "boolean" ? unverified("the runtime route did not report " + w)
      : r[w] === want[w] ? pass(w + " is " + r[w] + " at the Worker") : fail(w + " is " + r[w] + " at the Worker, wanted " + want[w]);
    checks[w + ".jobCalculated"] = typeof r[j] !== "boolean" ? unverified("the runtime route did not report " + j)
      : r[j] === want[w] ? pass(w + " would be handed to a job as " + r[j] + " (calculated)") : fail(w + " would be handed to a job as " + r[j] + " (calculated), wanted " + want[w]);
    checks[w + ".jobObserved"] = !probe || probe.probe !== "env" || typeof probe[w] !== "boolean" ? unverified("no container env probe was read (" + (probe && probe.error ? probe.error : "none") + ")")
      : probe[w] === want[w] ? pass(w + " read " + probe[w] + " by a real job child (observed)") : fail(w + " read " + probe[w] + " by a real job child (observed), wanted " + want[w]);
  }
  return checks;
}
