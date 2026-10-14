// THE BUILDER TALKING WHILE IT WORKS, JUDGED ON A LIVE PRESS (2026-10-14).
//
// The owner, preparing the combined release: *"Prepare verification of
// PROGRESS_TALK itself: model-written first-person updates during work,
// correct task attribution and ordering, persistence after reconnect,
// explanations and final replies grounded in each task's evidence, and
// separately measured narration cost. Keep the feature off now … don't
// assume its live state from an unset-secret fallback."*
//
// What a press that asks (`expect.talk`) is judged on, all from evidence it
// already records:
// - THE SWITCH, READ LIVE: `/api/site/runtime` reports `progressTalk` and
//   `jobProgressTalk` (worker.js). A press that needs it on sends nothing
//   unless both read true; the restore is the same read reading false.
//   Missing is cannot-tell, never "off" and never "on".
// - THE LINES: every progress line the request's views carried
//   (`parts[].progress`: `{ job, n, ms, text, explain? }`), merged as first
//   seen (`mergeSeen`) so a line that later changes or vanishes is caught.
// - THE EVIDENCE: each job's own final answer, as the page's poll got it
//   (`checks`, `builder/check-evidence.mjs`, and the model's reply).
// Narration cost is not judged here: `scripts/narration-usage.mjs` reads it
// back from the Worker's log after the press, in its own step.
import { readChecks, browserClean } from "../builder/check-evidence.mjs";
import { jobAnswers, modelTextOf } from "./canary-replies.mjs";

const arr = (v) => (Array.isArray(v) ? v : []);
const str = (v) => (typeof v === "string" ? v : "");

/**
 * THE SWITCH, AS THE LIVE WORKER AND A CONTAINER JOB READ IT. `want` is what
 * the press needs (true inside an approved test window, false for the
 * restore). `{ ok, unverified?, why, read }`.
 */
export function talkSwitchVerdict(rt, want) {
  const j = rt && rt.status === 200 && rt.json && typeof rt.json === "object" ? rt.json : null;
  if (!j) return { ok: false, unverified: true, why: `the runtime route could not be read (${rt ? rt.status || "no answer" : "not read"}), so whether PROGRESS_TALK is on is not known`, read: null };
  const keys = ["progressReplies", "progressTalk", "jobProgressReplies", "jobProgressTalk"];
  const missing = keys.filter((k) => typeof j[k] !== "boolean");
  const read = Object.fromEntries(keys.map((k) => [k, typeof j[k] === "boolean" ? j[k] : null]));
  if (missing.length) return { ok: false, unverified: true, why: `the runtime route does not report ${missing.join(", ")}, so whether PROGRESS_TALK is on is not known (an unset secret's fallback is never taken as a reading)`, read };
  if (want === true) {
    const off = keys.filter((k) => j[k] !== true);
    return off.length ? { ok: false, why: `PROGRESS_TALK is not on for this test: ${off.map((k) => `${k} ${j[k]}`).join(", ")}`, read } : { ok: true, why: "", read };
  }
  const on = ["progressTalk", "jobProgressTalk"].filter((k) => j[k] !== false);
  return on.length ? { ok: false, why: `PROGRESS_TALK is still on: ${on.map((k) => `${k} ${j[k]}`).join(", ")}`, read } : { ok: true, why: "", read };
}

/**
 * EVERY LINE A REQUEST'S VIEW CARRIED, AS FIRST SEEN, by `job` and `n`. A
 * later view whose copy of a line differs (its words or its explanation) is
 * kept as `changed`. Pure: returns a new record.
 */
export function mergeSeen(seen, view, at = 0) {
  const out = { lines: { ...((seen && seen.lines) || {}) }, changed: [...arr(seen && seen.changed)], reads: ((seen && seen.reads) || 0) + 1 };
  for (const p of arr(view && view.parts)) {
    for (const l of arr(p && p.progress)) {
      if (!l || typeof l.job !== "string" || !Number.isInteger(l.n)) continue;
      const key = `${l.job}#${l.n}`;
      const now = { part: p.n, job: l.job, n: l.n, ms: Number.isFinite(l.ms) ? l.ms : null, text: str(l.text), explain: str(l.explain), at };
      const was = out.lines[key];
      if (!was) out.lines[key] = now;
      else if (was.text !== now.text || was.explain !== now.explain || was.part !== now.part) out.changed.push({ key, was: { part: was.part, text: was.text, explain: was.explain }, now: { part: now.part, text: now.text, explain: now.explain } });
    }
  }
  return out;
}

/** First person: the builder speaks as "I" (or "we"), never about itself in the third person. */
export function firstPerson(text) {
  const t = str(text);
  return /(^|[^A-Za-z'])(I|I'm|I've|I'll|I'd)(?![A-Za-z])/.test(t) || /\b(my|we|we're|we've|we'll|our)\b/i.test(t);
}

// ── WHAT A SENTENCE CLAIMS, AND HOW (2026-10-14, after the owner reproduced
// three false rejections: "I haven't published this yet", "The browser check
// could not run" and "I'll run the browser check next" were each read as a
// claim of the thing done, because a topic word was taken as a claim). A
// mention is now read in its own clause and given a MODE from that clause's
// grammar — never from a list of accepted sentences:
// - "affirmed": said as done or true now ("I've put it live", "a browser
//   opened the page and nothing was flagged");
// - "negated": said as not done or not possible ("hasn't gone live", "could
//   not run", "without a browser check");
// - "intended": said as still to come ("I'll publish", "the browser check is
//   next", "going to run");
// - "hedged": said as uncertain or conditional ("should be live", "if the
//   check runs", "I think it's live").
// Only an affirmed claim is a claim of completion, and only that is held to
// the job's checks. A sentence with a true limitation and a false success
// ("not live yet, but the browser check found no problems") is two clauses,
// and the second is held on its own. The markers are the language's own
// negators, future auxiliaries and hedges, so any wording that uses them is
// read the same way; a phrasing outside them reads as affirmed, the strict
// side.

const TOPICS = Object.freeze({
  published: /\b(?:publish(?:ed|es|ing)?|(?:is|are|was|went|gone|go|goes|going|now|be|been|being|put it|put them|it's|its|they're) live|live now|live on the site)\b/,
  browser: /\b(?:browser|automated check|opened (?:the |each |every |all the )?(?:finished )?pages?)\b/,
  clean: /\b(?:no (?:problems?|issues?|errors?)|nothing (?:was |is |got )?(?:wrong|flagged|found|broken)|flagged nothing|found nothing|all clear|looks? (?:fine|good|clean|right))\b/,
});
// "nothing was flagged" is affirmative though it holds "nothing": a clean
// phrase is taken out of a clause before its grammar is read, for every topic.
const CLEAN_ALL = new RegExp(TOPICS.clean.source, "g");
const NEGATED = /n't\b|\b(?:not|never|no|none|without|unable|cannot|failed|fails|yet to)\b/;
const INTENDED = /\b(?:will|'ll|shall|going to|gonna|about to|plans? to|planning to|intend(?:s|ing)? to|next|soon|still to)\b/;
const HEDGED = /\b(?:may|might|maybe|perhaps|probably|possibly|likely|should|could|seems?|appears?|hopefully|if|whether|i think|i believe|i expect|i hope)\b/;
// A clause that opens with its own subject reads its own grammar; one that
// does not ("…and run the browser check") carries on the clause before it.
const OWN_SUBJECT = /^(?:i|we|it|its|it's|they|the|this|that|these|those|nothing|everything|all|a|an|my|our|there|each|every|one|page|pages|your)\b/;

const norm = (text) => str(text).toLowerCase().replace(/[‘’ʼ]/g, "'").replace(/\s+/g, " ");

function modeOf(clause) {
  const bare = clause.replace(CLEAN_ALL, " ");
  if (NEGATED.test(bare)) return "negated";
  if (INTENDED.test(bare)) return "intended";
  if (HEDGED.test(bare)) return "hedged";
  return "affirmed";
}

/**
 * EVERY MENTION OF A CHECK IN A TEXT, with the mode its clause says it in:
 * `[{ topic, mode, clause }]`, in order. Pure.
 */
export function claimsIn(text) {
  const out = [];
  for (const sentence of norm(text).split(/[.!?;\n]+/)) {
    // Each clause with the word that joined it. A clause with no subject of
    // its own ("…and run the check") continues the clause before it. After a
    // colon or "then", a clause also continues an INTENDED or HEDGED framing
    // ("next up: publishing, then the check") whatever it opens with; a
    // negation never carries across onto a clause with its own subject ("it
    // isn't perfect yet: it's live" claims it is live).
    const parts = sentence.split(/(\s*:\s*|\s*,?\s+(?:but|although|though|however|whereas|while|and|so|then)\s+|\s*,\s+)/);
    let carried = null;
    for (let i = 0; i < parts.length; i += 2) {
      const clause = parts[i].trim();
      const join = i ? parts[i - 1].trim().replace(/^,\s*/, "") : "";
      if (!clause) continue;
      const own = modeOf(clause);
      const framed = (join === ":" || join === "then") && (carried === "intended" || carried === "hedged");
      const continues = framed || !OWN_SUBJECT.test(clause);
      const mode = own === "affirmed" && carried && carried !== "affirmed" && continues ? carried : own;
      carried = mode;
      for (const [topic, re] of Object.entries(TOPICS)) if (re.test(clause)) out.push({ topic, mode, clause });
    }
  }
  return out;
}

/**
 * WHAT A TEXT CLAIMS AS DONE about the checks, so it can be held to them:
 * that the change is live, that a browser looked at it, that nothing was
 * found. Only affirmed mentions count (`claimsIn`).
 */
export function claimsOf(text) {
  const done = claimsIn(text).filter((c) => c.mode === "affirmed");
  return { published: done.some((c) => c.topic === "published"), browser: done.some((c) => c.topic === "browser"), clean: done.some((c) => c.topic === "clean") };
}

/**
 * HOLD A TEXT'S COMPLETION CLAIMS TO ITS OWN JOB'S CHECKS. `{ bad, timing }`:
 * `bad` the claims the checks contradict; `timing`, for a text said WHILE THE
 * WORK RAN (`during`), the claims the final checks do hold. The final checks
 * say what was true at the end, not when it became true, and nothing the
 * press records dates a publish or a browser check against a progress line,
 * so such a claim is reported as unverified in time, never as passed.
 */
export function groundingOf(text, checks, { during = false } = {}) {
  const c = claimsOf(text);
  const bad = [], timing = [];
  if (!c.published && !c.browser && !c.clean) return { bad, timing };
  const k = readChecks(checks);
  if (!k) return { bad: ["it claims a check as done, and the job's answer carries no readable checks"], timing };
  if (c.published) (k.published === true ? timing : bad).push(k.published === true ? "published" : "it says the change is live, and the job's checks say it was not published");
  if (c.browser) (k.browser.ran === true ? timing : bad).push(k.browser.ran === true ? "the browser check" : "it says a browser check ran, and the job's checks say none ran");
  if (c.clean) (browserClean(k.browser) ? timing : bad).push(browserClean(k.browser) ? "a clean result" : "it says nothing was found, and the job's browser check is not clean");
  return { bad, timing: during ? timing : [] };
}

/** The first completion claim the job's own checks do not hold, or "" when every one is held. */
export function ungrounded(text, checks, opts) {
  return groundingOf(text, checks, opts).bad[0] || "";
}

/**
 * THE TALK PRESS'S OWN CHECKS, for a press that asks (`expect.talk`): the
 * switch read on before the send, and every line and reply the request's
 * views and its jobs' answers carried. `{ steps, talkSwitch }`, where a step
 * carries `request` (`final`, `seen`) and `network`. Each check fails the
 * press; a reason names what was found.
 */
export function talkChecks(o = {}) {
  return talkVerdict(o).checks;
}

/** `talkChecks` with what it could not establish: `{ checks, unverified }`. */
export function talkVerdict({ steps, talkSwitch } = {}) {
  const out = [];
  const unverified = [];
  const add = (name, ok, why) => out.push({ name, ok: !!ok, why: ok ? "" : String(why || "not established") });
  add("PROGRESS_TALK read on before the message was sent, as the Worker and a container job see it", !!(talkSwitch && talkSwitch.ok === true),
    talkSwitch ? talkSwitch.why : "the switch was not read");
  const sent = arr(steps).filter((s) => s && s.sent === true && s.request && s.request.final);
  if (!sent.length) { add("a message was sent and its request read", false, "no request was read"); return { checks: out, unverified }; }
  for (const s of sent) {
    const view = s.request.final;
    const seen = s.request.seen || { lines: {}, changed: [] };
    const parts = arr(view.parts);
    const finalLines = new Map();
    const owner = new Map();
    for (const p of parts) {
      const own = new Set([...arr(p.ids), ...arr(p.jobs).map((j) => (j && typeof j === "object" ? j.id : j))].filter((x) => typeof x === "string"));
      for (const l of arr(p.progress)) {
        if (!l || typeof l.job !== "string" || !Number.isInteger(l.n)) continue;
        finalLines.set(`${l.job}#${l.n}`, { part: p.n, ...l });
        if (!owner.has(l.job)) owner.set(l.job, new Set());
        owner.get(l.job).add(p.n);
        if (own.size && !own.has(l.job)) owner.get(l.job).add(`foreign:${p.n}`);
      }
    }
    const lines = [...finalLines.values()];
    const tag = `message ${s.n || "?"}`;
    // DURING THE WORK, IN THE FIRST PERSON: every part has at least one line,
    // and every line speaks as the builder.
    const quiet = parts.filter((p) => !arr(p.progress).length).map((p) => p.n);
    add(`${tag}: every part has model-written progress lines`, parts.length > 0 && !quiet.length, quiet.length ? `no lines on part ${quiet.join(", ")}` : "no parts");
    const third = lines.filter((l) => !firstPerson(l.text));
    add(`${tag}: every progress line speaks in the first person`, lines.length > 0 && !third.length, third.length ? third.slice(0, 3).map((l) => JSON.stringify(l.text)).join("; ") : "no lines");
    // ATTRIBUTION: a job's lines on one part only, and only on the part that filed it.
    const crossed = [...owner.entries()].filter(([, ns]) => ns.size > 1 || [...ns].some((x) => String(x).startsWith("foreign:")));
    add(`${tag}: each job's lines sit on its own part only`, lines.length > 0 && !crossed.length, crossed.map(([j, ns]) => `job ${j.slice(0, 8)} on ${[...ns].join(", ")}`).join("; "));
    // ORDERING: within each job, numbered in order and never earlier in time.
    const byJob = new Map();
    for (const l of lines) { if (!byJob.has(l.job)) byJob.set(l.job, []); byJob.get(l.job).push(l); }
    const disorder = [];
    for (const [job, ls] of byJob) {
      for (let i = 1; i < ls.length; i++) {
        if (!(ls[i].n > ls[i - 1].n)) disorder.push(`job ${job.slice(0, 8)} line ${ls[i].n} after ${ls[i - 1].n}`);
        else if (Number.isFinite(ls[i].ms) && Number.isFinite(ls[i - 1].ms) && ls[i].ms < ls[i - 1].ms) disorder.push(`job ${job.slice(0, 8)} line ${ls[i].n} earlier than line ${ls[i - 1].n}`);
      }
    }
    add(`${tag}: each job's lines are in order, numbered and timed`, lines.length > 0 && !disorder.length, disorder.slice(0, 3).join("; "));
    // PERSISTENCE: every line ever shown is still there, word for word, at the end.
    const lost = [], altered = [];
    for (const [key, l] of Object.entries(seen.lines || {})) {
      const f = finalLines.get(key);
      if (!f) lost.push(key);
      else if (str(f.text) !== l.text || str(f.explain) !== l.explain) altered.push(key);
    }
    add(`${tag}: every line and explanation shown during the work is kept, unchanged, after the reconnect`, Object.keys(seen.lines || {}).length > 0 && !lost.length && !altered.length && !arr(seen.changed).length,
      !Object.keys(seen.lines || {}).length ? "no line was seen during the work" : [lost.length ? `gone: ${lost.slice(0, 3).join(", ")}` : "", altered.length ? `altered: ${altered.slice(0, 3).join(", ")}` : "", arr(seen.changed).length ? `${seen.changed.length} line(s) changed between reads` : ""].filter(Boolean).join("; "));
    // GROUNDED: every progress line and explanation, said WHILE THE WORK RAN,
    // claims nothing its own job's checks contradict; a completion claim the
    // final checks do hold is unverified in time (`groundingOf`). Another
    // job's evidence never counts.
    const answers = jobAnswers(s.network);
    const bad = [];
    for (const l of lines) {
      const a = answers.get(l.job);
      const said = [l.text, l.explain].filter(Boolean).join("\n");
      const g = groundingOf(said, a && a.res ? a.res.checks : null, { during: true });
      for (const why of g.bad) bad.push(`job ${l.job.slice(0, 8)} line ${l.n}: ${why}`);
      if (g.timing.length) unverified.push(`${tag}: job ${l.job.slice(0, 8)} line ${l.n} said ${g.timing.join(", ")} as done while the work ran; the job's final checks hold it, but nothing recorded dates it against the line, so whether it was true when said is unverified`);
    }
    add(`${tag}: every progress line and explanation claims nothing its own job's checks contradict`, !bad.length, bad.slice(0, 3).join("; "));
    const replies = [];
    for (const [job] of byJob) {
      const a = answers.get(job);
      const text = a && a.res ? modelTextOf(a.res) : "";
      if (!text) { replies.push(`job ${job.slice(0, 8)}: no model-written final reply was read`); continue; }
      const why = ungrounded(text, a.res.checks);
      if (why) replies.push(`job ${job.slice(0, 8)}: ${why}`);
    }
    add(`${tag}: every job's final reply is model-written and claims only what its own checks hold`, byJob.size > 0 && !replies.length, replies.slice(0, 3).join("; ") || "no job had lines");
  }
  return { checks: out, unverified };
}
