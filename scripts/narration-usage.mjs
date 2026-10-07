// THE NARRATION'S OWN USAGE, READ BACK FROM THE WORKER'S LOG LINES (2026-10-06).
//
// The owner: *"Record the real model wording, attempts, tokens, latency and
// platform narration cost, confirming narration adds no customer charge."* A
// narration call is never charged, so the ledger cannot say what one cost. What
// each did is in the Worker's own log, one line a call (worker.js,
// `writeProgressLine` and `writeTaskLines`):
//
//   progress: <job> written model grok-4.6 milestones 2 facts 3 attempts 1 tokens 812/64 cache 640/0 ms 2310
//   progress: tasks <record> written model grok-4.6 tasks 2 attempts 1 tokens 420/233 cache 0/0 ms 3021
//
// (built by one formatter for both writers, `usageLogLine` in
// builder/site-progress.mjs, and printed as one string since 2026-10-07; a
// line from before then has no `cache` pair and still reads),
//
// beside the lines that say a call or a delivery did not go ("not written
// (why)", "given up after", "not delivered after", "milestone refused").
// Workers Logs keep them seven days (`observability` in wrangler.jsonc). This
// reads them back for one press's own ids, in its own window, through the same
// free, read-only query `container-logs.mjs` makes (`dry: true`: nothing
// persisted, no container started, nothing charged), with CI's Cloudflare
// token, and prices each call at the platform's own rates (`pageCost`, the
// table the ledger prices real work with). The canary workflow runs it as a
// step of its own, after the press, so the token never reaches the press.
//
// THE CACHED INPUT, SINCE 2026-10-07: a line names the cached input beside
// the fresh (priced at a quarter of the fresh rate on grok), so a call read
// from it is priced whole. A line from before then names fresh tokens only:
// its cost is a floor, and said so, call by call.
//
// A TOTAL IS NEVER PASSED OFF AS WHOLE WHEN A CALL IS KNOWN TO BE MISSING
// (2026-10-07, after run 105, whose reading priced five line calls as the
// narration's cost while its request's task lines — written by a call, and on
// its cards — had no call read): every request of the press writes its parts'
// task lines in a call of its own, so a request with no task-lines call read
// makes the account INCOMPLETE, named; and a narration line of the press's
// ids or site that neither parser reads is kept and shown, never dropped, so
// an unreadable line is never mistaken for one that was not there.
//
// NO CALL READ IS NO MEASUREMENT (2026-10-06, Codex's review): a query that
// answered, with no call under the press's ids, says the usage is not
// measured — never a verified zero cost. Whether the logs were read and
// whether they held the press's usage are kept apart (`query.ok`,
// `measured`), and a cost is printed only from calls read.
//
// WHERE EACH LINE IS WRITTEN: the writers' call lines by the Worker's queue
// consumer; the recorder's delivery lines ("not delivered after") wherever
// the job runs, usually the site's container, whose output Workers Logs keep
// with observability on (wrangler.jsonc). That the container's lines reach
// this query in this shape is not yet seen in a live read.
//
// WITH NO PRESS TO READ (no ids file in the evidence), it only asks whether the
// logs can be read at all: the free runtime check's way to know before a paid
// press. It never fails the workflow; a log it could not read is said loudly.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { pageCost } from "../builder/publish-pages.mjs";

/** One credit in dollars (docs/platform.md; publish-pages.mjs's own `CREDIT_USD`, which it does not export — test/narration-usage.test.mjs holds the two equal). */
export const CREDIT_USD = 0.008;
/** The search every query makes: a substring of the log line's message. */
export const NEEDLE = "progress:";

const CALL = /^progress: (?:(tasks) )?(\S+) (written|not written \(([^)]*)\)) model (\S+) (?:milestones (\d+) facts (\d+)|tasks (\d+)) attempts (\d+) tokens (\d+)\/(\d+)(?: cache (\d+)\/(\d+))? ms (\d+)\s*$/;

/** One narration call's line, read whole, or null: what it was, for which record, how it went, on which model, and its attempts, tokens (fresh, and cached where the line names them — null on a line from before 2026-10-07) and time. */
export function parseCall(message) {
  const m = CALL.exec(String(message || "").trim());
  if (!m) return null;
  return {
    kind: m[1] ? "tasks" : "line", id: m[2], ok: m[3] === "written", why: m[4] || "", model: m[5],
    milestones: m[6] !== undefined ? Number(m[6]) : null, facts: m[7] !== undefined ? Number(m[7]) : null, tasks: m[8] !== undefined ? Number(m[8]) : null,
    attempts: Number(m[9]), in: Number(m[10]), out: Number(m[11]),
    cacheRead: m[12] !== undefined ? Number(m[12]) : null, cacheWrite: m[13] !== undefined ? Number(m[13]) : null,
    ms: Number(m[14]),
  };
}

/**
 * A line that says a narration did not go (no call priced in it), or null.
 * The recorder's line names what it could not deliver in words, more than
 * one token (`worker.js`, `makeProgress`'s `deliver`): "progress: <id>
 * milestone 0 not delivered after 8 tries", or "… opening not delivered …".
 */
export function parseEvent(message) {
  const t = String(message || "").trim();
  let m = /^progress: (\S+) given up after (\d+) tries$/.exec(t);
  if (m) return { what: "given up", id: m[1], tries: Number(m[2]) };
  m = /^progress: (\S+) (.+?) not delivered after (\d+) tries$/.exec(t);
  if (m) return { what: "not delivered", id: m[1], step: m[2], tries: Number(m[3]) };
  m = /^progress: (\S+) milestone refused — (.+)$/.exec(t);
  if (m) return { what: "refused", id: m[1], why: m[2] };
  return null;
}

/**
 * A LOG EVENT'S MESSAGE, wherever its shape keeps it: `$metadata.message`
 * (the field `container-logs.mjs` reads), `source.message`, either as a
 * string or as the list of a log call's arguments, or any string deeper in
 * the event that begins with the needle — so a shape other than the SDK's
 * claim still reads, rather than reading as nothing logged.
 *
 * THE ONE THAT READS, NOT THE FIRST FOUND (2026-10-07): of the candidates,
 * one either parser reads is taken first, then the longest — a field holding
 * only a call's first argument ("progress: tasks") never hides the whole line
 * another field holds.
 */
export function messageOf(e) {
  const found = [];
  const add = (v) => {
    if (typeof v === "string") { if (v.startsWith(NEEDLE)) found.push(v); return; }
    if (Array.isArray(v) && v.length && v.every((x) => typeof x === "string" || typeof x === "number")) {
      const joined = v.join(" ");
      if (joined.startsWith(NEEDLE)) found.push(joined);
    }
  };
  add(e && e.$metadata && e.$metadata.message);
  add(e && e.source && e.source.message);
  const seen = new Set();
  const walk = (v, depth) => {
    if (typeof v === "string") { if (v.startsWith(NEEDLE)) found.push(v); return; }
    if (!v || typeof v !== "object" || depth > 6 || seen.has(v)) return;
    seen.add(v);
    for (const x of Array.isArray(v) ? v : Object.values(v)) walk(x, depth + 1);
  };
  walk(e, 0);
  if (!found.length) return "";
  return found.find((m) => parseCall(m) || parseEvent(m)) || found.reduce((a, b) => (b.length > a.length ? b : a));
}

/** The id a request's own narration record is kept under (worker.js, `requestTasksId`). */
export function requestTasksId(slug, key) {
  return createHash("sha256").update("request-tasks:" + slug + "/" + key).digest("hex").slice(0, 32);
}

/** The ids a press's narration is logged under: each job's own record, and each request's. */
export function pressIds({ slug, requests, jobs }) {
  const out = new Set();
  for (const j of Array.isArray(jobs) ? jobs : []) if (typeof j === "string" && j) out.add(j);
  for (const k of Array.isArray(requests) ? requests : []) if (typeof k === "string" && k && typeof slug === "string" && slug) out.add(requestTasksId(slug, k));
  return out;
}

/**
 * THE CALLS A PRESS IS KNOWN TO MAKE: every request writes its parts' task
 * lines in a call of its own (`syncRequestTasks`, then `writeTaskLines`), so
 * each request's narration record owes at least one task-lines call. A job's
 * own line calls are not owed — a job whose milestones all closed before a
 * writer came has none.
 */
export function expectedCalls({ slug, requests }) {
  const out = [];
  for (const k of Array.isArray(requests) ? requests : []) {
    if (typeof k === "string" && k && typeof slug === "string" && slug) out.push({ kind: "tasks", id: requestTasksId(slug, k), request: k });
  }
  return out;
}

/** How many lines of this press that neither parser reads are kept, each cut to `UNPARSED_CHARS`; the count is kept whole. */
export const UNPARSED_KEPT = 20;
export const UNPARSED_CHARS = 300;

/**
 * THE PRESS'S NARRATION, FROM THE EVENTS: each call of one of its ids, priced
 * at the platform's rates (`pageCost`, with the cached input where the line
 * names it — a call whose line does not is a floor, `floor`), and every line
 * that says something did not go; with totals — calls, how many wrote,
 * attempts, tokens, time (sum, median, most) and cost in dollars and credits.
 * Events not of its ids are counted, never read further.
 *
 * AND WHAT IT CANNOT ACCOUNT FOR (2026-10-07): `missing`, each call the press
 * is known to make (`expect`, from `expectedCalls`) with none read; and
 * `unparsed`, each narration line naming one of its ids or its site that
 * neither parser reads (the first `UNPARSED_KEPT`, cut; `unparsedCount` whole).
 * Either makes the account incomplete (`complete: false`).
 */
export function usageOf(events, ids, { expect = [], slug = "" } = {}) {
  const calls = [], events2 = [], unparsed = [];
  let other = 0, unparsedCount = 0;
  const mine = (msg) => [...ids].some((id) => id && msg.includes(id)) || (typeof slug === "string" && slug !== "" && msg.includes(slug));
  for (const e of Array.isArray(events) ? events : []) {
    const msg = messageOf(e);
    if (!msg) continue;
    const ts = Number(e && (e.timestamp || (e.$metadata && e.$metadata.timestamp))) || 0;
    const c = parseCall(msg);
    if (c) { if (ids.has(c.id)) calls.push({ ts, ...c }); else other++; continue; }
    const ev = parseEvent(msg);
    if (ev) { if (ids.has(ev.id)) events2.push({ ts, ...ev }); else other++; continue; }
    if (mine(msg)) {
      unparsedCount++;
      if (unparsed.length < UNPARSED_KEPT) unparsed.push({ ts, text: msg.slice(0, UNPARSED_CHARS) });
    } else other++;
  }
  calls.sort((a, b) => a.ts - b.ts);
  events2.sort((a, b) => a.ts - b.ts);
  unparsed.sort((a, b) => a.ts - b.ts);
  const priced = calls.map((c) => {
    const floor = c.cacheRead === null || c.cacheWrite === null;
    const usd = pageCost({ in: c.in, out: c.out, cacheRead: c.cacheRead || 0, cacheWrite: c.cacheWrite || 0, model: c.model });
    return { ...c, floor, usd, credits: usd / CREDIT_USD };
  });
  const missing = (Array.isArray(expect) ? expect : []).filter((x) => x && !priced.some((c) => c.id === x.id && c.kind === x.kind));
  const ms = priced.map((c) => c.ms).sort((a, b) => a - b);
  const sum = (f) => priced.reduce((t, c) => t + f(c), 0);
  const usd = sum((c) => c.usd);
  return {
    calls: priced, events: events2, otherIds: other, missing, unparsed, unparsedCount,
    complete: priced.length > 0 && missing.length === 0 && unparsedCount === 0,
    totals: {
      calls: priced.length, written: priced.filter((c) => c.ok).length, lines: priced.filter((c) => c.kind === "line").length, tasks: priced.filter((c) => c.kind === "tasks").length,
      attempts: sum((c) => c.attempts), in: sum((c) => c.in), out: sum((c) => c.out),
      cacheRead: sum((c) => c.cacheRead || 0), cacheWrite: sum((c) => c.cacheWrite || 0), floorCalls: priced.filter((c) => c.floor).length,
      ms: sum((c) => c.ms), msMedian: ms.length ? ms[Math.floor((ms.length - 1) / 2)] : 0, msMost: ms.length ? ms[ms.length - 1] : 0,
      usd, credits: usd / CREDIT_USD,
    },
  };
}

/** The words for usage that was not measured: never a zero cost. */
export const UNMEASURED = "no narration call was read for this press, so its usage and cost are not measured — this is not a verified zero";

/** The account, written out for the log; with no call read, it says the measurement is unavailable and prints no cost; with a call known to be missing or a line unread, it says the total is not the whole. */
export function describeUsage(u) {
  if (!u || !Array.isArray(u.calls) || !u.calls.length || !u.totals) return `NARRATION USAGE UNAVAILABLE: ${UNMEASURED}`;
  const out = [];
  const t = u.totals;
  const missing = Array.isArray(u.missing) ? u.missing : [];
  const unparsedCount = Number(u.unparsedCount) || 0;
  const whole = missing.length === 0 && unparsedCount === 0;
  const floors = Number(t.floorCalls) || 0;
  out.push(`NARRATION USAGE${whole ? "" : " (INCOMPLETE)"}: ${t.calls} call(s) read, ${t.written} written (${t.lines} line call(s), ${t.tasks} task-lines call(s)); attempts ${t.attempts}; tokens ${t.in} in / ${t.out} out, cached ${t.cacheRead || 0} read / ${t.cacheWrite || 0} written${floors ? ` (${floors} call(s) logged before cached input was in the line: theirs is not counted)` : ""}; time ${t.ms} ms in all, median ${t.msMedian} ms, most ${t.msMost} ms`);
  out.push(`  platform cost of the calls read (absorbed, never charged): $${t.usd.toFixed(5)} = ${t.credits.toFixed(3)} credit(s) at the platform's own rates${floors ? " — a floor" : ""}${whole ? "" : " — NOT the narration's whole cost: see below"}`);
  for (const c of u.calls) {
    out.push(`  ${c.ts ? new Date(c.ts).toISOString().slice(11, 19) : "--:--:--"}  ${c.kind === "tasks" ? "tasks" : "line "}  ${c.id.slice(0, 12)}  ${c.ok ? "written" : `NOT written (${c.why})`}  ${c.model}  ${c.kind === "tasks" ? `tasks ${c.tasks}` : `milestones ${c.milestones} facts ${c.facts}`}  attempts ${c.attempts}  tokens ${c.in}/${c.out}  cache ${c.floor ? "not logged" : `${c.cacheRead}/${c.cacheWrite}`}  ${c.ms} ms  $${c.usd.toFixed(5)}`);
  }
  for (const e of u.events) out.push(`  ${e.ts ? new Date(e.ts).toISOString().slice(11, 19) : "--:--:--"}  ${e.what.toUpperCase()}  ${e.id.slice(0, 12)}${e.tries ? ` after ${e.tries} tries` : ""}${e.why ? ` — ${e.why}` : ""}${e.step ? ` (${e.step})` : ""}`);
  for (const m of missing) out.push(`  NOT READ: no ${m.kind === "tasks" ? "task-lines" : m.kind} call was read for ${m.request ? `request ${m.request.slice(0, 12)} (record ${m.id.slice(0, 12)})` : `record ${m.id.slice(0, 12)}`} — its usage is not in the total above: not measured, and not zero`);
  for (const l of Array.isArray(u.unparsed) ? u.unparsed : []) out.push(`  UNREAD LINE ${l.ts ? new Date(l.ts).toISOString().slice(11, 19) : "--:--:--"}: ${l.text}`);
  if (unparsedCount > (Array.isArray(u.unparsed) ? u.unparsed.length : 0)) out.push(`  … and ${unparsedCount - u.unparsed.length} more unread line(s) of this press (${unparsedCount} in all)`);
  if (u.otherIds) out.push(`  (${u.otherIds} narration line(s) of other ids in the window, not this press's)`);
  return out.join("\n");
}

/** The free, read-only telemetry query (`container-logs.mjs`'s): the newest events in a window whose message carries the needle. */
export function queryBody({ from, to }) {
  return {
    queryId: "narration-usage",
    timeframe: { from, to },
    view: "events",
    limit: 900,
    dry: true,
    parameters: { datasets: [], filters: [{ key: "$metadata.message", operation: "includes", value: NEEDLE, type: "string" }] },
  };
}

/** One query: `{ ok, status, events, why }`. */
export async function queryLogs({ token, account, from, to, fetchImpl = fetch }) {
  if (!token || !account) return { ok: false, status: 0, events: [], why: "no Cloudflare token or account was handed to this step" };
  let r;
  try {
    r = await fetchImpl(`https://api.cloudflare.com/client/v4/accounts/${account}/workers/observability/telemetry/query`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(queryBody({ from, to })),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (e) { return { ok: false, status: 0, events: [], why: `the query did not answer (${String((e && e.name) || "error")})` }; }
  const text = await r.text().catch(() => "");
  if (!r.ok) {
    return { ok: false, status: r.status, events: [], why: r.status === 403 || /authentication/i.test(text) ? "the token may not read Workers Logs (it needs Account › Workers Observability › Read)" : `the query answered ${r.status}` };
  }
  let j = null;
  try { j = JSON.parse(text); } catch { return { ok: false, status: r.status, events: [], why: "the query answered 200 with a body that is not JSON" }; }
  const events = j && j.result && j.result.events && Array.isArray(j.result.events.events) ? j.result.events.events : null;
  if (!events) return { ok: false, status: r.status, events: [], why: "the query answered 200 with no events list" };
  return { ok: true, status: r.status, events, why: "" };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * THE STEP: with the press's ids, the window from two minutes before its
 * first balance read to ten after its last (bounded by now), read again a
 * few times while the newest lines are still arriving — until two reads
 * agree, or the reads run out; without them, a probe of the last fifteen
 * minutes. Writes `narration.json` beside the evidence and prints the account:
 * `measured` with the calls and their cost; or not measured, with whether the
 * query answered (`query.ok`) and why — and then no cost at all.
 */
export async function main({ env = process.env, now = () => Date.now(), fetchImpl = fetch, wait = sleep, log = console.log, reads = 4, everyMs = 45_000 } = {}) {
  const dir = env.CANARY_EVIDENCE_DIR || "canary-evidence";
  const idsFile = `${dir}/narration-ids.json`;
  const token = env.CLOUDFLARE_API_TOKEN || "", account = env.CLOUDFLARE_ACCOUNT_ID || "";
  let ask = null;
  if (existsSync(idsFile)) { try { ask = JSON.parse(readFileSync(idsFile, "utf8")); } catch { ask = null; } }
  if (!ask) {
    const to = now();
    const q = await queryLogs({ token, account, from: to - 15 * 60_000, to, fetchImpl });
    log(q.ok
      ? `NARRATION LOGS READABLE: the free query answered (${q.events.length} narration line(s) in the last 15 minutes). That the logs can be read measures no usage: a press's usage is measured only from its own calls`
      : `NARRATION LOGS NOT READABLE: ${q.why} — a paid press's usage would have to be read from the dashboard instead (Workers & Pages › isibi-app › Logs, searching "${NEEDLE}")`);
    return { probe: true, readable: q.ok, why: q.why };
  }
  const ids = pressIds(ask);
  const from = Date.parse(String(ask.from || "")) - 2 * 60_000;
  const end = Date.parse(String(ask.to || "")) + 10 * 60_000;
  if (!Number.isFinite(from) || !Number.isFinite(end) || !ids.size) {
    log("NARRATION USAGE NOT READ: the press left no window or no ids to read it by");
    return { probe: false, queried: false, measured: false, why: "no window or ids" };
  }
  const expect = expectedCalls(ask);
  let usage = null, last = -1, q = null, tries = 0;
  for (let i = 0; i < reads; i++) {
    tries++;
    q = await queryLogs({ token, account, from, to: Math.min(end, now()), fetchImpl });
    if (!q.ok) break;
    usage = usageOf(q.events, ids, { expect, slug: ask.slug });
    const count = usage.calls.length + usage.events.length + usage.unparsedCount;
    if (count > 0 && count === last) break;
    last = count;
    if (i + 1 < reads) await wait(everyMs);
  }
  // WHETHER THE LOGS WERE READ, AND WHETHER THEY HOLD THE PRESS'S USAGE, ARE
  // TWO FACTS (2026-10-06, Codex's review): a query that answered and found no
  // call under the press's ids measures nothing — never a verified zero cost.
  const queried = !!(q && q.ok && usage);
  const measured = queried && usage.calls.length > 0;
  const query = { ok: queried, reads: tries, window: { from: new Date(from).toISOString(), to: new Date(Math.min(end, now())).toISOString() }, ...(queried ? {} : { why: q ? q.why : "not read" }) };
  const out = measured
    ? { measured: true, query, ids: [...ids], ...usage }
    : {
        measured: false, complete: false, query, ids: [...ids],
        why: queried ? `the logs were read and hold no narration call under the press's ids: ${UNMEASURED}` : query.why,
        ...(queried ? { events: usage.events, otherIds: usage.otherIds, missing: usage.missing, unparsed: usage.unparsed, unparsedCount: usage.unparsedCount } : {}),
      };
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/narration.json`, JSON.stringify(out, null, 2));
  const dashboard = `read it from the dashboard instead (Workers & Pages › isibi-app › Logs, searching "${NEEDLE}" between ${new Date(from).toISOString()} and ${new Date(end).toISOString()})`;
  if (measured) log(describeUsage(out) + (out.complete ? "" : `\n  the rest: ${dashboard}`));
  else if (queried) log(`NARRATION USAGE UNAVAILABLE: ${out.why}${out.events.length ? `; ${out.events.length} delivery line(s) of its ids were read` : ""}${out.unparsedCount ? `; ${out.unparsedCount} line(s) of this press could not be read: ${out.unparsed.map((l) => l.text).join(" | ")}` : ""} — ${dashboard}`);
  else log(`NARRATION USAGE NOT READ: ${out.why} — ${dashboard}`);
  return { probe: false, queried, measured, complete: out.complete === true, why: out.why || "" };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.log(`NARRATION USAGE NOT READ: ${String((e && e.message) || e).slice(0, 200)}`); }).finally(() => process.exit(0));
}
