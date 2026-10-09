// A PART'S MODEL CALLS, MADE AHEAD AND ANSWERED AGAIN EXACTLY (2026-10-08,
// the parallel-tasks batch).
//
// A request's parts are written one at a time — the site's own lock allows one
// job per site — but their model calls need not wait for that. A part is
// PREPARED beside another part's job: its routing and its step run in the
// Worker with nothing written to the site, and every call it makes is recorded
// here, keyed by the exact request it sent. When the part's own job runs, each
// call whose request is byte for byte one that was prepared is answered from
// the record; any other is made then.
//
// THAT EQUALITY IS THE WHOLE SAFETY ARGUMENT. A step builds its request from
// what it reads of the site (the pictures' descriptions, the page's text, the
// menu), from its own words and from what the parts it needs did. When another
// part has changed any of that in the meantime, the request differs, nothing
// is answered from the record, and the step plans again against the site as it
// now is — a prepared answer is never applied to a site it was not made for.
// When nothing it reads has changed, the answer is the one it would get, made
// earlier.
//
// MONEY: a recorded answer keeps its usage, so the job that uses it bills it
// exactly as if the call were made then, once, through its own reserve. A
// preparation never charges; what it made that no job used is ours.
//
// PURE: hashing is the platform's `crypto.subtle`; the store is the caller's.

/** The fields of a model request that decide its answer; transport options (`stream`, `metadata`) do not. */
const DECIDING = ["model", "system", "messages", "tools", "tool_choice", "max_tokens", "temperature", "top_p", "top_k", "thinking", "stop_sequences", "response_format"];

/** Keys sorted all the way down, so two equal requests serialize the same whatever order their objects were built in. */
function canonical(v) {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === "object") {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = canonical(v[k]);
    return out;
  }
  return v;
}

/** The request's fingerprint: SHA-256 over the deciding fields, canonical. */
export async function requestHash(req) {
  const pick = {};
  for (const k of DECIDING) if (req && Object.hasOwn(req, k) && req[k] !== undefined) pick[k] = req[k];
  const text = JSON.stringify(canonical(pick));
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * A RECORDER: `wrap(send)` makes every call as `send` would and keeps its
 * answer under its request's fingerprint; `image(generate)` keeps each picture
 * bought under the description it was bought for. A failed call is not kept —
 * its job makes it again.
 */
export function recorder() {
  const calls = [];
  const images = [];
  return {
    calls, images,
    wrap(send) {
      return async (req) => {
        const reply = await send(req);
        try { calls.push({ h: await requestHash(req), reply }); } catch { /* an answer that cannot be kept is made again by the job */ }
        return reply;
      };
    },
    image(generate) {
      return async (describe, ...rest) => {
        const url = await generate(describe, ...rest);
        if (typeof url === "string" && url) images.push({ d: String(describe || ""), url });
        return url;
      };
    },
  };
}

/** A prepared record read back: `{ calls, images }`, only what reads — a malformed entry is dropped, never guessed. */
export function readPrepared(raw) {
  let v = raw;
  if (typeof raw === "string") { try { v = JSON.parse(raw); } catch { return { calls: [], images: [] }; } }
  const ok = v && typeof v === "object" && !Array.isArray(v);
  const calls = ok && Array.isArray(v.calls) ? v.calls.filter((c) => c && typeof c.h === "string" && /^[0-9a-f]{64}$/.test(c.h) && c.reply && typeof c.reply === "object") : [];
  const images = ok && Array.isArray(v.images) ? v.images.filter((i) => i && typeof i.d === "string" && typeof i.url === "string" && i.url) : [];
  return { calls, images };
}

/**
 * AN ATTEMPT'S PURCHASE NOTES (2026-10-09), written before each purchase and
 * again when it ends: `{ d, state: "buying" }`, then `{ d, state: "bought",
 * url }` or `{ d, state: "none" }`. Read back strictly: a note that cannot be
 * read is the same as one still buying, its outcome unknown.
 */
export function readBuys(raw) {
  const list = raw && typeof raw === "object" && Array.isArray(raw.buys) ? raw.buys : [];
  return list.map((b) => {
    const d = b && typeof b.d === "string" ? b.d : "";
    if (b && b.state === "bought" && typeof b.url === "string" && b.url) return { d, state: "bought", url: b.url };
    // ANSWERED WITH NO PICTURE: the purchase ended, and nothing came of it.
    if (b && b.state === "none") return { d, state: "none" };
    return { d, state: "buying" };
  });
}

/** A purchase an attempt began and never saw end: its outcome is unknown, and it is not bought again by a preparation. */
export const unfinishedBuy = (raw) => readBuys(raw).find((b) => b.state === "buying") || null;

/**
 * A REPLAYER over what was prepared: `wrap(send)` answers a call from the
 * record when its fingerprint is one prepared and not yet used (each answer
 * once, in the order made), and otherwise makes it; `image(generate)` hands
 * back a picture bought for the same description. `used()` says how many of
 * each were answered from the record, for the job's trace.
 */
export function replayer(prepared) {
  const { calls, images } = readPrepared(prepared);
  const spent = new Set();
  const spentImg = new Set();
  let hits = 0, imageHits = 0, misses = 0;
  return {
    used: () => ({ calls: hits, images: imageHits, missed: misses }),
    /**
     * IS THIS PICTURE ONE ITS PREPARATION BOUGHT? Such a picture sits in the
     * owner's uploads before the job places it, so a step that lists the
     * uploads hides it — it was not there when the preparation listed them,
     * and the list is part of the request the preparation's answer was made for.
     */
    hides: (url) => typeof url === "string" && images.some((i) => i.url === url),
    wrap(send) {
      if (!calls.length) return send;
      return async (req) => {
        let h = "";
        try { h = await requestHash(req); } catch { h = ""; }
        const at = h ? calls.findIndex((c, i) => !spent.has(i) && c.h === h) : -1;
        if (at >= 0) { spent.add(at); hits++; return calls[at].reply; }
        misses++;
        return send(req);
      };
    },
    image(generate) {
      if (!images.length) return generate;
      return async (describe, ...rest) => {
        const d = String(describe || "");
        const at = images.findIndex((x, i) => !spentImg.has(i) && x.d === d);
        if (at >= 0) { spentImg.add(at); imageHits++; return images[at].url; }
        return generate(describe, ...rest);
      };
    },
  };
}

/** Where a part's preparation is kept, under its request: one record per preparation. */
export const prepKey = (slug, key, n, seq) => "requests/" + slug + "/" + key + "/prep/p" + n + "-" + seq + ".json";
/** Where a job's own share of a preparation is put before it runs, under the job's id (a key the job may read, wherever it runs). */
export const jobPrepKey = (id) => "jobs/prepared/" + id + ".json";
