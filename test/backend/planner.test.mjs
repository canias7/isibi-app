// App planner tests — planApp() turns an intent into a valid, focused spec; validateSpec catches malformed specs;
// specToPrompt renders. Pure (registry-backed, no model, no harness).
import { makeTally } from "./harness.mjs";
import { planApp, validateSpec, specToPrompt } from "../../builder/app-planner.mjs";

const t = makeTally("App planner");

// --- Plans are valid and focused ---
let p = planApp("a loyalty punch card app for a coffee shop with member sign in and an admin dashboard");
t.eq(p.ok, true, "loyalty intent → a valid spec");
t.eq(p.errors.length, 0, "…no errors");
t.ok(p.spec.capabilities.includes("punch-cards"), "…includes punch-cards");
t.ok(p.spec.capabilities.length <= 10, "…stays focused (≤10 capabilities)");
t.ok(p.spec.roles.includes("member") && p.spec.roles.includes("admin"), "…derives member + admin roles");
t.ok(p.spec.tables.includes("_punch_cards"), "…surfaces the data tables");

// --- Pages: a home page always, an auth page when membership is used, admin console when admin caps exist ---
t.ok(p.spec.pages.some((x) => x.path === "/"), "a home page exists");
t.ok(p.spec.pages.some((x) => x.name === "SignIn"), "a sign-in page for the member role");
t.ok(p.spec.pages.some((x) => x.name === "Admin"), "an admin console page");

// --- Permissions per role ---
const adminPerm = p.spec.permissions.find((x) => x.role === "admin");
t.ok(adminPerm.can_write.includes("punch-cards"), "admin can write punch-cards");

// --- Another domain routes to the right capabilities ---
let e = planApp("event ticketing with seat reservation");
t.ok(e.spec.capabilities.includes("seat-map"), "ticketing intent → seat-map");
t.eq(validateSpec(e.spec).ok, true, "…and the spec validates");

// --- Integrations + design hints from the intent ---
let s = planApp("a dark, minimal booking app with stripe payments and email reminders");
t.ok(s.spec.integrations.includes("stripe"), "detects the stripe integration");
t.ok(s.spec.integrations.includes("email"), "detects the email integration");
t.eq(s.spec.design_hints.mode, "dark", "detects a dark design hint");
t.eq(s.spec.design_hints.style, "minimal", "detects a minimal style hint");

// --- validateSpec catches malformed specs ---
t.eq(validateSpec({ capabilities: [], pages: [{ path: "/" }], roles: ["visitor"] }).ok, false, "no capabilities → invalid");
t.ok(validateSpec({ capabilities: ["not-a-real-cap"], pages: [{ path: "/" }], roles: ["visitor"] }).errors.some((x) => /not real/.test(x)), "a fake capability is flagged");
t.ok(validateSpec({ capabilities: ["punch-cards"], pages: [{ name: "X", path: "/x" }], roles: ["visitor"] }).errors.some((x) => /home page/.test(x)), "no home page is flagged");
t.ok(validateSpec({ capabilities: ["punch-cards"], pages: [{ path: "/" }, { path: "/" }], roles: ["visitor"] }).errors.some((x) => /duplicate/.test(x)), "duplicate page paths are flagged");
t.ok(validateSpec({ capabilities: ["punch-cards"], pages: [{ path: "/" }], roles: ["admin"] }).errors.some((x) => /visitor/.test(x)), "roles must include visitor");

// --- specToPrompt renders the key sections ---
const prompt = specToPrompt(p.spec);
t.ok(/APP:/.test(prompt) && /PAGES:/.test(prompt) && /PERMISSIONS:/.test(prompt), "the planning brief has the core sections");
t.ok(/punch-cards/.test(prompt), "…and names the capability");

// --- Empty intent ---
t.eq(planApp("").ok, false, "an empty intent → not ok");
t.eq(planApp("   ").spec, null, "…and no spec");

t.done();
