// The REAL `design_schema` tool, lifted out of the real worker.js — ONE reader.
//
// EXTRACTED 2026-08-21 so a second harness could use it without importing the
// eval. `schema-gen-eval.mjs` is a top-level SCRIPT: importing it runs it, which
// means spending real model credits and calling `process.exit`. So the choice
// was a shared module or a second copy of the extraction, and a second copy is
// exactly what this function's own header argues against — a harness that
// quietly measures a different tool from the one production sends is worse than
// no harness.
//
// It reads worker.js as TEXT and evals the literal, because the tool is not
// exported. That is unchanged; only its address moved.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// The two module-scope bindings the tool literal references by shorthand.
// `plan` is loaded dynamically below with the rest; these two are not, because
// the literal names them bare rather than through a namespace.
import { SEEDS_FIELD } from "../../builder/site-seeds.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * The REAL `design_schema` tool and system text, out of the real worker.js.
 *
 * Every identifier the literal references is resolved from the module
 * worker.js itself imports it from. Anything that cannot be resolved is a hard
 * failure rather than a stub: a harness that quietly measures a 1-entry enum
 * where production sends 100 is worse than no harness, and this one nearly
 * shipped that way.
 */
export async function readSchemaTool() {
  const src = fs.readFileSync(path.join(ROOT, "worker.js"), "utf8");
  const [fonts, plan, tokens, style, authored, registry, favicon] = await Promise.all([
    import(path.join(ROOT, "builder", "site-fonts.mjs")),
    import(path.join(ROOT, "builder", "site-plan.mjs")),
    import(path.join(ROOT, "builder", "site-tokens.mjs")),
    import(path.join(ROOT, "builder", "site-style.mjs")),
    import(path.join(ROOT, "builder", "site-authored.mjs")),
    import(path.join(ROOT, "builder", "site-theme-registry.mjs")),
    import(path.join(ROOT, "builder", "site-favicon.mjs")),
  ]);
  const scope = {
    SITE_FONT_IDS: fonts.SHORTLIST.map((f) => f.id),
    // THE SIX AUTHORED PLAN FIELDS, where `SITE_FAMILY_IDS` and the two prompt
    // helpers used to be. `family` left `design_schema` on 2026-08-20 — the
    // designer writes the purpose, the skeleton, the shape, the page list, the
    // verb and the component manifest per site instead of naming one of 100
    // pre-written trades — so the enum and the family blurb this scope used to
    // supply are gone from the tool entirely. Real objects, never stubs, for the
    // reason this function's own header gives.
    PLAN_FIELDS: plan.PLAN_FIELDS,
    // `shape` is spliced into the tool after `mode` rather than beside its four
    // siblings (2026-08-21), so it is a second name the tool references and the
    // eval has to bind. NOT STUBBED — a stubbed description measures a prompt
    // nobody sends, which is what `schema-eval-scope.test.mjs` says when it
    // catches a missing one, and it caught this one.
    SHAPE_FIELD: plan.SHAPE_FIELD,
    IMAGES_FIELD: plan.IMAGES_FIELD,
    ACTION_FIELD: plan.ACTION_FIELD,
    // The designer-drawn tab icon (2026-08-28) — the real field, never a stub,
    // for the reason this function's own header gives.
    FAVICON_FIELD: favicon.FAVICON_FIELD,
    PLAN_REQUIRED: plan.PLAN_REQUIRED,
    SITE_TOKEN_NAMES: tokens.ASKABLE,
    siteTokenHint: tokens.valueHint,
    // THE THEME SHORTLIST, BACK (2026-08-27, owner's call — and the same
    // day's second call cut the enum from all 500 to the 100-name spread:
    // "do only 100 and keep the otherones there"). The REAL list, never a
    // stub, because the enum IS the field: a stubbed one-entry list measures
    // a tool where the designer can only ever answer one theme, which is not
    // the tool production sends. The third time this scope has grown the day
    // the tool did; `schema-eval-scope.test.mjs` is what turns the miss into
    // a unit failure rather than a dead harness.
    THEME_SHORTLIST: registry.THEME_SHORTLIST,
    // THE AUTHORED PALETTE, where the 100-name theme enum used to be. `theme`
    // left `design_schema` on 2026-08-20 with the registry it named — the
    // designer writes the site's own three anchor colours now. The REAL field,
    // never a stub, for the reason this function's own header gives: a stubbed
    // schema measures a prompt nobody sends.
    SEEDS_FIELD,
    // The style axes. Added 2026-08-13, after this harness had been dead for a
    // day: the axes landed in `design_schema` and nothing added them here, so
    // every run since died on the line below with `SITE_STYLE_AXES is not
    // defined`. A hand-maintained scope drifts the moment the tool grows, which
    // is what `test/schema-eval-scope.test.mjs` now watches for — it fails in
    // the unit suite rather than here, where nobody was looking.
    SITE_STYLE_AXES: style.ASKABLE,
    siteStyleOptions: style.optionsFor,
    siteStyleHint: style.axisHint,
    // …and the two axes that also take a value the model WRITES rather than
    // names (2026-08-22). Real, never stubbed, for the same reason as the rest:
    // `SITE_AUTHORED_AXES` decides which fields the tool even has, so a stub
    // measures a prompt with no authored fields in it at all — the silent
    // version of the failure the comment above records.
    SITE_AUTHORED_AXES: style.AUTHORED_AXES,
    siteAuthoredHint: style.authoredHint,
    // THE ENUMS LEFT `design_schema` ON 2026-08-22 — the model writes its own
    // CSS on every axis — so these three decide the SHAPE of all 23 style
    // fields. Real, never stubs, for the reason the header gives twice over: a
    // stubbed schema builder produces a tool that is not the one production
    // sends, and this block is the one whose rejection 400s every build.
    siteStyleSaid: style.saidFor,
    siteAuthoredSchema: authored.authoredFieldSchema,
    // …AND THE WIRE NAME (2026-08-22). `border` goes out as `borderWeight`
    // because a field called `border` reads as the border COLOUR, which is a
    // token — so the tool speaks the wire name and `parseStyle` folds it back
    // at the door. Real, never a stub: it decides what the field is CALLED, and
    // a stub names every one of the 29 axis fields `x`.
    //
    // ITS ABSENCE KILLED BOTH HARNESSES AND THE GUARD STAYED GREEN — see the
    // note in `schema-eval-scope.test.mjs`. This is the second time this scope
    // has drifted the moment the tool grew, which is why that guard exists at
    // all; what was new is that a permissive stub hid it.
    siteWireName: style.wireName,
    SITE_AUTHORED_IMAGE: Object.entries(authored.AXIS_DECLS).filter(([, v]) => v.image).map(([k]) => k),
  };
  for (const [k, v] of Object.entries(scope)) globalThis[k] = v;

  const at = src.indexOf("const SITE_SCHEMA_TOOL");
  if (at < 0) throw new Error("SITE_SCHEMA_TOOL is gone from worker.js — retarget this harness");
  let depth = 0, i = src.indexOf("{", src.indexOf("=", at)), j = i;
  for (; j < src.length; j++) {
    const c = src[j];
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (!depth) { j++; break; } }
  }
  let tool;
  try { tool = eval("(" + src.slice(i, j) + ")"); }
  catch (e) {
    // NEVER STUBBED. If an identifier is missing here the harness must stop, not
    // invent a placeholder — that is how a 100-entry enum becomes a 1-entry one
    // and every number in the report describes a prompt nobody sends.
    throw new Error("could not resolve the tool: " + e.message + " — add it to `scope`, do not stub it");
  }

  // The system block, lifted from the same file rather than retyped.
  //
  // OFF THE NAMED CONSTANT rather than out of the request literal. It used to
  // find `text: "You design the data model` — a position inside `designSiteSchema`
  // — and lifting that string into `SITE_SCHEMA_SYSTEM`, so its frontend twin
  // could sit beside it, moved the position while changing not one byte of what
  // is sent. A landmark that is a phrase inside another expression is one the
  // next edit moves; a `const` has a name.
  const sysAt = src.indexOf("const SITE_SCHEMA_SYSTEM =");
  if (sysAt < 0) throw new Error("SITE_SCHEMA_SYSTEM is gone from worker.js — retarget this harness");
  const sysEnd = src.indexOf('";', sysAt);
  if (sysEnd < 0) throw new Error("could not find the end of SITE_SCHEMA_SYSTEM — retarget this harness");
  const system = eval("[" + src.slice(src.indexOf('"', sysAt), sysEnd + 1) + "]").join("");

  // Sanity: the real fields must have landed, or something above silently
  // failed. This read `properties.family.enum.length` against `READY_FAMILIES`
  // — a check that the 100-trade enum was the real one and not a stub — and
  // `family` left `design_schema` on 2026-08-20 with the families, so it would
  // have thrown reading `.enum` of undefined on every run.
  //
  // The equivalent question for a plan is whether the six authored fields are
  // all there AND all compelled: a scope that quietly handed over a partial
  // `PLAN_FIELDS` produces a tool the model can answer without a page list, and
  // every number in the report would then describe a prompt production does not
  // send. Derived from `PLAN_KEYS` rather than restated, so a seventh field is
  // covered without anybody remembering this file.
  const props = (tool.input_schema && tool.input_schema.properties) || {};
  const required = new Set(tool.input_schema && tool.input_schema.required);
  for (const k of plan.PLAN_KEYS) {
    if (!props[k]) throw new Error("`" + k + "` is not on the tool — the plan fields did not reach it");
    if (!required.has(k)) throw new Error("`" + k + "` is on the tool but not required — the designer can skip it");
  }
  // ── THE FRONTEND VARIANT, EVALUATED RATHER THAN RESTATED ──────────────────
  //
  // A FIRST BUILD IS SENT A DIFFERENT TOOL since 2026-08-25 — the same one with
  // `backend` off it — and the guard for that split first restated the
  // derivation instead of running it. A mutation replacing the destructure with
  // a plain read (`const properties = …`, so the PROPERTY survives while
  // `required` still drops it) SURVIVED the whole suite, because both the
  // restatement and the source-read were satisfied by it: the source still names
  // `SITE_SCHEMA_TOOL.input_schema.properties` and the test's own copy of the
  // derivation still did the right thing. **A test that reimplements the thing
  // under test agrees with itself.**
  //
  // So the real IIFE is sliced out and evaluated with the real tool bound. What
  // comes back is the object the API is sent, and "does it have a backend" stops
  // being a question about how the line is written.
  let frontendTool = null;
  const fa = src.indexOf("const FRONTEND_SCHEMA_TOOL");
  if (fa < 0) throw new Error("FRONTEND_SCHEMA_TOOL is gone from worker.js — retarget this harness");
  {
    const fi = src.indexOf("(", src.indexOf("=", fa));
    let d2 = 0, fj = fi;
    for (; fj < src.length; fj++) {
      const c = src[fj];
      if (c === "(") d2++;
      else if (c === ")") { d2--; if (!d2) { fj++; break; } }
    }
    globalThis.SITE_SCHEMA_TOOL = tool;
    try { frontendTool = eval("(" + src.slice(fi, fj) + ")()"); }
    catch (e) { throw new Error("could not resolve the frontend tool: " + e.message); }
  }

  return { tool, frontendTool, system };
}
