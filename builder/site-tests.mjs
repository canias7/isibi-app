// THE SITE'S OWN TESTS: KEYS, STORAGE SHAPE AND WORDS (2026-10-30, `run_tests`).
//
// The site agent writes tests beside the site, under a reserved folder
// ("-tests/<name>.test.ts" or ".test.js"). They are kept with the site's source
// (`source/<slug>/tests.json`, beside `parts.json`) and NEVER published: they are
// not pages, not parts, never written into the build's routes, and the publish
// is handed pages and parts only. Shared by the Worker and the container.

export const TEST_PREFIX = "-tests/";
export const TEST_KEY = /^-tests\/[a-z0-9][a-z0-9-]{0,62}\.test\.(?:ts|js)$/i;
export const MAX_TESTS = 40;
export const MAX_TEST_CHARS = 60000;
/** One run's cap (a per-call cap, not a task cap). */
export const TEST_RUN_MS = 180_000;
export const TEST_ONE_MS = 30_000;
export const TESTS_KEY = (slug) => "source/" + String(slug).toLowerCase() + "/tests.json";

export const isTestKey = (k) => typeof k === "string" && TEST_KEY.test(k);

/** A stored list, cleaned: `[{ name: "-tests/x.test.ts", source }]`, valid keys only. */
export function cleanTests(list) {
  const out = [];
  const seen = new Set();
  for (const t of Array.isArray(list) ? list : []) {
    if (!t || !isTestKey(t.name) || typeof t.source !== "string" || !t.source.trim() || t.source.length > MAX_TEST_CHARS || seen.has(t.name)) continue;
    seen.add(t.name);
    out.push({ name: t.name, source: t.source });
    if (out.length >= MAX_TESTS) break;
  }
  return out;
}

/** Whether two test lists hold the same files and sources. */
export function sameTests(a, b) {
  const x = cleanTests(a), y = cleanTests(b);
  if (x.length !== y.length) return false;
  const m = new Map(x.map((t) => [t.name, t.source]));
  return y.every((t) => m.get(t.name) === t.source);
}

/**
 * Why a test's (transpiled) code may not run, or "". Tests reach the site only
 * through the test API: no imports, no require, no process or network handles.
 */
export function testRefusal(js) {
  const s = String(js || "").replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, "");
  if (/(^|[^.\w$])import\s*[\s({*"'`]/.test(s) || /\bimport\s*\(/.test(s)) return "a test imports nothing: the test API (test, expect, site, page, db, outbound, webhook, runSchedule) is already there";
  if (/\brequire\s*\(/.test(s)) return "a test cannot require modules";
  if (/\bprocess\s*\.\s*(binding|dlopen|kill|exit|env)\b/.test(s)) return "a test cannot touch the process";
  return "";
}

const clip = (s, n) => (String(s || "").length > n ? String(s).slice(0, n) + "…" : String(s || ""));

/** The run, in words for the agent: every test, pass or fail, with its message. */
export function testReport(r) {
  if (!r || r.ran !== true) return "The tests could not run: " + clip((r && (r.why || r.error)) || "no answer", 300) + ".";
  const list = Array.isArray(r.results) ? r.results : [];
  const failed = list.filter((x) => !x.ok);
  const head = failed.length ? failed.length + " of " + list.length + " FAILED" : "All " + list.length + " passed";
  const lines = list.slice(0, 80).map((x) => (x.ok ? "PASS " : "FAIL ") + (x.file ? x.file + " › " : "") + clip(x.name, 120) + (typeof x.ms === "number" ? " (" + x.ms + " ms)" : "") + (x.ok ? "" : "\n     " + clip(x.error, 500)));
  return head + " in " + (Number(r.ms) || 0) + " ms.\n" + lines.join("\n") + (r.timedOut ? "\nThe run hit its " + Math.round(TEST_RUN_MS / 1000) + " s cap and was stopped." : "");
}

export const testsFailed = (r) => !r || r.ran !== true || (Array.isArray(r.results) ? r.results : []).some((x) => !x.ok);

/** The instructions appended to the agent's rules when `run_tests` is wired. */
export const TESTING_RULES = `

TESTING WHAT YOU BUILD (run_tests):
- Anything you build or change that BEHAVES (a server function, a form, stored data, a schedule, a webhook, an outside service) is proven by a test before you finish. Decide what proves it works for the owner, write that test, run it with run_tests, fix what fails, and run again. Finish only when they pass — or say in finish exactly what you could not test and why.
- Tests are files "-tests/<name>.test.ts" (or .js), written with write_file. They are kept with the site, never published, and every later change runs them again: keep them passing, and fix a regression (or say why the test is now wrong and change it).
- Assert by MEANING, never by spelling: the status, the stored row, the field in the JSON, the call made — not a sentence's exact words or markup. Test the failure paths too (missing field → 400, unsigned webhook → refused, missing key → 503).
- Tests run against a PRIVATE copy of the draft with a THROWAWAY database and no network. Never the live site, its database or the owner's keys.
- No imports. These are already there:
  test(name, async () => { … }); expect(v).toBe / toEqual / toContain / toMatch / toBeTruthy / toBeFalsy / toBeGreaterThan / toBeLessThan / toHaveLength / toHaveProperty, and .not.
  site.call("fn-name", { method, body, query, headers }) → { status, ok, json, text, headers } (the function "-parts/server-fn-name"; body an object is sent as JSON).
  db.query(sql, params), db.seed("table", [rows]), db.rows("table"), db.on(/pattern/, rows) — a fresh database per test, made from the site's tables.
  outbound.fake("api.stripe.com/v1/checkout", { status: 200, body: {…} }); outbound.calls("stripe") → [{ url, method, headers (secrets redacted), body }]. Every site.fetch is recorded and answered (default 200 {}), never sent.
  webhook("fn-name", body, { sign: "KEY_NAME", header: "stripe-signature", signed: (raw) => "123." + raw, format: (sig) => "t=123,v1=" + sig }) — signed with a TEST secret, never the owner's key; webhook.sign(name, payload) gives the signature.
  runSchedule("tick" | "cron:…" | "fn-name") runs the scheduled functions now.
  const p = await page("/contact"); await p.fill("input[name=email]", "a@b.co"); await p.click("button[type=submit]"); await p.waitFor("text=Thanks"); await p.text("main"); await p.count("li"); await p.screenshot(). The page's calls to the site's functions reach the same functions, database and fakes.`;
