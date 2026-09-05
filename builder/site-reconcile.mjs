// ACKNOWLEDGMENT LOST VERSUS SUPERSEDED (stage 3b, 2026-09-05, owner: "ok go").
//
// A job that began publishing and never recorded a commit — its consumer died,
// its script upload timed out, its commit was refused by the lease wall, or it
// answered a failure after the pointer moved — lands in review with the money
// untouched, because the row cannot say whether the change went live. Until
// this a person answered that question with no instrument to form it.
//
// Stage 7 made it answerable BY COMPARISON. Every publish stages under its own
// immutable prefix (`builds/<slug>/<version>/`, its manifest naming the job),
// ONE pointer names the live version, and the live script answers its own
// version and build on every response. Three facts, one verdict:
//
//   live is ours                 LANDED — the upload landed and the row never
//                                heard: kept, committed and finalized.
//   pointer ours, live older     LOST UPLOAD — the pointer names an immutable
//                                prefix the script never reached; the retry is
//                                safe (same bytes to the same address, the
//                                pointer already there) and nothing else moves.
//   pointer newer than ours      SUPERSEDED — a later publish stands. Its
//                                ancestry (each manifest's `parent`: the pointer
//                                when that publish began) says whether it was
//                                built ON ours — our change is in what is live,
//                                kept — or from before ours: refunded.
//   pointer older, or none       NEVER ACTIVATED — the pointer never moved to
//                                ours, so nothing of ours is live: refunded, the
//                                staged prefix left for the cap to prune.
//   nothing of ours staged       NEVER STAGED — refunded.
//   a fact that cannot be read   UNKNOWN — stays in review, and says why.
//
// Version ids order as strings (`site-versions.mjs`: zero-padded millis and a
// tail), so older and newer are one comparison. Dependency-free: driven by
// test/site-reconcile.test.mjs with literal facts; worker.js reads the facts
// and applies the verdict through `edit_reconcile` and `edit_finalize`.

/** Every kind a verdict can carry; a reader that meets another has met a bug. */
export const RECONCILE_KINDS = Object.freeze([
  "landed", "upload-retried", "lost-upload", "superseded-built-on", "superseded-not-built-on",
  "never-activated", "never-staged", "pointer-unreadable", "builds-unreadable", "live-unreadable",
  "live-ahead", "chain-broken", "retry-exhausted", "no-script-staged", "no-dispatch", "upload-refused", "upload-not-serving",
]);

/** A refunded verdict's sentence: the change never went live. */
export const NEVER_LIVE_MSG = "That change stopped while it was being published and never went live — your site is still serving what it served before, and anything it cost has been refunded. Ask again.";
/** …and the one for a change a later publish overtook before it could go live. */
export const OVERTAKEN_MSG = "That change was overtaken: another change to this site was published before it could go live, so it was set aside — anything it cost has been refunded. Ask again if you still want it.";

/**
 * How often ONE row's lost upload is retried by one isolate before the row is
 * left for a person. The retry is safe but not free — a Cloudflare API call —
 * and a refusal that repeats (a token scope, a namespace gone) would otherwise
 * repeat every sweep tick for ever.
 */
export const RECONCILE_RETRY_MAX = 3;

/** Is `a` a newer version id than `b`? One string comparison, by construction of the id. */
export function newerVersion(a, b) {
  return String(a || "") > String(b || "");
}

/**
 * Our staged version among a site's builds: the manifest naming the JOB,
 * else the one carrying the job's build id (a row marked before the upload).
 * Null when nothing of the job's was staged — or when its prefix was pruned,
 * which the pointer's own `job` can still answer (see `reconcileVerdict`).
 */
export function findMine(builds, job) {
  const id = String((job && job.id) || "");
  const build = String((job && job.build) || "");
  const rows = Array.isArray(builds) ? builds.filter((b) => b && typeof b.id === "string") : [];
  const byJob = id ? rows.find((b) => b.job === id) : null;
  if (byJob) return { version: byJob.id, build: String(byJob.build || "") };
  const byBuild = build ? rows.find((b) => b.build === build) : null;
  return byBuild ? { version: byBuild.id, build: String(byBuild.build || "") } : null;
}

/**
 * Walk the live version's ancestry down to ours. Each manifest's `parent` is the
 * pointer's version when THAT publish began — under the per-site claim (stage
 * 6) a later publish began after ours ended, so ours activated before it began
 * exactly when ours is in the chain. Answers:
 *   "on"      ours is an ancestor of what is live — the change is in it;
 *   "off"     the chain passed below ours without meeting it, or a publish in
 *             it began with no pointer at all (before any activation of ours
 *             could have written one);
 *   "broken"  a manifest the chain needs is gone, so nothing can be said.
 * The pointer's own `parent` stands in for its manifest, which the cap never
 * prunes but a list read can still miss.
 */
export function ancestry(pointer, mine, builds) {
  const byId = new Map();
  for (const b of Array.isArray(builds) ? builds : []) if (b && typeof b.id === "string") byId.set(b.id, b);
  const parentOf = (id) => {
    if (byId.has(id)) return String(byId.get(id).parent || "");
    if (pointer && id === pointer.version) return String(pointer.parent || "");
    return null;
  };
  let v = String((pointer && pointer.version) || "");
  for (let i = 0; i <= byId.size + 1; i++) {
    if (v === mine.version) return "on";
    if (!newerVersion(v, mine.version)) return "off";
    const p = parentOf(v);
    if (p === null) return "broken";
    if (!p) return "off";
    v = p;
  }
  return "broken";
}

const answer = (verdict, kind, why, mine) => ({ verdict, kind, why, mine: mine || null });

/**
 * The verdict, from facts alone.
 *
 *   facts.job      { id, build }        the row: its id and `artifact_build` ("" when none)
 *   facts.pointer  { version, build, parent, job } | null (no pointer) | undefined (UNREADABLE)
 *   facts.live     { build, version } | null (unreadable)
 *   facts.builds   [{ id, build, parent, job }] (a site's complete builds) | null (unreadable)
 *   facts.mine     { version, build } | null — optional; derived from the builds when absent
 *
 * → { verdict: "kept" | "refunded" | "retry" | "unknown", kind, why, mine }
 *
 * THE ORDER IS THE ARGUMENT. Unreadable facts first, because every later rule
 * assumes them. Then whether anything of ours was staged at all. Then the live
 * script, which settles a landed upload whatever the pointer says. Then the
 * pointer against ours: equal is a lost upload, newer is superseded, older or
 * absent is never activated.
 */
export function reconcileVerdict(facts = {}) {
  const job = facts.job || {};
  const pointer = facts.pointer;
  const live = facts.live || null;
  const builds = facts.builds;
  if (pointer === undefined) return answer("unknown", "pointer-unreadable", "the site's pointer could not be read");
  if (!Array.isArray(builds)) return answer("unknown", "builds-unreadable", "the site's builds could not be listed");
  let mine = facts.mine === undefined ? findMine(builds, job) : facts.mine;
  // THE POINTER NAMES ITS JOB: a prefix the cap has pruned is still known to be
  // ours when the pointer says so.
  if (!mine && pointer && job.id && pointer.job === job.id) mine = { version: pointer.version, build: String(pointer.build || "") };
  if (!mine) {
    // Nothing of this job's was staged, so nothing of it can be live — unless
    // a legacy-layout upload landed, which only the live build id can say.
    if (job.build && live && live.build === job.build) return answer("kept", "landed", "the live script carries this job's build id", null);
    if (job.build && !live) return answer("unknown", "live-unreadable", "the job recorded a build id and the live site could not be read", null);
    return answer("refunded", "never-staged", "nothing of this job was staged, so nothing of it is live", null);
  }
  if (!live) return answer("unknown", "live-unreadable", "the live site could not be read", mine);
  if ((live.version && live.version === mine.version) || (live.build && mine.build && live.build === mine.build)) {
    return answer("kept", "landed", "the live script is this job's version", mine);
  }
  if (!pointer) return answer("refunded", "never-activated", "the site has no pointer, so this version was never activated", mine);
  if (pointer.version === mine.version) {
    // A LIVE SCRIPT NEWER THAN THE POINTER cannot happen by the activation
    // order (pointer first, script after) — and a retry here would put OUR
    // script over a newer one. Not decided; said.
    if (live.version && newerVersion(live.version, mine.version)) return answer("unknown", "live-ahead", "the live script is newer than the pointer, which the activation order forbids", mine);
    return answer("retry", "lost-upload", "the pointer names this version and the live script is older: the upload was lost", mine);
  }
  if (newerVersion(pointer.version, mine.version)) {
    const a = ancestry(pointer, mine, builds);
    if (a === "on") return answer("kept", "superseded-built-on", "a later publish was built on this version, so the change is in what is live", mine);
    if (a === "off") return answer("refunded", "superseded-not-built-on", "a later publish was built from before this version, so the change never went live", mine);
    return answer("unknown", "chain-broken", "a later publish stands and its ancestry could not be read back to this version", mine);
  }
  return answer("refunded", "never-activated", "the pointer never moved to this version", mine);
}

/**
 * The reply stored for the customer, in the consumer's own stored shape.
 * A kept job gets the sweep's recovered reply (stage 2a) — the browser already
 * renders it as "published, the details were lost" — carrying which kind
 * decided it; a refunded one gets its sentence and the amount that came back.
 * Null for a verdict that stores nothing.
 */
export function reconcileReply(out, row, refunded = 0) {
  const job = String((row && row.id) || "");
  if (out && out.verdict === "kept") {
    return { status: 200, type: "application/json", body: JSON.stringify({ ok: true, recovered: true, reconciled: out.kind, job, cost: Number(row && row.cost) || 0, build: (row && row.artifact_build) || null }) };
  }
  if (out && out.verdict === "refunded") {
    const msg = out.kind === "superseded-not-built-on" ? OVERTAKEN_MSG : NEVER_LIVE_MSG;
    return { status: 409, type: "application/json", body: JSON.stringify({ ok: false, error: "reconciled", kind: out.kind, job, refunded: Number(refunded) || 0, msg }) };
  }
  return null;
}

/** The facts as an owner may read them: no etag, no body, a count for the builds. */
export function publicFacts(facts = {}) {
  const p = facts.pointer;
  return {
    pointer: p === undefined ? "unreadable" : p === null ? null : { version: p.version, build: p.build || "", parent: p.parent || "", job: p.job || null },
    live: facts.live ? { build: facts.live.build || "", version: facts.live.version || "" } : null,
    mine: facts.mine || null,
    builds: Array.isArray(facts.builds) ? facts.builds.length : "unreadable",
  };
}
