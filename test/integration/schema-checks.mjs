// What the designer eval ASKS of an answer, apart from the machinery that gets
// one.
//
// SPLIT OUT SO IT CAN BE DRIVEN WITHOUT A MODEL CALL. The checks are the whole
// judgement of the harness — if `seeded` cannot see an unseeded table, or
// `capacityFn` accepts a function with no lock, the eval reports a clean run on
// a broken schema and is worse than not measuring. Every one is exercised in
// `test/schema-checks.test.mjs` against fabricated answers, at zero cost, which
// is the only part of this harness that can be verified while the model account
// is empty.
import { resolveAccess, unguardedBookings } from "../../site-access.mjs";
import { READY_FAMILIES } from "../../builder/site-layouts.mjs";

// ─────────────────────────────────────────────────────────────────────────────
// THE SCENARIOS, each aimed at a failure this platform has really shipped.
export const SCENARIOS = [
  {
    key: "menu",
    brief: "A neighbourhood café in Leeds — the menu with prices, who we are, opening hours and how to find us. No online ordering.",
    // MEASURED FAILURE, twice this week: the designer left out `seed`, a field
    // its own tool marks required, and the site published with an empty price
    // list. Nothing can write to a display table after a build.
    expect: ["seeded"],
  },
  {
    key: "booking",
    brief: "A barber shop taking appointments online — customers pick a service and a time slot, one chair, and I want their name and phone.",
    // MEASURED FAILURE, 2026-07-28: two customers booked the same 14:00 and
    // both were accepted. The constraints became declarable; nothing checks
    // that a booking table came back carrying one.
    expect: ["seeded", "slotGuarded"],
  },
  {
    key: "marketplace",
    brief: "A local events marketplace: people post their own events to sell tickets, and anybody browsing the site can see what is on.",
    // MEASURED FAILURE, 2026-08-10: every table came back private per member,
    // so not one visitor could see a single event, there was no home page to
    // write, and the whole site published as the placeholder.
    expect: ["browsable"],
  },
  {
    key: "capacity",
    brief: "A yoga studio: each class has 12 places and people book a spot online. When a class is full it should say so.",
    // NOT a past failure — this one measures the change made 2026-08-12. The
    // capacity pattern (a function that locks, counts and refuses) was
    // unreachable until the tool described it, and no build has run since.
    expect: ["seeded", "capacityFn"],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// THE CHECKS. Each is a property that is true or false, never a judgement.
export const CHECKS = {
  seeded(out, spec) {
    const display = spec.tables.filter((t) => resolveAccess(t).read === "public" && resolveAccess(t).write === "none");
    if (!display.length) return { ok: null, why: "no display table to seed" };
    const seed = (out && out.seed) || {};
    const empty = display.filter((t) => !Array.isArray(seed[t.name]) || !seed[t.name].length);
    return { ok: !empty.length, why: empty.length ? "unseeded: " + empty.map((t) => t.name).join(",") : "" };
  },
  slotGuarded(out, spec) {
    const bad = unguardedBookings(spec);
    return { ok: !bad.length, why: bad.length ? "nothing holds the slot on: " + bad.join(",") : "" };
  },
  browsable(out, spec) {
    // Signed OUT. `publicView` counts, because that is the other honest route
    // to a page a stranger can open.
    const open = spec.tables.filter((t) => resolveAccess(t).read === "public" || t.publicView);
    return { ok: !!open.length, why: open.length ? "" : "no table a signed-out visitor can read" };
  },
  capacityFn(out, spec) {
    // The pattern the tool now describes: writes closed, and a function that
    // takes the lock. Either half alone is not it — a closed table with no
    // function cannot be booked at all, and a function beside an open table is
    // walked around by a direct POST.
    const closed = spec.tables.filter((t) => resolveAccess(t).write === "none");
    const fns = Array.isArray(out && out.functions) ? out.functions : [];
    const locking = fns.filter((f) => /pg_advisory_xact_lock/i.test(String((f && f.body) || "")));
    if (!fns.length) return { ok: false, why: "no functions declared at all" };
    if (!locking.length) return { ok: false, why: "a function, but none takes the lock — it races on the last place" };
    if (!closed.length) return { ok: false, why: "a locking function beside a table anyone can still insert into" };
    return { ok: true, why: "" };
  },
  // ALWAYS RUN, on every scenario — these are the ways an answer can be
  // structurally unusable rather than merely thin.
  validFamily(out) {
    const f = String((out && out.family) || "");
    return { ok: READY_FAMILIES.includes(f), why: f ? (READY_FAMILIES.includes(f) ? "" : "not a family: " + f) : "no family" };
  },
  tablesSurvive(out, spec) {
    const asked = Array.isArray(out && out.tables) ? out.tables.length : 0;
    return { ok: asked > 0 && spec.tables.length === asked,
             why: asked ? (spec.tables.length === asked ? "" : asked + " declared, " + spec.tables.length + " survived the normaliser") : "no tables" };
  },
};
export const ALWAYS = ["validFamily", "tablesSurvive"];
