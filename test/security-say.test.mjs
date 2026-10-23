// THE SECURITY SCAN, SAID BY THE MODEL (2026-10-23). The offer — what the
// scan will check and its price — the working line and the report are written
// by the reply writer from facts; these are the facts, and the route's wiring.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { securityOfferFacts, securityWorkingFacts, securityReportFacts } from "../builder/security-say.mjs";
import { planScan } from "../builder/security-scan.mjs";
import { writeReply, REPLY_TOOL } from "../builder/site-reply.mjs";

const files = [
  { path: "login.tsx", text: "export function Login(){ const u = useAuth(); return <form onSubmit={signIn}>password</form> }" },
  { path: "index.tsx", text: "fetch('/api/data/orders')" },
];
const tables = [{ name: "orders", access: "own", columns: ["item"] }];

test("the offer's facts carry the planned areas, their reviewers and the price, and say nothing ran", () => {
  const plan = planScan({ files, tables });
  assert.ok(plan.areas.length > 0, "the plan sized nothing — this case tests nothing");
  const f = securityOfferFacts({ plan, credits: 7 });
  const text = f.map((x) => x.text).join("\n");
  for (const a of plan.areas) assert.ok(text.includes(a.title), "area missing: " + a.title);
  assert.match(text, /reviewer/);
  assert.match(text, /about 7 credits/);
  assert.match(text, /Nothing has been checked or charged yet/);
  assert.match(text, /until they confirm/);
  // EVERY FACT HAS ITS OWN ID, the writer's covers contract.
  assert.equal(new Set(f.map((x) => x.id)).size, f.length);
  // A BIGGER SITE MEANS MORE REVIEWERS: the planner's size logic, not a fixed sentence.
  const thr = securityOfferFacts({ plan: planScan({ files, tables, thorough: true }), credits: 20 }).map((x) => x.text).join("\n");
  assert.match(thr, /3 reviewers/);
});

test("the report's facts are what the scan found, and its cost", () => {
  const t = securityReportFacts({ findings: [{ title: "Orders readable by anyone", severity: "high" }], unsure: [{}, {}], cost: 5 }).map((x) => x.text).join("\n");
  assert.match(t, /found 1 thing/);
  assert.match(t, /high: Orders readable by anyone/);
  assert.match(t, /2 more could not be settled/);
  assert.match(t, /used 5 credits/);
  assert.match(securityReportFacts(null).map((x) => x.text).join(" "), /could not run/);
  assert.match(securityWorkingFacts({ plan: planScan({ files, tables }) })[0].text, /running now/);
});

test("the reply writer turns the offer's facts into the model's own words (stubbed model)", async () => {
  const plan = planScan({ files, tables });
  const facts = securityOfferFacts({ plan, credits: 7 });
  let asked = null;
  const out = await writeReply({ send: async (req) => { asked = req; return { content: [{ type: "tool_use", name: REPLY_TOOL.name, input: { reply: "[stub] I'll check sign-in and your data rules, about 7 credits — press the button to start.", covers: facts.map((x) => x.id) } }], usage: {} }; } }, { facts, model: "m" });
  assert.equal(out.ok, true);
  assert.match(JSON.stringify(asked), /about 7 credits/, "the price did not reach the model");
});

test("the route asks for the model's words on the price read and the report, never for a fixed sentence", () => {
  const w = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const a = w.indexOf("const scanSay = async"), b = w.indexOf("} else if (sq) {", a);
  assert.ok(a > 0 && b > a, "the security route's landmarks");
  const body = w.slice(a, b);
  assert.match(body, /if \(!repliesOn\(env\)\) return null;/);
  assert.match(body, /url\.searchParams\.get\("say"\) === "1"/);
  assert.match(body, /scanSay\(securityOfferFacts\(\{ plan: std, credits: stdCredits \}\)/);
  assert.match(body, /scanSay\(securityWorkingFacts\(\{ plan: std \}\)/);
  assert.match(body, /scbody\.say === true && report\.kind === "deep"/);
  assert.match(body, /scanSay\(securityReportFacts\(report\)/);
});

// ── THE RUNNING SCAN'S PROGRESS TALK (2026-10-23) ───────────────────────────
import { deepScan } from "../builder/security-scan.mjs";
import { securityProgressFacts } from "../builder/security-say.mjs";

test("deepScan reports each step as facts: the areas, each area done, the challenge, each verdict", async () => {
  const events = [];
  const send = async (req) => {
    const t = JSON.stringify(req);
    const name = req.tool_choice && req.tool_choice.name;
    const tool = (req.tools || []).find((x) => x.name === name) || {};
    const props = Object.keys((tool.input_schema && tool.input_schema.properties) || {});
    const input = props.includes("verdict") ? { verdict: "confirmed", reason: "r", fix: "f" }
      : { [props[0] || "candidates"]: [{ title: "Orders readable by anyone", severity: "high", where: "index.tsx", impact: "x" }] };
    return { content: [{ type: "tool_use", name, input }], usage: {}, _t: t };
  };
  await deepScan({ send }, { model: "m", files, tables, say: (k, d) => events.push([k, d]) });
  const kinds = events.map((e) => e[0]);
  assert.equal(kinds[0], "hunt");
  assert.ok(kinds.includes("area"), "no area finished: " + kinds.join(","));
  assert.ok(kinds.includes("challenge"));
  for (const [k, d] of events) {
    const f = securityProgressFacts(k, d);
    assert.ok(Array.isArray(f) && f.length === 1 && f[0].id, "no fact for " + k);
    assert.doesNotMatch(f[0].text, /cloudflare/i);
  }
  assert.equal(securityProgressFacts("other", {}), null);
});

test("the route keeps each step under the scan's key and words it once through the writer; the page polls it while the scan runs", () => {
  const w = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(w, /const facts = securityProgressFacts\(ev\.kind, ev\.data\);\n\s+ev\.line = facts \? \(await scanSay\(facts,/);
  assert.match(w, /deepScan\(\{ send: quickSend\(env, "security"\) \}, \{ model, files: sfiles, facts, tables, thorough, plan, \.\.\.\(progSay \? \{ say: progSay \} : \{\}\) \}\);/);
  const c = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  assert.match(c, /'\/security\?progress=' \+ encodeURIComponent\(scanKey\)/);
  assert.match(c, /await siteSecurityDeep\(s, \{ say: true, message: m\.sentinel\.message, key: scanKey \}\);\n\s+polling = false;/);
  // NO CLOUDFLARE IN ANYTHING THE CUSTOMER READS OR THE WRITER IS GIVEN.
  assert.doesNotMatch(readFileSync(new URL("../builder/security-say.mjs", import.meta.url), "utf8"), /cloudflare/i);
  assert.doesNotMatch(c.slice(c.indexOf("// ── SLASH COMMANDS BEGIN"), c.indexOf("// ── SLASH COMMANDS END ──")), /cloudflare/i);
});
