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
// - THE API CONTINUATION: the session that sent the build lets go the
//   moment it is accepted (202, a job); a session signed in afresh through the
//   API follows it to its end. It is NOT a browser-closed test: the browser has
//   no way back to a build in flight once it is closed (an open product gap,
//   not tested here).
// - THE PHOTOGRAPHS, off the stored source, the served page and the owner's
//   upload list: every placed photograph serves an image with words
//   describing it, and every image stored is placed or recorded unused by
//   the trace. That establishes STORAGE AND PLACEMENT, never one purchase per
//   photograph: a purchase that failed to store, or that overwrote the same
//   file, leaves no image to count. The purchase records are in R2, which the
//   press cannot read, so purchase-once is reported NOT VERIFIED.
// - THE MONEY, off the complete ledger window between two stable readings
//   (the balance read between two equal last-row ids): the whole balance move
//   must equal what the window's rows record, the build's rows and every
//   other row attributed apart; every ref of the build debited once. An
//   unexplained difference, an unstable reading or a window that cannot be
//   shown whole fails.
import { MAX_PAGES, MAX_COMPONENTS } from "../builder/site-plan.mjs";
import { buildStepFacts } from "../builder/site-progress.mjs";
import { photosOf } from "./canary-additions.mjs";
import { photoPath, servedPhotos } from "./canary-requests.mjs";

/** The live Worker's own word on photographs (`/api/site/runtime`): "" only when it says none are bought. Kept here, not imported from the browser press, so this module loads without a browser. */
export function imageRefusalOf(rt) {
  if (!rt || rt.status !== 200 || !rt.json || typeof rt.json !== "object") return `the runtime route could not be read (${rt ? rt.status || "nothing" : "not read"}), so whether photographs can be bought is not known`;
  if (rt.json.imagePurchases === false) return "";
  if (rt.json.imagePurchases === true) return "the live Worker still buys photographs (IMAGE_PURCHASES is not off)";
  return "the live Worker does not report whether it buys photographs (deployed before the switch)";
}

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

/**
 * THE FIRST BUILD WITH NO PHOTOGRAPH BOUGHT (2026-10-11, the acceptance
 * batch: image-free, under Build's existing flags and limits). The same press
 * on a fresh slug, a brief that asks for no photographs, and two guards on top:
 * nothing is sent unless the live Worker refuses every photograph purchase
 * (`IMAGE_PURCHASES=off`, read off `/api/site/runtime` on a site the account
 * owns), and the build must store no image and place none of its own
 * (`buildNoImageVerdict`). Its overlap must then come from the page bands or
 * the design's agents — never from photographs, which it may not buy.
 * ABOUT 11-45, BY EVERY VALID ROUTE (revised 2026-10-14, after run 152 showed
 * an estimate built on the cheapest route underestimates): first builds
 * measured 11-45 (runs 21-37). This one cannot buy a photograph, but a build
 * may also take its corrective design call (`recoverDesign`), a page repair or
 * a salvage, each a valid route, so the estimate keeps the measured top
 * rather than subtracting the photographs. A build is one charge the server
 * takes in one place; the balance at the press bounds it (`cap`, or the
 * owner's exact-balance opt-in, `BUILD_BALANCE_OPT_IN`).
 */
export const BUILD_CHECK_NO_IMAGES = Object.freeze({
  // BOUND BY THE BALANCE (2026-10-11, corrected on Codex's review of
  // 542a6c34, whose preflight sent from 971 with a budget of 40): the build
  // is one charge the server takes at most the balance for, so the press
  // sends nothing unless the account holds no more than the batch cap
  // (`ACCEPTANCE_CAP` in canary-ui.mjs, 100). And it sends nothing unless an
  // image-free parallel mode is on for this account (`buildFlagsVerdict`).
  slug: "saltmarsh-cheese-counter",
  brief: "I run a cheese counter called Saltmarsh in the covered market in Lewes. We sell about forty British cheeses, cut to order, and a few chutneys and oatcakes to go with them. We're open Tuesday to Saturday, nine till four, and we make up cheese boards for parties if people order two days ahead. I want one page that tells people what we sell, when we're open, and how to order a board. No photographs please, just words, a clear layout and our prices for the boards: small £25, medium £40, large £60.",
  images: "none",
  runtimeSlug: "fold-lane-bakery",
  budget: 45,
  cap: 100,
  pollMs: 6_000,
  followMs: 25 * 60_000,
  laterReadMs: 60_000,
});

/**
 * CAN THIS ACCOUNT'S FIRST BUILD SHOW IMAGE-FREE WORK AT ONCE? (2026-10-11,
 * the owner: *"inspect the actual account flags, preserve the existing flags
 * and Build page/component limits, and require measurable overlap from
 * supported image-free work; do not pay for a run whose required parallel
 * modes are unavailable or enable flags just to manufacture a pass."*) Read
 * off `/api/site/runtime` on a site the account owns, whose answers are
 * booleans about the account: the design's agents at once (`design`, keyed on
 * the account) or as a graph (`graph`), or the page's bands for everyone
 * (`bandsEveryone`). A `bands` that is true only for a named canary cannot be
 * told apart from one naming the site asked about rather than the account, so
 * it does not count. Nothing here changes a flag. `{ ok, modes, why }`.
 */
export function buildFlagsVerdict(rt) {
  if (!rt || rt.status !== 200 || !rt.json || typeof rt.json !== "object") return { ok: false, modes: [], why: `the runtime route could not be read (${rt ? rt.status || "nothing" : "not read"}), so the account's build flags are not known` };
  const raw = rt.json;
  const flags = ["design", "graph", "bandsEveryone", "bands"];
  if (flags.some((k) => typeof raw[k] !== "boolean")) return { ok: false, modes: [], why: "the runtime route does not report every build flag as true or false" };
  // THE BUILD'S OWN ENV DECIDES (2026-10-14, after run 117). With the job
  // runner on, a first build runs in the container and asks its doors of the
  // job's env; the route reports that view as `jobDesign`/`jobGraph`/
  // `jobBands`/`jobBandsEveryone`. Run 117 was judged "on" from the Worker's
  // view while the job read every door shut. A route too old to report the
  // job's view leaves the Worker's view, as before.
  const inJob = (raw.runnerEveryone === true || raw.runner === true) && ["jobDesign", "jobGraph", "jobBands", "jobBandsEveryone"].every((k) => typeof raw[k] === "boolean");
  const j = inJob ? { design: raw.jobDesign, graph: raw.jobGraph, bands: raw.jobBands, bandsEveryone: raw.jobBandsEveryone } : raw;
  const modes = [j.design && "design agents at once", j.graph && "the design as a graph", j.bandsEveryone && "page bands at once (for everyone)"].filter(Boolean);
  const view = inJob ? "as the container job sees it" : "as the Worker sees it";
  if (!modes.length) return { ok: false, modes, view, why: `no image-free parallel mode is on for this account ${view} (design ${j.design}, graph ${j.graph}, bands for everyone ${j.bandsEveryone}${j.bands ? ", bands only through a canary list that may name the site rather than the account" : ""}${inJob && (raw.design || raw.graph) ? `; the Worker's own view reads design ${raw.design}, graph ${raw.graph}, which no first build uses while the runner takes builds` : ""}): a first build here would show no measurable overlap, so nothing is sent — no flag is switched on to make it pass` };
  return { ok: true, modes, view, why: "" };
}

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
export function buildOverlapVerdict(steps, { slackMs = 1000, photos = true } = {}) {
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
  // A BUILD THAT MAY BUY NO PHOTOGRAPH (`photos: false`) is never shown to
  // overlap by one.
  const along = photos ? st.find((x) => x.s === "photos-alongside" && num(x.started) >= 1) : null;
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
  const names = ["design", "provision", "schema", "seed", "gen", "photos-alongside", "fired", "photos-wait", "photo-recovered", "photos-joined", "photos-missing", "compile"];
  for (const s of names) for (let n = 0; n <= 20; n++) {
    for (const f of buildStepFacts({ s, started: n, open: n, used: n, missing: n, n, tables: n, db: n })) if (f && typeof f.text === "string") out.add(f.text);
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
 * THIS SEND'S OWN NAME (2026-10-14, after run 117): a random key made before
 * the send and sent with it as `attempt`. The listing carries it back, so a
 * caller whose answer was lost finds its own build and no other.
 */
export function newAttempt(uuid = () => globalThis.crypto.randomUUID()) {
  return "bc-" + String(uuid()).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 32);
}

/**
 * THE ONE LISTED BUILD THAT IS THIS SEND (2026-10-14). `list` is the
 * account's `GET /api/site/builds` answer; a match is the attempt key, read
 * exactly. None, or more than one, is not a job: the caller is told why and
 * nothing is guessed — never the latest for the slug, never by words or time.
 */
export function attemptMatch(list, attempt) {
  if (typeof attempt !== "string" || !attempt) return { ok: false, attempt: "", job: "", why: "this send carried no attempt key" };
  const builds = list && Array.isArray(list.builds) ? list.builds : null;
  if (!builds) return { ok: false, attempt, job: "", why: "the account's build list could not be read" };
  const mine = builds.filter((b) => b && b.attempt === attempt && typeof b.job === "string" && /^[0-9a-f]{32}$/.test(b.job));
  const jobs = [...new Set(mine.map((b) => b.job))];
  if (jobs.length === 1) return { ok: true, attempt, job: jobs[0], state: String(mine[0].state || ""), why: "" };
  if (jobs.length > 1) return { ok: false, ambiguous: true, attempt, job: "", why: `${jobs.length} listed builds carry this attempt key (${jobs.join(", ")}) — none is taken` };
  return { ok: false, attempt, job: "", why: `no listed build carries this attempt key (${builds.length} listed)` };
}

/**
 * IS THIS TRACE THIS BUILD'S (2026-10-14, after run 117)? The trace row is
 * kept per slug and overwritten by the next build of that slug, so a read by
 * slug alone can be another attempt's. It is taken only when the job's own
 * row (`edit_jobs`, by id) names this slug, was created after this send left,
 * and the trace's start falls inside that job's life.
 */
export function traceAttribution({ trace, jobRow, job, slug, sentAt, skewMs = 120_000 } = {}) {
  const t = (v) => { const n = Date.parse(String(v || "")); return Number.isFinite(n) ? n : null; };
  if (!(typeof job === "string" && /^[0-9a-f]{32}$/.test(job))) return { ok: false, why: "no job to bind the trace to" };
  if (!jobRow || jobRow.id !== job) return { ok: false, why: "the job's own row could not be read" };
  if (jobRow.slug !== slug) return { ok: false, why: `the job's row names ${jobRow.slug || "no site"}, not ${slug}` };
  const created = t(jobRow.created_at), updated = t(jobRow.updated_at);
  if (created === null || updated === null) return { ok: false, why: "the job's row has no times" };
  if (Number.isFinite(sentAt) && created < sentAt - skewMs) return { ok: false, why: "the job was created before this send left — another attempt" };
  if (!trace) return { ok: false, why: "no trace row for the slug" };
  const started = t(trace.started_at);
  if (started === null) return { ok: false, why: "the trace row has no start" };
  if (started < created - skewMs || started > updated + skewMs) return { ok: false, why: "the trace row started outside this job's life — another attempt's" };
  return { ok: true, why: "" };
}

/**
 * ACCEPTED WORK SURVIVES THE SENDER GOING AWAY. `accepted` is the sending
 * session's answer (`{ status, job }`); `senderAfter` the calls that session
 * made after it (none expected); `fresh` the second session (`{ token,
 * uid }`) beside the first (`sender`); `final` the fresh session's last read
 * of the build (`{ status, json }`); `site` the served home page's status.
 */
export function buildClosureVerdict({ accepted, senderAfter, sender, fresh, final, site, reconciled = null } = {}) {
  const out = [];
  const add = check(out);
  const job = accepted && typeof accepted.job === "string" ? accepted.job : "";
  // THE SEND'S OWN ANSWER, OR ITS OWN ATTEMPT (2026-10-14, after run 117). A
  // build outlives the request that sent it (Cloudflare resets it at about
  // 285 s), so the answer can be lost while the build goes on. Then the job
  // counts as known only when the fresh session found EXACTLY ONE listed
  // build carrying this send's own attempt key — never the latest build for
  // the slug, never a resend. The lost answer stays in the record and in this
  // line either way.
  const answered = !!(accepted && accepted.status === 202 && /^[0-9a-f]{32}$/.test(job));
  const found = !answered && !!(reconciled && reconciled.ok === true && /^[0-9a-f]{32}$/.test(String(reconciled.job || "")));
  const lost = accepted ? `answered ${accepted.status}${accepted.why ? ` (${accepted.why})` : ""}${job ? ` job ${job}` : ", no job"}` : "not sent";
  add("API continuation: the build was accepted and its job is known — handed back (202), or found by this send's own attempt key after its answer was lost — the generation runs on the server",
    answered || found,
    found ? "" : reconciled ? `${lost}; reconciling by attempt ${reconciled.attempt || "?"}: ${reconciled.why || "not found"}` : lost);
  if (found) out[out.length - 1].detail = `${lost}; found by attempt ${reconciled.attempt} as job ${reconciled.job}`;
  add("API continuation: the session that sent it made no call after the build was accepted", Array.isArray(senderAfter) && senderAfter.length === 0, `${arr(senderAfter).length} call(s): ${JSON.stringify(arr(senderAfter).slice(0, 4))}`);
  add("API continuation: a session signed in afresh through the API, as the same account, followed the build (not a browser-closed test)", !!(fresh && sender && fresh.token && fresh.token !== sender.token && fresh.uid && fresh.uid === sender.uid),
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
    add(`every image stored is placed or recorded unused by the trace (${unused} unused) — storage and placement only; purchase-once is not verified`, !missing.length && extra.length <= unused,
      `stored ${JSON.stringify(images)}, placed ${JSON.stringify(names)}${missing.length ? `, placed but not stored ${JSON.stringify(missing)}` : ""}`);
  }
  return { checks: out, placed: stored };
}

/**
 * NO PHOTOGRAPH BOUGHT (`BUILD_CHECK_NO_IMAGES`): the site's uploads read
 * whole hold no image, and the stored page places none of the site's own.
 * Unread uploads fail — never read as "none".
 */
export function buildNoImageVerdict({ pages, uploads, slug } = {}) {
  const out = [];
  const add = check(out);
  const placed = [...new Set(arr(pages).flatMap((p) => [...photosOf(p && p.source, slug).keys()].map((u) => photoPath(u, slug)).filter(Boolean)))].sort();
  add("the page places none of the site's own photographs", placed.length === 0, `it places ${JSON.stringify(placed)}`);
  if (!(uploads && uploads.ok === true && Array.isArray(uploads.files))) add("the site's uploads were read, and hold no image", false, uploads && uploads.why ? uploads.why : "not read");
  else {
    const images = uploads.files.filter((f) => f && f.kind === "image").map((f) => f.name).sort();
    add("the site's uploads hold no image: no photograph was bought", images.length === 0, `stored ${JSON.stringify(images)}`);
  }
  return { checks: out, placed };
}

// ── THE MONEY ────────────────────────────────────────────────────────────────

/**
 * THE WHOLE BALANCE MOVE, EXPLAINED. `start` and `end` are stable readings
 * (`{ ok, balance, id }`: the balance read between two equal last-row ids);
 * `rows` the account's ledger rows with ids after `start.id` up to `end.id`,
 * read whole (`{ ok, complete, rows }`). The balance's move must equal what
 * those rows record, every one of them; the build's own rows (`build:<job>`)
 * and every other row are attributed apart. Every build ref debited at most
 * once, and the build's net more than nothing. Anything unstable, unread,
 * partial or unexplained fails.
 */
export function buildMoneyVerdict({ start, end, rows, job, max } = {}) {
  const bad = (why, extra = {}) => ({ ok: false, why, ...extra });
  const stable = (r) => !!(r && r.ok === true && num(r.balance) !== null && Number.isInteger(r.id) && r.id >= 0);
  if (!stable(start) || !stable(end)) return bad("the balance and the ledger's last row could not be read together, steadily, at both ends");
  if (end.id < start.id) return bad(`the ledger's last row went back, ${start.id} -> ${end.id}`);
  if (!(rows && rows.ok === true && rows.complete === true && Array.isArray(rows.rows))) return bad("the ledger window could not be read whole");
  if (!(typeof job === "string" && /^[0-9a-f]{32}$/.test(job))) return bad("no job to attribute charges to");
  const outside = rows.rows.filter((r) => !(r && Number.isInteger(r.id) && r.id > start.id && r.id <= end.id));
  if (outside.length) return bad(`the window holds rows outside it: ${outside.map((r) => r && r.id).join(", ")}`);
  const prefix = `build:${job}`;
  const isBuild = (r) => typeof r.ref === "string" && (r.ref === prefix || r.ref.startsWith(prefix + ":"));
  let recorded = 0, net = 0, other = 0;
  const debits = new Map();
  for (const r of rows.rows) {
    const d = Number(r.delta);
    if (typeof r.delta === "boolean" || r.delta === null || r.delta === "" || !Number.isFinite(d)) return bad(`ledger row ${r.id} has no amount`);
    recorded -= d;
    if (isBuild(r)) { net -= d; if (d < 0) debits.set(r.ref, (debits.get(r.ref) || 0) + 1); }
    else other -= d;
  }
  const spent = start.balance - end.balance;
  const others = rows.rows.filter((r) => !isBuild(r)).map((r) => ({ id: r.id, ref: String(r.ref || ""), delta: Number(r.delta) }));
  const facts = { spent, recorded, net, other, others, refs: [...debits.keys()].sort() };
  if (recorded !== spent) return bad(`the balance moved ${spent}, the ledger window records ${recorded}: ${spent - recorded} unexplained`, facts);
  const twice = [...debits].filter(([, n]) => n > 1).map(([ref, n]) => `${ref} ×${n}`);
  if (twice.length) return bad(`a charge was taken twice: ${twice.join(", ")}`, facts);
  if (!(net > 0)) return bad(`the build took ${net}; a first build is charged`, facts);
  // MORE THAN ITS BUDGET FAILS THE PRESS (2026-10-11): the budget is an
  // estimate, never a bound — the balance is — but a charge past it is a
  // finding, not a pass.
  if (Number.isFinite(max) && net > max) return bad(`the build took ${net}, more than this press's budget of ${max} (only the balance bounded it)`, facts);
  return { ok: true, why: "", ...facts };
}

/**
 * A LEDGER WINDOW SERVED WHOLE: a 200 list whose `Content-Range` (asked with
 * `Prefer: count=exact`) describes every row served — `0-(n-1)/n`, or a starred range over 0
 * for none. A partial answer, a `*` count, no header, or a range that does
 * not describe the rows is not whole.
 */
export function windowComplete({ status, rows, range } = {}) {
  if (status !== 200 || !Array.isArray(rows)) return false;
  const m = /^(?:(\d+)-(\d+)|\*)\/(\d+)$/.exec(String(range || ""));
  if (!m) return false;
  const n = rows.length;
  if (Number(m[3]) !== n) return false;
  return n === 0 ? m[1] === undefined : Number(m[1]) === 0 && Number(m[2]) === n - 1;
}

/** What the press cannot verify, said rather than passed: one purchase per photograph (`unverified`). */
export const PURCHASE_UNVERIFIED = "one provider purchase per photograph: NOT VERIFIED — the purchase records are kept in R2, which a press cannot read; a purchase that failed to store, or overwrote the same file, leaves no image to count";

// ── THE PRESS ────────────────────────────────────────────────────────────────

/**
 * IS THE SLUG VERIFIED FREE? Three explicit readings, each required: the
 * site table read with the service key answers 200 with no row for it, the
 * build records the same, and its address answers 404. The owner's source
 * route is not one of them: its 404 also means another account's site, or an
 * owner lookup that failed. Anything else — unauthorized, rate-limited,
 * failed, unreadable, or not a list — is cannot-tell, and nothing is sent.
 */
export function slugFreeVerdict(existing) {
  const e = existing && typeof existing === "object" ? existing : {};
  const empty = (r) => !!(r && r.status === 200 && Array.isArray(r.rows) && r.rows.length === 0);
  const say = (r) => (!r ? "not read" : r.status !== 200 ? `answered ${r.status || "nothing"}` : !Array.isArray(r.rows) ? "answered no list" : `holds ${r.rows.length} row(s)`);
  if (e.backends && e.backends.status === 200 && Array.isArray(e.backends.rows) && e.backends.rows.length) return { free: false, why: "the slug is already a site, and a build would revise it" };
  if (!empty(e.backends)) return { free: false, why: `the site table could not verify the slug is free (${say(e.backends)})` };
  if (!empty(e.builds)) return { free: false, why: `the build records could not verify the slug is free (${say(e.builds)})` };
  if (!(e.host && e.host.status === 404)) return { free: false, why: `the slug's address did not answer 404 (${e.host ? e.host.status || "nothing" : "not read"})` };
  return { free: true, why: "" };
}

/**
 * THE OWNER'S BALANCE OPT-IN FOR A BUILD PRESS (2026-10-14, preparing the
 * image-free Build parallelism audit). A Build check refuses above its hard
 * cap (`cap`, 100 for `check-no-images`), and the account holds more, so a
 * paid check could never run. This is the UI presses' opt-in
 * (`readBalanceOptIn` in canary-ui.mjs), for the Build workflow's own box:
 * the owner names one mode here, by commit, for one run, and the box then
 * lets that mode run only while the balance is exactly the number typed.
 * CLOSED: it admits no mode. Not a budget: the build may spend up to the
 * whole balance; the server is the only bound.
 */
// CLOSED (2026-10-14, after its one approved run, run 117). It admitted
// `check-no-images` alone for that run; it admits no mode now.
export const BUILD_BALANCE_OPT_IN = Object.freeze([]);

/** The box, read before the sign-in: blank (`value` null), a whole number for an admitted mode, or a refusal (`ok` false). */
export function readBuildOptIn(raw, { mode = "", admitted = BUILD_BALANCE_OPT_IN } = {}) {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return { ok: true, value: null, mode: "" };
  if (!/^[1-9][0-9]{0,6}$/.test(s)) return { ok: false, msg: `the balance box takes the account's balance in whole credits (e.g. 783), not "${s}"` };
  if (!admitted.length) return { ok: false, msg: "the build balance box is closed: no build check may run above its cap until the owner names one" };
  const m = typeof mode === "string" ? mode.trim().toLowerCase() : "";
  if (!admitted.includes(m)) return { ok: false, msg: `the build balance box is only for ${admitted.join(", ")}; this press is ${m || "no check"}` };
  return { ok: true, value: Number(s), mode: m };
}

/** The press's refusals before anything is sent: a balance outside its window or unread, and a slug not verified free. */
export function buildPreflight({ balance, budget, cap, existing }) {
  if (num(balance) === null) return "the balance could not be read — nothing is sent";
  if (balance < budget) return `the balance, ${balance}, does not cover this press's budget of ${budget} — nothing is sent`;
  if (balance > cap) return `the balance, ${balance}, is above this press's hard cap of ${cap} — nothing is sent`;
  const f = slugFreeVerdict(existing);
  if (!f.free) return `${f.why} — nothing is sent`;
  return "";
}

/**
 * EVERY PREREQUISITE THE PRESS CAN READ WITHOUT PAYING (2026-10-11, round 4),
 * each `{ name, ok, why }` — never only the first that fails, so a rehearsal
 * shows everything a paid press would refuse on.
 */
export function buildPrerequisites({ balance, budget, cap, existing, named = null }) {
  const read = num(balance) !== null;
  const f = slugFreeVerdict(existing);
  // WITH THE OWNER'S OPT-IN (`named`, from `readBuildOptIn`), the hard cap is
  // replaced by "exactly the balance the owner typed" — never removed.
  const capCheck = Number.isInteger(named) && named > 0
    ? { name: `the balance is exactly the ${named} the owner allowed this press to run against`, ok: read && balance === named, why: read ? `the balance (${balance}) is not the ${named} credits this press was allowed to run against` : "the balance could not be read" }
    : { name: `the balance is within the hard cap of ${cap}`, ok: read && balance <= cap, why: read ? `the balance, ${balance}, is above this press's hard cap of ${cap}` : "the balance could not be read" };
  return [
    { name: "the balance was read", ok: read, why: read ? "" : "the balance could not be read" },
    { name: `the balance covers the estimate of ${budget}`, ok: read && balance >= budget, why: read ? `the balance, ${balance}, does not cover this press's budget of ${budget}` : "the balance could not be read" },
    capCheck,
    { name: "the slug is free", ok: f.free, why: f.why },
  ];
}

/** THE BALANCE AND THE LEDGER'S LAST ROW, TOGETHER: the balance read between two equal last-row ids, tried three times. */
export async function stableReading(io) {
  for (let i = 0; i < 3; i++) {
    const a = await io.ledgerLast();
    const balance = await io.balance();
    const b = await io.ledgerLast();
    if (a && a.ok && b && b.ok && a.id === b.id && num(balance) !== null) return { ok: true, balance, id: a.id };
  }
  return { ok: false };
}

/**
 * ONE FIRST BUILD, START TO FINISH, through `io` (every network read and
 * write the press makes, so the whole of it runs offline under a stub):
 * `signIn()` → `{ token, uid }`; `balance()`; `ledgerLast()` → `{ ok, id }`;
 * `existing(slug)` → the slug's three readings (`slugFreeVerdict`);
 * `post(token, body)` → the build's answer; `poll(token, job)`;
 * `trace(slug)` → `{ steps, done, ok }`; `source(token, slug)`;
 * `served(slug)` → `{ status, html }`; `image(slug, path)`;
 * `uploads(token, slug)`; `ledgerWindow(fromId, toId)` → `{ ok, complete, rows }`;
 * `sleep(ms)`; `now()`; `log`.
 * With `spend` false it stops after the preflight: a free rehearsal.
 */
export async function runBuildCheck(io, { spec = BUILD_CHECK, spend = false, named = null } = {}) {
  const log = typeof io.log === "function" ? io.log : () => {};
  const record = { spec: { slug: spec.slug, budget: spec.budget, cap: spec.cap }, sent: false, stopped: "", calls: [] };
  const tagged = (who, token) => ({
    get: async (name, fn) => { record.calls.push({ who, name, at: io.now() }); return fn(token); },
  });
  const sender = await io.signIn();
  record.sender = { uid: sender && sender.uid };
  const A = tagged("sender", sender.token);
  const startReading = await stableReading(io);
  const start = startReading.ok ? startReading.balance : null;
  const existing = await io.existing(spec.slug);
  record.existing = existing;
  record.balanceStart = start;
  // EVERY PREREQUISITE, READ BEFORE ANYTHING IS PAID FOR AND REPORTED WHOLE
  // (2026-10-11, round 4). The runtime route is a free read, so it is asked
  // whatever the balance says: a rehearsal at a balance the press would refuse
  // still reports the image switch and the account's flags, and lists every
  // prerequisite that is not met rather than the first. A paid press refuses
  // on any of them before its one paid call.
  const prereqs = buildPrerequisites({ balance: start, budget: spec.budget, cap: spec.cap, existing, named });
  if (spec.images === "none") {
    const rt = typeof io.runtime === "function" ? await io.runtime(sender.token, spec.runtimeSlug) : null;
    record.imagesOff = { status: rt ? rt.status : 0, imagePurchases: rt && rt.json ? rt.json.imagePurchases : undefined };
    const why = imageRefusalOf(rt);
    prereqs.push({ name: "the live Worker buys no photograph", ok: !why, why });
    const fl = buildFlagsVerdict(rt);
    const j = rt && rt.json && typeof rt.json === "object" ? rt.json : {};
    record.flags = { ok: fl.ok, modes: fl.modes, read: Object.fromEntries(["design", "graph", "bandsEveryone", "bands"].map((k) => [k, typeof j[k] === "boolean" ? j[k] : null])) };
    prereqs.push({ name: "an image-free parallel mode is already on for this account", ok: fl.ok, why: fl.why });
  }
  record.prereqs = prereqs;
  for (const p of prereqs) log(`  ${p.ok ? "MET  " : "UNMET"}  ${p.name}${p.ok ? "" : ` — ${p.why}`}`);
  const unmet = prereqs.filter((p) => !p.ok);
  record.unmet = unmet.map((p) => p.name);
  if (!spend) {
    record.stopped = unmet.length
      ? `spend is not yes — nothing is sent; a paid press would refuse: ${unmet.map((p) => p.why).join("; ")}`
      : "spend is not yes — the preflight passed and nothing is sent";
    log(record.stopped);
    return record;
  }
  // THE STRICT CHECK BEFORE THE PAID CALL: any prerequisite unmet, nothing is sent.
  if (unmet.length) { record.stopped = `${unmet.map((p) => p.why).join("; ")} — nothing is sent`; log(`STOPPED: ${record.stopped}`); return record; }
  record.ledgerMark = startReading.id;
  // THIS SEND'S OWN NAME, made before it leaves (2026-10-14, after run 117).
  const attempt = typeof io.attempt === "function" ? io.attempt() : newAttempt();
  record.attempt = attempt;
  const sentAt = io.now();
  const accepted = await A.get("post", (t) => io.post(t, { brief: spec.brief, slug: spec.slug, attempt }));
  record.sent = true;
  const acceptedAt = record.calls.length;
  const answeredJob = accepted && accepted.json && typeof accepted.json.job === "string" ? accepted.json.job : "";
  // THE ORIGINAL ANSWER IS KEPT AS IT CAME, its network error included: a
  // reconciled job never overwrites what the send itself was told.
  record.accepted = { status: accepted ? accepted.status : 0, job: answeredJob, stage: accepted && accepted.json ? accepted.json.stage : undefined, ...(accepted && accepted.why ? { why: String(accepted.why) } : {}) };
  log(`accepted: ${record.accepted.status}${record.accepted.why ? ` (${record.accepted.why})` : ""} job ${answeredJob || "(none)"}`);
  // THE SENDER LETS GO HERE. Everything after is the fresh session's.
  const fresh = await io.signIn();
  record.fresh = { uid: fresh && fresh.uid, sameToken: !!(fresh && fresh.token === sender.token) };
  const B = tagged("fresh", fresh.token);
  // NO JOB IN THE ANSWER, AND NO FINAL ANSWER EITHER: the connection was lost
  // (or answered nothing usable). The fresh session looks for THIS send's
  // build by its attempt key — it never sends again.
  let job = answeredJob;
  if (!job && !(accepted && accepted.status === 200) && typeof io.builds === "function") {
    const t0 = io.now();
    let m = null;
    while (io.now() - t0 < (spec.reconcileMs || 120_000)) {
      m = attemptMatch(await B.get("builds", (t) => io.builds(t)), attempt);
      if (m.ok || m.ambiguous) break;
      await io.sleep(spec.pollMs);
    }
    record.reconciled = m;
    log(`reconciled by attempt ${attempt}: ${m && m.ok ? `job ${m.job}` : (m && m.why) || "not tried"}`);
    if (m && m.ok) job = m.job;
  }
  record.job = job;
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
  // THE TRACE IS TAKEN ONLY WHEN IT IS THIS JOB'S (2026-10-14): read by slug,
  // bound to the job's own row by time; another attempt's trace judges nothing.
  const rawTrace = (await io.trace(spec.slug)) || null;
  const jobRow = job && typeof io.jobRow === "function" ? await io.jobRow(job) : null;
  const ta = traceAttribution({ trace: rawTrace, jobRow, job, slug: spec.slug, sentAt });
  record.traceAttribution = ta;
  const tr = ta.ok ? rawTrace : {};
  const src = await B.get("source", (t) => io.source(t, spec.slug));
  const site = await io.served(spec.slug);
  const sourceBody = src && src.status === 200 ? src.json : null;
  const pages = arr(sourceBody && sourceBody.pages);
  const placed = [...new Set(pages.flatMap((p) => [...photosOf(p && p.source, spec.slug).keys()].map((u) => photoPath(u, spec.slug)).filter(Boolean)))];
  const bytes = {};
  for (const p of placed) bytes[p] = await io.image(spec.slug, p);
  const up = await B.get("uploads", (t) => io.uploads(t, spec.slug));
  await io.sleep(spec.laterReadMs);
  const endReading = await stableReading(io);
  const end = endReading.ok ? endReading.balance : null;
  const rows = endReading.ok ? await io.ledgerWindow(startReading.id, endReading.id) : { ok: false };
  const senderAfter = record.calls.slice(acceptedAt).filter((c) => c.who === "sender");
  const checks = [];
  checks.push(...buildClosureVerdict({ accepted: record.accepted, senderAfter, sender, fresh, final, site: site && site.status, reconciled: record.reconciled || null }));
  checks.push({ name: "the trace judged is this build's own (its job's row, its slug, inside its job's life)", ok: ta.ok, why: ta.why });
  checks.push(...buildShapeVerdict(sourceBody).checks);
  const ov = buildOverlapVerdict(tr.steps, { photos: spec.images !== "none" });
  checks.push({ name: "independent build work ran at once, by the build's recorded times and order", ok: ov.ok, why: ov.ok ? "" : ov.why });
  record.overlap = ov;
  const order = buildOrderVerdict(tr);
  checks.push(...order.checks);
  record.order = order.order;
  const pv = buildProgressVerdict(polls);
  checks.push(...pv.checks);
  record.lines = pv.lines;
  const ph = spec.images === "none"
    ? buildNoImageVerdict({ pages, uploads: up, slug: spec.slug })
    : buildPhotoVerdict({ pages, served: site && site.html, bytes, uploads: up, steps: tr.steps, slug: spec.slug });
  checks.push(...ph.checks);
  const money = buildMoneyVerdict({ start: startReading, end: endReading, rows, job, max: spec.budget });
  checks.push({ name: `the whole balance move explained by the complete ledger window, the build's charges each taken once: moved ${money.spent ?? "?"}, recorded ${money.recorded ?? "?"} (this build ${money.net ?? "?"}, other rows ${money.other ?? "?"})`, ok: money.ok, why: money.why });
  record.unverified = spec.images === "none" ? [] : [PURCHASE_UNVERIFIED];
  record.money = money;
  record.balanceEnd = end;
  record.checks = checks;
  record.ok = checks.every((c) => c.ok);
  return record;
}

/**
 * JUDGE ONE FINISHED BUILD, SENDING NOTHING (2026-10-14, after run 117). The
 * press that sent run 117 read the build before it ended, so its shape and
 * order checks judged an empty source. This reads a build that has ended —
 * named by its JOB ID, never "the latest for the slug" — and judges what it
 * really left: the stored source's one page and fifteen components, its own
 * trace (bound to the job's row), its order, its overlap and its charges
 * (every ledger row whose ref is this job's, and only those). No routing
 * call, no build, no photograph: the owner's own free read.
 */
export async function judgeBuild(io, { spec, job } = {}) {
  const record = { mode: "judge", spec: { slug: spec && spec.slug }, job: String(job || ""), sent: false, checks: [] };
  const add = check(record.checks);
  if (!(typeof job === "string" && /^[0-9a-f]{32}$/.test(job))) { record.stopped = "a judge needs the build's job id (32 hex characters)"; return record; }
  const who = await io.signIn();
  record.reader = { uid: who && who.uid };
  const jobRow = typeof io.jobRow === "function" ? await io.jobRow(job) : null;
  record.jobRow = jobRow ? { id: jobRow.id, slug: jobRow.slug, op: jobRow.op, state: jobRow.state, created_at: jobRow.created_at, updated_at: jobRow.updated_at } : null;
  add("the job is a finished build of this site", !!(jobRow && jobRow.id === job && jobRow.slug === spec.slug && jobRow.op === "build" && jobRow.state === "done"),
    jobRow ? `row ${JSON.stringify(record.jobRow)}` : "no row for the job");
  if (!record.checks[0].ok) { record.stopped = record.checks[0].why; record.ok = false; return record; }
  const sentAt = Date.parse(jobRow.created_at);
  const raw = await io.trace(spec.slug);
  const ta = traceAttribution({ trace: raw, jobRow, job, slug: spec.slug, sentAt });
  record.traceAttribution = ta;
  add("the trace judged is this build's own (its job's row, its slug, inside its job's life)", ta.ok, ta.why);
  const tr = ta.ok ? raw : {};
  const src = await io.source(who.token, spec.slug);
  const shape = buildShapeVerdict(src && src.status === 200 ? src.json : null);
  record.shape = { pages: shape.pages, kit: shape.kit, parts: shape.parts };
  record.checks.push(...shape.checks);
  const ov = buildOverlapVerdict(tr.steps, { photos: spec.images !== "none" });
  record.overlap = ov;
  record.checks.push({ name: "independent build work ran at once, by the build's recorded times and order", ok: ov.ok, why: ov.ok ? "" : ov.why });
  const order = buildOrderVerdict(tr);
  record.order = order.order;
  record.checks.push(...order.checks);
  const rows = typeof io.ledgerByJob === "function" ? await io.ledgerByJob(job) : null;
  const mine = rows && Array.isArray(rows.rows) ? rows.rows.filter((r) => r && typeof r.ref === "string" && r.ref.startsWith(`build:${job}:`)) : null;
  const refs = mine ? mine.map((r) => r.ref) : [];
  const twice = refs.filter((r, i) => refs.indexOf(r) !== i);
  const net = mine ? mine.reduce((n, r) => n - Number(r.delta), 0) : null;
  record.charges = mine ? { rows: mine.map((r) => ({ id: r.id, ref: r.ref, delta: Number(r.delta), at: r.at })), net } : null;
  add(`this build's own charges, each taken once: ${net ?? "?"} credits on ${refs.length} row(s)`, !!(rows && rows.ok && mine && mine.length && !twice.length && net > 0),
    !rows || !rows.ok ? "the ledger could not be read" : !mine.length ? "no ledger row carries this job's ref" : twice.length ? `taken twice: ${twice.join(", ")}` : `net ${net}`);
  record.ok = record.checks.every((c) => c.ok);
  return record;
}

