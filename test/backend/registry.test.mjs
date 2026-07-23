// Capability registry tests — structural integrity, live coverage against worker.js (the registry must not drift
// from the actual routes), and selection sanity. Pure (no harness/worker boot needed).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { makeTally } from "./harness.mjs";
import { CAPABILITIES, getCapability, selectCapabilities, capabilityPrompt, registryStats } from "../../builder/capability-registry.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const t = makeTally("Capability registry");

// --- Structural integrity ---
t.ok(CAPABILITIES.length >= 270, `registry has the capabilities (${CAPABILITIES.length})`);
const ids = new Set();
let structOk = true;
for (const c of CAPABILITIES) {
  if (!c.id || typeof c.id !== "string") structOk = false;
  if (ids.has(c.id)) structOk = false; ids.add(c.id);
  if (!Array.isArray(c.routes) || !Array.isArray(c.tables) || !Array.isArray(c.access)) structOk = false;
  if (!c.access.length) structOk = false;
  if (c.stateful !== (c.tables.length > 0)) structOk = false;
}
t.ok(structOk, "every entry is well-formed (unique id, arrays, access, stateful matches tables)");

// --- Live COVERAGE: every /api/db/<slug>/<segment> route in worker.js has a registry entry ---
const workerSrc = readFileSync(join(ROOT, "worker.js"), "utf8");
const segRe = /url\.pathname\.match\(\/\^\\\/api\\\/db\\\/\(\[a-z0-9-\]\{1,60\}\)\\\/([a-z0-9-]+)/g;
const workerSegments = new Set();
let m; while ((m = segRe.exec(workerSrc))) workerSegments.add(m[1]);
t.ok(workerSegments.size >= 270, `worker.js exposes many capability segments (${workerSegments.size})`);
const missing = [...workerSegments].filter((s) => !getCapability(s));
t.eq(missing.length, 0, `no route segment is missing from the registry${missing.length ? " (missing: " + missing.join(", ") + ")" : ""}`);

// --- No phantom entries: every registry id is a real worker route ---
const phantom = [...ids].filter((id) => !workerSegments.has(id));
t.eq(phantom.length, 0, `no registry entry is a phantom${phantom.length ? " (" + phantom.join(", ") + ")" : ""}`);

// --- GDPR/test wiring surfaced ---
t.ok(CAPABILITIES.filter((c) => c.gdpr_erased.length).length >= 20, "GDPR-erased tables are captured");
t.ok(registryStats().withTests >= 260, "most capabilities are linked to their batch tests");

// --- Selection: intents surface the right capability at the top ---
const top = (s, o) => (selectCapabilities(s, o)[0] || {}).id;
t.eq(top("loyalty stamp card for a coffee shop"), "punch-cards", "loyalty intent → punch-cards");
t.eq(top("reserve seats for an event"), "seat-map", "seat intent → seat-map");
t.eq(top("sales forecast and commission for reps"), "sales-quota", "sales intent → sales-quota");
t.ok(selectCapabilities("validate an IBAN").some((r) => r.id === "iban"), "IBAN intent surfaces iban");
t.eq(selectCapabilities("").length, 0, "an empty intent selects nothing");
t.ok(selectCapabilities("manage things", { access: "admin" }).every((r) => r.capability.access.includes("admin")), "access filter is honored");

// --- capabilityPrompt renders the selected slice ---
const frag = capabilityPrompt(["punch-cards", "seat-map"]);
t.ok(/LOYALTY PUNCH CARDS/.test(frag) && /SEAT MAP/.test(frag), "capabilityPrompt renders titles");
t.ok(frag.length < 4000, "a two-capability prompt fragment is compact (vs the 236 KB full rules)");

t.done();
