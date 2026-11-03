// PARKED (2026-11-03, park-old-way): the old-way half of test/container-transport.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// THE JOB'S TRANSPORT, AND THE RECORD OF WHERE IT RAN.
//
// ── WHY THIS FILE EXISTS, AND IT IS THE SWEEP'S ANSWER ─────────────────────
//
// The first sweep over the container move killed 24 of 34 and left TEN
// survivors — every one of them in this half, and none in the duration or
// fallback halves. That split is the finding: those two came with guards of
// their own, and this one shipped with nothing but RE-ANCHORS of guards that
// already existed. A re-anchored guard proves the property it always proved;
// it says nothing about the property just added.
//
// So every survivor is a case below, named by what it would have let through:
//
//   the page call on the module's default transport   ← run 45's defect, exactly
//   the runner not handing its sender over            ← the same defect, one hop up
//   the env dropping the sender, or the stream flag
//   callFailure dropping `cause` or `wire`            ← the fields run 45 needed
//   the addon's catch recording only the message      ← what run 45 actually did
//   the container not saying where the job ran
//   the Worker claiming to be the container
//   the deadline never reaching the record

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { callFailure } from "../../../builder/build-call.mjs";
import { makeContainerEnv } from "../../../builder/container-env.mjs";
import { longPost } from "../../../builder/long-post.mjs";

const WORKER = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
/** Comments explain the transport and therefore spell it — this repo's most-recorded own-goal in a guard. */
const bare = (s) => s.split("\n").map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? "" : l)).join("\n");

const GATEWAY = { url: "https://gofarther.dev/api/job/abc", token: "t" };
const SB = { url: "https://ujrqdmmtcptvimazlhom.supabase.co" };

test("the addon's page failure records the cause and the timing, not just the message", () => {
  const src = bare(WORKER);
  const at = src.indexOf(`aMark("pages", "fail"`);
  assert.ok(at > 0, "the addon's page-failure mark is gone — rescope this guard");
  const line = src.slice(at, src.indexOf("\n", at));
  assert.match(line, /\.\.\.callFailure\(e\)/, "the failure records only the message again — which is all run 45 left behind");
  assert.match(line, /ms: Date\.now\(\) - aPagesT0/, "the failure does not say how long the call had been running — the number that makes 270s falsifiable");
  // AND THE NAME IS IMPORTED, or it is a ReferenceError inside a catch — the
  // one place a throw is hardest to see.
  assert.match(src, /import \{[^}]*\bcallFailure\b[^}]*\} from "\.\/builder\/build-call\.mjs"/, "callFailure is used without being imported");
});
