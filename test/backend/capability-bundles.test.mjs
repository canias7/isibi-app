// Capability-bundle tests — matching + merge are pure, $0. Also cross-checks every bundle id against the registry.
import { makeTally } from "./harness.mjs";
import { BUNDLES, listBundles, getBundle, bundleCapabilities, matchBundle, applyBundle, suggestCapabilities, validateBundles } from "../../builder/capability-bundles.mjs";

const t = makeTally("Capability bundles");

// --- every curated id is a REAL registry capability (guards against drift) ---
const v = validateBundles();
t.ok(v.ok, "all bundle capabilities resolve in the registry" + (v.ok ? "" : " — bad: " + v.bad.join(", ")));

// --- bundles imply auth + carry their core ---
t.ok(bundleCapabilities("booking").includes("auth"), "bundles imply auth");
t.ok(bundleCapabilities("booking").includes("bookings") && bundleCapabilities("booking").includes("slot-check"), "booking core present");
t.eq(new Set(bundleCapabilities("commerce")).size, bundleCapabilities("commerce").length, "no dup ids in a bundle");

// --- matchBundle picks the right bundle by intent ---
t.eq(matchBundle("a booking app for a hair salon with member sign in").id, "booking", "salon booking → booking bundle");
t.eq(matchBundle("an e-commerce store for handmade candles with a cart").id, "commerce", "store → commerce bundle");
t.eq(matchBundle("a CRM to track sales leads and deals").id, "crm", "CRM → crm bundle");
t.eq(matchBundle("an event ticketing site with seat selection").id, "events", "ticketing → events bundle");
t.eq(matchBundle("a coffee-shop loyalty punch card program").id, "loyalty", "loyalty → loyalty bundle");
t.eq(matchBundle("a customer help desk with tickets and a knowledge base").id, "helpdesk", "help desk → helpdesk bundle");

// --- an unmatched intent → null (planner handles it alone) ---
t.eq(matchBundle("a personal portfolio landing page"), null, "no bundle for a plain portfolio");
t.eq(matchBundle(""), null, "empty intent → null");

// --- applyBundle unions bundle core FIRST, keeps planner extras, never drops one ---
let a = applyBundle("a salon booking app", ["bookings", "reviews", "gallery-xyz"]);
t.eq(a.bundle, "booking", "matched the booking bundle");
t.ok(a.capabilities.includes("slot-check") && a.capabilities.includes("reviews") && a.capabilities.includes("gallery-xyz"), "core + planner extras both present");
t.ok(a.capabilities.indexOf("bookings") < a.capabilities.indexOf("gallery-xyz"), "bundle core comes before planner-only extras");
t.eq(new Set(a.capabilities).size, a.capabilities.length, "merged set is deduped");
t.ok(a.added.includes("slot-check"), "reports which capabilities the bundle added");

// --- no match → planner picks unchanged ---
a = applyBundle("a plain portfolio", ["react", "seo"]);
t.eq(a.bundle, null, "no bundle");
t.ok(a.capabilities.includes("react") && a.capabilities.includes("seo") && a.capabilities.length === 2, "planner picks pass through untouched");

// --- suggestCapabilities anchors on the bundle and fills the tail from the planner ---
const s = suggestCapabilities("a booking app for a barber shop");
t.eq(s.bundle, "booking", "suggest anchors on the right bundle");
t.ok(s.capabilities.includes("auth") && s.capabilities.includes("bookings"), "…includes the guaranteed core");

// --- listing ---
t.eq(listBundles().length, BUNDLES.length, "lists every bundle");
t.ok(getBundle("commerce") && !getBundle("nope"), "getBundle resolves known / rejects unknown");

t.done();
