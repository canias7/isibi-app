// THE FRAME'S SIGN-UP AND PARTS ON ONE PAGE (2026-10-25, frame-parallel).
// Live on driftwood-and-daughters-5 (main b12dba52c): "a newsletter sign-up in
// the footer" had no table the frame call was told of, and one long message's
// parts each ran a whole-page rewrite — an existing page answered unchanged
// was retried into a rewrite, and parts on one page were each a rewrite of it.
// Every model answer here is supplied; nothing is spent.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  frameTables, frameEditRequest, frameFileProblems, readFrameEdit, runFrameEdit, FRAME_EDIT_RULES,
} from "../builder/site-frame.mjs";
import { routeOnExisting } from "../builder/addon-existing.mjs";
import { planParts, newRequest, nextStep, jobBody, joinSamePage } from "../builder/request.mjs";
import { readHandOver } from "../builder/hand-over.mjs";

const SPEC = { tables: [
  { name: "newsletter_signups", access: "collect", columns: [{ name: "id", type: "uuid" }, { name: "email", type: "text", required: true }, { name: "created_at", type: "timestamptz" }] },
  { name: "menu_items", access: "display", columns: [{ name: "name", type: "text" }] },
  { name: "old_list", access: "collect", retired: true, columns: [{ name: "x", type: "text" }] },
] };
const HEADER = "import { Link } from \"@tanstack/react-router\";\nexport default function SiteHeader() { return <header><Link to=\"/\">Home</Link></header>; }\n";
const FOOTER = "export default function SiteFooter() { return <footer>Driftwood</footer>; }\n";
const PARTS = [{ name: "site-header", source: HEADER }, { name: "site-footer", source: FOOTER }];
const PAGES = [{ path: "src/routes/index.tsx", source: "export default function I() { return null; }" }];
const ROUTES = ["/", "/lessons", "/cafe"];
const reply = (input) => ({ content: [{ type: "tool_use", name: "edit_frame", input }], usage: { input_tokens: 10, output_tokens: 10 } });
const GOOD_FOOTER = "import { useState } from \"react\";\nimport { useCreateRow } from \"@/lib/rows\";\nexport default function SiteFooter() {\n  const add = useCreateRow(\"newsletter_signups\");\n  const [email, setEmail] = useState(\"\");\n  return <footer><a href=\"https://instagram.com/driftwood\">Instagram</a><form onSubmit={(e) => { e.preventDefault(); add.mutate({ email }); }}><input value={email} onChange={(e) => setEmail(e.target.value)} /><button>Sign up</button></form></footer>;\n}\n";

test("FP1 THE TABLES A VISITOR MAY WRITE — only write:anyone, not retired, managed columns left out; the request lists them and the rule says how to store", () => {
  const t = frameTables(SPEC);
  assert.deepEqual(t.map((x) => x.name), ["newsletter_signups"]);
  assert.deepEqual(t[0].columns.map((c) => c.name), ["email"]);
  assert.equal(t[0].columns[0].required, true);
  const req = frameEditRequest({ instruction: "a newsletter sign-up in the footer", frame: { header: PARTS[0], footer: PARTS[1] }, routes: ROUTES, tables: t });
  const body = req.messages[0].content;
  assert.match(body, /TABLES A FORM HERE MAY STORE INTO[^\n]*\n- newsletter_signups: email text \(required\)/);
  assert.match(FRAME_EDIT_RULES, /useCreateRow/);
  assert.match(FRAME_EDIT_RULES, /@\/lib\/rows/);
  const none = frameEditRequest({ instruction: "x", frame: { header: PARTS[0] }, routes: ROUTES, tables: [] }).messages[0].content;
  assert.match(none, /TABLES A FORM HERE MAY STORE INTO\nNone\./);
});

test("FP2 THE CHECK — a listed table stored into passes; an unlisted one, or a read hook, is refused by name; a hook the stored file already had is not judged again", () => {
  assert.deepEqual(frameFileProblems(GOOD_FOOTER, ROUTES, ["newsletter_signups"]), []);
  assert.deepEqual(frameFileProblems(GOOD_FOOTER, ROUTES, []), ["table:newsletter_signups"]);
  assert.deepEqual(frameFileProblems(GOOD_FOOTER.replace(/useCreateRow\(/, "useRows("), ROUTES, ["newsletter_signups"]), ["table:newsletter_signups"]);
  const frame = { header: { name: "site-header", source: HEADER }, footer: { name: "site-footer", source: GOOD_FOOTER } };
  const r = readFrameEdit(reply({ footer: GOOD_FOOTER.replace("Sign up", "Join") }), frame, ROUTES, []);
  assert.equal(r.ok, true, JSON.stringify(r));
});

test("FP3 THE LIVE REQUEST SUCCEEDS — a first answer importing a kit module and an unlisted table is retried with both reasons; the second, wired to the listed table, is the change", async () => {
  const sent = [];
  const bad = GOOD_FOOTER.replace("import { useState } from \"react\";", "import { useState } from \"react\";\nimport { Figure } from \"@/components/ui/figure\";").replace(/newsletter_signups/g, "subscribers");
  const answers = [reply({ footer: bad, header: HEADER.replace("Home</Link>", "Home</Link><Link to=\"/lessons\">Lessons</Link><Link to=\"/cafe\">Cafe</Link>") }), reply({ footer: GOOD_FOOTER, header: HEADER.replace("Home</Link>", "Home</Link><Link to=\"/lessons\">Lessons</Link><Link to=\"/cafe\">Cafe</Link>") })];
  const out = await runFrameEdit({ send: async (r) => { sent.push(r); return answers.shift(); } }, {
    instruction: "Put Instagram and Facebook links and a newsletter sign-up in the footer, and a header menu linking every page.",
    pages: PAGES, parts: PARTS, routes: ROUTES, tables: frameTables(SPEC),
  });
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.deepEqual(out.changed.sort(), ["footer", "header"]);
  assert.equal(sent.length, 2);
  const why = JSON.stringify(sent[1].messages);
  assert.match(why, /@\/components\/ui\/figure/);
  assert.match(why, /subscribers/);
  assert.match(out.parts.find((p) => p.name === "site-footer").source, /useCreateRow\("newsletter_signups"\)/);
  // a first answer already wired to the listed table is taken at once
  let calls = 0;
  const once = await runFrameEdit({ send: async () => { calls++; return reply({ footer: GOOD_FOOTER }); } }, {
    instruction: "a newsletter sign-up in the footer", pages: PAGES, parts: PARTS, routes: ROUTES, tables: frameTables(SPEC),
  });
  assert.equal(once.ok, true, JSON.stringify(once));
  assert.equal(calls, 1);
});

test("FP4 THE WORKER HANDS THE FRAME ITS TABLES — the written-frame call passes `tables` read from the site's own schema", () => {
  const src = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const a = src.indexOf("const fOut = await runFrameEdit(");
  assert.ok(a > 0);
  const call = src.slice(a, src.indexOf("});", a));
  assert.match(call, /tables: await frameTablesOf\(env, ownerSlug\)/);
  assert.match(src, /async function frameTablesOf\(env, slug\)[\s\S]{0,600}frameTables\(r\.spec\)/);
});

test("FP5 AN ADD-ON ABOUT WHAT EXISTS SAYS SO — routeOnExisting's page-step answer carries the `existing` hand-over, which survives the strict reader, and the route echoes it for an edit", () => {
  const routed = { intent: "addon", layer: "none", targets: [{ change: 0, writes: ["page:/cafe", "data:menu_items"], reads: [] }], decision: { reasons: [] } };
  const out = routeOnExisting(routed, { pages: ["/", "/cafe"], tables: ["menu_items"] }, { reason: "addon-existing" });
  assert.equal(out.intent, "edit");
  assert.equal(out.layer, "page");
  assert.deepEqual(readHandOver(out.handOver), { from: "route", reason: "existing", page: "/cafe" });
  const src = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.equal((src.match(/routed\.intent === "edit" && routed\.handOver\.reason === "existing"/g) || []).length, 2);
});

test("FP6 AN UNCHANGED PAGE FOR SUCH A PART IS THE ANSWER — the no-change retry is skipped and the reply is `satisfied` at no cost", () => {
  const src = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(src, /const eExisting = !!\(eExistingHand && eExistingHand\.reason === "existing"\);/);
  assert.match(src, /const pWhy = pWhy0 === "no-change" && eExisting \? null : pWhy0;/);
  const a = src.indexOf("if (eExisting) {");
  assert.ok(a > 0);
  const blk = src.slice(a, a + 400);
  assert.match(blk, /satisfied: true/);
  assert.match(blk, /cost: 0/);
});

// ── parts on one page ──
const W = ["add a booking form to the Lessons page", "show the group sizes on the Lessons page", "add the Saturday surf club to the Cafe page"];
function rec3(pages) {
  const message = W.join(". ") + ".";
  const r0 = { intent: "edit", layer: "page", page: pages[0] };
  const planned = planParts(message, { ...r0, alsoAsked: W.slice(1) });
  assert.equal(planned.ok, true, JSON.stringify(planned));
  const rec = newRequest({ key: "rqframepar00000001", uid: "u1", slug: "driftwood", message, picker: "grok", accepted: r0, parts: planned.parts });
  rec.parts.forEach((p, n) => { p.phase = "run"; p.route = { op: "edit", intent: "edit", layer: "page", page: pages[n], remove: false, rename: "", tab: false, handOver: null, cost: 1, handedOff: false, fromAddon: false }; p.targets = { writes: ["page:" + pages[n]], reads: [] }; p.status = "ready"; delete p.prep; });
  return rec;
}

test("FP7 TWO PARTS ON ONE PAGE ARE ONE EDIT — the second rides in the first's job (its words in what it runs, no longer held back), the part on another page is untouched", () => {
  const r = nextStep(rec3(["/lessons", "/lessons", "/cafe"]), {}, 1, { writeMax: 4 });
  const [p0, p1, p2] = r.record.parts;
  assert.equal(p1.joinedTo, 0);
  assert.equal(p1.status, "blocked");
  assert.deepEqual(p0.joined, [1]);
  assert.ok(!p0.held.includes(W[1]), "no longer held back");
  assert.ok(r.files.every((f) => f.n !== 1), "no job of its own");
  assert.ok(r.files.some((f) => f.n === 2), "the other page still runs beside it");
  const body = jobBody(r.record, 0, "run", r.files[0].key).body;
  assert.ok(body.instruction.includes(W[0]) && body.instruction.includes(W[1]));
  const held = [].concat(body.alsoAsked || []);
  assert.ok(!held.includes(W[1]));
  assert.equal(p2.joinedTo, undefined);
});

test("FP8 THE RIDER ENDS AS ITS JOB'S PART ENDS — done copied with `with`, never run again; a part that held something back is never taken in", () => {
  const r = nextStep(rec3(["/lessons", "/lessons", "/cafe"]), {}, 1, { writeMax: 4 });
  const rec = r.record;
  rec.parts[0].jobs.forEach((j) => { j.end = { act: "done" }; });
  rec.parts[0].status = "done"; rec.parts[0].outcome = { job: "j0", kind: "edit" };
  const r2 = nextStep(rec, {}, 2, { writeMax: 4 });
  const p1 = r2.record.parts[1];
  assert.equal(p1.status, "done");
  assert.equal(p1.outcome.with, 0);
  assert.equal(p1.jobs.length, 0);
  // control: a part with its own held words is not joinable
  const rc = rec3(["/lessons", "/lessons", "/cafe"]);
  rc.parts[1].held = ["something"];
  assert.deepEqual(joinSamePage(rc, rc.parts[0]), []);
  // control: different layers on one page are not joined
  const rl = rec3(["/lessons", "/lessons", "/cafe"]);
  rl.parts[1].route.layer = "text";
  assert.deepEqual(joinSamePage(rl, rl.parts[0]), []);
});
