// A FUNCTION'S ANSWER IS UNKNOWN UNTIL IT ARRIVES — THE RULE, AND THE RUNG
// THAT HAS TO DELIVER IT.
//
// Run 21 (2026-09-22, `fretwork-1`) is the reproduction. The real model,
// shown the site's own `day-space-lookup` component, changed the calculation
// and the wording together — six of six counts right — and every state that
// was NOT a count read "6 places left on this day": pending, a 503 on every
// try, a 404 and a 200 `null`. Measured live in a real Chromium with the
// function answered by the browser, so no row was ever written.
//
// TWO CAUSES, and each is its own group below:
//
//   1. NO RULE SAID IT. `useRpc` is a query whose `data` is `undefined` while
//      it waits and after it fails, and `null` when the function answers
//      nothing. Nothing in the page rules told a writer that, so the page
//      collapsed all three into `Number(bookingCount ?? 0)` and a component
//      that subtracts from six printed "six places left" about a day nobody
//      had read. RULE 11 carries the paragraph now.
//
//   2. THE REWRITE COULD NOT HAVE READ IT ANYWAY. `fretwork-1` is one of the
//      four `incomplete` sites — the database is real and
//      `site_backends.neon_db` is blank — and in the container, which has no
//      `SITE_ROUTES`, `siteBackendBySlug` answers `null` for that. The rung
//      read the `null` as "no database", handed the writer the FRONTEND rules
//      ("THIS SITE HAS NO DATABASE … no useRpc", rule 11 dropped whole), and
//      the writer rewrote a page and a component that read the database while
//      being told there was none. Run 21's four wire problems are
//      byte-identical to `lintPages` over `{ tables: [] }`.
//
// SO THE RULE ALONE IS INERT ON EXACTLY THE SITE THAT NEEDED IT, which is why
// the route cases below are the half that matters: they drive the real
// `POST /api/site/<slug>/edit` and read the system block that really went to
// the writer.
//
// ⚠ WHAT THIS FILE DOES NOT CLAIM. Every model answer here is SUPPLIED, so
// what is established is that the rule is in the prompt and the prompt reaches
// the writer — never that a real model obeys it. That is a live run, and the
// acceptance for it stays open.
//
// AND A THIRD GROUP, FROM RUN 24 (2026-09-23). The real writer obeyed the state
// paragraph — "Checking…", "Couldn't check — try again", "Not available", the
// query handed over whole — and then turned ANY answer into a count with
// `Number(data)` after its null check: `[]`, `false`, `""` and whitespace read
// "Six places left.", `true` read 5 and `[2]` read 4. So rule 11 also says a
// real answer is one that matches what the function is declared to return,
// checked before any calculation, with the booking count's check as an
// EXAMPLE and not a rule for every function.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { renderPart } from "./fixtures/render-part.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "./fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
// THE TOOL NAMES COME FROM THE MODULES THAT DEFINE THEM — a hand-typed name is
// a stub that never matches, and a case that "fails" for a reason that has
// nothing to do with its subject.
import { TWEAK_TOOL } from "../builder/site-tweak.mjs";
import {
  SITE_PAGES_TOOL, PAGE_RULES, FRONTEND_PAGE_RULES, pageRulesFor, pagesRequest, lintPages,
  frontendRules, withoutCharts,
} from "../builder/page-gen.mjs";
import { bandRequest, partRequest } from "../builder/page-bands.mjs";
// ⚠ `editBrowserReply`, NOT `browserReply` — the add composer answers a
// plausible sentence for an edit body rather than throwing.
import { editBrowserReply } from "../scripts/addon-sweep.mjs";

// ─────────────────────────────────────────────────────────────────────────────
// THE PARAGRAPH, BY ITS OWN HEADLINE
// ─────────────────────────────────────────────────────────────────────────────

const HEADLINE = "A FUNCTION'S ANSWER DOES NOT EXIST UNTIL IT ARRIVES";
const FRONTEND_MARK = "THIS SITE HAS NO DATABASE";
// THE ANSWER CHECK, and the booking count's EXAMPLE of one. The example has to
// stay an example: other functions legitimately answer decimals, negatives,
// objects and lists, so a writer that read it as a rule for every function
// would refuse real answers.
const ANSWER_CHECK = "a real answer is one that matches what the function is declared to return";
const COUNT_EXAMPLE = 'typeof data === "number" && Number.isInteger(data) && data >= 0';
/** Whitespace folded: the rules are hard-wrapped, and where a line breaks is layout, not wording. */
const fold = (s) => String(s).replace(/\s+/g, " ");
/** Does a block of rules carry the answer check — the requirement AND its example? */
const carriesCheck = (s) => fold(s).includes(ANSWER_CHECK) && fold(s).includes(COUNT_EXAMPLE);

/**
 * Rule 11's own text, landmark to landmark.
 *
 * ⚠ BOTH LANDMARKS ARE PROVED TO EXIST before the window is believed:
 * `indexOf` answering -1 turns a slice into `""` or into the rest of the file,
 * and either one passes every assertion made inside it.
 */
function rule11(rules) {
  const at = rules.indexOf("\n11. ");
  assert.ok(at >= 0, "rule 11's own mark is gone, so nothing below reads rule 11");
  const end = rules.indexOf("\n12. ", at);
  assert.ok(end > at, "rule 12's mark is gone or above rule 11, so the window has no end");
  return rules.slice(at, end);
}

// ── 1. THE RULE ─────────────────────────────────────────────────────────────

test("rule 11 says what a function's answer is before it arrives, and what never to do with it", () => {
  // ONE SPACE FOR EVERY RUN OF WHITESPACE, because the rules are hard-wrapped
  // and where a line breaks is layout, not wording: "Couldn't check —" ends
  // one line and "try again" opens the next. A phrase pinned to a literal space
  // goes red the day the paragraph is re-wrapped, reporting the rule as gone.
  const r11 = rule11(PAGE_RULES).replace(/\s+/g, " ");
  // THE OBSERVER IS ALIVE: the window really is rule 11, not an empty slice.
  assert.match(r11, /ANYTHING THE SCHEMA DECLARES AS A FUNCTION/,
    "the window is not rule 11, so every absence below would be about nothing");
  // THE PARAGRAPH SITS INSIDE RULE 11 — and that placement is load-bearing.
  // `hardRulesWithoutData` drops rule 11 as a UNIT, so inside it the
  // paragraph leaves the frontend prompt with the rule it belongs to; one
  // numbered rule over, it would reach every first build or none.
  assert.ok(r11.includes(HEADLINE), "rule 11 no longer carries the state paragraph");

  // THE THREE NON-ANSWERS ARE NAMED, each as what the kit really answers.
  assert.match(r11, /`data` is `undefined` while the call is waiting and after it has failed/,
    "rule 11 does not say `data` is undefined while waiting and after a failure");
  assert.match(r11, /`null`\s+when the function answers nothing/,
    "rule 11 does not say `data` is null when the function answers nothing");
  assert.match(r11, /None of those is zero, and none is empty/,
    "rule 11 does not say the three non-answers are neither zero nor empty");

  // EVERY DEFAULT THAT TURNS "UNKNOWN" INTO "ZERO" IS FORBIDDEN BY NAME.
  // Run 21's page wrote the first of these; the rest are the same collapse in
  // the other spellings a writer reaches for, and each is its own assertion so
  // a trimmed list names what it lost.
  for (const d of ["`data ?? 0`", "`data || 0`", "`data ?? []`", "`Number(data)`", "`{ data = 0 }`"]) {
    assert.ok(r11.includes(d), "rule 11 no longer forbids " + d);
  }

  // EACH STATE GETS ITS OWN WORDS, and only a real answer may state a number.
  assert.match(r11, /waiting \("Checking…"\)/, "rule 11 does not give the waiting state its own words");
  assert.match(r11, /failed \("Couldn't check — try again"\)/, "rule 11 does not give the failed state its own words");
  assert.match(r11, /nothing \("Not available"\)/, "rule 11 does not give the empty answer its own words");
  assert.match(r11, /Only a real answer may state a number/,
    "rule 11 no longer says only a real answer may state a number");

  // AND THE QUERY TRAVELS WHOLE. Run 21's defect lived in the HAND-OFF: the
  // page collapsed the query to a number before the component ever saw it, so
  // a component written perfectly could not tell unknown from zero.
  assert.match(r11, /takes the query itself —\s+`\{ isPending, isError, data \}` — as its prop, never the bare number/,
    "rule 11 no longer says a component takes the query rather than the bare number");
});

test("rule 11 checks an answer against what the function returns before any calculation, the count check only an example", () => {
  const r11 = fold(rule11(PAGE_RULES));
  assert.match(r11, /ANYTHING THE SCHEMA DECLARES AS A FUNCTION/,
    "the window is not rule 11, so every absence below would be about nothing");

  // THE REQUIREMENT, and where the expected answer comes from: the digest's
  // own arrow (`name(args) -> <returns>`), which every backend prompt carries.
  assert.ok(r11.includes(ANSWER_CHECK), "rule 11 no longer ties a real answer to the function's declared return");
  assert.match(r11, /the digest prints that after the arrow\. Check it before any calculation\./,
    "rule 11 no longer says to check the answer before any calculation");

  // THE BOOKING COUNT'S CHECK IS AN EXAMPLE, AND SAYS SO ON BOTH SIDES OF
  // ITSELF: "For example" before it and "not for every function" straight
  // after, so it cannot be read as a restriction on every function's answer.
  assert.ok(r11.includes("For example, a booking count is real only when `" + COUNT_EXAMPLE
    + "`. That check is for a count, not for every function"),
    "the integer check is no longer framed as a booking count's example");
  // AND NO SECOND COPY OF IT STATES IT AS A RULE — it occurs once in the whole prompt.
  assert.equal(PAGE_RULES.split("Number.isInteger").length - 1, 1,
    "the integer check appears somewhere else in the rules, outside its example");
  // OTHER FUNCTIONS' REAL ANSWERS ARE NAMED AS REAL, each against its own declared type.
  assert.match(r11, /may rightly answer a decimal, a negative number, an object or an array, and is checked against its own declared type/,
    "rule 11 no longer says decimals, negatives, objects and lists are real answers where declared");

  // A VALID ZERO SURVIVES THE CHECK — the one real answer a truthiness test throws away.
  assert.match(r11, /A zero that passes is a real answer, so test the type and never truthiness \(`if \(!data\)` throws the zero away\)/,
    "rule 11 no longer protects a real zero");
  // ANYTHING ELSE IS NOT AN ANSWER, gets the words the paragraph already
  // gives "nothing", and is never converted into one.
  assert.match(r11, /Anything that fails the check is not an answer and gets the "nothing" words/,
    "rule 11 no longer says what a failed check shows");
  assert.match(r11, /Never convert it into one: `Number\(data\)` and `\+data` turn `\[\]`, `""` and `false` into 0 and `true` into 1, and `parseInt` reads `\[2\]` as 2/,
    "rule 11 no longer forbids converting an answer into a count");

  // A RULE THAT TELLS A MODEL WHAT JAVASCRIPT DOES HAD BETTER BE RIGHT ABOUT
  // JAVASCRIPT: each conversion it names does exactly what it says.
  assert.deepEqual([[], "", false, true].map(Number), [0, 0, 0, 1]);
  assert.deepEqual([[], "", false, true].map((v) => +v), [0, 0, 0, 1]);
  assert.equal(parseInt([2]), 2);

  // THE ORDER: the state paragraph, then the requirement, then its example.
  const at = (s) => r11.indexOf(s);
  assert.ok(at(HEADLINE) >= 0 && at(ANSWER_CHECK) > at(HEADLINE) && at(COUNT_EXAMPLE) > at(ANSWER_CHECK),
    "the answer check is out of order inside rule 11");
});

test("the paragraph reaches every site with a backend and no site without one", () => {
  const backend = { tables: [{ name: "bookings", columns: [{ name: "day", type: "date" }] }] };
  const fnOnly = { tables: [], functions: [{ name: "bookings_on_day", args: [], returns: "integer" }] };
  const none = { tables: [] };
  for (const kind of ["", "shopfront"]) {
    // THE FULL RULES, for both kinds — `withoutCharts` strips a section and
    // must never take rule 11 with it.
    assert.ok(pageRulesFor(backend, kind).includes(HEADLINE),
      "a site with tables (kind " + JSON.stringify(kind) + ") does not get the state paragraph");
    // A FUNCTION WITH NO TABLE IS A BACKEND TOO (`siteHasBackend`), and the
    // paragraph is about functions above all.
    assert.ok(pageRulesFor(fnOnly, kind).includes(HEADLINE),
      "a site with a function and no table (kind " + JSON.stringify(kind) + ") does not get the state paragraph");
    // THE ANSWER CHECK RIDES WITH IT, to the same two kinds of backend site.
    assert.ok(carriesCheck(pageRulesFor(backend, kind)),
      "a site with tables (kind " + JSON.stringify(kind) + ") does not get the answer check");
    assert.ok(carriesCheck(pageRulesFor(fnOnly, kind)),
      "a site with a function and no table (kind " + JSON.stringify(kind) + ") does not get the answer check");
    // AND NOTHING LEAKS INTO A FRONTEND SITE, whose prompt says there is no
    // function to call. The marker is asserted beside the absence, so the
    // absence is about the frontend prompt and not about an empty string.
    const front = pageRulesFor(none, kind);
    assert.ok(front.includes(FRONTEND_MARK), "the frontend rules lost their own opening, so this control is about nothing");
    assert.ok(!front.includes(HEADLINE),
      "the state paragraph leaked into a site with no database (kind " + JSON.stringify(kind) + ")");
    assert.ok(!fold(front).includes(ANSWER_CHECK) && !front.includes("Number.isInteger"),
      "the answer check leaked into a site with no database (kind " + JSON.stringify(kind) + ")");
  }
  // THE MODULE'S TWO BLOCKS, directly — the same property one layer down.
  assert.ok(PAGE_RULES.includes(HEADLINE));
  assert.ok(!FRONTEND_PAGE_RULES.includes(HEADLINE), "FRONTEND_PAGE_RULES carries the paragraph");
  assert.ok(carriesCheck(PAGE_RULES), "PAGE_RULES does not carry the answer check");
  assert.ok(!fold(FRONTEND_PAGE_RULES).includes(ANSWER_CHECK), "FRONTEND_PAGE_RULES carries the answer check");
});

test("the frontend prompts are byte-for-byte what they are without the answer check", () => {
  // UNCHANGED IS A COMPARISON, NOT AN ABSENCE. A frontend prompt could lack the
  // new words and still have moved, so the check is DERIVED: cut the answer
  // check back out of PAGE_RULES, derive the frontend prompt from what is
  // left, and require it to be the prompt the module really serves. Rule 11
  // leaves the frontend prompt as a unit, so nothing inside it can reach one.
  const ADDED = /, and a real answer is one that matches what the function is\s+declared to return[\s\S]*?a count nobody measured\./;
  const without = PAGE_RULES.replace(ADDED, ".");
  // THE CUT REALLY HAPPENED, and took the answer check and nothing else.
  assert.notEqual(without, PAGE_RULES, "the answer check was not found, so the comparison below is about nothing");
  assert.ok(!without.includes(COUNT_EXAMPLE), "the cut left the booking-count example behind");
  assert.ok(without.includes(HEADLINE) && fold(without).includes('"has space". A component that shows the answer takes the query itself'),
    "the cut took more than the answer check");
  assert.equal(frontendRules(without), FRONTEND_PAGE_RULES,
    "the frontend prompt moved when rule 11 gained its answer check");
  for (const kind of ["", "shopfront"]) {
    const front = pageRulesFor({ tables: [] }, kind);
    assert.ok(front.includes(FRONTEND_MARK), "the frontend rules lost their own opening, so this control is about nothing");
    const expected = kind === "shopfront" ? withoutCharts(frontendRules(without)) : frontendRules(without);
    assert.equal(front, expected, "the frontend prompt for kind " + JSON.stringify(kind) + " is not what it was without the answer check");
  }
});

test("every writer that takes the page rules takes the paragraph with them", () => {
  // THE REACH, BY THE REQUEST THAT WOULD GO OUT. Three writers share
  // `pageRulesFor`'s block — the page call, a band and a component — and a
  // fourth copy of the rules anywhere would be where this stops arriving.
  const spec = { tables: [{ name: "bookings", columns: [{ name: "day", type: "date" }] }],
    functions: [{ name: "bookings_on_day", args: [{ name: "day", type: "date" }], returns: "integer" }] };
  const sys = (req) => (req && Array.isArray(req.system) && req.system[0] && req.system[0].text) || "";
  const page = pagesRequest({ brief: "places left on a day", spec, brand: "Fretwork", priorPages: [], mode: "page", target: "index.tsx" });
  const band = bandRequest({ brief: "places left on a day", spec, brand: "Fretwork", lines: ["Hero", "Availability"], index: 1, name: "Availability" });
  const part = partRequest({ brief: "places left on a day", spec, brand: "Fretwork", lines: ["Hero"],
    part: { name: "day-space-lookup", does: "shows the places left on a chosen day", props: "none" } });
  for (const [who, req] of [["page", page], ["band", band], ["part", part]]) {
    assert.ok(sys(req).length > 1000, "the " + who + " request has no system block to read, so its absence below means nothing");
    assert.ok(sys(req).includes(HEADLINE), "the " + who + " writer is not given the state paragraph");
    assert.ok(carriesCheck(sys(req)), "the " + who + " writer is not given the answer check");
  }
  // AND ALL THREE ARE ONE BLOCK, byte for byte — the cache prefix and the
  // single place a rule is fixed.
  assert.equal(sys(band), sys(page), "the band's rules are a different block from the page's");
  assert.equal(sys(part), sys(page), "the component's rules are a different block from the page's");
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. THE PAGE RUNG THAT HAS TO DELIVER IT, THROUGH THE REAL ROUTE
// ─────────────────────────────────────────────────────────────────────────────

const USER = { id: "u-rpcstate-1", email: "owner@example.com" };
const TOKEN = "Bearer some-token";
const SOURCE_KEY = (slug) => "source/" + String(slug).toLowerCase() + "/pages.json";
const PARTS_KEY = (slug) => "source/" + String(slug).toLowerCase() + "/parts.json";
const PROJECT_CONN = "postgres://u:p@host.neon.tech/neondb";

// A PAGE THAT READS THE DATABASE, because the whole defect is a writer told
// there is none while rewriting one that does. `createFileRoute(` is required:
// `validatePages` refuses a page without it and the rung then escalates for a
// reason that has nothing to do with this file.
const ROUTE_HEAD = "import { createFileRoute } from '@tanstack/react-router'\n"
  + 'import { useRpc } from "@/lib/rows"\n'
  + "export const Route = createFileRoute('/')({ component: Home })\n";
const pageWith = (h1) => ROUTE_HEAD
  + 'function Home(){ const q = useRpc("bookings_on_day", { day: "2026-09-22" }); '
  + "return <main><h1>" + h1 + "</h1><p>{q.isPending ? \"Checking…\" : q.isError ? \"Couldn't check — try again\" : String(q.data)}</p></main> }\n";
const HOME = pageWith("Fretwork");
// WHAT THE WRITER HANDS BACK — different each time it is asked, because the
// rung refuses `no-change` for a page returned byte-identical.
const WRITTEN = (i) => pageWith("Fretwork " + (i + 2));

// THE SCHEMA THE DATABASE REALLY HAS: a table and the function run 21's box
// calls. `_meta` holds it and the catalog agrees, which is `stored`.
const SPEC = {
  tables: [{ name: "bookings", columns: [{ name: "day", type: "date" }, { name: "name", type: "text" }], read: "none", write: "anyone" }],
  functions: [{ name: "bookings_on_day", args: [{ name: "day", type: "date" }], returns: "integer" }],
};
const CATALOG = { bookings: ["id", "day", "name", "created_at"] };

function bucket(slug) {
  const store = new Map([
    [SOURCE_KEY(slug), JSON.stringify([{ path: "index.tsx", source: HOME }])],
    [PARTS_KEY(slug), "[]"],
    [CONFIG_KEY(slug), JSON.stringify({ look: { brand: "Fretwork", theme: "broadsheet" }, css: "" })],
  ]);
  return {
    store,
    async get(k) { const v = store.get(k); return v === undefined ? null : { text: async () => v }; },
    async put(k, v) { store.set(k, String(v)); },
    async delete(k) { store.delete(k); },
    async list() { return { objects: [], truncated: false }; },
  };
}

/** Which of the catalog-aware reader's questions is this? Matched on the module's own query text. */
const asksCatalog = (q) => /information_schema\.columns/i.test(String(q));
const asksMeta = (q) => /_meta/i.test(String(q)) && /k\s*=\s*'schema'/i.test(String(q));
const asksPerms = (q) => /privileges|pg_policies|pg_trigger/i.test(String(q));

/**
 * A DATABASE WHOSE CATALOG AND `_meta` CAN DISAGREE, answered in the
 * serverless driver's own shape — `rows` are arrays of VALUES and `fields`
 * carries the names (derived from the driver in `edit-rules-backend`; a
 * Postgres-looking `{rows:[{...}]}` makes the driver throw and a case pass for
 * the wrong reason). `spec: null` is THE ROW ABSENT.
 */
function database({ tables = CATALOG, spec = SPEC, down = false, catalogDown = false } = {}) {
  return (asked) => {
    if (down) return { fail: true };
    if (asksCatalog(asked)) {
      if (catalogDown) return { fail: true };
      const rows = [];
      for (const [t, cols] of Object.entries(tables)) for (const c of cols) rows.push([t, c, "text"]);
      return { rows, fields: ["t", "c", "ty"] };
    }
    if (asksMeta(asked)) return { rows: spec === null ? [] : [[JSON.stringify(spec)]], fields: ["v"] };
    if (asksPerms(asked)) return { rows: [], fields: ["t"] };
    // Everything else — the `incomplete` probe among them — answers empty.
    return { rows: [], fields: ["x"] };
  };
}

const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });

/**
 * THE WIRE, WITH THE TWO BACKEND READS AND THE DATABASE AS ITS SEAMS.
 *
 * `site_backends` and `site_project` are the two rows `backendState` decides
 * from, so driving them drives the four states through the REAL resolver.
 * `wire` is read at request time, so a case can change the site between two
 * messages — a site that gains a database between one edit and the next.
 *
 * The model is answered per TOOL, and a tool with no stub is refused rather
 * than given a plausible answer.
 */
function withWire(wire, run) {
  const real = globalThis.fetch;
  const seen = { calls: [], sql: [], patches: [] };
  globalThis.fetch = async (input, init) => {
    const url = String((input && input.url) || input || "");
    const method = String((init && init.method) || "GET").toUpperCase();
    if (url.includes("/auth/v1/user")) return json(USER);
    if (url.includes("/rpc/use_credits")) {
      let want = 0;
      try { want = Number(JSON.parse(String(init && init.body) || "{}").cost) || 0; } catch { want = 0; }
      return json(want);
    }
    if (url.includes("/rest/v1/site_backends")) {
      // NOTHING ON THIS RUNG WRITES THE REFERENCE, and a PATCH is how one
      // would — so it is recorded, never answered as a success nobody asked for.
      if (method === "PATCH") { seen.patches.push(url); return json([]); }
      return json(wire.backends);
    }
    if (url.includes("/rest/v1/site_project")) return json(wire.project);
    if (/neon\.tech|\/sql$/.test(url)) {
      let asked = "";
      try { asked = String(JSON.parse(String((init && init.body) || "{}")).query || ""); }
      catch { asked = String((init && init.body) || ""); }
      seen.sql.push(asked);
      const a = (wire.sql || database())(asked);
      if (a.fail) return new Response("could not connect", { status: 500 });
      const fields = a.fields.map((n) => ({ name: n, dataTypeID: 25, tableID: 0, columnID: 0, dataTypeSize: -1, dataTypeModifier: -1, format: "text" }));
      return json({ command: "SELECT", rowCount: a.rows.length, rows: a.rows, fields });
    }
    if (url.includes("/v1/messages")) {
      let body = {};
      try { body = JSON.parse(String(init && init.body) || "{}"); } catch { body = {}; }
      const tool = body.tool_choice?.name || "";
      seen.calls.push({ tool, body });
      if (!Object.hasOwn(wire.answers, tool)) return new Response("no stub for tool " + tool, { status: 503 });
      const a = wire.answers[tool];
      const input2 = typeof a === "function" ? a(seen.calls.filter((c) => c.tool === tool).length - 1) : a;
      return json({
        stop_reason: "tool_use",
        content: [{ type: "tool_use", name: tool, input: input2 }],
        usage: { input_tokens: 10, output_tokens: 5 },
      });
    }
    if (isDispatchUpload(url)) return dispatchOk();
    return new Response("unavailable", { status: 503 });
  };
  return (async () => {
    try { return await run(seen); } finally { globalThis.fetch = real; }
  })();
}

/**
 * THE TWEAK DECLINES, SO THE REWRITE RUNS — the only writer on this rung that
 * reads the page rules. The quick writer is not under test here.
 */
const ANSWERS = {
  [TWEAK_TOOL.name]: { cannot: "that needs the page rewritten" },
  [SITE_PAGES_TOOL.name]: (i) => ({ pages: [{ path: "src/routes/index.tsx", source: WRITTEN(i) }] }),
};

async function edit(slug, store) {
  const worker = await loadWorker();
  const req = new Request("https://gofarther.dev/api/site/" + slug + "/edit", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: TOKEN },
    body: JSON.stringify({ layer: "page", page: "/", remove: false, rename: "", tab: false,
      instruction: "The box counts bookings. Make it count down the places left instead.", picker: "sonnet" }),
  });
  const res = await worker.fetch(req, { SITES_BUCKET: store, ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key", ...dispatchEnv() }, makeCtx());
  const body = await res.clone().json().catch(() => null);
  return { status: res.status, body, said: editBrowserReply(body, res.ok) };
}

/** The page writer's calls, in order — the one writer here that reads `pageRulesFor`. */
const writerCalls = (seen) => seen.calls.filter((c) => c.tool === SITE_PAGES_TOOL.name);
const systemOf = (call) => String(call.body.system && call.body.system[0] && call.body.system[0].text || "");
const userOf = (call) => {
  const m = call.body.messages && call.body.messages[0];
  const c = m && m.content;
  return typeof c === "string" ? c : JSON.stringify(c);
};
/** Did the browser's own handling record a second, PAID request? */
const paidActions = (said) => (said.actions || []).filter((a) => /PAID|rewrite/i.test(a));

/**
 * THE WRITER GOT THE DATABASE SITE'S PROMPT: the full rules with the paragraph,
 * and the schema that really exists with the function in it.
 */
function assertDatabasePrompt(call, why) {
  const sys = systemOf(call);
  assert.ok(sys.length > 1000, why + ": the writer's system block is empty, so nothing below reads it");
  assert.ok(sys.includes(HEADLINE), why + ": the writer was not given the state paragraph");
  assert.ok(carriesCheck(sys), why + ": the writer was not given the answer check");
  assert.ok(!sys.includes(FRONTEND_MARK), why + ": the writer was told the site has no database");
  const user = userOf(call);
  assert.ok(user.includes("THE SCHEMA THAT EXISTS"), why + ": the writer was not shown the site's schema");
  assert.match(user, /bookings_on_day\(day: date\) -> integer/, why + ": the function the page calls is not in the digest");
}

// ── 2a. INCOMPLETE — run 21's own state ─────────────────────────────────────

test("an incomplete site's rewrite gets the database rules, and nothing is written back", async () => {
  // RUN 21'S STATE VERBATIM: a project row carrying the credential, a blank
  // `neon_db`, a database that answers, and a stored schema declaring the
  // function the page calls. The old rung read the fast reader's `null` as
  // "no database" and sent the frontend rules.
  const slug = "rpcstate-incomplete";
  const store = bucket(slug);
  const c = installCompiler();
  try {
    const wire = {
      backends: [{ uid: USER.id, brief: "", neon_db: "" }],
      project: [{ uid: USER.id, neon_conn: PROJECT_CONN }],
      sql: database(),
      answers: ANSWERS,
    };
    const r = await withWire(wire, (seen) => edit(slug, store).then((x) => ({ ...x, seen })));
    // THE CATALOG WAS REALLY ASKED — the catalog-aware reader, not a bare
    // `_meta` read — so the case is about the reader it names.
    assert.ok(r.seen.sql.some(asksCatalog), "the table inventory was never read: " + JSON.stringify(r.seen.sql.map((q) => q.slice(0, 40))));
    const w = writerCalls(r.seen);
    assert.equal(w.length, 1, "expected one rewrite, got " + w.length + ": " + JSON.stringify(r.body));
    assertDatabasePrompt(w[0], "incomplete");
    assert.equal(r.body && r.body.ok, true, "the edit did not publish: " + JSON.stringify(r.body));
    // READ-ONLY: this rung records nothing, whatever it resolved.
    assert.deepEqual(r.seen.patches, [], "this rung wrote the backend reference: " + JSON.stringify(r.seen.patches));

    // ⚠ AND THE REPLY STOPS TELLING THE CUSTOMER A WORKING FUNCTION IS A 404.
    // Run 11's and run 21's wire problems were `lintPages` over `{ tables: [] }`
    // — "calls the database function … which this schema does not declare".
    // The observer is proved alive first: the SAME page over the empty spec
    // really does produce that line, so its absence below is a reading.
    const blind = lintPages([{ path: "index.tsx", source: WRITTEN(0) }], { tables: [] });
    assert.ok(blind.some((p) => /bookings_on_day/.test(p) && /does not declare/.test(p)),
      "the lint no longer flags an undeclared function, so the absence below proves nothing: " + JSON.stringify(blind));
    const problems = (r.body && r.body.problems) || [];
    assert.ok(!problems.some((p) => /does not declare/.test(String(p))),
      "the reply still reports the site's own schema as undeclared: " + JSON.stringify(problems));
  } finally { c.uninstall(); }
});

test("a missing schema row on an incomplete site is recovered, not called empty", async () => {
  // THE CATALOG-AWARE READER IS WHY A RESOLVED SITE DOES NOT READ `_meta`
  // ALONE: its schema row is the one most likely to disagree with its
  // database. Read bare, a missing row is `null` and the rung escalates
  // `no-meta` — which the browser turns into the ~25-credit rewrite of every
  // page. `specForAddon` rebuilds the declaration from the live table and
  // verifies it, READ-ONLY.
  const slug = "rpcstate-norow";
  const store = bucket(slug);
  const c = installCompiler();
  try {
    const wire = {
      backends: [{ uid: USER.id, brief: "", neon_db: "" }],
      project: [{ uid: USER.id, neon_conn: PROJECT_CONN }],
      sql: database({ spec: null }),
      answers: ANSWERS,
    };
    const r = await withWire(wire, (seen) => edit(slug, store).then((x) => ({ ...x, seen })));
    assert.ok(r.seen.sql.some(asksCatalog), "the table inventory was never read");
    assert.notEqual(r.body && r.body.escalate, true, "a missing schema row escalated: " + JSON.stringify(r.body));
    const w = writerCalls(r.seen);
    assert.equal(w.length, 1, "the rewrite never ran: " + JSON.stringify(r.body));
    const sys = systemOf(w[0]);
    assert.ok(sys.includes(HEADLINE) && !sys.includes(FRONTEND_MARK),
      "a recovered database site was given the frontend rules");
    assert.ok(carriesCheck(sys), "a recovered database site's writer was not given the answer check");
    assert.match(userOf(w[0]), /bookings/, "the recovered table never reached the writer");
    assert.deepEqual(r.seen.patches, [], "this rung wrote the backend reference");
  } finally { c.uninstall(); }
});

// ── 2b. NONE, THEN A DATABASE — the control, and no stale "none" ────────────

test("a site with no database keeps the frontend rules, and its next message after it gains one gets the database rules", async () => {
  // TWO MESSAGES, ONE SLUG.
  //
  // FIRST, THE CONTROL: a site that genuinely has no database — no project row
  // — is still a frontend site. The fallback must not widen `none` into a
  // database, and it must not even query one.
  //
  // THEN THE SITE GAINS ONE, the way the addon's first touch makes one, and
  // the next page edit must be written as a database site. Nothing on this
  // path may carry the first message's "none" forward.
  //
  // ⚠ THIS CASE WAS WRITTEN FOR A CACHE THAT DOES NOT EXIST, and a sweep
  // survivor is what said so. It claimed `siteBackendBySlug` memoizes the
  // `null` it answered, so the second message would meet a stale `null` and
  // reach the four-state reader's `ready` arm. `makeCache` REFUSES to store a
  // `null` ("never cache absence"), so the fast reader re-asks and finds the
  // database itself — and cutting the `ready` arm survived every case here.
  // The arm was then removed as a second copy of `siteBackendDetail`'s own
  // rule; what this half asserts is the property that is really there.
  const slug = "rpcstate-none-then-ready";
  const store = bucket(slug);
  const c = installCompiler();
  try {
    const wire = {
      backends: [{ uid: USER.id, brief: "", neon_db: "" }],
      project: [],
      sql: database(),
      answers: ANSWERS,
    };
    const r = await withWire(wire, async (seen) => {
      const first = await edit(slug, store);
      const firstSql = seen.sql.length;
      const firstCalls = writerCalls(seen).length;
      // The site gets its database, the way the addon's first touch makes one.
      wire.backends = [{ uid: USER.id, brief: "", neon_db: "site_rpcstate_none_then_ready" }];
      wire.project = [{ uid: USER.id, neon_conn: PROJECT_CONN }];
      const second = await edit(slug, store);
      return { first, second, firstSql, firstCalls, seen };
    });

    assert.equal(r.first.body && r.first.body.ok, true, "the frontend edit did not publish: " + JSON.stringify(r.first.body));
    assert.equal(r.firstCalls, 1, "the frontend edit never reached the writer");
    assert.equal(r.firstSql, 0, "a site with no database was queried: " + JSON.stringify(r.seen.sql.slice(0, r.firstSql)));
    const w = writerCalls(r.seen);
    const sys0 = systemOf(w[0]);
    assert.ok(sys0.includes(FRONTEND_MARK), "a site with no database lost the frontend rules");
    assert.ok(!sys0.includes(HEADLINE), "a site with no database was given the state paragraph");
    assert.match(userOf(w[0]), /THIS SITE'S DATA\nThere is none/, "a site with no database was not told so");

    assert.equal(w.length, 2, "the second edit never reached the writer: " + JSON.stringify(r.second.body));
    assertDatabasePrompt(w[1], "a site that has since gained a database");
    assert.equal(r.second.body && r.second.body.ok, true, "the second edit did not publish: " + JSON.stringify(r.second.body));
    assert.deepEqual(r.seen.patches, [], "this rung wrote the backend reference");
  } finally { c.uninstall(); }
});

// ── 2c. CANNOT-TELL STOPS, FREE, AND BUYS NOTHING ───────────────────────────

test("a database that will not answer stops the rewrite, and starts nothing", async () => {
  // THE `unreadable` STATE, reached honestly: the project row exists, the
  // derived database is probed, and the probe fails. Rewriting the page as if
  // it had no database is the defect; escalating would buy the ~25-credit
  // rewrite of every page, which cannot make a database answer.
  const slug = "rpcstate-unreachable";
  const store = bucket(slug);
  const c = installCompiler();
  try {
    const wire = {
      backends: [{ uid: USER.id, brief: "", neon_db: "" }],
      project: [{ uid: USER.id, neon_conn: PROJECT_CONN }],
      sql: database({ down: true }),
      answers: ANSWERS,
    };
    const r = await withWire(wire, (seen) => edit(slug, store).then((x) => ({ ...x, seen })));
    assert.ok(r.seen.sql.length >= 1, "the database was never probed, so this case is about nothing");
    assert.equal(r.status, 503, "an unreachable database answered " + r.status + ": " + JSON.stringify(r.body));
    assert.equal(r.body.ok, false);
    assert.equal(r.body.cost, 0, "an unreachable database was charged for");
    assert.equal(r.body.ours, true, "this is our failure and the reply does not say so");
    assert.equal(r.body.error, "backend");
    // THE REASON NAMES THE LINK, and it is the resolution's — not the schema
    // read's, which is the next case and a different thing to go and fix.
    assert.equal(r.body.backend, "derived-database-unreachable", "the refusal does not name the probe: " + JSON.stringify(r.body));
    assert.notEqual(r.body.escalate, true, "an unreachable database escalated");
    assert.equal(writerCalls(r.seen).length, 0, "the page was rewritten anyway");
    assert.equal(c.calls.length, 0, "something was compiled for a message that stopped");
    // THE CUSTOMER'S SCREEN, composed by the browser's own selection.
    assert.equal(r.said.shown, true, "the browser printed NOTHING for this reply");
    assert.match(r.said.text, /database/i, "the screen does not say what could not be reached: " + JSON.stringify(r.said.text));
    assert.match(r.said.text, /Nothing on your site changed/, "the screen does not say the site is untouched: " + JSON.stringify(r.said.text));
    assert.deepEqual(paidActions(r.said), [], "the browser would buy something for this: " + JSON.stringify(r.said.actions));
  } finally { c.uninstall(); }
});

test("a schema that cannot be read stops the rewrite, and says which read failed", async () => {
  // THE DATABASE ANSWERS and the CATALOG does not: resolution succeeded and
  // the schema read failed. Before, a failed read left `eSpec` null and the
  // rung escalated `no-meta` — the ~25-credit rewrite of every page, which
  // cannot repair a schema this rung could not read.
  const slug = "rpcstate-catalog";
  const store = bucket(slug);
  const c = installCompiler();
  try {
    const wire = {
      backends: [{ uid: USER.id, brief: "", neon_db: "" }],
      project: [{ uid: USER.id, neon_conn: PROJECT_CONN }],
      sql: database({ catalogDown: true }),
      answers: ANSWERS,
    };
    const r = await withWire(wire, (seen) => edit(slug, store).then((x) => ({ ...x, seen })));
    assert.ok(r.seen.sql.some(asksCatalog), "the catalog was never asked, so this case is about nothing");
    assert.equal(r.status, 503, "an unreadable schema answered " + r.status + ": " + JSON.stringify(r.body));
    assert.equal(r.body.cost, 0, "an unreadable schema was charged for");
    assert.equal(r.body.ours, true);
    assert.equal(r.body.error, "backend");
    assert.match(String(r.body.backend), /catalog/, "the refusal does not name the read that failed: " + JSON.stringify(r.body));
    assert.notEqual(r.body.backend, "derived-database-unreachable",
      "the schema read's refusal wears the probe's reason, so the two walls are indistinguishable");
    assert.notEqual(r.body.escalate, true, "an unreadable schema escalated");
    assert.equal(writerCalls(r.seen).length, 0, "the page was rewritten anyway");
    assert.equal(r.said.shown, true, "the browser printed NOTHING for this reply");
    assert.match(r.said.text, /Nothing on your site changed/, "the screen does not say the site is untouched: " + JSON.stringify(r.said.text));
    assert.deepEqual(paidActions(r.said), [], "the browser would buy something for this: " + JSON.stringify(r.said.actions));
  } finally { c.uninstall(); }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. RUN 24'S STORED COMPONENT, AND A SUPPLIED IMPLEMENTATION OF THE CHECK
// ─────────────────────────────────────────────────────────────────────────────
//
// `fixtures/run24/day-space-lookup.after.tsx` is the component run 24's real
// writer stored, byte for byte out of the run's own evidence bundle
// (`after/source.json`). Rendered here with real React, it is a READING of
// what that generated code does — not a claim about what the real function
// sends: live, `bookings_on_day` answers a bare JSON integer.
//
// ⚠ THE CORRECTED COPY IS A SUPPLIED IMPLEMENTATION — hand-assembled below
// from the stored component and the rule's OWN example expression, never a
// model's answer. It shows the rule's booking-count check is sufficient for
// this component, and it proves nothing about whether a model will write it.
// The check is the booking count's, so `-1` and `1.5` are not answers HERE;
// for a function declared to return a price or a difference they would be.

const LOOKUP_RUN24 = readFileSync(new URL("./fixtures/run24/day-space-lookup.after.tsx", import.meta.url), "utf8");
const sha16 = (s) => createHash("sha256").update(String(s), "utf8").digest("hex").slice(0, 16);

/**
 * What the box says: its LAST paragraph, read off the markup. Not the last
 * sentence of the text — the label between the blurb and the answer carries no
 * full stop, so a sentence split glues "Preferred day" onto the answer.
 */
const boxSays = (src, query, day = "2026-10-01") => {
  const { html } = renderPart(src, { preferredDay: day, query, onPreferredDay() {} });
  const ps = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)].map((m) => m[1]);
  assert.ok(ps.length, "the component rendered no paragraph at all: " + html.slice(0, 160));
  return ps.at(-1).replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ").trim();
};
const answered = (data) => ({ isPending: false, isError: false, data });

test("run 24's stored component turns any answer into a count", () => {
  assert.equal(LOOKUP_RUN24.length, 1932, "the fixture is not the 1,932-character component run 24 stored");
  assert.equal(sha16(LOOKUP_RUN24), "4b162037f67df545", "the fixture has drifted from run 24's stored component");
  // THE OBSERVER IS ALIVE: a real count reads right, so the defect below is a
  // reading of the answer check and not of a renderer that says nothing.
  assert.equal(boxSays(LOOKUP_RUN24, answered(2)), "4 places left.");
  // THE OWNER'S SIX, reproduced: `Number(data)` after a null check makes a
  // count out of anything it can.
  for (const [data, want] of [
    [[], "Six places left."], [false, "Six places left."], ["", "Six places left."],
    ["   ", "Six places left."], [true, "5 places left."], [[2], "4 places left."],
  ]) {
    assert.equal(boxSays(LOOKUP_RUN24, answered(data)), want, "run 24's box on " + JSON.stringify(data));
  }
});

test("a SUPPLIED implementation of the rule's own booking-count check reads every count right and nothing else as one", () => {
  // THE CHECK IS READ OUT OF THE RULE, so an edit that breaks the example —
  // dropping `>= 0`, or `Number.isInteger` — breaks this case too.
  const m = fold(rule11(PAGE_RULES)).match(/a booking count is real only when `([^`]+)`/);
  assert.ok(m, "the rule's booking-count example is gone, so there is nothing to supply");
  const RUN24_CHECK = [
    '  if (data == null) return "Not available";',
    "  const booked = Number(data);",
    '  if (!Number.isFinite(booked)) return "Not available";',
  ].join("\n");
  assert.equal(LOOKUP_RUN24.split(RUN24_CHECK).length - 1, 1, "run 24's answer check is not where this case replaces it");
  const supplied = LOOKUP_RUN24.replace(RUN24_CHECK, () => '  if (!(' + m[1] + ')) return "Not available";\n  const booked = data;');
  assert.notEqual(supplied, LOOKUP_RUN24, "the supplied implementation changed nothing");

  // EVERY REAL COUNT READS RIGHT — zero included, the one a truthiness test loses.
  for (const [n, want] of [
    [0, "Six places left."], [1, "5 places left."], [2, "4 places left."], [5, "1 place left."],
    [6, "None left."], [7, "None left."], [99, "None left."],
  ]) {
    assert.equal(boxSays(supplied, answered(n)), want, "the supplied check on " + n);
  }
  // NOTHING THAT IS NOT A BOOKING COUNT BECOMES ONE: the owner's six, the
  // numeric string, the negative and the fraction a count cannot be, an object.
  for (const data of [[], false, "", "   ", true, [2], [0], "3", -1, 1.5, {}, null]) {
    assert.equal(boxSays(supplied, answered(data)), "Not available", "the supplied check read " + JSON.stringify(data) + " as a count");
  }
  // AND THE OTHER STATES ARE THE COMPONENT'S OWN, untouched.
  assert.equal(boxSays(supplied, { isPending: true, isError: false, data: undefined }), "Checking…");
  assert.equal(boxSays(supplied, { isPending: false, isError: true, data: undefined }), "Couldn't check — try again");
  assert.equal(boxSays(supplied, answered(0), ""), "Choose a day to check space.");
});
