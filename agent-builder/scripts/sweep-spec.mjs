// THE MUTATION SPEC for this directory — the deliberate breakages the suite must
// catch, one per property worth having.
//
// IT REFUSES TO EMIT A SPEC WHOSE ANCHORS ARE NOT UNIQUE. Checking that every
// anchor occurs exactly once BEFORE the run matters because the alternative is
// reading "NEVER APPLIED" afterwards, which is the same information arriving too
// late to act on — and a breakage that never landed reads exactly like one the
// tests caught.
//
// Paths are absolute, resolved from this file, so the sweep runs from anywhere.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const at = (f) => path.join(SRC, f);
const L = at("limits.mjs");
const D = at("define.mjs");
const F = at("fanout.mjs");
const R = at("run.mjs");
const J = at("journal.mjs");
const E = at("meters.mjs");
const m = (label, file, from, to, control = false) => ({ label, files: [file], from, to, control });

const spec = [
  // ── limits.mjs ────────────────────────────────────────────────────────────
  // Replaces the old "okLimit accepts NaN" mutant, which survived because it was
  // INERT: NaN is refused twice more below, so no single edit can admit it. This
  // one breaks the wall that really does the work, which must die.
  m("limits: okLimit's number wall is gone (NaN and negatives admitted)", L,
    "  return v === Infinity || (Number.isFinite(v) && v >= 0);", "  return v === Infinity || true;"),
  m("limits: okLimit accepts a negative bound", L, "Number.isFinite(v) && v >= 0", "Number.isFinite(v)"),
  m("limits: planLimits coerces instead of refusing", L,
    'if (!okLimit(asked)) { out[name] = LIMIT_DEFAULTS[name]; refused.push(name); continue; }\n    out[name] = asked;',
    'out[name] = Number(asked);'),
  m("limits: narrowLimits lets an untrusted caller RAISE a bound", L, "const kept = Math.min(asked, base);", "const kept = asked;"),
  m("limits: narrowLimits narrows SILENTLY", L, "if (kept !== asked) narrowed.push(name);", "if (false) narrowed.push(name);"),
  m("limits: leftOf reads an UNMEASURED spend as no spend", L,
    "  if (used === null || used === undefined) return null;", "  if (used === null || used === undefined) return limit;"),
  m("limits: stoppedBy treats a broken meter as inside the budget", L,
    'return { bound, reason: "unmeasured", limit, used: null };\n    }\n    if (typeof u !== "number"',
    'return null;\n    }\n    if (typeof u !== "number"'),
  m("limits: stoppedBy ends a run on a PER-OPERATION bound", L, "for (const bound of RUN_TOTALS) {", "for (const bound of LIMIT_NAMES) {"),
  m("limits: an UNBOUNDED budget can be exceeded", L, "if (limit === Infinity) continue;", "if (false) continue;"),
  m("limits: capMs ignores the room the run has left", L, "  return Math.min(cap, room);", "  return cap;"),
  m("limits: RUN_TOTALS lets parallelTools end the run", L,
    'LIMIT_NAMES.filter((n) => n !== "callMs" && n !== "toolMs" && n !== "parallelTools")',
    'LIMIT_NAMES.filter((n) => n !== "callMs" && n !== "toolMs")'),

  // ── define.mjs ────────────────────────────────────────────────────────────
  m("define: scope is no longer compelled", D, "  if (!isText(spec.scope)) {", "  if (false) {"),
  m("define: two tools may share one name", D,
    'if (seen.has(t.name)) throw new TypeError(`${where}: two tools are both named "${t.name}"`);',
    'if (false) throw new TypeError("x");'),
  m("define: THE TENANCY WALL FAILS OPEN", D, "if (t.scope === PUBLIC || granted.has(t.scope))", "if (true)"),
  m("define: a withheld tool is dropped SILENTLY", D, "else withheld.push({ name: t.name, scope: t.scope });", "else { /* dropped */ }"),
  m("define: a tool's implementation rides out to the provider", D,
    "return tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.input }));",
    "return tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.input, run: t.run, scope: t.scope }));"),
  m("define: a tool name need not match the provider's grammar", D, "  if (!TOOL_NAME.test(spec.name)) {", "  if (false) {"),
  m("define: a description is optional, so the model cannot use the tool", D,
    "if (!isText(spec.description)) throw new TypeError(`${where}: description must be a non-empty string`);",
    "if (false) throw new TypeError('x');"),

  // ── fanout.mjs ────────────────────────────────────────────────────────────
  m("fanout: one failure takes the others with it", F,
    "      } catch (error) {", "      } catch (error) { throw error; } finally { if (false) {"),
  m("fanout: an item's clock is started BEFORE its permit", F,
    "out[i] = { index: i, ok: true, value, startedAt, ms: now() - startedAt };",
    "out[i] = { index: i, ok: true, value, startedAt: 0, ms: now() };"),
  m("fanout: a NaN limit slips through the clamp", F,
    "if (typeof limit !== \"number\" || Number.isNaN(limit) || limit < 1) limit = list.length;",
    "if (typeof limit !== \"number\" || limit < 1) limit = list.length;"),
  m("fanout: the limit is not enforced at all", F,
    "await Promise.all(Array.from({ length: limit }, () => lane()));",
    "await Promise.all(Array.from({ length: list.length }, () => lane()));"),

  // ── run.mjs ───────────────────────────────────────────────────────────────
  m("run: a batch that outruns the tool budget is run as a PREFIX", R,
    "if (roomForTools !== null && roomForTools !== Infinity && asked.length > roomForTools) {",
    "if (false) {"),
  m("run: a failed tool is DROPPED from the results", R,
    "    step.results = results.map((r) => ({", "    step.results = results.filter((r) => r.ok).map((r) => ({"),
  m("run: the model is never shown a tool's error", R,
    "messages.push(toolMessage(results.map((r) => toolResultFor(asked[r.index], r.ok, r.ok ? r.value : String(r.error?.message ?? r.error)))));",
    "messages.push(toolMessage(results.map((r) => toolResultFor(asked[r.index], r.ok, r.ok ? r.value : null))));"),
  m("run: tool dispatch FAILS OPEN — a withheld tool really runs", R,
    "const tool = typeof call?.name === \"string\" ? callable.get(call.name) : undefined;",
    "const tool = typeof call?.name === \"string\" ? agent.tools.find((t) => t.name === call.name) : undefined;"),
  m("run: a tool this tenant cannot use is described to the model anyway", R,
    "tools: wireTools(allowed), callMs", "tools: wireTools(agent.tools), callMs"),
  m("run: the per-call ceiling ignores what the run has left", R,
    "const callMs = capMs(limits.callMs, leftOf(limits.wallMs, used.wallMs));",
    "const callMs = capMs(limits.callMs, Infinity);"),
  m("run: the per-run limit override is computed and never used", R,
    "    ? narrowLimits(base, opts.limits)", "    ? base"),
  m("run: the parallel-tool bound is never handed to the fan-out", R,
    "}, { limit: limits.parallelTools, now });", "}, { now });"),
  m("meters: addMeter repairs a broken meter and starts lying", E, "  if (current === null) return null;", "  if (false) return null;"),
  m("meters: an unreported usage reads as zero tokens", E, "  return sawOne ? total : null;", "  return total;"),
  m("run: a step is counted only when the call SUCCEEDS", R,
    "    used.steps += 1;\n    const stepNo = nextStep++;",
    "    const stepNo = nextStep++;"),

  m("run: a prompt is coerced into an empty run instead of refused", R,
    'if (typeof opts.prompt !== "string" || opts.prompt.trim() === "") {\n      throw new TypeError("runAgent: prompt must be a non-empty string");\n    }',
    'if (false) { throw new TypeError("x"); }'),

  // ── journal.mjs ───────────────────────────────────────────────────────────
  m("journal: a junk entry is skipped SILENTLY", J,
    'problems.push(`entry ${i}: not a journal entry`);\n      continue;', "continue;"),
  m("journal: wallMs counts calendar time instead of work", J,
    "used.wallMs += typeof m.ms === \"number\" && m.ms >= 0 ? m.ms : 0;", "used.wallMs += m.at;"),
  m("journal: a tool call with no result is not pending", J,
    'if (!t) { pending.push({ step, index, name: calls[index]?.name ?? null, id: calls[index]?.id ?? null }); continue; }',
    "if (!t) { continue; }"),
  m("journal: only one tool call of a batch is counted", J, "used.toolCalls += calls.length;", "used.toolCalls += 1;"),
  m("journal: the conversation is rebuilt in append order, not step order", J,
    "[...models.keys()].sort((a, b) => a - b)", "[...models.keys()]"),
  m("journal: two model answers for one step are accepted", J,
    "if (models.has(e.step)) { problems.push(`entry ${i}: a second model answer for step ${e.step}`); continue; }",
    "if (false) { continue; }"),
  m("journal: a log with no start is resumed anyway", J,
    'problems.push(\'no "started" entry, so the run\\\'s own prompt and tenant are unknown\');',
    "void 0;"),

  // ── run.mjs: the journal and resume ───────────────────────────────────────
  m("run: a failed journal write is ignored and the run goes on undurably", R,
    'if (!(await write(mEntry))) return record(ended("journal-failed", { error: journalError, step: stepNo }));',
    "await write(mEntry);"),
  m("run: an unreadable log is resumed anyway", R, "if (prior.problems.length) {", "if (false) {"),
  m("run: a finished run is restarted, and billed again", R, 'if (prior.status === "stopped") {', "if (false) {"),
  m("run: a pending NON-repeatable tool is run again", R,
    "const unsafe = prior.pending.filter((p) => !callable.get(p.name)?.repeatable);", "const unsafe = [];"),
  m("run: a pending repeatable tool is never re-run, so repeatable is decoration", R,
    "for (const p of prior.pending) {", "for (const p of []) {"),
  m("run: a resumed run restarts its step numbering", R, "nextStep = prior.step + 1;", "nextStep = 1;"),
  m("run: a resumed run forgets what it already spent", R,
    "    Object.assign(used, prior.used);\n    priorMs = prior.used.wallMs;\n    nextStep",
    "    priorMs = prior.used.wallMs;\n    nextStep"),
  m("run: an unbounded limit is logged as something JSON turns into null", R,
    'out[k] = v === Infinity ? "Infinity" : v;', "out[k] = v;"),

  // ── define.mjs: repeatable ────────────────────────────────────────────────
  m("define: repeatable is coerced, so the string \"false\" means true", D,
    'if (Object.hasOwn(spec, "repeatable") && typeof spec.repeatable !== "boolean") {', "if (false) {"),
  m("define: repeatable defaults to TRUE, so a payment tool re-runs on resume", D,
    "    repeatable: spec.repeatable === true,", "    repeatable: spec.repeatable !== false,"),

  // Every write site, not just the model one. A census in the test needs a census
  // in the sweep, or only the arm that happens to be mutated is really proved.
  m("run: a failed STARTED write is ignored", R,
    'if (!(await write(first))) return record(ended("journal-failed", { error: journalError, step: 0 }));',
    "await write(first);"),
  m("run: a failed TOOL-result write is ignored", R,
    'if (!(await write(e))) return record(ended("journal-failed", { error: journalError, step: stepNo }));',
    "await write(e);"),
  m("run: a failed STOPPED write is ignored", R,
    'if (!(await write(stoppedEntry({ at: now(), stop })))) {\n      return record(ended("journal-failed", { error: journalError, was: stop.reason }));\n    }',
    "await write(stoppedEntry({ at: now(), stop }));"),

  // ── the controls: comment-only, and they MUST survive ──────────────────────
  m("CONTROL (comment only, limits.mjs)", L, "* THE BOUNDS ON ONE AGENT RUN", "* THE BOUNDS ON ONE AGENT RUN (control)", true),
  m("CONTROL (comment only, run.mjs)", R, "* THE AGENT LOOP.", "* THE AGENT LOOP (control).", true),
];

// THE PRE-CHECK. Every anchor must occur EXACTLY once in its file, and the
// replacement must differ from it.
const text = new Map();
let bad = 0;
for (const s of spec) {
  const f = s.files[0];
  if (!text.has(f)) text.set(f, fs.readFileSync(f, "utf8"));
  const body = text.get(f);
  const n = body.split(s.from).length - 1;
  if (n !== 1) { console.error(`ANCHOR ${n === 0 ? "NOT FOUND" : "AMBIGUOUS (" + n + ")"}: ${s.label}`); bad++; }
  if (s.from === s.to) { console.error(`REPLACEMENT IS THE ANCHOR: ${s.label}`); bad++; }
}
if (bad) { console.error(`\n${bad} anchor problems — spec NOT written.`); process.exit(1); }
fs.writeFileSync(process.argv[2], JSON.stringify(spec, null, 1));
console.log(`${spec.length} mutants (${spec.filter((s) => s.control).length} controls), every anchor unique.`);
