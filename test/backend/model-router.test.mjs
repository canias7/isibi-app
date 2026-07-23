// Model-router tests — the Auto/Sonnet/Opus routing, pure + $0.
import { makeTally } from "./harness.mjs";
import { MODELS, ROLE_ROUTES, NO_MODEL, PICKERS, pickModel, escalateRole, routeTable, isNoModel } from "../../builder/model-router.mjs";

const t = makeTally("Model router");

// --- Auto: Opus for the architect/emergency roles, Sonnet for the generative bulk ---
t.eq(pickModel("planner"), MODELS.opus, "planner → Opus");
t.eq(pickModel("architecture"), MODELS.opus, "architecture → Opus");
t.eq(pickModel("frontend"), MODELS.sonnet, "frontend → Sonnet");
t.eq(pickModel("backend"), MODELS.sonnet, "backend → Sonnet");
t.eq(pickModel("design"), MODELS.sonnet, "design → Sonnet");
t.eq(pickModel("integration"), MODELS.sonnet, "integration → Sonnet");
t.eq(pickModel("vision"), MODELS.sonnet, "vision review → Sonnet");

// --- Haiku is gone: tests + repair go to Sonnet, not Haiku (owner's call) ---
t.eq(pickModel("tests"), MODELS.sonnet, "tests → Sonnet (not Haiku)");
t.eq(pickModel("repair"), MODELS.sonnet, "normal repair → Sonnet (not Haiku)");
t.ok(!Object.values(MODELS).some((m) => /haiku/i.test(m)), "no Haiku in the model set");
t.ok(!Object.values(ROLE_ROUTES).includes("haiku"), "no role routes to Haiku");

// --- Emergency escalation: hard variants + the hard flag go to Opus ---
t.eq(pickModel("repair-hard"), MODELS.opus, "repeated difficult repair → Opus");
t.eq(pickModel("integration-hard"), MODELS.opus, "difficult integration → Opus");
t.eq(pickModel("repair", { hard: true }), MODELS.opus, "the hard flag escalates repair to Opus under Auto");
t.eq(escalateRole("repair"), "repair-hard", "escalateRole bumps repair to its hard variant");
t.eq(escalateRole("frontend"), "frontend", "…and leaves roles with no hard variant unchanged");

// --- The picker pins a model regardless of role ---
t.eq(pickModel("frontend", { picker: "opus" }), MODELS.opus, "picker=opus pins frontend to Opus");
t.eq(pickModel("planner", { picker: "sonnet" }), MODELS.sonnet, "picker=sonnet pins even the planner to Sonnet");
t.eq(pickModel("repair", { picker: "sonnet", hard: true }), MODELS.sonnet, "a pinned picker ignores the hard flag");
t.ok(PICKERS.includes("auto") && PICKERS.includes("sonnet") && PICKERS.includes("opus") && PICKERS.length === 3, "three pickers: auto/sonnet/opus (no haiku)");

// --- Unknown roles fall back to Sonnet (safe generative default) ---
t.eq(pickModel("something-new"), MODELS.sonnet, "unknown role → Sonnet");

// --- The deterministic checks are 'no model' ---
t.ok(isNoModel("lint") && isNoModel("compile") && isNoModel("route-check") && isNoModel("schema-check"), "lint/compile/route/schema use no model");
t.ok(!isNoModel("frontend"), "a generative role is not 'no model'");
t.ok(NO_MODEL.length === 4, "four deterministic checks");

// --- routeTable is inspectable data ---
const tbl = routeTable();
t.ok(tbl.find((r) => r.role === "planner").model === MODELS.opus, "routeTable maps planner→Opus model id");
t.ok(tbl.every((r) => r.model === MODELS.opus || r.model === MODELS.sonnet), "every routed role resolves to Opus or Sonnet");

t.done();
