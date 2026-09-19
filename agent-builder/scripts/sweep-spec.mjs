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
const W = at("worker.mjs");

/**
 * The one line four mutants cut a dependency out of — written ONCE, because four copies of a
 * spelling is four chances for a fifth dependency to leave three of them silently stale. The
 * generator's anchor census is what turns a moved line into a refusal rather than a mutant
 * that lands on nothing, and it is how this one was caught.
 */
const NEW_RUNNER_LINE =
  "    work, store, automations, capabilities, connections, approvals, send, agents: AGENTS, now,";
const A2 = at("agents.mjs");
const RN = at("runner.mjs");
const ST = at("model-standin.mjs");
const AU = at("automations.mjs");
const AS = at("automation-store.mjs");
const WR = at("workflow-refs.mjs");
const CP = at("capabilities.mjs");
const CT = at("capability-tools.mjs");
const AP = at("approvals.mjs");
const RP = at("rest-profile.mjs");
const CN = at("connections.mjs");
const FP = at("fake-provider.mjs");
/** The inbound delivery surface: who a delivery belongs to, and whether it is one at all. */
const WH = at("webhooks.mjs");
/**
 * THE TWO FILES OUTSIDE `src/` THAT DECIDE WHETHER A DEPLOYMENT CAN BE IDENTIFIED —
 * the workflow that mints the version id and the script that holds the Worker to it.
 * They are swept because the defect they close was invisible from `src/`: every module
 * was correct and the run still reported a version two deploys old.
 */
const Y = path.resolve(SRC, "..", "..", ".github", "workflows", "agent-deploy.yml");
const V = path.resolve(SRC, "..", "scripts", "verify-live.mjs");
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
    "      asked[r.index], r.ok, r.ok ? r.value : String(r.error?.message ?? r.error),",
    "      asked[r.index], r.ok, r.ok ? r.value : null,"),
  m("run: the model is not told an unresolved write may have happened", R,
    "      !r.ok && callable.get(asked[r.index]?.name)?.writes === true))));",
    "      false))));"),
  m("run: tool dispatch FAILS OPEN — a withheld tool really runs", R,
    "const tool = typeof call?.name === \"string\" ? callable.get(call.name) : undefined;",
    "const tool = typeof call?.name === \"string\" ? agent.tools.find((t) => t.name === call.name) : undefined;"),
  // RE-ANCHORED, NOT APPEASED: the list handed to the provider is `offered` now — `allowed`
  // less what has been revoked — so this one mutant breaks BOTH narrowings at once, which is
  // a strictly stronger claim than the one it replaced.
  m("run: a tool this tenant cannot use, or one taken away, is described to the model anyway", R,
    "tools: wireTools(offered), callMs", "tools: wireTools(agent.tools), callMs"),
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
    "        pending.push({\n          step, index, name: calls[index]?.name ?? null, id: calls[index]?.id ?? null,\n          args: calls[index]?.args,\n        });",
    "        void 0;"),
  m("journal: a pending slot is handed another slot's arguments", J,
    "          args: calls[index]?.args,", "          args: calls[0]?.args,"),
  m("journal: an unreadable tool-call list is iterated instead of named", J,
    "    if (m.toolCalls !== undefined && !Array.isArray(m.toolCalls)) {", "    if (false) {"),
  m("journal: an unresolved result is read back as a plain failure", J,
    "      results.push(toolResultFor(calls[index], t.ok, t.ok ? t.value : t.error, t.unresolved === true));",
    "      results.push(toolResultFor(calls[index], t.ok, t.ok ? t.value : t.error, false));"),
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
  // ⚠ RE-ANCHORED, NOT APPEASED (the approval gate). The filter gained the calls a
  // person REFUSED — those never ran, so they are not a resume hazard — and the loop
  // gained its index, because a decision is keyed by position in the pending list. The
  // PROPERTY is unmoved in both: a non-repeatable pending call must still refuse, and a
  // repeatable one must still be re-run.
  m("run: a pending NON-repeatable tool is run again", R,
    "const unsafe = prior.pending.filter((p, i) => !refusedHere.has(i) && !callable.get(p.name)?.repeatable);",
    "const unsafe = [];"),
  m("run: a pending repeatable tool is never re-run, so repeatable is decoration", R,
    "for (const [i, p] of prior.pending.entries()) {", "for (const [i, p] of [].entries()) {"),
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
  // ── the fence, as the store reads its answers ─────────────────────────────
  m("store: A CONFLICT IS READ AS A DUPLICATE, so a double execution vanishes from the record", S,
    'if (answer === "conflict") {', "if (false) {"),
  m("store: an identical retry THROWS, so a lost answer kills a paid-for run", S,
    'if (answer === "already") {', "if (false) {"),
  m("store: a position clash is never retried", S,
    'if (answer === "position" && attempt < POSITION_RETRIES) {', "if (false) {"),
  // NO MUTANT FOR A `CLAIM_GONE` BRANCH IN THE STORE: THERE ISN'T ONE ANY MORE.
  // The first cut had one, it SURVIVED, and measurement showed why — it threw exactly
  // what the line below it throws for every answer that is not `position`, so it was
  // the same wall written twice rather than a second wall. Deleted from the product.
  // What remains is the single throw, and its mutant (just below) dies.
  m("store: an UNRECOGNISED answer is read as a success", S,
    'throw refused("fenced", runId, answer === "position" ? "position-twice" : answer, where);',
    "return { seq: at, stored: true };"),
  m("store: A JOURNAL CAN BE BUILT WITH NO CLAIM TO WRITE UNDER", S,
    'if (typeof hold?.token !== "string" || hold.token.trim() === "") {', "if (false) {"),
  // **THE MUTANT HAS TO PRODUCE A USABLE HOLD, or `journalFor`'s own check catches it
  // and the mutant survives for the wrong reason** — which is what the first version
  // did (it introduced an unused variable and left `hold` undefined). Fabricating one
  // reaches a journal that writes under a claim nobody issued, which is the thing being
  // forbidden.
  m("store: open hands out a journal under a FABRICATED claim when given none", S,
    'const hold = opts.hold;\n          if (!hold) throw new TypeError("open: hold must be the claim ({ worker, token }) — use load to read");',
    'const hold = opts.hold ?? { worker: "anyone", token: "any" };'),
  m("store: a store can be built with no fenced writer at all", S,
    'if (typeof opts.appendEntry !== "function") throw new TypeError("makeRunStore: appendEntry must be a function — the fenced writer");',
    "  /* no writer needed */"),
  m("store: the claim is not sent with the write, so the fence has nothing to check", S,
    "runId, seq: at, body: entry, worker: hold.worker, token: hold.token,",
    "runId, seq: at, body: entry, worker: hold.worker, token: null,"),
  m("store: an `already` does not clear the position the entry really landed at", S,
    "next = Math.max(next, landed + 1);", "next = at + 1;"),
  m("store: a journal ignores where the last one left off", S,
    "let next = Number.isInteger(seq) && seq >= 0 ? seq : 0;", "let next = 0;"),
  m("store: create asserts a status the database is supposed to derive", S,
    'body: { id: runId, tenant_id: tenant }, prefer: "return=minimal"',
    'body: { id: runId, tenant_id: tenant, status: "running" }, prefer: "return=minimal"'),
  m("store: the counter does not advance on a successful append", S,
    'if (answer === "stored") { next = at + 1; return { seq: at, stored: true }; }',
    'if (answer === "stored") { return { seq: at, stored: true }; }'),
  m("store: a failed read answers an empty log instead of failing", S,
    'if (!r.ok) throw fail("open", r);', 'if (false) throw fail("open", r);'),
  m("store: the stored limits are handed back undecoded", S,
    "return { runId, tenant, run, entries, nextSeq, state, limits: limitsFromJson(state.limits) };",
    "return { runId, tenant, run, entries, nextSeq, state, limits: state.limits };"),
  // ── the ownership boundary ────────────────────────────────────────────────
  m("store: THE OWNERSHIP CHECK DROPS THE TENANT FILTER — any run by id", S,
    "const q = `${RUNS}?id=eq.${encodeURIComponent(runId)}&tenant_id=eq.${encodeURIComponent(tenant)}`",
    "const q = `${RUNS}?id=eq.${encodeURIComponent(runId)}`"),
  m("store: the read does not check ownership at all", S,
    "const run = await owns(runId);\n        if (!run) throw notFound(runId);",
    'const run = { status: "running" };'),
  m("store: a repeated create hands over another tenant's run", S,
    "if (!r.ok && !(await owns(runId))) throw notFound(runId);", "if (false) throw notFound(runId);"),
  m("store: somebody else's run is FORBIDDEN, which tells a stranger it is real", S,
    'e.code = "not-found";\n    e.status = 404;', 'e.code = "forbidden";\n    e.status = 403;'),
  m("store: forTenant accepts an empty tenant", S,
    'if (typeof tenant !== "string" || tenant.trim() === "") {', "if (false) {"),
  m("store: a resumed journal is positioned at zero and overwrites the log", S,
    "journal: journalFor(runId, read.nextSeq, hold) };", "journal: journalFor(runId, 0, hold) };"),
  m("store: load hands out a journal with its read-only view", S,
    "        async load(runId) {\n          return readRun(runId);",
    '        async load(runId) {\n          return this.open(runId, { hold: { worker: "r", token: "r" } });'),
  m("store: the non-public schema is never named on the wire", S,
    "    ...profileFor(method, schema),", '    "x-not-a-profile": schema,'),
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
  m("auth: THE TOKEN'S OWN `alg` IS ACCEPTED WHOLESALE — alg:none and every unknown name", A,
    "    if (!asym && header.alg !== HS) return no(\"bad-alg\");", "    if (false) return no(\"bad-alg\");"),
  m("auth: AN HS256 TOKEN IS ROUTED TO A PUBLISHED KEY — algorithm confusion", A,
    "    let strategy;\n    if (asym) {", "    let strategy;\n    if (asym || true) {"),
  m("auth: THE PUBLISHED KEY'S OWN ALGORITHM IS IGNORED, so a token picks how its key is used", A,
    "      if (entry.alg !== header.alg) return no(\"bad-alg\");", "      if (false) return no(\"bad-alg\");"),
  m("auth: the JWKS signature is never checked", A,
    "      if (!okSig) return no(\"bad-signature\");\n    } else if (strategy === \"secret\") {",
    "      if (false) return no(\"bad-signature\");\n    } else if (strategy === \"secret\") {"),
  m("auth: a throwing JWKS verify is read as a pass", A,
    "      } catch { return no(\"malformed\"); }\n      if (!okSig) return no(\"bad-signature\");\n    } else if (strategy === \"secret\")",
    "      } catch { okSig = true; }\n      if (!okSig) return no(\"bad-signature\");\n    } else if (strategy === \"secret\")"),
  m("auth: the opt-in secret path stops checking the signature", A,
    "      if (!okSig) return no(\"bad-signature\");\n    } else {", "      if (false) return no(\"bad-signature\");\n    } else {"),
  m("auth: A KEY SET WE COULD NOT FETCH READS AS A FORGED TOKEN", A,
    "      catch (e) { onRefusal({ at: \"jwks\", error: String(e?.message ?? e) }); return no(\"unavailable\"); }",
    "      catch (e) { onRefusal({ at: \"jwks\", error: String(e?.message ?? e) }); return no(\"bad-signature\"); }"),
  m("auth: AN UNKNOWN KID IS ACCEPTED", A,
    "      if (!entry) return no(\"no-key\");", "      if (!entry) entry = [...keys.values()][0] ?? (() => { throw new Error(\"none\"); })();"),
  // NOT "a token with no kid picks the first key": the code does not do that, so that
  // mutant was inert by construction — `keyFor(undefined)` answers the same `no-key`.
  // What the guard REALLY protects is the fetch, which is free for anyone to provoke.
  m("auth: a token with no kid provokes a key fetch anyway, which anyone can do for free", A,
    "      if (!isText(header.kid)) return no(\"no-key\");", "      if (false) return no(\"no-key\");"),
  // NO MUTANT FOR THE `use: "sig"` FILTER. It was tried and SURVIVED, and it is INERT
  // BY CONSTRUCTION: **MEASURED — WebCrypto refuses to import a JWK whose `use` is
  // `enc` as a `verify` key at all** (`Invalid JWK "use" Parameter`), so our filter
  // is a second wall and cannot be killed on its own. It stays because it says what
  // is meant and because a key whose `use` we do not recognise should be skipped
  // whatever WebCrypto happens to think; the test records the measurement.
  m("auth: a forged kid can make this Worker hammer the auth endpoint", A,
    "    const mayRefetch = stale || (t - keysAt >= minRefetchMs);", "    const mayRefetch = true;"),
  m("auth: the key set is re-fetched on every single token", A,
    "    if (!stale && keys.has(kid)) return keys.get(kid);", "    if (false) return keys.get(kid);"),
  m("auth: SUPABASE'S NO IS IGNORED, so every HS256 token is accepted", A,
    "        if (!answer.good) {", "        if (false) {"),
  m("auth: AN AUTH OUTAGE READS AS A FORGED TOKEN", A,
    '        catch (e) { onRefusal({ at: "auth", error: String(e?.message ?? e) }); return no("unavailable"); }',
    '        catch (e) { onRefusal({ at: "auth", error: String(e?.message ?? e) }); return no("bad-signature"); }'),
  m("auth: a 5xx from the auth endpoint is read as a definitive refusal", A,
    "    throw new Error(`auth: HTTP ${res?.status}`);", "    return { good: false, status: res?.status, said: \"\" };"),
  m("auth: a REFUSED token is cached, so a blip refuses it for a minute", A,
    "          seen.delete(token);\n          onRefusal({ at: \"auth\", refused: answer.status, said: answer.said });",
    "          remember(token, now() + authCacheMs);\n          onRefusal({ at: \"auth\", refused: answer.status, said: answer.said });"),
  // NO MUTANT FOR THE CACHE'S EXPIRY BOUND (`Math.min(…, claims.exp * 1000)`). It was
  // tried and SURVIVED, and it is INERT because TWO walls stand in front of it: the
  // pre-flight refuses an expired token before the cache is consulted at all, and the
  // authoritative `exp` check refuses one after verification. **MEASURED: with the
  // bound removed, an expired token is still refused without a round trip**, because
  // the pre-flight fires first. Both of those walls have their own mutants below and
  // both die. The bound stays as defence in depth, declared here so it is not
  // deleted as unnecessary.
  m("auth: the cache has no ceiling", A,
    "    while (seen.size > AUTH_CACHE_MAX) {", "    while (false) {"),
  m("auth: an expired token still buys a round trip at the auth endpoint", A,
    "      if (isObj(peek) && typeof peek.exp === \"number\" && !Number.isNaN(peek.exp)\n          && peek.exp * 1000 + skewMs <= now()) {",
    "      if (false) {"),
  m("auth: A VERIFIER THAT CAN CHECK NOTHING IS BUILT ANYWAY, refusing every customer", A,
    "  if (secret === null && (base === null || doFetch === null)) {", "  if (false) {"),
  m("auth: `exp` becomes optional, so a leaked token is permanent", A,
    'if (typeof claims.exp !== "number" || Number.isNaN(claims.exp)) return no("expired");',
    'if (false) return no("expired");'),
  m("auth: an expired token is accepted at its own deadline and past it", A,
    'if (claims.exp * 1000 + skewMs <= t) return no("expired");',
    'if (claims.exp * 1000 + skewMs < t - 86400000) return no("expired");'),
  m("auth: a not-yet-valid token is accepted", A,
    'if (typeof claims.nbf === "number" && claims.nbf * 1000 - skewMs > t) return no("not-yet-valid");',
    'if (false) return no("not-yet-valid");'),
  // Replaced: the single-claim read became a loop over TENANT_CLAIMS, so its
  // coercion and its refusal are both inside the loop and have their own mutants
  // below.
  m("auth: a token with no usable tenant claim at all is accepted", A,
    'if (tenant === null) return no("no-tenant");', "void 0;"),
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
  m("api: THE WORK IS NOT PERSISTED BEFORE IT IS ACKNOWLEDGED", H,
    "          const accepted = await work.accept({ runId, tenant: who.tenant, entry, kind: \"start\" });",
    "          const accepted = { state: \"queued\" };"),
  m("api: THE PROMPT IS NOT WRITTEN DOWN, so a delivery has nothing to run", H,
    "          const entry = startedEntry({", "          const entry = { kind: \"started\" }; const _unused = ({"),
  m("api: a doorbell that did not ring is reported as delivered", H,
    "    catch (e) {\n      onError({ at: \"notify\", runId, tenant, error: String(e?.message ?? e) });\n      return false;\n    }",
    "    catch (e) {\n      onError({ at: \"notify\", runId, tenant, error: String(e?.message ?? e) });\n      return true;\n    }"),
  m("api: A FAILED DOORBELL FAILS THE REQUEST, so a queued run reads as rejected", H,
    "    try { await notify({ runId, tenant }); return true; }", "    await notify({ runId, tenant }); if (true) return true;\n    try { return true; }"),
  m("api: A RESUME MID-RUN BECOMES A SECOND DELIVERY", H,
    '          if (again.state === "running") {', "          if (false) {"),
  m("api: a resume of another tenant's run is not a not-found", H,
    '          if (again.state === "not-found") return notFound();', "          if (false) return notFound();"),
  m("api: the resume never asks for the work back, so it is a silent no-op", H,
    "          const again = await work.requeue({ runId, tenant: who.tenant });",
    '          const again = { state: "queued" };'),
  m("api: a not-found is answered as a 403, telling a stranger the id is real", H,
    'if (e?.code === "not-found") return notFound();', 'if (e?.code === "not-found") return json(403, { error: "forbidden" });'),
  m("api: an unknown agent is accepted and the run starts with nothing", H,
    'if (!agent) return json(400, { error: "no such agent" });', "if (false) return json(400, {});"),
  m("api: a blank prompt starts a run", H,
    'if (!isText(body.prompt)) return json(400, { error: "prompt must be a non-empty string" });',
    "if (false) return json(400, {});"),

  // ── auth.mjs: the tenant claims ───────────────────────────────────────────
  m("auth: THE SUBJECT FALLBACK IS GONE, so no real Supabase token matches anything", A,
    'export const TENANT_CLAIMS = Object.freeze(["tenant_id", "sub"]);',
    'export const TENANT_CLAIMS = Object.freeze(["tenant_id"]);'),
  m("auth: THE SUBJECT WINS over an explicit tenant_id", A,
    'export const TENANT_CLAIMS = Object.freeze(["tenant_id", "sub"]);',
    'export const TENANT_CLAIMS = Object.freeze(["sub", "tenant_id"]);'),
  m("auth: a MALFORMED explicit tenant falls through and becomes a DIFFERENT tenant", A,
    "      if (!isText(claims[c])) return no(\"no-tenant\");\n      tenant = claims[c];",
    "      if (!isText(claims[c])) continue;\n      tenant = claims[c];"),
  // NO MUTANT FOR `Object.hasOwn` HERE. It was tried and SURVIVED, and it is INERT:
  // the claim names are `tenant_id` and `sub`, and neither is a property of
  // `Object.prototype`, so an undefined-check cannot differ from `hasOwn` for
  // them. `hasOwn` stays because it is the right habit and because a claim name
  // added later might not be so lucky — but it is not load-bearing today, and
  // pretending a sweep proved it would be worse than saying so.

  // ── worker.mjs ────────────────────────────────────────────────────────────
  m("worker: a blank secret counts as configured", W,
    "  const missing = Object.keys(SETTINGS).filter((k) => !isText(env?.[k]));",
    "  const missing = Object.keys(SETTINGS).filter((k) => env?.[k] === undefined);"),
  m("worker: AN UNKNOWN MODEL SILENTLY BECOMES THE STAND-IN", W,
    "if (!make) throw new TypeError(`no such model: ${modelName}`);", "void 0;"),
  m("worker: THE SCHEMA IS LEFT TO THE DEFAULT, for the store and the queue alike", W,
    "const wire = { fetch: doFetch, url: env.SUPABASE_URL, key: env.SUPABASE_SERVICE_KEY, schema: SCHEMA };",
    "const wire = { fetch: doFetch, url: env.SUPABASE_URL, key: env.SUPABASE_SERVICE_KEY };"),
  m("worker: THE STORE IS WIRED TO SOMETHING THAT IS NOT THE FENCE", W,
    "const store = makeRunStore({ ...wire, appendEntry: work.append });",
    'const store = makeRunStore({ ...wire, appendEntry: async () => ({ answer: "stored", seq: 0 }) });'),
  m("worker: a configuration gap throws instead of answering a named 503", W,
    "const configGap = (e) => new Response(JSON.stringify({ error: String(e?.message ?? e) }), {",
    "const configGap = (e) => { throw e; } && ((e) => new Response(JSON.stringify({ error: String(e?.message ?? e) }), {"),
  m("worker: the 503 quotes the setting VALUES back to the caller", W,
    "JSON.stringify({ error: String(e?.message ?? e) })", "JSON.stringify({ error: String(e?.message ?? e), env })"),
  m("worker: the config check is skipped entirely on the HTTP path", W,
    "  const missing = missingFor(env, typeof notify === \"function\" ? \"consume\" : \"produce\");\n  if (missing.length) throw new TypeError(`not configured: ${missing.join(\", \")}`);",
    "  const missing = [];"),
  m("worker: THE QUEUE BINDING IS NO LONGER REQUIRED, so a deployment believes it is durable", W,
    "    const q = env?.[QUEUE_BINDING];\n    if (!q || typeof q.send !== \"function\") missing.push(QUEUE_BINDING);",
    "    void 0;"),
  m("worker: an inert binding counts as a queue", W,
    'if (!q || typeof q.send !== "function") missing.push(QUEUE_BINDING);', "if (!q) missing.push(QUEUE_BINDING);"),
  m("worker: THE MESSAGE CARRIES THE TENANT, giving a forgeable second source for it", W,
    "  const ring = notify ?? (async ({ runId }) => { await env[QUEUE_BINDING].send({ runId }); });",
    "  const ring = notify ?? (async ({ runId, tenant }) => { await env[QUEUE_BINDING].send({ runId, tenant }); });"),
  m("worker: a message that names no run is retried for ever", W,
    "        m.ack();\n        continue;", "        m.retry();\n        continue;"),
  m("worker: EVERY DELIVERY IS RETRIED BY THE QUEUE TOO, so two mechanisms fight", W,
    "      m.ack();\n    }\n  },", "      m.retry();\n    }\n  },"),
  m("worker: an unconfigured consumer ACKS work it never looked at", W,
    "      for (const m of batch.messages) m.retry();", "      for (const m of batch.messages) m.ack();"),
  // NO MUTANT FOR THE `catch` AROUND `deliver` IN THE QUEUE HANDLER. It was tried and
  // SURVIVED, and it is INERT because `deliver` is built never to throw — every path
  // in it ends in `finish`, and a store that falls over is driven in the runner tests
  // and comes back `{ why: "failed" }`. The catch is a belt on that contract and
  // cannot be killed while the contract holds. It stays because the contract is a
  // promise this file cannot enforce, and an unhandled throw there would be a batch
  // the platform retries blindly.
  m("worker: THE SWEEPER EXECUTES THE RUN inside a scheduled tick", W,
    "        await env[QUEUE_BINDING].send({ runId: row.runId });", "        await runner.deliver(row.runId);"),
  m("worker: the sweeper offers nothing, so a lost doorbell loses the work", W,
    "      const dropped = await runner.reclaimable({ graceS: SWEEP_GRACE_S, limit: SWEEP_LIMIT });",
    "      const dropped = [];"),
  m("worker: a throwing sweeper silently stops the cron", W,
    "    } catch (e) {\n      console.error(\"agent-sweep\", String(e?.message ?? e));\n    }", "    } finally { /* rethrown */ }"),
  m("worker: the sweeper runs without the binding it needs to re-ring", W,
    "    const missing = missingSettings(env);\n    if (missing.length) { console.error(\"agent-sweep\", `not configured: ${missing.join(\", \")}`); return; }",
    "    void 0;"),

  // ── worker.mjs: /health, and the lease knobs ──────────────────────────────
  m("worker: /health QUOTES THE SETTINGS back to an unauthenticated caller", W,
    "    schema: SCHEMA,\n    agents: Object.keys(AGENTS),\n    missing,",
    "    schema: SCHEMA,\n    agents: Object.keys(AGENTS),\n    missing, env,"),
  m("worker: /health needs configuration first, so an unconfigured deploy cannot be diagnosed", W,
    "    if ((path === \"/health\" || path === \"/\") && request.method === \"GET\") return health(env);",
    "    void path;"),
  m("worker: /health INVENTS a version when there is no binding", W,
    "    version: v?.id ?? null,", '    version: v?.id ?? "unknown",'),
  m("worker: /health answers a WRITE as well as a read", W,
    '&& request.method === "GET") return health(env);', "|| true) return health(env);"),
  m("worker: /health reports the wrong model, so a canned-script deployment reads as a provider", W,
    '  const model = isText(env?.MODEL) ? env.MODEL : "stand-in";', '  const model = "stand-in";'),
  m("worker: /health calls a deployment with an UNRUNNABLE model ok", W,
    "    ok: missing.length === 0 && modelKnown,", "    ok: missing.length === 0,"),
  m("worker: /health claims every model is known", W,
    "  const modelKnown = Object.hasOwn(MODELS, model);", "  const modelKnown = true;"),
  // NOT "the Worker forwards the lease knobs unconditionally": that mutant SURVIVED
  // and is INERT, because `makeRunner` already refuses a non-finite value and an
  // absent one is what the deployed path passes either way. The wall is one layer
  // down, so that is where the mutant belongs — and these two die.
  m("runner: A JUNK LEASE LENGTH IS TAKEN AT FACE VALUE", at("runner.mjs"),
    "  const ttlS = Number.isFinite(opts.leaseTtlS) && opts.leaseTtlS > 0 ? opts.leaseTtlS : LEASE_TTL_S;",
    "  const ttlS = opts.leaseTtlS ?? LEASE_TTL_S;"),
  m("runner: A JUNK BEAT INTERVAL IS TAKEN AT FACE VALUE", at("runner.mjs"),
    "  const beatEveryMs = Number.isFinite(opts.beatEveryMs) && opts.beatEveryMs > 0 ? opts.beatEveryMs : BEAT_EVERY_MS;",
    "  const beatEveryMs = opts.beatEveryMs ?? BEAT_EVERY_MS;"),

  // ── work.mjs: the durable record ──────────────────────────────────────────
  m("work: an unrecognised state is read as one we know", at("work.mjs"),
    "    if (!WORK_STATES.includes(state)) throw new Error(`${where}: unrecognised state ${JSON.stringify(state)}`);",
    "    if (false) throw new Error(\"x\");"),
  m("work: a failed RPC is read as a success", at("work.mjs"), "    if (!res.ok) {", "    if (false) {"),
  m("work: ANOTHER TENANT'S RUN ID IS A FORBIDDEN instead of a not-found", at("work.mjs"),
    'if (body?.code === NOT_ALLOWED) e.code = "not-found";', "void 0;"),
  m("work: A CLAIM WITH NO TENANT IS ACCEPTED, so the consumer acts as nobody", at("work.mjs"),
    'if (!isText(answer.tenant_id)) throw new Error("claim: the claim carries no tenant");', "void 0;"),
  m("work: a refused claim is read as claimed", at("work.mjs"),
    "      if (answer?.claimed !== true) return { claimed: false };", "      if (false) return { claimed: false };"),
  m("work: A FALSY BEAT IS READ AS STILL HOLDING THE CLAIM", at("work.mjs"),
    'return (await rpc(RPC.beat, { p_run_id: runId, p_worker: worker, p_token: token, p_ttl_s: ttlS })) === true;',
    "await rpc(RPC.beat, { p_run_id: runId, p_worker: worker, p_token: token, p_ttl_s: ttlS }); return true;"),
  m("work: THE BEAT DOES NOT PRESENT ITS TOKEN, so a replaced claim keeps its lease", at("work.mjs"),
    "{ p_run_id: runId, p_worker: worker, p_token: token, p_ttl_s: ttlS })) === true;",
    "{ p_run_id: runId, p_worker: worker, p_token: null, p_ttl_s: ttlS })) === true;"),
  m("work: A CLAIM WITH NO TOKEN IS ACCEPTED, so every write fails later for the wrong reason", at("work.mjs"),
    'if (!isText(answer.claim_token)) throw new Error("claim: the claim carries no token");', "void 0;"),
  m("work: THE APPEND DOES NOT PRESENT THE CLAIM AT ALL", at("work.mjs"),
    "p_run_id: runId, p_seq: seq, p_body: body, p_worker: worker, p_token: token,",
    "p_run_id: runId, p_seq: seq, p_body: body, p_worker: worker, p_token: null,"),
  m("work: AN UNRECOGNISED APPEND ANSWER IS READ AS A SUCCESS", at("work.mjs"),
    "      if (!APPEND_ANSWERS.includes(answer)) {\n        throw new Error(`append: unrecognised answer ${JSON.stringify(a)}`);\n      }",
    '      if (false) { throw new Error("x"); }'),
  m("work: `already` IS READ AS `stored`, so a retry looks like a fresh write", at("work.mjs"),
    '? (a.already === true ? "already" : a.stored === true ? "stored" : null)', '? "stored"'),
  m("work: the release does not present its token", at("work.mjs"),
    "{ p_run_id: runId, p_worker: worker, p_token: token, p_done: done, p_error: error })) === true;",
    "{ p_run_id: runId, p_worker: worker, p_token: null, p_done: done, p_error: error })) === true;"),
  m("work: the schema is not named, so the queue's functions are looked for in public", at("work.mjs"),
    "        ...profileFor(METHOD, schema),", "        // no profile"),
  // ⚠ AND THE METHOD IT HANDS OVER IS THE HOP THE RULE MODULE CANNOT SEE. A store that
  // asks `profileFor` with a constant is a store that decides for itself again, one
  // indirection further in — measured: every RPC here is a POST, so naming "GET" sends
  // `accept-profile`, which PostgREST ignores on the request it really makes.
  m("work: the profile is asked about a method this store never sends", at("work.mjs"),
    "        ...profileFor(METHOD, schema),", '        ...profileFor("GET", schema),'),

  // ── runner.mjs: the consumer ──────────────────────────────────────────────
  m("runner: A DUPLICATE DELIVERY EXECUTES THE RUN AGAIN", at("runner.mjs"),
    "    if (!claim.claimed) {", "    if (false) {"),
  // NO `?? "anyone"` MUTANT ON THE RUNNER'S TENANT. It was tried and SURVIVED, and it
  // is INERT: `work.claim` already refuses a claim that carries no tenant (its own
  // mutant, above, dies), so the fallback can never fire. The wall is in `work.mjs`,
  // one layer down, and that is the right place for it — the claim is where a
  // consumer learns whose run it is.
  // ══════════════════════════════════════════════════════════════════════════
  // FIVE MUTANTS THAT ARE DELIBERATELY NOT HERE, each PROVED INERT BY MEASUREMENT
  // rather than hunted, and each declared in `runner.mjs` where the next reader meets
  // it. Written down because a sweep cannot see a deliberate redundancy and the next
  // reader deletes what nothing appears to need.
  //
  //   · `assertHeld()`'s own throw — the shared cheap wall. Every caller of it has
  //     either just asked the database (`mayStart`, one line up) or is about to be
  //     refused by it (`append_entry`), so removing it alone changes nothing.
  //   · `assertHeld()` in the `send` wrapper, and the `throw` at the end of `mayStart`
  //     — a PAIR: with either one gone the other still stops the call. The mutant below
  //     removes the whole check and dies.
  //   · `assertHeld()` in the `journal` wrapper, and `if (held)` before the release —
  //     these stand in front of SQL, which THIS sweep cannot mutate. `agent.append_entry`
  //     refuses the write and `agent.release_run` refuses the release, and the SQL
  //     sweep's own mutants kill both walls (`SQL/fence: THE LEASE IS NOT CHECKED…`,
  //     `SQL/queue: A LAPSED HOLDER MAY STILL END THE RUN…`). Reading the two sweeps
  //     together is the only honest coverage claim for these two.
  //
  // **AND THE SECOND PASS IS WHY THE LIST IS FIVE RATHER THAN EIGHT.** The first pass
  // had eight survivors; three were real and were fixed — one was DEAD CODE and was
  // deleted from the product, one mutant was badly written (it left `hold` undefined so
  // a different wall threw), and one needed a test at the layer where the answer is
  // first read. The other five are these.
  // ══════════════════════════════════════════════════════════════════════════
  // **THREE PROCESS-LEVEL WALLS ARE NOW REDUNDANT WITH THE DATABASE, MEASURED, and
  // each is declared in `runner.mjs` where the next reader will meet it.** Removing any
  // one of them alone SURVIVES, and none of those survivors was a test gap:
  //   · `assertHeld()` in the `send` wrapper — the checkpoint asked the database one
  //     line earlier, so only a beat answering `false` in between is left to catch;
  //   · `assertHeld()` in the `journal` wrapper — `agent.append_entry` refuses the
  //     write anyway, in the same transaction that would have performed it;
  //   · `if (held)` before the release — `release_run` is gated on the holder, the
  //     token and a live lease, so a stale release is a no-op.
  // The first CAN be paired with the thing it stands in front of, and the pair dies.
  // The other two stand in front of SQL, which this sweep cannot mutate — the SQL sweep
  // kills those walls, and reading the two sweeps together is the only honest coverage
  // claim here.
  // **THE MUTANT THAT REMOVES THE OWNERSHIP CHECK ALTOGETHER, and it is the only one of
  // this family that can die.** Without the checkpoint, `mayStart` is unreachable and
  // the process-level flag is left with nothing to refuse until the periodic beat fires
  // — so a lost claim buys a model call, and a test that COUNTS them sees it.
  m("runner: OWNERSHIP IS NEVER ASKED BEFORE NEW WORK, so a lost claim buys model calls", at("runner.mjs"),
    "        checkpoint: mayStart,\n        // The cheap wall in front of it",
    "        checkpoint: undefined,\n        // The cheap wall in front of it"),
  // ── the fence, as the consumer uses it ────────────────────────────────────
  m("runner: OWNERSHIP IS NEVER ASKED BEFORE NEW WORK, so a stale worker starts it", at("runner.mjs"),
    "        checkpoint: mayStart,", "        checkpoint: undefined,"),
  m("runner: the ownership check asks nothing of the database, only its own flag", at("runner.mjs"),
    "      if (await beatOnce()) return;", "      if (held) return;"),
  m("runner: A FENCED REFUSAL IS READ AS A BROKEN JOURNAL, so the run is retried as ours", at("runner.mjs"),
    "              if (e?.code === \"fenced\" && CLAIM_GONE.includes(e.why)) {\n                held = false; lostBecause = \"lease-lost\"; refusal = e.why;",
    "              if (false) {\n                held = false; lostBecause = \"lease-lost\"; refusal = e.why;"),
  m("runner: A CONFLICT IS READ AS A LOST CLAIM, so the log is never re-read", at("runner.mjs"),
    "      if (refusal === \"conflict\") {\n        return await finish(false, \"conflict\", \"another writer's entry is in this run's log\");\n      }",
    "      void 0;"),
  // ⚠ RE-ANCHORED, NOT APPEASED, AND THE REASON IS THE RECORDED INDENTATION TRAP. The
  // automation executor answers a conflict with the same sentence — it is the same fact,
  // one executor over — and it sits two spaces deeper, so the eight-space needle is a
  // SUBSTRING of the ten-space line and the generator refused it as AMBIGUOUS. A leading
  // newline pins the indent, which is what the fence migration's own anchors do.
  m("runner: a conflict takes the run OFF the queue, so nobody ever reads the real log", at("runner.mjs"),
    "\n        return await finish(false, \"conflict\", \"another writer's entry is in this run's log\");",
    "\n        return await finish(true, \"conflict\", \"another writer's entry is in this run's log\");"),
  m("runner: an automation's conflict takes ITS run off the queue too", at("runner.mjs"),
    "\n          return await finish(false, \"conflict\", \"another writer's entry is in this run's log\");",
    "\n          return await finish(true, \"conflict\", \"another writer's entry is in this run's log\");"),
  m("runner: the reason a claim was refused is thrown away", at("runner.mjs"),
    "      if (!held) return await finish(false, lostBecause ?? \"lease-lost\", refusal, null);",
    "      if (!held) return await finish(false, lostBecause ?? \"lease-lost\", null, null);"),
  m("runner: THE CRASH PATH WRITES A STOP WITHOUT PRESENTING THE CLAIM", at("runner.mjs"),
    "    const open = await scoped.open(runId, { hold });\n    if (open.state.status === \"stopped\") return;",
    "    const open = await scoped.open(runId, { hold: { worker: hold.worker, token: \"any\" } });\n    if (open.state.status === \"stopped\") return;"),
  m("runner: the journal is not bound to this claim at all", at("runner.mjs"),
    "      const open = await scoped.open(runId, { hold });", "      const open = await scoped.open(runId, { hold: { worker: hold.worker, token: \"any\" } });"),
  m("runner: a definitive claim loss is tolerated as a blip", at("runner.mjs"),
    '      if (!ok) {\n        // Definitive: the database says this claim is not ours.\n        held = false; lostBecause = "lease-lost";\n        return false;\n      }',
    "      if (!ok) { misses += 1; return true; }"),
  m("runner: an unanswerable beat is worked through for ever", at("runner.mjs"),
    "        if (misses > TOLERATED_MISSES) { held = false; lostBecause = \"beat-failed\"; }", "        void 0;"),
  m("runner: the tolerance is a chosen number rather than derived from the TTL", at("runner.mjs"),
    "export const TOLERATED_MISSES = Math.max(0, Math.floor((LEASE_TTL_S * 1000) / BEAT_EVERY_MS) - 2);",
    "export const TOLERATED_MISSES = 5;"),
  m("runner: the heartbeat is never started, so any long run loses its lease", at("runner.mjs"),
    "    handle = timer.set(tick, beatEveryMs);\n\n    const assertHeld", "    void 0;\n\n    const assertHeld"),
  m("runner: the heartbeat keeps beating after the run is over", at("runner.mjs"),
    "      stopBeating();\n      // **A LOST CLAIM RELEASES NOTHING.**", "      // **A LOST CLAIM RELEASES NOTHING.**"),
  m("runner: A FINISHED RUN IS EXECUTED AGAIN", at("runner.mjs"),
    'if (open.state.status === "stopped") return await finish(true, "already-finished", null, open.state.stop);',
    "if (false) return await finish(true, \"already-finished\");"),
  m("runner: a run whose log cannot be read is executed anyway", at("runner.mjs"),
    "      if (open.state.problems.length) {", "      if (false) {"),
  // ⚠ THE AUTOMATION BRANCH'S OWN COPY OF THAT WALL, which it did not have until `verify:send`
  // found a finished execution being re-offered every minute for ever. It is guarded in
  // `test/worker.test.mjs`, which drives a real delivery over the in-memory project — the
  // demonstration cannot be run from here.
  m("runner: A FINISHED AUTOMATION EXECUTION IS RUN AGAIN", at("runner.mjs"),
    "      if (isText(exec.finishedAt)) {", "      if (false) {"),
  // AND THE OTHER DIRECTION, because "it answers something" is not the property: it has to
  // come OFF the queue, or it is offered again on the next tick whatever it answered.
  m("runner: ...and is answered but left on the queue, so the cron re-offers it", at("runner.mjs"),
    'return await finish(true, "already-finished", null,\n          { reason: "done", why: "this execution had already finished" });',
    'return await finish(false, "already-finished", null,\n          { reason: "done", why: "this execution had already finished" });'),
  m("runner: A RUN THAT CANNOT BE SAFELY RESUMED IS RETRIED FOR EVER", at("runner.mjs"),
    'if (reason === "cannot-resume") {\n        return await finish(true,', 'if (reason === "cannot-resume") {\n        return await finish(false,'),
  m("runner: a broken journal is never retried", at("runner.mjs"),
    'if (reason === "journal-failed") {\n        return await finish(false,', 'if (reason === "journal-failed") {\n        return await finish(true,'),
  m("runner: THERE IS NO CEILING, so a run that keeps failing spins for ever", at("runner.mjs"),
    "      if (claim.attempts > maxAttempts) {", "      if (false) {"),
  m("runner: a crash on the LAST attempt leaves the run reading as still going", at("runner.mjs"),
    "      const last = claim.attempts >= maxAttempts;", "      const last = false;"),
  m("runner: a crash on the FIRST attempt closes the log, so a transient failure is final", at("runner.mjs"),
    "      const last = claim.attempts >= maxAttempts;", "      const last = true;"),
  m("runner: THE CONSUMER THROWS, so the platform retries a run blindly", at("runner.mjs"),
    "    } catch (e) {\n      onError({ at: \"deliver\", runId, error: String(e?.message ?? e) });",
    "    } catch (e) {\n      throw e;"),
  // ⚠ RE-ANCHORED FROM `if (!agent)`, WHICH HAD NOT EXISTED FOR SOME TIME. The
  // runner renamed that local to `registered` when the authored snapshot landed, and
  // this spec kept the old spelling — so the mutant was NOT FOUND and the property
  // was unswept, silently, because the generator's own pre-check only runs when
  // somebody runs a sweep. The case below (`the sweep spec's anchors are all still
  // there`) is what makes that a red run instead of a quiet gap.
  m("runner: a run whose agent is gone is retried for ever", at("runner.mjs"),
    'if (!registered) return await finish(true, "no-agent"', 'if (!registered) return await finish(false, "no-agent"'),
  m("runner: two deliveries in one isolate share a worker name", at("runner.mjs"),
    "    : () => `w-${crypto.randomUUID()}`;", "    : () => \"w\";"),

  // ── the deploy's version identity ─────────────────────────────────────────
  //
  // Each of these is the shape of a REAL defect: run 34938312961 reported a version
  // two deploys old as "the deployed version", and the reason was not in any module —
  // it was that `secret put` mints a version of its own and prints no id, so nothing
  // downstream had an id to hold the Worker to, and printing whatever answered read
  // exactly like verifying it.
  m("deploy: THE VERSION SERVING IS NOT COMPARED WITH THE ONE DEPLOYED — ok:true is enough again", Y,
    'if [ "$got" = "$EXPECT_VERSION" ] && [ "$ok" != "0" ]; then', 'if [ "$ok" != "0" ]; then'),
  m("deploy: a deployment that never reports this version is accepted", Y,
    'an unknown version is evidence about the wrong deployment."\n          exit 1',
    'an unknown version is evidence about the wrong deployment."\n          exit 0'),
  // ONE iteration, not two: a loop that runs once is the defect wearing a loop's shape,
  // and the guard that only asked for "a number" passed it.
  m("deploy: the wait no longer loops, so one read decides", Y,
    "          for i in $(seq 1 30); do", "          for i in $(seq 1 1); do"),
  m("deploy: THE VERIFICATION IS NOT TOLD WHICH VERSION THIS RUN DEPLOYED", Y,
    "          AGENT_URL: ${{ steps.deploy.outputs.url }}\n          EXPECT_VERSION: ${{ steps.serving.outputs.version }}\n          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}",
    "          AGENT_URL: ${{ steps.deploy.outputs.url }}\n          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}"),
  m("deploy: the re-deploy keeps no step id, so its version reaches nothing", Y,
    "        id: serving\n", "        id: serving_\n"),
  m("deploy: a deploy that printed no version id is accepted", Y,
    '          if [ -z "$ver" ]; then\n            echo\n            echo \'The deploy printed no version id', '          if [ -n "$ver" ]; then\n            echo\n            echo \'The deploy printed no version id'),
  // NOT a rename: renaming a step changes a DISPLAY STRING and nothing about the run, so
  // the first version of this mutant was inert by construction and survived for that
  // reason rather than for a missing check. Gating the step off is the real breakage —
  // the readers then compare against an empty string, which is the original defect back.
  m("deploy: the step that mints the version is gated off, so the readers get nothing", Y,
    "      - name: re-deploy, so the code and the secret are one version\n        id: serving\n        if: steps.gate.outputs.armed == 'true'",
    "      - name: re-deploy, so the code and the secret are one version\n        id: serving\n        if: false"),
  // THE ORIGINAL DEFECT, written out as a mutant: the wait held the Worker to the id the
  // DEPLOY step printed, which a later secret upload had already superseded.
  m("deploy: the wait is held to the deploy's id instead of the one that is serving", Y,
    "          EXPECT_VERSION: ${{ steps.serving.outputs.version }}\n        run: |\n          echo \"waiting for version",
    "          EXPECT_VERSION: ${{ steps.deploy.outputs.version }}\n        run: |\n          echo \"waiting for version"),
  m("worker: /health is cacheable again, so a stale version reads as the deployed one", W,
    '  "cache-control": "no-store",', "  \"x-note\": \"none\","),
  m("verify: the expected version is PRINTED rather than checked", V,
    '  check("the version serving is the one this run deployed",', '  console.log("the version serving is the one this run deployed",'),
  m("verify: the version check passes whatever answered", V,
    "const versionOk = healthBody.version === EXPECT_VERSION;", "const versionOk = true;"),
  m("verify: a missing expectation is silent, so a broken hop reads as a pass", V,
    '  console.log("      (EXPECT_VERSION is not set, so the version above is reported, not verified)");',
    "  void 0;"),
  m("verify: nothing checks that /health is uncacheable", V,
    'check("/health forbids caching", /no-store/i.test(cacheControl),', 'check("/health forbids caching", true,'),


  // ── the tool catalog and the second narrow door ───────────────────────────
  //
  // A customer's SELECTION is the one new thing a request can influence, so every
  // mutant here asks the same question from a different side: can a name decide
  // more than which of the catalog's own tools a run holds?
  m("narrowTools ignores the selection, so every authored run holds the whole catalog", D,
    "const tools = agent.tools.filter((t) => want.has(t.name));",
    "const tools = [...agent.tools];"),
  m("narrowTools takes the selection's order, so a stored list decides how the model sees its tools", D,
    "const tools = agent.tools.filter((t) => want.has(t.name));",
    "const tools = [...want].map((n) => agent.tools.find((t) => t.name === n)).filter(Boolean);"),
  m("narrowTools stops filtering the names to strings", D,
    'const want = new Set(names.filter((n) => typeof n === "string"));',
    "const want = new Set(names);"),
  m("narrowTools drops a retired tool in silence", D,
    "const unknown = Object.freeze([...want].filter((n) => !have.has(n)));",
    "const unknown = Object.freeze([]);"),
  m("narrowTools stops refusing a selection that is not a list", D,
    'if (!Array.isArray(names)) throw new TypeError("narrowTools: names must be an array");',
    "names = Array.isArray(names) ? names : [];"),
  // ⚠ REPLACED, BECAUSE THE OBVIOUS MUTANT ON THIS LINE IS INERT AND WAS MEASURED SO.
  // `!!spec.authored` and `spec.authored === true` are IDENTICAL over every input that
  // can reach them — the refusal above admits only an absent key or a real boolean, and
  // `[undefined, true, false]` maps to `[false, true, false]` either way. The refusal is
  // the wall and the comparison is the belt; the pair cannot be killed one at a time and
  // is declared in the code. What IS observable on this line is the DEFAULT flipping:
  // `!== false` makes an absent key mean AUTHORED, so every code agent in the registry
  // is narrowed against its own list and loses its tools.
  m("defineAgent's `authored` default flips, so every code agent is narrowed to nothing", D,
    "authored: spec.authored === true,", "authored: spec.authored !== false,"),
  m("defineAgent stops refusing a non-boolean `authored`", D,
    'if (Object.hasOwn(spec, "authored") && typeof spec.authored !== "boolean") {',
    "if (false) {"),

  // ── the registry ─────────────────────────────────────────────────────────
  m("the authored agent stops declaring itself authored, so nothing narrows it", A2,
    "    authored: true,\n    tools: OFFERED,", "    authored: false,\n    tools: OFFERED,"),
  m("the authored agent's catalog is emptied, so no selection can reach a tool", A2,
    "    tools: OFFERED,", "    tools: [],"),
  m("the tool budget goes back to one, which lets a run start and not finish", A2,
    "limits: { steps: 3, toolCalls: 2, wallMs: 60_000, callMs: 30_000 },",
    "limits: { steps: 3, toolCalls: 1, wallMs: 60_000, callMs: 30_000 },"),
  m("the catalog's NAMES gain one the catalog has no tool for", A2,
    "export const OFFERED_NAMES = Object.freeze(OFFERED.map((t) => t.name));",
    'export const OFFERED_NAMES = Object.freeze([...OFFERED.map((t) => t.name), "wait"]);'),

  // ── the snapshot ─────────────────────────────────────────────────────────
  m("the started entry stops carrying the selection", J,
    "  ...(o.tools === undefined ? {} : { tools: o.tools }),", "  ...({}),"),
  m("an absent selection becomes a stored null, so two different facts read alike", J,
    "  ...(o.tools === undefined ? {} : { tools: o.tools }),", "  ...({ tools: o.tools ?? null }),"),
  m("replay hands back the map of tool RESULTS under the name of the selection", J,
    "    tools: snapTools,", "    tools,"),
  m("a selection replay cannot read becomes an empty one rather than a problem", J,
    "      if (!Array.isArray(listed)) {", "      if (false) {"),
  m("replay accepts a name that is not text", J,
    '          if (typeof listed[i] !== "string" || listed[i] === "") { problems.push(`tools ${i}: not a tool name`); continue; }',
    "          if (false) { continue; }"),

  // ── the runner ───────────────────────────────────────────────────────────
  m("⚠ the narrowing is decided by the LOG, so a run with no snapshot gets the catalog", RN,
    "      if (registered.authored) {", "      if (open.state.authoredAgent) {"),
  m("⚠ an entry with no selection is left holding the whole catalog", RN,
    "      if (registered.authored) {", "      if (registered.authored && open.state.tools) {"),
  m("the runner stops narrowing at all", RN,
    "      if (registered.authored) {", "      if (false) {"),
  m("a retired tool disappears with nothing said", RN,
    "        if (narrowed.unknown.length) {", "        if (false) {"),

  // ── what the stand-in says about itself ──────────────────────────────────
  m("a tool-using answer loses its label, so a simulation reads as an AI's", ST,
    "      text: simulatedAnswer({ system, messages, tool: { name, said, failed } }),",
    "      text: `stand-in answer. you said: ${said}`,"),
  m("the slow shape's answer loses its label", ST,
    "        text: `${SIMULATED} worked through ${n} stages over ${waited} ms`,",
    "        text: `worked through ${n} stages over ${waited} ms`,"),
  m("a refused tool call is reported as the tool's own answer", ST,
    "    const failed = last?.content?.[0]?.ok === false;", "    const failed = false;"),

  // ── the controls: comment-only, and they MUST survive ──────────────────────
  m("CONTROL (comment only, limits.mjs)", L, "* THE BOUNDS ON ONE AGENT RUN", "* THE BOUNDS ON ONE AGENT RUN (control)", true),
  m("CONTROL (comment only, run.mjs)", R, "* THE AGENT LOOP.", "* THE AGENT LOOP (control).", true),
  m("CONTROL (comment only, agents.mjs)", A2,
    " * ⚠ THE CATALOG — every tool a CUSTOMER-AUTHORED agent may be given",
    " * ⚠ THE CATALOG (control) — every tool a CUSTOMER-AUTHORED agent may be given", true),
  m("CONTROL (comment only, model-standin.mjs)", ST,
    " * THE MODEL STAND-IN — no provider, no network, no spend.",
    " * THE MODEL STAND-IN (control) — no provider, no network, no spend.", true),
  m("CONTROL (comment only, runner.mjs)", at("runner.mjs"),
    "* THE CONSUMER — claim a delivery", "* THE CONSUMER (control) — claim a delivery", true),
  // The workflow gets its own control, because the guard that reads it splits on a
  // six-space `- name:` and a control proves the split still finds the steps when
  // ONLY a comment moved.
  m("CONTROL (comment only, agent-deploy.yml)", Y,
    "# ── the version this run may be held to ─", "# ── the version this run may be held to (control) ─", true),
  // ══════════════════════════════════════════════════════════════════════════
  // automations.mjs — the second executor
  // ══════════════════════════════════════════════════════════════════════════

  // ⚠ THE ONE THE WHOLE MILESTONE TURNS ON. A condition that does not match is not a
  // failure, and showing it as one tells a customer their automation is broken when it
  // did exactly what they asked.
  // RE-ANCHORED, NOT APPEASED: the outcomes became a keyed map so a resume can replace
  // one, so `outcomes.push` moved to `put(i, …)`. The property is unchanged.
  m("automations: a condition that does not match reads as FAILED", AU,
    'put(i, { outcome: met ? "ran" : "skipped", why });',
    'put(i, { outcome: met ? "ran" : "failed", why });'),
  m("automations: a condition that does not match no longer stops the workflow", AU,
    'if (!met) stopped = { kind: "skipped", at: id, why };',
    'if (!met) stopped = null;'),
  // A SKIP AND A FAILURE AFTER IT SAY THE SAME THING, so a reader cannot tell "an
  // earlier condition said not today" from "an earlier step broke".
  // RE-ANCHORED: the three readings are now composed once, above the fill, because a
  // rejection is a third ending. THREE kinds of skip have to say three things.
  m("automations: the two kinds of skip stop saying different things", AU,
    `  const why = stopped === null ? "" :
    stopped.kind === "failed" ? "an earlier step didn't work, so this one didn't run" :
    stopped.kind === "rejected" ? "it wasn't approved, so this one didn't run" :
    "an earlier condition didn't match, so this one didn't run";`,
    `  const why = "this one didn't run";`),
  // EVERY STEP GETS AN OUTCOME. A list shorter than the workflow shows a workflow that
  // stops for no stated reason.
  // RE-ANCHORED: the loop now BREAKS on a stop and the remaining steps are filled in
  // afterwards, so the mutant is the fill rather than a `continue` inside the walk.
  m("automations: the steps after a stop get no outcome at all", AU,
    "  if (stopped !== null) skipRange(0, steps.length, why);",
    "  void why;"),
  // ⚠ A CATCH-UP RUN MUST ASK ABOUT THE DAY IT WAS FOR. Reading the clock instead makes
  // "every Monday" quietly become "most Mondays".
  m("automations: the occurrence stops beating the clock", AU,
    "  if (occurrence) {\n    const day = weekdayOf(occurrence);",
    "  if (false) {\n    const day = weekdayOf(occurrence);"),
  // NO ZONE MEANS UTC AND SAYS SO. Guessing the Worker's locality invents one.
  m("automations: no zone guesses the runtime's own locality", AU,
    'const where = isText(zone) ? zone : "UTC";',
    "const where = isText(zone) ? zone : new Intl.DateTimeFormat().resolvedOptions().timeZone;"),
  // A STORED STEP WHOSE TYPE IS GONE MUST FAIL, not be skipped: skipping runs a
  // DIFFERENT workflow from the one somebody saved and reports it as fine.
  // RE-ANCHORED: the message is composed once now instead of twice.
  m("automations: a step type this deployment lacks is skipped instead of failed", AU,
    `      const error = \`there is no step called \${type || "(nothing)"} on this deployment\`;
      put(i, { outcome: "failed", error });`,
    `      const error = \`there is no step called \${type || "(nothing)"} on this deployment\`;
      put(i, { outcome: "skipped", why: error });`),
  // ⚠ READ AGAIN AT RUN TIME. These steps came back from a database, so they came from
  // outside — the same rule the journal follows for its own entries.
  m("automations: the stored config is trusted rather than read again", AU,
    "    const readIt = def.read(one);\n    if (readIt?.error) {",
    "    const readIt = { config: one };\n    if (readIt?.error) {"),
  // AN IMPOSSIBLE DATE IS NOT A DAY. `Date.UTC(2026, 1, 31)` rolls into March rather
  // than refusing, so the round trip is the whole check.
  m("automations: an impossible date is accepted as a day", AU,
    "  if (d.getUTCMonth() !== Number(m[2]) - 1 || d.getUTCDate() !== Number(m[3])) return null;",
    "  void d;"),
  // THE WEEK'S OWN ORDER, so saving one selection twice stores the same bytes.
  m("automations: a day selection keeps the ticking order rather than the week's", AU,
    "    return { config: { days: WEEKDAYS.filter((d) => picked.includes(d)) } };",
    "    return { config: { days: picked } };"),
  // REFUSED, NEVER COERCED: `String(["mon"])` is `"mon"`.
  m("automations: a nested list is coerced into a day", AU,
    '      if (typeof d !== "string") return { error: "one of the days didn\'t arrive as a day" };',
    "      void 0;"),
  // RE-ANCHORED, NOT APPEASED: the same property, past the sentence moving onto the field.
  m("automations: an empty day list is stored rather than refused", AU,
    '    if (!days.length) return { error: say.blank("days") };',
    "    void 0;"),
  // ── one sentence per refusal, whichever door ────────────────────────────────
  m("⚠ words: a refusal names the field's KEY rather than the word the field declares", AU,
    '  const words = Object.freeze(Object.fromEntries(all.map((f) => [f.name, isText(f.says) ? f.says : f.name])));',
    "  const words = Object.freeze(Object.fromEntries(all.map((f) => [f.name, f.name])));"),
  m("words: the blank sentence is composed rather than taken from the field", AU,
    "    [f.name, isText(f.empty) ? f.empty : `${words[f.name]} can't be empty`])));",
    "    [f.name, `${words[f.name]} can't be empty`])));"),
  m("⚠ words: the words never reach the step's own reader, so every phrase is the key", AU,
    "    read: (raw) => read(raw, say),", "    read: (raw) => read(raw),"),
  m("⚠ words: a non-string in a text field is read as BLANK rather than refused", AU,
    '  if (typeof raw !== "string") return { error: `${what} didn\'t arrive as text` };',
    "  if (typeof raw !== \"string\") return { empty: true };"),
  m("words: the too-long sentence names the field twice over", AU,
    "  if (text.length > max) return { error: `${what} is longer than it can be (${max} characters)` };",
    "  if (text.length > max) return { error: `${what} is longer than ${what} can be (${max} characters)` };"),
  // ⚠ REPLACED, NOT RETIRED. This mutated `readOut`'s DEFAULT parameter and SURVIVED, and the
  // reason was inert by construction: all SIX call sites pass their field's own words, so the
  // default was unreachable — and it was a second copy of `OUT_FIELD.says`, which is what
  // made even dropping an argument inert. The default is gone (see the reader's own comment)
  // and the property is observable from the side that matters: `readOut` serves `out` AND a
  // loop's `as`, so one field's words are wrong about the other.
  m("⚠ words: a loop's own control is refused in the OTHER field's words", AU,
    '      const as = readOut({ out: raw?.as }, say("as"));',
    '      const as = readOut({ out: raw?.as }, say("out"));'),
  // THE ID IS THE POSITION. A caller's own id is a second identity for one thing.
  // RE-ANCHORED, NOT APPEASED: the same property, past the expansion's stamp.
  m("automations: readWorkflow keeps a caller-supplied step id", AU,
    "    steps.push(Object.freeze({ id: `s${at}`, type: def.type, ...config, ...stamp }));",
    "    steps.push(Object.freeze({ id: one.id ?? `s${at}`, type: def.type, ...config, ...stamp }));"),
  // ── subworkflows ───────────────────────────────────────────────────────────
  m("⚠ subs: the expansion's snapshot stamp is dropped by the validator that runs next", AU,
    "    const stamp = stamped ? { from: one.from, ver: one.ver } : {};",
    "    const stamp = {};"),
  m("subs: a forged provenance stamp is stored rather than refused", AU,
    "    const stamped = isText(one.from) && UUID.test(one.from) && Number.isInteger(one.ver);",
    "    const stamped = isText(one.from);"),
  m("subs: a stamp names an automation without saying which version of it", AU,
    "    const stamped = isText(one.from) && UUID.test(one.from) && Number.isInteger(one.ver);",
    "    const stamped = isText(one.from) && UUID.test(one.from);"),
  m("⚠ subs: a cycle is reported as depth, sending somebody after nesting that is not there", AU,
    "    if (seen.includes(id)) {\n      return { error: `this automation runs itself: ${[...seen, id].join(\" → \")}` };\n    }",
    "    if (false) {\n      return { error: `this automation runs itself: ${[...seen, id].join(\" → \")}` };\n    }"),
  m("⚠ subs: the chain is unbounded, so a run can be built out of automations calling one another", AU,
    "    if (depth >= MAX_SUBWORKFLOW_DEPTH) {", "    if (false) {"),
  m("subs: the flattened list is unbounded, so it can be longer than the run may execute", AU,
    "  if (out.length > MAX_FLAT_STEPS) {", "  if (false) {"),
  m("⚠ subs: an automation that is not this agent's is expanded into nothing rather than refused", AU,
    '    if (!child) return { error: "one of the automations this runs is not one of this agent\'s" };',
    "    if (!child) continue;"),
  m("subs: a child that asks for its own inputs is copied in with them unbound", AU,
    "    if (Array.isArray(child.inputs) && child.inputs.length) {", "    if (false) {"),
  m("⚠ subs: a grandchild's steps are re-stamped as its parent's, so provenance names the wrong automation", AU,
    '      out.push(st && typeof st === "object" && Object.hasOwn(st, "from") ? st : { ...st, from: id, ver });',
    "      out.push({ ...st, from: id, ver });"),
  m("subs: what was copied in is never recorded, so nothing can say which version ran", AU,
    "    if (!uses.some((u) => u.id === id && u.version === ver)) uses.push({ id, version: ver });",
    "    void ver;"),
  m("subs: the ids are not re-minted, so two children both numbering their steps s1 collide", AU,
    "  return { steps: out.map((st, at) => ({ ...st, id: `s${at + 1}` })), uses };",
    "  return { steps: out, uses };"),
  m("subs: a caller with no way to look anything up expands a call into nothing", AU,
    '  if (typeof lookup !== "function") return { error: "there is no way to look up another automation here" };',
    '  if (typeof lookup !== "function") return { steps: list, uses };'),
  m("⚠ subs: a call that was never expanded is read as an action that did something", AU,
    '    if (def.stepKind === "call") {\n      const error = `${def.label} was supposed to be copied in before the run started, and was not`;',
    '    if (false) {\n      const error = `${def.label} was supposed to be copied in before the run started, and was not`;'),
  m("subs: the step's own refusal answers as though it had run", AU,
    '  run: () => ({ failed: "this automation was supposed to be copied in before the run started, and was not" }),',
    '  run: () => ({ result: "" }),'),
  m("subs: an id that is not an id is coerced rather than refused", AU,
    '    if (typeof given !== "string") return { error: "which automation to run didn\'t arrive as an automation" };',
    "    if (false) return { error: \"x\" };"),
  // IT REFUSES RATHER THAN SHORTENING.
  m("automations: a workflow over the cap is shortened instead of refused", AU,
    "  if (raw.length > max) return { error: `that's more steps than one automation can hold (${max})` };",
    "  if (raw.length > max) raw = raw.slice(0, max);"),
  // THE DAY THIS EXECUTION ASKED ABOUT RIDES ON THE STOP, or "skipped because it isn't
  // Monday" is unanswerable after the fact.
  // RE-ANCHORED: the return carries the values and the position now, and the day comes
  // off `day` rather than off a context that no longer exists at that point.
  m("automations: the stop forgets which day it asked about", AU,
    "    stop: { ...stop, on: day.date, weekday: day.weekday, zone: day.zone },",
    "    stop,"),
  // A STEP'S OWN THROW IS ITS OUTCOME, and `runWorkflow` never throws.
  // RE-ANCHORED, and the anchor had to gain its own neighbour: there are three `catch`
  // blocks in the walk now (the branch's, the step's, and the checkpoint's), so the bare
  // `} catch (e) {` is AMBIGUOUS and the generator refuses it. This one is the step's,
  // pinned by the line above it.
  m("automations: a step that throws escapes the executor", AU,
    `    try { answer = await def.run(config, ctxFor(resume)); }
    catch (e) {`,
    `    try { answer = await def.run(config, ctxFor(resume)); }
    catch (e) {
      throw e;`),
  // `fields` IS COMPELLED, so a step type cannot exist without saying what it is
  // configured with — which is what the site's census and the form both read.
  // RE-ANCHORED ONTO WHAT MOVED: an empty `fields` is now legal for a step that DECLARES
  // `configless`, because `otherwise` and `end` really have nothing to set. So the
  // property is no longer "fields is non-empty" — it is "an empty list is deliberate",
  // and the mutant is the declaration being waved through.
  m("automations: a step may be declared with no fields", AU,
    "  if (!fields.length && configless !== true) {",
    "  if (false) {"),

  // ══════════════════════════════════════════════════════════════════════════
  // automation-store.mjs — the three things the engine says about one
  // ══════════════════════════════════════════════════════════════════════════

  // ⚠ THE PROFILE NAMES THE RELATION AND DIFFERS BY DIRECTION. PostgREST IGNORES the
  // read header on a write, which is how a DELETE in the other product once resolved
  // against `public` and could never have worked.
  m("automation-store: every request sends the READ profile header", AS,
    "    ...profileFor(method, schema),", '    "accept-profile": schema,'),
  // THE TENANT IS IN THE FILTER, as the second wall behind the claim.
  m("automation-store: the execution is read without its tenant", AS,
    "        `automation_runs?id=eq.${encodeURIComponent(runId)}&tenant_id=eq.${encodeURIComponent(tenant)}`",
    "        `automation_runs?id=eq.${encodeURIComponent(runId)}`"),
  // REFUSED RATHER THAN COERCED: an unreadable `steps` is a row this process cannot
  // execute, and running it as empty reports a workflow nobody wrote as succeeded.
  m("automation-store: an unreadable steps list reads as an empty workflow", AS,
    "        steps: Array.isArray(row.steps) ? row.steps : null,",
    "        steps: Array.isArray(row.steps) ? row.steps : [],"),
  m("automation-store: a claim with no tenant is allowed to read", AS,
    '      if (!isText(tenant)) throw new TypeError("read: tenant must be a non-empty string, from the claim");',
    "      void tenant;"),

  // ══════════════════════════════════════════════════════════════════════════
  // work.mjs and runner.mjs — the hop, and the routing
  // ══════════════════════════════════════════════════════════════════════════

  // ⚠ THE HOP THAT REALLY SHIPPED DEAD. Every automation delivery came back `no-agent`
  // with the branch, the column and the migration all correct.
  m("work: the claim's executor is not forwarded to the runner", W ? at("work.mjs") : at("work.mjs"),
    '        executor: isText(answer.executor) ? answer.executor.trim() : "agent",',
    "        // the field is dropped"),
  m("work: an unreadable executor fails OPEN to the automation path", at("work.mjs"),
    '        executor: isText(answer.executor) ? answer.executor.trim() : "agent",',
    '        executor: isText(answer.executor) ? answer.executor.trim() : "automation",'),
  // THE ROUTING ITSELF, and it is asked BEFORE the agent registry is consulted.
  m("runner: an automation delivery falls through to the agent loop", RN,
    '      if (claim.executor === "automation") {\n        return await deliverAutomation();',
    '      if (false) {\n        return await deliverAutomation();'),
  m("runner: EVERY delivery is routed to the workflow", RN,
    '      if (claim.executor === "automation") {\n        return await deliverAutomation();',
    '      if (true) {\n        return await deliverAutomation();'),
  // A DEPLOYMENT WITH NO EXECUTOR SAYS SO rather than routing into the agent loop.
  m("runner: a deployment with no automation executor is silent about it", RN,
    '      return await finish(true, "no-executor", "this deployment has no automation executor");',
    '      return await finish(true, "ran", null);'),
  // THE FINISHED TRANSACTION HAS ALREADY RELEASED. A second release clears a claim the
  // database has already cleared and lies in the log about who let go of what.
  m("runner: an automation releases twice", RN,
    "      stopBeating();\n      onEvent({ at: \"done\", runId, why: \"ran\", done: true, reason: stop?.reason ?? null });\n      return { ran: true, why: \"ran\", runId, stop, error: null };",
    "      return await finish(true, \"ran\", null, stop);"),
  // A FENCED REFUSAL MEANS THE CLAIM IS GONE: the flag is corrected from the one source
  // that knows, and nothing is released, because somebody else holds it.
  m("runner: an automation's fenced refusal releases the run anyway", RN,
    '        if (CLAIM_GONE.includes(why)) {\n          held = false; lostBecause = "lease-lost";\n          return await finish(false, "lease-lost", why);',
    '        if (CLAIM_GONE.includes(why)) {\n          return await finish(true, "lease-lost", why);'),
  // AN EXECUTION RECORD THAT IS GONE COMES OFF THE QUEUE — another delivery cannot help.
  m("runner: a missing execution record is retried for ever", RN,
    '      return await finish(true, "unreadable", "this run has no automation execution record");',
    '      return await finish(false, "unreadable", "this run has no automation execution record");'),
  // THE CONFIGURATION IS THE SNAPSHOT'S. Reading the definition instead would make an
  // in-flight execution editable from outside.
  // ⚠ RE-ANCHORED, NOT APPEASED: the `steps:` line became `steps,` when the runner gained a
  // local for the flattened list, so the old anchor named bytes that had moved. The PROPERTY
  // is unchanged — the zone and the occurrence come from the snapshot rather than from
  // nowhere — and the two lines the mutant really turns off are still the two it names.
  m("runner: the workflow is read live instead of from the snapshot", RN,
    "        zone: exec.zone,\n        occurrence: exec.occurrence,",
    "        zone: null,\n        occurrence: null,"),

  // ══════════════════════════════════════════════════════════════════════════
  // worker.mjs — the scheduler on the cron
  // ══════════════════════════════════════════════════════════════════════════

  // ⚠ THE TWO JOBS ARE TWO BLOCKS. A scheduler that threw would take down the sweeper,
  // which is the recovery for every dropped run in the deployment.
  m("worker: the schedule's failure takes the sweeper down with it", W,
    "    let automations;\n    try { automations = buildAutomations(env); }",
    "    let automations;\n    if (true) { automations = buildAutomations(env); }"),
  m("worker: the cron no longer files what is due at all", W,
    "      const filed = await automations.tick({\n        catchupS: AUTOMATION_CATCHUP_S, limit: AUTOMATION_TICK_LIMIT,\n      });",
    "      const filed = [];"),
  // ONLY A FILED EXECUTION HAS SOMETHING TO DELIVER. A missed or refused occurrence is
  // already finished and has no work row, so ringing for one is a doorbell for a run
  // nothing will ever claim.
  m("worker: the cron rings for occurrences that were never queued", W,
    '        if (action === "filed" && isText(runId)) {',
    "        if (isText(runId)) {"),
  // THE CATCH-UP WINDOW IS THE DECISION about what happens after downtime.
  m("worker: the catch-up window becomes unbounded, so downtime is a burst", W,
    "export const AUTOMATION_CATCHUP_S = 3600;",
    "export const AUTOMATION_CATCHUP_S = 3600 * 24 * 3650;"),
  // ══════════════════════════════════════════════════════════════════════════
  // capabilities.mjs and capability-tools.mjs — what an agent's tools may reach
  // ══════════════════════════════════════════════════════════════════════════
  m("caps: the tenant comes from an ARGUMENT, so a model can name another account", CP,
    "              return list(await rpc(CAPABILITY_RPC.listMemory, { p_tenant: tenant, p_agent_id: agentId }));",
    "              return list(await rpc(CAPABILITY_RPC.listMemory, { p_tenant: arguments[0]?.tenant ?? tenant, p_agent_id: agentId }));"),
  m("caps: the agent comes from an ARGUMENT, so one agent reads its sibling's memory", CP,
    "              return list(await rpc(CAPABILITY_RPC.listKnowledge, { p_tenant: tenant, p_agent_id: agentId }));",
    "              return list(await rpc(CAPABILITY_RPC.listKnowledge, { p_tenant: tenant, p_agent_id: arguments[0]?.agent ?? agentId }));"),
  m("caps: a row belonging to a SIBLING agent is handed over", CP,
    "            return owner === agentId ? row : null;", "            return row;"),
  m("caps: the sibling wall reads a field nothing writes, so it refuses everything", CP,
    "            const owner = row.agent ?? row.agent_id ?? null;", "            const owner = row.owner ?? null;"),
  m("caps: an execution is answered without asking whose automation it is", CP,
    "              return (await this.readAutomation({ id: row.automation })) ? row : null;", "              return row;"),
  m("caps: a history is answered without asking whose automation it is", CP,
    "              if (!(await this.readAutomation({ id: automation }))) return [];", "              void automation;"),
  m("caps: `enabled` is COERCED, so the string \"false\" turns an automation ON", CP,
    '              if (typeof enabled !== "boolean") return { ok: false, error: "bad-enabled" };',
    "              if (enabled === undefined) return { ok: false, error: \"bad-enabled\" };"),
  m("caps: an id is taken on trust, so a junk one reaches the database", CP,
    "const isId = (v) => typeof v === \"string\" && UUID.test(v);",
    "const isId = (v) => typeof v === \"string\";"),
  m("caps: the profile header is the same for a read and a write", CP,
    "    ...profileFor(method, schema),", "    \"accept-profile\": schema,"),
  // THE DEFECT AS IT REALLY SHIPPED: ten of these fourteen operations sent the READ header
  // on their POST, `read_automation` — the pre-check `pause_automation` and
  // `run_automation` each make first — among them.
  m("caps: the profile is asked about a method these RPCs never send", CP,
    "    ...profileFor(method, schema),", '    ...profileFor("GET", schema),'),

  // ── approvals.mjs: THE IDENTITY, TAKEN APART ──────────────────────────────
  // ⚠ THE SPLIT IS WHAT LETS THE RECORD STATE ITS OWN RULE. Folded into one key, two
  // different argument sets are two different keys and therefore two separate operations,
  // silently — the requirement's own counterexample.
  m("identity: the hash is part of the key, so a re-filled slot is a second operation", AP,
    "  const key = operation.slice(0, cut);", "  const key = operation;"),
  m("identity: the position is dropped, so every call in a run shares one key", AP,
    "  const hash = operation.slice(cut + 1);", '  const hash = "";'),
  m("identity: a malformed operation is repaired into a key rather than refused", AP,
    "  if (!/^[^\\s:]+:\\d+:\\d+$/.test(key)) return null;", "  if (false) return null;"),
  m("identity: a hash with anything in it is accepted", AP,
    "  if (!/^[0-9a-zA-Z+/=_-]+$/.test(hash)) return null;", "  if (false) return null;"),
  m("identity: a non-string is coerced into one", AP,
    '  if (typeof operation !== "string") return null;', '  operation = String(operation ?? "");'),
  // ⚠ **THE TRAILING-COLON CLAUSE HAS NO MUTANT, AND THAT IS DECLARED RATHER THAN FORGOTTEN.**
  // It survived as `if (cut <= 0)` and was then MEASURED INERT over 18 shapes — every answer
  // identical — because the hash charset test below already refuses an empty hash. It is a
  // deliberate second wall, said so in `approvals.mjs`, and the property it is about ("a hash
  // is REQUIRED") is swept by the charset mutant just below, which IS observable: a hash with
  // a forbidden character reads as an identity without it.
  // *A replacement for an inert mutant has to be observable, not relabelled.*
  m("identity: any seed is read as a run, so a non-uuid reaches a uuid column", AP,
    "  return Object.freeze({ key, hash, run: UUID_SHAPE.test(seed) ? seed : null });",
    "  return Object.freeze({ key, hash, run: seed });"),

  // ── capabilities.mjs: EVERY WRITE GOES THROUGH ITS RECORD ─────────────────
  // ⚠ THE DEFECT THIS CLOSES WAS MEASURED: a retry of `remember` overwrote a person's
  // correction, `saved: "corrected"`, v3 over their v2. Falling through to the plain function
  // is the fail-OPEN direction, so a missing identity REFUSES.
  m("caps: a write with no identity falls through to the unprotected function", CP,
    "    if (!id) {\n      return { ok: false, error: operation === undefined || operation === null\n        ? \"operation-required\" : \"operation-unreadable\" };\n    }",
    "    if (!id) return rpc(CAPABILITY_RPC[op], body);"),
  m("caps: an unreadable identity is not told from an absent one", CP,
    "      return { ok: false, error: operation === undefined || operation === null\n        ? \"operation-required\" : \"operation-unreadable\" };",
    '      return { ok: false, error: "operation-required" };'),
  m("caps: the write asks the plain function, so nothing is recorded", CP,
    "    return rpc(`${CAPABILITY_RPC[op]}_once`, {", "    return rpc(`${CAPABILITY_RPC[op]}`, {"),
  m("caps: the arguments' hash is not sent, so a re-filled slot cannot be told apart", CP,
    "      p_op_key: id.key, p_args_hash: id.hash, p_op_run: id.run, ...body,",
    "      p_op_key: id.key, p_args_hash: id.key, p_op_run: id.run, ...body,"),

  // ── capability-tools.mjs: THE IDENTITY COMES FROM `ctx`, NEVER AN ARGUMENT ──
  m("tools: `pause_automation` takes its identity from an argument", CT,
    "enabled: args.enabled, operation: ctx?.operation });",
    "enabled: args.enabled, operation: args.operation ?? ctx?.operation });"),
  m("tools: `run_automation` takes its identity from an argument", CT,
    "input: args.input ?? {}, operation: ctx.operation });",
    "input: args.input ?? {}, operation: args.operation ?? ctx.operation });"),

  // ── THE RECORD IS ASKED BEFORE THE ROW DECIDES ────────────────────────────
  //
  // ⚠ **REPRODUCED before any of this existed**: an edit moved a daily automation from 09:00
  // to 10:00, its answer was lost, and the retry of the SAME operation read the stored row,
  // found 10:00 already there, computed an empty patch and answered `nothing-asked` — never
  // reaching `patch_automation_once`, which held that operation's success. Ten mutants, because
  // the consult can be broken at the reader, at either tool, at the mapping, or at the action
  // it asks about — and each of those failures looks different from outside.
  m("tools: an edit never asks the record, so a retry refuses over a recorded success", CT,
    '    const seen = await recordFor(can, ctx, "patchAutomation");',
    '    const seen = { state: "unknown" };'),
  m("tools: a create never asks the record, so a retry refuses for a zone somebody cleared", CT,
    '    const seen = await recordFor(can, ctx, "createAutomation");',
    '    const seen = { state: "unknown" };'),
  // ⚠ CANNOT-TELL READ AS A VALUE, in the direction that INVENTS a success — an unreadable
  // answer would answer `ok` with no outcome behind it.
  m("tools: a record nobody could read is treated as a repeat", CT,
    '  if (state === null) return { state: "unknown" };',
    '  if (state === null) return { state: "repeat" };'),
  // ⚠ A RECORDED REFUSAL LAUNDERED INTO A SUCCESS — the first draft's own defect, and worse
  // than the one being fixed: the wrapper records whatever the plain function answered.
  m("tools: a recorded FAILURE is answered as a success on retry", CT,
    "  if (was.ok !== true) {\n    return { ok: false, recorded: true,",
    "  if (false) {\n    return { ok: false, recorded: true,"),
  m("tools: an identity reused for different work is answered rather than refused", CT,
    '    if (seen.state === "mismatch") return REUSED(seen);\n    if (seen.state === "repeat") {\n      return recalled(seen, text(args.id),',
    '    if (seen.state === "repeat") {\n      return recalled(seen, text(args.id),'),
  // ⚠ THE OWNERSHIP CHECK MUST STAY IN FRONT. Asked first, the record would answer for an
  // automation this agent may not touch — and the requirement is explicit that the ownership
  // wall is preserved.
  m("tools: the record is asked before whose automation it is", CT,
    "    const held = await can.readAutomation({ id: text(args.id) });\n    if (!held) {",
    '    const held = (await recordFor(can, ctx, "patchAutomation")).state === "repeat"\n      ? { id: text(args.id), schedule: "manual", steps: [], inputs: [] }\n      : await can.readAutomation({ id: text(args.id) });\n    if (!held) {'),
  // ⚠ `changed` IS COMPUTED FROM THIS ATTEMPT'S PATCH, so reporting it on a repeat is a
  // statement about a row somebody may have moved rather than about the edit that happened.
  m("tools: a repeat invents what changed", CT,
    "  return { ok: true, repeat: true,\n    ...(typeof was.id === \"string\" ? { automation: was.id }",
    "  return { ok: true, repeat: true, changed: [],\n    ...(typeof was.id === \"string\" ? { automation: was.id }"),
  // ── capabilities.mjs: THE RECORD READER ───────────────────────────────────
  //
  // ⚠ THE ACTION IS DERIVED FROM `CAPABILITY_RPC`, so it is the same name the `_once` wrapper
  // records under. Hardcoded, it asks about a different operation and every answer is `fresh`.
  m("caps: the record is asked about a hardcoded action rather than the operation's own", CP,
    "                p_tenant: tenant, p_op_key: id.key, p_action: fn, p_args_hash: id.hash,",
    '                p_tenant: tenant, p_op_key: id.key, p_action: "patch_automation", p_args_hash: id.hash,'),
  // ⚠ ONLY A WRITE HAS A RECORD. Admitting a read would have it asking about an operation
  // that records nothing, and every answer would be `fresh` — a question with no subject.
  m("caps: a READ is admitted to the record question", CP,
    "              if (!fn || !CAPABILITY_WRITES.includes(op)) {",
    "              if (!fn) {"),
  // ⚠ AND A MALFORMED IDENTITY MUST NOT MINT A KEY. One invented from a junk identity
  // collides with something, which is the whole reason `splitOperation` refuses.
  m("caps: a malformed identity is read as a record question anyway", CP,
    "              const id = splitOperation(operation);\n              if (!id) {",
    '              const id = splitOperation(operation) ?? { key: String(operation), hash: "" };\n              if (false) {'),

  // ── capability-tools.mjs: WRITING A WORKFLOW ──────────────────────────────
  // ⚠ WHAT REACHES THE DATABASE IS `readWorkflow`'S OWN OUTPUT, NEVER THE MODEL'S LIST —
  // a validation that happens BESIDE the call rather than in front of it is the shape of
  // every "it was checked" defect this repository records.
  m("tools: the model's own step list reaches the database, validated beside rather than in front", CT,
    "  return { ok: true, steps: read.steps, produces: read.produces };",
    "  return { ok: true, steps: raw, produces: read.produces };"),
  // ⚠ RE-ANCHORED, NOT APPEASED: the schedule wall was inserted between the check and the
  // call, so the three-line anchor no longer matched. The property is unchanged — a workflow
  // that does not read must not be saved — and it is pinned on the check plus its own refusal,
  // which is the shortest window that is still unique.
  m("tools: a workflow that does not read is saved anyway", CT,
    "    const read = checkSteps(args.steps, asked.inputs ?? []);\n    if (!read.ok) return read;\n    const when = readTrigger(args);",
    "    const read = checkSteps(args.steps, asked.inputs ?? []);\n    const when = readTrigger(args);"),
  // ⚠ AND THE DECLARATIONS MUST REACH THE READER, or a step using `{{an_input}}` is refused on
  // the one save that introduces it — the defect this round fixed. Two mutants, because the
  // hop can be cut at either end: the reader not told, or the declarations not validated.
  m("tools: the steps are checked against no declarations", CT,
    "    const read = checkSteps(args.steps, asked.inputs ?? []);\n    if (!read.ok) return read;\n    const when = readTrigger(args);",
    "    const read = checkSteps(args.steps, []);\n    if (!read.ok) return read;\n    const when = readTrigger(args);"),
  // ⚠ ANCHORED THROUGH `authorableSchedule`, because `check_workflow` opens with the same three
  // lines — the two tools really do read their declarations identically, which is the point.
  m("tools: a create's declarations are stored without being read", CT,
    "    const asked = readInputs(args.inputs);\n    if (!asked.ok) return asked;\n    const read = checkSteps(args.steps, asked.inputs ?? []);\n    if (!read.ok) return read;\n    const when = readTrigger(args);",
    "    const asked = { ok: true, inputs: Array.isArray(args.inputs) ? args.inputs : null };\n    const read = checkSteps(args.steps, asked.inputs ?? []);\n    if (!read.ok) return read;\n    const when = readTrigger(args);"),
  // ⚠ AND THE WALL ITSELF: a description is not a wall, so a model may write a schedule this
  // tool has no fields for and the DATABASE's wholeness check would refuse it as an exception.
  m("tools: a schedule this tool cannot describe is passed on anyway", CT,
    "  if (!AUTHORABLE_SCHEDULES.includes(asked)) {", "  if (false) {"),
  // ⚠ **THE OLD MUTANT HERE WIDENED THE AUTHORABLE SET, and the product has since widened it
  // deliberately — with the FIELDS to describe each schedule.** So the mutation that matters
  // now is the opposite: a schedule offered whose own needs the tool cannot express, which is
  // exactly the dead control the narrowing used to prevent. Four mutants, because the wholeness
  // can be broken at the declaration, at the reader, or at either field on the way to the store.
  m("tools: a schedule is offered whose needs nothing declares", CT,
    '  weekly: Object.freeze(["atLocal", "days"]),',
    '  weekly: Object.freeze([]),'),
  m("tools: a weekly schedule stores no days, which the column refuses", CT,
    "      days: when.days,\n      onDate: when.onDate,",
    "      onDate: when.onDate,"),
  m("tools: a one-off stores no date", CT,
    "      onDate: when.onDate,\n      onEvent: when.onEvent,",
    "      onEvent: when.onEvent,"),
  m("tools: a day a week does not have is repaired instead of refused", CT,
    "    if (!WEEKDAYS.includes(name)) {",
    "    if (false) {"),
  m("tools: an event name wider than the other door's is admitted", CT,
    "export const AGENT_EVENT_SHAPE = /^[a-z][a-z0-9._-]{0,63}$/;",
    "export const AGENT_EVENT_SHAPE = /^[a-z][a-z0-9._-]{0,255}$/;"),
  m("tools: an edit re-zones a live automation from the account setting", CT,
    "  const kept = held && typeof held.zone === \"string\" && held.zone.trim() ? held.zone.trim() : null;\n  if (kept) return { zone: kept };",
    "  const kept = null;"),
  m("tools: a trigger read puts every field on the patch, not only what moved", CT,
    "      if (when.schedule !== text(held.schedule)) patch.schedule = when.schedule;",
    "      patch.schedule = when.schedule;"),
  m("tools: a trigger field named alone is read against no stored schedule", CT,
    '        Object.hasOwn(args, "schedule") ? args : { ...args, schedule: text(held.schedule) || "manual" },',
    "        args,"),
  // ⚠ A NON-STRING SCHEDULE SILENTLY BECAME `manual`, so an agent asking for a daily run got
  // an automation that runs by hand and was told `ok`. Found by a guard written for the mutant
  // above it, and the same shape was live in the SITE's own reader.
  m("⚠ tools: a schedule that is not a word becomes `manual` rather than a refusal", CT,
    '  if (raw !== undefined && raw !== null && typeof raw !== "string") {',
    "  if (false) {"),
  m("⚠ tools: a BLANK schedule becomes `manual` rather than a refusal", CT,
    "  if (!asked) {\n    return { error: \"bad-schedule\", say: `say when it runs:",
    "  if (false) {\n    return { error: \"bad-schedule\", say: `say when it runs:"),
  m("tools: creating an automation needs nobody", CT,
    "  approval: true,\n  run: async (args, can, ctx) => {\n    const asked = readInputs(args.inputs);",
    "  run: async (args, can, ctx) => {\n    const asked = readInputs(args.inputs);"),
  // ⚠ **THIS ONE WAS A MUTANT THAT CHANGED NOTHING BUT A COMMENT, and it was tallied as a
  // product mutant for a whole round.** Its `to` inserted `// no approval` into the run body
  // and left `approval: true` exactly where it was — `from` and `to` are IDENTICAL once
  // comments are stripped, which is the definition of a control, so it survived every pass
  // and read as a test gap. The gate is on the TOOL, so that is where the anchor has to be.
  m("tools: changing an automation needs nobody", CT,
    "  approval: true,\n  /**\n   * ⚠ **AN EDIT CHANGES ONLY WHAT IT NAMES",
    "  /**\n   * ⚠ **AN EDIT CHANGES ONLY WHAT IT NAMES"),
  m("tools: a SIBLING agent's automation can be rewritten", CT,
    '    const held = await can.readAutomation({ id: text(args.id) });\n    if (!held) {\n      return { ok: false, error: "no-automation", say: "there is no automation of this agent\'s with that id" };\n    }',
    "    const held = (await can.readAutomation({ id: text(args.id) })) ?? {};"),
  // ── THE ZONE, AND THE PATCH ───────────────────────────────────────────────
  //
  // Both are this round's fixes and both fail in the direction that looks like working: a
  // guessed zone makes a schedule fire at the wrong hour while every reader agrees it is
  // right, and an edit that carries a field it was not asked about resets a live automation
  // while answering `ok`.
  // ⚠ **AND THIS ONE WAS INERT, MEASURED RATHER THAN REASONED ABOUT.** It added
  // `zone: "UTC"` to the object `zoneFor` REFUSES with — and every caller asks `zone.error`
  // before it reads `zone.zone`, so a refusal carrying a zone is still a refusal and no
  // observable answer moved. The defect the label names is the FALLBACK: a setting that is
  // absent resolving to a guessed zone instead of a question.
  m("tools: a missing zone is guessed instead of asked for", CT,
    "    ? settings.zone.trim() : null;",
    '    ? settings.zone.trim() : "UTC";'),
  m("tools: a daily schedule is saved with no zone at all", CT,
    '  if (!NEEDS_A_ZONE.includes(schedule)) return { zone: null };',
    '  return { zone: null };'),
  m("tools: every schedule is made to demand a zone, including a manual one", CT,
    '  Object.keys(SCHEDULE_NEEDS).filter((k) => SCHEDULE_NEEDS[k].includes("atLocal")));',
    "  Object.keys(SCHEDULE_NEEDS));"),
  // ⚠ AND ITS OPPOSITE: a TIMED schedule that demands none, which is the row the column
  // refuses. The derivation can be broken either way and only one of them is obvious.
  m("tools: a timed schedule is allowed to have no zone", CT,
    '  Object.keys(SCHEDULE_NEEDS).filter((k) => SCHEDULE_NEEDS[k].includes("atLocal")));',
    '  Object.keys(SCHEDULE_NEEDS).filter((k) => k === "daily"));'),
  m("tools: the resolved zone is never sent, so the database raises", CT,
    "      onEvent: when.onEvent,\n      zone: zone.zone,",
    "      onEvent: when.onEvent,"),
  m("tools: an edit sends a whole replace, resetting what it did not name", CT,
    '    if (Object.hasOwn(args, "name")) patch.name = text(args.name);\n    if (Object.hasOwn(args, "enabled")) patch.enabled = args.enabled;',
    '    patch.name = text(args.name);\n    patch.enabled = args.enabled !== false;'),
  // ⚠ TRUTHINESS RATHER THAN PRESENCE IS THE QUIET VERSION OF THE SAME DEFECT: it drops
  // `enabled: false` and an empty step list, which are the two edits somebody most needs.
  m("tools: an edit asks whether a field is truthy rather than present", CT,
    '    if (Object.hasOwn(args, "enabled")) patch.enabled = args.enabled;',
    '    if (args.enabled) patch.enabled = args.enabled;'),
  m("tools: an edit checks new steps against no declarations", CT,
    "    const inputs = asked.inputs ?? (Array.isArray(held.inputs) ? held.inputs : []);",
    "    const inputs = asked.inputs ?? [];"),
  m("tools: an edit's steps are not validated at all", CT,
    "      const read = checkSteps(steps, inputs);\n      if (!read.ok) return read;",
    "      const read = checkSteps(steps, inputs);"),
  // ⚠ **THE TIME IS PART OF THE TRIGGER READ NOW, so the mutants aim there.** Both of these
  // are rows the column refuses: `daily` with no time, and `manual` WITH one.
  m("tools: a schedule change leaves its time behind, so the row cannot be whole", CT,
    '  if (needs.includes("atLocal")) {',
    "  if (false) {"),
  m("tools: a move to manual keeps a time the wholeness check refuses", CT,
    "  const out = { schedule, atLocal: null, days: [], onDate: null };",
    "  const out = { schedule, atLocal: text(args.atLocal) || null, days: [], onDate: null };"),
  m("tools: a timed schedule takes its time from the call only, never from the row", CT,
    '    const at = readAt(Object.hasOwn(args, "atLocal") ? args.atLocal : storedAt);',
    "    const at = readAt(args.atLocal);"),
  // ⚠ **THE STORED SHAPE, AND THIS IS THE DEFECT A REAL DATABASE FOUND.** A row answers
  // `"09:00:00"` and the tool sends `"09:00"`; a reader that takes only the short form cannot
  // read a schedule's own time back, so an edit naming only the DAYS was refused `bad-time`.
  m("tools: the stored time shape is not readable, so an unrelated edit is refused", CT,
    "const AT_SHAPE = /^([01][0-9]|2[0-3]):[0-5][0-9](:00)?$/;",
    "const AT_SHAPE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;"),
  m("tools: a time is compared in two shapes, so an unchanged one reads as moved", CT,
    "      if (when.atLocal !== (readAt(held.atLocal) || null)) patch.atLocal = when.atLocal;",
    "      if (when.atLocal !== (held.atLocal ?? null)) patch.atLocal = when.atLocal;"),
  m("tools: a stored time with real seconds is accepted and the column refuses it", CT,
    "  return AT_SHAPE.test(t) ? t.slice(0, 5) : \"\";",
    "  return t.slice(0, 5);"),
  // ⚠ **A DECLARED REDUNDANCY, MUTATED AS A PAIR — because the shape test alone cannot be
  // killed.** MEASURED over twelve real spellings: NOT ONE is refused by `DATE_SHAPE` alone.
  // Everything it rejects, `Date.parse` or the round-trip rejects too, so cutting the shape
  // test out moves no answer and reads as a test gap. The two are kept because they refuse
  // different things — the shape says the ask is not a date at all, the round-trip says it is
  // not a real day (`2027-02-29`) — and `"4 July"` is why the shape is not decoration:
  // `Date.parse("4 JulyT00:00:00Z")` is NOT NaN, so without the round-trip behind it the
  // lenient fallback would take it. This mutant removes BOTH walls, which must die.
  m("tools: a date that is not a date is stored anyway", CT,
    "    if (!DATE_SHAPE.test(on) || Number.isNaN(Date.parse(`${on}T00:00:00Z`))\n        || new Date(`${on}T00:00:00Z`).toISOString().slice(0, 10) !== on) {",
    "    if (Number.isNaN(Date.parse(`${on}T00:00:00Z`))) {"),
  m("tools: an impossible calendar date passes because only the shape is asked", CT,
    '        || new Date(`${on}T00:00:00Z`).toISOString().slice(0, 10) !== on) {',
    "        || false) {"),
  m("tools: an edit naming nothing answers ok about nothing", CT,
    '    if (Object.keys(patch).length === 0) {',
    '    if (false) {'),
  m("tools: the version fence is dropped on the way to the store", CT,
    "      version: Number.isInteger(args.ifVersion) ? args.ifVersion : undefined,",
    "      version: undefined,"),
  m("tools: a stale refusal is reported as something else", CT,
    '      return { ok: false, error: answer?.error ?? "refused", say: sayAutomation(answer?.error, answer),',
    '      return { ok: false, error: answer?.error ?? "refused", say: sayAutomation(answer?.error),'),
  // ── THE INPUT READER ──────────────────────────────────────────────────────
  m("tools: an unknown input type is coerced to text instead of refused", CT,
    "    if (d.type !== undefined && !VALUE_TYPES.includes(d.type)) {",
    "    if (false) {"),
  m("tools: a required flag out of a string makes every input required", CT,
    '    if (d.required !== undefined && typeof d.required !== "boolean") {',
    "    if (false) {"),
  m("tools: two inputs of one name are both kept, so a reference resolves to neither", CT,
    '    if (seen.has(name)) return no(`there is already something called "${name}"`);',
    "    if (false) return no(`duplicate`);"),
  m("tools: the input ceiling the column enforces is not asked here", CT,
    "  if (raw.length > MAX_TOOL_INPUTS) {",
    "  if (false) {"),
  m("tools: an absent declaration list reads as an empty one, clearing what is stored", CT,
    "  if (raw === undefined || raw === null) return { ok: true, inputs: null };",
    "  if (raw === undefined || raw === null) return { ok: true, inputs: [] };"),
  m("tools: a created automation's id is minted fresh, so a redelivery makes a second", CT,
    "      id: await uuidFrom(`automation:${ctx?.operation ?? \"\"}`),",
    "      id: await uuidFrom(`automation:${Math.random()}`),"),
  // ── ⚠ WHY A RUN WAS NOT STARTED, IN WORDS A MODEL CAN ACT ON ──────────────
  //
  // Every refusal but `disabled` answered one sentence, so a call that left out a required
  // answer or sent the wrong kind was told only that it failed — a failure that cannot name
  // itself, about the model's OWN arguments.
  m("⚠ tools: a start refusal answers one sentence for every cause", CT,
    "        say: sayStart(answer?.error, answer?.name, answer?.wanted) };",
    '        say: answer?.error === "disabled" ? "that automation is turned off" : "that automation could not be started" };'),
  m("tools: a start refusal does not name WHICH answer was wrong", CT,
    "        say: sayStart(answer?.error, answer?.name, answer?.wanted) };",
    "        say: sayStart(answer?.error, null, answer?.wanted) };"),
  m("tools: a start refusal does not say what kind of thing was wanted", CT,
    "        say: sayStart(answer?.error, answer?.name, answer?.wanted) };",
    "        say: sayStart(answer?.error, answer?.name, null) };"),
  // ⚠ AND A KIND NOTHING RECOGNISES MUST FALL BACK RATHER THAN INVENT ONE: a made-up
  // explanation is worse than none, and this is the direction that cannot be seen from outside.
  m("tools: an unrecognised kind is described anyway", CT,
    '                 "list-of-text": "a list whose every item is text" }[wanted] ?? null;',
    '                 "list-of-text": "a list whose every item is text" }[wanted] ?? String(wanted);'),

  m("tools: the catalog a model reads is not the whole registry", CT,
    "    actions: AUTOMATION_STEPS.map((d) => ({", "    actions: AUTOMATION_STEPS.slice(1).map((d) => ({"),
  m("tools: the step ceiling a model is told is not the platform's", CT,
    "    max: MAX_WORKFLOW_STEPS,", "    max: 999,"),
  m("tools: checking a workflow secretly writes one", CT,
    "  input: { type: \"object\", properties: { steps: STEPS_FIELD, inputs: INPUTS_FIELD }, required: [\"steps\"] },\n  repeatable: true,",
    "  input: { type: \"object\", properties: { steps: STEPS_FIELD, inputs: INPUTS_FIELD }, required: [\"steps\"] },\n  writes: true,\n  repeatable: true,"),
  // ⚠ AND A CHECK THAT IGNORES THE DECLARATIONS IS CHECKING A DIFFERENT WORKFLOW FROM THE ONE
  // THE SAVE WILL — the shape that made `{{customer}}` unusable through every authoring tool.
  m("tools: the check ignores the declarations it was given", CT,
    "    const read = checkSteps(args.steps, asked.inputs ?? []);\n    if (!read.ok) return read;\n    return { ok: true, steps: read.steps.length",
    "    const read = checkSteps(args.steps);\n    if (!read.ok) return read;\n    return { ok: true, steps: read.steps.length"),

  // ── rest-profile.mjs: THE ONE RULE ────────────────────────────────────────
  // Five stores ask this, so it is the one place a wrong answer reaches all of them —
  // and the five wiring mutants above are what stop it becoming the only wall, since a
  // store that never asks is a breakage this module cannot see.
  m("profile: the direction is inverted, so every POST names no schema at all", RP,
    'return READ_VERBS.includes(method.toUpperCase()) ? "accept-profile" : "content-profile";',
    'return READ_VERBS.includes(method.toUpperCase()) ? "content-profile" : "accept-profile";'),
  // POST is what every RPC is, so admitting it to the read set is the defect itself.
  m("profile: POST is treated as a read, which is the defect this module closed", RP,
    'export const READ_VERBS = Object.freeze(["GET", "HEAD"]);',
    'export const READ_VERBS = Object.freeze(["GET", "HEAD", "POST"]);'),
  // A LOWERCASE METHOD IS THE SAME METHOD. `fetch` does not fold it for you.
  m("profile: the method is compared without folding its case", RP,
    "return READ_VERBS.includes(method.toUpperCase())", "return READ_VERBS.includes(method)"),
  // ⚠ REFUSE, NEVER COERCE — `String(["GET"])` is `"GET"`, so a one-element array
  // answered the READ header on this module's own first draft.
  m("profile: a method that is not a string is coerced into one", RP,
    'if (typeof method !== "string") return "content-profile";',
    "method = String(method ?? \"\");"),
  // AND CANNOT-TELL FAILS TOWARD THE WRITE HEADER, because `Content-Profile` on a GET is
  // ignored and costs nothing while `Accept-Profile` on a POST silently loses the schema.
  m("profile: an unreadable method falls to the read header, the expensive way round", RP,
    'if (typeof method !== "string") return "content-profile";',
    'if (typeof method !== "string") return "accept-profile";'),
  m("profile: the header name is not the one the schema is put under", RP,
    "  return { [profileHeader(method)]: schema };",
    "  return { \"accept-profile\": schema };"),
  m("caps: a failed request is read as an answer rather than raised", CP,
    "      const e = new Error(`${name}: HTTP ${res.status}${parsed?.message ? ` — ${parsed.message}` : \"\"}`);\n      e.status = res.status;\n      throw e;",
    "      return null;"),
  m("tools: a tool with NO backend answers as though it had done the work", CT,
    "  if (!can || typeof can !== \"object\") return NO_BACKEND;",
    "  if (false) return NO_BACKEND;"),
  m("tools: `remember` lets an ARGUMENT say where the fact came from", CT,
    'const answer = await can.saveMemory({ name: text(args.name), value: text(args.value), source: "run", operation: ctx?.operation });',
    "const answer = await can.saveMemory({ name: text(args.name), value: text(args.value), source: args.source ?? \"run\", operation: ctx?.operation });"),
  // ⚠ AND THE IDENTITY IS THE OTHER HALF OF THAT LINE. Dropped, the store refuses the write
  // `operation-required` — loud — so the mutant worth having is one that takes the identity
  // from an ARGUMENT, where a model can write it and two different calls can be made to look
  // like one.
  m("tools: `remember` lets an ARGUMENT be the call's identity", CT,
    'source: "run", operation: ctx?.operation });', 'source: "run", operation: args.operation ?? ctx?.operation });'),
  m("tools: `forget` takes its identity from an argument", CT,
    "await can.deleteMemory({ name: text(args.name), operation: ctx?.operation });",
    "await can.deleteMemory({ name: text(args.name), operation: args.operation ?? ctx?.operation });"),
  // ⚠ REPLACED, BECAUSE IT HAD BECOME INERT BY CONSTRUCTION. It ADDED `repeatable: true`
  // to a tool that already declares it — a duplicate key in an object literal, where the
  // later one wins and both are `true`. It was written while `run_automation` was
  // `repeatable: false` and meant to flip it; once the tool's own answer changed, the
  // mutant changed nothing and its survival said nothing about coverage. What it was ABOUT
  // is the id: a FRESH one per call is what makes a redelivery a second execution.
  m("tools: starting an automation mints a fresh id, so a redelivery starts a second", CT,
    "      ? await uuidFrom(ctx.operation) : null;",
    "      ? await uuidFrom(ctx.operation + String(Math.random())) : null;"),
  // RE-ANCHORED, NOT APPEASED: the id is derived from the CALL now, so the mutant that
  // lets a model name its own run has to reach past the derivation rather than past a
  // mint. The property is unmoved — an argument may never become an execution's identity.
  m("tools: a model names the run it starts", CT,
    "    const runId = typeof ctx?.operation === \"string\" && ctx.operation\n      ? await uuidFrom(ctx.operation) : null;",
    "    const runId = args.runId ?? (typeof ctx?.operation === \"string\" && ctx.operation\n      ? await uuidFrom(ctx.operation) : null);"),
  // RE-ANCHORED, NOT APPEASED: the id is DERIVED now rather than minted, and the refusal
  // is what stops a deployment that cannot identify the call from minting one anyway.
  m("tools: with no way to identify the call it starts one anyway, with none", CT,
    '    if (!runId) return { ok: false, error: "no-id", say: "this deployment cannot identify the call, so nothing was started" };',
    "    void runId;"),
  m("tools: the execution id is minted afresh, so a redelivery makes a second one", CT,
    "    const runId = typeof ctx?.operation === \"string\" && ctx.operation\n      ? await uuidFrom(ctx.operation) : null;",
    "    const runId = typeof ctx?.newId === \"function\" ? ctx.newId() : null;"),
  m("tools: starting an automation is declared unsafe to repeat, so an approved one strands", CT,
    "  repeatable: true,\n  run: async (args, can, ctx) => {\n    // ⚠ THE RUN ID IS DERIVED FROM THIS CALL",
    "  repeatable: false,\n  run: async (args, can, ctx) => {\n    // ⚠ THE RUN ID IS DERIVED FROM THIS CALL"),
  m("approvals: a derived id is not a uuid, so the column refuses it at the last moment", AP,
    "  b[6] = (b[6] & 0x0f) | 0x50;", "  b[6] = b[6];"),
  m("approvals: the same call derives a different id each time", AP,
    "  const digest = new Uint8Array(await crypto.subtle.digest(\"SHA-256\", new TextEncoder().encode(String(text))));",
    "  const digest = crypto.getRandomValues(new Uint8Array(16));"),
  m("run: the call's identity is not built, so a tool that needs one refuses for ever", R,
    "    operation: operationSeed === null || !Number.isInteger(step) || !Number.isInteger(index) || typeof argsKey !== \"string\"\n      ? null\n      : `${operationSeed}:${step}:${index}:${argsKey}`,",
    "    operation: null,"),
  m("run: every call in a run shares one identity", R,
    "      : `${operationSeed}:${step}:${index}:${argsKey}`,", "      : `${operationSeed}`,"),
  m("run: the identity ignores the arguments, so a re-filled slot inherits its predecessor's", R,
    "      : `${operationSeed}:${step}:${index}:${argsKey}`,", "      : `${operationSeed}:${step}:${index}`,"),
  m("run: an unidentifiable call is invented an identity rather than refused", R,
    "      const argsKey = await operationKey(call?.args);\n      if (argsKey === null) {",
    "      const argsKey = (await operationKey(call?.args)) ?? \"none\";\n      if (false) {"),
  m("run: arguments that cannot be written down are hashed as something else", AP,
    "  const bytes = new TextEncoder().encode(canonicalJson(storedForm(args) ?? {}));",
    "  const bytes = new TextEncoder().encode(canonicalJson(args ?? {}));"),
  // ⚠ A DECLARED PAIR, because the narrow test alone is INERT: `storedForm` wraps every
  // refusal in a `TypeError`, so nothing else can reach that catch through `argsHash` and
  // widening it changes no answer. What IS observable is the two of them disagreeing — if
  // the encoder raises something else while the catch still asks for a TypeError, an
  // unwritable call escapes as a throw instead of the named refusal. Mutated as the pair,
  // which is the only way a redundancy can be swept at all.
  m("run: the encoder's refusal and the catch that reads it disagree", AP,
    "  catch (e) { throw new TypeError(`storedForm: these arguments cannot be written down (${String(e?.message ?? e)})`); }",
    "  catch (e) { throw new RangeError(`storedForm: these arguments cannot be written down (${String(e?.message ?? e)})`); }"),
  m("runner: the run is not the seed, so two runs derive the same work", RN,
    "        operationSeed: runId,", "        operationSeed: \"seed\","),
  // ⚠ AMBIGUOUS AFTER THE REPEAT ARM WAS ADDED: `forget` answers `forgot: answer.forgot ===
  // true` in TWO places now, the ordinary one and the absorbed one. Anchored on the sentence
  // that follows only the ordinary arm.
  // RE-ANCHORED, NOT APPEASED: the answer gained the reach, so the spelling moved and the
  // property did not.
  m("tools: forgetting something that was not there reads as having removed it", CT,
    "    return { ok: true, forgot: answer.forgot === true, affects: reach,",
    "    return { ok: true, forgot: true, affects: reach,"),
  // ⚠ WHAT A DELETE REACHES — three places, and it reaches exactly one. A model told a bare
  // "forgotten" tells somebody it has gone everywhere, which is false about two of them.
  m("⚠ tools: a forget claims the fact is gone everywhere, which is false of two of three places", CT,
    '    const REACH = "later runs will not see it; a run already under way keeps what it started with,"\n      + " and the history keeps whatever it quoted";',
    '    const REACH = "it is gone";'),
  m("⚠ tools: the reach is COMPOSED here rather than read, so it is a claim nothing verified", CT,
    "    const reach = answer.affects && typeof answer.affects === \"object\" && !Array.isArray(answer.affects)\n      ? answer.affects\n      : null;",
    "    const reach = { futureRuns: true, acceptedRuns: false, runHistory: false };"),
  m("tools: a list is read as a set of named facts about reach", CT,
    "    const reach = answer.affects && typeof answer.affects === \"object\" && !Array.isArray(answer.affects)",
    "    const reach = answer.affects && typeof answer.affects === \"object\" && true"),
  // ⚠ WHAT A MODEL IS OFFERED IS THE AGENT'S OWN LIST. Item 7's last line — *knowledge and
  // retrieved content remain data, never authority to change permissions* — is this narrowing
  // and nothing else, so the mutant is the narrowing removed.
  m("⚠ run: the model is offered every tool the agent declares, past the tenant's narrowing", R,
    "  const { allowed, withheld } = toolsFor(agent, tenant?.grants);",
    "  const { withheld } = toolsFor(agent, tenant?.grants);\n  const allowed = agent.tools;"),
  // ⚠ BOUNDED ON THE WAY IN, because `retrieve` is the seam that is MEANT to be replaced — so
  // a bound enforced only there is a bound the next retriever owns.
  m("⚠ automations: a retriever's overrun reaches the workflow, so fifty passages are quoted", AU,
    "    const excerpts = answered.length > MAX_EXCERPTS ? answered.slice(0, MAX_EXCERPTS) : answered;",
    "    const excerpts = answered;"),
  m("automations: the ask carries no ceiling, so the bound is the retriever's alone", AU,
    "    const found = await ctx.retrieve({ query: config.query, limit: MAX_EXCERPTS });",
    "    const found = await ctx.retrieve({ query: config.query });"),
  // ⚠ WHOSE FACT IT WAS — `unknown` is a stated answer and reading the absence as `person`
  // UPGRADES an agent's own note into one somebody confirmed.
  m("⚠ automations: a memory with no recorded source is read as CONFIRMED BY A PERSON", AU,
    '    const source = entry?.source === "person" || entry?.source === "run" ? entry.source : "unknown";',
    '    const source = entry?.source ?? "person";'),
  m("automations: the memory step reports no source at all, so an answer cannot be placed", AU,
    "      sources: [{ key: config.key, version, source }],",
    "      sources: [{ key: config.key, version }],"),
  m("automations: the three sources say one thing, so a confirmed fact and a note are one", AU,
    '    const said = source === "person" ? "confirmed by you"\n      : source === "run" ? "written by this agent"\n      : "recorded before this was tracked";',
    '    const said = "remembered";'),
  // ⚠ AND THE ABSORBED ARM IS ITS OWN MUTANT. A repeat answered as though it had just
  // happened is a claim about the present made from a record of the past — the fact may have
  // been written again since, which section 3 of `verify:ops` is exactly about.
  m("tools: an absorbed forget is answered as though it had just happened", CT,
    '      return { ok: true, forgot: answer.forgot === true, repeat: true,',
    '      return { ok: true, forgot: answer.forgot === true,'),
  m("tools: an absorbed remember is reported as new work", CT,
    "      ...(answer.repeat === true ? { repeat: true, say: \"that was already saved by this same request; check it if you need what is remembered now\" } : {}) };",
    "      };"),
  m("tools: an absorbed pause claims the automation is as this call left it", CT,
    "      ...(answer.repeat === true ? { repeat: true, say: \"that was already done by this same request; it may have been changed since\" } : {}) };",
    "      };"),
  m("tools: a database refusal is passed on as a SUCCESS", CT,
    '    if (answer?.ok !== true) return { ok: false, error: answer?.error ?? "refused", say: sayMemory(answer?.error) };',
    "    if (false) return { ok: false, error: answer?.error ?? \"refused\", say: sayMemory(answer?.error) };"),
  m("run: a tool is handed no backend at all, so every capability refuses", R,
    "  const capabilities = opts.capabilities ?? null;", "  const capabilities = null;"),
  m("runner: the backend is scoped to the tenant and NOT to the agent", RN,
    "        ? capabilities.forTenant(claim.tenant).forAgent(authoredAgent)",
    "        ? capabilities.forTenant(claim.tenant).forAgent(\"00000000-0000-4000-8000-000000000000\")"),
  m("runner: a run with no authored agent is given a backend anyway", RN,
    "      const canDo = capabilities && authoredAgent", "      const canDo = capabilities"),
  // RE-ANCHORED, NOT APPEASED: the argument list gained `approvals`.
  // ⚠ RE-ANCHORED 2026-09-18, NOT APPEASED: `connections` joined that line, so every one of
  // these four names what it takes AWAY from the same current spelling. The properties are
  // unchanged; only the line they cut from moved.
  m("worker: the runner is built with no automation executor", W, NEW_RUNNER_LINE,
    "    work, store, capabilities, connections, approvals, send, agents: AGENTS, now,"),
  m("worker: the runner is built with no backend for its tools to reach", W, NEW_RUNNER_LINE,
    "    work, store, automations, connections, approvals, send, agents: AGENTS, now,"),
  m("worker: the runner is built with nowhere to ask a person", W, NEW_RUNNER_LINE,
    "    work, store, automations, capabilities, connections, send, agents: AGENTS, now,"),
  // ⚠ AND THE NEW HOP, which is the one this round adds: a seam built and never handed over
  // makes every connection tool answer `no-connections` while the run completes, the queue
  // acks and the customer is told the agent cannot reach anything. The wiring layer, for the
  // fourteenth-odd time in this repository.
  m("worker: the runner is built with nothing to reach outside", W, NEW_RUNNER_LINE,
    "    work, store, automations, capabilities, approvals, send, agents: AGENTS, now,"),
  m("worker: the approval store is never built at all", W,
    "  const approvals = makeApprovals(wire);",
    "  const approvals = null;"),

  // ══════════════════════════════════════════════════════════════════════════
  // approvals.mjs — a tool call a person has to say yes to
  // ══════════════════════════════════════════════════════════════════════════
  m("approvals: key order decides the hash, so a reordered field voids an approval", AP,
    'if (typeof v === "object") return ["o", Object.keys(v).sort().map((k) => [k, walk(v[k])])];',
    'if (typeof v === "object") return ["o", Object.keys(v).map((k) => [k, walk(v[k])])];'),
  m("approvals: a scalar loses its type, so 1 and its text are one call", AP,
    '    if (typeof v === "number") return ["n", String(v)];\n    if (typeof v === "string") return ["s", v];',
    '    if (typeof v === "number") return [String(v)];\n    if (typeof v === "string") return [v];'),
  m("approvals: an absent argument and an empty one hash alike", AP,
    '    if (v === undefined) return ["u"];\n    if (v === null) return ["z"];',
    '    if (v === undefined) return ["z"];\n    if (v === null) return ["z"];'),
  m("approvals: an array stops carrying its own order", AP,
    'if (Array.isArray(v)) return ["a", v.map(walk)];',
    'if (Array.isArray(v)) return ["a", v.map(walk).sort()];'),
  m("approvals: a decision about DIFFERENT arguments is read as one about this call", AP,
    'if (answer.matches !== true) return whole("stale");', ""),
  // ⚠ RE-ANCHORED, NOT APPEASED, when `ask` began answering the row's own hash and window:
  // the property moved from "it returns `stale`" to "it returns `stale` and the caller cannot
  // then perform the action under the hash it was going to use anyway".
  m("approvals: the hash comes back OURS rather than the row's, so a caller binds to what it asked", AP,
    "                hash: isText(answer.args_hash) ? answer.args_hash : null,",
    "                hash,"),
  m("approvals: the window never comes back, so a caller cannot say when to look again", AP,
    "                expiresAt: isText(answer.expiresAt) ? answer.expiresAt : null,",
    "                expiresAt: null,"),
  m("approvals: a request that failed is read as nobody having answered", AP,
    '      const e = new Error(`${name}: HTTP ${res.status}${parsed?.message ? ` — ${parsed.message}` : ""}`);\n      e.status = res.status;\n      throw e;',
    "      return null;"),
  m("approvals: a refusal from the function is read as an answer", AP,
    'if (answer.ok !== true) throw new Error(`request_tool_approval: ${answer.error ?? "refused"}`);', ""),
  m("approvals: the arguments go out unhashed, so nothing is bound to them", AP,
    "                p_hash: hash,", '                p_hash: "",'),
  // RE-ANCHORED, NOT APPEASED. The single `rejected` branch became a loop over the three
  // states the DATABASE names, so the property is the same and wider: empty the list and every
  // refusal — a rejection, a withdrawal and a closed window alike — reads as still pending, and
  // the run waits for ever on a question that has already been answered.
  m("approvals: every refusal is read as a pause, so the model is never told", AP,
    'for (const state of ["rejected", "revoked", "expired"]) {', "for (const state of []) {"),
  m("approvals: the person's own words are dropped", AP,
    "                  return whole(state, { note: isText(answer.note) ? answer.note : null });",
    "                  return whole(state, { note: null });"),
  m("approvals: the account is not compelled, so an unscoped gate exists", AP,
    'if (!isText(tenant)) throw new TypeError("forTenant: tenant must be a non-empty string, from the claim");', ""),
  m("approvals: the run is not compelled, so a gate can ask about any run", AP,
    'if (!isText(runId)) throw new TypeError("forRun: runId must be a non-empty string");', ""),
  m("approvals: the write carries the READ profile header, which PostgREST ignores", AP,
    "        ...profileFor(METHOD, schema),", '        "accept-profile": schema,'),
  m("approvals: a rejection and a missing approver say the same thing", AP,
    '    return { ok: false, error: "rejected",', '    return { ok: false, error: "no-approver",'),

  // ── the flag, and the two tools that carry it ─────────────────────────────
  m("define: approval is coerced, so a string makes a gated tool ungated", D,
    'if (Object.hasOwn(spec, "approval") && typeof spec.approval !== "boolean") {', "if (false) {"),
  m("define: the flag is read and then dropped, so no tool is ever gated", D,
    "    approval: spec.approval === true,", "    approval: false,"),
  m("tools: turning an automation off needs nobody", CT,
    "  approval: true,\n  run: async (args, can, ctx) => {\n    const answer = await can.setAutomationEnabled(",
    "  run: async (args, can, ctx) => {\n    const answer = await can.setAutomationEnabled("),
  m("tools: starting an automation needs nobody", CT,
    "  approval: true,\n  // ⚠ SAFE TO REPEAT", "  // ⚠ SAFE TO REPEAT"),

  // ── the gate, in the loop ─────────────────────────────────────────────────
  m("run: a gated call is dispatched without asking anybody", R,
    "      out.set(i, await decideOne(step, i, tool.name, calls[i]?.args));", ""),
  m("run: a call still waiting for a person is run anyway", R,
    'const waitingOn = [...decided.values()].filter((d) => d.state === "pending");', "const waitingOn = [];"),
  m("run: a stale or refused decision is treated as a yes", R,
    '      if (verdict && verdict.state !== "approved") return approvalRefusal(verdict);', ""),
  m("run: a held run writes a stop, so the conversation can never be carried on", R,
    '      return record(ended("awaiting-approval", {\n        step: stepNo,',
    '      return finish(ended("awaiting-approval", {\n        step: stepNo,'),
  m("run: a gate that cannot be reached is read as a verdict", R,
    'if (!approvals) return { state: "unavailable", index, tool, id: null };',
    'if (!approvals) return { state: "approved", index, tool, id: null };'),
  m("run: a gate that is not a gate is accepted", R,
    'if (approvals !== null && typeof approvals?.ask !== "function") {', "if (false) {"),
  m("run: a resumed run never asks again, so a decision is never read", R,
    "      if (!callable.get(p.name)?.approval) continue;\n      try { decided.set(slot,",
    "      if (true) continue;\n      try { decided.set(slot,"),
  m("run: a resumed run's ask is renumbered, so it asks about calls nobody made", R,
    "      try { decided.set(slot, await decideOne(p.step, p.index, p.name, p.args)); }",
    "      try { decided.set(slot, await decideOne(0, slot, p.name, p.args)); }"),
  m("run: a resumed call is run with another slot's arguments", R,
    "        const value = await tool.run(p.args, toolContext({ tenant, agent, limits, step: p.step, index: p.index,",
    "        const value = await tool.run(prior.pending[0]?.args, toolContext({ tenant, agent, limits, step: p.step, index: p.index,"),
  m("run: a resumed call's identity ignores its arguments", R,
    "operationSeed, argsKey: await operationKey(p.args) }));",
    "operationSeed }));"),
  m("run: a write that threw is recorded as a plain failure", R,
    "                           error: String(error?.message ?? error), unresolved: tool.writes === true });",
    "                           error: String(error?.message ?? error) });"),
  m("run: an unresolved write is recorded as resolved on the live path", R,
    "        unresolved: !r.ok && callable.get(call?.name)?.writes === true,", "        unresolved: false,"),
  m("run: the stop does not say which blocked calls are unresolved", R,
    "          unresolved: callable.get(p.name)?.writes === true,", "          unresolved: false,"),
  m("define: a write need not be repeatable, so it can never finish after an interruption", D,
    "  if (spec.writes === true && spec.repeatable !== true) {", "  if (false) {"),
  m("define: `writes` is coerced, so a string from a config file sets it", D,
    '  if (Object.hasOwn(spec, "writes") && typeof spec.writes !== "boolean") {', "  if (false) {"),
  m("define: the tool does not carry `writes`, so no reader can see it", D,
    "    writes: spec.writes === true,", "    writes: false,"),
  m("run: a resumed run stops waiting and runs the call instead", R,
    '    const stillWaiting = [...decided.entries()].filter(([, d]) => d.state === "pending");',
    "    const stillWaiting = [];"),
  // RE-ANCHORED, NOT APPEASED (twice): both lines gained the revoked slots, so the property
  // each asserts is unchanged and each mutant now breaks it for a refusal AND for a
  // withdrawal. Emptying the set strands the run on calls it is never going to make;
  // collapsing the refusal runs them.
  m("run: a REFUSED pending call is read as a resume hazard, stranding the run", R,
    '    const refusedHere = new Set([...revokedSlots, ...[...decided.entries()]\n      .filter(([, d]) => d.state !== "approved").map(([i]) => i)]);',
    "    const refusedHere = new Set();"),
  m("run: a refused pending call is RUN on the resume rather than answered", R,
    "      if (refusal) {\n        const said = toolEntry(",
    "      if (false) {\n        const said = toolEntry("),
  m("run: an unreachable gate closes the run instead of leaving it to retry", R,
    '      return record(ended("approval-failed", { step: stepNo, error: String(e?.message ?? e) }));',
    '      return finish(ended("approval-failed", { step: stepNo, error: String(e?.message ?? e) }));'),

  // ── the runner ────────────────────────────────────────────────────────────
  m("runner: a run waiting for a person is read as one that finished", RN,
    '      if (reason === "awaiting-approval") {\n        return await finish(true, "awaiting-approval", JSON.stringify(record.stop.waiting ?? []), record.stop);\n      }',
    ""),
  m("runner: a run waiting for a person is left on the queue and redelivered for ever", RN,
    '        return await finish(true, "awaiting-approval", JSON.stringify(record.stop.waiting ?? []), record.stop);',
    '        return await finish(false, "awaiting-approval", JSON.stringify(record.stop.waiting ?? []), record.stop);'),
  m("runner: an unreachable approval store ends the run rather than retrying", RN,
    '        return await finish(false, "failed", `approval-failed: ${record.stop.error ?? ""}`, record.stop);',
    '        return await finish(true, "failed", `approval-failed: ${record.stop.error ?? ""}`, record.stop);'),
  m("runner: the gate is built for the wrong run", RN,
    "        ? approvals.forTenant(claim.tenant).forRun({ runId, agentId: authoredAgent })",
    '        ? approvals.forTenant(claim.tenant).forRun({ runId: "other", agentId: authoredAgent })'),
  m("runner: the gate is never handed to the run", RN, "        approvals: mayCall,", ""),
  m("runner: a gate that is not a factory is accepted", RN,
    '  const approvals = opts.approvals && typeof opts.approvals.forTenant === "function"',
    "  const approvals = opts.approvals && true"),
  m("runner: only an authored run may put a call to a person", RN,
    "      const mayCall = approvals\n        ? approvals.forTenant(claim.tenant)",
    "      const mayCall = approvals && authoredAgent\n        ? approvals.forTenant(claim.tenant)"),
  m("runner: the outcome census forgets the one that is neither ran nor failed", RN,
    '  "cannot-resume", "awaiting-approval", "too-many-attempts", "lease-lost", "beat-failed",',
    '  "cannot-resume", "too-many-attempts", "lease-lost", "beat-failed",'),

  // ══════════════════════════════════════════════════════════════════════════
  // workflow-refs.mjs — the `{{name}}` syntax, in the ONE place all three
  // consumers read it from. A second copy is how a name that saves cleanly
  // fails at run time for a reason nobody can see.
  // ══════════════════════════════════════════════════════════════════════════
  m("refs: a malformed reference is READ as a name, so `{{ }}` becomes a value", WR,
    "    if (REF_NAME.test(name) && !out.includes(name)) out.push(name);",
    "    if (!out.includes(name)) out.push(name);"),
  m("refs: fillRefs asks TRUTHINESS, so an empty string reads as missing", WR,
    "    if (!Object.hasOwn(bag, name)) {", "    if (!bag[name]) {"),
  m("refs: fillRefs substitutes NOTHING for an unknown name instead of naming it", WR,
    "      if (!missing.includes(name)) missing.push(name);\n      return whole;",
    '      return "";'),
  // ⚠ REPLACED AFTER BEING MEASURED INERT. The first version of this mutant swapped the
  // FALLBACK bag for `Object.create({})` — which is reached only when `values` is not an
  // object, and has no own `constructor` either, so `Object.hasOwn` answers the same both
  // ways over every shape (driven: null, undefined, 7, "x", ["a"]). This is the observable
  // half of the same property, on the line that really decides it.
  m("refs: fillRefs asks `in`, so {{constructor}} resolves through the prototype chain", WR,
    "    if (!Object.hasOwn(bag, name)) {", "    if (!(name in bag)) {"),
  m("refs: valueText COERCES, so a list reads as its first element", WR,
    '  if (typeof v === "string") return v;', "  if (v !== null && v !== undefined) return String(v);"),

  // ══════════════════════════════════════════════════════════════════════════
  // automations.mjs — branches, waits, approvals, knowledge and memory
  // ══════════════════════════════════════════════════════════════════════════
  m("steps: a step with no fields need not say so, so an empty list is a typo", AU,
    "  if (!fields.length && configless !== true) {", "  if (false) {"),
  m("branch: `otherwise` is matched by POSITION rather than by depth", AU,
    "      const top = open[open.length - 1];\n      if (!top) return { error: `step ${at}: \"${sh.middled}\" has no \"${sh.opened}\" above it` };",
    "      const top = open[0];\n      if (!top) return { error: `step ${at}: \"${sh.middled}\" has no \"${sh.opened}\" above it` };"),
  m("branch: an `if` with no `end` is accepted, so half a branch runs", AU,
    "  if (open.length) {\n    const top = open[open.length - 1];\n    return { error: `step ${top.at + 1}: that \"${top.shape.opened}\" has no \"${top.shape.closed}\" below it` };\n  }\n  return { map };",
    "  return { map };"),
  m("branch: the arm that was NOT taken is left with no outcome at all", AU,
    '          skipRange(i + 1, target, "the comparison didn\'t hold, so this step was skipped");',
    "          void target;"),
  m("branch: an `if` that did not match is reported as FAILED, not as a choice", AU,
    '        put(i, { outcome: "ran", took: met ? "first" : "otherwise", why:',
    '        put(i, { outcome: met ? "ran" : "failed", took: met ? "first" : "otherwise", why:'),
  // ── milestone 2: the branch decision recovered, and the paths validated ────
  m("resume: the branch decision is IN MEMORY only, so a restart at a false `if` runs neither arm", AU,
    "  const jumpedToElse = new Set();\n  for (let k = 0; k < steps.length; k++) {",
    "  const jumpedToElse = new Set();\n  for (let k = 0; k < 0; k++) {"),
  m("resume: the recovered arm is read from the LIVE step alone, so a stale outcome opens one", AU,
    '    if (recorded.type !== "if") continue;', "    void 0;"),
  m("resume: the recovered arm is taken from the OUTCOME's index in the list, not the `if`'s", AU,
    "    const elseAt = struct.map?.get(k)?.elseAt;", "    const elseAt = struct.map?.get(0)?.elseAt;"),
  m("refs: a value produced inside an arm is visible OUTSIDE it, so a path that skips it saves", AU,
    "  const visible = () => {\n    const f = here();\n    if (!f) return outer;",
    "  const visible = () => {\n    const f = here();\n    if (true) return outer;"),
  m("refs: an arm's value is produced into the OUTER set, so the other arm can name it", AU,
    "  const produce = (name, type = \"text\") => {\n    const f = here();\n    if (!f) outer.set(name, type);",
    "  const produce = (name, type = \"text\") => {\n    const f = here();\n    if (true) { outer.set(name, type); return; }"),
  m("refs: an `if` with no `otherwise` hands its arm's values on anyway, past the rejoin", AU,
    "        const both = f.hasElse ? [...f.first.keys()].filter((n) => f.other.has(n)) : [];",
    "        const both = [...f.first.keys()];"),
  m("refs: what BOTH arms produce is dropped at the rejoin, so a correct workflow is refused", AU,
    "        for (const n of both) produce(n, f.first.get(n));", "        void both;"),
  m("refs: the rejoin FORGETS what an arm bound, so a use below the `end` reads as a typo", AU,
    "        for (const n of [...f.first.keys(), ...f.other.keys()]) if (!both.includes(n)) armOnly.add(n);",
    "        void f;"),
  m("refs: what an arm bound is made VISIBLE below the `end`, not merely explainable", AU,
    "    const canSee = visible();",
    "    const canSee = new Set([...visible(), ...armOnly]);"),
  m("refs: a cross-arm reference is reported as a typo, sending somebody after a misspelling", AU,
    "          const onlyInAnArm = frames.some((fr) => fr.first.has(name) || fr.other.has(name))",
    "          const onlyInAnArm = false && frames.some((fr) => fr.first.has(name) || fr.other.has(name))"),
  m("resume: the stored position is ignored, so a resume runs the whole thing again", AU,
    "  let i = Number.isInteger(opts.position) && opts.position > 0 ? opts.position : 0;",
    "  let i = 0;"),
  m("resume: the day is taken from the RESUME rather than from when it started", AU,
    "  const asOf = typeof opts.startedAt === \"number\" && Number.isFinite(opts.startedAt) ? opts.startedAt : now;",
    "  const asOf = now;"),
  // ⚠ RE-ANCHORED, NOT APPEASED: the test gained `!resumeSpent &&` when a loop showed that a
  // resume must be consumed ONCE. The property is unchanged — the step's own ID and not the
  // position — and the mutant still says exactly that.
  m("resume: a decision is matched by POSITION, so one pause's answer resumes another", AU,
    "!resumeSpent && pausedOn.step === id", "!resumeSpent && pausedOn.step !== undefined"),
  // ⚠ AND THE NEW HALF: a resume read a SECOND time. Inside a loop the same step id comes
  // round again, and the stored pause names an id and nothing else — so a wait five minutes
  // inside a two-round loop waited once and went straight through the second round.
  m("resume: a resume is read again on a later round, so a loop's second wait is already over", AU,
    "    const resume = !resumeSpent && pausedOn.step === id", "    const resume = pausedOn.step === id"),
  m("resume: the resume is never marked spent, which is the same defect one line down", AU,
    "    if (resume) resumeSpent = true;", "    if (resume) resumeSpent = false;"),
  m("checkpoint: the clock is re-read per call, so a retry writes a SECOND journal entry", AU,
    "        at: now,", "        at: Date.now(),"),
  m("pause: the position ADVANCES past the step that is waiting", AU,
    "        if (!(await checkpoint(waitingAt, waiting))) { waiting = null; break; }",
    "        if (!(await checkpoint(waitingAt + 1, waiting))) { waiting = null; break; }"),
  m("pause: a refused checkpoint carries on rather than stopping the worker", AU,
    "    if (answer?.ok !== true) {\n      halted = isText(answer?.why) ? answer.why : \"the progress could not be recorded\";\n      return false;",
    "    if (false) {\n      halted = isText(answer?.why) ? answer.why : \"the progress could not be recorded\";\n      return false;"),
  m("approval: the timeout outcome is ignored and silence always rejects", AU,
    '    if (config.on_timeout === "approve") {', "    if (false) {"),
  m("approval: it carries on BEFORE its deadline, so a spurious delivery decides it", AU,
    "    if (ctx.now < until) return { waiting, why: `waiting to be approved: ${config.ask}` };",
    "    if (false) return { waiting, why: `waiting to be approved: ${config.ask}` };"),
  m("approval: an approval with no recorded deadline runs on rather than refusing", AU,
    '      return { failed: "this approval has no deadline recorded, so it cannot be told whether it has run out of time" };',
    "      return { done: true };"),
  m("knowledge: a retriever that REFUSED BY NAME reads as having found nothing", AU,
    "    if (isText(found?.error)) return { failed: found.error };",
    "    if (false) return { failed: found.error };"),
  m("knowledge: the excerpt travels without the source it came from", AU,
    "      .map((e, i) => `${sources[i].title}: ${isText(e?.text) ? e.text.trim() : \"\"}`)",
    "      .map((e) => (isText(e?.text) ? e.text.trim() : \"\"))"),
  m("knowledge: a deployment with no retriever answers EMPTY instead of saying so", AU,
    '      return { failed: "this deployment has no way to search reference material" };',
    '      return { value: "", sources: [] };'),
  m("memory: a fact nobody has saved yet is a FAILURE rather than an answer", AU,
    '      return { value: "", note: `nothing is remembered under "${config.key}" yet`, sources: [] };',
    '      return { failed: `nothing is remembered under "${config.key}"` };'),
  m("memory: the snapshot is bypassed and the bag is read by truthiness", AU,
    "    if (!Object.hasOwn(bag, config.key)) {", "    if (!bag[config.key]) {"),

  // ══════════════════════════════════════════════════════════════════════════
  // automation-store.mjs — the seam between the executor and the transaction
  // ══════════════════════════════════════════════════════════════════════════
  m("store: a pause it cannot read becomes `{}`, which is a pause with no step", AS,
    "        waiting: plainObject(row.waiting, null),", "        waiting: plainObject(row.waiting),"),
  m("store: a timestamp it cannot read becomes NOW rather than nothing", AS,
    "  return Number.isFinite(t) ? t : null;", "  return Number.isFinite(t) ? t : Date.now();"),
  m("store: the pause is dropped on the way to the transaction, so nothing waits", AS,
    "        p_waiting: waiting ?? null,", "        p_waiting: null,"),
  m("store: the position is dropped from the advance, so a resume starts again", AS,
    "        p_entry: entry, p_position: position,", "        p_entry: entry, p_position: 0,"),
  m("store: an answer that is not an object is read as a success", AS,
    '        throw new Error("advance_automation_run: no answer came back");',
    "        return { ok: true };"),

  // ══════════════════════════════════════════════════════════════════════════
  // runner.mjs — where an automation's own execution is driven
  // ══════════════════════════════════════════════════════════════════════════
  m("runner: an execution with NO AGENT searches nothing and reports 'found nothing'", RN,
    "        if (!exec.agentId) {\n          return { error:",
    "        if (false) {\n          return { error:"),
  m("runner: the search is scoped to the agent and NOT to the account", RN,
    "        return await automations.search({ tenant: claim.tenant, agentId: exec.agentId, query, limit });",
    "        return await automations.search({ tenant: null, agentId: exec.agentId, query, limit });"),
  m("runner: a refused checkpoint is read as a FAILURE rather than a lost claim", RN,
    "      if (halted !== null) {\n        stopBeating();",
    "      if (false) {\n        stopBeating();"),
  // ⚠ RE-ANCHORED, NOT APPEASED: the arrival race was inserted between the `if` and the
  // event line, so the two-line anchor no longer matched. The property is the same — a
  // waiting execution must be left suspended rather than finished — and it is pinned on the
  // `if` plus its own `stopBeating()`, which is the shortest window that is still unique.
  m("runner: a WAITING execution is finished instead of left suspended", RN,
    "      if (waiting) {\n        stopBeating();\n        /**",
    "      if (false) {\n        stopBeating();\n        /**"),
  m("runner: a pause keeps BEATING, so a released claim is still being renewed", RN,
    '      if (waiting) {\n        stopBeating();', "      if (waiting) {\n        void 0;"),
  // ⚠ REPLACED AFTER BEING MEASURED INERT. The first version read `exec.live?.steps ??
  // exec.steps` — and `live` is a field NOTHING produces, in the store, the migration or
  // anywhere else, so the optional chain always answered undefined and the `??` always
  // took the real steps. This breaks the resumable half instead, which is observable.
  m("runner: the position the execution reached is not passed on, so a resume starts again", RN,
    "        startedAt: exec.startedAt,\n        position: exec.position,", "        startedAt: exec.startedAt,\n        position: 0,"),
  m("runner: the memory snapshot never reaches the executor", RN,
    "        memory: exec.memory,\n        retrieve,", "        memory: {},\n        retrieve,"),

  // ══════════════════════════════════════════════════════════════════════════
  // worker.mjs — the tick that releases waiting work
  // ══════════════════════════════════════════════════════════════════════════
  m("worker: the resume tick rings EVERY due row, including ones somebody holds", W,
    '        if (action === "queued" && isText(runId)) {', "        if (isText(runId)) {"),
  m("worker: the resume tick is unbounded, so one tick can wake everything at once", W,
    "export const AUTOMATION_RESUME_LIMIT = 50;", "export const AUTOMATION_RESUME_LIMIT = 100000;"),
  m("worker: a failed ring stops the whole tick rather than the one row", W,
    '          catch (e) { console.error("agent-resume", JSON.stringify({ runId, ring: String(e?.message ?? e) })); }',
    "          catch (e) { throw e; }"),

  // ── EXPIRY, REVOCATION AND CANCELLATION ───────────────────────────────────
  //
  // ⚠ THE TWO DEFECTS THESE GUARD WERE BOTH FOUND BY DRIVING THE FEATURE: a run nobody
  // answered was stranded for ever (its work row is DONE and only a decision puts it back),
  // and a revocation withdrew the pending requests and left their runs in the same state.
  m("run: a revocation list that is not a list is read as nothing revoked", R,
    '  if (Object.hasOwn(opts, "revoked") && opts.revoked !== undefined && !Array.isArray(opts.revoked)) {',
    "  if (false) {"),
  m("⚠ run: a revoked tool is still offered to the model and still dispatchable", R,
    "  const offered = revokedHere.length ? allowed.filter((t) => !revoked.has(t.name)) : allowed;",
    "  const offered = allowed;"),
  m("run: the record claims a narrowing that did not happen", R,
    "  const revokedHere = Object.freeze(allowed.filter((t) => revoked.has(t.name)).map((t) => t.name));",
    "  const revokedHere = Object.freeze([...revoked]);"),
  m("⚠ run: a withdrawn permission reads as 'no such tool', which is false about a tool that exists", R,
    '      if (typeof call?.name === "string" && revoked.has(call.name)) return toolRevoked(call.name);',
    "      if (false) return null;"),
  m("⚠ run: a PENDING call of a revoked tool is re-run under the withdrawn permission", R,
    "    const revokedSlots = new Set([...prior.pending.entries()]\n      .filter(([, p]) => revoked.has(p.name)).map(([i]) => i));",
    "    const revokedSlots = new Set();"),
  m("⚠ run: a revoked pending WRITE claims nothing happened", R,
    "        ? toolRevoked(p.name, { mayHaveRun: agent.tools.some((t) => t.name === p.name && t.writes === true) })",
    "        ? toolRevoked(p.name)"),
  m("run: the record folds a withdrawal into the never-granted list", R,
    "    revoked: revokedHere,", "    revoked: withheld,"),
  m("approvals: a closed window is reported as a rejection", AP,
    '    return { ok: false, error: "expired",\n             say: "nobody answered this in time, so nothing was done — it can be asked again" };',
    '    return { ok: false, error: "rejected", say: "a person declined this" };'),
  m("approvals: a withdrawal is reported as a rejection", AP,
    '    return { ok: false, error: "revoked",\n             say: decision.note\n               ? `the authority for this was withdrawn: ${decision.note}`\n               : "the authority for this was withdrawn, so nothing was done" };',
    '    return { ok: false, error: "rejected", say: "a person declined this" };'),
  m("⚠ approvals: a revoked pending call claims an uncertainty on any truthy flag", AP,
    "  const may = opts?.mayHaveRun === true;", "  const may = !!opts?.mayHaveRun;"),
  m("approvals: a tool name that cannot be read is coerced into the sentence", AP,
    "  const tool = isText(name) ? name : \"that tool\";", "  const tool = String(name);"),
  m("⚠ approvals: a malformed revocation answer is read as one tool name", AP,
    '          return Array.isArray(rows) ? rows.filter((r) => typeof r === "string") : [];',
    "          return [].concat(rows ?? []);"),
  m("approvals: an unnamed agent is asked about anyway", AP,
    "          if (!isText(agentId)) return [];", "          if (false) return [];"),
  m("approvals: the expiry sweep's answer is not a list and is passed on as one", AP,
    "      return Array.isArray(rows) ? rows : [];", "      return rows;"),
  m("⚠ runner: what has been revoked is read from the SNAPSHOT instead of live", RN,
    "      const revoked = approvals && authoredAgent\n        ? await approvals.forTenant(claim.tenant).revokedTools(authoredAgent)\n        : [];",
    "      const revoked = open.state?.revoked ?? [];"),
  m("⚠ runner: the revocation is never forwarded to the loop", RN,
    "        revoked,\n        from: open.entries,", "        from: open.entries,"),
  m("runner: a withdrawal takes effect and nobody can see that it did", RN,
    '        onEvent({ at: "tools-revoked", runId, agent: registered.name, tools: revoked });',
    "        void 0;"),
  m("⚠ worker: the cron never puts back a run nobody answered, so it is stranded for ever", W,
    "      const stale = await buildApprovals(env).expiredApprovals({ limit: APPROVAL_SWEEP_LIMIT });",
    "      const stale = [];"),
  m("worker: the expiry sweep rings every row, including ones somebody holds", W,
    '        if (row?.action === "requeued" && isText(runId)) {', "        if (isText(runId)) {"),
  m("worker: the expiry sweep is unbounded, so one tick can wake everything at once", W,
    "export const APPROVAL_SWEEP_LIMIT = 50;", "export const APPROVAL_SWEEP_LIMIT = Infinity;"),
  m("worker: the approvals store is built without checking the configuration", W,
    "export function buildApprovals(env, { fetchImpl } = {}) {\n  const missing = missingFor(env, \"consume\");\n  if (missing.length) throw new TypeError(`not configured: ${missing.join(\", \")}`);",
    "export function buildApprovals(env, { fetchImpl } = {}) {\n  const missing = [];\n  if (missing.length) throw new TypeError(`not configured: ${missing.join(\", \")}`);"),
  m("⚠ worker: a broken expiry sweep takes the other three cron jobs down with it", W,
    '      console.log("agent-expired", JSON.stringify({ closed: stale.length, rung }));\n    } catch (e) {\n      console.error("agent-expired", String(e?.message ?? e));\n    }',
    '      console.log("agent-expired", JSON.stringify({ closed: stale.length, rung }));'),

  // ── error paths and bounded retries ────────────────────────────────────────
  m("⚠ errors: a step whose answer cannot change is offered a retry anyway", AU,
    '  const paths = retryable ? ERROR_PATHS : ERROR_PATHS.filter((p) => p !== "retry");',
    "  const paths = ERROR_PATHS;"),
  m("errors: the retry count is never offered, so a retry has nothing to bound it", AU,
    "  if (retryable) {\n    out.push({\n      name: \"retries\", kind: \"number\", required: true, min: 1, max: MAX_STEP_RETRIES,",
    "  if (false) {\n    out.push({\n      name: \"retries\", kind: \"number\", required: true, min: 1, max: MAX_STEP_RETRIES,"),
  m("⚠ errors: the error path is never appended, so the control is drawn by nobody", AU,
    "  const all = failable ? [...fields, ...errorPathFields(retryable === true)] : fields;",
    "  const all = fields;"),
  m("errors: a retry flag out of a config file is coerced rather than refused", AU,
    "    if (typeof retryable !== \"boolean\") {",
    "    if (false) {"),
  m("⚠ errors: a path nobody offers is read as the default, so a typo drops a customer's answer", AU,
    "  if (!isText(given) || !onF.options.includes(given)) {\n    return { error: `${onF.says} has to be one of: ${onF.options.join(\", \")}` };\n  }",
    "  if (!isText(given) || !onF.options.includes(given)) {\n    return { config: {} };\n  }"),
  m("errors: an error path on a step that cannot fail is dropped rather than refused", AU,
    "  if (!onF) return blank ? { config: {} } : { error: `${def?.label ?? \"that step\"} has no failures to handle` };",
    "  if (!onF) return { config: {} };"),
  m("errors: the retry count is clamped rather than refused, storing a bound nobody chose", AU,
    "  if (n < rF.min || n > rF.max) return { error: `${rF.says} has to be between ${rF.min} and ${rF.max}` };",
    "  const _n = Math.min(Math.max(n, rF.min), rF.max); if (_n !== n) return { config: { on_error: \"retry\", retries: _n } };"),
  m("errors: a retry count in words is coerced", AU,
    "  if (typeof n !== \"number\" || !Number.isInteger(n)) return { error: `${rF.says} has to be a whole number` };",
    "  if (n === undefined || n === null) return { error: `${rF.says} has to be a whole number` };"),
  m("⚠ errors: the executor never reads the path, so every failure stops the workflow", AU,
    "    const onError = epRun.config.on_error ?? \"stop\";",
    "    const onError = \"stop\";"),
  m("errors: a stored path this deployment cannot read is treated as the default", AU,
    "    const epRun = readErrorPath(one, def);\n    if (epRun.error) {",
    "    const epRun = readErrorPath(one, def);\n    if (false) {"),
  m("⚠ errors: a carried-past failure is recorded as having RUN, so the workflow says it worked", AU,
    "    put(at, { outcome: \"failed\", error, ...(why ? { why } : {}), ...marks });",
    "    put(at, { outcome: path === \"continue\" ? \"ran\" : \"failed\", error, ...(why ? { why } : {}), ...marks });"),
  // ── sending something through a connected account ─────────────────────────
  // ⚠ NOTE: **no mutant for building `perform`'s args from `config` instead of `payload`.**
  // MEASURED INERT: `fillConfig` fills every `refs: true` field before `run` is called, so
  // the two are the same string. The observable direction is the payload losing the account
  // a person has to be shown, which is the mutant below. The reasoning is in the code.
  m("⚠ send: the message goes out with NOBODY having approved it", AU,
    '    if (asked.state === "pending") {', "    if (false) {"),
  m("⚠ send: the approval is asked about a SUMMARY rather than what will be sent", AU,
    "tool: SEND_TOOL, args: payload });", "tool: SEND_TOOL, args: { connection: payload.connection } });"),
  m("⚠ send: the identity carries no hash, so it is not bound to what was approved", AU,
    "      operation: `${ctx.at.run}:${ctx.at.step}:${ctx.at.index}:${asked.hash ?? \"\"}`,",
    "      operation: `${ctx.at.run}:${ctx.at.step}:${ctx.at.index}:`,"),
  m("⚠ send: the payload hides which account it is from, so an approval cannot show it", AU,
    "      connection: config.connection, provider: row.provider, account: row.account,",
    "      connection: config.connection, provider: row.provider, account: null,"),
  m("⚠ send: a payload that changed since it was approved is sent anyway", AU,
    '    if (asked.state === "stale") {', "    if (false) {"),
  m("⚠ send: a state nothing recognises is read as an approval", AU,
    '    if (asked.state !== "approved") {', "    if (false) {"),
  m("⚠ send: an uncertain send is reported as an ordinary failure", AU,
    '    if (done?.error === "unresolved") {', "    if (false) {"),
  m("⚠ send: a connection that cannot be used is used anyway", AU,
    '    if (row.status !== "active") {', "    if (false) {"),
  m("send: a connection that is not this agent's is sent from", AU,
    '    if (!row) return { failed: "that connected account is not one of this agent\'s" };', ""),
  m("send: an ask that FAILED is read as a verdict", AU,
    "      return { failed: `this could not be put to anybody for approval: ${String(e?.message ?? e)}` };",
    "      return { failed: null };"),
  m("send: the wake rounds DOWN, so an execution is woken inside the window", AU,
    "  return Math.max(1, Math.min(MAX_APPROVAL_HOURS, Math.ceil((at - now) / 3600000)));",
    "  return Math.max(1, Math.min(MAX_APPROVAL_HOURS, Math.floor((at - now) / 3600000)));"),
  m("⚠ send: every round of a loop shares one index, so one approval answers them all", AU,
    "    for (const r of rounds()) n = n * MAX_LOOP_ITERATIONS + r.round;",
    "    for (const r of rounds()) n = n * 0 + 0;"),
  m("send: a step outside every loop and round 0 of one are told apart by the ROUNDS, not the position", AU,
    "      if (b && Number.isInteger(b.endAt) && openAt < i && i <= b.endAt) parts.push({ at: openAt, round: st.at });",
    "      if (b && Number.isInteger(b.endAt) && openAt < i && i <= b.endAt) parts.push({ at: openAt, round: 0 });"),
  m("send: an action's identity is not seeded with this run, so two runs share one", AU,
    "    at: Object.freeze({ run: runId, step: i, index: roundIndex() }),",
    '    at: Object.freeze({ run: "a-run", step: i, index: roundIndex() }),'),
  m("send: a pause records nothing about what it did", AU,
    "      for (const k of PAUSE_MARKS) if (answer?.[k] !== undefined) marks[k] = answer[k];\n      put(i, { outcome: \"ran\", why: isText(answer?.why) ? answer.why : \"carried on\", ...marks });",
    "      put(i, { outcome: \"ran\", why: isText(answer?.why) ? answer.why : \"carried on\" });"),
  m("⚠ errors: the attempt count never moves, so a step is retried for ever", AU,
    "      tried.set(key, already + 1);\n      return \"retry\";",
    "      return \"retry\";"),
  m("errors: a retry is armed with no budget left, so one step can spend the whole execution", AU,
    "    const room = runsSpent() < MAX_STEP_RUNS;", "    const room = true;"),
  // ⚠ NOTE + CONTROL: **no mutant for `wantsRetry`'s `path === "retry"` test.** MEASURED
  // inert over 252 stored-row shapes — `readErrorPath` answers a positive `retries` on the
  // retry branch alone and the executor derives the count from that config and nowhere else,
  // so `already < retries` decides the same thing by itself. It is a DECLARED second wall
  // (the code says so where the next reader meets it), and the pair cannot be swept as one:
  // the two halves are a thousand lines apart and this runner applies one replacement per
  // mutant. So it is recorded here instead, as a comment-only control over the very
  // declaration that explains it.
  m("CONTROL (comment only): the note declaring the retry path test a second wall", AU,
    "    // ⚠ **`path === \"retry\"` IS A DECLARED SECOND WALL, MEASURED INERT AND KEPT.** Over 252",
    "    // The retry path test is a declared second wall, measured inert (control).", true),
  m("⚠ errors: the attempt count is not persisted, so every delivery starts the budget again", AU,
    "        tries: Object.fromEntries(tried),", "        tries: {},"),
  m("errors: the attempt count never reaches the caller, so nothing can store it", AU,
    "  const triesState = () => Object.fromEntries(tried);",
    "  const triesState = () => ({});"),
  m("⚠ errors: a retry costs nothing, so retries buy work the step-run bound forbids", AU,
    "    let extra = 0;\n    for (const v of tried.values()) extra += v;\n    return results.size + extra;",
    "    return results.size;"),
  m("errors: how many attempts a step took never reaches its own row", AU,
    "    const extra = before > 0 ? { tries: before + 1 } : {};",
    "    const extra = {};"),
  m("⚠ errors: a finished run says nothing about the failures it carried past", AU,
    '    ? { reason: "done", result, ...(carried > 0 ? { carried } : {}) }',
    '    ? { reason: "done", result }'),
  m("CONTROL (comment only): the error-path note above the paths", AU,
    " * ⚠ **WHAT HAPPENS WHEN A STEP DOES NOT WORK, AND `stop` IS THE DEFAULT BECAUSE IT IS",
    " * What happens when a step does not work (control).", true),

  m("CONTROL (comment only): the revocation note in the loop", R,
    "   * ── AN EXPLICIT REVOCATION, ENFORCED BEFORE THE NEXT ACTION ────────────────",
    "   * An explicit revocation, enforced before the next action (control).", true),

  // ══════════════════════════════════════════════════════════════════════════
  // SUBWORKFLOWS, WIRED — the hop `expandWorkflow` did not have
  // ══════════════════════════════════════════════════════════════════════════
  m("runner: the expansion never happens, so a call reaches the executor", RN,
    "      if (exec.position === 0 && steps.some((st) => st && typeof st === \"object\" && st.type === \"workflow\")) {",
    "      if (false) {"),
  m("runner: the expansion runs PAST the first step, so a resumed run is renumbered under itself", RN,
    "      if (exec.position === 0 && steps.some(", "      if (exec.position >= 0 && steps.some("),
  m("runner: an execution with no agent looks one up anyway, so it searches whatever it finds", RN,
    "        if (!exec.agentId) {\n          return await finish(true, \"unreadable\",",
    "        if (false) {\n          return await finish(true, \"unreadable\","),
  m("runner: the lookup ignores the agent's own list, so any id at all is a child", RN,
    "          lookup: (id) => children.find((c) => c && c.id === id) ?? null,",
    "          lookup: (id) => children[0] ?? null,"),
  m("runner: an unassemblable workflow is taken off the queue with no reason a customer can read", RN,
    "          const stop = { reason: \"failed\", at: null, error: found.error };",
    "          const stop = { reason: \"failed\", at: null, error: \"it didn't work\" };"),
  m("runner: the flattened plan is never persisted, so the next delivery re-expands nothing", RN,
    "          set = await automations.setPlan({", "          set = await Promise.resolve({ ok: true, set: true }); void ({"),
  m("runner: a fenced refusal on the plan is read as a success", RN,
    "        if (set?.ok !== true) {", "        if (false) {"),
  m("runner: ANOTHER worker's plan is run anyway, so the list executed is not the list recorded", RN,
    "        if (set.set !== true) {\n          return await finish(false, \"conflict\",",
    "        if (false) {\n          return await finish(false, \"conflict\","),
  m("runner: the executor is handed the STORED list, so the expansion is thrown away", RN,
    "        steps = found.steps;", "        void found.steps;"),
  m("runner: the durable loop state is never handed to the executor", RN,
    "        loops: exec.loops,\n        tries: exec.tries,", "        loops: {},\n        tries: {},"),
  m("runner: the checkpoint drops the loop state and the attempt counts", RN,
    "            loops, tries,\n          });", "            loops: {}, tries: {},\n          });"),
  m("runner: a checkpoint that did not land is silent, which is what the loop defect hid behind", RN,
    "        if (answer?.advanced === false) {", "        if (false) {"),
  m("store: the durable loop and retry state are never read back", AS,
    "        loops: plainObject(row.loops),\n        tries: plainObject(row.tries),",
    "        loops: {},\n        tries: {},"),
  m("store: the read stops asking for them, so PostgREST sends neither", AS,
    "        + `,loops,tries,heard&limit=1`,", "        + `&limit=1`,"),
  // ⚠ THE SAME PROPERTY FOR `heard` ALONE, because dropping only it leaves the loop state
  // arriving and every event wait re-pausing for ever — a run waiting on news it has already
  // been told about, which is the stranding this whole half exists to prevent.
  m("store: the read stops asking what it has HEARD, so every event wait re-pauses for ever", AS,
    "        + `,loops,tries,heard&limit=1`,", "        + `,loops,tries&limit=1`,"),
  m("store: the progress call sends no loop state, and the function refuses a null", AS,
    "        p_loops: plainObject(loops),\n        p_tries: plainObject(tries),",
    "        p_loops: loops,\n        p_tries: tries,"),
  m("store: the children read takes an answer that is not a list", AS,
    "      if (!Array.isArray(answer)) throw new Error(\"automation_children: the answer is not a list\");",
    "      if (!Array.isArray(answer)) return [];"),
  m("store: the children read drops the AGENT, so a tenant's every automation is a child", AS,
    "        p_tenant: tenant, p_agent_id: agentId,\n      });\n      // REFUSED RATHER THAN COERCED.",
    "        p_tenant: tenant,\n      });\n      // REFUSED RATHER THAN COERCED."),
  /**
   * ⚠ **RE-ANCHORED ONTO A PRODUCT FIX, not appeased.** This mutant survived a whole pass and
   * the reason was that the product already DID what it describes: `Array.isArray(steps) ?
   * steps : []` sent an empty plan for a non-list, which REPLACES the execution's steps with
   * nothing — zero steps run, `done` reported. And `agent.set_automation_plan` raises on a
   * non-array by its own first line, so the coercion's only effect was to stop that wall ever
   * being reached. The store refuses now, and the mutant is the coercion coming back.
   */
  m("store: the plan write takes a non-list as an empty one rather than letting it be refused", AS,
    '      if (!Array.isArray(steps)) throw new TypeError("setPlan: the flattened steps must be a list");',
    "      if (!Array.isArray(steps)) steps = [];"),
  m("store: the plan write coerces what was copied in, so a stamp nobody can read is written", AS,
    '      if (!Array.isArray(uses)) throw new TypeError("setPlan: what was copied in must be a list");',
    "      if (!Array.isArray(uses)) uses = [];"),
  // ⚠ A RESUME IS SPENT ONCE — the two halves of the loop/wait defect, one per line.
  m("automations: a `decided` step may go in a loop, so one answer stands for every round", AU,
    "    if (def.decided === true && depthOf(\"repeat\") > 0) {", "    if (false) {"),
  m("automations: the loop wall asks the BRANCH depth, so an approval in a plain `if` is refused", AU,
    "def.decided === true && depthOf(\"repeat\") > 0", "def.decided === true && depthOf(\"if\") > 0"),
  m("automations: `decided` is coerced rather than refused", AU,
    "  if (decided !== undefined && typeof decided !== \"boolean\") {",
    "  if (false) {"),
  m("automations: a step that cannot pause may declare how its resume is matched", AU,
    "  if (decided === true && kind !== \"pause\") {", "  if (false) {"),
  m("automations: the approval stops declaring it, so the loop wall guards nothing", AU,
    "  // ITS RESUME IS A DECISION STORED UNDER THIS STEP'S ID — see `defineStep`'s own note.\n  decided: true,",
    "  // ITS RESUME IS A DECISION STORED UNDER THIS STEP'S ID — see `defineStep`'s own note.\n  decided: false,"),

  // ── the inbound delivery, and who it belongs to ─────────────────────────────
  m("⚠ webhooks: the ACCOUNT comes off the payload rather than the verified endpoint", WH,
    "    tenantId: row.tenantId,", "    tenantId: JSON.parse(rawBody)?.tenant ?? row.tenantId,"),
  m("⚠ webhooks: the event's NAME comes off the payload rather than the endpoint", WH,
    "    event: row.event,", "    event: JSON.parse(rawBody)?.name ?? row.event,"),
  m("⚠ webhooks: the signature is not checked at all", WH,
    "  if (!sameSignature(sig.trim().toLowerCase(), want)) return { ok: false, why: \"bad-signature\" };",
    "  if (false) return { ok: false, why: \"bad-signature\" };"),
  m("webhooks: the signature comparison is not length-safe, so a prefix matches", WH,
    "  if (!isText(a) || !isText(b) || a.length !== b.length) return false;",
    "  if (!isText(a) || !isText(b)) return false;"),
  m("⚠ webhooks: the window is ONE-SIDED, so a delivery stamped a year ahead never goes stale", WH,
    "  if (Math.abs(now() - at) > DELIVERY_WINDOW_MS) return { ok: false, why: \"stale\" };",
    "  if (now() - at > DELIVERY_WINDOW_MS) return { ok: false, why: \"stale\" };"),
  m("⚠ webhooks: the timestamp is left OUT of the signed text, so moving it costs nothing", WH,
    "  const signed = `${timestamp}.${rawBody}`;", "  const signed = `${rawBody}`;"),
  m("webhooks: our own outage reads as a missing endpoint", WH,
    "  catch { return { ok: false, why: \"unavailable\" }; }",
    "  catch { return { ok: false, why: \"no-endpoint\" }; }"),
  m("⚠ webhooks: a disabled endpoint still takes deliveries", WH,
    "  if (row.enabled !== true) return { ok: false, why: \"disabled\" };", "  if (false) return { ok: false, why: \"disabled\" };"),
  m("⚠ webhooks: a delivery with no signature still reads a secret out of the database", WH,
    "  if (!isText(sig)) return { ok: false, why: \"no-signature\" };\n  if (!isText(ts)) return { ok: false, why: \"no-timestamp\" };",
    "  void 0;\n  if (!isText(ts)) return { ok: false, why: \"no-timestamp\" };"),
  m("webhooks: the delivery key is minted fresh, so a retry deduplicates nothing", WH,
    "    key: isText(given) ? given.trim().slice(0, 200) : `sig:${want.slice(0, 64)}`,",
    "    key: isText(given) ? given.trim().slice(0, 200) : `sig:${Math.random()}`,"),
  m("⚠ webhooks: the refusals name their cause on the wire, so the route is an oracle", WH,
    "      if (!seen.ok) { onError({ at: \"deliver\", id, reason: seen.why }); return refused(); }",
    "      if (!seen.ok) { return new Response(JSON.stringify({ error: seen.why }), { status: 401 }); }"),
  m("webhooks: an over-long body is parsed rather than refused", WH,
    "      if (raw.length > maxBody) { onError({ at: \"deliver\", id, reason: \"bad-body\" }); return refused(); }",
    "      void 0;"),
  m("⚠ webhooks: our own outage answers 401, so a sender gives up on a delivery it should retry", WH,
    "          { status: 503, headers: { \"content-type\": \"application/json\", \"cache-control\": \"no-store\" } });",
    "          { status: 401, headers: { \"content-type\": \"application/json\", \"cache-control\": \"no-store\" } });"),
  m("webhooks: an absorbed delivery is reported as a failure, so a sender retries for ever", WH,
    "      return new Response(JSON.stringify({ accepted: true, repeat: answer?.repeat === true }),",
    "      return new Response(JSON.stringify({ accepted: answer?.repeat !== true, repeat: answer?.repeat === true }),"),
  m("webhooks: the path shape admits more than one segment", WH,
    "      return method === \"POST\" && /^\\/deliver\\/[^/]+$/.test(path.replace(/\\/+$/, \"\") || \"/\");",
    "      return method === \"POST\" && /^\\/deliver\\//.test(path.replace(/\\/+$/, \"\") || \"/\");"),
  m("webhooks/CONTROL (comment only)", WH,
    " * THE DELIVERY HANDLER — its own named surface, and that is deliberate.",
    " * THE DELIVERY HANDLER — its own named surface, and that is deliberate. (control)", true),

  // ── the fifth cron job, and the delivery route's place in the Worker ────────
  m("⚠ worker: the event job rings nothing, so a filed run waits for the sweeper", W,
    "          try { await env[QUEUE_BINDING].send({ runId }); rung += 1; }\n          catch (e) { console.error(\"agent-events\"",
    "          try { rung += 1; }\n          catch (e) { console.error(\"agent-events\""),
  m("⚠ worker: the event job reads the wrong key, so it rings nothing at all", W,
    "        const runs = Array.isArray(row?.ring) ? row.ring : [];", "        const runs = Array.isArray(row?.runs) ? row.runs : [];"),
  m("worker: the event dispatch is unbounded, so a burst of deliveries starves the schedules", W,
    "      const dispatched = await automations.dispatchEvents({ limit: EVENT_DISPATCH_LIMIT });",
    "      const dispatched = await automations.dispatchEvents({ limit: 1000000 });"),
  // RE-ANCHORED, NOT APPEASED: the tally this line printed was an `action` bucket
  // `agent.dispatch_events` never answers, so the log now reports `filed` and `woke` — what
  // the function really says. The PROPERTY is unchanged and is the catch, not the line.
  m("⚠ worker: a throw in the event job escapes into the tick, taking the sweeper down with it", W,
    "      console.log(\"agent-events\", JSON.stringify({ events: dispatched.length, filed, woke, rung }));\n    } catch (e) {\n      console.error(\"agent-events\", String(e?.message ?? e));\n    }",
    "      console.log(\"agent-events\", JSON.stringify({ events: dispatched.length, filed, woke, rung }));\n    }"),
  // ⚠ AND THE LINE ITSELF IS WORTH A MUTANT NOW, because it is an instrument rather than a
  // decoration: an `action` tally read `{"events":1,"rung":0,"?":1}` for a tick that had
  // really filed an execution, which is a log whose numbers cannot move. A log that always
  // says the same thing is one nobody can read a tick by.
  m("worker: the event log stops saying what the tick really did", W,
    "JSON.stringify({ events: dispatched.length, filed, woke, rung })",
    "JSON.stringify({ events: dispatched.length })"),
  m("⚠ worker: the delivery route is dispatched AFTER the token gate, so no delivery can reach it", W,
    "    if (delivery.handles(path, request.method)) {", "    if (false) {"),
  m("worker: the delivery handler is built with the API's own configuration demand", W,
    "      try { door = buildDelivery(env); }", "      try { door = buildApi(env); }"),

  // ── the store's event operations ────────────────────────────────────────────
  m("⚠ store: an unreadable dispatch answer is read as \"no events happened\"", AS,
    "      if (!Array.isArray(rows)) throw new Error(\"dispatch_events: the answer is not a list\");",
    "      if (!Array.isArray(rows)) return [];"),
  m("store: the emit sends no payload, so an event carries nothing", AS,
    "        p_payload: plainObject(payload), p_source: isText(source) ? source : \"person\",",
    "        p_payload: {}, p_source: isText(source) ? source : \"person\","),
  m("⚠ store: the emit drops the run it came from, so a chain of events is unbounded", AS,
    "        p_key: isText(key) ? key : null, p_from_run: isText(fromRun) ? fromRun : null,",
    "        p_key: isText(key) ? key : null, p_from_run: null,"),
  m("⚠ store: the emit drops the delivery key, so a retried delivery is a second event", AS,
    "        p_key: isText(key) ? key : null, p_from_run: isText(fromRun) ? fromRun : null,\n      });",
    "        p_key: null, p_from_run: isText(fromRun) ? fromRun : null,\n      });"),
  m("store: the hearing takes no tenant, so it is asked about a run without saying whose", AS,
    "      if (!isText(tenant)) throw new TypeError(\"hearPendingEvent: tenant must be a non-empty string, from the claim\");",
    "      void 0;"),
  m("⚠ store: the endpoint reader answers a row with no secret, so nothing can be verified", AS,
    "      if (!isText(answer.secret) || !isText(answer.tenant_id)) return null;", "      void 0;"),
  m("store: the endpoint reader takes the event name off the wrong key", AS,
    "        event: answer.event_name, secret: answer.secret, enabled: true,",
    "        event: answer.event, secret: answer.secret, enabled: true,"),

  // ── the runner: the arrival race, and what it has heard ────────────────────
  m("⚠ runner: an event pause never asks whether its event already arrived", RN,
    "        if (waiting.kind === \"event\") {", "        if (false) {"),
  m("⚠ runner: the arrival race is asked for EVERY pause, so a timed wait costs a round trip", RN,
    "        if (waiting.kind === \"event\") {", "        if (waiting.kind !== \"nothing\") {"),
  m("⚠ runner: a failed hearing is RAISED, so a committed pause is reported as a failed run", RN,
    "          } catch (e) {\n            onError({ at: \"automation-hear\", runId, error: String(e?.message ?? e) });\n          }",
    "          } catch (e) {\n            throw e;\n          }"),
  m("⚠ runner: what the execution has heard is never handed to the executor", RN,
    "        heard: exec.heard,", "        heard: {},"),

  // ── the executor: the event step, and what a pause may bind ───────────────
  m("⚠ automations: an event heard for ANOTHER step resumes this one", AU,
    "        heard: Object.hasOwn(heard, id) ? heard[id] : null,", "        heard: heard[id] ?? Object.values(heard)[0] ?? null,"),
  m("⚠ automations: nothing heard yet is read as a FAILURE rather than a re-pause", AU,
    "    if (!heard || typeof heard !== \"object\") return { waiting: { kind: \"event\", ...config }, why: `${said} — nothing yet` };",
    "    if (!heard || typeof heard !== \"object\") return { stop: { reason: \"failed\", why: `${said} — nothing yet` } };"),
  m("⚠ automations: an event pause carries no `since`, so an old event satisfies a new wait", AU,
    "        if (waiting.kind === \"event\") waiting.since = new Date(now).toISOString();", "        void 0;"),
  m("⚠ automations: a pause binds nothing, so \"carry on with what it carried\" is a dead promise", AU,
    "      if (isText(config.out) && typeof answer?.bind === \"string\") values[config.out] = answer.bind;",
    "      void 0;"),
  m("automations: the event step drops its own `out`, so nothing can reference what it heard", AU,
    "    return { config: { name: name.value, out: o.out } };", "    return { config: { name: name.value } };"),
  m("⚠ automations: an event name is read as an ordinary name, so the two doors disagree", AU,
    "    { name: \"name\", kind: \"event\", required: true, says: \"the name of the event to wait for\",",
    "    { name: \"name\", kind: \"name\", required: true, says: \"the name of the event to wait for\","),
  m("automations: an event name's shape is not checked", AU,
    "  if (!EVENT_NAME.test(name)) {", "  if (false) {"),

  // ── connections.mjs and fake-provider.mjs — acting outside the platform ────
  //
  // ⚠ **THE RULE THIS DIRECTORY HAS EARNED FIVE TIMES: every property below is also proved
  // end to end by `verify:connections`, which `npm run sweep` does not run.** So each one has
  // a case in `test/connections.test.mjs` — a property proven only by an instrument the sweep
  // cannot run is a property no mutant can be caught by.
  m("connections: the record's action name is TRUNCATED rather than refused", CN,
    "  return ACTION_NAME.test(name) ? name : null;", "  return name.slice(0, 64);"),
  m("connections: the trace is minted per attempt, so a retry cannot find its own send", CN,
    "export const traceFor = (operation) => (isText(operation) ? operation.trim() : null);",
    "export const traceFor = (operation) => (isText(operation) ? `${operation}-${Math.random()}` : null);"),
  m("connections: the tenant is coerced rather than refused", CN,
    '      if (!isText(tenant)) throw new TypeError("forTenant: tenant must be a non-empty string");',
    "      tenant = String(tenant ?? \"\");"),
  m("connections: the agent is not checked, so any string scopes a connection", CN,
    '          if (!isId(agentId)) throw new TypeError("forAgent: agent must be a uuid");',
    "          if (false) { /* anything */ }"),
  m("⚠ connections: the adapter is chosen by an ARGUMENT rather than by the lease", CN,
    "            const adapter = Object.hasOwn(adapters, held.provider) ? adapters[held.provider] : null;",
    "            const adapter = adapters[args?.provider ?? held.provider] ?? null;"),
  m("connections: an action the adapter does not offer is passed to it anyway", CN,
    "            if (!adapter.actions.includes(act)) {", "            if (false) {"),
  m("⚠ connections: a write runs with no identity, so a retry does it twice", CN,
    "            const opId = splitOperation(operation);\n            if (!opId) {",
    "            const opId = splitOperation(operation) ?? { key: \"k\", hash: \"h\", run: null };\n            if (false) {"),
  m("⚠ connections: a claimed slot is sent to anyway, so a repeat sends a second message", CN,
    "            if (begun.began === false && begun.state === \"repeat\") {",
    "            if (false) {"),
  m("⚠ connections: an in-flight slot is RE-SENT rather than reconciled", CN,
    "            if (begun.began === false && begun.state === \"unfinished\") {",
    "            if (false) {"),
  // ⚠ **RE-ANCHORED, NOT APPEASED, AND THE FIRST OF THESE USED TO ASSERT THE DEFECT.** It was
  // pinned to `if (e?.uncertain)`, which reads every UNCLASSIFIED throw — a library's own
  // TypeError, a rejection with no shape — as *it definitely did not happen*: the record is
  // settled as a failure and no later delivery ever asks. The wall is `!== false` now, so the
  // property splits in two: the whole reconciliation gone, and the narrower mis-reading that
  // was the shipped bug. Both are worth a mutant because they fail differently.
  m("⚠ connections: an uncertain failure is read as a plain failure, so nobody checks", CN,
    "              if (e?.uncertain !== false) {", "              if (false) {"),
  m("⚠ connections: an UNCLASSIFIED throw is a definite refusal, so a lost message is never checked", CN,
    "              if (e?.uncertain !== false) {", "              if (e?.uncertain) {"),
  m("connections: a definite refusal is left in flight rather than settled", CN,
    '              const kept = await settleRecord(opId, recorded,\n                { ok: false, error: "refused", why: e?.why ?? "refused" });',
    "              const kept = { ok: true };"),
  m("connections: a successful send is never recorded, so a redelivery sends again", CN,
    "            const wrote = await settleRecord(opId, recorded, { ok: true, result: out });",
    "            const wrote = { ok: true };"),
  // ⚠ **A BOOKKEEPING FAULT MUST NOT CHANGE THE VERDICT ABOUT THE WORK.** An error escaping
  // the settle escapes `perform`, which the loop turns into a tool FAILURE — so a message that
  // really went out is reported as having failed and the model's next move is to send it
  // again. That is the blind retry this path exists to prevent, arriving through our own
  // accounting rather than through the provider.
  // ⚠ ONE LINE, BELOW THE COMMENT, ON PURPOSE: a multi-line anchor over the whole
  // try/catch is outrun by the next comment written inside it, which is this
  // repository's own most-repeated guard trap. Re-throwing is the same property.
  m("⚠ connections: the settle can throw, so a completed send is reported as a failure", CN,
    '              return { ok: false, error: e?.message ?? "the record could not be settled" };',
    "              throw e;"),
  m("connections: a record that did not land is silent, so nobody ever learns of it", CN,
    "            if (wrote?.ok === true) return answer;", "            if (true) return answer;"),
  m("connections: every answer claims its record did not land, so the field says nothing", CN,
    "            if (wrote?.ok === true) return answer;", "            if (false) return answer;"),
  // AND THE TWO WIRING HOPS: the helper is right and the CALL SITE hands it a fabricated
  // answer, which is this repository's most-recorded defect one indirection in.
  m("⚠ connections: the send's own answer is composed against a fabricated landed record", CN,
    "result: out }, wrote);", "result: out }, { ok: true });"),
  m("⚠ connections: a reconciled answer is composed against a fabricated landed record", CN,
    "              }, landed);", "              }, { ok: true });"),
  m("⚠ connections: an unresolved outcome is SETTLED as done, so an unknown reads as sent", CN,
    "            if (!seen || seen.known !== true) {", "            if (false) {"),
  m("connections: a reconciliation that cannot be made reads as not-done", CN,
    '              return { ...unresolved(e?.why ?? "the check itself could not be made"), reconcilable: true };',
    '              return { ok: false, error: "action-failed", action: act };'),
  m("⚠ connections: an action nobody can check afterwards is retried rather than reported", CN,
    "            if (typeof adapter.reconcile !== \"function\" ||\n                (typeof adapter.reconcilable === \"function\" && !adapter.reconcilable(act))) {",
    "            if (false) {"),
  m("connections: a read is recorded as an operation, so every lookup takes a row", CN,
    "            if (!writes) {", "            if (false) {"),
  m("⚠ connections: a READ that failed is reported as uncertain", CN,
    '                return { ok: false, error: "action-failed", action: act,\n                  why: e?.why ?? "the provider could not be reached", say: "that could not be read" };',
    '                return { ok: false, error: "unresolved", uncertain: true, action: act };'),
  m("connections: the action's own scope is never asked for", CN,
    "            const scoped = isText(needs) ? await lease(id, [needs]) : held;",
    "            const scoped = held;"),
  m("connections: the list is not scoped to the agent, so a sibling's connections show", CN,
    "            return readRows(`connection_list?tenant_id=eq.${encodeURIComponent(tenant)}` +\n              `&agent_id=eq.${encodeURIComponent(agentId)}&order=created_at.desc`);",
    "            return readRows(`connection_list?tenant_id=eq.${encodeURIComponent(tenant)}&order=created_at.desc`);"),
  m("connections: the list reads the TABLE, which holds the credentials", CN,
    "            return readRows(`connection_list?tenant_id=", "            return readRows(`connections?tenant_id="),
  m("connections: the profile header is chosen here instead of asked of the rule", CN,
    "    ...profileFor(method, schema),", '    "accept-profile": schema,'),
  m("⚠ fake-provider: the fake absorbs a duplicate, so the whole problem disappears", FP,
    "    minted += 1;\n    const id = `fake-msg-${minted}`;",
    "    const id = `fake-msg-1`;"),
  m("fake-provider: the credential is not checked, so 'it reached the provider' is unprovable", FP,
    "  const bad = (lease) => !isText(lease?.secret) || (expect !== null && lease.secret !== expect);",
    "  const bad = () => false;"),
  m("⚠ fake-provider: a timed-out WRITE is reported as certain, so nobody reconciles", FP,
    "        { uncertain: FAKE_WRITES.includes(action), status: 0 });",
    "        { uncertain: false, status: 0 });"),
  m("fake-provider: a definite refusal is reported as uncertain", FP,
    '      throw new FakeProviderError("the provider refused the request", { uncertain: false, status: 400 });',
    '      throw new FakeProviderError("the provider refused the request", { uncertain: true, status: 400 });'),
  m("fake-provider: reconciliation answers `known` with nothing to match on", FP,
    '    if (!isText(args?.trace)) return { simulated: true, known: false, why: "nothing to match on" };',
    "    if (!isText(args?.trace)) return { simulated: true, known: true, done: false };"),
  m("fake-provider: nothing says it is simulated", FP,
    "      return { simulated: true, provider: FAKE_PROVIDER, account: lease.account,\n               count: rows.length, messages: rows };",
    "      return { provider: FAKE_PROVIDER, account: lease.account, count: rows.length, messages: rows };"),
  // ── ⚠ A RECORDED OUTCOME IS REPLAYED FAITHFULLY, and this is the round's own defect ──
  //
  // The repeat branch answered `ok: true, "that had already been done"` whatever the record
  // held, so a REFUSED send came back a success on every redelivery and an unresolved one came
  // back settled. Three readings, and each fails differently: the first loses somebody's
  // message while claiming it went, the second turns cannot-tell into a value, and the third
  // hands the model the envelope where the provider's own answer belongs.
  //
  // ⚠ EVERY ANCHOR HERE IS ONE LINE, because a spec is JavaScript and an embedded newline in
  // one of these strings is a syntax error in the spec rather than in the product.
  m("⚠ connections: a recorded FAILURE is replayed as a success", CN,
    "            if (ok === false) {", "            if (false) {"),
  m("⚠ connections: a record with no outcome is replayed as a success", CN,
    "              ? outcome.ok : undefined;", "              ? outcome.ok !== false : true;"),
  m("connections: a replayed failure drops the reason the record kept", CN,
    '                recorded: typeof outcome.error === "string" ? outcome.error : null,',
    "                recorded: null,"),
  m("connections: a replayed success hands back the envelope rather than the provider's answer", CN,
    '                result: Object.hasOwn(outcome, "result") ? outcome.result : outcome,',
    "                result: outcome,"),
  m("connections: a replayed failure's sentence claims the work happened", CN,
    '                say: "that was tried before and did not go out — nothing was sent again" };',
    '                say: "that had already been done, so it was not done again" };'),
  m("connections: an unsettled record is replayed as a plain failure rather than as unknown", CN,
    '            return { ok: false, ...shell, error: "unresolved", uncertain: true,',
    '            return { ok: false, ...shell, error: "action-failed",'),

  m("connections/CONTROL (comment only)", CN,
    " * ── ⚠ THE CREDENTIAL NEVER COMES BACK OUT OF THIS MODULE ",
    " * ── The credential never comes back out of this module   ", true),

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
