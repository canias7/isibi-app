// STAGE 2c — A BUILD GETS A ROW, AND ONE LEASE MOVES ALONG ITS CHAIN
// (2026-09-05, owner: "go").
//
// A build had an R2 record with an etag claim and charge marks and nothing
// else: no row, no lease, no heartbeat, no sweep. A consumer evicted
// mid-design (run 17's shape) or a resume chain the queue stopped delivering
// (run 41) left the customer with the stand-in page and a browser polling
// `pending` until its own twenty-minute bound. Now the route files a row in
// `edit_jobs` (op `build`, billed `external`), the consumer claims and beats
// through the design, the fire HANDS the lease to the container that
// generates, the container beats and its report RELEASES it, the collector
// claims or takes it over by name, and the sweep marks a chain nobody renews
// `lost` with nothing moved — so the poll route can say so.
//
// THE DATABASE HALF IS DRIVEN by scripts/edit-rpc-check.sql section 19 against
// the live database — red at FAIL 70 against the old edit_create (a build row
// billed `none`), 21 of 21 after the migration, 113 of 113 whole — which this
// suite cannot reach (no Postgres here, no mint key). What this file guards is
// the RECORD of that, the vocabulary both ends of the chain share, and every
// hop the check cannot see: the route filing the row, the consumer's claim and
// beat and handoff, the container's beat and its report's binding, the
// collector's takeover, and the poll route's verdict — read where a read is
// honest, DRIVEN where the branch can be driven.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { hit, loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import {
  BUILD_OP, BUILD_BILLING, GENERATING, HANDOFF_TTL_S, RELEASE_TTL_S, CONTAINER_BEAT_TTL_S, GEN_BEAT_MS, MIN_GEN_BEAT_MS,
  containerOwner, buildRowSlug, cleanBuildSlug, isRowSlug, buildOutcome, rowVerdict, genBound,
  LOST_SITE_MSG, LOST_MSG, FAILED_MSG, CANCELLED_MSG, COLLECTED_MSG,
} from "../builder/build-lease.mjs";
import { MAX_BUSY_HOLD_MS } from "../builder/container-hold.mjs";
import { RESUME_POLL_SECONDS, packResume, resumeKey, genKey } from "../builder/build-resume.mjs";
import { STALE_GRACE_S, LEASE_TTL_S, EDIT_PHASES } from "../builder/edit-job.mjs";
import { jobKey, resultKey, packJob, JOB_KIND } from "../builder/build-job.mjs";

const DIR = new URL("../supabase/applied/", import.meta.url);
const FILE = fs.readdirSync(DIR).find((f) => /^\d{14}_build_rows_lease_chain\.sql$/.test(f));
const MIG = FILE ? fs.readFileSync(new URL(FILE, DIR), "utf8") : "";
const SNAP = fs.readFileSync(new URL("20260901222000_live_snapshot_edit_rpcs.sql", DIR), "utf8");
const CHECK = fs.readFileSync(new URL("../scripts/edit-rpc-check.sql", import.meta.url), "utf8");
const RAW = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const SERVER_RAW = fs.readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8");
const CHAT_RAW = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
const DOCKERFILE = fs.readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");

// SQL comments blanked line-wise, length-preserving.
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
const W = blankJs(RAW);
const SERVER = blankJs(SERVER_RAW);
const CHAT = blankJs(CHAT_RAW);
assert.equal(W.length, RAW.length, "the blanker changed worker.js's length");

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

/** The named top-level function of worker.js, bounded by the NEXT top-level declaration. */
function fnW(name) {
  let at = W.indexOf(`\nasync function ${name}(`);
  if (at < 0) at = W.indexOf(`\nfunction ${name}(`);
  assert.ok(at > 0, name + " is gone from worker.js — rescope this guard");
  const re = /\n(?:export )?(?:async )?function |\n(?:export )?(?:const|let|class) /g;
  re.lastIndex = at + 1;
  const m = re.exec(W);
  const body = W.slice(at, m ? m.index : W.length);
  assert.ok(body.length > 200, `the window on ${name} is ${body.length} characters — this guard would be vacuous`);
  return body;
}

/** A route's block, from its dispatch line to the next dispatch. */
function routeBlock(dispatch) {
  const at = W.indexOf(dispatch);
  assert.ok(at > 0, dispatch + " is gone from the router");
  const rest = W.slice(at + 1);
  const next = rest.search(/\n\s{4}if \(\(?url\.pathname/);
  assert.ok(next > 0, "the next route matcher is gone — this window has no end");
  const block = W.slice(at, at + 1 + next);
  assert.ok(block.length > 300, "the route window is too small to prove anything");
  return block;
}

/** Where the bracket opened at `from` closes. */
function close(src, from) {
  let d = 0;
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (c === "(" || c === "{" || c === "[") d++;
    else if (c === ")" || c === "}" || c === "]") { d--; if (!d) return i + 1; }
  }
  assert.fail("a bracket opened and never closed");
}

const JOB = "fedcba9876543210fedcba9876543210";
const TOKEN = "0123456789abcdef0123456789abcdef";

// ── THE VOCABULARY ───────────────────────────────────────────────────────────

test("every number is derived from the bound it rests on, and sits inside the RPCs' own caps", () => {
  // THE HANDOFF IS THE GENERATION BOUND, the container's own ceiling on a
  // busy hold — derived, so the two cannot drift.
  assert.equal(HANDOFF_TTL_S, Math.round(MAX_BUSY_HOLD_MS / 1000));
  // …AND INSIDE edit_handoff's cap, read off the migration rather than assumed.
  const capH = /p_ttl > (\d+) then raise exception 'bad ttl'/.exec(blankSql(fnBlock(MIG, "edit_handoff")));
  assert.ok(capH, "edit_handoff no longer caps its TTL");
  assert.ok(HANDOFF_TTL_S <= Number(capH[1]), `the handoff asks for ${HANDOFF_TTL_S}s and the RPC refuses past ${capH[1]}`);
  // THE CONTAINER'S BEAT RIDES edit_beat, whose cap is the live snapshot's.
  const capB = /p_ttl > (\d+) then raise exception 'bad ttl'/.exec(blankSql(fnBlock(SNAP, "edit_beat")));
  assert.ok(capB, "edit_beat no longer caps its TTL");
  assert.ok(CONTAINER_BEAT_TTL_S <= Number(capB[1]), `the container beats for ${CONTAINER_BEAT_TTL_S}s and edit_beat refuses past ${capB[1]}`);
  // A MISSED BEAT NEVER EXPIRES THE LEASE: two cadences fit inside one TTL.
  assert.ok(GEN_BEAT_MS * 2 <= CONTAINER_BEAT_TTL_S * 1000, "one missed beat would let the container's lease expire");
  assert.ok(GEN_BEAT_MS >= MIN_GEN_BEAT_MS, "the default cadence is under its own floor");
  // THE RELEASE OUTLASTS THREE MISSED LOOKS AND THE SWEEP'S GRACE — a slow
  // queue must not turn a finishing build into a lost one — and never the
  // handoff itself.
  assert.ok(RELEASE_TTL_S >= 3 * RESUME_POLL_SECONDS + STALE_GRACE_S, "a released lease can be swept before the collector's next look");
  assert.ok(RELEASE_TTL_S < HANDOFF_TTL_S, "a release is not shorter than the hold it ends");
  // AND THE CONTAINER'S FLOOR IS THE WORKER'S, spelled once on each side.
  const floor = /const GEN_BEAT_FLOOR_MS = ([\d_]+);/.exec(SERVER);
  assert.ok(floor, "the container has no beat floor");
  assert.equal(Number(floor[1].replace(/_/g, "")), MIN_GEN_BEAT_MS, "the container's beat floor and the Worker's MIN_GEN_BEAT_MS disagree");
  assert.equal(BUILD_OP, "build");
  assert.equal(BUILD_BILLING, "external");
  assert.equal(GENERATING, "generating");
  assert.ok(EDIT_PHASES.includes(GENERATING), "the module's state list does not know `generating`");
});

test("the container's lease name is its own generation id, and a bad one is refused", () => {
  assert.equal(containerOwner("gen-1"), "container:gen-1");
  for (const bad of ["", null, undefined, 7, ["gen-1"], "x".repeat(81)]) {
    assert.throws(() => containerOwner(bad), /not a generation id/, `accepted ${JSON.stringify(bad)}`);
  }
});

test("a row is filed under the site's slug when the body names one, and under a placeholder no site can be otherwise", () => {
  assert.equal(buildRowSlug("fold-lane", JOB), "fold-lane");
  // CLEANED THE WAY THE ROUTE CLEANS, character for character.
  assert.equal(buildRowSlug("Fold Lane!", JOB), "foldlane");
  assert.equal(buildRowSlug("--x--", JOB), "x");
  for (const none of ["", "   ", null, undefined, 5, ["fold-lane"], "!!!"]) {
    assert.equal(buildRowSlug(none, JOB), "build:" + JOB, `${JSON.stringify(none)} did not fall to the placeholder`);
  }
  assert.throws(() => buildRowSlug("", "not-a-job"), /did not mint/);
  // THE PLACEHOLDER IS NOT A SLUG, so nothing reads it as a site.
  assert.equal(isRowSlug("build:" + JOB), false);
  assert.equal(isRowSlug("fold-lane"), true);
  assert.equal(isRowSlug(""), false);
  assert.equal(isRowSlug(["fold-lane"]), false, "a one-element array is not a slug");
  // NEVER THE EMPTY STRING: a build row parked under '' would refuse every
  // first build on the platform, matched by equality in edit_create.
  assert.notEqual(buildRowSlug("", JOB), "");
  // THE CLEANER IS THE ROUTE'S OWN, held equal as TEXT: the route's
  // `cleanSlug` is a local of runSiteBuild and cannot be handed over.
  const route = /const cleanSlug = \(v\) => (.+);/.exec(W);
  assert.ok(route, "the build route no longer defines cleanSlug inline");
  const mod = /return (.+);\n\}/.exec(blankJs(fs.readFileSync(new URL("../builder/build-lease.mjs", import.meta.url), "utf8")).slice(
    blankJs(fs.readFileSync(new URL("../builder/build-lease.mjs", import.meta.url), "utf8")).indexOf("export function cleanBuildSlug(v) {")));
  assert.ok(mod, "cleanBuildSlug has no return to compare");
  assert.equal(mod[1], route[1], "cleanBuildSlug and the route's cleanSlug have drifted apart");
  assert.equal(cleanBuildSlug("  Déjà-Vu Café "), "dj-vucaf");
});

test("what a build's answer means for its row: resuming, done, failed — a refusal is failed, never done", () => {
  assert.equal(buildOutcome(202, { ok: false, stage: "resuming", job: JOB }), "resuming");
  assert.equal(buildOutcome(200, { ok: true, slug: "fold-lane", page: "app" }), "done");
  assert.equal(buildOutcome(200, { ok: true, page: "placeholder" }), "done");
  assert.equal(buildOutcome(200, { ok: false, error: "x" }), "failed", "an ok:false answer read as done");
  // ONLY THE STAGE WORD MAKES A 202 A FIRE: without it a 202 is an answer,
  // read like any other — ok is done, ok:false is failed.
  assert.equal(buildOutcome(202, { ok: true }), "done", "a 202 without the resuming stage is an answered build");
  assert.equal(buildOutcome(202, { ok: false }), "failed", "a 202 without the resuming stage and ok:false is a refusal");
  for (const st of [402, 409, 429, 500, 501, 503]) assert.equal(buildOutcome(st, { ok: false }), "failed", `${st} read as done`);
  assert.equal(buildOutcome(NaN, null), "failed");
  assert.equal(buildOutcome("200", null), "done");
});

test("the poll route's verdict off a row: lost with a claimed slug is shaped as a placeholder build, everything else terminal is 410, in flight is null", () => {
  const lost = rowVerdict({ state: "lost", slug: "fold-lane", job: JOB });
  assert.equal(lost.status, 200);
  assert.deepEqual(lost.body, { ok: false, lost: true, stage: "queue", job: JOB, slug: "fold-lane", page: "placeholder", error: "the build was lost", notes: LOST_SITE_MSG, msg: LOST_SITE_MSG });
  // THE PLACEHOLDER SLUG IS NOT A SITE: nothing was claimed, so nothing is recorded.
  const bare = rowVerdict({ state: "lost", slug: "build:" + JOB, job: JOB });
  assert.equal(bare.status, 410);
  assert.deepEqual(bare.body, { ok: false, lost: true, stage: "queue", job: JOB, msg: LOST_MSG });
  assert.equal(rowVerdict({ state: "lost", slug: ["fold-lane"], job: JOB }).status, 410, "a one-element array read as a slug");
  assert.deepEqual(rowVerdict({ state: "failed", slug: "fold-lane", job: JOB }), { status: 410, body: { ok: false, failed: true, stage: "queue", job: JOB, msg: FAILED_MSG } });
  assert.deepEqual(rowVerdict({ state: "cancelled", job: JOB }), { status: 410, body: { ok: false, cancelled: true, stage: "queue", job: JOB, msg: CANCELLED_MSG } });
  assert.deepEqual(rowVerdict({ state: "done", job: JOB }), { status: 410, body: { ok: false, collected: true, stage: "queue", job: JOB, msg: COLLECTED_MSG } });
  for (const st of ["queued", "claimed", "generating", "routing", "", undefined, ["lost"]]) {
    assert.equal(rowVerdict({ state: st, slug: "fold-lane", job: JOB }), null, `${JSON.stringify(st)} read as terminal`);
  }
  for (const junk of [null, undefined, "lost", [], 3]) assert.equal(rowVerdict(junk), null);
  // THE SENTENCES SAY WHAT IS TRUE OF THE MONEY AND THE SITE.
  assert.match(LOST_SITE_MSG, /stand-in page at your address/);
  assert.match(LOST_SITE_MSG, /weren't charged for the pages/);
  assert.doesNotMatch(LOST_MSG, /address/, "a build that claimed nothing must not promise a page at an address");
});

test("…and that shape is exactly what the browser's success gate records and renders", () => {
  // The browser: `r.ok && d && d.error !== true && d.slug` enters the block
  // that RECORDS the slug (claimed, the stand-in live at it); `page ===
  // 'placeholder'` picks the ⚠️ sentence; `notes` is what it says. Read
  // off chat.js so a gate that moves takes this shape with it.
  const at = CHAT.indexOf("apiFetch(endpoint,");
  assert.ok(at > 0, "the build POST is gone — rescope this guard");
  const send = CHAT.slice(at, CHAT.indexOf("\n}", at));
  assert.match(send, /if \(r\.ok && d && d\.error !== true && d\.slug\) \{/, "the browser's success gate moved — the lost verdict's shape rests on it");
  assert.match(send, /const built = !d \|\| d\.page !== 'placeholder';/, "the browser no longer reads `page` to pick the ⚠️ sentence");
  assert.match(send, /const said = \(d && typeof d\.notes === 'string'\) \? d\.notes\.trim\(\) : '';/, "the browser no longer renders `notes`");
  const lost = rowVerdict({ state: "lost", slug: "fold-lane", job: JOB }).body;
  assert.equal(lost.ok, false); assert.equal(typeof lost.error, "string"); assert.ok(lost.slug); assert.equal(lost.page, "placeholder"); assert.equal(lost.notes, LOST_SITE_MSG);
  // AND THE FOLLOWER HANDS BACK ANY ANSWER THAT IS NOT 202 OR 503 — a 410
  // reaches the branches below it, where `d.msg` is rendered.
  const follow = CHAT.slice(CHAT.indexOf("async function followBuildJob("), CHAT.indexOf("\n}", CHAT.indexOf("async function followBuildJob(")));
  assert.match(follow, /if \(r\.status === 202\) \{ bad = 0; continue; \}/);
  assert.match(follow, /return \{ r, d \};/, "the follower no longer hands the answer back");
});

test("a beat or a report binds to the build only through the record's own token and generation", () => {
  const rec = { report: TOKEN, genId: "gen-1" };
  assert.equal(genBound(rec, TOKEN, "gen-1"), true);
  assert.equal(genBound(rec, TOKEN, "gen-2"), false, "another generation's container renewed the lease");
  assert.equal(genBound(rec, "f".repeat(32), "gen-1"), false, "a wrong token bound");
  assert.equal(genBound(null, TOKEN, "gen-1"), false, "no record bound");
  assert.equal(genBound({ report: "", genId: "gen-1" }, "", "gen-1"), false, "an empty token bound to a record with no token");
  assert.equal(genBound(rec, TOKEN, ["gen-1"]), false);
});

// ── THE MIGRATION AND THE SNAPSHOT ───────────────────────────────────────────

test("the migration is in the applied folder, named for the remote history, and widens the two constraints", () => {
  assert.ok(FILE, "supabase/applied has no <version>_build_rows_lease_chain.sql");
  assert.match(MIG, /Applied 2026-09-05 as remote version 20260905190147/, "the file does not say which remote version it is");
  const sql = blankSql(MIG);
  const state = /add constraint edit_jobs_state_ck check \(state in \(([\s\S]*?)\)\)/.exec(sql);
  assert.ok(state, "the state CHECK is not redefined");
  const states = [...state[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
  assert.ok(states.includes("generating"), "the state CHECK does not admit generating");
  assert.deepEqual(states.filter((s) => s !== "generating").sort(),
    ["queued", "claimed", "routing", "editing", "building", "verifying", "correcting", "rebuilding", "publishing", "done", "failed", "cancelled", "lost"].sort(),
    "the state CHECK lost or gained a value beside generating");
  const billing = /add constraint edit_jobs_billing_ck check \(billing in \(([\s\S]*?)\)\)/.exec(sql);
  assert.ok(billing, "the billing CHECK is not redefined");
  assert.deepEqual([...billing[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]).sort(), ["none", "reserved", "finalized", "refunded", "exempt", "external"].sort());
  // DROPPED BEFORE ADDED, each — a second constraint of the same name is an error.
  for (const ck of ["edit_jobs_state_ck", "edit_jobs_billing_ck"]) {
    assert.ok(sql.indexOf(`drop constraint ${ck}`) > 0 && sql.indexOf(`drop constraint ${ck}`) < sql.indexOf(`add constraint ${ck}`), ck + " is not dropped before it is added");
  }
});

test("edit_create bills a row external from its op alone, and edit_handoff moves the lease for its holder only", () => {
  const create = blankSql(fnBlock(MIG, "edit_create"));
  assert.match(create, /insert into public\.edit_jobs \(id, uid, slug, op, idem_key, billing\)\s+values \(p_id, p_uid, p_slug, p_op, p_idem, case when p_op = 'build' then 'external' else 'none' end\)/,
    "the billing is not decided from the op at the insert");
  assert.doesNotMatch(create, /p_billing/, "the billing is a caller's parameter — a caller could file a build under a reserve");
  // THE REST OF edit_create IS THE LIVE BODY IT WAS: the review wall and the
  // key's shape unchanged.
  assert.match(create, /where slug = p_slug and needs_review limit 1/);
  assert.match(create, /p_idem !~ '\^\[A-Za-z0-9_-\]\{16,64\}\$'/);

  const h = blankSql(fnBlock(MIG, "edit_handoff"));
  assert.match(h, /edit_handoff\(p_id text, p_owner text, p_next text, p_ttl integer, p_state text, p_slug text, p_mint text\)/);
  assert.match(h, /if not private\.mint_ok\(p_mint\) then raise exception 'bad key'; end if;/);
  assert.match(h, /p_ttl < 10 or p_ttl > 3600/, "the TTL is not bounded at an hour");
  // HOLDER ONLY, LIVE ROWS ONLY, NEVER UNDER REVIEW.
  assert.match(h, /where id = p_id and lease_owner = p_owner\s+and state not in \('done','failed','cancelled','lost'\)\s+and needs_review = false/,
    "the handoff is not confined to the holder of a live, unreviewed row");
  // A RELEASE KEEPS THE OWNER; the state and the slug move only when named.
  assert.match(h, /lease_owner = coalesce\(p_next, lease_owner\)/);
  assert.match(h, /lease_expires_at = now\(\) \+ make_interval\(secs => p_ttl\)/);
  assert.match(h, /state = coalesce\(p_state, state\)/);
  assert.match(h, /slug = coalesce\(nullif\(p_slug, ''\), slug\)/);
  // REFUSALS NAMED, as edit_claim names them.
  assert.match(h, /when j\.needs_review then 'needs-review'\s+when j\.state in \('done','failed','cancelled','lost'\) then 'terminal'\s+else 'not-holder' end/);
  assert.doesNotMatch(h, /public\.credits|credit_events/, "the handoff touches the ledger");
  // SERVICE-ROLE ONLY.
  const sql = blankSql(MIG);
  assert.ok(sql.includes("revoke all on function public.edit_handoff(text, text, text, integer, text, text, text) from public, anon, authenticated;"));
  assert.ok(sql.includes("grant execute on function public.edit_handoff(text, text, text, integer, text, text, text) to service_role;"));
});

test("the live snapshot's read-back matches the migration byte for byte, for both functions", () => {
  assert.equal(fnBlock(SNAP, "edit_create"), fnBlock(MIG, "edit_create"), "the snapshot's edit_create differs from the migration");
  // RE-ANCHORED 2026-09-05 (stage 6): this pinned the snapshot's edit_handoff
  // to THIS migration's, and stage 6 replaced it in place (the row's uid on
  // the success answer, for the job runner's takeover by name). The property
  // is that the snapshot carries the NEWEST applied definition of it — found
  // by version, never by name — and that this migration's is the one it
  // started from, save the lines a later stage added.
  const defs = fs.readdirSync(DIR).filter((f) => /^\d{14}_.+\.sql$/.test(f) && !/live_snapshot/.test(f) && fs.readFileSync(new URL(f, DIR), "utf8").includes("CREATE OR REPLACE FUNCTION public.edit_handoff(")).sort();
  assert.ok(defs.length >= 2 && defs[0] === FILE, "edit_handoff's birth migration is not the oldest that defines it: " + defs.join(", "));
  const newest = fs.readFileSync(new URL(defs[defs.length - 1], DIR), "utf8");
  assert.equal(fnBlock(SNAP, "edit_handoff"), fnBlock(newest, "edit_handoff"), "the snapshot's edit_handoff differs from the newest migration that defines it (" + defs[defs.length - 1] + ")");
  const born = blankSql(fnBlock(MIG, "edit_handoff")).split("\n").filter((l) => l.trim()).map((l) => l.trim());
  const now = blankSql(fnBlock(SNAP, "edit_handoff")).split("\n").filter((l) => l.trim()).map((l) => l.trim());
  const dropped = born.filter((l) => !now.includes(l) && !/^return jsonb_build_object\('ok', true, 'state', j\.state, 'owner', j\.lease_owner, 'slug', j\.slug,$/.test(l) && !/^'expires', j\.lease_expires_at\);$/.test(l));
  assert.deepEqual(dropped, [], "a later stage took lines out of edit_handoff's birth body rather than adding to it");
  assert.match(SNAP, /edit_create REPLACED IN PLACE and edit_handoff ADDED/, "the snapshot's header does not record the change");
  // THE SWEEP IS UNTOUCHED: a build row falls into its own `lost` branch,
  // with `external` billing moving nothing in edit_refund.
  const refund = blankSql(fnBlock(SNAP, "edit_refund"));
  assert.match(refund, /if j\.billing = 'reserved' then/, "the refund no longer refunds reserved alone — external would move money");
});

test("the check drives the chain: filed external with an edit as the control, claimed, handed off, refused for a stranger, beaten by the container, released, taken over, swept both ways, finished", () => {
  const s19 = CHECK.indexOf("19. A BUILD'S ROW: ONE LEASE ALONG THE CHAIN");
  const restore = CHECK.indexOf("update private.mint set key_hash = keep;");
  assert.ok(s19 > 0 && restore > s19, "section 19 is gone, or sits after the mint restore");
  const sec = CHECK.slice(s19, restore);
  const order = [
    "public.edit_create(j13, u, 'build:'||j13, 'build'",
    "'FAIL 70 (a build row is not billed external",
    "'FAIL 70b (an edit row is no longer billed none)",
    "public.edit_claim(j13, 'consumerMMMM', 90, k)",
    "public.edit_handoff(j13, 'consumerMMMM', 'container:gen-1', 1800, 'generating'",
    "'FAIL 72c (the handoff expiry is not the generation bound)",
    // THE STRANGER'S CALL ITSELF, and its named refusal — not only the
    // message. The sweep cut the call and left the second `FAIL 72d` line
    // (the owner read back unchanged), which passes trivially when nobody
    // tried to move it; a guard reading the message alone survived that.
    "public.edit_handoff(j13, 'strangerNNNN', 'container:gen-9', 1800, 'generating', null, k)",
    "(r->>'error') <> 'not-holder' then raise exception 'FAIL 72d (a stranger moved the lease)",
    "'FAIL 72e (the old holder still renews a handed-off lease)",
    "public.edit_beat(j13, 'container:gen-1', 600, null, k)",
    "public.edit_handoff(j13, 'container:gen-1', null, 300, null, null, k)",
    "'FAIL 74b (the release did not keep the owner and shorten the lease)",
    "public.edit_handoff(j13, 'container:gen-1', 'resumeOOOO', 90, null, null, k)",
    "'FAIL 76 (the sweep took a build whose lease is live)",
    "'FAIL 77 (a lost build moved money, or was not marked lost)",
    "'FAIL 77b (a lost build was finalized afterwards)",
    "'FAIL 78 (a finished build is not done and external with money untouched)",
    "'FAIL 79 (the state constraint does not admit generating)",
    "'FAIL 79b (the billing constraint does not admit external)",
  ];
  let last = -1;
  for (const step of order) {
    const at = sec.indexOf(step);
    assert.ok(at > last, `section 19 is missing or reorders: ${step}`);
    last = at;
  }
  // THE BALANCE IS READ ACROSS THE LOST SWEEP AND THE HAPPY CHAIN.
  assert.match(sec, /b1 <> b0 or coalesce\(\(r->>'refunded'\)::numeric, 0\) <> 0 then raise exception 'FAIL 77/);
  assert.match(sec, /ok_count := ok_count \+ 21;/);
  assert.match(CHECK, /LAST RUN 2026-09-05 \(stage 2c\): ALL 113 CHECKS PASSED/, "the header does not record the run");
});

// ── THE WORKER: THE ROUTE FILES THE ROW ──────────────────────────────────────

test("the build route files the row before the object and the message, under op build, keyed by the job id, and never refuses over it", () => {
  const fn = fnW("enqueueSiteBuild");
  const mint = fn.indexOf("const id = newJobId(");
  const filed = fn.indexOf('await editRpc(env, "edit_create", {');
  const put = fn.indexOf("SITES_BUCKET.put(jobKey(id)");
  const send = fn.indexOf("BUILD_QUEUE.send({ kind: JOB_KIND, id })");
  assert.ok(mint > 0 && filed > mint && put > filed && send > put, "the row is not filed between the id and the object");
  const args = fn.slice(filed, close(fn, fn.indexOf("{", filed)));
  assert.match(args, /p_op: BUILD_OP/, "the row is not filed under the build op");
  assert.match(args, /p_idem: id\b/, "the idempotency key is not the job id");
  assert.match(args, /p_slug: buildRowSlug\(rb\.body && rb\.body\.slug, id\)/, "the slug is not the body's, cleaned, or the placeholder");
  assert.match(args, /p_uid: bu\.id/, "the row is not the caller's");
  // A REFUSED CREATE DOES NOT RETURN: the build runs without a row.
  assert.doesNotMatch(fn.slice(filed, put), /\breturn\b/, "a refused row stops the build");
  assert.match(fn, /const hasRow = !!\(filed && filed\.ok === true && filed\.duplicate !== true\);/);
  // AND BOTH FALL-THROUGHS CLOSE THE ROW THEY FILED, so a queued row nobody
  // will claim — no lease, never swept — does not sit for ever.
  const closes = [...fn.matchAll(/if \(hasRow\) await closeBuildRow\(env, id, "failed", "([^"]+)"\);/g)].map((m) => m[1]);
  assert.deepEqual(closes, ["could not store the job", "could not enqueue"], "a fall-through leaves its queued row behind");
  // THE AUTH GATE STILL COMES FIRST: nothing is filed for a stranger.
  assert.ok(fn.indexOf("if (!bu) return") > 0 && fn.indexOf("if (!bu) return") < filed, "a row is filed before the caller is authenticated");
});

test("the POST's own wait asks the row every tenth look, and answers its verdict", () => {
  const fn = fnW("awaitJobResult");
  assert.match(fn, /if \(attempt % 10 === 9\) \{\s+const rs = await buildRowStatus\(env, id, uid\);\s+if \(rs && rs\.verdict\) return Response\.json\(rs\.verdict\.body, \{ status: rs\.verdict\.status \}\);/,
    "the wait does not read the row, or reads it on every look");
  // AFTER THE OBJECT, BEFORE THE SLEEP: the answer object is still the reply.
  const obj = fn.indexOf("await env.SITES_BUCKET.get(resultKey(id))");
  const row = fn.indexOf("buildRowStatus(env, id, uid)");
  const sleep = fn.indexOf("pollDelayMs(attempt)");
  assert.ok(obj > 0 && row > obj && sleep > row, "the row is read before the answer object, or after the sleep");
});

// ── THE WORKER: THE CONSUMER, THE FIRE, THE COLLECTOR ────────────────────────

test("the consumer claims after the object, beats while it works, hands its name to the build, stops the beat on every exit, and closes the row after the answer", () => {
  const fn = fnW("runQueuedSiteBuild");
  const del = fn.indexOf("SITES_BUCKET.delete(jobKey(id))");
  const claim = fn.indexOf("await claimBuildRow(env, id, rowOwner, null)");
  const rec = fn.indexOf("makeRecorder(");
  assert.ok(del > 0 && claim > del && rec > claim, "the claim is not between the object's delete and the recorder");
  assert.match(fn, /const lease = row\.held \? rowOwner : null;/);
  assert.match(fn, /const rowBeat = lease \? buildRowBeat\(env, id, lease\) : null;/, "the beat is not gated on holding the lease");
  assert.match(fn, /runSiteBuild\(replayRequest\(job\), env, \{ rec, tr, budget, auth: job\.auth, jobId: id, lease \}\)/, "the consumer's lease name does not reach the build");
  assert.match(fn, /\} finally \{\s+if \(rowBeat\) clearInterval\(rowBeat\);\s+\}/, "the beat is not cleared in a finally");
  // THE CLOSE COMES AFTER THE RESULT IS WRITTEN, and reads the outcome off it.
  const put = fn.indexOf("SITES_BUCKET.put(resultKey(id)");
  const closeAt = fn.indexOf("await closeBuildRow(env, id, buildOutcome(out.status, payload)");
  assert.ok(put > 0 && closeAt > put, "the row is closed before the answer is written — a poll could read `done` for a build still writing");
  assert.match(fn, /if \(row\.row\) \{/, "the close is not gated on a row existing");
});

test("the fire hands the lease to the container after the record and before the message, and keeps the job id out of the stored design", () => {
  const put = W.indexOf("SITES_BUCKET.put(resumeKey(jobId)");
  const hand = W.indexOf("if (lease) await handoffBuildRow(env, { id: jobId, from: lease, genId: pages.resume.genId, slug });");
  const send = W.indexOf("BUILD_QUEUE.send(packResumeMessage(jobId)");
  assert.ok(put > 0 && hand > put && send > hand, "the handoff is not between the record's write and the resume message");
  // INSIDE `if (stored)`: a record that did not land hands nothing off.
  const stored = W.lastIndexOf("if (stored) {", hand);
  assert.ok(stored > put && stored < hand, "the handoff is not inside the stored branch");
  assert.match(W, /const \{ attachments: _drop, mark: _m, budget: _b, genPathOut: _g, canFire: _c, jobId: _j, \.\.\.design \} = buildArgs \|\| \{\};/,
    "the stored design carries the job id — a second copy of the record's own key");
  // THE SIGNATURE TAKES THE LEASE, defaulted so the inline path hands none.
  assert.match(W, /async function runSiteBuild\(request, env, \{ rec, tr, budget, auth, jobId = null, lease = null \}\)/);
});

test("the job id rides to the fire: buildArgs → buildAndPublishPages → containerPagesFire → the container's report object", () => {
  const decl = W.indexOf("buildArgs = {");
  const args = W.slice(decl, close(W, W.indexOf("{", decl)));
  assert.match(args, /\n\s+jobId,\n/, "buildArgs does not carry the job id");
  assert.match(W, /async function buildAndPublishPages\(env, \{[^}]*billRef = null, jobId = null \}\)/, "buildAndPublishPages does not take the job id");
  assert.match(W, /containerPagesFire\(env, slug, genPath, jobId\)/, "the fire is not handed the job id");
  assert.match(W, /function containerPagesFire\(env, slug, out, jobId = null\)/);
  const fire = fnW("containerPagesFire");
  assert.match(fire, /\.\.\.\(jobId \? \{ job: jobId, beat: `https:\/\/\$\{APP_ZONE\}\/api\/site\/genbeat`, beatMs: GEN_BEAT_MS \} : \{\}\)/,
    "the container is not told the job, the beat address at our zone and the cadence, gated on a job");
  // AND THE RESUME PASSES ITS OWN ID EXPLICITLY, since the design has none.
  const resume = fnW("runResumedSiteBuild");
  assert.match(resume, /buildAndPublishPages\(env, \{\s+\.\.\.design,\s+jobId: id,/, "the resumed build is not handed the record's id");
});

test("the collector claims or takes the lease over by name after the wait branch, beats, hands off on a refire, and closes the row after the answer", () => {
  const resume = fnW("runResumedSiteBuild");
  const wait = resume.indexOf('decision.act === "wait"');
  const claim = resume.indexOf("await claimBuildRow(env, id, rowOwner, holder)");
  const build = resume.indexOf("await buildAndPublishPages(env, {");
  assert.ok(wait > 0 && claim > wait && build > claim, "the row's claim is not between the wait branch and the build — a wait look would touch the row, or a terminal one would not");
  assert.match(resume, /try \{ holder = containerOwner\(stored\.genId\); \} catch \{ holder = null; \}/, "the holder's name is not the record's generation, or a bad one would throw");
  assert.match(resume, /const lease = row\.held \? rowOwner : null;/, "the collector calls itself the holder without having claimed");
  assert.match(resume, /const rowBeat = lease \? buildRowBeat\(env, id, lease\) : null;/);
  assert.match(resume, /\} finally \{\s+if \(rowBeat\) clearInterval\(rowBeat\);\s+\}/, "the collector's beat is not cleared in a finally");
  assert.match(resume, /await recordRefire\(env, id, claimed, stored, pages\.resume, decision, tr, rec, lease\);/, "a refire is not handed the lease to move");
  const put = resume.indexOf("SITES_BUCKET.put(resultKey(id)");
  const closeAt = resume.indexOf("await closeBuildRow(env, id, buildOutcome(out.status, payload)");
  assert.ok(put > 0 && closeAt > put, "the collector closes the row before its answer is written");
  // THE REFIRE'S HANDOFF: after the record, before the message, gated on the lease.
  const refire = fnW("recordRefire");
  const rput = refire.indexOf("SITES_BUCKET.put(resumeKey(id)");
  const rhand = refire.indexOf("if (lease) await handoffBuildRow(env, { id, from: lease, genId: resume.genId, slug: claimed.slug });");
  const rsend = refire.indexOf("BUILD_QUEUE.send(packResumeMessage(id)");
  assert.ok(rput > 0 && rhand > rput && rsend > rhand, "a refire's handoff is not between its record and its message");
  assert.match(refire, /async function recordRefire\(env, id, claimed, stored, resume, decision, tr, rec, lease = null\)/);
});

test("the helpers: a takeover by name on `leased`, one retry on the handoff, a release that keeps the owner, a close that never touches the ledger", () => {
  const claim = fnW("claimBuildRow");
  assert.match(claim, /editRpc\(env, "edit_claim", \{ p_id: id, p_owner: owner, p_ttl: LEASE_TTL_S \}\)/);
  assert.match(claim, /if \(c\.error === "leased" && holder\) \{\s+const h = await editRpc\(env, "edit_handoff", \{ p_id: id, p_owner: holder, p_next: owner, p_ttl: LEASE_TTL_S, p_state: null, p_slug: null \}\);/,
    "a leased row is not taken over from its named holder");
  assert.match(claim, /if \(!c \|\| c\.error === "no-job" \|\| c\.error === "no-service-key"\) return \{ held: false, row: false \};/, "no row is read as a row");
  const hand = fnW("handoffBuildRow");
  assert.match(hand, /p_next: next, p_ttl: HANDOFF_TTL_S, p_state: GENERATING, p_slug: isRowSlug\(slug\) \? slug : null/, "the handoff is not for the generation bound, to generating, with the slug only when real");
  assert.match(hand, /if \(h && h\.ok !== true && h\.error === "rpc"\) h = await editRpc\(env, "edit_handoff", args\);/, "a transport failure is not retried once");
  assert.match(hand, /try \{ next = containerOwner\(genId\); \} catch \{ return null; \}/);
  const rel = fnW("releaseBuildRow");
  assert.match(rel, /p_owner: containerOwner\(genId\), p_next: null, p_ttl: RELEASE_TTL_S, p_state: null, p_slug: null/, "the release moves the owner, or the state, or is for the wrong TTL");
  const cl = fnW("closeBuildRow");
  assert.match(cl, /if \(outcome === "resuming"\) return null;/, "a fired build's row is closed by the consumer");
  assert.match(cl, /if \(outcome === "done"\) return editRpc\(env, "edit_finalize", \{ p_id: id, p_result: null, p_ok: true \}\);/);
  assert.match(cl, /editRpc\(env, "edit_refund", \{ p_id: id, p_state: "failed"/);
  assert.doesNotMatch(cl + hand + rel + claim, /credit_|use_credits/, "a row helper touches the ledger");
  const beat = fnW("buildRowBeat");
  assert.match(beat, /setInterval\(\(\) => \{ editRpc\(env, "edit_beat", \{ p_id: id, p_owner: owner, p_ttl: LEASE_TTL_S, p_phase: null \}\)/);
  assert.match(beat, /HEARTBEAT_S \* 1000/);
  const status = fnW("buildRowStatus");
  assert.match(status, /if \(!env\.SUPABASE_SERVICE_KEY \|\| !env\.CREDITS_MINT_SECRET\) return null;/, "a sandbox with no key reaches for the row");
  assert.match(status, /editRpc\(env, "edit_get", \{ p_id: id, p_uid: uid \}\)/, "the row is not read owner-scoped");
  // RE-ANCHORED 2026-09-05 (stage 6): the row's own reason rides into the
  // verdict, so a row the claim failed as site-busy names that rather than
  // wearing the build's failure sentence.
  assert.match(status, /rowVerdict\(\{ state: g\.state, slug: g\.slug, job: id, error: g\.error \}\)/);
  const bind = fnW("genBindingFor");
  assert.match(bind, /if \(!isJobId\(id\) \|\| !genId \|\| genId\.length > 80 \|\| !env\.SITES_BUCKET\) return null;/);
  assert.match(bind, /return genBound\(rec, token, genId\) \? \{ id, genId \} : null;/);
});

test("the report route releases the lease after the answer is safe, and the beat route renews it under the container's own name", () => {
  const rep = routeBlock('if (url.pathname === "/api/site/genresult" && request.method === "POST")');
  const put = rep.indexOf("SITES_BUCKET.put(genKey(token)");
  const bind = rep.indexOf("await genBindingFor(env, token, body)");
  const rel = rep.indexOf("await releaseBuildRow(env, bind)");
  const ok = rep.indexOf("return Response.json({ ok: true });");
  assert.ok(put > 0 && bind > put && rel > bind && ok > rel, "the release is not after the answer's write and before the ok");
  assert.match(rep, /if \(bind\) \{ try \{ await releaseBuildRow\(env, bind\); \} catch \{/, "a release that throws could fail a delivered answer");
  const beat = routeBlock('if (url.pathname === "/api/site/genbeat" && request.method === "POST")');
  assert.match(beat, /if \(!isReportToken\(token\) \|\| !env\.SITES_BUCKET\) return Response\.json\(\{ ok: false \}, \{ status: 404 \}\);/, "the beat is not token-gated with a 404");
  assert.match(beat, /tooLargeBody\(request, 4096\)/, "the beat body is unbounded");
  assert.match(beat, /if \(!bind\) return Response\.json\(\{ ok: false \}, \{ status: 404 \}\);/, "an unbound beat is not refused");
  assert.match(beat, /editRpc\(env, "edit_beat", \{ p_id: bind\.id, p_owner: containerOwner\(bind\.genId\), p_ttl: CONTAINER_BEAT_TTL_S, p_phase: null \}\)/,
    "the beat does not renew under the container's own name for its own TTL");
  assert.doesNotMatch(beat, /authUser\(/, "the beat route asks for a session the container cannot hold");
});

test("the poll route asks the row only when there is no answer object, answers its verdict, and carries the state on a pending answer", () => {
  const poll = routeBlock('if (url.pathname.startsWith("/api/site/build/") && request.method === "GET")');
  const missing = poll.indexOf("if (!obj) {");
  const flight = poll.indexOf("flightOf(rec, Date.now())");
  const rs = poll.indexOf("const rs = await buildRowStatus(env, jid, bu.id);");
  const verdict = poll.indexOf("if (rs && rs.verdict) return Response.json(rs.verdict.body, { status: rs.verdict.status });");
  const pend = poll.indexOf("return Response.json(pend, { status: 202 });");
  const served = poll.indexOf("return new Response(out.body, { status: out.status, headers: { \"content-type\": out.type } });");
  assert.ok(missing > 0 && flight > missing && rs > flight && verdict > rs && pend > verdict, "the row is not read inside the no-object branch, after the flight, before the pending answer");
  assert.ok(served > pend, "the answer object is not served after the branch — it must always win");
  assert.match(poll, /if \(rs && rs\.state\) pend\.state = rs\.state;/);
  assert.match(poll, /if \(flight\) pend\.flight = flight;/);
});

// ── DRIVEN: THE ROUTES, AGAINST STUBBED RPCS ─────────────────────────────────

const USER = { id: "11111111-2222-4333-8444-555555555555", email: "owner@example.test" };
const AUTHED = { Authorization: "Bearer some-token" };
const ENV_KEYS = { SUPABASE_SERVICE_KEY: "svc-test", CREDITS_MINT_SECRET: "mint-test" };

/** Stub every fetch the Worker makes: GoTrue answers the owner, RPCs answer per name, the rest answers empty lists. */
function stubFetch(rpcAnswers, rpc) {
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const u = String((input && input.url) || input || "");
    const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
    if (u.includes("/auth/v1/user")) return json(USER);
    const m = u.match(/\/rest\/v1\/rpc\/(edit_\w+)/);
    if (m) {
      let args = {};
      try { args = JSON.parse(String(init && init.body) || "{}"); } catch { args = {}; }
      delete args.p_mint;
      rpc.push({ fn: m[1], args });
      const a = rpcAnswers[m[1]];
      if (a === undefined) return json({ ok: false, error: "no stub for " + m[1] }, 500);
      return json(typeof a === "function" ? a(args) : a);
    }
    if (u.includes("/rest/v1/")) return json([]);
    return new Response("unavailable", { status: 503 });
  };
  return () => { globalThis.fetch = real; };
}

/** An R2 stand-in over a Map. */
function bucket(entries = {}) {
  const store = new Map(Object.entries(entries));
  return {
    store,
    get: async (k) => (store.has(k) ? { text: async () => store.get(k), etag: "e1" } : null),
    put: async (k, v) => { store.set(k, String(v)); return {}; },
    delete: async (k) => { store.delete(k); },
  };
}

const RECORD = packResume({ id: JOB, auth: "Bearer x", uid: USER.id, slug: "fold-lane", lane: "build-k-fold-lane", genId: "gen-1", report: TOKEN, firedAt: Date.now(), charged: ["deposit", "schema"], design: { brand: "Fold" } });

test("the poll route answers a lost build with a claimed slug as a placeholder build, with the site's address", async () => {
  const rpc = [];
  const restore = stubFetch({ edit_get: { ok: true, job: JOB, slug: "fold-lane", state: "lost", phase: "generating", cost: 0, billing: "external" } }, rpc);
  try {
    const r = await hit(`/api/site/build/${JOB}`, { headers: AUTHED, env: { ...ENV_KEYS, SITES_BUCKET: bucket() } });
    assert.equal(r.status, 200, `a lost build with a slug answered ${r.status}: ${r.text.slice(0, 200)}`);
    assert.equal(r.json.lost, true); assert.equal(r.json.slug, "fold-lane"); assert.equal(r.json.page, "placeholder"); assert.equal(r.json.notes, LOST_SITE_MSG); assert.equal(r.json.ok, false);
    assert.match(String(r.json.url), /fold-lane/, "the verdict carries no address for the claimed site");
    assert.deepEqual(rpc.map((x) => x.fn), ["edit_get"]);
    assert.equal(rpc[0].args.p_uid, USER.id, "the row was not read owner-scoped");
  } finally { restore(); }
});

test("…and a lost build that claimed nothing, a failed one, and a collected one answer 410 with their sentences", async () => {
  for (const [state, slug, key, msg] of [
    ["lost", "build:" + JOB, "lost", LOST_MSG],
    ["failed", "fold-lane", "failed", FAILED_MSG],
    ["done", "fold-lane", "collected", COLLECTED_MSG],
    ["cancelled", "fold-lane", "cancelled", CANCELLED_MSG],
  ]) {
    const rpc = [];
    const restore = stubFetch({ edit_get: { ok: true, job: JOB, slug, state } }, rpc);
    try {
      const r = await hit(`/api/site/build/${JOB}`, { headers: AUTHED, env: { ...ENV_KEYS, SITES_BUCKET: bucket() } });
      assert.equal(r.status, 410, `${state} answered ${r.status}`);
      assert.equal(r.json[key], true, `${state} did not say ${key}`);
      assert.equal(r.json.msg, msg);
      assert.equal(r.json.slug, undefined, `${state} carried a slug — the browser would record a site`);
    } finally { restore(); }
  }
});

test("…a build in flight is still 202 pending, now with its state; a stranger and a sandbox get the 202 they always got", async () => {
  let rpc = [];
  let restore = stubFetch({ edit_get: { ok: true, job: JOB, slug: "fold-lane", state: "generating", phase: "generating" } }, rpc);
  try {
    const r = await hit(`/api/site/build/${JOB}`, { headers: AUTHED, env: { ...ENV_KEYS, SITES_BUCKET: bucket({ [resumeKey(JOB)]: JSON.stringify(RECORD) }) } });
    assert.equal(r.status, 202);
    assert.equal(r.json.pending, true); assert.equal(r.json.state, "generating");
    assert.ok(r.json.flight, "the flight is gone from a pending answer");
    assert.ok(!r.text.includes("Bearer x"), "the pending answer leaks the record's token");
  } finally { restore(); }
  rpc = [];
  restore = stubFetch({ edit_get: { ok: false, error: "no-job" } }, rpc);
  try {
    const r = await hit(`/api/site/build/${JOB}`, { headers: AUTHED, env: { ...ENV_KEYS, SITES_BUCKET: bucket() } });
    assert.equal(r.status, 202);
    assert.deepEqual(r.json, { ok: false, pending: true, job: JOB }, "a stranger's poll changed shape");
  } finally { restore(); }
  // NO SERVICE KEY: no RPC at all, the same body as ever.
  rpc = [];
  restore = stubFetch({}, rpc);
  try {
    const r = await hit(`/api/site/build/${JOB}`, { headers: AUTHED, env: { SITES_BUCKET: bucket() } });
    assert.equal(r.status, 202);
    assert.deepEqual(r.json, { ok: false, pending: true, job: JOB });
    assert.deepEqual(rpc, [], "a sandbox with no service key reached for the row");
  } finally { restore(); }
});

test("…and the answer object always wins over the row", async () => {
  const rpc = [];
  const restore = stubFetch({ edit_get: { ok: true, job: JOB, slug: "fold-lane", state: "lost" } }, rpc);
  try {
    const stored = JSON.stringify({ v: 1, status: 200, type: "application/json", body: JSON.stringify({ ok: true, slug: "fold-lane", page: "app" }), uid: USER.id });
    const r = await hit(`/api/site/build/${JOB}`, { headers: AUTHED, env: { ...ENV_KEYS, SITES_BUCKET: bucket({ [resultKey(JOB)]: stored }) } });
    assert.equal(r.status, 200);
    assert.equal(r.json.page, "app", "a lost row overrode the build's own answer");
    assert.deepEqual(rpc, [], "the row was read although the answer was there");
  } finally { restore(); }
});

test("the beat route renews the container's lease only for a beat bound through the record", async () => {
  const good = { headers: { "x-gen-report": TOKEN, "content-type": "application/json" }, method: "POST" };
  // BOUND: the record's token and generation → edit_beat under the container's name.
  let rpc = [];
  let restore = stubFetch({ edit_beat: { ok: true, alive: true, state: "generating", cancel: false } }, rpc);
  try {
    const r = await hit("/api/site/genbeat", { ...good, body: JSON.stringify({ job: JOB, gen: "gen-1" }), env: { ...ENV_KEYS, SITES_BUCKET: bucket({ [resumeKey(JOB)]: JSON.stringify(RECORD) }) } });
    assert.equal(r.status, 200, r.text);
    assert.deepEqual(r.json, { ok: true, alive: true });
    assert.deepEqual(rpc.map((x) => x.fn), ["edit_beat"]);
    assert.deepEqual(rpc[0].args, { p_id: JOB, p_owner: "container:gen-1", p_ttl: CONTAINER_BEAT_TTL_S, p_phase: null });
  } finally { restore(); }
  // UNBOUND, every way: nothing is beaten, 404 each time.
  for (const [why, headers, body, entries] of [
    ["a wrong token", { "x-gen-report": "f".repeat(32) }, { job: JOB, gen: "gen-1" }, { [resumeKey(JOB)]: JSON.stringify(RECORD) }],
    ["another generation", good.headers, { job: JOB, gen: "gen-2" }, { [resumeKey(JOB)]: JSON.stringify(RECORD) }],
    ["no record", good.headers, { job: JOB, gen: "gen-1" }, {}],
    ["a malformed job id", good.headers, { job: "nope", gen: "gen-1" }, { [resumeKey(JOB)]: JSON.stringify(RECORD) }],
    ["no token at all", {}, { job: JOB, gen: "gen-1" }, { [resumeKey(JOB)]: JSON.stringify(RECORD) }],
    ["a body that is not JSON", good.headers, "not json", { [resumeKey(JOB)]: JSON.stringify(RECORD) }],
  ]) {
    rpc = [];
    restore = stubFetch({ edit_beat: { ok: true, alive: true } }, rpc);
    try {
      const r = await hit("/api/site/genbeat", { method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body), env: { ...ENV_KEYS, SITES_BUCKET: bucket(entries) } });
      assert.equal(r.status, 404, `${why} was not refused: ${r.status}`);
      assert.deepEqual(rpc, [], `${why} still renewed the lease`);
    } finally { restore(); }
  }
  // OVERSIZED, BY ITS OWN HEADER: refused before it is read.
  rpc = [];
  restore = stubFetch({}, rpc);
  try {
    const r = await hit("/api/site/genbeat", { ...good, headers: { ...good.headers, "content-length": "5000" }, body: JSON.stringify({ job: JOB, gen: "gen-1" }), env: { ...ENV_KEYS, SITES_BUCKET: bucket() } });
    assert.equal(r.status, 413);
  } finally { restore(); }
});

test("the report route stores the answer without the row's fields, and releases the lease only for a bound report", async () => {
  // BOUND: stored under the token, job and gen stripped, then the release.
  let rpc = [];
  let restore = stubFetch({ edit_handoff: { ok: true, state: "generating", owner: "container:gen-1" } }, rpc);
  const b = bucket({ [resumeKey(JOB)]: JSON.stringify(RECORD) });
  try {
    const r = await hit("/api/site/genresult", { method: "POST", headers: { "x-gen-report": TOKEN }, body: JSON.stringify({ state: "done", answer: { content: [] }, job: JOB, gen: "gen-1" }), env: { ...ENV_KEYS, SITES_BUCKET: b } });
    assert.equal(r.status, 200, r.text);
    assert.deepEqual(r.json, { ok: true }, "the report's answer grew a field — the container needs one bit");
    assert.deepEqual(JSON.parse(b.store.get(genKey(TOKEN))), { state: "done", answer: { content: [] } }, "the stored answer carries the row's fields");
    assert.deepEqual(rpc.map((x) => x.fn), ["edit_handoff"]);
    assert.deepEqual(rpc[0].args, { p_id: JOB, p_owner: "container:gen-1", p_next: null, p_ttl: RELEASE_TTL_S, p_state: null, p_slug: null });
  } finally { restore(); }
  // UNBOUND: the answer still lands (it is under a token), nothing is released.
  for (const [why, body, entries] of [
    ["a report naming nothing (an older image)", { state: "done", answer: { content: [] } }, { [resumeKey(JOB)]: JSON.stringify(RECORD) }],
    ["another generation's container", { state: "failed", message: "x", job: JOB, gen: "gen-9" }, { [resumeKey(JOB)]: JSON.stringify(RECORD) }],
    ["no record", { state: "done", answer: {}, job: JOB, gen: "gen-1" }, {}],
  ]) {
    rpc = [];
    restore = stubFetch({ edit_handoff: { ok: true } }, rpc);
    try {
      const r = await hit("/api/site/genresult", { method: "POST", headers: { "x-gen-report": TOKEN }, body: JSON.stringify(body), env: { ...ENV_KEYS, SITES_BUCKET: bucket(entries) } });
      assert.equal(r.status, 200, `${why}: ${r.status}`);
      assert.deepEqual(rpc, [], `${why} released a lease`);
    } finally { restore(); }
  }
  // A RELEASE THAT FAILS NEVER FAILS THE ANSWER.
  rpc = [];
  restore = stubFetch({ edit_handoff: { ok: false, error: "not-holder" } }, rpc);
  try {
    const r = await hit("/api/site/genresult", { method: "POST", headers: { "x-gen-report": TOKEN }, body: JSON.stringify({ state: "done", answer: {}, job: JOB, gen: "gen-1" }), env: { ...ENV_KEYS, SITES_BUCKET: bucket({ [resumeKey(JOB)]: JSON.stringify(RECORD) }) } });
    assert.equal(r.status, 200);
  } finally { restore(); }
});

// ── DRIVEN: THE CONSUMER THROUGH THE REAL QUEUE HANDLER ──────────────────────

async function driveConsumer(claim) {
  const id = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
  const b = bucket({ [jobKey(id)]: JSON.stringify(packJob({ url: "https://gofarther.dev/api/site/react-build", auth: "Bearer t", body: JSON.stringify({ brief: "a coffee shop" }), uid: USER.id, at: 1 })) });
  const rpc = [];
  const restore = stubFetch({
    edit_claim: claim, edit_beat: { ok: true, alive: true }, edit_refund: { ok: true, refunded: 0, billing: "external" },
    edit_finalize: { ok: true, billing: "external" }, edit_handoff: { ok: true },
  }, rpc);
  try {
    const worker = await loadWorker();
    const ctx = makeCtx();
    // NO NEON_API_KEY: the build refuses at its own first configuration check
    // — a real answer from the real build function, 501 — which is a FAILED
    // outcome for the row.
    let acked = 0;
    await worker.queue({ messages: [{ body: { kind: JOB_KIND, id }, ack() { acked++; } }] }, { ...ENV_KEYS, SITES_BUCKET: b }, ctx);
    await Promise.allSettled(ctx.pending);
    const out = b.store.get(resultKey(id));
    return { id, acked, rpc, out: out ? JSON.parse(out) : null };
  } finally { restore(); }
}

test("the consumer claims the row, runs the build under the lease, and closes the row as failed when the build refuses", async () => {
  const r = await driveConsumer({ ok: true, claimed: true, state: "claimed", billing: "external", uid: USER.id, slug: "build:x", needs_review: false });
  assert.equal(r.acked, 1);
  assert.ok(r.out && r.out.status === 501, `expected the build's own 501, got ${JSON.stringify(r.out).slice(0, 200)}`);
  assert.deepEqual(r.rpc.map((x) => x.fn), ["edit_claim", "edit_refund"], "the row was not claimed and then closed");
  assert.equal(r.rpc[0].args.p_ttl, LEASE_TTL_S);
  assert.match(String(r.rpc[0].args.p_owner), /^c_/, "the consumer's lease name is not a minted owner");
  assert.equal(r.rpc[1].args.p_state, "failed");
  assert.equal(r.rpc[1].args.p_id, r.id);
});

test("…a build with no row runs exactly as before and touches the row no further", async () => {
  const r = await driveConsumer({ ok: false, claimed: false, error: "no-job" });
  assert.equal(r.acked, 1);
  assert.ok(r.out && r.out.status === 501, "the build did not run without a row");
  assert.deepEqual(r.rpc.map((x) => x.fn), ["edit_claim"], "a rowless build tried to close a row");
});

test("…and a row this consumer could not claim never stops the build, and is still closed", async () => {
  const r = await driveConsumer({ ok: true, claimed: false, state: "claimed", error: "leased" });
  assert.ok(r.out && r.out.status === 501, "an unclaimed row stopped the build");
  assert.deepEqual(r.rpc.map((x) => x.fn), ["edit_claim", "edit_refund"]);
});

// ── THE CONTAINER: THE BEAT AND THE REPORT'S BINDING ─────────────────────────

test("the container beats while it generates — the Worker's cadence, the token in a header, the job and its generation in the body — and never throws", () => {
  const sendAt = SERVER.indexOf("async function sendModelBeat(");
  const sendEnd = SERVER.indexOf("\n}\n", sendAt);
  assert.ok(sendAt > 0 && sendEnd > sendAt, "sendModelBeat is gone");
  const send = SERVER.slice(sendAt, sendEnd + 3);
  assert.match(send, /fetch\(report\.beat, \{/, "the beat is not sent to the address the Worker gave");
  assert.match(send, /"x-gen-report": report\.token/, "the beat does not carry the token — the route cannot bind it");
  assert.match(send, /body: JSON\.stringify\(\{ job: report\.job, gen \}\)/, "the beat does not name the job and the generation");
  assert.match(send, /AbortSignal\.timeout\(BEAT_CALL_MS\)/, "the beat is unbounded");
  assert.doesNotMatch(send, /\bthrow\b/, "the beat can throw — on a timer nobody awaits, that kills the process");
  assert.match(send, /catch \(e\) \{/);
  // THE TIMER: keyed on the beat address, at the Worker's cadence, cleared in a finally.
  const start = SERVER.slice(SERVER.indexOf('req.url === "/model/start"'), SERVER.indexOf('req.url.startsWith("/model/result")'));
  assert.match(start, /const beat = report && typeof report\.beat === "string" && report\.beat\s+\? setInterval\(\(\) => \{ sendModelBeat\(report, id\)\.catch\(\(\) => \{\}\); \}, beatEvery\(report\)\)\s+: null;/,
    "the beat timer is not keyed on the beat address at the Worker's cadence");
  assert.match(start, /\} finally \{\s+if \(beat\) clearInterval\(beat\);\s+\}/, "the beat timer is not cleared when the generation settles");
  const timer = start.indexOf("const beat = ");
  const call = start.indexOf("await callBuilderModel(");
  assert.ok(timer > 0 && call > timer, "the timer starts after the call — a long generation would not beat until it ended");
  // BOTH REPORTS CARRY THE ROW'S HALF, after `state`, so the report's own
  // guard (state first) still reads them.
  const tags = [...start.matchAll(/await sendModelReport\(report, \{\s*\n?\s*state: "(\w+)"[\s\S]*?\.\.\.genTag\(report, id\)/g)].map((m) => m[1]).sort();
  assert.deepEqual(tags, ["done", "failed"], "a report does not name the job and the generation");
  assert.match(SERVER, /function genTag\(report, gen\) \{\s+return report && typeof report\.job === "string" && report\.job \? \{ job: report\.job, gen \} : \{\};/);
  assert.match(SERVER, /function beatEvery\(report\) \{[\s\S]*?Math\.max\(GEN_BEAT_FLOOR_MS,/, "the cadence has no floor");
});

test("the image carries the module the Worker imports", () => {
  const line = DOCKERFILE.split("\n").find((l) => l.startsWith("COPY ") && l.includes("builder/build-lease.mjs"));
  assert.ok(line, "the worker tree's COPY does not carry builder/build-lease.mjs — the runner would die at import");
  assert.match(line, /\.\/worker\/builder\/$/, "build-lease.mjs is copied somewhere the Worker's import does not expect");
});
