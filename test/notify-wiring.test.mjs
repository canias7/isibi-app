// Does anything actually CALL the thing that emails the owner?
//
// WHY THIS EXISTS. `site-notify.mjs` had correct logic and, after
// `site-data.mjs` was deleted on 2026-07-30, zero callers: every test passed and
// a barber shop took a booking nobody was told about. So the assertion is
// REACHABILITY, not behaviour.
//
// 2026-10-28: the write path is the SITE's own Worker. A visitor's save goes
// through `ownDataWrite` in the site template, which runs the follow-ups
// (`runSiteEffects` → `runEffectsFor` → `notifyOwner`) after a successful
// write, detached, from the table's own settings. The platform's copy is gone.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { shouldNotify } from "../site-notify.mjs";

const T = (p) => fs.readFileSync(new URL("../builder/lovable/template/src/" + p, import.meta.url), "utf8");
const server = T("server.ts");
const effects = T("lib/site-effects.ts");
const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");

test("the site's own save runs the follow-ups, only after the write succeeded", () => {
  const at = server.indexOf("async function ownDataWrite(");
  assert.ok(at > 0, "ownDataWrite is gone — retarget this test");
  const fn = server.slice(at, server.indexOf("\n}\n", at));
  const ok = fn.indexOf("if (r.status >= 200 && r.status < 300)");
  const run = fn.indexOf("runSiteEffects(");
  assert.ok(ok > 0 && run > ok, "the follow-ups do not run, or run before the write is known to have landed");
});

test("it runs detached and cannot fail the submission", () => {
  const at = server.indexOf("async function ownDataWrite(");
  const fn = server.slice(at, server.indexOf("\n}\n", at));
  assert.match(fn, /runSiteEffects\([^;]*\)\.catch\(\(\) => \[\]\)/, "a follow-up failure can fail the visitor's save");
  assert.match(fn, /ctx\.waitUntil\(follow\)/, "the follow-ups are not held past the response");
});

test("the follow-ups reach the owner's notification", () => {
  assert.match(effects, /import \{ notifyOwner, COOLDOWN_MS \} from "\.\/effects\/site-notify\.mjs";/);
  assert.match(effects, /notify: \(r: unknown\) => later\(notifyOwner\(/, "nothing calls notifyOwner");
  assert.match(effects, /export async function runSiteEffects[\s\S]*return runEffectsFor\(/, "the save's follow-ups do not reach the runner");
});

test("only a collect POST notifies — the rule the module already owned", () => {
  assert.equal(shouldNotify({ access: "collect", method: "POST" }), true);
  assert.equal(shouldNotify({ access: "collect", method: "GET" }), false);
  // A member writing their own post, and the owner editing their own menu.
  assert.equal(shouldNotify({ access: "user", method: "POST" }), false);
  assert.equal(shouldNotify({ access: "display", method: "POST" }), false);
});

test("the access level comes from the SCHEMA the site was given, never from the request", () => {
  assert.match(effects, /const def = action \? tableDef\(env, table\) : null;/);
  assert.match(effects, /access: def, method: "POST"/);
});

test("the platform no longer emails anyone about a site's booking", () => {
  assert.ok(!worker.includes("function notifyOwnerOfSubmission("), "the platform's own copy is back");
});
