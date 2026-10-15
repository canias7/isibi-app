// THE ASSISTANT AND MEDIA VERIFICATION, PREPARED AND NOT PRESSED (2026-10-15,
// after Codex's review of `9a2ea70b`).
//
// One script, five modes, each with its own gate. A press runs it from GitHub
// Actions (`.github/workflows/media-verify.yml`, dispatch only) against the
// deployed Worker, signed in as the building account through the same
// handshake every canary uses (`scripts/owner-session.mjs`). It is also a
// module: `run()` takes its network as an argument, so `node --test` drives the
// whole of it against the real Worker in-process (`test/media-verify.test.mjs`)
// with nothing leaving the machine.
//
//   rehearsal  READ-ONLY. Signs in, reads the runtime switches (the deploy,
//              whether photographs can be bought), the image id, the balance
//              and the site's library, and lists every prerequisite each other
//              mode would refuse on.
//              Writes nothing. Spends nothing.
//   storage    STORAGE-MUTATING, NO MODEL CALL, NO CREDITS. Every media API
//              check against real R2 through the real Worker, on a site that is
//              not a help-needed fixture: upload of every fixture, list, GET /
//              HEAD / ranges / 416 / 304 on both origins, refusals, replace, a
//              file in three parts resumed after a "lost" part and a lost
//              finish, abort then finish, the concurrency checks (admission,
//              competing replacements, delete against a replacement's close,
//              each judged on its final state), and delete. Everything it made
//              is deleted again at the end, and the library is read back equal
//              to how it was found. Needs `mutate=yes`.
//   browser    STORAGE-MUTATING, NO MODEL CALL. Real browsers (Playwright's
//              Chromium, and Google Chrome, Firefox and WebKit where the runner
//              has them) play and seek every fixture from its `/u/` address;
//              the composer and Files panel run in Chromium on the real app,
//              signed in, with every write but this site's media aborted:
//              attach, reload and reattach (reused), delete and reattach (sent
//              again); no message is ever sent. Cleaned up the same way.
//              Needs `mutate=yes`.
//   converse   PAID: routing plus the reply's own call per message, on an
//              existing site (no Build). Six deterministic cases, the
//              cut-history one built from a fixed thread through the page's own
//              `historyWire`, so it never depends on a model writing a long
//              answer. Needs `spend=yes`, `max_credits`, and IMAGE_PURCHASES
//              verified off on the live Worker before EVERY send.
//   build      PAID: one new Build with two drafts attached before the site
//              exists, judged on the model-written narration, the drafts moved,
//              the files served, and NO image bought. Same gates as converse.
//
// ESTIMATES ARE NOT LIMITS. The platform caps no request: a call can cost more
// than its estimate, and the account's balance is the only bound it knows. The
// one limit here is the HARNESS's: `max_credits`, entered by the owner per
// press, refuses the next send when what this run has spent plus that send's
// upper estimate would pass it, and the run stops if a send overshot it. The
// balance is read from the ledger immediately before and after every send —
// never assumed from a record.
//
// NOT HERE, ON PURPOSE: a raw R2 multipart probe. The existing tooling reaches
// R2 only through the Worker's bucket binding, and the media routes never ask
// R2 to close or abort an upload whose session is gone, so R2's own answer for
// an aborted or unknown upload (`NoSuchUpload`, 10024) cannot be observed
// without either a new owner-gated Worker probe route or S3 credentials and a
// SigV4 client this repository does not have. `storage` covers every abort and
// finish behaviour the routes can reach; the rest is proposed, not built.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const ChatTalk = require("../public/chat-talk.js");

export const MODES = Object.freeze(["rehearsal", "storage", "browser", "converse", "build"]);
const MUTATING = new Set(["storage", "browser"]);
const PAID = new Set(["converse", "build"]);

/**
 * SITES THESE CHECKS NEVER WRITE TO OR SPEND ON: help-needed's live fixtures
 * and the sites its pending batches name. Reading them is allowed (rehearsal).
 */
export const GUARDED_SITES = Object.freeze(["fold-lane-bakery", "fretwork-1", "lido-axes-b", "copperleaf-tea-room", "saltmarsh-cheese-counter"]);

/** The fixtures, as `test/fixtures/media/` holds them (generated locally with ffmpeg; none model-made). */
export const FIXTURES = Object.freeze([
  { file: "clip.webm", kind: "video", mime: "video/webm" },
  { file: "clip.mp4", kind: "video", mime: "video/mp4" },
  { file: "clip.mov", kind: "video", mime: "video/quicktime" },
  { file: "tone.mp3", kind: "audio", mime: "audio/mpeg" },
  { file: "tone.m4a", kind: "audio", mime: "audio/mp4" },
  { file: "tone.aac", kind: "audio", mime: "audio/aac" },
  { file: "tone.wav", kind: "audio", mime: "audio/wav" },
  { file: "tone.ogg", kind: "audio", mime: "audio/ogg" },
  { file: "tone.flac", kind: "audio", mime: "audio/flac" },
]);

/**
 * WHAT EACH BROWSER MUST PLAY, AND WHAT IS ONLY RECORDED. A "required" format
 * that does not load and seek fails the check; a "recorded" one is written
 * down as it behaved, pass or not, because that engine's codec support on a
 * Linux runner is not the product's to promise.
 */
export const BROWSER_EXPECT = Object.freeze({
  chromium: { required: ["clip.webm", "tone.mp3", "tone.wav", "tone.ogg", "tone.flac"], recorded: ["clip.mp4", "clip.mov", "tone.m4a", "tone.aac"] },
  chrome: { required: ["clip.webm", "clip.mp4", "tone.mp3", "tone.m4a", "tone.aac", "tone.wav", "tone.ogg", "tone.flac"], recorded: ["clip.mov"] },
  firefox: { required: ["clip.webm", "tone.mp3", "tone.wav", "tone.ogg", "tone.flac"], recorded: ["clip.mp4", "clip.mov", "tone.m4a", "tone.aac"] },
  webkit: { required: [], recorded: FIXTURES.map((f) => f.file) },
});
/** What no runner has: said as manual or unverified, never as passed. */
export const UNAVAILABLE = Object.freeze(["Safari on macOS", "Safari on iOS", "Chrome on Android", "Microsoft Edge"]);

/** Credits, estimated from the measured history in CLAUDE.md and the price table — not limits. */
export const ESTIMATES = Object.freeze({
  message: { low: 2, high: 6, why: "routing (measured 1–2) plus the reply's own call on grok-4.6 (about 2 typical, 5 at the full window and the 2,400-token ceiling), under one charge" },
  build: { low: 13, high: 47, why: "a first build (measured 11–45) plus its routing (1–2); with IMAGE_PURCHASES off no photograph can be bought" },
});

// ── THE DETERMINISTIC CONVERSATION CASES ────────────────────────────────────

/** A long earlier reply whose third version lies past the page's 4,000-character cut. */
export function cutThread() {
  const filler = (n) => (" The bakery's mornings start before dawn, with the ovens warming and the first loaves shaped by hand." ).repeat(n);
  const reply = "Here are three versions of your headline, each with why it works.\n\nVersion one: Bread at dawn." + filler(18) +
    "\n\nVersion two: Baked while the harbour sleeps." + filler(30) + "\n\nVersion three: Loaves from the harbour wall." + filler(4);
  return [
    { r: "u", t: "Give me three versions of a headline for my home page, with a long explanation of each." },
    { r: "a", t: reply, md: true },
    { r: "u", t: "ok, use the third version" },
  ];
}

export const CONVERSE_CASES = Object.freeze([
  { id: "C1-greeting", message: "hi", thread: [], expect: "a short greeting and an invitation to say what they want; no work" },
  { id: "C2-compare", message: "Should I take bookings for bread-making classes with a booking page or an enquiry form? Compare them for me.", thread: [], expect: "a structured comparison (headings or lists allowed), no work" },
  { id: "C3-grounded", message: "What does my home page say? Summarise it in two sentences.", thread: [], expect: "an answer from the stored page words; never a claim of having visited the live site" },
  { id: "C4-missing", message: "What time do we open on Sundays?", thread: [], expect: "says what it was not shown and how to add it; never an invented time" },
  { id: "C5-cut-history", message: "ok, use the third version", thread: "cut", expect: "asks for the third version again (it was past the cut); `resolved` absent; no work" },
  { id: "C8-attachment", message: "What could I use this clip for on my site?", thread: [], files: [{ name: "clip.webm", type: "video/webm" }], expect: "stays conversation; the file named as unseen; no claim of having watched it" },
]);

/**
 * The history the page would send for a case — through the page's own
 * `historyWire`, so the cut is the real one — and, for the cut case, proof
 * BEFORE any call that the third version really is past the cut.
 */
export function caseHistory(c) {
  if (c.thread !== "cut") return { history: ChatTalk.historyWire([], c.message), cutProven: null };
  const history = ChatTalk.historyWire(cutThread(), c.message);
  const long = history.find((t) => t && t.role === "assistant");
  const cutProven = !!long && typeof long.full === "number" && long.full > long.text.length && !long.text.includes("Version three") && long.text.includes("Version two");
  return { history, cutProven };
}

// ── JUDGING DELETE AGAINST A REPLACEMENT'S CLOSE ────────────────────────────

/**
 * ONE RACE, JUDGED ON WHERE IT ENDED (2026-10-15, after Codex's review of
 * `9a2ea70b`): never on one fixed pair of statuses. The replacement's close
 * and the file's delete were sent together; whatever order they took, a delete
 * that answered 200 must leave the file deleted, its receipts saying so, and
 * the room given back. Any of these is a valid order:
 *   - the close first, the delete refused while it committed (409 replacing),
 *     then deleted when sent again;
 *   - the close first, then the delete (both 200), the file deleted after;
 *   - the delete first, the close refused (410 removed).
 * A 503 `unconfirmed` delete is valid only while the old upload could still
 * land, and must be followed by one that succeeds. What is never valid: a
 * delete that answered 200 and a file still served, a close that answered 200
 * over a file the record deleted first, or room still held at the end.
 */
export function judgeDeleteVsClose({ close, del, delRetry = null, servedAfter, replacementReceipt, originalReceipt, roomFree }) {
  const why = [];
  const finalDel = delRetry || del;
  if (!finalDel || finalDel.status !== 200) why.push("the delete never succeeded (" + (finalDel && finalDel.status) + ")");
  if (servedAfter !== 404) why.push("the file is still served (" + servedAfter + ") after the delete answered");
  if (!roomFree) why.push("room is still held after both ended");
  let order = "unknown";
  if (close.status === 200 && del.status === 409 && del.code === "replacing") order = "close-first, delete refused then sent again";
  else if (close.status === 200 && del.status === 200) order = "close then delete";
  else if (del.status === 200 && close.status === 410 && close.code === "removed") order = "delete first, close refused";
  else if (del.status === 503 && del.code === "unconfirmed") order = "delete held as unconfirmed, then sent again";
  else why.push("an order no valid sequence produces: close " + close.status + "/" + (close.code || "") + ", delete " + del.status + "/" + (del.code || ""));
  // THE RECEIPTS MUST AGREE WITH WHERE IT ENDED.
  if (close.status === 200 && replacementReceipt !== "removed") why.push("the landed replacement's receipt says " + replacementReceipt + ", not removed");
  if (close.status !== 200 && !["gone", "removed"].includes(replacementReceipt)) why.push("the refused replacement's receipt says " + replacementReceipt);
  if (originalReceipt !== "removed") why.push("the original's receipt says " + originalReceipt + ", not removed");
  return { ok: why.length === 0, order, why };
}

// ── THE WIRE ────────────────────────────────────────────────────────────────

/** A deterministic WAV of `bytes` bytes (16-bit mono 22.05 kHz tone), for the file in parts. */
export function wavOf(bytes) {
  const out = new Uint8Array(bytes);
  const dv = new DataView(out.buffer);
  const data = bytes - 44;
  const w = (o, s) => { for (let i = 0; i < s.length; i++) out[o + i] = s.charCodeAt(i); };
  w(0, "RIFF"); dv.setUint32(4, bytes - 8, true); w(8, "WAVE"); w(12, "fmt ");
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true); dv.setUint32(24, 22050, true);
  dv.setUint32(28, 44100, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); w(36, "data"); dv.setUint32(40, data, true);
  for (let i = 0; i < data / 2; i++) dv.setInt16(44 + i * 2, Math.round(8000 * Math.sin((2 * Math.PI * 440 * i) / 22050)), true);
  return out;
}

function api({ fetch, base, token }) {
  const call = async (method, p, { json, body, headers = {}, origin = base } = {}) => {
    const h = { Authorization: "Bearer " + token, ...headers };
    let b;
    if (json !== undefined) { b = JSON.stringify(json); h["content-type"] = "application/json"; }
    if (body !== undefined) { b = body; h["content-length"] = String(body.length); }
    const r = await fetch(origin + p, { method, headers: h, body: b });
    const buf = new Uint8Array(await r.arrayBuffer());
    let parsed = null;
    try { parsed = JSON.parse(new TextDecoder().decode(buf)); } catch { parsed = null; }
    return { status: r.status, headers: r.headers, bytes: buf, body: parsed };
  };
  return call;
}

// ── THE RUN ─────────────────────────────────────────────────────────────────

/**
 * Run one mode. `opts`:
 *   fetch, base (app origin), siteOrigin(slug) → the site's own origin, token,
 *   mode, slug, mutate ("yes"), spend ("yes"), maxCredits (number),
 *   fixtures (dir), browsers (Playwright launchers, for `browser`), log,
 *   repeat (concurrency repetitions, 1–10), draftAllowance (the live draft limit).
 * Answers `{ ok, refused?, results, unmet }`.
 */
export async function run(opts) {
  const log = opts.log || (() => {});
  const results = { mode: opts.mode, slug: opts.slug, checks: [], spends: [], recorded: [] };
  const check = (name, pass, detail = "") => { results.checks.push({ name, pass: !!pass, detail: String(detail).slice(0, 400) }); log((pass ? "PASS  " : "FAIL  ") + name + (detail ? "  " + String(detail).slice(0, 200) : "")); return !!pass; };
  const refuse = (why) => { log("REFUSED: " + why); return { ok: false, refused: why, results, unmet: [why] }; };
  if (!MODES.includes(opts.mode)) return refuse("no such mode: " + opts.mode);
  // EVERY MODE NAMES AN EXISTING SITE OF THE ACCOUNT: the switches are read
  // through it (`/api/site/runtime` answers per owned site), and the storage,
  // browser and conversation checks run on it. A Build makes its own new site.
  if (!/^[a-z0-9][a-z0-9-]{0,80}$/.test(String(opts.slug || ""))) return refuse("a site slug is required");
  const call = api(opts);
  const siteOrigin = opts.siteOrigin || ((s) => "https://" + s + ".gofarther.app");

  // ── READ-ONLY FACTS, every mode ──
  // THE LIVE SWITCHES COME FROM `/api/site/runtime` (as every canary reads
  // them): the deploy and whether a photograph can be bought at all. The image
  // id is recorded from `build-health` when the container answers; it gates
  // nothing.
  const health = await call("GET", "/api/site/runtime" + (opts.slug ? "?slug=" + encodeURIComponent(opts.slug) : ""));
  const deploy = health.body && health.body.deploy;
  const imagePurchases = health.body ? health.body.imagePurchases : undefined;
  results.deploy = deploy || null;
  const bh = await call("GET", "/api/site/build-health").catch(() => null);
  results.image = (bh && bh.status === 200 && bh.body && bh.body.image) || null;
  results.imagePurchases = imagePurchases;
  const balance = async () => { const b = await call("GET", "/api/credits"); return b.status === 200 && b.body && Number.isFinite(Number(b.body.balance)) ? Number(b.body.balance) : null; };
  const startBalance = await balance();
  results.balanceAtStart = startBalance;
  log("deploy " + (deploy || "?") + "  image " + (results.image || "?") + "  imagePurchases " + imagePurchases + "  balance " + startBalance);

  // ── WHAT EACH MODE WOULD REFUSE ON ──
  const unmet = [];
  if (health.status !== 200) unmet.push("the runtime read did not answer (" + health.status + ")");
  if (MUTATING.has(opts.mode) || PAID.has(opts.mode)) {
    if (opts.slug && GUARDED_SITES.includes(opts.slug)) unmet.push(opts.slug + " is a help-needed fixture: never written to or spent on here");
  }
  if (MUTATING.has(opts.mode) && opts.mutate !== "yes") unmet.push("this mode writes to live storage: mutate must be yes");
  if (PAID.has(opts.mode)) {
    if (opts.spend !== "yes") unmet.push("this mode calls models: spend must be yes");
    if (imagePurchases !== false) unmet.push("IMAGE_PURCHASES must be off on the live Worker (build-health says " + imagePurchases + ")");
    if (!(Number.isInteger(opts.maxCredits) && opts.maxCredits > 0)) unmet.push("max_credits must be a positive whole number (the harness's own ceiling for this run)");
    if (startBalance === null) unmet.push("the balance could not be read");
  }
  results.unmet = unmet;
  if (opts.mode === "rehearsal") {
    if (opts.slug) {
      const lib = await call("GET", "/api/site/" + opts.slug + "/uploads");
      results.library = lib.status === 200 && lib.body ? (lib.body.files || []).map((f) => f.name) : null;
      check("the site's library reads (owner)", lib.status === 200, lib.status);
    }
    for (const m of MODES.filter((x) => x !== "rehearsal")) {
      const would = [];
      if ((MUTATING.has(m) || PAID.has(m)) && opts.slug && GUARDED_SITES.includes(opts.slug)) would.push("guarded site");
      if (MUTATING.has(m)) would.push("needs mutate=yes");
      if (PAID.has(m)) {
        would.push("needs spend=yes and max_credits");
        if (imagePurchases !== false) would.push("IMAGE_PURCHASES is not off");
      }
      results.recorded.push({ mode: m, wouldNeed: would });
    }
    check("the runtime read answers (deploy and image switch)", health.status === 200, health.status);
    const pass = results.checks.every((c) => c.pass);
    return { ok: pass, results, unmet };
  }
  if (unmet.length) return refuse(unmet.join("; "));

  const ctx = { opts, call, check, log, results, siteOrigin, balance };
  if (opts.mode === "storage") await storageChecks(ctx);
  if (opts.mode === "browser") await browserChecks(ctx);
  if (opts.mode === "converse") await converseChecks(ctx);
  if (opts.mode === "build") await buildChecks(ctx);
  const ok = results.checks.length > 0 && results.checks.every((c) => c.pass) && !results.stopped;
  return { ok, results, unmet: [] };
}

// ── STORAGE (mutating, no model call) ───────────────────────────────────────

async function uploadVia(call, base, bytes, name, extra = {}) {
  const st = await call("POST", base, { json: { name, size: bytes.length, type: "", ...extra } });
  if (st.status !== 201) return { st };
  const parts = [];
  for (let n = 1; n <= st.body.parts; n++) {
    const p = await call("PUT", base + "/" + st.body.session + "/" + n, { body: bytes.subarray((n - 1) * st.body.partBytes, n * st.body.partBytes) });
    if (p.status >= 300) return { st, p };
    parts.push({ n, etag: p.body.etag });
  }
  const done = await call("POST", base + "/" + st.body.session + "/complete", { json: { parts } });
  return { st, done, session: st.body.session };
}

async function storageChecks({ opts, call, check, log, results, siteOrigin }) {
  const slug = opts.slug;
  const base = "/api/site/" + slug + "/media";
  const dir = opts.fixtures;
  const read = (f) => new Uint8Array(readFileSync(path.join(dir, f)));
  const made = new Set();
  const sessions = new Set();
  const listNames = async () => { const l = await call("GET", "/api/site/" + slug + "/uploads"); return l.status === 200 ? (l.body.files || []).map((f) => f.name) : null; };
  const before = await listNames();
  check("the library reads before anything is written", Array.isArray(before), String(before && before.length));
  try {
    // S1 — EVERY FIXTURE UP, LISTED, SERVED ON BOTH ORIGINS.
    for (const f of FIXTURES) {
      const bytes = read(f.file);
      const u = await uploadVia(call, base, bytes, f.file);
      if (u.session) sessions.add(u.session);
      if (!check("S1 " + f.file + " uploads", u.done && u.done.status === 201, JSON.stringify(u.done ? u.done.body : (u.p || u.st).body))) continue;
      const name = u.done.body.name;
      made.add(name);
      const url = u.done.body.url;
      for (const origin of [opts.base, siteOrigin(slug)]) {
        const where = origin === opts.base ? "app" : "site";
        const g = await call("GET", url, { origin });
        check("S1 " + f.file + " GET on the " + where + " origin", g.status === 200 && g.headers.get("content-type") === f.mime && g.headers.get("accept-ranges") === "bytes" && g.bytes.length === bytes.length && /max-age=300/.test(g.headers.get("cache-control") || ""), g.status + " " + g.headers.get("content-type") + " " + g.headers.get("cache-control"));
        const h = await call("HEAD", url, { origin });
        check("S1 " + f.file + " HEAD (" + where + ")", h.status === 200 && h.bytes.length === 0 && h.headers.get("content-length") === String(bytes.length), h.status);
        const r = await call("GET", url, { origin, headers: { range: "bytes=10-19" } });
        check("S1 " + f.file + " range 206 (" + where + ")", r.status === 206 && r.headers.get("content-range") === "bytes 10-19/" + bytes.length && r.bytes.length === 10, r.status + " " + r.headers.get("content-range"));
        const tail = await call("GET", url, { origin, headers: { range: "bytes=-16" } });
        check("S1 " + f.file + " suffix range (" + where + ")", tail.status === 206 && tail.bytes.length === 16, tail.status);
        const past = await call("GET", url, { origin, headers: { range: "bytes=" + bytes.length + "-" } });
        check("S1 " + f.file + " past the end 416 (" + where + ")", past.status === 416, past.status);
        const etag = g.headers.get("etag");
        const nm = await call("GET", url, { origin, headers: { "if-none-match": etag || "" } });
        check("S1 " + f.file + " revalidated 304 (" + where + ")", !!etag && nm.status === 304, nm.status);
      }
    }
    const listed = await call("GET", "/api/site/" + slug + "/uploads");
    const kinds = new Map(((listed.body && listed.body.files) || []).map((x) => [x.name, x.kind]));
    check("S1 every upload listed with its kind", [...made].every((n) => kinds.get(n) === "video" || kinds.get(n) === "audio"), [...made].map((n) => kinds.get(n)).join(","));

    // S2 — REFUSALS.
    const renamed = await call("POST", base, { json: { name: "renamed.mp4", size: read("tone.mp3").length } });
    if (renamed.status === 201) {
      sessions.add(renamed.body.session);
      const p = await call("PUT", base + "/" + renamed.body.session + "/1", { body: read("tone.mp3") });
      check("S2 an MP3 named .mp4 is refused from its bytes", p.status === 415, p.status + " " + (p.body && p.body.code));
    } else check("S2 an MP3 named .mp4 is refused from its bytes", false, "start " + renamed.status);
    const pdf = new TextEncoder().encode("%PDF-1.4\n% not audio\n" + "x".repeat(200));
    const bad = await call("POST", base, { json: { name: "notes.mp3", size: pdf.length } });
    if (bad.status === 201) {
      sessions.add(bad.body.session);
      const p = await call("PUT", base + "/" + bad.body.session + "/1", { body: pdf });
      check("S2 a PDF named .mp3 is refused", p.status === 415 && p.body && p.body.code === "bad_type", p.status + " " + (p.body && p.body.code));
    } else check("S2 a PDF named .mp3 is refused", false, "start " + bad.status);
    const big = await call("POST", base, { json: { name: "huge.mp4", size: 3_000_000_000 } });
    check("S2 a video past the file limit is refused before any byte", big.status === 413, big.status);

    // S3 — REPLACE.
    const mp3Name = [...made].find((n) => n.endsWith(".mp3"));
    const first = await call("GET", "/u/" + slug + "/" + mp3Name);
    const v2 = new Uint8Array(read("tone.mp3").length + 37); v2.set(read("tone.mp3")); v2.fill(5, read("tone.mp3").length);
    const rep = await uploadVia(call, base, v2, "tone v2.mp3", { replace: mp3Name });
    check("S3 a replacement keeps the address", rep.done && rep.done.status === 200 && rep.done.body.name === mp3Name, JSON.stringify(rep.done && rep.done.body));
    const after = await call("GET", "/u/" + slug + "/" + mp3Name);
    check("S3 the address serves the new bytes with a new ETag", after.bytes.length === v2.length && after.headers.get("etag") !== first.headers.get("etag"), after.bytes.length);
    const wrongFmt = await call("POST", base, { json: { name: "x.wav", size: 100, replace: mp3Name } });
    check("S3 a replacement in another format is refused", wrongFmt.status === 409 && wrongFmt.body.code === "format_mismatch", wrongFmt.status);

    // S4 — A FILE IN THREE PARTS: a part "lost", resumed from status; a finish "lost", asked again.
    const wav = wavOf(2 * 8 * 1024 * 1024 + 4096);
    const st = await call("POST", base, { json: { name: "long talk.wav", size: wav.length } });
    if (check("S4 a three-part upload starts", st.status === 201 && st.body.parts === 3, st.status + " parts " + (st.body && st.body.parts))) {
      sessions.add(st.body.session);
      const pb = st.body.partBytes;
      await call("PUT", base + "/" + st.body.session + "/1", { body: wav.subarray(0, pb) });
      await call("PUT", base + "/" + st.body.session + "/2", { body: wav.subarray(pb, 2 * pb) });
      const s1 = await call("GET", base + "/" + st.body.session);
      check("S4 status says which parts the server holds", s1.body && s1.body.state === "open" && JSON.stringify(s1.body.have) === "[1,2]", JSON.stringify(s1.body));
      await call("PUT", base + "/" + st.body.session + "/3", { body: wav.subarray(2 * pb) });
      const c1 = await call("POST", base + "/" + st.body.session + "/complete", { json: { parts: [] } });
      check("S4 finished from the server's own part record", c1.status === 201, c1.status);
      if (c1.body && c1.body.name) made.add(c1.body.name);
      const c2 = await call("POST", base + "/" + st.body.session + "/complete", { json: { parts: [] } });
      check("S4 a finish whose answer was lost is answered again, the same", c2.status === 200 && c2.body.again === true && c2.body.name === (c1.body && c1.body.name), c2.status);
      const ab = await call("DELETE", base + "/" + st.body.session);
      check("S4 an abort after the finish keeps the file", ab.status === 200 && ab.body.done === true, JSON.stringify(ab.body));
      const tail = await call("GET", "/u/" + slug + "/" + (c1.body && c1.body.name), { headers: { range: "bytes=-1024" } });
      check("S4 the end of the joined file is the end of the file sent", tail.status === 206 && tail.bytes.every((b, i) => b === wav[wav.length - 1024 + i]), tail.status);
    }

    // S5 — ABORT, THEN FINISH, AS THE ROUTES REACH IT.
    const ta = read("tone.wav");
    const sa = await call("POST", base, { json: { name: "aborted.wav", size: ta.length } });
    if (sa.status === 201) {
      sessions.add(sa.body.session);
      await call("PUT", base + "/" + sa.body.session + "/1", { body: ta });
      const a = await call("DELETE", base + "/" + sa.body.session);
      const c = await call("POST", base + "/" + sa.body.session + "/complete", { json: { parts: [] } });
      const p = await call("PUT", base + "/" + sa.body.session + "/1", { body: ta });
      check("S5 after an abort, a finish and a part find nothing, and nothing is stored", a.status === 200 && c.status === 404 && p.status === 404 && (await call("GET", "/u/" + slug + "/" + sa.body.name)).status === 404, [a.status, c.status, p.status].join(","));
    }

    // S6 — CONCURRENCY, REPEATED, EACH JUDGED ON WHERE IT ENDED.
    const reps = Math.max(1, Math.min(10, Number(opts.repeat) || 3));
    for (let i = 0; i < reps; i++) {
      // a. COMPETING REPLACEMENTS of one file.
      const target = [...made].find((n) => n.endsWith(".ogg"));
      const two = await Promise.all([0, 1].map(() => call("POST", base, { json: { name: "r.ogg", size: 4000, replace: target } })));
      two.forEach((r) => r.body && r.body.session && sessions.add(r.body.session));
      const st2 = two.map((r) => r.status).sort().join(",");
      check("S6a #" + (i + 1) + " two replacements of one file at once: one admitted", st2 === "201,409" && two.some((r) => r.body && r.body.code === "replacing"), st2);
      for (const r of two) if (r.status === 201) await call("DELETE", base + "/" + r.body.session);

      // b. DELETE AGAINST A REPLACEMENT'S CLOSE.
      const fresh = await uploadVia(call, base, read("tone.flac"), "race.flac");
      if (!fresh.done || fresh.done.status !== 201) { check("S6b #" + (i + 1) + " setup", false, "upload"); continue; }
      const fname = fresh.done.body.name;
      made.add(fname);
      const nb = new Uint8Array(read("tone.flac").length + 11); nb.set(read("tone.flac"));
      const rs = await call("POST", base, { json: { name: "race v2.flac", size: nb.length, replace: fname } });
      if (!check("S6b #" + (i + 1) + " the replacement starts", rs.status === 201, rs.status)) continue;
      sessions.add(rs.body.session);
      await call("PUT", base + "/" + rs.body.session + "/1", { body: nb });
      const [close, del] = await Promise.all([
        call("POST", base + "/" + rs.body.session + "/complete", { json: { parts: [] } }),
        call("DELETE", "/api/site/" + slug + "/uploads/" + fname),
      ]);
      let delRetry = null;
      for (let k = 0; k < 5 && (delRetry || del).status !== 200; k++) delRetry = await call("DELETE", "/api/site/" + slug + "/uploads/" + fname);
      const servedAfter = (await call("GET", "/u/" + slug + "/" + fname)).status;
      const rr = await call("GET", base + "/" + rs.body.session);
      const or = await call("GET", base + "/" + fresh.session);
      const receipt = (r) => (r.status === 404 ? "gone" : r.body && r.body.state);
      // ROOM GIVEN BACK: a start of the same size is admitted at once, and given up.
      const probe = await call("POST", base, { json: { name: "room.flac", size: nb.length } });
      if (probe.body && probe.body.session) await call("DELETE", base + "/" + probe.body.session);
      const j = judgeDeleteVsClose({ close: { status: close.status, code: close.body && close.body.code }, del: { status: del.status, code: del.body && del.body.code }, delRetry: delRetry && { status: delRetry.status }, servedAfter, replacementReceipt: receipt(rr), originalReceipt: receipt(or), roomFree: probe.status === 201 });
      results.recorded.push({ race: i + 1, order: j.order });
      check("S6b #" + (i + 1) + " delete against a replacement's close ends consistent (" + j.order + ")", j.ok, j.why.join("; "));
      made.delete(fname);
    }
    // c. ADMISSION UNDER THE DRAFT ALLOWANCE.
    const drafts = await call("GET", "/api/media/drafts");
    const held = drafts.status === 200 ? (drafts.body.files || []).length : null;
    const allowance = drafts.status === 200 ? Number(drafts.body.maxCount) : null;
    if (check("S6c the drafts read", held !== null && allowance > 0, drafts.status)) {
      const room = Math.max(0, allowance - held);
      const fired = await Promise.all(Array.from({ length: room + 2 }, (_, k) => call("POST", "/api/media/drafts", { json: { name: "d" + k + ".wav", size: 100 } })));
      // NEVER MORE THAN THE ROOM. A start that could not get a turn on the
      // ledger answers 503 busy (its documented limit under contention) and
      // reserves nothing; each is sent again, one at a time, and only then is
      // the room expected to be exactly filled.
      const first = fired.filter((r) => r.status === 201);
      const busy = fired.filter((r) => r.status === 503 && r.body && r.body.code === "busy");
      check("S6c " + (room + 2) + " draft starts at once: never more than the room left (" + room + ")", first.length <= room && fired.every((r) => [201, 409, 503].includes(r.status)), fired.map((r) => r.status).join(","));
      results.recorded.push({ admission: { fired: fired.length, admitted: first.length, busy: busy.length, full: fired.filter((r) => r.status === 409).length } });
      const admitted = [...first];
      for (let k = 0; k < busy.length; k++) {
        const again = await call("POST", "/api/media/drafts", { json: { name: "b" + k + ".wav", size: 100 } });
        if (again.status === 201) admitted.push(again);
      }
      check("S6c sent again one at a time, exactly the room is admitted, and no more", admitted.length === room, admitted.length + " of " + room);
      for (const r of admitted) await call("DELETE", "/api/media/drafts/" + r.body.session);
      const again = await call("POST", "/api/media/drafts", { json: { name: "again.wav", size: 100 } });
      check("S6c given up, the room is free again", room === 0 || again.status === 201, again.status);
      if (again.body && again.body.session) await call("DELETE", "/api/media/drafts/" + again.body.session);
    }

    // S7 — DELETE, AND A SECOND DELETE.
    for (const n of [...made]) {
      const d = await call("DELETE", "/api/site/" + slug + "/uploads/" + n);
      const d2 = await call("DELETE", "/api/site/" + slug + "/uploads/" + n);
      const g = await call("GET", "/u/" + slug + "/" + n);
      if (check("S7 " + n + " deleted, a second delete answered done, the address 404", d.status === 200 && d2.status === 200 && g.status === 404, [d.status, d2.status, g.status].join(","))) made.delete(n);
    }
  } finally {
    // EVERYTHING THIS RUN MADE IS GIVEN BACK, whatever happened above.
    for (const n of made) await call("DELETE", "/api/site/" + slug + "/uploads/" + n + "?force=1").catch(() => {});
    for (const s of sessions) if (s) await call("DELETE", base + "/" + s).catch(() => {});
    const end = await listNames();
    check("the library ends as it was found", Array.isArray(end) && JSON.stringify([...end].sort()) === JSON.stringify([...(before || [])].sort()), (end || []).length + " vs " + (before || []).length);
  }
}

// ── BROWSERS (mutating, no model call) ──────────────────────────────────────

async function browserChecks({ opts, call, check, log, results }) {
  const slug = opts.slug;
  const base = "/api/site/" + slug + "/media";
  const made = [];
  try {
    for (const f of FIXTURES) {
      const u = await uploadVia(call, base, new Uint8Array(readFileSync(path.join(opts.fixtures, f.file))), f.file);
      if (u.done && u.done.status === 201) made.push({ ...f, url: u.done.body.url, name: u.done.body.name });
    }
    check("every fixture is up for the browsers", made.length === FIXTURES.length, made.length);
    for (const [engine, launch] of Object.entries(opts.browsers || {})) {
      let browser = null;
      try { browser = await launch(); } catch (e) {
        results.recorded.push({ engine, unavailable: String(e && e.message || e).slice(0, 120) });
        // AN ENGINE THE RUNNER INSTALLS MUST LAUNCH: a press that silently
        // played nothing in Firefox would read as Firefox passing.
        if ((opts.requiredEngines || []).includes(engine)) check("B1 " + engine + " launches on this runner", false, String(e && e.message || e).slice(0, 120));
        else log("SKIP  " + engine + " is not on this runner");
        continue;
      }
      try {
        const page = await browser.newPage();
        const exp = BROWSER_EXPECT[engine] || { required: [], recorded: FIXTURES.map((x) => x.file) };
        for (const f of made) {
          const src = (opts.mediaOrigin || opts.base) + f.url;
          const got = await page.evaluate(async ({ src, kind }) => {
            document.body.innerHTML = "";
            const el = document.createElement(kind);
            el.preload = "metadata";
            el.muted = true;
            document.body.appendChild(el);
            const wait = (ev, ms) => new Promise((ok) => { const t = setTimeout(() => ok(false), ms); el.addEventListener(ev, () => { clearTimeout(t); ok(true); }, { once: true }); el.addEventListener("error", () => { clearTimeout(t); ok(false); }, { once: true }); });
            const can = el.canPlayType(kind === "video" ? "video/mp4" : "audio/mpeg");
            el.src = src;
            const loaded = await wait("loadedmetadata", 15000);
            if (!loaded) return { loaded, can, error: el.error && el.error.code };
            const to = el.duration * 0.75;
            el.currentTime = to;
            const sought = await wait("seeked", 15000);
            return { loaded, sought, duration: el.duration, at: el.currentTime, can };
          }, { src, kind: f.kind });
          const ok = !!(got.loaded && got.sought && Math.abs(got.at - got.duration * 0.75) < 0.5);
          results.recorded.push({ engine, file: f.file, ...got });
          if (exp.required.includes(f.file)) check("B1 " + engine + " plays and seeks " + f.file, ok, JSON.stringify(got));
          else log("REC   " + engine + " " + f.file + " " + JSON.stringify(got));
        }
      } finally { await browser.close(); }
    }
    for (const u of UNAVAILABLE) results.recorded.push({ engine: u, unavailable: "no such browser on the runner: manual or unverified" });
  } finally {
    for (const f of made) await call("DELETE", "/api/site/" + slug + "/uploads/" + f.name + "?force=1").catch(() => {});
  }
  if (opts.composer) await composerChecks({ opts, call, check, log, results });
  else log("SKIP  the composer and Files panel: no app browser was given");
}

/**
 * NOTHING THE COMPOSER CHECK DOES MAY SPEND (2026-10-15). The page is the real
 * app, signed in as the owner, so every request it makes is checked here: any
 * write that is not this site's own media or uploads is aborted and recorded.
 * No message is ever sent: the check attaches, reloads and deletes, and never
 * presses send — and if anything tried to route or build, this stops it.
 */
export function composerAllows(method, pathname, slug) {
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return true;
  const own = "/api/site/" + slug + "/";
  return pathname.startsWith(own + "media") || pathname.startsWith(own + "uploads/");
}

/**
 * B2 AND B3: THE COMPOSER AND THE FILES PANEL in Chromium on the real app,
 * signed in by a planted session as the UI canary does (scripts/canary-ui.mjs),
 * for the app's own origin only. Attach → ready; reload, attach the same file →
 * reused (no part sent); delete it, attach again → sent again as a new file;
 * the Files panel lists it as media with a player. Every file made is deleted.
 */
async function composerChecks({ opts, call, check, log, results }) {
  const slug = opts.slug;
  const origin = opts.appOrigin || opts.base;
  const c = opts.composer;
  const file = path.join(opts.fixtures, "clip.webm");
  const names = async () => { const r = await call("GET", "/api/site/" + slug + "/uploads"); return r.status === 200 ? (r.body.files || []).map((f) => f.name) : null; };
  const start = await names();
  if (!check("B2 the library reads before the composer", Array.isArray(start), start)) return;
  let browser = null;
  const blocked = [];
  try {
    if (!check("B2 a session the app can keep is in hand", typeof c.refresh === "string" && c.refresh.length > 0, "no refresh token")) return;
    try { browser = await c.launch(); } catch (e) { check("B2 Chromium launches for the composer", false, String(e && e.message || e).slice(0, 120)); return; }
    const ctx = await browser.newContext({ viewport: { width: 1320, height: 860 }, serviceWorkers: "block" });
    await ctx.addInitScript(({ o, value }) => {
      try {
        if (location.origin !== o) return;
        if (!localStorage.getItem("zephyr_session_v1")) localStorage.setItem("zephyr_session_v1", value);
        if (!localStorage.getItem("zephyr_welcome_v1")) localStorage.setItem("zephyr_welcome_v1", "1");
      } catch (e) { /* a frame with no storage */ }
    }, { o: origin, value: JSON.stringify({ access_token: c.token, refresh_token: c.refresh, expires_at: c.expiresAt || Date.now() + 50 * 60 * 1000, user: c.user || null }) });
    if (c.prepare) await c.prepare(ctx);
    await ctx.route("**/*", (route) => {
      const req = route.request();
      const u = new URL(req.url());
      if (u.origin === origin && !composerAllows(req.method(), u.pathname, slug)) { blocked.push(req.method() + " " + u.pathname); return route.abort("blockedbyclient"); }
      return route.fallback();
    });
    const page = await ctx.newPage();
    const parts = [];
    page.on("request", (r) => { if (r.method() === "PUT" && new URL(r.url()).pathname.startsWith("/api/site/" + slug + "/media/")) parts.push(r.url()); });
    const open = async () => {
      await page.goto(origin + "/projects", { waitUntil: "domcontentloaded", timeout: 90000 });
      const card = await page.waitForFunction((s) => {
        try {
          const all = SiteList.merge(sitesLoad(), sitesRemote, sitesRemote !== null);
          const x = all.find((y) => y && y.slug === s);
          if (x && document.querySelector('.st-card[data-open="' + CSS.escape(x.id) + '"]')) return x.id;
        } catch (e) { /* the list's own id below */ }
        return document.querySelector('.st-card[data-open="srv_' + s + '"]') ? "srv_" + s : "";
      }, slug, { timeout: 90000 }).then((h) => h.jsonValue()).catch(() => "");
      if (!card) return false;
      await page.click('.st-card[data-open="' + card + '"] .st-card-name');
      return page.waitForSelector("#stPlus", { timeout: 60000 }).then(() => true, () => false);
    };
    const attach = async () => {
      const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("#stPlus")]);
      await chooser.setFiles(file);
      return page.waitForFunction(() => { const c = [...document.querySelectorAll(".st-att-state")]; return c.length === 1 && /ready/.test(c[0].textContent); }, null, { timeout: 120000 }).then(() => true, () => false);
    };
    const clear = async () => { while (await page.locator("[data-media]").count()) await page.locator("[data-media]").first().click(); };
    const where = () => page.evaluate(() => ({ path: location.pathname, cards: [...document.querySelectorAll(".st-card")].map((c) => c.getAttribute("data-open")).slice(0, 12), gate: (() => { const g = document.getElementById("authGate"); return !!g && getComputedStyle(g).display !== "none"; })() })).catch((e) => ({ unread: String(e).slice(0, 80) }));
    if (!check("B2 the app opens signed in on the site's workspace", await open(), JSON.stringify(await where()))) return;
    check("B2 a file attached in the composer goes up and is ready", await attach(), "never ready");
    const after1 = (await names()) || [];
    const fresh = after1.filter((n) => !start.includes(n));
    check("B2 exactly one new file in the library", fresh.length === 1, JSON.stringify(fresh));
    check("B2 its parts were sent", parts.length > 0, parts.length);
    await page.reload({ waitUntil: "domcontentloaded" });
    const reopened = await page.waitForSelector("#stPlus", { timeout: 60000 }).then(() => true, () => open());
    check("B2 the workspace opens again after a reload", reopened, "no workspace");
    const sentBefore = parts.length;
    check("B2 attached again after the reload, it is ready", await attach(), "never ready");
    check("B2 … and reused: no part sent, no new file", parts.length === sentBefore && ((await names()) || []).filter((n) => !start.includes(n)).length === 1, parts.length - sentBefore);
    if (fresh[0]) {
      await page.evaluate((s) => {
        try { const x = SiteList.merge(sitesLoad(), sitesRemote, sitesRemote !== null).find((y) => y && y.slug === s); if (x) siteFiles(x); } catch (e) { /* the panel is read below */ }
      }, slug).catch(() => {});
      const tile = await page.waitForSelector(".fl-ismedia", { timeout: 20000 }).then(() => page.evaluate(() => [...document.querySelectorAll(".fl-ismedia")].map((f) => !!f.querySelector("video, audio"))), () => []);
      check("B3 the Files panel lists it as media with a player", tile.some(Boolean), JSON.stringify(tile));
      await page.click("#siteFilesModal .si-x").catch(() => {});
      await page.waitForSelector("#siteFilesModal", { state: "detached", timeout: 10000 }).catch(() => {});
      await clear();
      const del = await page.evaluate((u) => apiFetch(u, { method: "DELETE" }).then((r) => r.status), "/api/site/" + slug + "/uploads/" + fresh[0] + "?force=1");
      check("B2 deleted from the page", del === 200, del);
      const sent2 = parts.length;
      check("B2 attached again after the delete, it is ready", await attach(), "never ready");
      const now = ((await names()) || []).filter((n) => !start.includes(n));
      check("B2 … and sent again as a new file", parts.length > sent2 && now.length === 1 && now[0] !== fresh[0], JSON.stringify({ sent: parts.length - sent2, now }));
      await clear();
    }
    check("B2 nothing outside the site's own media was written from the page", blocked.length === 0, JSON.stringify(blocked));
  } finally {
    if (browser) await browser.close().catch(() => {});
    const end = await names();
    for (const n of (end || []).filter((x) => !start.includes(x))) await call("DELETE", "/api/site/" + slug + "/uploads/" + n + "?force=1").catch(() => {});
    const back = await names();
    check("B2 the library ends as it was found", Array.isArray(back) && back.length === start.length && back.every((n) => start.includes(n)), JSON.stringify(back));
    results.recorded.push({ composer: { blocked } });
  }
}

// ── CONVERSATION (paid) ─────────────────────────────────────────────────────

/** Before every paid send: images off on the live Worker, the balance read, and the harness's ceiling. */
async function beforeSend(ctx, what, estimate) {
  const { call, check, results, opts, balance } = ctx;
  const h = await call("GET", "/api/site/runtime?slug=" + encodeURIComponent(opts.slug || ""));
  if (!check(what + ": IMAGE_PURCHASES is off on the live Worker, read just now", h.body && h.body.imagePurchases === false, h.body && h.body.imagePurchases)) { results.stopped = "image purchases not off"; return null; }
  const b = await balance();
  if (!check(what + ": the balance reads just now", b !== null, b)) { results.stopped = "balance unread"; return null; }
  const spent = results.spends.reduce((n, s) => n + s.spent, 0);
  if (spent + estimate.high > opts.maxCredits) {
    check(what + ": within this run's own ceiling (" + opts.maxCredits + ")", false, "spent " + spent + " + upper estimate " + estimate.high);
    results.stopped = "ceiling";
    return null;
  }
  return b;
}
async function afterSend(ctx, what, before, estimate) {
  const { balance, results, check, opts } = ctx;
  const after = await balance();
  const spent = before !== null && after !== null ? before - after : null;
  results.spends.push({ what, before, after, spent: spent === null ? 0 : spent, estimate: estimate.low + "–" + estimate.high });
  check(what + ": the balance reads after", after !== null, after);
  const total = results.spends.reduce((n, s) => n + s.spent, 0);
  if (total > opts.maxCredits) { results.stopped = "spent past the ceiling"; check(what + ": the run stayed within its ceiling", false, total + " > " + opts.maxCredits); }
  return spent;
}

async function converseChecks(ctx) {
  const { opts, call, check, results } = ctx;
  for (const c of CONVERSE_CASES) {
    if (results.stopped) break;
    const { history, cutProven } = caseHistory(c);
    if (c.thread === "cut" && !check(c.id + ": the third version is past the page's cut before anything is sent", cutProven, "")) continue;
    const before = await beforeSend(ctx, c.id, ESTIMATES.message);
    if (before === null) break;
    const r = await call("POST", "/api/site/route", { json: { message: c.message, slug: opts.slug, picker: opts.picker || "grok", hasSite: true, firstBuild: false, picked: false, history, files: c.files || [], brief: c.message, qa: [], answering: false } });
    const spent = await afterSend(ctx, c.id, before, ESTIMATES.message);
    const b = r.body || {};
    results.recorded.push({ case: c.id, expect: c.expect, intent: b.intent, replyFrom: b.replyFrom, cost: b.cost, spent, answer: typeof b.answer === "string" ? b.answer : null, reasons: b.decision && b.decision.reasons });
    check(c.id + ": answered as conversation", r.status === 200 && b.intent === "ask", r.status + " " + b.intent);
    check(c.id + ": the reply was written by its own call", b.replyFrom === "conversation", b.replyFrom);
    check(c.id + ": charged once, as the ledger shows", spent !== null && spent === Number(b.cost), "ledger " + spent + " vs reply " + b.cost);
    check(c.id + ": no claim of inspection that did not happen", typeof b.answer === "string" && !/\bI (?:checked|visited|watched|listened to|opened|browsed|tested)\b/i.test(b.answer), "");
    if (c.thread === "cut") {
      check(c.id + ": told the history was cut", Array.isArray(b.decision && b.decision.reasons) && b.decision.reasons.includes("history-cut"), JSON.stringify(b.decision && b.decision.reasons));
      check(c.id + ": nothing written out from a part it could not see", b.resolved === undefined, String(b.resolved));
      check(c.id + ": it asks rather than guessing", typeof b.answer === "string" && b.answer.includes("?"), "");
    }
  }
}

// ── A NEW BUILD WITH DRAFTS (paid) ──────────────────────────────────────────

async function buildChecks(ctx) {
  const { opts, call, check, results, log } = ctx;
  const dir = opts.fixtures;
  const drafts = [];
  for (const f of ["clip.webm", "tone.mp3"]) {
    const u = await uploadVia(call, "/api/media/drafts", new Uint8Array(readFileSync(path.join(dir, f))), f);
    if (check("the draft " + f + " is kept before the site exists", u.done && u.done.status === 201 && !u.done.body.url, u.done && u.done.status)) drafts.push({ file: f, name: u.done.body.name, session: u.session });
  }
  if (drafts.length !== 2) return;
  const before = await beforeSend(ctx, "P9 build", ESTIMATES.build);
  if (before === null) return;
  const chat = "media-verify-" + Date.now().toString(36);
  const brief = "A small bakery in Leeds called Harbour Loaf. Put the attached video on the home page and the jingle on an About page.";
  let r = await call("POST", "/api/site/react-build", { json: { brief, images: [], picker: opts.picker || "grok", qa: [], chat, accept: "early", media: drafts.map((d) => d.name) } });
  // AN EARLY-ACCEPTED BUILD (the combined candidate's route) is followed by its poll.
  if (r.status === 202 && r.body && typeof r.body.poll === "string") {
    const until = Date.now() + 20 * 60 * 1000;
    let last = r;
    while (Date.now() < until) {
      await (opts.sleep || ((ms) => new Promise((ok) => setTimeout(ok, ms))))(10000);
      last = await call("GET", r.body.poll);
      if (last.status !== 202 && !(last.body && last.body.pending)) break;
    }
    r = last;
  }
  const spent = await afterSend(ctx, "P9 build", before, ESTIMATES.build);
  const b = r.body || {};
  results.recorded.push({ build: b.slug, notes: b.notes, contextNote: b.contextNote, media: b.media, images: b.images, cost: b.cost, spent });
  check("P9 the build answered", r.status === 200 && !!b.slug, r.status);
  check("P9 both drafts moved into the new site's library", b.media && Array.isArray(b.media.placed) && b.media.placed.length === 2 && !(b.media.missing || []).length, JSON.stringify(b.media));
  check("P9 no fixed narration of the move", !/is in your site's file library now|were given (its|their) address/.test(String(b.contextNote || "")), String(b.contextNote || ""));
  check("P9 the reply is the model's own and names where the files are (read it)", typeof b.notes === "string" && b.notes.length > 0, String(b.notes || "").slice(0, 200));
  check("P9 no photograph was bought", !b.images || !Number(b.images.made), JSON.stringify(b.images));
  for (const p of (b.media && b.media.placed) || []) {
    const g = await call("GET", p.url);
    check("P9 " + p.name + " is served from the new site", g.status === 200, g.status);
  }
  const left = await call("GET", "/api/media/drafts");
  check("P9 the moved drafts are no longer drafts", left.status === 200 && !(left.body.files || []).some((f) => drafts.some((d) => d.name === f.name)), JSON.stringify(left.body && left.body.files));
  for (const d of drafts) {
    const s = await call("GET", "/api/media/drafts/" + d.session);
    check("P9 the draft " + d.file + "'s receipt says removed", s.status === 200 && s.body.state === "removed", s.status + " " + (s.body && s.body.state));
  }
  log("P9 built " + b.slug + " — the site stays, for the conversation cases and the owner's reading");
}

// ── THE COMMAND LINE ────────────────────────────────────────────────────────

if (import.meta.url === "file://" + process.argv[1]) {
  const env = process.env;
  const { ownerSession } = await import("./owner-session.mjs");
  const out = env.RESULT_FILE || "media-verify.json";
  let token, user, refresh, expiresAt;
  try {
    ({ jwt: token, user, refresh, expiresAt } = await ownerSession({ supabaseUrl: env.SUPABASE_URL, serviceKey: env.SUPABASE_SERVICE_KEY, anonKey: env.SUPABASE_ANON_KEY, email: env.OWNER_EMAIL, log: console.log }));
  } catch (e) { console.error("FATAL: " + (e && e.message || e)); process.exit(2); }
  let browsers = {};
  let composer = null;
  if (env.MODE === "browser") {
    const pw = await import("playwright-core").catch(() => null);
    if (pw) {
      browsers = {
        chromium: () => pw.chromium.launch({ executablePath: env.CHROMIUM_PATH || undefined }),
        chrome: () => pw.chromium.launch({ channel: "chrome" }),
        firefox: () => pw.firefox.launch(),
        webkit: () => pw.webkit.launch(),
      };
      composer = { launch: browsers.chromium, token, user, refresh, expiresAt };
    }
  }
  const r = await run({
    fetch, base: env.APP_ORIGIN || "https://gofarther.dev", token, mode: env.MODE || "rehearsal", slug: env.SITE || "",
    mutate: env.MUTATE, spend: env.SPEND, maxCredits: env.MAX_CREDITS ? Number(env.MAX_CREDITS) : undefined,
    fixtures: path.resolve("test/fixtures/media"), browsers, composer, requiredEngines: ["chromium", "chrome", "firefox", "webkit"], repeat: Number(env.REPEAT) || 3, picker: env.PICKER || "grok",
    log: console.log,
  });
  writeFileSync(out, JSON.stringify(r, null, 2));
  console.log(r.ok ? "RESULT  ok" : r.refused ? "RESULT  refused: " + r.refused : "RESULT  failed");
  process.exit(r.ok ? 0 : r.refused ? 2 : 1);
}
