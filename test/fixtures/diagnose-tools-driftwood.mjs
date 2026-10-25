// THE THREE REAL DRIFTWOOD FAILURES OF 2026-10-24, AS THE DIAGNOSIS'S TOOLS
// WOULD READ THEM (2026-10-25). Built from the non-secret columns of their
// `edit_jobs` rows, their `edit_traces` and the routing rows before them on
// Supabase `ujrqdmmtcptvimazlhom`, read 2026-10-25; long fields cut, the
// customer's uid left out. No model is called anywhere with these.

const SLUG = "driftwood-and-daughters-5";
const PAGES = ["/", "/lessons", "/board-shop", "/cafe", "/hire", "/events", "/gallery", "/faq", "/gift-vouchers", "/contact", "/privacy"];
const TABLES = ["closed_days", "event_signups", "events", "hire_items", "hire_requests", "lesson_bookings", "lessons", "menu_items", "messages", "newsletter_signups", "reservations", "shop_items", "surf_conditions", "voucher_orders", "vouchers"];
const REQUEST = "Put Instagram and Facebook links and a newsletter sign-up in the footer, and a header menu linking every page.";

const site = {
  pages: PAGES,
  tables: TABLES.map((name) => ({ name, columns: name === "newsletter_signups" ? [{ name: "id", type: "uuid", notNull: true, default: "gen_random_uuid()" }, { name: "email", type: "text", notNull: true }] : [{ name: "id", type: "uuid", notNull: true }] })),
};

export const FAILURES = [
  {
    name: "2124dc02 add-on found nothing to add on existing pages",
    id: "2124dc025218fdcee5f43f5f8708f4e4",
    job: {
      op: "addon", slug: SLUG, status: 200, shipped: false,
      words: "Rebuild those pages to this brief.",
      payload: { ok: false, reply: "Still to do: A way to mark a day closed for bad weather … Your site already had that in place, but I can't confirm from here that A Lessons page listing group lessons …" },
    },
    results: {
      read_job: { id: "2124dc025218fdcee5f43f5f8708f4e4", slug: SLUG, op: "addon", state: "failed", billing: "none", cost: "0", created_at: "2026-10-24 20:58:29.659708+00", answer: { requirementsTold: [{ need: "A Lessons page listing group lessons (£40, 2 hours) …", told: "already-there", state: "unverified" }, { need: "A header menu linking every page", told: "still-to-do", state: "missing" }] } },
      read_trace: [{ cid: "e_mvmvskplskvswbo3", ok: true, events: [{ p: "pick_adds", s: "ok", d: { kinds: ["row", "component", "frame"] } }, { p: "judge:final", s: "ok", d: { items: 40, entries: 18, invalid: 6 } }] }],
      read_route: { matched: "latest-before-job", id: "896cf94c1ecbdb984bfe3ad83c52acbe", router: { ok: true, intent: "addon", decision: { source: "model", reasons: ["tables-filled", "pages-filled", "resolved-ignored"], raw: { intent: "addon", layer: "none" } }, targets: [{ change: 0, writes: ["data:lessons", "page:/lessons"], reads: [] }] } },
      list_site: site,
      read_page: { path: "lessons.tsx", source: "export default function Lessons() { /* group £40, private £75, kids' club £30, 5-day course £170 */ }" },
    },
    script: ["read_job", "read_route", "list_site"],
    answer: {
      kind: "misroute", fault: "ours", fix_move: "re-route", retry_would_succeed: "no",
      broke_at: "routing",
      root_cause: "Routing sent a rebuild of pages the site already has to the add-on step, which adds only what is missing, so it found nothing to add.",
      quotes: ["\"intent\":\"addon\"", "\"writes\":[\"data:lessons\",\"page:/lessons\"]", "\"/lessons\""],
      proposed_fix: "Route a request to change existing pages to the page step, not the add-on.",
    },
  },
  {
    name: "6f7583f4 add-on escalated to nav/frame",
    id: "6f7583f4cf90558384cd3dfdbf9b8c97",
    job: {
      op: "addon", slug: SLUG, status: 200, shipped: false,
      words: REQUEST,
      payload: { ok: false, cost: 0 },
    },
    results: {
      read_job: { id: "6f7583f4cf90558384cd3dfdbf9b8c97", slug: SLUG, op: "addon", state: "failed", billing: "none", cost: "0", answer: { ok: false, reason: "layer", cost: 0, escalate: true, layer: "nav", kind: "frame" } },
      read_trace: [{ cid: "e_mvmvxgxyr6og79gw", ok: true, events: [{ p: "pick_adds", s: "ok", d: { kinds: ["row"] } }, { p: "add:row", s: "ok", d: { rows: 4 } }] }],
      read_route: { matched: "latest-before-job", id: "7844b721c7fd580b1e9d5366b7af35d1", router: { ok: true, intent: "addon", decision: { source: "model", reasons: ["tables-filled", "pages-filled"], raw: { intent: "addon", layer: "none" } }, targets: [{ change: 0, writes: ["menu", "footer", "data:newsletter_signups"], reads: PAGES.map((p) => "page:" + p) }] } },
      list_site: site,
    },
    script: ["read_job", "read_route"],
    answer: {
      kind: "misroute", fault: "ours", fix_move: "re-route", retry_would_succeed: "no",
      broke_at: "routing",
      root_cause: "Routing answered addon for a header and footer change; the add-on handed it back as a frame edit (layer nav), so the routing chose the wrong step.",
      quotes: ["\"writes\":[\"menu\",\"footer\",\"data:newsletter_signups\"]", "\"reason\":\"layer\"", "\"layer\":\"nav\""],
      proposed_fix: "Route menu and footer changes to the nav (frame) step directly, with the newsletter table as its addition.",
    },
  },
  {
    name: "75f25f2f frame edit refused, cost 6",
    id: "75f25f2f1b7d424d1115c85b40263c58",
    job: {
      op: "edit", slug: SLUG, status: 422, shipped: false,
      words: REQUEST,
      payload: { ok: false, error: "refused", cost: 6 },
    },
    results: {
      read_job: { id: "75f25f2f1b7d424d1115c85b40263c58", slug: SLUG, op: "edit", state: "failed", billing: "refunded", cost: "6", answerStatus: 422, answer: { ok: false, error: "refused", frame: true, cost: 6, usage: { model: "grok-4.7", in: 5011, out: 5171 }, problems: ["footer:kit:@/components/ui/figure"], msg: "I couldn't make that change to the header or footer safely, so your site is unchanged." } },
      read_trace: [{ cid: "e_mvmvzgofgtcs1kjg", ok: true, events: [{ p: "handover", s: "ok", d: { from: "addon", reason: "layer" } }] }],
      read_route: { matched: "latest-before-job", id: "7844b721c7fd580b1e9d5366b7af35d1", router: { ok: true, intent: "addon", targets: [{ change: 0, writes: ["menu", "footer", "data:newsletter_signups"] }] } },
      list_site: site,
    },
    script: ["read_job", "read_trace"],
    answer: {
      kind: "invalid-model-output", fault: "model", fix_move: "retry-with-instruction", retry_would_succeed: "unsure",
      broke_at: "frame writer's footer",
      root_cause: "The frame writer's footer imported a kit component the footer may not use, so the check refused the whole change (refunded).",
      quotes: ["\"problems\":[\"footer:kit:@/components/ui/figure\"]", "\"billing\":\"refunded\""],
      proposed_fix: "Retry the footer with the check's problem as the instruction: do not import @/components/ui/figure in the footer.",
    },
  },
];

/** The tools, as the worker binds them, answering the recorded rows; each call is logged. */
export function toolsFor(f, log = []) {
  const out = {};
  for (const name of ["read_job", "read_trace", "read_route", "list_site", "read_page"]) {
    out[name] = async (input) => { log.push({ name, input }); return Object.hasOwn(f.results, name) ? f.results[name] : null; };
  }
  return out;
}

/** A supplied model that calls `script`'s tools one per turn, then records `input`. */
export function scriptedSend(script, input, sent = []) {
  let i = 0;
  return async (req) => {
    sent.push(req);
    if (i < script.length) {
      const name = script[i];
      i++;
      return { content: [{ type: "tool_use", id: "t" + i, name, input: name === "read_page" ? { path: "/lessons" } : {} }], usage: { input_tokens: 100, output_tokens: 10 } };
    }
    return { content: [{ type: "tool_use", id: "rec", name: "record_diagnosis", input }], usage: { input_tokens: 100, output_tokens: 50 } };
  };
}

export function recordInput(f) {
  const a = f.answer;
  return { kind: a.kind, broke_at: a.broke_at, root_cause: a.root_cause, evidence: a.quotes, proposed_fix: a.proposed_fix, fix_move: a.fix_move, retry_would_succeed: a.retry_would_succeed, fault: a.fault };
}
