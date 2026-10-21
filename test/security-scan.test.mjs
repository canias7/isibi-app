// THE DEEP SECURITY SCAN (2026-10-21, phase B): hunt by area, challenge every
// candidate with a fresh call, keep only what survives. Driven with supplied
// model answers in the shape the real call returns.
import test from "node:test";
import assert from "node:assert/strict";
import { deepScan, readCandidates, readVerdict, areaCode, SCAN_AREAS, MAX_CANDIDATES, planScan, combineVerdicts } from "../builder/security-scan.mjs";

const files = [
  { path: "src/routes/index.tsx", text: "export default function Home(){ return <div dangerouslySetInnerHTML={{__html: review.body}} /> }" },
  { path: "src/routes/admin.tsx", text: "export default function Admin(){ /* no login check */ return <Orders/> }" },
];
const use = { input_tokens: 1000, output_tokens: 200 };
const hunt = (cands) => ({ content: [{ type: "tool_use", name: "report_candidates", input: { candidates: cands } }], usage: use });
const verdict = (v, fix = "") => ({ content: [{ type: "tool_use", name: "verdict", input: { verdict: v, reason: "because", fix } }], usage: use });
const C = (title, where, severity = "high") => ({ title, where, evidence: "x", impact: "a stranger could do it", severity });

test("a candidate the checker confirms is kept with its fix; one it cannot settle is unsure; one it rejects is dropped", async () => {
  const sent = [];
  const send = async (req) => {
    sent.push(req);
    if (req.tools[0].name === "report_candidates") {
      return /THE AREA: its pages/.test(req.messages[0].content)
        ? hunt([C("Reviews are put into the page as raw HTML", "src/routes/index.tsx"), C("Admin page has no login", "src/routes/admin.tsx", "medium")])
        : hunt([C("Admin page has no login", "src/routes/admin.tsx", "medium"), C("Made up", "nowhere.tsx", "low")]);
    }
    const claim = req.messages[0].content.split("\n")[0];
    return /raw HTML/.test(claim) ? verdict("confirmed", "Show reviews as plain text.") : /Admin/.test(claim) ? verdict("needs_checking") : verdict("rejected");
  };
  const r = await deepScan({ send }, { model: "grok-4.6", files, facts: "reviews: read public / write anyone" });
  assert.deepEqual(r.confirmed.map((f) => [f.title, f.severity, f.fix]), [["Reviews are put into the page as raw HTML", "high", "Show reviews as plain text."]]);
  assert.deepEqual(r.unsure.map((f) => f.title), ["Admin page has no login"]);
  const verifies = sent.filter((q) => q.tools[0].name === "verdict");
  assert.equal(verifies.length, 3, "the same problem found twice is challenged twice, or one is never challenged");
  assert.ok(verifies.every((q) => !/report_candidates/.test(JSON.stringify(q.messages))), "the checker saw the hunt");
  assert.ok(sent.every((q) => q.model === "grok-4.6"), "not the picker's model");
  assert.equal(r.usage.length, sent.length, "a call's usage is not handed back for the charge");
});

test("an unreadable verdict is never confirmed; a hunt answer missing evidence is not a candidate", () => {
  assert.equal(readVerdict({ content: [{ type: "text", text: "looks bad" }] }).verdict, "needs_checking");
  assert.equal(readVerdict(verdict("confirmed", "do x")).fix, "do x");
  assert.equal(readVerdict(verdict("rejected", "do x")).fix, "", "a rejected one carries a fix");
  assert.deepEqual(readCandidates(hunt([{ title: "t", where: "w", impact: "i", severity: "high" }])), []);
  assert.deepEqual(readCandidates(hunt([{ ...C("t", "w"), severity: "critical" }])), [], "a severity off the list is passed on");
});

test("a failed call costs no finding and no crash; the challenge is bounded", async () => {
  const many = Array.from({ length: 30 }, (_, i) => C("problem " + i, "f" + i));
  let verifies = 0;
  const r = await deepScan({ send: async (req) => { if (req.tools[0].name === "report_candidates") { if (/its pages/.test(req.messages[0].content)) return hunt(many); throw new Error("down"); } verifies++; return verdict("rejected"); } }, { model: "m", files });
  assert.equal(verifies, planScan({ files }).maxCandidates, "the challenge is not bounded by the plan");
  assert.ok(planScan({ files }).maxCandidates <= MAX_CANDIDATES);
  assert.deepEqual(r.confirmed, []);
});

test("each area reads only its own files, whole, within its limit", () => {
  const pages = SCAN_AREAS.find((a) => a.key === "pages");
  const access = SCAN_AREAS.find((a) => a.key === "access");
  assert.match(areaCode(pages, files), /=== src\/routes\/index\.tsx ===/);
  assert.match(areaCode(access, files), /admin\.tsx/);
  assert.doesNotMatch(areaCode(access, files), /index\.tsx/);
  assert.equal(areaCode(pages, [{ path: "big.tsx", text: "x".repeat(70_000) }]), "", "a file past the limit is cut instead of skipped");
});

test("SIZED TO THE SITE: a page-only site gets the pages; logins and payments add their areas with two checkers; thorough is three checkers and two rounds", () => {
  const brochure = planScan({ files: [{ path: "src/routes/index.tsx", text: "x" }] });
  assert.deepEqual(brochure.areas.map((a) => [a.key, a.checkers]), [["pages", 1]]);
  const crm = planScan({ files: [{ path: "src/routes/index.tsx", text: "x" }], tables: [{ name: "clients", access: "user" }, { name: "invoices", access: "admin", paid: true }] });
  assert.deepEqual(crm.areas.map((a) => [a.key, a.checkers]), [["pages", 1], ["access", 2], ["money", 2]]);
  const deep = planScan({ files: [{ path: "src/routes/index.tsx", text: "x" }], tables: [{ name: "clients", access: "user" }], thorough: true });
  assert.ok(deep.areas.every((a) => a.checkers === 3));
  assert.equal(deep.rounds, 2);
  assert.ok(deep.calls.length > crm.calls.length && crm.calls.length > brochure.calls.length, "the estimate does not grow with the plan");
});

test("several checkers: a majority confirms or rejects; anything short of a majority needs checking", () => {
  const v = (verdict, fix = "") => ({ verdict, reason: verdict, fix });
  assert.equal(combineVerdicts([v("confirmed", "f"), v("confirmed"), v("rejected")]).verdict, "confirmed");
  assert.equal(combineVerdicts([v("confirmed", "f"), v("confirmed"), v("rejected")]).fix, "f");
  assert.equal(combineVerdicts([v("confirmed"), v("rejected")]).verdict, "needs_checking", "a tie is decided");
  assert.equal(combineVerdicts([v("rejected"), v("rejected"), v("needs_checking")]).verdict, "rejected");
  assert.equal(combineVerdicts([]).verdict, "needs_checking");
});

test("a risky area's problem is put to two fresh checkers, and a thorough scan hunts twice, the second told what the first found", async () => {
  const sent = [];
  const send = async (req) => {
    sent.push(req);
    if (req.tools[0].name === "report_candidates") return hunt(/its logins/.test(req.messages[0].content) ? [C("Anyone can read clients", "clients")] : []);
    return verdict("confirmed", "Lock clients.");
  };
  const tables = [{ name: "clients", access: "user" }];
  const r = await deepScan({ send }, { model: "m", files, tables, facts: "clients: user" });
  assert.equal(sent.filter((q) => q.tools[0].name === "verdict").length, 2, "a risky area's problem had one checker");
  assert.equal(r.confirmed.length, 1);
  sent.length = 0;
  await deepScan({ send }, { model: "m", files, tables, facts: "clients: user", thorough: true });
  const hunts = sent.filter((q) => q.tools[0].name === "report_candidates");
  assert.ok(hunts.some((q) => /ALREADY FOUND[^]*Anyone can read clients/.test(q.messages[0].content)), "the second round is not told what the first found");
});
