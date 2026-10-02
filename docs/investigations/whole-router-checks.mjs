// The whole-router audit's free checks (2026-10-02), in one file, for review.
//
//   node docs/investigations/whole-router-checks.mjs
//
// Each check drives the product's own code with supplied inputs: no model, no
// network, no site, no money. Each prints what the code did; what that means
// is in docs/investigations/whole-router-audit.md (§4). Nothing here is a test
// and nothing imports this file.
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { EDIT_BROWSER_FNS } from "../../scripts/addon-sweep.mjs";
import { mergeLook } from "../../builder/site-edit.mjs";
import { applyNav, navSlots } from "../../builder/site-nav.mjs";
import { preservePageProse } from "../../builder/page-prose.mjs";
import { readRouting, heldBack } from "../../builder/site-ask.mjs";
import { readTextEdits } from "../../builder/site-apply.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const say = (s = "") => console.log(s);

// ── W1: a hand-over carries the first answer's removal flag ────────────────
// The browser's own editAnswer and EditPoll, cut out of public/chat.js the way
// scripts/addon-sweep.mjs cuts them; siteEdit and siteAddon are recorders.
{
  const sweep = fs.readFileSync(root + "scripts/addon-sweep.mjs", "utf8");
  const at = sweep.indexOf("BROWSER_LINES = ");
  const BROWSER_LINES = JSON.parse(sweep.slice(sweep.indexOf("[", at), sweep.indexOf("]", at) + 1).replace(/'/g, '"'));
  const chat = fs.readFileSync(root + "public/chat.js", "utf8");
  const cut = (name) => { const i = chat.indexOf("function " + name + "("); return chat.slice(i, chat.indexOf("\n}", i) + 2); };
  const cutLine = (head) => { const i = chat.indexOf("\n" + head); return chat.slice(i + 1, chat.indexOf("\n", i + 1)); };
  const src = "const editBlocked = new Set();\n" + [...BROWSER_LINES.map(cutLine), ...EDIT_BROWSER_FNS.map(cut)].join("\n") + "\nreturn editAnswer;";
  const posted = [];
  const editAnswer = new Function("EditPoll", "siteEdit", "siteAddon", "scheduleCreditRefresh", "siteById", "sitesSave", src)(
    createRequire(import.meta.url)(root + "public/edit-poll.js"),
    (site, d) => posted.push({ step: "edit", d }),
    (site, instruction, origin, finish, fallback, d) => posted.push({ step: "addon", d }),
    () => {}, () => null, () => {},
  );
  const run = (label, routed, reply) => {
    posted.length = 0;
    editAnswer(true, reply, { site: null, d: routed, origin: "", slug: "s", instruction: "x", finish: () => {}, fallback: () => posted.push({ step: "revise" }) });
    say(`  ${label}`);
    for (const p of posted) say(`    next request: ${p.step} ${p.d ? JSON.stringify({ layer: p.d.layer, page: p.d.page, remove: p.d.remove }) : ""}`);
  };
  say("W1  a picture answer escalated needs-place (the picture step found no frame on /about)");
  run("routed as a photo REMOVAL (picture, remove true):", { ok: true, intent: "edit", layer: "picture", remove: true },
    { ok: false, escalate: true, error: "needs-place", layer: "page", page: "/about", cost: 0 });
  run("control, routed as a photo change (no remove):", { ok: true, intent: "edit", layer: "picture" },
    { ok: false, escalate: true, error: "needs-place", layer: "page", page: "/about", cost: 0 });
  say();
}

// ── W2 and W20: the look door's removals ───────────────────────────────────
// The look door makes no lane call for a removal (worker.js 23576) and hands
// the field names to mergeLook (worker.js 23703). fretwork-1 today: Welsh
// pages, French and Spanish versions, two QR codes.
{
  const prior = { theme: "slate", lang: "cy", langs: ["fr", "es"], qr: [{ to: "https://fretwork-1.gofarther.app/prices", label: "Scan for prices" }, { to: "tel:+441140000000", label: "Scan to ring and book" }] };
  const merged = (clear) => mergeLook(prior, {}, {}, { instructed: true, asked: true, clear });
  say("W2  'take the Spanish version down' (picker: removes langs): langs " + JSON.stringify(prior.langs) + " -> " + JSON.stringify(merged(["langs"]).langs));
  say("W2  'take the Scan for prices code off, keep the other' (removes qr): " + prior.qr.length + " codes -> " + merged(["qr"]).qr.length);
  const c = merged(["css"]);
  say("W20 'remove the custom styling' (removes css): " + (Object.hasOwn(c, "css") ? "css cleared" : "css is not a look field mergeLook clears, so nothing moves"));
  say();
}

// ── W4: a menu edit writes one menu to every page ──────────────────────────
// Two pages whose menus differ, as the bakery's and repairbench-1's do today;
// the menu editor answers with the menu it was shown, one label renamed.
{
  const page = (path, labels) => ({ path, source: `import { SiteChrome } from "@/components/ui/site-chrome";\nexport default function P() {\n  return (\n    <SiteChrome name="Hebden Bike Repair" links={[${labels.map(([l, h]) => `{ label: "${l}", href: "${h}" }`).join(", ")}]}>\n      <h1>Hi</h1>\n    </SiteChrome>\n  );\n}\n` });
  const pages = [
    page("index.tsx", [["Repair Status", "/status"], ["Booking Check", "/booking-check"], ["Workshop Load", "/workshop-load"], ["Rates", "/rates"]]),
    page("status.tsx", [["Repair Status", "/status"], ["Booking Check", "/booking-check"]]),
  ];
  const menus = (ps) => navSlots(ps).map((s) => `${s.page}: ${s.items.map((i) => i.label).join(" | ")}`);
  const list = navSlots(pages)[0].items.map((i) => (i.label === "Booking Check" ? { ...i, label: "Check a booking" } : i));
  say("W4  'rename Booking Check to Check a booking in the menu'");
  for (const m of menus(pages)) say("    before " + m);
  for (const m of menus(applyNav(pages, list).pages)) say("    after  " + m);
  say();
}

// ── W5: an edit turned into an add-on keeps the held-back part ─────────────
{
  const message = "Take the Events page off the site and add a page for our cake orders.";
  const tool = (input) => ({ content: [{ type: "tool_use", name: "route_message", input }] });
  const answer = { intent: "edit", layer: "page", page: "/events", remove: true, alsoAsked: "add a page for our cake orders" };
  for (const pages of [["/", "/events", "/visit"], ["/", "/visit"]]) {
    const trace = { reasons: [] };
    const r = readRouting(tool(answer), { hasSite: true, pages, trace });
    say(`W5  pages sent ${JSON.stringify(pages)}: ${JSON.stringify({ intent: r.intent, layer: r.layer, remove: r.remove, alsoAsked: r.alsoAsked })} ${trace.reasons.join(" ")}`);
    if (r.intent === "addon") {
      const h = heldBack(message, r.alsoAsked);
      say(`    the add-on then runs ${JSON.stringify(h.run)} and holds back ${JSON.stringify(h.held)}`);
    }
  }
  say();
}

// ── W9: the page writer's text guard reads the customer's verbs ────────────
// The same change every time (the Parking section gone); only the wording varies.
{
  const visit = (parking) => `import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/visit")({ component: Visit });
function Visit() {
  return (
    <main>
      <section>
        <h2>Opening hours</h2>
        <p>We open at eight every morning and close when the bread runs out.</p>
      </section>
${parking ? `      <section>
        <h2>Parking</h2>
        <p>There is free parking behind the bakery for up to an hour.</p>
      </section>
` : ""}    </main>
  );
}
`;
  say("W9  one removal of the Parking section, eight wordings");
  for (const message of [
    "Remove the Parking section.",
    "Delete the parking section from the visit page.",
    "Take the Parking section off the visit page.",
    "Get rid of the Parking section.",
    "We don't need the parking info any more.",
    "Lose the bit about parking.",
    "Drop the parking paragraph.",
    "Please take out the parking part, nobody parks there.",
  ]) {
    const r = await preservePageProse({ before: visit(true), after: visit(false), message, page: "/visit", pages: [{ path: "visit.tsx" }, { path: "index.tsx" }] });
    say(`    ${r.ok ? "published" : "withheld "}  ${JSON.stringify(message)}`);
  }
  say();
}

// ── W21: the text step drops a replacement with a straight apostrophe ──────
{
  const items = [{ path: "index.tsx", at: 100, text: "Open late on Fridays" }];
  say("W21 the text step's reader, one item, four replacements");
  for (const to of ["Open till 9 on Fridays", "We're open late on Fridays", "Fri: “late night”", "Open late on Fridays — just ask"]) {
    const out = readTextEdits({ content: [{ type: "tool_use", name: "write_text_edits", input: { edits: [{ id: 0, to }] } }] }, items);
    say(`    ${out.length ? "kept   " : "dropped"}  ${JSON.stringify(to)}`);
  }
}
