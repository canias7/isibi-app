// THE FIRST-BUILD CHECK (2026-10-10, prepared, not pressed).
//
// The owner, after Codex closed the dispatch-order correction on run 119:
// *"Prepare executable scenarios that verify … Build stays within one page and
// fifteen components, independent Build work overlaps by recorded evidence,
// progress remains model-written, accepted work survives browser closure, and
// purchases and charges occur once. Keep dependencies and publishing correctly
// ordered."*
//
// ONE FRESH BUILD as the owner's account, judged on what it really did, from
// the records the product already keeps — nothing here needs a product change
// or a deploy:
//
// - THE SHAPE, off the stored source (`GET /api/site/source`): one page file,
//   and at most fifteen components drawn — every kit module the page imports
//   apart from the site's chrome, and every component written for the site.
// - THE OVERLAP, off the build's own trace (`site_builds.steps`), by recorded
//   time and recorded order, never a status sampled while it ran:
//   * the page bands written at once — `bands` carries each band's own call
//     time summed (`agentMs`) and the wave's wall time (`waveMs`); a sum
//     longer than the wall it fits inside means two calls ran together;
//   * the design's agents at once — the same pair on the `design` step;
//   * the photographs bought beside the pages — `photos-alongside` before
//     `gen`, and `photos-wait` with one still open after the pages came back,
//     so a purchase ran across the whole of the page writing.
//   None of these may be shown on a given build (a single-call design, no
//   band split, photographs that finished while the pages were written leave
//   no end the press can read); the check then fails and says which records
//   it saw, rather than passing on a guess.
// - THE ORDER, off the same trace: the design before the database, the
//   database before the pages, the pages and the photographs joined before
//   the compile, the compile before the publish.
// - THE PROGRESS, off the build's own poll (`GET /api/site/build/<job>`):
//   lines served while it still ran, each the model's own (the route serves
//   only confirmed lines), never the fixed sentence of a step's fact, and
//   none lost between reads.
// - THE CLOSURE: the session that sent the build lets go the moment it is
//   accepted (202, a job); a session signed in afresh follows it to its end.
//   This is the API path: the browser has no way back to a build in flight
//   once it is closed (recorded as a product gap, not tested here).
// - THE PHOTOGRAPHS, off the stored source, the served page and the owner's
//   upload list: every placed photograph serves an image with words
//   describing it, and every image stored is placed or recorded unused by
//   the trace — a second purchase shows as an image nothing accounts for.
// - THE MONEY, off the ledger: every ref of this build debited once, its net
//   no more than the balance's move, anything else in the window told beside
//   it and never failing it (the account may be in use meanwhile).
import { MAX_PAGES, MAX_COMPONENTS } from "../builder/site-plan.mjs";
import { buildStepFacts } from "../builder/site-progress.mjs";
import { photosOf } from "./canary-additions.mjs";
import { photoPath, servedPhotos } from "./canary-requests.mjs";

/**
 * THE PRESS, by the owner's demo-site rule (the site stays). ABOUT 30-65: a
 * first build has measured 11-45 (runs 21-37, `ashgrove-1` 45 with two
 * photographs); the brief asks for photographs, each about 19 (fal's 0.15
 * dollars at 0.008 a credit), and the photo task holds back room for the
 * pages. The press sends nothing unless the balance covers the budget and is
 * no more than the hard cap.
 */
export const BUILD_CHECK = Object.freeze({
  slug: "copperleaf-tea-room",
  brief: "I run a small tea room in York called Copperleaf, on a cobbled lane near the Minster. We bake everything ourselves every morning: scones, a lemon drizzle, a dark ginger cake and a rotating tart. We serve loose-leaf teas from a copper urn and sell the same teas by the bag to take home. Twenty-two seats, open Wednesday to Sunday, ten till five, and we take bookings for afternoon tea for two to eight people. I want one page that shows people the room and the cakes with proper photographs, tells them when we are open and how to book, and lists our teas and prices.",
  budget: 70,
  cap: 1018,
  pollMs: 6_000,
  followMs: 25 * 60_000,
  laterReadMs: 60_000,
});

const arr = (v) => (Array.isArray(v) ? v : []);
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const check = (out) => (name, ok, why) => out.push({ name, ok: !!ok, why: ok ? "" : String(why || "not established") });

// ── THE SHAPE ────────────────────────────────────────────────────────────────

/** Every kit module a page imports (`@/components/ui/<module>`), sorted, the site's chrome left out. */
export function kitModulesOf(src) {
  const out = new Set();
  for (const m of String(src || "").matchAll(/from\s+["']@\/components\/ui\/([a-z0-9-]+)["']/g)) if (m[1] !== "site-chrome") out.add(m[1]);
  return [...out].sort();
}

/**
 * ONE PAGE, AT MOST FIFTEEN COMPONENTS (`MAX_PAGES`, `MAX_COMPONENTS`), off
 * the stored source. The count is every component the page draws: each kit
 * module it imports apart from the chrome, and each component written for
 * the site — stricter than the plan's own cap, which bounds the names the
 * designer may choose.
 */
export function buildShapeVerdict(source) {
  const out = [];
  const add = check(out);
  const s = source && typeof source === "object" ? source : null;
  const complete = !!(s && s.reads && s.reads.pages === true && s.reads.parts === true);
  add("the stored source was read whole", complete, s ? `reads ${JSON.stringify(s.reads || null)}` : "not read");
  const pages = arr(s && s.pages).filter((p) => p && typeof p.path === "string");
  const parts = arr(s && s.parts).filter((p) => p && typeof (p.path || p.name) === "string");
  add(`the build made exactly ${MAX_PAGES} page`, complete && pages.length === MAX_PAGES, `pages: ${JSON.stringify(pages.map((p) => p.path))}`);
  const kit = [...new Set(pages.flatMap((p) => kitModulesOf(p.source)))].sort();
  const drawn = kit.length + parts.length;
  add(`the page draws at most ${MAX_COMPONENTS} components`, complete && pages.length > 0 && drawn <= MAX_COMPONENTS,
    `${drawn}: kit ${JSON.stringify(kit)}, written for the site ${JSON.stringify(parts.map((p) => p.path || p.name))}`);
  return { checks: out, pages: pages.map((p) => p.path), kit, parts: parts.map((p) => p.path || p.name) };
}

// ── THE TRACE: ORDER AND OVERLAP ─────────────────────────────────────────────

/** The trace's steps, each with its place in the list (`i`). Only well-formed steps are kept. */
export function traceSteps(steps) {
  return arr(steps).map((s, i) => (s && typeof s === "object" && typeof s.s === "string" ? { ...s, i } : null)).filter(Boolean);
}

/**
 * INDEPENDENT BUILD WORK AT ONCE, BY RECORDED EVIDENCE. Passes on the first
 * kind the trace proves, and names it (`by`):
 * - `bands`: a `bands` step with two or more bands written whose summed call
 *   time (`agentMs`) exceeds the wave's wall time (`waveMs`) by at least
 *   `slackMs` — calls that fit inside a shorter wall must have overlapped;
 * - `design`: the same pair on the `design` step, with two or more agents;
 * - `photos`: `photos-alongside` (one or more started) before `gen`, and a
 *   later `photos-wait` with one or more still open after the pages came back
 *   (`fonts` or `img` after `gen`) — a purchase in flight across the whole of
 *   the page writing.
 * Otherwise it fails and says what the trace held.
 */
export function buildOverlapVerdict(steps, { slackMs = 1000 } = {}) {
  const st = traceSteps(steps);
  const seen = [];
  const pair = (s, count) => {
    const a = num(s.agentMs), w = num(s.waveMs), n = num(s[count]);
    return a !== null && w !== null && w > 0 && n !== null && n >= 2 && a - w >= slackMs ? { agentMs: a, waveMs: w, n, savedMs: a - w } : null;
  };
  for (const s of st.filter((x) => x.s === "bands")) {
    const wrote = num(s.wrote);
    const p = pair(s, "bands");
    seen.push(`bands ${JSON.stringify({ bands: s.bands, wrote: s.wrote, agentMs: s.agentMs, waveMs: s.waveMs })}`);
    if (p && wrote !== null && wrote >= 2) return { ok: true, by: "bands", why: "", detail: `${p.n} page bands written at once: their calls took ${p.agentMs} ms in all inside a ${p.waveMs} ms wave`, seen };
  }
  for (const s of st.filter((x) => x.s === "design")) {
    const p = pair(s, "agents");
    seen.push(num(s.agents) !== null ? `design ${JSON.stringify({ agents: s.agents, agentMs: s.agentMs, waveMs: s.waveMs })}` : "design in a single call (no agents)");
    if (p) return { ok: true, by: "design", why: "", detail: `${p.n} design agents at once: their calls took ${p.agentMs} ms in all inside a ${p.waveMs} ms wave`, seen };
  }
  const along = st.find((x) => x.s === "photos-alongside" && num(x.started) >= 1);
  const gen = along ? st.find((x) => x.s === "gen" && x.i > along.i) : null;
  const back = gen ? st.find((x) => (x.s === "fonts" || x.s === "img") && x.i > gen.i) : null;
  const wait = back ? st.find((x) => x.s === "photos-wait" && x.i > back.i && num(x.open) >= 1) : null;
  if (along) seen.push(`photos-alongside started ${along.started}${gen ? ", then gen" : ""}${back ? `, then ${back.s}` : ""}${wait ? `, then photos-wait open ${wait.open}` : ", no photograph still open when the pages came back"}`);
  if (wait) return { ok: true, by: "photos", why: "", detail: `${along.started} photograph purchase(s) began before the pages were written and ${wait.open} was still being bought when they came back`, seen };
  return { ok: false, by: "", detail: "", seen, why: `no recorded overlap: ${seen.length ? seen.join("; ") : "the trace holds no bands, design wave or photo marks"}` };
}

/**
 * THE DEPENDENCIES AND THE PUBLISH IN ORDER, by the trace's own order: the
 * design before the database (`provision`, `schema`, `seed` when present)
 * and before the pages (`gen`); the database before the pages; the pages
 * (`fonts` or `img` after `gen`) and the photographs (`photos-joined`, when
 * any were begun) before the first `compile`; the compile before the publish
 * (`pages` or `og`, the build's last steps). The row must read done and ok.
 */
export function buildOrderVerdict({ steps, done, ok } = {}) {
  const st = traceSteps(steps);
  const first = (name, after = -1) => st.find((x) => x.s === name && x.i > after) || null;
  const bad = [];
  const design = first("design"), gen = first("gen", design ? design.i : -1);
  if (!design) bad.push("no design step");
  if (!gen) bad.push("no page writing (gen) after the design");
  for (const name of ["provision", "schema", "seed"]) {
    const s = first(name);
    if (s && design && s.i < design.i) bad.push(`${name} before the design`);
    if (s && gen && s.i > gen.i) bad.push(`${name} after the pages began`);
  }
  const back = gen ? st.find((x) => (x.s === "fonts" || x.s === "img") && x.i > gen.i) : null;
  const compile = back ? first("compile", back.i) : null;
  if (gen && !back) bad.push("the pages never came back");
  if (back && !compile) bad.push("no compile after the pages");
  const along = first("photos-alongside");
  if (along && compile) {
    const joined = st.find((x) => x.s === "photos-joined" && x.i > along.i);
    if (!joined) bad.push("photographs were begun and never joined");
    else if (joined.i > compile.i) bad.push("the photographs were joined after the compile");
  }
  const publish = compile ? st.find((x) => (x.s === "pages" || x.s === "og") && x.i > compile.i) : null;
  if (compile && !publish) bad.push("no publish after the compile");
  const order = st.map((x) => x.s).join(" > ");
  return {
    checks: [
      { name: "the build's record reads done and ok", ok: done === true && ok === true, why: done === true && ok === true ? "" : `done ${done}, ok ${ok}` },
      { name: "design, database, pages, photographs, compile and publish ran in their dependency order", ok: !bad.length && st.length > 0, why: !st.length ? "the trace was not read" : bad.length ? `${bad.join("; ")} (${order})` : "" },
    ],
    order,
  };
}

// ── THE PROGRESS ─────────────────────────────────────────────────────────────

/** Every fixed sentence a build step's facts can say, for a count of 0-20: a line equal to one is not the model's. */
export function buildFactTexts() {
  const out = new Set();
  const names = ["design", "provision", "schema", "seed", "gen", "photos-alongside", "fired", "photos-wait", "photo-recovered", "photos-joined", "compile"];
  for (const s of names) for (let n = 0; n <= 20; n++) {
    for (const f of buildStepFacts({ s, started: n, open: n, used: n, n, tables: n, db: n })) if (f && typeof f.text === "string") out.add(f.text);
  }
  return out;
}

/**
 * THE MODEL'S OWN LINES, LIVE. `polls` is every read of the build's poll by
 * the fresh session, in order: `{ ms, status, progress }` (`progress` the
 * served lines, `{ n, ms, text }` each). At least one line read while the
 * build still ran (202); every line a non-empty sentence that is no step's
 * fixed fact; no line read once and gone later; each line's number unique.
 */
export function buildProgressVerdict(polls) {
  const out = [];
  const add = check(out);
  const ps = arr(polls);
  const facts = buildFactTexts();
  const live = ps.filter((p) => p && p.status === 202 && arr(p.progress).length > 0);
  add("a progress line was served while the build still ran", live.length > 0, `${ps.length} read(s), none pending with a line`);
  const all = new Map();
  let lost = [], bad = [];
  for (const p of ps) {
    const now = new Map(arr(p && p.progress).filter((l) => l && Number.isInteger(l.n)).map((l) => [l.n, l.text]));
    for (const [n, t] of all) if (now.size && !now.has(n)) lost.push(n);
    for (const [n, t] of now) {
      if (typeof t !== "string" || t.trim().length < 8 || facts.has(t.trim())) bad.push(n);
      if (all.has(n) && all.get(n) !== t) bad.push(n);
      all.set(n, t);
    }
  }
  lost = [...new Set(lost)]; bad = [...new Set(bad)];
  add("every line is the model's own sentence, never a step's fixed fact, and keeps its words", all.size > 0 && !bad.length, all.size ? `lines ${JSON.stringify(bad)} are not` : "no line was served");
  add("no line read once was gone from a later read", all.size > 0 && !lost.length, `gone: ${JSON.stringify(lost)}`);
  return { checks: out, lines: [...all].sort((a, b) => a[0] - b[0]).map(([n, text]) => ({ n, text })) };
}

// ── THE CLOSURE ──────────────────────────────────────────────────────────────

/**
 * ACCEPTED WORK SURVIVES THE SENDER GOING AWAY. `accepted` is the sending
 * session's answer (`{ status, job }`); `senderAfter` the calls that session
 * made after it (none expected); `fresh` the second session (`{ token,
 * uid }`) beside the first (`sender`); `final` the fresh session's last read
 * of the build (`{ status, json }`); `site` the served home page's status.
 */
export function buildClosureVerdict({ accepted, senderAfter, sender, fresh, final, site } = {}) {
  const out = [];
  const add = check(out);
  const job = accepted && typeof accepted.job === "string" ? accepted.job : "";
  add("the build was accepted and handed back a job (202) — the generation runs on the server", !!(accepted && accepted.status === 202 && /^[0-9a-f]{32}$/.test(job)),
    accepted ? `answered ${accepted.status}${job ? ` job ${job}` : ", no job"}` : "not sent");
  add("the session that sent it made no call after the build was accepted", Array.isArray(senderAfter) && senderAfter.length === 0, `${arr(senderAfter).length} call(s): ${JSON.stringify(arr(senderAfter).slice(0, 4))}`);
  add("a session signed in afresh, as the same account, followed the build", !!(fresh && sender && fresh.token && fresh.token !== sender.token && fresh.uid && fresh.uid === sender.uid),
    fresh ? (fresh.token === (sender && sender.token) ? "the fresh session holds the sender's token" : "a different account, or no sign-in") : "no fresh session");
  const fj = final && final.json && typeof final.json === "object" ? final.json : null;
  add("the fresh session read the build's own final answer: ok, naming the site", !!(final && final.status === 200 && fj && fj.ok === true && typeof fj.slug === "string" && fj.slug),
    final ? `answered ${final.status} ${JSON.stringify(fj ? { ok: fj.ok, slug: fj.slug, error: fj.error } : null)}` : "not read to its end");
  add("the site serves its page", site === 200, `answered ${site}`);
  return out;
}

// ── THE PHOTOGRAPHS ──────────────────────────────────────────────────────────

/**
 * BOUGHT ONCE AND PLACED. `pages` the stored page files; `served` the served
 * home page; `bytes` each placed address's `{ status, type, bytes }`;
 * `uploads` the owner's upload list after the build (a fresh site has none
 * before it); `steps` the trace (`photos-joined`'s `unused`). At least
 * `atLeast` photographs placed, each drawn with words describing it and
 * serving an image; every stored image placed, or one of the trace's unused.
 */
export function buildPhotoVerdict({ pages, served, bytes, uploads, steps, slug, atLeast = 1 } = {}) {
  const out = [];
  const add = check(out);
  const stored = [...new Set(arr(pages).flatMap((p) => [...photosOf(p && p.source, slug).keys()].map((u) => photoPath(u, slug)).filter(Boolean)))].sort();
  add(`the page shows at least ${atLeast} of the site's own photograph${atLeast === 1 ? "" : "s"}`, stored.length >= atLeast, `it shows ${JSON.stringify(stored)}`);
  const drawn = servedPhotos(served, slug);
  const unsaid = stored.filter((p) => !drawn.some((d) => d.path === p && d.alt.length >= 3));
  add("the served page draws each with words describing it", stored.length >= atLeast && !unsaid.length, `not drawn with words: ${JSON.stringify(unsaid)}`);
  const b = bytes || {};
  const dead = stored.filter((p) => { const x = b[p]; return !(x && x.status === 200 && /^image\//.test(String(x.type || "")) && Number(x.bytes) > 1000); });
  add("each photograph's address serves an image", stored.length >= atLeast && !dead.length, dead.map((p) => `${p}: ${JSON.stringify(b[p] || "not read")}`).join("; "));
  const st = traceSteps(steps);
  const joined = st.filter((x) => x.s === "photos-joined");
  const unused = joined.length ? num(joined[joined.length - 1].unused) || 0 : 0;
  if (!(uploads && uploads.ok === true && Array.isArray(uploads.files))) add("the site's uploads were read", false, uploads && uploads.why ? uploads.why : "not read");
  else {
    const images = uploads.files.filter((f) => f && f.kind === "image").map((f) => f.name).sort();
    const names = stored.map((p) => p.split("/").pop());
    const missing = names.filter((n) => !images.includes(n));
    const extra = images.filter((n) => !names.includes(n));
    add(`every image stored is placed or recorded unused by the trace (${unused} unused) — none bought twice`, !missing.length && extra.length <= unused,
      `stored ${JSON.stringify(images)}, placed ${JSON.stringify(names)}${missing.length ? `, placed but not stored ${JSON.stringify(missing)}` : ""}`);
  }
  return { checks: out, placed: stored };
}

// ── THE MONEY ────────────────────────────────────────────────────────────────

/**
 * EACH CHARGE ONCE. `rows` are the account's ledger rows between the two
 * balance reads (`{ id, ref, delta }`); the build's own are those under
 * `build:<job>`. Every one of its refs debited at most once; its net taken
 * more than nothing and no more than the balance's move; the rest told.
 */
export function buildMoneyVerdict({ start, end, rows, job } = {}) {
  const bad = (why, extra = {}) => ({ ok: false, why, ...extra });
  if (!(num(start) !== null && num(end) !== null)) return bad("the balance could not be read at both ends");
  if (!(rows && rows.ok === true && Array.isArray(rows.rows))) return bad("the ledger could not be read");
  if (!(typeof job === "string" && /^[0-9a-f]{32}$/.test(job))) return bad("no job to attribute charges to");
  const prefix = `build:${job}`;
  const own = rows.rows.filter((r) => r && typeof r.ref === "string" && (r.ref === prefix || r.ref.startsWith(prefix + ":")));
  const debits = new Map();
  let net = 0;
  for (const r of own) {
    const d = Number(r.delta);
    if (!Number.isFinite(d)) return bad(`a ledger row under ${r.ref} has no amount`);
    net -= d;
    if (d < 0) debits.set(r.ref, (debits.get(r.ref) || 0) + 1);
  }
  const twice = [...debits].filter(([, n]) => n > 1).map(([ref, n]) => `${ref} ×${n}`);
  if (twice.length) return bad(`a charge was taken twice: ${twice.join(", ")}`, { net });
  const spent = start - end;
  if (!(net > 0)) return bad(`the build took ${net}; a first build is charged`, { net, spent });
  if (net > spent) return bad(`the build's own charges, ${net}, are more than the balance's move of ${spent}`, { net, spent });
  const others = rows.rows.filter((r) => !own.includes(r)).map((r) => ({ id: r.id, ref: String(r.ref || ""), delta: Number(r.delta) }));
  return { ok: true, why: "", net, spent, refs: [...debits.keys()].sort(), others };
}

// ── THE PRESS ────────────────────────────────────────────────────────────────

/** The press's refusals before anything is sent: a balance outside its window, a slug already a site, a source read that did not say. */
export function buildPreflight({ balance, budget, cap, existing }) {
  if (num(balance) === null) return "the balance could not be read — nothing is sent";
  if (balance < budget) return `the balance, ${balance}, does not cover this press's budget of ${budget} — nothing is sent`;
  if (balance > cap) return `the balance, ${balance}, is above this press's hard cap of ${cap} — nothing is sent`;
  if (!existing || existing.status === 0) return "whether the slug is already a site could not be read — nothing is sent";
  if (existing.status === 200) return "the slug is already a site, and a build would revise it — nothing is sent";
  return "";
}

/**
 * ONE FIRST BUILD, START TO FINISH, through `io` (every network read and
 * write the press makes, so the whole of it runs offline under a stub):
 * `signIn()` → `{ token, uid }`; `balance(token)`; `existing(token, slug)`
 * (the source route's answer before the build); `ledgerMark()` → the last
 * ledger id; `post(token, body)` → the build's answer; `poll(token, job)`;
 * `trace(slug)` → `{ steps, done, ok }`; `source(token, slug)`;
 * `served(slug)` → `{ status, html }`; `image(slug, path)`;
 * `uploads(token, slug)`; `ledgerSince(id)`; `sleep(ms)`; `now()`; `log`.
 * With `spend` false it stops after the preflight: a free rehearsal.
 */
export async function runBuildCheck(io, { spec = BUILD_CHECK, spend = false } = {}) {
  const log = typeof io.log === "function" ? io.log : () => {};
  const record = { spec: { slug: spec.slug, budget: spec.budget, cap: spec.cap }, sent: false, stopped: "", calls: [] };
  const tagged = (who, token) => ({
    get: async (name, fn) => { record.calls.push({ who, name, at: io.now() }); return fn(token); },
  });
  const sender = await io.signIn();
  record.sender = { uid: sender && sender.uid };
  const A = tagged("sender", sender.token);
  const start = await A.get("balance", (t) => io.balance(t));
  const existing = await A.get("existing", (t) => io.existing(t, spec.slug));
  const refuse = buildPreflight({ balance: start, budget: spec.budget, cap: spec.cap, existing });
  record.balanceStart = start;
  if (refuse) { record.stopped = refuse; log(`STOPPED: ${refuse}`); return record; }
  if (!spend) { record.stopped = "spend is not yes — the preflight passed and nothing is sent"; log(record.stopped); return record; }
  const mark = await io.ledgerMark();
  record.ledgerMark = mark;
  const accepted = await A.get("post", (t) => io.post(t, { brief: spec.brief, slug: spec.slug }));
  record.sent = true;
  const acceptedAt = record.calls.length;
  const job = accepted && accepted.json && typeof accepted.json.job === "string" ? accepted.json.job : "";
  record.accepted = { status: accepted ? accepted.status : 0, job, stage: accepted && accepted.json ? accepted.json.stage : undefined };
  log(`accepted: ${record.accepted.status} job ${job || "(none)"}`);
  // THE SENDER LETS GO HERE. Everything after is the fresh session's.
  const fresh = await io.signIn();
  record.fresh = { uid: fresh && fresh.uid, sameToken: !!(fresh && fresh.token === sender.token) };
  const B = tagged("fresh", fresh.token);
  const polls = [];
  let final = null;
  if (job) {
    const t0 = io.now();
    while (io.now() - t0 < spec.followMs) {
      const r = await B.get("poll", (t) => io.poll(t, job));
      polls.push({ ms: io.now() - t0, status: r ? r.status : 0, progress: r && r.json && Array.isArray(r.json.progress) ? r.json.progress : [] });
      if (r && r.status !== 202) { final = r; break; }
      await io.sleep(spec.pollMs);
    }
  } else if (accepted && accepted.status === 200) final = accepted;
  record.polls = polls;
  record.final = final ? { status: final.status, ok: final.json && final.json.ok, slug: final.json && final.json.slug } : null;
  const tr = (await io.trace(spec.slug)) || {};
  const src = await B.get("source", (t) => io.source(t, spec.slug));
  const site = await io.served(spec.slug);
  const sourceBody = src && src.status === 200 ? src.json : null;
  const pages = arr(sourceBody && sourceBody.pages);
  const placed = [...new Set(pages.flatMap((p) => [...photosOf(p && p.source, spec.slug).keys()].map((u) => photoPath(u, spec.slug)).filter(Boolean)))];
  const bytes = {};
  for (const p of placed) bytes[p] = await io.image(spec.slug, p);
  const up = await B.get("uploads", (t) => io.uploads(t, spec.slug));
  await io.sleep(spec.laterReadMs);
  const end = await B.get("balance", (t) => io.balance(t));
  const rows = await io.ledgerSince(mark);
  const senderAfter = record.calls.slice(acceptedAt).filter((c) => c.who === "sender");
  const checks = [];
  checks.push(...buildClosureVerdict({ accepted: record.accepted, senderAfter, sender, fresh, final, site: site && site.status }));
  checks.push(...buildShapeVerdict(sourceBody).checks);
  const ov = buildOverlapVerdict(tr.steps);
  checks.push({ name: "independent build work ran at once, by the build's recorded times and order", ok: ov.ok, why: ov.ok ? "" : ov.why });
  record.overlap = ov;
  const order = buildOrderVerdict(tr);
  checks.push(...order.checks);
  record.order = order.order;
  const pv = buildProgressVerdict(polls);
  checks.push(...pv.checks);
  record.lines = pv.lines;
  const ph = buildPhotoVerdict({ pages, served: site && site.html, bytes, uploads: up, steps: tr.steps, slug: spec.slug });
  checks.push(...ph.checks);
  const money = buildMoneyVerdict({ start, end, rows, job });
  checks.push({ name: `every charge of this build taken once: net ${money.net ?? "?"} of the balance's move ${money.spent ?? "?"}`, ok: money.ok, why: money.why });
  record.money = money;
  record.balanceEnd = end;
  record.checks = checks;
  record.ok = checks.every((c) => c.ok);
  return record;
}
