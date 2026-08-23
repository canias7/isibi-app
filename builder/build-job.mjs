// THE BUILD IS A JOB, NOT A HELD SOCKET.
//
// WHAT THIS IS FOR. A build takes six to twelve minutes and ran inside the
// request that asked for it. `ctx.waitUntil` was believed to keep it alive past
// a disconnect and does not: Cloudflare's own documentation is explicit that
// waitUntil "can extend execution for up to 30 seconds after the response is
// sent or the client disconnects" and that "if any Promises have not settled
// after 30 seconds, they are canceled". Thirty seconds against a twelve-minute
// build. The builds that survived a reset did so because the disconnect was at
// a hop Cloudflare did not observe — run 14 ran 300 seconds past its own reset
// and arm A 332, both impossible under a 30-second rule. That is luck, and it
// fails hardest on the ordinary case of somebody closing the tab.
//
// A queue consumer is a non-HTTP invocation, which Cloudflare guarantees 15
// minutes of runtime that does not depend on anybody still being connected. So
// the request hands the build to the queue and then WAITS for the answer: the
// customer's experience is unchanged, and a dropped connection now costs the
// ANSWER and never the SITE.
//
// WHY THE BODY GOES TO R2 AND THE MESSAGE CARRIES AN ID. A queue message is
// capped at 128KB and a build body reaches 24MB with attachments — three images
// and a PDF. The message is therefore the smallest thing that can name the
// work, and everything else is an object.
//
// WHY THIS IS A MODULE. Every decision here is one the producer and the consumer
// have to agree on exactly — the key, the envelope, what counts as a readable
// message — and two copies of an agreement is how one side starts writing where
// the other is not looking. It has no R2, no queue and no request, so all of it
// is driven in the unit suite.
//
// NOTHING HERE PERFORMS I/O, and that is asserted rather than merely intended:
// the caller does every read and write, so a mistake in this file cannot be a
// mistake about a bucket.

// The one prefix. Under `jobs/`, which nothing serves — `sites/<slug>/` is the
// public prefix and `source/`, `backups/`, `versions/` and `orphans/` are the
// private ones this joins. A job carries the caller's own access token, so it
// being unreachable from the outside is the whole reason it may hold one.
export const JOB_PREFIX = "jobs/";

// The message's own kind. The consumer refuses anything else rather than
// guessing, because a message it cannot read is a producer somebody added
// without the consumer to match — and running a build against a shape nobody
// designed is the one recovery worse than none.
export const JOB_KIND = "site-build";

// The envelope's version. Bumped when the shape changes; a job written by an
// older deploy and picked up by a newer one is REFUSED rather than reinterpreted,
// because the fields that would be misread are the auth token and the body.
export const JOB_VERSION = 1;

// A job id is 32 hex characters — 128 bits from `crypto.getRandomValues`. It is
// unguessable on purpose: whoever holds it names an R2 key holding a live access
// token. Nothing outside the Worker can read that bucket, so this is depth
// rather than the boundary, and it costs nothing.
const ID_RE = /^[0-9a-f]{32}$/;

export function isJobId(id) {
  return typeof id === "string" && ID_RE.test(id);
}

/**
 * The job's own object, and the result's. TWO KEYS RATHER THAN ONE, because the
 * producer polls for the result and must never see a half-written job as an
 * answer — R2 has no partial reads, but "the object exists" is the whole test
 * and an object that exists for a different reason would pass it.
 *
 * BOTH DERIVE FROM ONE `jobId` CHECK. A key built from an unvalidated id is a
 * path an attacker chooses, and `..` in an R2 key is a literal rather than a
 * traversal — but the id also reaches a log line and a response, so refusing
 * anything that is not the shape we mint is the cheaper rule to keep.
 */
export function jobKey(id) {
  if (!isJobId(id)) throw new Error("build-job: refusing to build a key from an id we did not mint");
  return `${JOB_PREFIX}${id}.json`;
}

export function resultKey(id) {
  if (!isJobId(id)) throw new Error("build-job: refusing to build a key from an id we did not mint");
  return `${JOB_PREFIX}${id}.result.json`;
}

/**
 * Mint an id. Randomness is INJECTED rather than reached for, so the module
 * stays pure and the test can prove the shape without hoping the platform's
 * generator is available.
 */
export function newJobId(fill) {
  const bytes = new Uint8Array(16);
  fill(bytes);
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

/**
 * WHAT THE PRODUCER STORES. The URL and the body are what rebuild the request;
 * `auth` is what the four ledger calls inside the build need, and `uid` is
 * recorded so an operator reading a stranded job knows whose it was without
 * decoding a token.
 *
 * THE TOKEN IS THE CALLER'S OWN AND IT IS SHORT-LIVED BY CONSTRUCTION. A
 * Supabase access token expires in an hour and a build takes minutes; the object
 * is deleted the moment the result is written. It is stored because the
 * alternatives are worse: `use_credits` reads `auth.uid()`, so a service key
 * cannot charge a user at all, and minting a fresh token in the consumer means a
 * GoTrue admin call plus an email lookup on the one path that has to be
 * reliable — new failure modes bought in exchange for not keeping something we
 * were already sent.
 */
export function packJob({ url, auth, body, uid, at }) {
  return { v: JOB_VERSION, url: String(url || ""), auth: String(auth || ""), body: String(body || ""), uid: String(uid || ""), at: Number(at) || 0 };
}

/**
 * Read one back, and REFUSE anything that is not what we wrote. Four things can
 * put a wrong shape here and each is worth failing on rather than working
 * around: a version bump, a truncated write, a key collision, and a hand-edited
 * object. What a wrong shape produces if it is tolerated is a build charged to
 * whatever `auth` happened to parse as.
 */
export function readJob(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  if (raw.v !== JOB_VERSION) return null;
  if (typeof raw.url !== "string" || !raw.url) return null;
  if (typeof raw.body !== "string" || !raw.body) return null;
  if (typeof raw.auth !== "string") return null;
  return { url: raw.url, auth: raw.auth, body: raw.body, uid: typeof raw.uid === "string" ? raw.uid : "", at: Number(raw.at) || 0 };
}

/**
 * A `Response` CANNOT CROSS R2, so the consumer flattens one and the producer
 * rebuilds it. Status, content type and body — nothing else, because nothing
 * else on this route carries meaning and copying headers wholesale would move
 * `content-length` onto a body that has been through JSON.
 *
 * `ok` IS NOT A FIELD HERE. The build's own answers already carry one and it
 * means something different; a second one at the transport layer is two things
 * that can disagree about whether a build worked.
 */
export function packResult({ status, type, body }) {
  return {
    v: JOB_VERSION,
    status: Number.isFinite(status) ? Math.trunc(status) : 500,
    type: typeof type === "string" && type ? type : "application/json",
    body: typeof body === "string" ? body : "",
  };
}

/**
 * And back. A result that cannot be read is NOT an error the customer sees as a
 * broken build — the caller decides that — but it is never guessed at either,
 * because the one thing worse than no answer is somebody else's answer.
 */
export function readResult(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  if (raw.v !== JOB_VERSION) return null;
  if (!Number.isFinite(raw.status) || raw.status < 100 || raw.status > 599) return null;
  if (typeof raw.body !== "string") return null;
  return { status: Math.trunc(raw.status), type: typeof raw.type === "string" && raw.type ? raw.type : "application/json", body: raw.body };
}

/**
 * WHAT THE CONSUMER WILL ACT ON. Everything else is acknowledged and logged —
 * see the handler — so this only has to say yes to the shape we produce.
 */
export function readMessage(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  if (body.kind !== JOB_KIND) return null;
  if (!isJobId(body.id)) return null;
  return { id: body.id };
}

/**
 * REBUILD THE REQUEST THE BUILD RUNS AGAINST. Used by BOTH sides — the consumer
 * has no request at all, and the producer has already read the body off its own,
 * which can only be read once. One expression, so the request the queue path
 * presents and the request the fall-through presents cannot differ.
 *
 * TWO HEADERS AND NOTHING ELSE, and that is measured rather than trimmed by
 * instinct. Scope-analysed with comments blanked, the build touches `request`
 * exactly three times: `authUser`, `readJsonBody` and `useQuota` — and all three
 * read only the Authorization header and the body. Copying the rest would carry
 * a stale `content-length` onto a body that has been through JSON.parse and
 * back, which `readJsonBody` checks first.
 */
export function replayRequest({ url, auth, body }) {
  const headers = { "content-type": "application/json" };
  if (auth) headers.authorization = auth;
  return new Request(url, { method: "POST", headers, body });
}

/**
 * HOW OFTEN THE PRODUCER LOOKS. Fast at first and then slower, because the two
 * kinds of answer are minutes apart: a refusal — unauthenticated, no credit, a
 * name already taken — comes back in about a second, and a real build in six to
 * twelve minutes. One interval serves neither; a flat 3s makes every refusal
 * feel broken, and a flat 500ms is 1,400 reads on a real build.
 *
 * Bounded at the top, so a queue that never delivers costs a read every few
 * seconds rather than a spin. The WAIT is what this bounds — the build is the
 * consumer's and outlives it either way, which is the entire point.
 */
export function pollDelayMs(attempt) {
  const n = Number(attempt) || 0;
  if (n < 6) return 500;
  if (n < 16) return 1500;
  return 3000;
}
