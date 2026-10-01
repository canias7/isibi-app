// The one answer `site build` gives, read from what its jobs really did.
//
// ── WHY A GATE (2026-10-01) ──────────────────────────────────────────────────
//
// `site build` was one job of 24½ minutes, 18 of them in
// `test/integration/site-build.mjs` running one build after another (run
// 36832053168 on 2188f706). It is now several jobs at once: the kit, theme and
// site checks side by side, and that harness in four shards. A green run used
// to mean "every step passed"; split up, a green run could also mean "a shard
// never started", "a matrix entry was dropped", or "a section was assigned to
// no shard", and each of those looks exactly like a pass from the outside.
//
// SO THIS JOB IS THE ANSWER, and it is green only when ALL of these hold:
//   - every job it waits on finished `success` (skipped and cancelled are not);
//   - there is one report per shard, written by this commit's harness, run as
//     that shard, complete, with no failed check;
//   - every section the harness declares ran exactly once, in the shard it
//     names, and counted at least one check.
// Anything else fails it, and it says which.
//
// ── WHAT THE EVIDENCE COVERS ─────────────────────────────────────────────────
//
// It prints a FINGERPRINT of the run's inputs: a hash over every tracked file
// the workflow's own trigger names (its `paths:` list), path and content. The
// trigger is the definition of "an input to these checks" in this repository,
// and `test/dockerfile.test.mjs` and `test/site-build-shards.test.mjs` hold it
// to the image's COPY lines and to everything the workflow's scripts import.
// So before a merge, a green gate is evidence for the candidate when the gate
// ran on the candidate itself, or when `fingerprint <candidate>` prints the
// same hash: the commits between changed nothing these checks read.
//
//   node scripts/site-build-gate.mjs gate <reports-dir>   the CI gate (reads NEEDS, GITHUB_SHA)
//   node scripts/site-build-gate.mjs fingerprint [<rev>]  the inputs hash at any commit
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
export const HARNESS = "test/integration/site-build.mjs";
export const WORKFLOW = ".github/workflows/site-build.yml";

/**
 * The harness's own plan, read from its source: how many shards, and each
 * section's name, shard and `needs`, in file order.
 *
 * READ FROM THE TEXT, deliberately, and from the gate's own checkout: the
 * reports say what each shard SAW, and this says what the file DECLARES, so a
 * shard that somehow reached fewer sections than the file holds is caught
 * rather than believed. `test/site-build-shards.test.mjs` proves this reader
 * finds every `SECTION(` call the parser finds.
 */
export function planOf(src) {
  const m = src.match(/^const SHARDS = (\d+);$/m);
  if (!m) throw new Error("the harness declares no `const SHARDS = <n>;`");
  const sections = [...src.matchAll(/^ {2}if \(SECTION\("([a-z0-9-]+)", (\d+)(?:, \{ needs: \[([^\]]*)\] \})?\)\) \{$/gm)]
    .map((x) => ({
      name: x[1],
      shard: Number(x[2]),
      needs: x[3] ? x[3].split(",").map((s) => JSON.parse(s.trim())) : [],
    }));
  return { shards: Number(m[1]), sections };
}

/**
 * The workflow's `on.push.paths`, as written. Only the `on:` block is read, so
 * a list further down (a matrix, an artifact path) can never be mistaken for it.
 */
export function triggerGlobs(workflowSrc) {
  const on = workflowSrc.slice(0, workflowSrc.indexOf("\njobs:"));
  const at = on.search(/^ {4}paths:\s*$/m);
  if (at === -1) throw new Error("the workflow has no `paths:` under its push trigger");
  const out = [];
  for (const line of on.slice(at).split("\n").slice(1)) {
    if (!line.trim() || /^\s*#/.test(line)) continue;         // comments explain entries; they do not end the list
    const item = line.match(/^ {6}- '([^']+)'\s*$/);
    if (!item) break;
    out.push(item[1]);
  }
  if (!out.length) throw new Error("the workflow's `paths:` list is empty");
  return out;
}

/**
 * Does `glob` name `p`? The three shapes the trigger uses, and nothing else:
 * `dir/**`, a root-level `*.ext`, and a literal path. A shape it does not know
 * THROWS, because a reader that shrugged would report a fingerprint over a
 * filter it had not understood.
 */
export function covers(glob, p) {
  if (glob === p) return true;
  if (glob.endsWith("/**")) return p.startsWith(glob.slice(0, -2));
  if (/^\*\.[a-z]+$/.test(glob)) return !p.includes("/") && p.endsWith(glob.slice(1));
  if (/^[\w./-]+$/.test(glob)) return false;
  throw new Error("the gate does not understand the glob " + JSON.stringify(glob));
}

/** Every tracked file at `rev`, as {path, blob}, from git's own tree. */
export function treeOf(rev = "HEAD", cwd = ROOT) {
  const out = execFileSync("git", ["ls-tree", "-r", "-z", "--full-tree", rev], { cwd, encoding: "utf8", maxBuffer: 256 << 20 });
  return out.split("\0").filter(Boolean).flatMap((entry) => {
    const m = entry.match(/^\d+ (\w+) ([0-9a-f]+)\t([\s\S]+)$/);
    return m && m[1] === "blob" ? [{ path: m[3], blob: m[2] }] : [];
  });
}

/** The inputs hash: sha256 over `<path> <blob>` for every file the globs name. */
export function fingerprint(entries, globs) {
  const hit = entries.filter((e) => globs.some((g) => covers(g, e.path)))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const h = crypto.createHash("sha256");
  for (const e of hit) h.update(e.path + " " + e.blob + "\n");
  return { files: hit.length, hash: h.digest("hex").slice(0, 16) };
}

/** The fingerprint at a commit, with the trigger as it stood AT that commit. */
export function fingerprintAt(rev = "HEAD", cwd = ROOT) {
  const wf = execFileSync("git", ["show", rev + ":" + WORKFLOW], { cwd, encoding: "utf8" });
  return fingerprint(treeOf(rev, cwd), triggerGlobs(wf));
}

const isCount = (n) => Number.isInteger(n) && n >= 0;

/**
 * The verdict. Pure: everything it judges is passed in.
 *
 *   needs          the workflow's `needs` context: {job: {result}}
 *   reports        [{file, report}] — `report` is whatever the file parsed to
 *   plan           planOf(the harness at this checkout)
 *   sha            the commit this run is for (GITHUB_SHA)
 *   harnessSha256  the hash of the harness at this checkout
 */
export function verdict({ needs, reports, plan, sha, harnessSha256 }) {
  const problems = [];
  const say = (s) => problems.push(s);

  // EVERY JOB IT WAITS ON, SUCCEEDED. A skipped or cancelled job is coverage
  // that did not happen, never a pass.
  const jobs = Object.entries(needs && typeof needs === "object" ? needs : {});
  if (!jobs.length) say("the gate was given no jobs to wait on (NEEDS is empty)");
  for (const [job, v] of jobs) {
    if (!v || v.result !== "success") say(`job ${job} finished ${v && typeof v.result === "string" ? v.result : "with no result"}, not success`);
  }

  if (!plan || !Number.isInteger(plan.shards) || plan.shards < 1 || !Array.isArray(plan.sections) || !plan.sections.length) {
    say("the harness declares no plan (no shards, or no sections)");
    return { ok: false, problems, rows: [], total: null };
  }
  const declared = plan.sections.map((s) => `${s.name}@${s.shard}`).join(",");

  // ONE REPORT PER SHARD, from this commit and this harness, run as that shard.
  const byShard = new Map();
  for (const { file, report: r } of reports) {
    const where = `report ${file}`;
    if (!r || typeof r !== "object" || Array.isArray(r)) { say(`${where} is not a report`); continue; }
    if (r.v !== 1) { say(`${where} has version ${JSON.stringify(r.v)}, not 1`); continue; }
    if (r.mode !== "shard") { say(`${where} is a ${JSON.stringify(r.mode)} run; only shard runs are evidence`); continue; }
    if (!Number.isInteger(r.shard) || r.shard < 1 || r.shard > plan.shards) { say(`${where} names shard ${JSON.stringify(r.shard)}, not 1 to ${plan.shards}`); continue; }
    if (byShard.has(r.shard)) { say(`shard ${r.shard} reported twice (${byShard.get(r.shard).file} and ${file})`); continue; }
    byShard.set(r.shard, { file, r });
    if (r.shards !== plan.shards) say(`shard ${r.shard} ran a harness of ${JSON.stringify(r.shards)} shards; this checkout declares ${plan.shards}`);
    if (!sha || r.sha !== sha) say(`shard ${r.shard} ran on ${JSON.stringify(r.sha)}, not on this commit ${JSON.stringify(sha || null)}`);
    if (!harnessSha256 || r.harnessSha256 !== harnessSha256) say(`shard ${r.shard} ran a different harness file than this checkout's`);
    if (r.completed !== true) say(`shard ${r.shard} did not reach the end of its sections` + (r.abortedIn ? ` (it stopped in ${r.abortedIn})` : ""));
    if (!isCount(r.passed) || !isCount(r.failed)) say(`shard ${r.shard} reports no counts`);
    else if (r.failed !== 0) say(`shard ${r.shard} has ${r.failed} failed check(s)`);
    const pre = r.preamble;
    if (!pre || !Array.isArray(pre.checks) || !pre.checks.length || pre.failed !== 0) say(`shard ${r.shard}'s preamble did not pass`);
    const saw = Array.isArray(r.sections) ? r.sections.map((s) => `${s && s.name}@${s && s.shard}`).join(",") : "";
    if (saw !== declared) say(`shard ${r.shard} saw sections [${saw}], not the [${declared}] this harness declares`);
  }
  for (let n = 1; n <= plan.shards; n++) if (!byShard.has(n)) say(`shard ${n}: no report`);

  // EVERY SECTION RAN EXACTLY ONCE, IN ITS OWN SHARD, AND CHECKED SOMETHING.
  const rows = [];
  let total = 0;
  for (const s of plan.sections) {
    const ran = [];
    for (const { r } of byShard.values()) {
      const hit = (Array.isArray(r.sections) ? r.sections : []).find((x) => x && x.name === s.name);
      if (hit && hit.ran === true) ran.push({ shard: r.shard, hit });
    }
    if (ran.length !== 1) { say(`section ${s.name} ran ${ran.length} times, not once`); continue; }
    const { shard, hit } = ran[0];
    if (shard !== s.shard) say(`section ${s.name} ran in shard ${shard}; the harness puts it in ${s.shard}`);
    const checks = Array.isArray(hit.checks) ? hit.checks.length : 0;
    if (!checks) say(`section ${s.name} ran no checks`);
    if (hit.failed !== 0) say(`section ${s.name} has ${JSON.stringify(hit.failed)} failed check(s)`);
    total += checks;
    rows.push({ section: s.name, shard, checks, seconds: Math.round((Number(hit.ms) || 0) / 100) / 10 });
  }
  // The preamble runs in every shard; it is counted once, as the whole file would.
  const pre = [...byShard.values()].map(({ r }) => (r.preamble && Array.isArray(r.preamble.checks) ? r.preamble.checks.length : 0));
  if (pre.length && new Set(pre).size !== 1) say(`the shards' preambles ran different numbers of checks: ${pre.join(", ")}`);
  total += pre.length ? pre[0] : 0;

  return { ok: problems.length === 0, problems, rows, total };
}

/** Every report file under `dir`, parsed. An unreadable one is kept, as unreadable. */
export function readReports(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.json$/.test(e.name)) {
        let report = null;
        try { report = JSON.parse(fs.readFileSync(p, "utf8")); } catch { report = null; }
        out.push({ file: path.relative(dir, p), report });
      }
    }
  };
  walk(dir);
  return out;
}

function table(rows, byShard) {
  const lines = ["| shard | sections | checks | seconds |", "|---|---|---|---|"];
  for (const [shard, list] of byShard) {
    lines.push(`| ${shard} | ${list.map((r) => r.section).join(", ")} | ${list.reduce((a, r) => a + r.checks, 0)} | ${Math.round(list.reduce((a, r) => a + r.seconds, 0))} |`);
  }
  return lines.join("\n");
}

async function main(argv) {
  const [cmd, arg] = argv;
  if (cmd === "fingerprint") {
    const rev = arg || "HEAD";
    const sha = execFileSync("git", ["rev-parse", rev], { cwd: ROOT, encoding: "utf8" }).trim();
    const f = fingerprintAt(rev);
    console.log(`site build inputs ${f.hash} (${f.files} files) at ${sha}`);
    return 0;
  }
  if (cmd !== "gate" || !arg) {
    console.error("usage: node scripts/site-build-gate.mjs gate <reports-dir> | fingerprint [<rev>]");
    return 2;
  }
  let needs = null;
  try { needs = JSON.parse(process.env.NEEDS || "null"); } catch { needs = null; }
  const src = fs.readFileSync(path.join(ROOT, HARNESS), "utf8");
  const plan = planOf(src);
  const harnessSha256 = crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT, HARNESS))).digest("hex");
  const sha = process.env.GITHUB_SHA || "";
  const v = verdict({ needs, reports: readReports(arg), plan, sha, harnessSha256 });

  const byShard = new Map();
  for (const r of v.rows) byShard.set(r.shard, [...(byShard.get(r.shard) || []), r]);
  const sorted = new Map([...byShard].sort((a, b) => a[0] - b[0]));
  const f = fingerprintAt("HEAD");                 // the same definition `fingerprint <rev>` prints

  console.log(table(v.rows, sorted));
  console.log(`\ncommit ${sha || "(none)"}`);
  console.log(`site build inputs ${f.hash} (${f.files} files)`);
  if (v.ok) console.log(`\nALL CHECKS: ${v.total} checks in ${plan.sections.length} sections across ${plan.shards} shards, every job green`);
  else console.log("\nNOT PASSED:\n  " + v.problems.join("\n  "));

  if (process.env.GITHUB_STEP_SUMMARY) {
    const head = v.ok
      ? `### site build: all checks passed\n\n${v.total} checks in ${plan.sections.length} sections across ${plan.shards} shards; every job green.`
      : `### site build: NOT passed\n\n` + v.problems.map((p) => "- " + p).join("\n");
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      `${head}\n\n${table(v.rows, sorted)}\n\ncommit \`${sha}\` · inputs \`${f.hash}\` (${f.files} files)\n`);
  }
  return v.ok ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (e) => { console.error(e && e.stack || e); process.exit(1); });
}
