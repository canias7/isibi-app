/**
 * THE SITE'S PUBLISH TURN AND THE REBASE (2026-10-15, the concurrent-execution
 * round).
 *
 * Jobs of one request whose targets do not conflict may now run at once
 * (`clearToWrite`). Every publish still writes the site whole — the pages, the
 * parts, the config, the sidecar — from the list its job holds, and that list
 * was read when the job began. Two jobs publishing their lists as they stand
 * would each put back what the other changed. So:
 *
 *   1. ONE PUBLISH AT A TIME, per site: a job takes the site's turn
 *      (`publish-turn/<slug>.json`, written only on its etag) before it reads
 *      the site again, and gives it back after its publish has ended. A job
 *      that rewrites the site's config before it publishes (`holdsConfig`)
 *      takes the turn before its first write and holds it to the end.
 *   2. THE JOB'S OWN CHANGES ONLY, onto the site as it is then (`rebaseFiles`):
 *      what the job changed from what it began with is applied to what is
 *      stored now; what it did not change is taken as stored now, never from
 *      its old copy. A file both it and another job changed, differently, is a
 *      conflict: refused, never overwritten.
 *
 * Nothing here writes; the Worker reads and writes through these.
 */

/** Where a site's turn is kept. */
export const TURN_ROOT = "publish-turn/";
export const turnKey = (slug) => TURN_ROOT + slug + ".json";
/** How long a turn stands with nobody renewing it: past the longest publish, so a live holder never loses it between renewals. */
export const TURN_TTL_MS = 10 * 60 * 1000;
/** How often a job waiting for the turn looks again. */
export const TURN_POLL_MS = 3000;
// THE WAIT HAS ITS OWN LIMIT (2026-10-18, audit A03-3): twice a turn's life.
// A holder that keeps its turn longer than that is stuck, and waiting the
// rest of a 50-minute budget behind it only holds the reserve and the reply.
export const TURN_WAIT_MS = 2 * TURN_TTL_MS;
// …AND A STORE THAT FAILS THIS MANY READS IN A ROW is not waited on either.
export const TURN_UNREAD_MAX = 5;

/**
 * A HOLDER THAT HAS STOPPED RENEWING (audit S7-4, 2026-10-23, the owner's
 * option 1). A live job renews its turn on its heartbeat (30 s) and Publish
 * every 60 s, each rewriting `at`; a job whose lease has expired (90 s with no
 * beat) is the only kind another writer can claim beside, and its turn's `at`
 * is then at least that old. Such a holder may have died between its draft
 * record and its editable copy, so a reader waits for the turn to lapse and
 * repairs under it, rather than reading the copy as current.
 */
export const TURN_STALE_MS = 75 * 1000;
export function turnLooksDead(turn, now = Date.now()) {
  if (!turn || typeof turn !== "object" || !Number.isFinite(turn.until) || !Number.isFinite(turn.at) || turn.at <= 0) return false;
  return turn.until > now && now - turn.at >= TURN_STALE_MS;
}

/**
 * A turn record for its holder. `gen` is the turn's FENCE (2026-10-15, after
 * review): every turn taken carries a larger one than the turn before it
 * (`nextGen`), and every write a holder makes to the site's guarded keys is
 * stamped with it — so a holder whose turn has passed to another is refused
 * by the store itself, at the write, not by an earlier look at the turn.
 */
export function turnRecord(owner, now = Date.now(), job = "", gen = 0) {
  return { v: 1, owner: String(owner), job: String(job || ""), at: now, until: now + TURN_TTL_MS, gen: Number.isFinite(gen) ? gen : 0 };
}
/**
 * The fence for the next turn: larger than the stored turn's, and never
 * below the clock, so a turn object lost or unreadable still yields a fence
 * above every one already written.
 */
export function nextGen(stored, now = Date.now()) {
  const prev = stored && stored.turn && Number.isFinite(stored.turn.gen) ? stored.turn.gen : 0;
  return Math.max(prev + 1, now);
}

/**
 * A stored turn, read strictly: `{ owner, until }` or `null` when the text is
 * not one. A turn that cannot be read is treated as held by somebody until it
 * lapses by its object's age — never as free (`turnFree`).
 */
export function readTurn(text) {
  let v;
  try { v = JSON.parse(String(text)); } catch { return null; }
  if (!v || typeof v !== "object" || v.v !== 1 || typeof v.owner !== "string" || !v.owner || !Number.isFinite(v.until)) return null;
  return { owner: v.owner, job: typeof v.job === "string" ? v.job : "", at: Number.isFinite(v.at) ? v.at : 0, until: v.until, gen: Number.isFinite(v.gen) ? v.gen : 0 };
}

/**
 * Is the turn free for `owner`? Free when nothing is stored, when the stored
 * turn is this owner's own, or when it has lapsed. A stored object that does
 * not read as a turn lapses on its upload time plus the TTL (`uploadedAt`).
 */
export function turnFree(stored, owner, now = Date.now()) {
  if (!stored) return true;
  const t = stored.turn;
  if (t) return t.owner === owner || t.until <= now;
  const at = stored.uploadedAt instanceof Date ? stored.uploadedAt.getTime() : Number(stored.uploadedAt);
  return Number.isFinite(at) ? at + TURN_TTL_MS <= now : false;
}

const plain = (v) => !!v && typeof v === "object" && !Array.isArray(v);

/**
 * THE JOB'S OWN CHANGES, ONTO THE SITE AS IT IS NOW. Three lists of files, each
 * `{ [key]: string, [val]: string, ... }`: what the job began with (`base`),
 * what it would publish (`mine`), and what is stored now (`current`). By key:
 *
 *   - the job did not change it (mine equals base, both absent included):
 *     what is stored now, whatever that is;
 *   - the job changed it (an edit, an addition, a removal) and nobody else
 *     did (current equals base): the job's;
 *   - both changed it to the same thing: that;
 *   - both changed it, differently: a conflict.
 *
 * Answers `{ ok: true, files, took, kept }` — the files in the stored order
 * with the job's additions after them, the keys taken from the job, the keys
 * another job had changed that were kept — or `{ ok: false, conflicts }`.
 * A list that is not a list, or an entry without a string key and value, is
 * refused (`bad`), never read as empty.
 */
export function rebaseFiles(base, mine, current, { key = "path", val = "source" } = {}) {
  const index = (list) => {
    if (!Array.isArray(list)) return null;
    const m = new Map();
    for (const f of list) {
      if (!plain(f) || typeof f[key] !== "string" || !f[key] || typeof f[val] !== "string") return null;
      if (m.has(f[key])) return null;
      m.set(f[key], f);
    }
    return m;
  };
  const B = index(base), M = index(mine), C = index(current);
  if (!B || !M || !C) return { ok: false, bad: true, conflicts: [] };
  const v = (m, k) => (m.has(k) ? m.get(k)[val] : null);
  const out = new Map();
  const took = [], kept = [], conflicts = [];
  const keys = [...C.keys(), ...[...M.keys()].filter((k) => !C.has(k)), ...[...B.keys()].filter((k) => !C.has(k) && !M.has(k))];
  for (const k of keys) {
    const b = v(B, k), m = v(M, k), c = v(C, k);
    if (m === b) { if (c !== null) out.set(k, C.get(k)); if (c !== b) kept.push(k); continue; }
    if (c === b || c === m) { if (m !== null) out.set(k, M.get(k)); took.push(k); continue; }
    conflicts.push(k);
  }
  if (conflicts.length) return { ok: false, conflicts };
  return { ok: true, files: [...out.values()], took, kept };
}
