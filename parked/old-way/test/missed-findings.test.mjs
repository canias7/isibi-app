// PARKED (2026-11-03, park-old-way): the old-way half of test/missed-findings.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// THE AUDIT'S OWN `missed` LIST — the secondary findings that never entered the
// fix pipeline, verified live and fixed.
//
// One theme, and it is not the same as the confirmed findings': every one of
// these is a check or a rule that LOOKS right and answers the wrong question —
// SQL in the wrong dialect, an entity class nobody matched, a preset name
// standing in for a resolved pair, a missing branch, a missing ORDER BY, a stub
// that does not cover what the pages reference. None of them errors. That is why
// they survived an audit's worth of reading and needed measuring.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { pageMeta } from "../../../site-meta.mjs";
import { acceptsVisitorUploads } from "../../../site-uploads.mjs";
import { lintPages } from "../../../builder/page-gen.mjs";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");

// ── 2. character references ─────────────────────────────────────────────────

const doc = (body) => "<html><body>" + body + "</body></html>";
const BASE = { brand: "Fade & Co", description: "A barber shop." };

// ── 3. the pair bug, fourth instance ────────────────────────────────────────

const withPic = (extra) => ({ name: "t", columns: [{ name: "photo_url" }], ...extra });

// ── 4. the useRow lint gap ──────────────────────────────────────────────────

const SPEC = { tables: [{ name: "posts", access: "display", columns: [{ name: "title" }] }] };
const page = (body) => [{ path: "index.tsx", source: 'import { useRow } from "@/lib/rows";\n' + body }];

// ── the three stale claims ──────────────────────────────────────────────────

test("the clarify gate's comment names the intent it actually resolves to", async () => {
  // `FALLBACK_WITH_SITE` is `addon`, so a gated clarify on an existing site —
  // which is every revise, i.e. exactly where the gate is closed — is overruled
  // into an ADDON, not a build. Right either way (both are work, never a
  // paragraph); the sentence named the one it is not.
  const { FALLBACK_WITH_SITE, readRouting } = await import("../builder/site-ask.mjs");
  const reply = { content: [{ type: "tool_use", input: { intent: "clarify", question: { text: "?", options: ["a", "b"] } } }] };
  assert.equal(readRouting(reply, { canClarify: false, hasSite: true }).intent, FALLBACK_WITH_SITE);
  assert.equal(FALLBACK_WITH_SITE, "addon", "the fallback moved — re-read the comment beside the gate");
  const src = read("../builder/site-ask.mjs");
  const at = src.indexOf("CLARIFY IS GATED BY THE CALLER");
  assert.ok(at > 0, "the gate comment is gone — rescope this");
  const note = src.slice(at, src.indexOf("if (input.intent === \"clarify\"", at));
  assert.doesNotMatch(note, /simply overruled into a build/, "the stale claim is back");
});
