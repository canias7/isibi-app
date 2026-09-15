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
const S = at("store.mjs");
const A = at("auth.mjs");
const H = at("api.mjs");
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

  // ── store.mjs ─────────────────────────────────────────────────────────────
  m("store: an UNKNOWN duplicate is read as already-recorded, silently dropping an entry", S,
    '  if (text.includes(POSITION_UNIQUE)) return "position";\n  return null;',
    '  if (text.includes(POSITION_UNIQUE)) return "position";\n  return "logical";'),
  m("store: any error is read as a duplicate, whatever its code", S,
    "if (body.code !== DUPLICATE) return null;", "if (false) return null;"),
  m("store: a logical duplicate THROWS, so a retry kills a paid-for run", S,
    'if (dup === "logical") {', "if (false) {"),
  m("store: a position clash is never retried", S,
    'if (dup === "position" && attempt === 0) {', "if (false) {"),
  m("store: a journal ignores where the last one left off", S,
    "let next = Number.isInteger(seq) && seq >= 0 ? seq : 0;", "let next = 0;"),
  m("store: create asserts a status the database is supposed to derive", S,
    'body: { id: runId, tenant_id: tenant }, write: true, prefer: "return=minimal"',
    'body: { id: runId, tenant_id: tenant, status: "running" }, write: true, prefer: "return=minimal"'),
  m("store: the counter does not advance on a successful append", S,
    "if (r.ok) { next = at + 1; return { seq: at, stored: true }; }",
    "if (r.ok) { return { seq: at, stored: true }; }"),
  m("store: a failed read answers an empty log instead of failing", S,
    'if (!r.ok) throw fail("open", r);', 'if (false) throw fail("open", r);'),
  m("store: the stored limits are handed back undecoded", S,
    "limits: limitsFromJson(state.limits),", "limits: state.limits,"),
  // ── the ownership boundary ────────────────────────────────────────────────
  m("store: THE OWNERSHIP CHECK DROPS THE TENANT FILTER — any run by id", S,
    "const q = `${RUNS}?id=eq.${encodeURIComponent(runId)}&tenant_id=eq.${encodeURIComponent(tenant)}`",
    "const q = `${RUNS}?id=eq.${encodeURIComponent(runId)}`"),
  m("store: open does not check ownership at all", S,
    "const run = await owns(runId);\n          if (!run) throw notFound(runId);",
    'const run = { status: "running" };'),
  m("store: a repeated create hands over another tenant's run", S,
    "if (!r.ok && !(await owns(runId))) throw notFound(runId);", "if (false) throw notFound(runId);"),
  m("store: somebody else's run is FORBIDDEN, which tells a stranger it is real", S,
    'e.code = "not-found";\n    e.status = 404;', 'e.code = "forbidden";\n    e.status = 403;'),
  m("store: forTenant accepts an empty tenant", S,
    'if (typeof tenant !== "string" || tenant.trim() === "") {', "if (false) {"),
  m("store: a resumed journal is positioned at zero and overwrites the log", S,
    "journal: journalFor(runId, nextSeq),", "journal: journalFor(runId, 0),"),
  m("store: load hands out a journal with its read-only view", S,
    "const { journal, ...rest } = await this.open(runId);\n          return rest;",
    "return await this.open(runId);"),
  m("store: the non-public schema is never named on the wire", S,
    '[write ? "content-profile" : "accept-profile"]: schema,', '"x-not-a-profile": schema,'),
  m("store: resumable is not scoped to one tenant", S,
    "const q = `${RUNS}?tenant_id=eq.${encodeURIComponent(tenant)}&status=eq.running`",
    "const q = `${RUNS}?status=eq.running`"),

  // ── journal.mjs: the limits codec ─────────────────────────────────────────
  m("journal: an unbounded limit is written straight out, and JSON makes it null", J,
    "out[k] = v === Infinity ? UNBOUNDED : v;", "out[k] = v;"),
  m("journal: A STORED NULL DECODES TO UNBOUNDED — a limit that failed to record becomes no limit", J,
    "out[k] = v === UNBOUNDED ? Infinity : v;", "out[k] = v === UNBOUNDED || v === null ? Infinity : v;"),
  m("journal: the unbounded marker is a different string from the one stored", J,
    'export const UNBOUNDED = "Infinity";', 'export const UNBOUNDED = "inf";'),

  // ── auth.mjs ──────────────────────────────────────────────────────────────
  m("auth: THE TOKEN'S OWN `alg` IS TRUSTED — alg:none and algorithm confusion both open", A,
    'if (header.alg !== ALG) return no("bad-alg");', 'if (false) return no("bad-alg");'),
  m("auth: the signature is never checked", A,
    'if (!okSig) return no("bad-signature");', 'if (false) return no("bad-signature");'),
  m("auth: a failed verify throws and is read as a pass", A,
    "    } catch { return no(\"malformed\"); }\n    if (!okSig)", "    } catch { okSig = true; }\n    if (!okSig)"),
  m("auth: `exp` becomes optional, so a leaked token is permanent", A,
    'if (typeof claims.exp !== "number" || Number.isNaN(claims.exp)) return no("expired");',
    'if (false) return no("expired");'),
  m("auth: an expired token is accepted at its own deadline and past it", A,
    'if (claims.exp * 1000 + skewMs <= t) return no("expired");',
    'if (claims.exp * 1000 + skewMs < t - 86400000) return no("expired");'),
  m("auth: a not-yet-valid token is accepted", A,
    'if (typeof claims.nbf === "number" && claims.nbf * 1000 - skewMs > t) return no("not-yet-valid");',
    'if (false) return no("not-yet-valid");'),
  m("auth: the tenant claim is coerced rather than refused", A,
    'if (!isText(tenant)) return no("no-tenant");', 'if (tenant === undefined) return no("no-tenant");'),
  m("auth: a token with the wrong number of segments is read anyway", A,
    'if (parts.length !== 3) return no("malformed");', 'if (parts.length < 2) return no("malformed");'),
  m("auth: the base64url decoder repairs its input instead of refusing it", A,
    'if (!/^[A-Za-z0-9_-]+$/.test(s)) throw new Error("not base64url");', "if (false) throw new Error(\"x\");"),
  m("auth: bearerOf takes anything after the scheme, spaces included", A,
    "const m = /^Bearer ([^\\s]+)$/i.exec(raw.trim());", "const m = /^Bearer (.+)$/i.exec(raw.trim());"),

  // ── api.mjs ───────────────────────────────────────────────────────────────
  m("api: AN UNVERIFIED REQUEST IS SERVED", H, "if (!who?.ok) {", "if (false) {"),
  m("api: a verdict that is not ok is read as ok", H, "if (!who?.ok) {", "if (who?.ok === false && false) {"),
  // MUTATED AT THE CALL SITE, not in the helper. Adding an unused `reason`
  // parameter there was INERT: nothing passes one, and `JSON.stringify` drops an
  // `undefined` value, so the body came out byte-identical.
  m("api: the 401 explains WHY, turning the endpoint into an oracle", H,
    "        return unauthorized();",
    '        return json(401, { error: "unauthorized", reason: who?.reason }, { "www-authenticate": "Bearer" });'),
  m("api: A TENANT IN THE BODY IS SILENTLY IGNORED instead of refused", H,
    "    if (smuggled.length) {", "    if (false) {"),
  m("api: the forbidden-key check uses truthiness, so every request is refused", H,
    "FORBIDDEN_BODY_KEYS.filter((k) => Object.hasOwn(body, k))", "FORBIDDEN_BODY_KEYS.filter((k) => !!body[k])"),
  m("api: A FINISHED RUN IS DISPATCHED AGAIN", H,
    'if (open.state.status === "stopped") {', "if (false) {"),
  m("api: a run whose log cannot be read is resumed anyway", H,
    "if (open.state.problems.length) {", "if (false) {"),
  m("api: THE RESUME TAKES ITS AGENT FROM THE REQUEST instead of the stored run", H,
    "const name = open.run?.agent_name ?? open.state.agent;", "const name = body?.agent ?? open.run?.agent_name;"),
  m("api: THE WORK RUNS INSIDE THE REQUEST, so nothing can outlive the connection", H,
    "          dispatch(() => execute({ scoped, runId, agent, prompt: body.prompt, journal }));",
    "          await execute({ scoped, runId, agent, prompt: body.prompt, journal });"),
  m("api: the run is not written down before its id is handed out", H,
    "          const { journal } = await scoped.create(runId);",
    "          const { journal } = { journal: { append: async () => ({}) } };"),
  m("api: a not-found is answered as a 403, telling a stranger the id is real", H,
    'if (e?.code === "not-found") return notFound();', 'if (e?.code === "not-found") return json(403, { error: "forbidden" });'),
  m("api: a crashing task leaves the run looking like it is still going", H,
    "        await journal.append(stoppedEntry({", "        if (false) await journal.append(stoppedEntry({"),
  m("api: an unknown agent is accepted and the run starts with nothing", H,
    'if (!agent) return json(400, { error: "no such agent" });', "if (false) return json(400, {});"),
  m("api: a blank prompt starts a run", H,
    'if (!isText(body.prompt)) return json(400, { error: "prompt must be a non-empty string" });',
    "if (false) return json(400, {});"),

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
