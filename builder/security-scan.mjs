// THE DEEP SECURITY SCAN (2026-10-21, phase B of
// docs/plans/2026-10-21-site-security-scan.md; owner: "Finish it up").
//
// The method is Cloudflare's security-audit skill (github.com/cloudflare/
// security-audit-skill, MIT), run our way on a site the builder made:
//
//   1. HUNT — the site's code goes to the model one area at a time (its pages,
//      its logins and data rules, its server code, its payments and outside
//      connections), each with the questions for that area. What comes back is
//      CANDIDATES, never findings.
//   2. CHALLENGE — every candidate goes to a FRESH call that never saw the hunt,
//      told to prove it is not real. The checker is never the finder: that is
//      the skill's central rule. What survives is confirmed; what cannot be
//      settled stays "needs checking"; the rest is dropped.
//
// The site's code is only READ, never run. Pure: `deps.send` is the model call
// (the picker's model, chosen by the caller), and every call's usage is handed
// back so the caller charges every token.

/** The areas a site has, each with what to look for there. */
export const SCAN_AREAS = [
  {
    key: "pages", title: "its pages",
    pick: (f) => /\.(tsx|jsx|html|m?js)$/i.test(f.path) && !/worker|server/i.test(f.path),
    ask: "Look at what runs in the visitor's browser: content from visitors or the database put into the page as raw HTML; links or redirects built from the address bar; secrets or private data shipped in the page; forms that trust a price, role or owner sent from the browser; pages meant for signed-in people or the owner that show their content to anyone.",
  },
  {
    key: "access", title: "its logins and data rules",
    pick: (f) => /schema|rules|access|auth|login|account|member|admin/i.test(f.path),
    ask: "Look at who may read and change what: lists of people's details readable by everyone; anyone able to write into what everyone sees; an owner or admin action reachable without checking who is asking; one signed-in person able to read or change another's rows; a role or owner field a visitor can set themselves.",
  },
  {
    key: "server", title: "its server code",
    pick: (f) => /worker|server|api|functions?\//i.test(f.path),
    ask: "Look at the site's own server code: requests to any address a visitor supplies; database queries built by gluing in visitor text; secrets returned in an answer; actions with no check on who is asking; webhooks accepted without verifying who sent them; limits missing on anything that costs money or sends mail.",
  },
  {
    key: "money", title: "its payments and outside connections",
    pick: (f) => /pay|checkout|stripe|order|cart|mail|email|webhook|book/i.test(f.path),
    ask: "Look at payments and connections to other services: a price, amount or currency taken from the visitor's browser; an order marked paid without the payment provider confirming it; a booking or order that can be changed by someone who did not make it; mail that can be sent to any address a visitor types.",
  },
];

/** How much code one hunt is given, and how many candidates are challenged. */
export const AREA_MAX_CHARS = 60_000;
export const MAX_CANDIDATES = 10;
const MAX_TOKENS = 4000;

const HUNT_TOOL = {
  name: "report_candidates",
  description: "Report the possible security problems found in this area of the site, or none.",
  input_schema: {
    type: "object",
    properties: {
      candidates: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string", description: "One plain sentence a business owner understands, naming the problem." },
            where: { type: "string", description: "The file, and the function or table, where it is." },
            evidence: { type: "string", description: "The exact code that shows it, quoted, at most a few lines." },
            impact: { type: "string", description: "What a stranger could actually do because of it, in plain words." },
            severity: { type: "string", enum: ["high", "medium", "low"] },
          },
          required: ["title", "where", "evidence", "impact", "severity"],
        },
      },
    },
    required: ["candidates"],
  },
};

const VERDICT_TOOL = {
  name: "verdict",
  description: "Your verdict on the one claimed problem.",
  input_schema: {
    type: "object",
    properties: {
      verdict: { type: "string", enum: ["confirmed", "needs_checking", "rejected"] },
      reason: { type: "string", description: "Why, in one or two plain sentences, naming what in the code settles it." },
      fix: { type: "string", description: "Only when confirmed: what to change, in one sentence a business owner could ask the builder for." },
    },
    required: ["verdict", "reason"],
  },
};

const HUNT_SYSTEM =
  "You are auditing the security of a small business's website, built by an AI site builder. You are given the code for one area of the site and what to look for there. " +
  "Report only problems a stranger could actually exploit, each with the exact code that shows it. A missing extra layer, where another layer already stops the attack, is not a problem. " +
  "Do not report style, performance or best-practice notes. If you find nothing real, report no candidates. Never invent code that is not shown.";

const VERIFY_SYSTEM =
  "You are checking one claimed security problem in a small business's website. Someone else found it; your job is to try to prove it is NOT real. " +
  "Read the code given. Answer rejected when the code shows it cannot happen (another check stops it, the value is not from a visitor, the data is meant to be public), " +
  "confirmed only when the code shows, step by step, how a stranger does it, and needs_checking when the code shown cannot settle it. Severity follows real impact, not a checklist.";

/**
 * THE SCAN SIZED TO THE SITE (2026-10-21, owner: "Ok go" to "the site decides
 * the size"). What the site has decides which areas are looked at and how hard
 * each problem is checked, so nothing it has is ever skipped and a simple site
 * stays cheap. `thorough` turns everything up. No model: the plan is free and
 * is what the price shown before the scan is estimated from.
 *
 * Answers `{ areas: [{ key, title, checkers, chars }], maxCandidates, rounds,
 * calls: [{ in, out }] }` — `calls` is the estimated token use of every call
 * the plan will make, for the estimate.
 */
export function planScan({ files = [], tables = [], thorough = false } = {}) {
  const list = Array.isArray(tables) ? tables : [];
  const label = (t) => String(t && t.access || "").toLowerCase();
  const hasData = list.length > 0;
  const hasLogins = list.some((t) => /own|members|user|feed|admin/.test(label(t)));
  const hasPayments = list.some((t) => t && t.paid === true);
  const risky = { access: hasLogins, money: hasPayments };
  const areas = [];
  for (const a of SCAN_AREAS) {
    const code = areaCode(a, files);
    // AN AREA IS LOOKED AT WHEN THE SITE HAS IT: its own files, or (for data
    // rules and money) the tables that say it exists.
    const has = code || (a.key === "access" && hasData) || (a.key === "money" && hasPayments);
    if (!has) continue;
    areas.push({ key: a.key, title: a.title, checkers: thorough ? 3 : (risky[a.key] ? 2 : 1), chars: code.length });
  }
  const maxCandidates = thorough ? 20 : Math.min(MAX_CANDIDATES, 3 + 2 * areas.length);
  const rounds = thorough ? 2 : 1;
  // THE ESTIMATE: every hunt reads its area's code; about two problems an area
  // are challenged, each by its area's checkers, each reading the same code.
  const tok = (chars) => Math.ceil(chars / 4);
  const calls = [];
  for (let r = 0; r < rounds; r++) {
    for (const a of areas) {
      calls.push({ in: tok(a.chars) + 900, out: 1200 });
      const expected = Math.min(2, maxCandidates);
      for (let i = 0; i < expected * a.checkers; i++) calls.push({ in: tok(a.chars) + 700, out: 300 });
    }
  }
  return { areas, maxCandidates, rounds, calls };
}

/** Several checkers' verdicts, as one: a majority decides; a tie, or no majority, needs checking. */
export function combineVerdicts(vs) {
  const list = Array.isArray(vs) && vs.length ? vs : [{ verdict: "needs_checking", reason: "", fix: "" }];
  const n = (k) => list.filter((v) => v.verdict === k).length;
  const half = list.length / 2;
  const pick = n("confirmed") > half ? "confirmed" : n("rejected") > half ? "rejected" : "needs_checking";
  const by = list.find((v) => v.verdict === pick) || list[0];
  return { verdict: pick, reason: by.reason || "", fix: pick === "confirmed" ? (list.find((v) => v.verdict === "confirmed" && v.fix) || {}).fix || "" : "" };
}

/** One area's code: the files it picks, whole, up to the area's limit. */
export function areaCode(area, files) {
  let used = 0;
  const out = [];
  for (const f of (Array.isArray(files) ? files : [])) {
    if (!f || typeof f.path !== "string" || typeof f.text !== "string" || !area.pick(f)) continue;
    if (used + f.text.length > AREA_MAX_CHARS) continue;
    out.push("=== " + f.path + " ===\n" + f.text);
    used += f.text.length;
  }
  return out.join("\n\n");
}

export function huntRequest({ model, area, code, facts }) {
  return {
    model, max_tokens: MAX_TOKENS,
    system: [{ type: "text", text: HUNT_SYSTEM }],
    tools: [HUNT_TOOL], tool_choice: { type: "tool", name: HUNT_TOOL.name },
    messages: [{ role: "user", content:
      "THE AREA: " + area.title + "\nWHAT TO LOOK FOR: " + area.ask +
      (facts ? "\n\nWHAT THE PLATFORM ALREADY KNOWS ABOUT THIS SITE (its lists and who may read or write them):\n" + facts : "") +
      "\n\nTHE CODE:\n" + code }],
  };
}

export function verifyRequest({ model, candidate, code, facts }) {
  return {
    model, max_tokens: 1500,
    system: [{ type: "text", text: VERIFY_SYSTEM }],
    tools: [VERDICT_TOOL], tool_choice: { type: "tool", name: VERDICT_TOOL.name },
    messages: [{ role: "user", content:
      "THE CLAIM: " + candidate.title + "\nWHERE: " + candidate.where + "\nTHE CODE QUOTED AS EVIDENCE:\n" + candidate.evidence +
      "\nTHE CLAIMED IMPACT: " + candidate.impact +
      (facts ? "\n\nTHE SITE'S LISTS AND WHO MAY READ OR WRITE THEM:\n" + facts : "") +
      "\n\nTHE CODE TO CHECK IT AGAINST:\n" + code }],
  };
}

/** The tool's input from a reply, or null. */
function toolInput(reply, name) {
  const blocks = reply && Array.isArray(reply.content) ? reply.content : [];
  const b = blocks.find((x) => x && x.type === "tool_use" && x.name === name && x.input && typeof x.input === "object");
  return b ? b.input : null;
}
const str = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const SEV = ["high", "medium", "low"];

/** A hunt's candidates, read strictly: every field a string, a known severity, evidence quoted. */
export function readCandidates(reply) {
  const inp = toolInput(reply, HUNT_TOOL.name);
  const list = inp && Array.isArray(inp.candidates) ? inp.candidates : [];
  return list.map((c) => ({
    title: str(c && c.title, 200), where: str(c && c.where, 200), evidence: str(c && c.evidence, 1500),
    impact: str(c && c.impact, 400), severity: SEV.includes(c && c.severity) ? c.severity : "",
  })).filter((c) => c.title && c.where && c.evidence && c.impact && c.severity);
}

/** A challenge's verdict, read strictly; anything unreadable is "needs checking", never confirmed. */
export function readVerdict(reply) {
  const inp = toolInput(reply, VERDICT_TOOL.name);
  const v = inp && ["confirmed", "needs_checking", "rejected"].includes(inp.verdict) ? inp.verdict : "needs_checking";
  return { verdict: v, reason: str(inp && inp.reason, 400), fix: v === "confirmed" ? str(inp && inp.fix, 300) : "" };
}

/**
 * The scan. `files`: [{ path, text }] of the site's code; `facts`: a short text
 * of its lists and rules. Answers `{ confirmed, unsure, usage, areas }`: each
 * confirmed problem carries `severity`, `title`, `why`, `fix`, `where`; `unsure`
 * carries `title`, `why`, `where`; `usage` is every call's usage, for the
 * charge; `areas` names what was looked at.
 */
export async function deepScan(deps, { model, files = [], facts = "", tables = [], thorough = false, plan = null, say = () => {} } = {}) {
  const usage = [];
  const p = plan || planScan({ files, tables, thorough });
  const areas = p.areas.map((pa) => {
    const a = SCAN_AREAS.find((x) => x.key === pa.key);
    // AN AREA THE SITE HAS ONLY AS TABLES is looked at through its facts.
    return { a, checkers: pa.checkers, code: areaCode(a, files) || "(no code for this area; judge from the lists and their rules above)" };
  });
  say("hunt", { areas: areas.map((x) => x.a.title) });
  const all = [];
  const seen = new Set();
  for (let round = 0; round < p.rounds; round++) {
    const missedNote = round > 0 && all.length ? "\n\nALREADY FOUND (do not report these again; look for what was missed): " + all.map((c) => c.title).join("; ") : "";
    const hunts = await Promise.all(areas.map(async ({ a, code, checkers }) => {
      try {
        const reply = await deps.send(huntRequest({ model, area: a, code, facts: facts + missedNote }));
        if (reply && reply.usage) usage.push(reply.usage);
        return readCandidates(reply).map((c) => ({ ...c, code, checkers }));
      } catch { return []; }
    }));
    // THE SAME PROBLEM FOUND TWICE IS CHALLENGED ONCE.
    for (const c of hunts.flat()) { const k = (c.where + "|" + c.title).toLowerCase(); if (!seen.has(k)) { seen.add(k); all.push(c); } }
  }
  const candidates = all.sort((x, y) => SEV.indexOf(x.severity) - SEV.indexOf(y.severity)).slice(0, p.maxCandidates);
  say("challenge", { candidates: candidates.length });
  const verdicts = await Promise.all(candidates.map(async (c) => {
    // EACH CHECKER IS ITS OWN FRESH CALL; a majority decides.
    const vs = await Promise.all(Array.from({ length: c.checkers || 1 }, async () => {
      try {
        const reply = await deps.send(verifyRequest({ model, candidate: c, code: c.code, facts }));
        if (reply && reply.usage) usage.push(reply.usage);
        return readVerdict(reply);
      } catch { return { verdict: "needs_checking", reason: "", fix: "" }; }
    }));
    return combineVerdicts(vs);
  }));
  const confirmed = [], unsure = [];
  candidates.forEach((c, i) => {
    const v = verdicts[i];
    if (v.verdict === "confirmed") confirmed.push({ id: "deep:" + (c.where + "|" + c.title).toLowerCase().slice(0, 120), severity: c.severity, title: c.title, why: c.impact, fix: v.fix || "Ask the builder to fix: " + c.title, where: c.where });
    else if (v.verdict === "needs_checking") unsure.push({ title: c.title, why: v.reason || c.impact, where: c.where });
  });
  return { confirmed, unsure, usage, areas: areas.map((x) => x.a.title) };
}
