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
  "draft-saved", "draft-unreadable", "draft-held-unreadable", "draft-trimmed", "builds-partly-unread", "draft-manifest-unread",
]);

/**
 * A refunded verdict's sentence: the change never went live.
 *
 * NOTHING ABOUT MONEY (2026-09-25). "Anything it cost has been refunded" was
 * said whatever the refund answered; the browser now states what the edit cost
 * from the job's own row (`servedEditReply` in worker.js), which is the record
 * of whether the refund landed.
 */
//
// ITS PAGES, NOT THE WHOLE SITE (2026-10-07): an addition's database changes
// go in before its publish, and stand when the publish never goes live — so
// "your site is still serving what it served before" said nothing changed
// beside tables that had. What else stands is the reply's own facts' to say.
export const NEVER_LIVE_MSG = "That change stopped while it was being published and never went live — your site's pages are as they were. Ask again.";
/** …and the one for a change a later publish overtook before it could go live. */
export const OVERTAKEN_MSG = "That change was overtaken: another change to this site was published before it could go live, so it was set aside. Ask again if you still want it.";

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

const answer = (verdict, kind, why, mine, extra = {}) => ({ verdict, kind, why, mine: mine || null, ...extra });

// ── DRAFT-FIRST: A SAVE IS THE OUTCOME (2026-10-16, Codex's review of `74cbce6b`)
//
// Under draft-first a job's success is not the live pointer moving — nothing
// goes live without the owner's Publish — but its own revision in the site's
// draft record: written in one conditional write naming the job, its code
// version and its held journal together (`saveDraftRecord`,
// `sealHeldRevision`). So a job whose record write landed and whose answer
// was lost, or whose process stopped after it, is SAVED, kept and billed
// once — never refunded as "never activated". Only this job's own revision
// counts: a draft merely existing, its selected version, or the job's version
// in `history` (an older code-only save, kept there and refused) proves
// nothing, and the live-site verdicts below decide as before.
//
//   facts.draft     { state: "read", record } | { state: "none" } | { state: "unreadable" }
//                   — absent: not consulted (a caller from before drafts)
//   facts.journals  { [heldId]: true (there) | false (missing) | undefined (unreadable) }
//   facts.draft.trimmed  true when this job's revision could have been trimmed
//                   (only published revisions are, 2026-10-16); absent: a
//                   record that says it was trimmed, or one the earlier
//                   60-revision limit cut, proves no absence
const trimmedFact = (d, rec) => (typeof d.trimmed === "boolean" ? d.trimmed : !!rec.trimmed || (rec.revs.length >= 60 && !!rec.revs[0] && rec.revs[0].n > 1));
export function draftVerdict(facts, job, mine) {
  const d = facts.draft;
  if (!d || !job.id) return null;
  if (d.state === "unreadable") return answer("unknown", "draft-unreadable", "the site's draft record could not be read, so whether this job's work was saved is not known", mine);
  if (d.state !== "read" || !d.record || !Array.isArray(d.record.revs)) return null;
  const rec = d.record;
  // EVERY REVISION NAMING THIS JOB, EACH BY WHAT ITS OWN EVIDENCE SAYS
  // (2026-10-16, Codex's review of `5eca67cb`). A revision naming this job is
  // durable evidence that it saved, and contradicts "never staged":
  //   - of this job's version (`mine`), or of a version whose manifest, read
  //     on its own (`facts.manifests`), names this job → its code was saved;
  //   - carrying held changes on a version whose manifest names another job
  //     (a held-only seal on the draft as it stood) → its held changes were
  //     saved, proven by the journal below;
  //   - of a version whose manifest is missing or unreadable → cannot tell,
  //     unknown and recoverable, never refunded, until it reads.
  // Without exact reads (an older caller), the earlier rule stands.
  const own = rec.revs.filter((x) => x && x.job === job.id);
  const ms = facts.manifests && typeof facts.manifests === "object" ? facts.manifests : null;
  let r = null, blocked = null;
  for (const x of own) {
    if (mine && x.version === mine.version) { r = x; break; }
    const m = ms && Object.hasOwn(ms, x.version) ? ms[x.version] : null;
    if (!m) { if (!ms && !mine && x.held) { r = x; break; } continue; }
    if (m.state === "read") {
      const theirs = !(m.manifest && m.manifest.job === job.id);
      if (!theirs || x.held) { r = x; break; }
      continue;
    }
    blocked = blocked || { x, why: m.state === "absent" ? "missing" : "unreadable" };
  }
  if (!r && blocked) return answer("unknown", "draft-manifest-unread", "this job's own draft revision names a version whose manifest is " + blocked.why + ", so whether its work was saved cannot be told yet", mine, { revision: blocked.x.n, version: blocked.x.version });
  if (r) {
    if (r.held) {
      const j = facts.journals ? facts.journals[r.held] : undefined;
      if (j !== true) return answer("unknown", "draft-held-unreadable", "this job's revision names held changes that could not be read back" + (j === false ? " (the journal is missing)" : ""), mine);
    }
    return answer("kept", "draft-saved", "this job's own revision is in the site's draft: its work was saved, not published", mine,
      { revision: r.n, version: r.version, held: r.held || null, selected: rec.version === r.version });
  }
  // A PUBLISHED REVISION MAY HAVE BEEN TRIMMED FROM THE LIST: absence is not
  // proof for a job that began before the trimming (the reader's `trimmed`,
  // `revisionsTrimmed` in site-draft.mjs); without that fact, a record that
  // says it was trimmed, or one the earlier limit cut, proves nothing.
  if (trimmedFact(d, rec)) return answer("unknown", "draft-trimmed", "the draft record keeps only its latest published revisions, so this job's absence from it proves nothing", mine);
  return null;
}

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
  // UNDER DRAFT-FIRST, THIS JOB'S OWN SAVED REVISION DECIDES FIRST.
  const dv = draftVerdict(facts, job, mine);
  if (dv) return dv;
  // NOT FOUND IS NOT ABSENT WHILE A MANIFEST COULD NOT BE READ (2026-10-16,
  // Codex's review of `305c9425`): it may be this job's version.
  if (!mine && Array.isArray(facts.buildsUnread) && facts.buildsUnread.length) return answer("unknown", "builds-partly-unread", "some of the site's versions could not be read, so whether this job staged one is not known", null);
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
 * WHAT A REFUNDED VERDICT'S REPLY KEEPS OF THE ROUTE'S OWN FAILURE ANSWER
 * (2026-10-07): the evidence of what stands — the outcome its exit read off
 * its own evidence, the requirement and warning outcomes told under it, and
 * an edit's steps that went through outside the publish — which the verdict
 * does not change: it says only that the publish never went live, and that
 * failure answer said so too. Its claims about the publish are the verdict's
 * now. Never kept from an answer that claimed success: those were told as if
 * the page went out.
 */
export const FAILURE_EVIDENCE = Object.freeze(["outcome", "requirementsTold", "warningsTold", "landed"]);

/** The answer a row stored before its verdict, read, or null. */
export function storedAnswer(row) {
  const r = row && row.result;
  if (!r || typeof r !== "object" || typeof r.body !== "string") return null;
  try { const b = JSON.parse(r.body); return b && typeof b === "object" && !Array.isArray(b) ? b : null; } catch { return null; }
}

/**
 * The reply stored for the customer, in the consumer's own stored shape.
 * A kept job gets the sweep's recovered reply (stage 2a) — the browser already
 * renders it as "published, the details were lost" — carrying which kind
 * decided it; a refunded one gets its sentence and the amount that came back.
 * Null for a verdict that stores nothing.
 *
 * AND WHAT STANDS (2026-10-07): the job's database record as the verdict
 * settled it (`migration`, read by the reply's own `outcomeOf`), and on a
 * refunded verdict the route's own evidence (`FAILURE_EVIDENCE`) and the
 * context its reply is written from (`replyFor`) — so a refund after the
 * tables went in is never told as a change that left the site as it was,
 * and the customer's reply is the model's, from those facts.
 */
export function reconcileReply(out, row, refunded = 0, { prior = null, migration = null } = {}) {
  const job = String((row && row.id) || "");
  const mig = migration && typeof migration === "object" && !Array.isArray(migration) ? { migration } : {};
  if (out && out.verdict === "kept") {
    // A SAVED DRAFT IS SAID AS ONE (2026-10-16): its revision and version, not
    // published, and whether its preview is known ready — never "published,
    // the details were lost".
    const saved = out.kind === "draft-saved" && Number.isSafeInteger(out.revision) && out.revision > 0
      ? { draft: { published: false, version: String(out.version || ""), revision: out.revision, selected: out.selected === true, preview: out.preview === "ready" || out.preview === "pending" ? out.preview : "unknown" } }
      : {};
    return { status: 200, type: "application/json", body: JSON.stringify({ ok: true, recovered: true, reconciled: out.kind, job, cost: Number(row && row.cost) || 0, build: (row && row.artifact_build) || null, ...saved, ...mig }) };
  }
  if (out && out.verdict === "refunded") {
    const msg = out.kind === "superseded-not-built-on" ? OVERTAKEN_MSG : NEVER_LIVE_MSG;
    const p = prior && typeof prior === "object" && !Array.isArray(prior) ? prior : null;
    const kept = {};
    if (p && p.ok === false) for (const k of FAILURE_EVIDENCE) if (Object.hasOwn(p, k)) kept[k] = p[k];
    if (p && p.replyFor && typeof p.replyFor === "object" && !Array.isArray(p.replyFor)) kept.replyFor = p.replyFor;
    // WHAT THE JOB ITSELF ANSWERED (2026-10-16): a refusal the request reads by
    // its code — another part of the request overlapping it — is kept as
    // `was`, so it is not lost under "reconciled".
    if (p && p.ok === false && typeof p.error === "string" && /^[a-z-]{1,40}$/.test(p.error)) kept.was = p.error;
    return { status: 409, type: "application/json", body: JSON.stringify({ ...kept, ...mig, ok: false, error: "reconciled", kind: out.kind, job, refunded: Number(refunded) || 0, msg }) };
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
    ...(facts.draft ? { draft: facts.draft.state === "read" ? { version: facts.draft.record.version, rev: facts.draft.record.rev } : facts.draft.state } : {}),
  };
}
