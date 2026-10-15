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
//              Chromium, Firefox and WebKit, and Google Chrome; each one
//              required, a missing one fails the run) play every fixture from
//              its `/u/` address — play() starts, the clock advances, a seek
//              lands and playback continues, with no media error;
//              the composer and Files panel run in Chromium on the real app,
//              signed in, with every write but this site's media aborted:
//              attach, reload and reattach (reused), delete and reattach (sent
//              again); no message is ever sent. Cleaned up the same way.
//              Needs `mutate=yes`.
//   converse   PAID: routing plus the reply's own call per message, on an
//              existing site (no Build). Six deterministic cases, the
//              cut-history one built from a fixed thread through the page's own
//              `historyWire`, so it never depends on a model writing a long
//              answer. Objective facts pass or fail (answered as
//              conversation, nothing started, the cut told and not leaked);
//              each case's PURPOSE is UNVERIFIED, kept with the whole answer,
//              the source evidence it should be read against and heuristic
//              hints, for a person (`judgeCase`). A case whose fixture cannot
//              serve it is not sent. Needs `spend=yes`,
//              `max_credits`, and IMAGE_PURCHASES verified off on the live
//              Worker before EVERY send.
//   build      PAID: one new Build with two drafts attached before the site
//              exists; not started — not even its drafts — without a steady
//              starting ledger reading (read again just before the send).
//              Judged on the drafts moved, the files served, NO image bought
//              and the charge explained by the ledger; whether the narration
//              places the files rightly is unverified, kept whole. Same gates
//              as converse.
//
// EXIT CODES: 0 passed · 3 passed everything the automation can establish,
// with answers left for a person to read (`results.unverified`) · 1 failed,
// stopped, or a charge unknown · 2 refused before anything was done. The
// results file is written in every case, an exception included.
//
// AN UNKNOWN CHARGE STOPS THE RUN. After every paid send the balance must
// read and its movement must equal the cost the reply reports (a Build's, the
// ledger window explains: `buildMoneyVerdict`). Otherwise the spend is
// recorded as unknown (`spent: null`, never 0) or unreconciled, and no later
// paid send is made.
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

import { extractText } from "../builder/site-text.mjs";
import { buildMoneyVerdict, stableReading } from "./canary-build.mjs";

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
  // A FOLLOW-UP EXPECTED TO ROUTE AS WORK (2026-10-15): routing only — the
  // harness never sends the work itself — unless the router answers it as talk,
  // when the reply's own call is added, as for any message.
  followUp: { low: 1, high: 6, why: "routing only (measured 1–2) when it routes as work; up to a message's cost if it is answered as talk" },
});

// ── THE DETERMINISTIC CONVERSATION CASES ────────────────────────────────────

/** A long earlier reply whose third version lies past the page's 4,000-character cut. */
export function cutThread() {
  const filler = (n) => (" The bakery's mornings start before dawn, with the ovens warming and the first loaves shaped by hand." ).repeat(n);
  const reply = "Here are three versions of your headline, each with why it works.\n\nVersion one: Bread at dawn." + filler(18) +
    "\n\nVersion two: Baked while the harbour sleeps." + filler(30) + "\n\nVersion three: Crusts beside the lighthouse." + filler(4);
  return [
    { r: "u", t: "Give me three versions of a headline for my home page, with a long explanation of each." },
    { r: "a", t: reply, md: true },
    { r: "u", t: "ok, use the third version" },
  ];
}

/**
 * THE SIX CASES, EACH WITH THE PURPOSE IT IS JUDGED ON (2026-10-15, after
 * Codex's review of `1b52561f`). Codex sent the same irrelevant answer to all
 * six — "Your bakery opens at 3:17am on Sundays. Does that help?" — and every
 * case passed, because the harness read the reply's metadata and almost none
 * of its content. Each case is now judged against known evidence by
 * `judgeCase`: what the stored pages say, what they do not say, what the cut
 * history hid, and what file was attached. Wording is never required. A
 * purpose the automation cannot establish either way is UNVERIFIED, and the
 * whole answer is kept for a person to read.
 *
 * C8's attachment is the line the page itself appends for a video
 * (`mediaRefLine` in public/chat.js), in the form it takes before the file has
 * an address: this mode makes no upload, so it names no address it did not make.
 */
export const CONVERSE_CASES = Object.freeze([
  { id: "C1-greeting", message: "hi", thread: [], expect: "a short greeting and an invitation to say what they want; no work" },
  { id: "C2-compare", message: "Should I take bookings for bread-making classes with a booking page or an enquiry form? Compare them for me.", thread: [], expect: "a comparison that addresses both the booking page and the enquiry form; no work" },
  { id: "C3-grounded", message: "What does my home page say? Summarise it in two sentences.", thread: [], needs: "pages", expect: "an answer drawn from the stored home page's own words; never a claim of having visited the live site" },
  { id: "C4-missing", message: "What time do we open on Sundays?", thread: [], needs: "absent-hours", expect: "says it was not shown Sunday hours and how to add them; never an invented time" },
  { id: "C5-cut-history", message: "ok, use the third version", thread: "cut", expect: "asks for the third version again (it was past the cut); `resolved` absent; nothing from the hidden part; no work" },
  { id: "C8-attachment", message: "What could I use this clip for on my site?\n\n[Attached video \"clip.webm\"]", thread: [], expect: "talks about the attached clip as a file it was not shown; no claim of having watched it" },
  // ── THE CONVERSATION BATCH (2026-10-15): advice, plans and follow-ups ──
  // A case that `route`s as work is sent to the routing route only: the harness
  // never posts the work, so nothing on the site changes. What it checks is the
  // boundary — talk stays talk, a clear go-ahead becomes the work written out.
  { id: "C9-advice", message: "What would you improve first on my site, and why? Just the few things that matter most.", thread: [], needs: "pages", expect: "a few prioritised suggestions grounded in what the stored pages have and lack, each with why, suggestions kept apart from what the site says; no work" },
  { id: "C10-brainstorm", message: "Give me three ideas for a new headline on my home page. Don't change anything yet.", thread: [], expect: "three numbered headline ideas to choose from; no work" },
  { id: "C11-second-idea", message: "use the second idea", thread: "ideas", route: "work", expect: "routed as work, the second headline idea written out in full in `resolved`; no question back" },
  { id: "C12-ambiguous", message: "use the second one", thread: "two-lists", expect: "asks which list is meant (headlines or colours); nothing written out; no work" },
  { id: "C13-every-page", message: "do that on every page", thread: "footer", route: "work", expect: "routed as work, the footer line written out for every page of the site by its address" },
  { id: "C15-keep-style", message: "keep that style for the Visit page too", thread: "style", route: "work", expect: "routed as work, the style the conversation named (cream background, dark green serif headings) written out for the Visit page" },
]);

/**
 * THE FIXED THREADS the follow-up cases lean on: earlier turns as the page
 * keeps them (`{ r, t }`), written here — no model writes them — so the case
 * says exactly what "the second idea" or "that style" refers to.
 */
export const FOLLOW_UP_THREADS = Object.freeze({
  ideas: [
    { r: "u", t: "Give me three ideas for a new headline on my home page." },
    { r: "a", t: "Here are three, each with why it might work:\n\n1. **Bread at dawn** — short, and says when you bake.\n2. **Baked while the harbour sleeps** — gives the bakery a place and a story.\n3. **Your loaf, held for you** — leads with ordering ahead.", md: true },
  ],
  "two-lists": [
    { r: "u", t: "Ideas for a new headline, and for the colours?" },
    { r: "a", t: "Headlines:\n1. Bread at dawn\n2. Baked while the harbour sleeps\n\nColours:\n1. Harbour blue with white\n2. Cream with dark green", md: true },
  ],
  footer: [
    { r: "u", t: "What could go in the footer of my home page?" },
    { r: "a", t: "A short line with your opening days and a link to the Visit page would help people who scroll to the bottom looking for when to come." },
    { r: "u", t: "Good. Put that in the home page footer." },
    { r: "a", t: "That can be done as a change — just ask for it." },
  ],
  style: [
    { r: "u", t: "How could the home page feel warmer?" },
    { r: "a", t: "A cream background with dark green serif headings would feel warmer and suit a bakery." },
    { r: "u", t: "Go ahead on the home page." },
    { r: "a", t: "Your home page now has a cream background with dark green serif headings." },
  ],
});

// ── JUDGING A CONVERSATIONAL ANSWER AGAINST EVIDENCE ────────────────────────

const STOP = new Set("about above after again against their there these those which while would could should other where being through before between under every along with from into that this what when your yours have will been were they them then than also just like more most some such only very much many here make made page pages home site website bakery".split(" "));

/** The stored pages' own words, as the conversation step reads them (`extractText`). */
export function pageEvidence(pages, extract) {
  if (!Array.isArray(pages)) return null;
  const out = [];
  for (const p of pages) {
    if (!p || typeof p.source !== "string") continue;
    let text = "";
    try { text = extract(p.source).map((it) => it.text).join(" \u00b7 "); } catch { text = ""; }
    out.push({ path: String(p.path || ""), text });
  }
  return out;
}

/**
 * SPECIFICS A REPLY MAY ONLY REPEAT, NEVER INVENT: clock times, prices, phone
 * numbers and email addresses. Each one in an answer must appear in the
 * evidence the reply had (the stored pages, the message and the history it was
 * sent); one that does not was made up. Only these four kinds are checked,
 * because only these can be found without reading for meaning.
 */
export function specificsIn(text) {
  const t = String(text || "");
  const out = new Set();
  // ONE KEY FOR A TIME HOWEVER IT IS WRITTEN: "3pm", "3:00 p.m." and "15:00" are the same time.
  for (const m of t.matchAll(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)(?![a-z])/gi)) {
    const h = Number(m[1]) % 12 + (/^p/i.test(m[3]) ? 12 : 0);
    if (Number(m[1]) <= 12) out.add("time " + h + ":" + (m[2] || "00"));
  }
  for (const m of t.matchAll(/\b([01]?\d|2[0-3]):([0-5]\d)\b(?!\s*(?:a\.?m|p\.?m))/gi)) out.add("time " + Number(m[1]) + ":" + m[2]);
  for (const m of t.matchAll(/[£$€]\s?\d+(?:[.,]\d{1,2})?/g)) out.add("price " + m[0].replace(/\s/g, ""));
  for (const m of t.matchAll(/(?:\+\d{1,3}[\s-]?)?(?:\(?\d{2,5}\)?[\s-]?){2,4}\d{3,4}/g)) { const d = m[0].replace(/\D/g, ""); if (d.length >= 9) out.add("phone " + d.slice(-9)); }
  for (const m of t.matchAll(/[\w.+-]+@[\w-]+\.[\w.]+/g)) out.add("email " + m[0].toLowerCase());
  return out;
}

const words = (t) => new Set(String(t || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9\s'-]/g, " ").split(/\s+/).map((w) => w.replace(/^'+|'+$/g, "")).filter((w) => w.length >= 5 && !STOP.has(w)));
const INSPECTED = /\bI(?:'ve| have)?\s+(?:just\s+)?(?:checked|visited|watched|listened to|opened|browsed|tested|looked at|played|viewed)\b/i;
const SAW_CLIP = /\b(?:the|this|your)\s+(?:clip|video|footage)\s+(?:shows|features|opens with|starts with|has (?:a|some)|captures|depicts)\b|\bin (?:the|this|your) (?:clip|video),?\s+(?:I|we|you can) (?:can )?see\b/i;
const NOT_SHOWN = /\b(?:can(?:not|'t)|could(?:n't| not)|unable to|haven't|have not|didn't|did not|don't|do not|wasn't|was not|weren't|isn't|is not|not been|no way to)\b[^.?!]{0,60}\b(?:see|seen|watch|watched|view|viewed|play|played|open|opened|shown|access|look|know|tell|find|listed|mentioned|included)\b|\bnot (?:listed|mentioned|shown|included|on (?:your|the) (?:site|page))\b|\bno (?:sunday|opening|hours)\b/i;
const HOW_TO_ADD = /\b(?:add|update|put|include|list|set|tell me|let me know|send me|share)\b/i;
const ASKS_AGAIN = /\b(?:paste|share|send|resend|repeat|remind|again|re-?share|which (?:one|version|headline)|what (?:was|is|did) (?:the )?(?:third|version|headline))\b/i;

/**
 * ONE CASE'S ANSWER: OBJECTIVE FACTS PASS OR FAIL; MEANING IS UNVERIFIED
 * (2026-10-15, after Codex's review of `60c26eff`). Codex showed the previous
 * judge failing valid natural language: a stored "Car repairs performed by
 * certified mechanics" against the answer "Our skilled technicians fix
 * vehicles" shared no keyword and failed, and C2 failed a plainly hypothetical
 * "For example, you could charge $20 per class". Keyword overlap and an
 * unmatched number cannot establish whether an answer is right or invented, so
 * neither decides anything now.
 *
 * What CAN be established decides pass or fail:
 *   - it was answered as conversation, by the reply's own call, with nothing started;
 *   - there is an answer at all;
 *   - C5: the route was told the history was cut, wrote nothing out from it,
 *     and the answer does not carry the hidden headline itself, verbatim — text
 *     it could only have had if the cut leaked.
 * What cannot — whether it is grounded, sound, honest about what it was not
 * shown, free of invention — is ONE unverified item per case, carrying the
 * whole answer, the source evidence it should be read against, and the
 * heuristic signals as hints for the reader (never as a verdict).
 *
 * Answers `{ checks: [{ name, verdict, detail }], review: { case, expect, answer, evidence, signals } | null }`.
 *   evidence: { pages: [{path, text}] | null, homePath, history (the sent turns), hidden (text the cut hid) }
 */
export function judgeCase(c, body, evidence) {
  const checks = [];
  const put = (name, verdict, detail = "") => checks.push({ name: c.id + ": " + name, verdict, detail: String(detail).slice(0, 400) });
  const b = body && typeof body === "object" ? body : {};
  const answer = typeof b.answer === "string" ? b.answer : null;
  // A CLEAR GO-AHEAD (2026-10-15): routed as work, the request written out
  // from the conversation, and no reply asking them to confirm. Whether what
  // was written out is what they agreed to is a person's reading: the thread
  // and the request are kept side by side.
  if (c.route === "work") {
    const work = b.intent === "edit" || b.intent === "addon";
    put("routed as work, not answered as talk", work ? "pass" : "fail", b.intent);
    const written = typeof b.resolved === "string" && b.resolved.trim() ? b.resolved.trim() : "";
    put("the request was written out from the conversation", written ? "pass" : "fail", written ? "" : "no `resolved`");
    put("no question back asking them to confirm", b.replyFrom !== "conversation" && !b.question ? "pass" : "fail", b.replyFrom || (b.question ? "question" : ""));
    const signals = [];
    const thread = (evidence && evidence.thread) || [];
    const said = thread.map((t) => (t.r === "u" ? "Owner: " : "Assistant: ") + t.t).join("\n");
    if (written) {
      const shared = [...words(written)].filter((w) => words(said).has(w));
      signals.push("shares " + shared.length + " words with the thread: " + shared.slice(0, 10).join(", "));
      const pages = Array.isArray(evidence && evidence.pages) ? evidence.pages.map((p) => p.path) : [];
      if (c.thread === "footer" && pages.length) signals.push("names " + pages.filter((p) => written.includes(p)).length + " of the site's " + pages.length + " page addresses");
    }
    put("what was written out is what they agreed to (read it)", "unverified", signals.join("; "));
    return { checks, review: { case: c.id, expect: c.expect, answer: written || answer, evidence: { thread: said, intent: b.intent, resolved: written || null }, signals } };
  }
  put("answered as conversation, with nothing started", b.intent === "ask" && !b.job && !b.request && !b.resolved ? "pass" : "fail", b.intent + (b.job ? " job " + b.job : ""));
  put("the reply was written by its own call", b.replyFrom === "conversation" ? "pass" : "fail", b.replyFrom);
  if (answer === null || !answer.trim()) { put("there is an answer to judge", "fail", "no answer"); return { checks, review: null }; }
  const ev = evidence || {};
  const pages = Array.isArray(ev.pages) ? ev.pages : null;
  const pageText = pages ? pages.map((p) => p.text).join(" \n ") : null;
  const sentText = [c.message, ...((ev.history || []).map((h) => (h && (h.text || h.t)) || ""))].join(" \n ");

  if (c.id === "C5-cut-history") {
    const reasons = b.decision && Array.isArray(b.decision.reasons) ? b.decision.reasons : [];
    put("the route was told the history was cut", reasons.includes("history-cut") ? "pass" : "fail", JSON.stringify(reasons));
    put("nothing written out from a part it could not see", b.resolved === undefined ? "pass" : "fail", String(b.resolved));
    const headline = (String(ev.hidden || "").match(/Version three:\s*([^.\n]+)/) || [])[1] || "";
    const norm = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    put("the hidden headline itself is not in the answer", headline && norm(answer).includes(norm(headline)) ? "fail" : "pass", headline);
  }

  // ── HINTS FOR THE READER, NEVER A VERDICT ──
  const signals = [];
  const known = new Set([...specificsIn(sentText), ...(pageText === null ? [] : specificsIn(pageText))]);
  const unmatched = [...specificsIn(answer)].filter((x) => !known.has(x));
  if (unmatched.length) signals.push("specifics not in the pages or the message (an example, or invented? read it): " + unmatched.join(", "));
  if (INSPECTED.test(answer)) signals.push("reads like a claim of inspection: \"" + answer.match(INSPECTED)[0] + "\"");
  let source = null;
  if (c.id === "C1-greeting") signals.push(answer.length + " characters");
  if (c.id === "C12-ambiguous") {
    const reasons = b.decision && Array.isArray(b.decision.reasons) ? b.decision.reasons : [];
    signals.push(reasons.includes("unclear") ? "the router named what was unclear" : "the router named nothing as unclear");
    signals.push(/\b(?:headline|colou?r)s?\b/i.test(answer) ? "the reply names a list" : "the reply names neither list");
  }
  if (c.id === "C9-advice" || c.id === "C10-brainstorm") signals.push(/(^|\n)\s*\d+[.)]\s/.test(answer) ? "numbered" : "not numbered");
  if (c.id === "C2-compare") {
    signals.push(/\bbook/i.test(answer) ? "mentions booking" : "never says \"book…\" (a paraphrase?)");
    signals.push(/\b(?:enquir|inquir)/i.test(answer) ? "mentions enquiries" : "never says \"enquir…\" (a paraphrase?)");
  }
  if (c.id === "C3-grounded") {
    const home = pages ? pages.find((p) => p.path === (ev.homePath || "/")) || pages[0] : null;
    source = home ? { path: home.path, text: home.text.slice(0, 2000) } : null;
    if (home) {
      const asked = words(c.message);
      const aw = words(answer);
      const shared = [...words(home.text)].filter((w) => !asked.has(w) && aw.has(w));
      signals.push("shares " + shared.length + " of the home page's words" + (shared.length ? ": " + shared.slice(0, 8).join(", ") : " (a paraphrase is still possible)"));
    } else signals.push("the home page's words could not be read");
  }
  if (c.id === "C4-missing") {
    source = { hoursAbsent: hoursAbsent(pages).why };
    signals.push(NOT_SHOWN.test(answer) ? "a sign it says it was not shown: \"" + answer.match(NOT_SHOWN)[0] + "\"" : "no plain sign it says it was not shown");
    signals.push(HOW_TO_ADD.test(answer) ? "a sign it says how to add them" : "no plain sign of how to add them");
  }
  if (c.id === "C5-cut-history") {
    source = { hidden: String(ev.hidden || "").slice(0, 300) };
    const hidden = words(ev.hidden || "");
    const seen = words(sentText);
    const leaked = [...words(answer)].filter((w) => hidden.has(w) && !seen.has(w));
    if (leaked.length) signals.push("words found only in the hidden part (a guess, or a leak? read it): " + leaked.join(", "));
    signals.push(/\b(?:third|version|headline|3rd)\b/i.test(answer) && (answer.includes("?") || ASKS_AGAIN.test(answer)) ? "a sign it asks for the third version again" : "no plain sign it asks again");
  }
  if (c.id === "C8-attachment") {
    source = { attached: (c.message.match(/\[Attached[^\]]*\]/) || [""])[0] };
    signals.push(/\b(?:clip|video|webm|footage)\b/i.test(answer) ? "mentions the clip" : "never says clip/video (a paraphrase?)");
    if (SAW_CLIP.test(answer)) signals.push("reads like a description of its contents: \"" + answer.match(SAW_CLIP)[0] + "\"");
    signals.push(NOT_SHOWN.test(answer) ? "a sign it says it was not shown the clip" : "no plain sign it says it was not shown the clip");
  }
  put("does what the case is for: " + c.expect + " (read it)", "unverified", signals.join("; "));
  // EVERYTHING A READER NEEDS BESIDE THE ANSWER (2026-10-15): the thread it
  // was sent, whole, and — for the advice case — every stored page it should
  // be read against, so meaning can be judged without a second look anywhere.
  const thread = Array.isArray(ev.thread) && ev.thread.length
    ? ev.thread.map((t) => (t.r === "u" ? "Owner: " : "Assistant: ") + t.t).join("\n")
    : (ev.history || []).map((h) => (h.role === "user" ? "Owner: " : "Assistant: ") + (h.text || "") + (h.full ? " [cut by the page: " + h.full + " characters before the cut]" : "")).join("\n");
  const kept = { ...(source || {}), ...(thread ? { thread } : {}), message: c.message };
  if (c.id === "C9-advice" && pages) kept.pages = pages.map((p) => ({ path: p.path, text: p.text.slice(0, 2000) }));
  return { checks, review: { case: c.id, expect: c.expect, answer, evidence: kept, signals } };
}

/** Before C4 may spend: the stored pages must really lack Sunday opening times. */
export function hoursAbsent(pages) {
  if (!Array.isArray(pages) || !pages.length) return { ok: false, why: "the stored pages could not be read" };
  const all = pages.map((p) => p.text).join(" \n ");
  if (/\bsun(?:day)?s?\b/i.test(all)) return { ok: false, why: "the pages mention Sunday" };
  const times = [...specificsIn(all)].filter((x) => /^time /.test(x));
  if (times.length) return { ok: false, why: "the pages give times: " + times.slice(0, 4).join(", ") };
  if (/\bopen(?:ing)?\s+(?:hours|times)\b|\bhours\s*:/i.test(all)) return { ok: false, why: "the pages list opening hours" };
  return { ok: true, why: "no Sunday, no times, no opening hours in " + pages.length + " pages" };
}

/**
 * The history the page would send for a case — through the page's own
 * `historyWire`, so the cut is the real one — and, for the cut case, proof
 * BEFORE any call that the third version really is past the cut.
 */
export function caseHistory(c) {
  if (typeof c.thread === "string" && FOLLOW_UP_THREADS[c.thread]) return { history: ChatTalk.historyWire(FOLLOW_UP_THREADS[c.thread], c.message), cutProven: null };
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
  const results = { mode: opts.mode, slug: opts.slug, checks: [], spends: [], recorded: [], unverified: [] };
  // THREE VERDICTS: pass, fail, and unverified — what the automation could
  // not establish either way, kept with its evidence for a person to read.
  const verdict = (name, v, detail = "") => {
    results.checks.push({ name, verdict: v, pass: v === "pass", detail: String(detail).slice(0, 400) });
    log((v === "pass" ? "PASS  " : v === "fail" ? "FAIL  " : "UNVER ") + name + (detail ? "  " + String(detail).slice(0, 200) : ""));
    return v === "pass";
  };
  const check = (name, pass, detail = "") => verdict(name, pass ? "pass" : "fail", detail);
  const refuse = (why) => { log("REFUSED: " + why); return { ok: false, refused: why, results, unmet: [why] }; };
  try {
    return await runInner(opts, { results, verdict, check, refuse, log });
  } catch (e) {
    // A NETWORK EXCEPTION KEEPS ITS EVIDENCE: whatever was read, sent and
    // spent so far stays in the results, and the run is stopped, not lost.
    results.error = String((e && e.stack) || e).slice(0, 1200);
    results.stopped = results.stopped || "exception";
    results.outcome = "failed";
    if (PAID.has(opts.mode)) results.spending = spendSummary(results, opts);
    log("ERROR " + String((e && e.message) || e));
    return { ok: false, results, unmet: [], error: results.error };
  }
}

async function runInner(opts, { results, verdict, check, refuse, log }) {
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

  const ctx = { opts, call, check, verdict, log, results, siteOrigin, balance, startBalance };
  try {
    if (opts.mode === "storage") await storageChecks(ctx);
    if (opts.mode === "browser") await browserChecks(ctx);
    if (opts.mode === "converse") await converseChecks(ctx);
    if (opts.mode === "build") await buildChecks(ctx);
  } finally {
    if (PAID.has(opts.mode)) results.spending = spendSummary(results, opts);
  }
  return finish(results);
}

/**
 * WHAT A RUN ENDED AS. `ok` only when something was checked, nothing failed,
 * nothing stopped it and no spend is unknown. `review` lists what passed the
 * automation but still needs a person: the unverified items, answers kept.
 */
function finish(results) {
  const failed = results.checks.filter((c) => c.verdict === "fail");
  const review = results.checks.filter((c) => c.verdict === "unverified");
  const unknownSpend = results.spends.some((x) => x.spent === null);
  const ok = results.checks.length > 0 && !failed.length && !results.stopped && !unknownSpend;
  results.outcome = !ok ? "failed" : review.length ? "needs review" : "passed";
  return { ok, review: review.length, results, unmet: [] };
}

/**
 * THE SPENDING, SAID AS IT IS KNOWN. `known` adds only charges the ledger
 * showed and the reply's own cost agreed with; `unknown` counts sends whose
 * charge could not be read or reconciled — never counted as zero. `ledger` is
 * the balance's own movement from the start to the last reading, which also
 * catches a charge nothing reported.
 */
function spendSummary(results, opts) {
  const known = results.spends.filter((x) => x.spent !== null).reduce((n, x) => n + x.spent, 0);
  const unknown = results.spends.filter((x) => x.spent === null).length;
  const last = [...results.spends].reverse().find((x) => x.after !== null && x.after !== undefined);
  return {
    sends: results.spends.length, known, unknown,
    ledger: last && results.balanceAtStart !== null ? results.balanceAtStart - last.after : null,
    ceiling: opts.maxCredits, estimatesAreNotLimits: true,
  };
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

/**
 * PLAYBACK, NOT METADATA (2026-10-15, after Codex's review of `1b52561f`):
 * loading metadata and landing a seek is not playing. In the page: `play()`
 * is called and must resolve, the clock must advance while playing, a seek to
 * 40% must land, and the clock must advance again after it — with no media
 * error at any point. Muted, so autoplay rules allow it.
 */
export const PLAY_IN_PAGE = async ({ src, kind }) => {
  document.body.innerHTML = "";
  const el = document.createElement(kind);
  el.preload = "auto";
  el.muted = true;
  document.body.appendChild(el);
  const errors = [];
  el.addEventListener("error", () => errors.push(el.error ? el.error.code : "error"));
  const once = (ev, ms) => new Promise((ok) => { const t = setTimeout(() => ok(false), ms); el.addEventListener(ev, () => { clearTimeout(t); ok(true); }, { once: true }); });
  const advance = (from, by, ms) => new Promise((ok) => {
    const t0 = Date.now();
    const tick = () => { if (el.currentTime >= from + by) return ok(true); if (el.error || Date.now() - t0 > ms) return ok(false); setTimeout(tick, 50); };
    tick();
  });
  el.src = src;
  const loaded = await once("loadedmetadata", 15000);
  if (!loaded) return { loaded, errors, error: el.error && el.error.code };
  let played = false, playError = "";
  try { await el.play(); played = true; } catch (e) { playError = String((e && e.name) || e); }
  const start = el.currentTime;
  const advanced = played && await advance(start, 0.25, 8000);
  const target = el.duration * 0.4;
  el.currentTime = target;
  const sought = await once("seeked", 15000);
  const landed = el.currentTime;
  const continued = sought && await advance(landed, 0.2, 8000);
  return { loaded, played, playError, advanced, sought, target, landed, continued, paused: el.paused, at: el.currentTime, duration: el.duration, errors, error: el.error && el.error.code };
};

/** What counts as playing: play resolved, the clock advanced, the seek landed and the clock advanced again, no media error. */
export function judgePlayback(got) {
  const g = got && typeof got === "object" ? got : {};
  const why = [];
  if (g.thrown) why.push("the page threw: " + g.thrown);
  if (!g.loaded) why.push("metadata never loaded");
  if (g.played !== true) why.push("play() did not start playback" + (g.playError ? " (" + g.playError + ")" : ""));
  if (g.advanced !== true) why.push("the clock did not advance while playing");
  if (g.sought !== true) why.push("the seek did not land");
  else if (!(Math.abs(Number(g.landed) - Number(g.target)) < 0.5)) why.push("the seek landed at " + g.landed + ", not near " + g.target);
  if (g.continued !== true) why.push("playback did not continue after the seek");
  if ((Array.isArray(g.errors) && g.errors.length) || g.error) why.push("a media error: " + JSON.stringify(g.errors || g.error));
  return { ok: why.length === 0, why: why.join("; ") };
}

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
    // EVERY REQUIRED ENGINE IS GIVEN, OR THE RUN FAILS: a press with no
    // browsers at all used to pass on the one upload check.
    const required = opts.requiredEngines || ["chromium", "chrome", "firefox", "webkit"];
    for (const e of required) if (!(opts.browsers && typeof opts.browsers[e] === "function")) check("B1 " + e + " is available to this run", false, "not given: a required browser is missing");
    for (const [engine, launch] of Object.entries(opts.browsers || {})) {
      let browser = null;
      try { browser = await launch(); } catch (e) {
        results.recorded.push({ engine, unavailable: String(e && e.message || e).slice(0, 120) });
        // AN ENGINE THE RUNNER INSTALLS MUST LAUNCH: a press that silently
        // played nothing in Firefox would read as Firefox passing.
        if (required.includes(engine)) check("B1 " + engine + " launches on this runner", false, String(e && e.message || e).slice(0, 120));
        else log("SKIP  " + engine + " is not on this runner");
        continue;
      }
      try {
        const page = await browser.newPage();
        const exp = BROWSER_EXPECT[engine] || { required: [], recorded: FIXTURES.map((x) => x.file) };
        for (const f of made) {
          const src = (opts.mediaOrigin || opts.base) + f.url;
          const got = await page.evaluate(PLAY_IN_PAGE, { src, kind: f.kind }).catch((e) => ({ thrown: String((e && e.message) || e).slice(0, 200) }));
          const ok = judgePlayback(got).ok;
          results.recorded.push({ engine, file: f.file, ...got });
          if (exp.required.includes(f.file)) check("B1 " + engine + " plays, seeks and keeps playing " + f.file, ok, judgePlayback(got).why + " " + JSON.stringify(got));
          else log("REC   " + engine + " " + f.file + " " + JSON.stringify(got));
        }
      } finally { await browser.close(); }
    }
    for (const u of UNAVAILABLE) results.recorded.push({ engine: u, unavailable: "no such browser on the runner: manual or unverified" });
  } finally {
    for (const f of made) await call("DELETE", "/api/site/" + slug + "/uploads/" + f.name + "?force=1").catch(() => {});
  }
  if (opts.composer) await composerChecks({ opts, call, check, log, results });
  else check("B2 the composer and Files panel were checked", false, "no app browser was given");
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

/**
 * BEFORE EVERY PAID SEND (2026-10-15, after Codex's review of `1b52561f`).
 * Codex's offline run made six sends, spent 22 credits and recorded 10 against
 * a ceiling of 16: the first balance read after a send answered 503, was
 * counted as 0, and nothing stopped. Now a send happens only when:
 *   - photographs are off on the live Worker, read just now;
 *   - no earlier send's charge is unknown or unreconciled (`results.stopped`);
 *   - the balance reads just now, and the ledger's own movement since the start
 *     plus this send's UPPER ESTIMATE stays within the ceiling. The ceiling is
 *     the harness's limit; the estimate only decides whether to try.
 */
async function beforeSend(ctx, what, estimate) {
  const { call, check, results, opts, balance, startBalance } = ctx;
  if (results.stopped) return null;
  const h = await call("GET", "/api/site/runtime?slug=" + encodeURIComponent(opts.slug || ""));
  if (!check(what + ": IMAGE_PURCHASES is off on the live Worker, read just now", h.body && h.body.imagePurchases === false, h.body && h.body.imagePurchases)) { results.stopped = "image purchases not off"; return null; }
  const b = await balance();
  if (!check(what + ": the balance reads just now", b !== null, b)) { results.stopped = "balance unread before a send"; return null; }
  const moved = startBalance - b;
  const recorded = results.spends.reduce((n, x) => n + (x.spent || 0), 0);
  const spent = Math.max(moved, recorded);
  if (spent + estimate.high > opts.maxCredits) {
    check(what + ": within this run's own ceiling (" + opts.maxCredits + ")", false, "spent " + spent + " (ledger moved " + moved + ") + upper estimate " + estimate.high);
    results.stopped = "ceiling";
    return null;
  }
  return b;
}

/**
 * AFTER EVERY PAID SEND: the charge is reconciled or the run stops. The
 * balance must read, and its movement must equal the cost the reply reports.
 * A balance that cannot be read, a reply with no cost, a send that threw, or a
 * movement that disagrees with the reported cost leaves the charge UNKNOWN
 * (`spent: null`, never 0) or UNRECONCILED, and stops every later paid send.
 */
async function afterSend(ctx, what, before, estimate, reported) {
  const { balance, results, check, opts } = ctx;
  let after = null;
  try { after = await balance(); } catch { after = null; }
  const cost = reported === undefined || reported === null || reported === "" || !Number.isFinite(Number(reported)) ? null : Number(reported);
  const moved = before !== null && after !== null ? before - after : null;
  const entry = { what, before, after, reported: cost, spent: moved, estimate: estimate.low + "–" + estimate.high + " (an estimate, not a limit)" };
  results.spends.push(entry);
  if (!check(what + ": the balance reads after the send", after !== null, after)) {
    entry.spent = null;
    entry.why = "balance unread after the send: the charge is unknown";
    results.stopped = "charge unknown";
    return null;
  }
  if (cost === null || moved !== cost) {
    entry.unreconciled = true;
    entry.why = cost === null ? "the reply reported no cost; the ledger moved " + moved : "the ledger moved " + moved + ", the reply reported " + cost;
    check(what + ": the charge reconciles (ledger movement equals the reported cost)", false, entry.why);
    results.stopped = "charge unreconciled";
  } else check(what + ": the charge reconciles (ledger movement equals the reported cost)", true, moved);
  const total = Math.max(results.balanceAtStart - after, results.spends.reduce((n, x) => n + (x.spent || 0), 0));
  if (total > opts.maxCredits) { results.stopped = "spent past the ceiling"; check(what + ": the run stayed within its ceiling", false, total + " > " + opts.maxCredits); }
  return moved;
}

/** A paid request that throws still leaves an entry: its charge unknown, the run stopped. */
async function paidCall(ctx, what, before, estimate, send) {
  try { return { r: await send() }; } catch (e) {
    const { results, check, balance } = ctx;
    let after = null;
    try { after = await balance(); } catch { after = null; }
    results.spends.push({ what, before, after, reported: null, spent: null, estimate: estimate.low + "–" + estimate.high + " (an estimate, not a limit)", why: "the request failed: " + String((e && e.message) || e).slice(0, 200) + "; the charge is unknown" });
    check(what + ": the request completed", false, String((e && e.message) || e).slice(0, 200));
    results.stopped = "charge unknown";
    return { r: null };
  }
}

/** The stored pages' words, read once, free: the evidence the cases are judged against. */
async function readEvidence(ctx) {
  const { call, opts } = ctx;
  const src = await call("GET", "/api/site/source?slug=" + encodeURIComponent(opts.slug));
  const readable = src.status === 200 && src.body && src.body.ok === true && src.body.reads && src.body.reads.pages === true && Array.isArray(src.body.pages);
  return { pages: readable ? pageEvidence(src.body.pages, extractText) : null, homePath: "/", status: src.status };
}

async function converseChecks(ctx) {
  const { opts, call, check, verdict, results } = ctx;
  const ev = await readEvidence(ctx);
  results.evidence = { pages: ev.pages ? ev.pages.map((p) => ({ path: p.path, words: p.text.length })) : null, read: ev.status };
  for (const c of CONVERSE_CASES) {
    if (results.stopped) break;
    const { history, cutProven } = caseHistory(c);
    if (c.thread === "cut" && !check(c.id + ": the third version is past the page's cut before anything is sent", cutProven, "")) continue;
    // A FIXTURE THAT CANNOT SERVE ITS CASE IS NOT SENT: no spend on a case that
    // could not show what it is for.
    if (c.needs === "pages" && !(ev.pages && ev.pages.some((p) => p.text.trim()))) { check(c.id + ": the stored pages read, so the answer can be judged against them", false, "source " + ev.status); continue; }
    if (c.needs === "absent-hours") {
      const a = hoursAbsent(ev.pages);
      if (!check(c.id + ": the site really lacks Sunday opening times", a.ok, a.why)) continue;
    }
    const est = c.route === "work" ? ESTIMATES.followUp : ESTIMATES.message;
    const before = await beforeSend(ctx, c.id, est);
    if (before === null) break;
    const { r } = await paidCall(ctx, c.id, before, est, () => call("POST", "/api/site/route", { json: { message: c.message, slug: opts.slug, picker: opts.picker || "grok", hasSite: true, firstBuild: false, picked: false, history, files: [], brief: c.message, qa: [], answering: false } }));
    if (!r) break;
    const b = r.body || {};
    await afterSend(ctx, c.id, before, est, b.cost);
    const hidden = c.thread === "cut" ? cutThread()[1].t.slice(cutThread()[1].t.indexOf("Version three")) : "";
    const judged = judgeCase(c, r.status === 200 ? b : { ...b, intent: "http " + r.status }, { pages: ev.pages, homePath: ev.homePath, history: history || [], hidden, thread: typeof c.thread === "string" && FOLLOW_UP_THREADS[c.thread] ? FOLLOW_UP_THREADS[c.thread] : [] });
    for (const j of judged.checks) verdict(j.name, j.verdict, j.detail);
    // THE WHOLE ANSWER IS KEPT, always — and what a person must still judge,
    // with the source evidence to judge it against, beside it.
    results.recorded.push({ case: c.id, expect: c.expect, status: r.status, intent: b.intent, replyFrom: b.replyFrom, cost: b.cost, answer: typeof b.answer === "string" ? b.answer : null, reasons: b.decision && b.decision.reasons });
    if (judged.review) results.unverified.push(judged.review);
  }
}

// ── A NEW BUILD WITH DRAFTS (paid) ──────────────────────────────────────────

async function buildChecks(ctx) {
  const { opts, call, check, verdict, results, log } = ctx;
  const dir = opts.fixtures;
  // THE LEDGER IS A PREREQUISITE, NOT A HOPE (2026-10-15, after Codex's
  // review of `60c26eff`): Codex gave `ledger.last` an answer of `{ ok:false }`
  // and the harness still sent one paid react-build, because the starting
  // reading was taken and never required. Now, before anything is made — not
  // even the drafts — the ledger readers must exist and give a steady reading
  // (the balance read between two equal last-row ids). Missing, unreadable or
  // unsteady: the Build is not started, and nothing is created or spent.
  const ledger = opts.ledger || null;
  const steady = async () => (ledger && typeof ledger.last === "function" && typeof ledger.window === "function" ? stableReading({ ledgerLast: ledger.last, balance: ctx.balance }) : { ok: false, why: "no ledger reader was given" });
  const pre = await steady().catch((e) => ({ ok: false, why: String((e && e.message) || e) }));
  if (!check("P9 the ledger reads steadily before anything is made or spent", pre.ok, pre.ok ? "last row " + pre.id + ", balance " + pre.balance : pre.why || "the balance and the ledger's last row did not read together, steadily")) {
    results.stopped = "ledger prerequisite";
    return;
  }
  const drafts = [];
  for (const f of ["clip.webm", "tone.mp3"]) {
    const u = await uploadVia(call, "/api/media/drafts", new Uint8Array(readFileSync(path.join(dir, f))), f);
    if (check("the draft " + f + " is kept before the site exists", u.done && u.done.status === 201 && !u.done.body.url, u.done && u.done.status)) drafts.push({ file: f, name: u.done.body.name, session: u.session });
  }
  if (drafts.length !== 2) return;
  const before = await beforeSend(ctx, "P9 build", ESTIMATES.build);
  if (before === null) return;
  // THE BUILD'S CHARGE IS RECONCILED AS THE BUILD CANARY'S IS: a steady
  // balance and last ledger row at both ends, the window between them read
  // whole, and the whole movement explained (`buildMoneyVerdict`). The start
  // is read again here, immediately before the send, and must be steady too;
  // if it is not, the drafts made for it are deleted and nothing is sent.
  const startReading = await steady().catch(() => ({ ok: false }));
  if (!check("P9 the ledger reads steadily immediately before the send", startReading.ok, startReading.ok ? "last row " + startReading.id : "not steady")) {
    results.stopped = "ledger prerequisite";
    for (const d of drafts) await call("DELETE", "/api/media/drafts/file/" + d.name).catch(() => {});
    return;
  }
  const chat = "media-verify-" + Date.now().toString(36);
  const brief = "A small bakery in Leeds called Harbour Loaf. Put the attached video on the home page and the jingle on an About page.";
  const sleep = opts.sleep || ((ms) => new Promise((ok) => setTimeout(ok, ms)));
  const sent = await paidCall(ctx, "P9 build", before, ESTIMATES.build, async () => {
    let first = await call("POST", "/api/site/react-build", { json: { brief, images: [], picker: opts.picker || "grok", qa: [], chat, accept: "early", media: drafts.map((d) => d.name) } });
    let r = first;
    // AN EARLY-ACCEPTED BUILD (the combined candidate's route) is followed by its poll.
    if (first.status === 202 && first.body && typeof first.body.poll === "string") {
      const until = Date.now() + 20 * 60 * 1000;
      let last = first;
      while (Date.now() < until) {
        await sleep(10000);
        last = await call("GET", first.body.poll);
        if (last.status !== 202 && !(last.body && last.body.pending)) break;
      }
      if (last.status === 202 || (last.body && last.body.pending)) throw new Error("the build was still running when the poll gave up");
      r = last;
    }
    return { first, r };
  });
  if (!sent.r) return;
  const { first, r } = sent.r;
  const job = (first.body && first.body.job) || (r.body && r.body.job) || "";
  const endReading = await steady();
  const rows = startReading.ok && endReading.ok ? await ledger.window(startReading.id, endReading.id) : { ok: false };
  const money = buildMoneyVerdict({ start: startReading, end: endReading, rows, job, max: opts.maxCredits });
  results.money = money;
  // THE RECONCILED CHARGE, OR AN UNKNOWN ONE: the balance's own reading is
  // recorded too, but a build's spend counts only once the ledger explains it.
  let after = null;
  try { after = await ctx.balance(); } catch { after = null; }
  const entry = { what: "P9 build", before, after, reported: null, spent: money.ok ? money.net : null, estimate: ESTIMATES.build.low + "–" + ESTIMATES.build.high + " (an estimate, not a limit)" };
  if (!money.ok) { entry.why = "the charge is unknown: " + money.why; results.stopped = "charge unknown"; }
  results.spends.push(entry);
  check("P9 the build's charge is explained by the ledger, taken once", money.ok, money.ok ? "net " + money.net + ", other rows " + money.other : money.why);
  if (after !== null && results.balanceAtStart - after > opts.maxCredits) { results.stopped = "spent past the ceiling"; check("P9 the run stayed within its ceiling", false, (results.balanceAtStart - after) + " > " + opts.maxCredits); }
  const b = r.body || {};
  results.recorded.push({ build: b.slug, job, notes: b.notes, contextNote: b.contextNote, media: b.media, images: b.images, spent: entry.spent });
  // THE NARRATION IS THE MODEL'S OWN, AND ITS MEANING IS FOR A PERSON TO READ:
  // whether it says rightly where each file plays is kept unverified, whole.
  if (typeof b.notes === "string" && b.notes.trim()) {
    verdict("P9 the reply says where each file plays (read it)", "unverified", "kept whole in results.unverified");
    results.unverified.push({ case: "P9", expect: "the model's own words say where the video and the jingle play", open: ["where each file plays"], answer: b.notes });
  }
  check("P9 the build answered", r.status === 200 && !!b.slug, r.status);
  check("P9 both drafts moved into the new site's library", b.media && Array.isArray(b.media.placed) && b.media.placed.length === 2 && !(b.media.missing || []).length, JSON.stringify(b.media));
  check("P9 no fixed narration of the move", !/is in your site's file library now|were given (its|their) address/.test(String(b.contextNote || "")), String(b.contextNote || ""));
  check("P9 the reply is the model's own (notes present)", typeof b.notes === "string" && b.notes.trim().length > 0, String(b.notes || "").slice(0, 200));
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
  // THE LEDGER, FOR THE BUILD'S CHARGE: the account's own credit events read
  // with the service key, the id, kind, reason, amount, reference and time
  // only (the build canary's readers, `scripts/build-check.mjs`).
  const svc = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: "Bearer " + env.SUPABASE_SERVICE_KEY };
  const SB = env.SUPABASE_URL;
  const uid = user && user.id;
  const ledger = uid && SB ? {
    last: async () => {
      try {
        const r = await fetch(SB + "/rest/v1/credit_events?uid=eq." + uid + "&select=id&order=id.desc&limit=1", { headers: svc });
        const rows = await r.json().catch(() => null);
        return r.status === 200 && Array.isArray(rows) ? { ok: true, id: rows[0] ? Number(rows[0].id) : 0 } : { ok: false };
      } catch { return { ok: false }; }
    },
    window: async (from, to) => {
      try {
        const r = await fetch(SB + "/rest/v1/credit_events?uid=eq." + uid + "&id=gt." + Number(from) + "&id=lte." + Number(to) + "&select=id,kind,reason,delta,ref,at&order=id.asc", { headers: { ...svc, Prefer: "count=exact" } });
        const rows = await r.json().catch(() => null);
        const { windowComplete } = await import("./canary-build.mjs");
        return { ok: r.status === 200 && Array.isArray(rows), complete: windowComplete({ status: r.status, rows, range: String(r.headers.get("content-range") || "") }), rows: Array.isArray(rows) ? rows : null };
      } catch { return { ok: false, complete: false, rows: null }; }
    },
  } : null;
  // THE RESULTS FILE IS WRITTEN WHATEVER HAPPENS: `run` keeps its evidence on
  // an exception, and anything thrown outside it is written too.
  let r = { ok: false, results: { mode: env.MODE, slug: env.SITE, checks: [], spends: [], recorded: [], unverified: [] } };
  try {
    r = await run({
      fetch, base: env.APP_ORIGIN || "https://gofarther.dev", token, mode: env.MODE || "rehearsal", slug: env.SITE || "",
      mutate: env.MUTATE, spend: env.SPEND, maxCredits: env.MAX_CREDITS ? Number(env.MAX_CREDITS) : undefined,
      fixtures: path.resolve("test/fixtures/media"), browsers, composer, ledger, requiredEngines: ["chromium", "chrome", "firefox", "webkit"], repeat: Number(env.REPEAT) || 3, picker: env.PICKER || "grok",
      log: console.log,
    });
  } catch (e) {
    r.error = r.results.error = String((e && e.stack) || e).slice(0, 1200);
  } finally {
    writeFileSync(out, JSON.stringify(r, null, 2));
  }
  const sp = r.results && r.results.spending;
  if (sp) console.log("SPENT   known " + sp.known + ", unknown " + sp.unknown + " send(s), ledger moved " + sp.ledger + "; ceiling " + sp.ceiling + " (estimates are not limits)");
  if (r.results && r.results.unverified && r.results.unverified.length) console.log("REVIEW  " + r.results.unverified.length + " answer(s) kept whole for a person to read: " + r.results.unverified.map((u) => u.case).join(", "));
  console.log(r.refused ? "RESULT  refused: " + r.refused : "RESULT  " + ((r.results && r.results.outcome) || "failed"));
  // 0 passed · 3 passed what the automation can establish, the rest awaits a
  // person · 1 failed · 2 refused before anything was done.
  process.exit(r.refused ? 2 : !r.ok ? 1 : r.review ? 3 : 0);
}
