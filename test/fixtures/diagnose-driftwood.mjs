// THE OWNER-REVIEWED FAILURES (2026-10-24, driftwood-and-daughters): three
// add-on parts that went wrong, as the ended job answers recorded them, and
// the diagnosis the method should reach for each — a SUPPLIED answer, in the
// forced tool's shape, never a live model's. Reconstructed from the evidence
// the parallel fix (combine-e: auto-split, no-ask-after-charge,
// retry-with-reason) described; ids and amounts are the records' as reported.

export const DRIFTWOOD = [
  {
    name: "addon routed for existing pages, partial on a NOT NULL refusal",
    job: {
      op: "addon",
      slug: "driftwood-and-daughters",
      words: "Put the opening hours on the Hire and Events pages and add our phone number to them.",
      status: 200,
      payload: {
        ok: true,
        route: "addon",
        partial: { done: ["pages"], failed: ["row"] },
        failed: [{ table: "hire_requests", step: "row", code: "23502", detail: "null value in column \"phone\" of relation \"hire_requests\" violates not-null constraint" }],
        cost: 13,
      },
    },
    kind: "misroute",
    quote: "ANSWER.route: addon",
    fix_move: "re-route",
    retry: "no",
  },
  {
    name: "add-on picker chose nothing to add",
    job: {
      op: "addon",
      slug: "driftwood-and-daughters",
      words: "Add a gallery of our boats to the home page.",
      status: 200,
      payload: { ok: false, error: "no-add", why: "the picker chose nothing to add", stage: "pick_adds", cost: 0 },
    },
    kind: "empty-pick",
    quote: "ANSWER.why: the picker chose nothing to add",
    fix_move: "retry-with-instruction",
    retry: "unsure",
  },
  {
    name: "add-on page writer asked a question after the charge",
    job: {
      op: "addon",
      slug: "driftwood-and-daughters",
      words: "Add an Events page where people can book a place.",
      status: 200,
      payload: { ok: false, stage: "add:pages", question: "Should bookings take payment, or just reserve a place?", charged: 12, refunded: 12 },
    },
    kind: "asked-after-charge",
    quote: "ANSWER.charged: 12",
    fix_move: "ask-before-charge",
    retry: "no",
  },
];

/** A supplied reply in the forced tool's shape. */
export function suppliedReply(input) {
  return { content: [{ type: "tool_use", name: "record_diagnosis", input }], usage: { input_tokens: 900, output_tokens: 140 } };
}

/** The diagnosis the method should reach for one fixture. */
export function answerFor(f) {
  return {
    kind: f.kind,
    broke_at: f.job.payload.stage || f.job.payload.route || "addon",
    root_cause: "The " + f.kind + " is the root cause because the evidence shows it at the step that first went wrong.",
    evidence: [f.quote],
    proposed_fix: "Make the one change the move names for this step.",
    fix_move: f.fix_move,
    retry_would_succeed: f.retry,
  };
}
