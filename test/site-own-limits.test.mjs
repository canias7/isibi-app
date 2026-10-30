// The site's own writes and sign-in carry the guards the platform used to put
// in front of them (2026-10-28): writes and sign-in tries are rate-limited.
// (The checkout's, connections' and owner email's guards went with them on
// 2026-10-29.)
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadTemplate } from "./fixtures/template-ts.mjs";

const T = (p) => fs.readFileSync(new URL("../builder/lovable/template/src/" + p, import.meta.url), "utf8");
const W = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");

test("writes and sign-in tries are rate-limited by the site; reads are not", () => {
  const S = T("server.ts");
  const w = S.slice(S.indexOf("export async function ownDataWrite("), S.indexOf("\n}\n", S.indexOf("export async function ownDataWrite(")));
  assert.match(w, /const wait = tooMany\("write\|" \+ visitorIp\(request\), 60\);\s*if \(wait\) return limited\(wait\);/);
  const a = S.slice(S.indexOf("export async function ownAuth("), S.indexOf("\n}\n", S.indexOf("export async function ownAuth(")));
  assert.match(a, /if \(request\.method !== "GET" && request\.method !== "HEAD"\) \{\s*const wait = tooMany\("auth\|" \+ visitorIp\(request\), 20\);/);
  assert.match(a, /path\.split\("\/"\)\.includes\("\.\."\)\) return null;/, "a stepping-back path is not refused by the site itself");
});

test("the limiter refuses past its ceiling and resets per visitor", async () => {
  const { tooMany } = await loadTemplate("lib/site-limit.ts");
  for (let i = 0; i < 3; i++) assert.equal(tooMany("k|a", 3), 0);
  assert.ok(tooMany("k|a", 3) > 0, "the fourth try passed");
  assert.equal(tooMany("k|b", 3), 0, "another visitor was refused");
});

