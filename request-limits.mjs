// How much a caller is allowed to send.
//
// The public data API had NO body limit. Measured live 2026-07-28: a 3,000,000
// character field went through `POST /api/db/<slug>/rows/<table>` and landed in
// the owner's Neon database. Uploads were capped at 5 MB; JSON was capped at
// nothing, so with the write limit at 60/min one anonymous caller could push
// roughly 180 MB a minute into a database the site owner PAYS for.
//
// A layer, not a feature: it applies to every write on every site regardless of
// what the site does, which is the only kind of thing that belongs here.
//
// RELATIONSHIP TO `tooLargeBody` in worker.js. That helper already exists and is
// used on six routes (media save, the Stripe webhook, the game and revise
// endpoints). It checks `content-length` and nothing else — which is the header
// the CALLER writes, so it is a courtesy that saves buffering, not a control: a
// request that omits the header passes it unconditionally. It is also applied to
// none of the site-builder routes.
//
// `readJsonBody` does both halves in one call — the cheap header check first, so
// megabytes are never buffered, then the real byte count of what arrived. For a
// JSON route it supersedes `tooLargeBody`; `tooLargeBody` still has a job on
// routes that read raw text rather than JSON (the webhook reads the body for an
// HMAC and must not have it parsed). Do not add a third mechanism.

/** A form submission. Generous for prose, nowhere near a payload attack. */
export const MAX_JSON_BODY = 128 * 1024;
/** One text field. A description or a message, not a novel and not a file. */
export const MAX_FIELD_CHARS = 20_000;
/** Distinct keys in one object — the writable set is allow-listed anyway. */
export const MAX_BODY_KEYS = 60;

/**
 * Read a JSON body, refusing anything oversized.
 *
 * Two checks, and both are needed:
 *
 *  - `content-length` is the cheap one, and it lets us say no BEFORE buffering
 *    megabytes. It is also a header the caller writes, so it is a courtesy
 *    rather than a control.
 *  - the actual byte length is the real one. A caller who omits or understates
 *    content-length still cannot get more than this through, because the text
 *    is measured after it arrives.
 *
 * Returns {ok:true, body} or {ok:false, status, error, code}.
 */
export async function readJsonBody(request, { max = MAX_JSON_BODY } = {}) {
  const declared = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > max) {
    return { ok: false, status: 413, code: "too_big", error: "that's too much data to send at once" };
  }

  let text;
  try { text = await request.text(); }
  catch { return { ok: false, status: 400, code: "unreadable", error: "couldn't read that request" }; }

  // Byte length, not character count: a multi-byte character is more than one
  // byte on the wire and in the database, and measuring `.length` would let a
  // caller send three times the limit in emoji.
  const bytes = new TextEncoder().encode(text).length;
  if (bytes > max) {
    return { ok: false, status: 413, code: "too_big", error: "that's too much data to send at once" };
  }

  if (!text.trim()) return { ok: true, body: {} };
  let body;
  try { body = JSON.parse(text); }
  catch { return { ok: false, status: 400, code: "bad_json", error: "that wasn't valid JSON" }; }
  // An array or a string parses fine and is not a row. Everything downstream
  // does Object.keys on this.
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, status: 400, code: "bad_json", error: "expected an object" };
  }
  return { ok: true, body };
}

/**
 * Cap what any single field can hold.
 *
 * The body limit alone is not enough: 128 KB in ONE column is still a paragraph
 * nobody wrote by hand, and a form with twenty fields should not be able to put
 * all of it in the customer's name. Truncated rather than refused — a visitor
 * who pasted too much should get their booking, not an error about a field they
 * cannot see.
 */
export function clampFields(body, { max = MAX_FIELD_CHARS, maxKeys = MAX_BODY_KEYS } = {}) {
  const out = {};
  let clamped = 0;
  for (const k of Object.keys(body || {}).slice(0, maxKeys)) {
    const v = body[k];
    if (typeof v === "string" && v.length > max) { out[k] = v.slice(0, max); clamped++; }
    else out[k] = v;
  }
  return { body: out, clamped };
}
