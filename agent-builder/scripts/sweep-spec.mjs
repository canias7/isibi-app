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
const A2 = at("agents.mjs");
const RN = at("runner.mjs");
const ST = at("model-standin.mjs");
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
    'body: { id: runId, tenant_id: tenant }, write: true, prefer: "return=minimal"',
    'body: { id: runId, tenant_id: tenant, status: "running" }, write: true, prefer: "return=minimal"'),
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
    '        "content-profile": schema,', "        // no profile"),

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
  m("runner: a conflict takes the run OFF the queue, so nobody ever reads the real log", at("runner.mjs"),
    "        return await finish(false, \"conflict\", \"another writer's entry is in this run's log\");",
    "        return await finish(true, \"conflict\", \"another writer's entry is in this run's log\");"),
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
