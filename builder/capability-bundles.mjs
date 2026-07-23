// Prebuilt capability bundles — upgrade #11.
//
// The planner already selects capabilities per intent (and nailed it in the eval). Bundles add a curated, TESTED
// core for the common app types (booking / commerce / social / content / events / CRM / help-desk / directory /
// loyalty / courses), so those requests start from a known-good set instead of assembling from zero — faster and
// with a reliability floor. `applyBundle` UNIONs the bundle's core with the planner's scored picks (bundle
// guarantees the essentials; planner still adds the long tail), so it can only add coverage, never remove it.
//
// Every id below is a real registry capability (cross-checked by the test against getCapability). WORKER-SAFE: pure.
import { getCapability, selectCapabilities } from "./capability-registry.mjs";

// Each bundle: id, human title, match keywords (scored against the intent), and the curated core capability ids.
// All bundles imply `auth` (a signed-in member) — added by bundleCapabilities.
export const BUNDLES = [
  { id: "booking", title: "Booking / appointments", match: ["book", "booking", "appointment", "salon", "barber", "spa", "clinic", "dentist", "reservation", "schedule", "stylist", "haircut", "session"], core: ["bookings", "services", "slots", "slot-check", "rooms", "hours", "no-shows", "reminders", "notifications", "waitlist", "business-days"] },
  { id: "commerce", title: "E-commerce store", match: ["shop", "store", "ecommerce", "e-commerce", "cart", "checkout", "product", "buy", "sell", "merch", "boutique", "catalog"], core: ["cart", "coupons", "shipping", "tax-rates", "inventory-count", "store-credit", "gift-cards", "wishlist", "reviews", "ratings", "promotions", "order-notes"] },
  { id: "social", title: "Social / community", match: ["social", "community", "feed", "follow", "friends", "post", "network", "members post", "timeline"], core: ["feed", "follow", "comments", "mentions", "react", "notifications", "profiles", "badges", "reputation", "blocks", "bans"] },
  { id: "content", title: "Content / publishing", match: ["blog", "publish", "article", "news", "magazine", "podcast", "cms", "content", "editorial", "newsletter"], core: ["publish-queue", "categories", "taxonomy", "search", "seo", "comments", "newsletter", "related", "toc", "markdown", "excerpt"] },
  { id: "events", title: "Events / ticketing", match: ["event", "ticket", "ticketing", "conference", "concert", "rsvp", "seat", "check-in", "attendee"], core: ["events", "seat-map", "bookings", "ical", "reminders", "waitlist", "notifications", "qr"] },
  { id: "crm", title: "Sales CRM", match: ["crm", "lead", "leads", "deal", "deals", "pipeline", "sales", "quota", "forecast", "prospect"], core: ["leads", "deals", "contacts", "sales-quota", "commission", "forecast-categories", "winloss", "activity", "reports", "dashboard", "kpi"] },
  { id: "helpdesk", title: "Help desk / support", match: ["help desk", "helpdesk", "support", "ticket", "tickets", "customer service", "knowledge base", "faq"], core: ["tickets", "canned", "sla-timers", "escalation-rules", "faq", "glossary", "feedback", "nps", "reports"] },
  { id: "directory", title: "Directory / marketplace", match: ["directory", "marketplace", "listing", "listings", "classifieds", "browse", "vendors", "sellers"], core: ["search", "categories", "reviews", "ratings", "geo-distance", "saves", "dm", "profiles"] },
  { id: "loyalty", title: "Loyalty / rewards", match: ["loyalty", "reward", "rewards", "punch card", "punch-card", "points", "stamp", "perks"], core: ["loyalty", "punch-cards", "points", "rewards-catalog", "levels", "referrals", "coupons"] },
  { id: "courses", title: "Courses / LMS", match: ["course", "courses", "lesson", "lessons", "lms", "learning", "training", "quiz", "curriculum", "class"], core: ["courses", "quizzes", "goals", "leaderboards", "badges"] },
];

const BY_ID = new Map(BUNDLES.map((b) => [b.id, b]));
export function listBundles() { return BUNDLES.map((b) => ({ id: b.id, title: b.title, size: b.core.length + 1 })); }
export function getBundle(id) { return BY_ID.get(id) || null; }

// The bundle's capability ids (auth + curated core), deduped.
export function bundleCapabilities(id) {
  const b = BY_ID.get(id);
  if (!b) return [];
  return [...new Set(["auth", ...b.core])];
}

// matchBundle(intent) — the best-fitting bundle for an intent, or null. Scores by how many of the bundle's match
// phrases appear in the (lowercased) intent; longer phrases weigh more. Ties/zero → null (planner handles it).
export function matchBundle(intent, opts = {}) {
  const s = String(intent || "").toLowerCase();
  let best = null, bestScore = 0;
  for (const b of BUNDLES) {
    let score = 0;
    for (const kw of b.match) { if (s.includes(kw)) score += kw.includes(" ") ? 2 : 1; }
    if (score > bestScore) { bestScore = score; best = b; }
  }
  if (!best || bestScore < (opts.minScore || 1)) return null;
  return { id: best.id, title: best.title, score: bestScore, capabilities: bundleCapabilities(best.id) };
}

// applyBundle(intent, plannerCaps) — union the matched bundle's core with the planner's scored picks. Bundle core
// comes FIRST (guaranteed), then any planner extras the bundle didn't include. If no bundle matches, returns the
// planner picks unchanged. Never drops a planner capability.
export function applyBundle(intent, plannerCaps = [], opts = {}) {
  const m = matchBundle(intent, opts);
  const planner = [...new Set((Array.isArray(plannerCaps) ? plannerCaps : []).filter(Boolean))];
  if (!m) return { bundle: null, capabilities: planner, added: [] };
  const merged = [...new Set([...m.capabilities, ...planner])];
  const added = m.capabilities.filter((c) => !planner.includes(c));
  return { bundle: m.id, title: m.title, capabilities: merged, added, fromPlanner: planner.length };
}

// suggestCapabilities(intent) — a convenience: bundle-anchored capability set, planner used to fill the tail.
export function suggestCapabilities(intent, opts = {}) {
  const picks = selectCapabilities(intent, { limit: opts.limit || 12 }).map((c) => c.id);
  return applyBundle(intent, picks, opts);
}

// validateBundles() — every core id resolves to a real registry capability. Guards against registry drift.
export function validateBundles() {
  const bad = [];
  for (const b of BUNDLES) for (const id of ["auth", ...b.core]) if (!getCapability(id)) bad.push(b.id + ":" + id);
  return { ok: bad.length === 0, bad };
}
