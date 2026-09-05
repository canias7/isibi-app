// STAGE 2a — THE SWEEP SETTLES A COMMITTED JOB, COUNTS ITS TRIES, AND PARKS
// ONE IT CANNOT SETTLE (2026-09-05, owner: "go").
//
// A job that died after `edit_committed` and before `edit_finalize` sat
// `publishing` with `published_at` set: the sweep's refund refused it as
// `published` (rightly — the change is live), the sweep counted that as lost,
// changed nothing, and selected the row again every two-minute tick. One of
// the batch's twenty slots held for ever, and a browser polling a 202 with no
// bound. The BEHAVIOUR is driven by scripts/edit-rpc-check.sql section 18
// against the live database — red at FAIL 65 against the old body (the live
// sweep answering {lost: 1, refunded: 0} for a committed row), 14 of 14 after
// the migration — which this suite cannot reach (no Postgres here, no mint
// key). What this file guards is the RECORD of it, and the two hops the check
// cannot see: the Worker reading the sweep's new counts, and the browser
// rendering the reply the sweep writes — a success whose details were lost,
// never a site untouched or money returned.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const DIR = new URL("../supabase/applied/", import.meta.url);
const FILE = fs.readdirSync(DIR).find((f) => /^\d{14}_sweep_finalizes_committed\.sql$/.test(f));
const RAW = FILE ? fs.readFileSync(new URL(FILE, DIR), "utf8") : "";
const SNAP = fs.readFileSync(new URL("20260901222000_live_snapshot_edit_rpcs.sql", DIR), "utf8");
const CHECK = fs.readFileSync(new URL("../scripts/edit-rpc-check.sql", import.meta.url), "utf8");
const WORKER = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const CHAT = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");

// SQL comments blanked line-wise, length-preserving: the migration explains at
// length what it refuses and names every branch it adds, and a scan that reads
// prose as SQL is the recorded trap.
const blankSql = (s) => s.replace(/^([ \t]*)--.*$/gm, (m) => " ".repeat(m.length));

/** JS comments blanked, length preserved and string-aware (the poll suite's own). */
function blankJs(src) {
  let out = ""; let i = 0; let inBlock = false; let quote = "";
  while (i < src.length) {
    const c = src[i]; const nx = src[i + 1];
    if (inBlock) { if (c === "*" && nx === "/") { out += "  "; i += 2; inBlock = false; continue; } out += c === "\n" ? "\n" : " "; i++; continue; }
    if (quote) { out += c; if (c === "\\") { out += nx === undefined ? "" : nx; i += 2; continue; } if (c === quote) quote = ""; i++; continue; }
    if (c === '"' || c === "'" || c === "`") { quote = c; out += c; i++; continue; }
    if (c === "/" && nx === "*") { out += "  "; i += 2; inBlock = true; continue; }
    if (c === "/" && nx === "/") { while (i < src.length && src[i] !== "\n") { out += " "; i++; } continue; }
    out += c; i++;
  }
  return out;
}

/** One function's CREATE statement, header to closing dollar quote, out of a file. */
function fnBlock(src, name) {
  const head = "CREATE OR REPLACE FUNCTION public." + name + "(";
  const at = src.indexOf(head);
  assert.ok(at >= 0, name + " is not defined in the file");
  const open = src.indexOf("AS $function$", at);
  const close = src.indexOf("$function$", open + "AS $function$".length);
  assert.ok(open > at && close > open, name + " has no dollar-quoted body");
  return src.slice(at, close + "$function$".length);
}

/** The next top-level declaration after `from` — the honest end of a function's window. */
function nextTop(src, from) {
  const re = /\n(?:export )?(?:async )?function |\n(?:export )?(?:const|let|class) /g;
  re.lastIndex = from;
  const m = re.exec(src);
  assert.ok(m, "no top-level declaration follows the window");
  return m.index;
}

test("the migration is in the applied folder, named for the remote history, and adds the counter", () => {
  assert.ok(FILE, "supabase/applied has no <version>_sweep_finalizes_committed.sql");
  assert.ok(RAW.length > 500, "the migration file is empty");
  const sql = blankSql(RAW);
  assert.match(sql, /alter table public\.edit_jobs add column if not exists sweep_tries integer not null default 0;/,
    "the migration does not add sweep_tries as a non-null integer defaulting to 0");
});

test("the sweep finalizes a committed job with a reply the poll route can serve", () => {
  const b = blankSql(fnBlock(RAW, "edit_sweep_lost"));
  // THE BRANCH IS ON THE REFUND'S OWN ANSWER — `published` is what edit_refund
  // says of a row whose published_at is set, and until this it fell to the
  // else branch and was counted as lost.
  const pub = b.indexOf("(res->>'error') = 'published'");
  const fin = b.indexOf("public.edit_finalize(r.id");
  assert.ok(pub > 0 && fin > pub, "the published branch does not finalize the row");
  // THE STORED SHAPE IS THE CONSUMER'S: {status, type, body}, the body as TEXT.
  // The poll route serves a terminal row's reply only when `res.body` is a
  // string (worker.js, the edit poll), so a body stored as an object would be
  // a finalized job the browser polls for ever.
  assert.match(b, /'status', 200, 'type', 'application\/json',/, "the reply's status or type moved");
  assert.match(b, /'body', jsonb_build_object\('ok', true, 'recovered', true, 'job', r\.id,\s+'cost', r\.cost, 'build', r\.artifact_build\)::text\)/,
    "the body is not the recovered success as text");
  // AS AN OK ANSWER (p_ok true), so the four-argument finalize takes it.
  assert.match(b, /::text\),\s+true, p_mint\)/, "the finalize is not asked as an ok answer");
  // COUNTED AS RECOVERED, and lost only when the refund really answered ok.
  assert.match(b, /if \(res->>'ok'\) = 'true' then n_recovered := n_recovered \+ 1;/, "a recovered job is not counted");
  assert.match(b, /elsif \(res->>'ok'\) = 'true' then\s+n_lost := n_lost \+ 1;/, "lost is counted without the refund's ok");
  assert.match(b, /'recovered', n_recovered,\s+'exhausted', n_exhausted, 'stuck', n_stuck, 'refunded', refunded/,
    "the answer does not carry every count");
  // AND NO MONEY MOVES IN THAT BRANCH: finalize keeps the reserve for work that is live.
  const branch = b.slice(pub, b.indexOf("elsif", pub));
  assert.doesNotMatch(branch, /public\.credits|credit_events|edit_refund/, "the recovered branch touches the ledger");
});

test("every attempt is counted before the refund, and five park the row before a sixth", () => {
  const b = blankSql(fnBlock(RAW, "edit_sweep_lost"));
  const park = b.indexOf("if r.sweep_tries >= 5 then");
  const count = b.indexOf("set sweep_tries = sweep_tries + 1");
  const refund = b.indexOf("public.edit_refund(r.id, 'lost'");
  assert.ok(park > 0 && count > park && refund > count, "park, count and refund are not in that order");
  assert.match(b, /select id, cost, artifact_build, sweep_tries from public\.edit_jobs/, "the batch does not carry the counter");
  const skip = b.indexOf("continue;", park);
  assert.ok(skip > park && skip < count, "a parked row is still attempted");
  const parkBlock = b.slice(park, skip);
  assert.match(parkBlock, /set needs_review = true, review_note = 'sweep exhausted'/, "the park does not put the row in review with its note");
  // THE SWEEP'S OWN CONDITIONS, ASKED AGAIN AT THE WRITE, so a row another
  // caller moved since the select is left alone — and counted only when found.
  assert.match(parkBlock, /where id = r\.id and needs_review = false\s+and state not in \('done','failed','cancelled','lost'\)\s+and lease_expires_at < now\(\) - make_interval\(secs => p_grace\);/,
    "the park is unconditional");
  assert.match(parkBlock, /if found then n_exhausted := n_exhausted \+ 1; end if;/, "an exhausted row is counted whether or not it was parked");
  assert.doesNotMatch(parkBlock, /public\.credits|credit_events|edit_refund|edit_finalize/, "the park moves money or settles the row");
  // A REFUSAL WITH NO BRANCH IS COUNTED, not dropped.
  assert.match(b, /else\s+n_stuck := n_stuck \+ 1;\s+end if;\s+end loop;/, "a refusal with no branch is not counted as stuck");
});

test("the live snapshot's read-back matches the migration byte for byte", () => {
  // pg_get_functiondef keeps a body verbatim and prints the header in one
  // layout; the migration is written in that layout, so the two must be equal
  // — a difference is a hand edit to the folder or a live function that is
  // not what the folder says.
  assert.equal(fnBlock(SNAP, "edit_sweep_lost"), fnBlock(RAW, "edit_sweep_lost"),
    "the snapshot (the database's own answer) differs from the migration");
  assert.match(SNAP, /edit_sweep_lost REPLACED IN PLACE \(stage 2a/, "the snapshot's header does not say the sweep was replaced");
});

test("the function stays service_role only", () => {
  const sql = blankSql(RAW);
  assert.ok(sql.includes("revoke all on function public.edit_sweep_lost(integer, integer, text) from public, anon, authenticated;"),
    "the sweep is not revoked from the client roles");
  assert.ok(sql.includes("grant execute on function public.edit_sweep_lost(integer, integer, text) to service_role;"),
    "the sweep is not granted to service_role");
});

test("the check drives it: a committed row, a parked row, a row under the ceiling", () => {
  const s18 = CHECK.indexOf("18. THE SWEEP SETTLES A COMMITTED JOB");
  const restore = CHECK.indexOf("update private.mint set key_hash = keep;");
  assert.ok(s18 > 0 && restore > s18, "section 18 is gone, or sits after the mint restore");
  const sec = CHECK.slice(s18, restore);
  // THE COMMITTED ROW: committed, lease run out, swept — recovered, money
  // untouched, done and finalized, the reply readable as the poll route
  // reads it, and not swept again.
  assert.match(sec, /public\.edit_committed\(j10/, "no row is committed before the sweep");
  assert.match(sec, /coalesce\(\(r->>'recovered'\)::int, 0\) < 1 then raise exception 'FAIL 65 /, "the recovered count is not checked");
  assert.match(sec, /b1 <> b0 then raise exception 'FAIL 65c/, "the balance is not read across the recovery");
  assert.match(sec, /\(\(rs->>'body'\)::jsonb->>'recovered'\) is distinct from 'true'/, "the stored reply is not read back");
  assert.match(sec, /'FAIL 66 \(a finalized job was swept again\)/, "the second sweep is not checked");
  // THE PARKED ROW: five tries set by hand, exhausted, in review with its
  // note, money untouched, left alone by the next tick, still reconcilable.
  assert.match(sec, /set sweep_tries = 5/, "no row is put at the ceiling");
  assert.match(sec, /coalesce\(\(r->>'exhausted'\)::int, 0\) < 1 then raise exception 'FAIL 67 /, "the exhausted count is not checked");
  assert.match(sec, /note is distinct from 'sweep exhausted'/, "the review note is not checked");
  assert.match(sec, /'FAIL 67c \(parking moved money\)/, "the balance is not read across the park");
  assert.match(sec, /public\.edit_reconcile\(j11, false/, "the parked row is not reconciled");
  // THE CONTROL: four tries is settled, not parked — without it a sweep that
  // parked everything would pass the half above.
  assert.match(sec, /set sweep_tries = 4/, "no row sits under the ceiling");
  assert.match(sec, /'FAIL 69 \(a row under the ceiling was parked instead of settled\)/, "the control is gone");
});

test("the Worker logs the sweep's new counts", () => {
  const open = WORKER.indexOf("async function runLostEditJobs(env)");
  assert.ok(open > 0, "runLostEditJobs is gone");
  const fn = blankJs(WORKER.slice(open, nextTop(WORKER, open + 1)));
  assert.ok(fn.length > 200, "the runLostEditJobs window came out empty");
  assert.match(fn, /edit_sweep_lost/, "the cron no longer calls the sweep");
  assert.match(fn, /p_grace: STALE_GRACE_S/, "the grace is no longer the module's constant");
  for (const k of ["recovered", "exhausted", "stuck"]) {
    assert.match(fn, new RegExp(k + ": r && r\\." + k), `the log drops ${k}`);
  }
  // PRINTED WHEN ANY COUNT IS POSITIVE — a recovered job on a tick with
  // nothing lost must still leave a line.
  assert.match(fn, /Object\.values\(counts\)\.some\(/, "the log is gated on lost and review alone");
});

test("both readers answer the sweep's reply before they say what the change did", () => {
  const C = blankJs(CHAT);
  for (const [name, next] of [["function editReply(", "if (e.layer === 'text')"], ["function addonReplyText(", "const added = "]]) {
    const at = C.indexOf(name);
    assert.ok(at > 0, name + " is gone");
    const ask = C.indexOf("EditPoll.isRecovered(", at);
    const first = C.indexOf(next, at);
    assert.ok(ask > at && first > at && ask < first, name + " reads the reply before asking whether it is the sweep's");
    const line = C.slice(ask, C.indexOf("\n", ask));
    assert.match(line, /return EditPoll\.outcomeMessage\('recovered'\)/, name + " does not answer with the recovered sentence");
  }
  // AND THE SENTENCE IS THE POLL MODULE'S, so it is driven there (test/edit-poll.test.mjs), not read here.
  assert.equal((C.match(/outcomeMessage\('recovered'\)/g) || []).length, 2, "the recovered sentence is answered somewhere else too, or nowhere");
});
