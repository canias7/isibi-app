// THE TEST COPIES (owner, 2026-11-10: "test what we have live without touching the other branches or merging"): the
// deploy button's "test" choice puts the branch picked on its own Worker at test.gofarther.dev, and "jessica" on its own at
// jessica.gofarther.dev (two since the Gloopy and connectors work were merged, 2026-11-13), each with its own storage,
// machines and queue, never touching gofarther.dev, its Worker, its keys or its data, nor each other.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripJsonc, testConfig, TEST, COPIES } from "../test-copy.mjs";

const LIVE = JSON.parse(stripJsonc(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8")));
const FLOW = readFileSync(new URL("../../.github/workflows/deploy-coder.yml", import.meta.url), "utf8");

test("TC1 (2026-11-10) wrangler.jsonc read as JSON: comments go, never a // or /* inside a string (an address, a key)", () => {
  assert.deepEqual(JSON.parse(stripJsonc('{\n  // a comment\n  "a": "https://x.example/y", /* another */ "b": "say \\"//\\" and /* this */",\n  "c": [1, 2,],\n}\n')), { a: "https://x.example/y", b: 'say "//" and /* this */', c: [1, 2] });
  assert.equal(LIVE.name, "gofarther-coder");
  assert.equal(LIVE.vars.SUPABASE_URL, "https://ujrqdmmtcptvimazlhom.supabase.co");
});

test("TC2 (2026-11-10; two copies since 2026-11-13) each test copy's settings: its own name, address, storage and machines, the page and its machines told its address; everything else as live; nothing of the live Worker's own, nor of the other copy's", () => {
  assert.deepEqual(COPIES, {
    test: { name: "gofarther-coder-test", host: "test.gofarther.dev", bucket: "gofarther-coder-test", flyApp: "gofarther-coder-test-machines" },
    jessica: { name: "gofarther-coder-jessica", host: "jessica.gofarther.dev", bucket: "gofarther-coder-jessica", flyApp: "gofarther-coder-jessica-machines" },
  });
  assert.equal(TEST, COPIES.test);
  // Everything else is the live Worker's: the code, the page, the machines' image, the every-minute run, who may use it.
  const rest = (x) => { const { name, routes, r2_buckets, vars, ...o } = x; const { APP_ORIGIN, CODER_PUBLIC_URL, CODER_FLY_APP, ...v } = vars; return { ...o, vars: v }; };
  for (const [which, k] of Object.entries(COPIES)) {
    const c = testConfig(LIVE, k);
    assert.equal(c.name, k.name, which);
    assert.deepEqual(c.routes, [{ pattern: k.host, custom_domain: true }], which);
    assert.deepEqual(c.r2_buckets, [{ binding: "CODER_BUCKET", bucket_name: k.bucket }], which);
    assert.deepEqual([c.vars.APP_ORIGIN, c.vars.CODER_PUBLIC_URL, c.vars.CODER_FLY_APP], ["https://" + k.host, "https://" + k.host, k.flyApp], which);
    assert.deepEqual(rest(c), rest(LIVE), which);
  }
  // With no copy named: test.gofarther.dev. The two copies share nothing of each other's.
  assert.equal(testConfig(LIVE).name, "gofarther-coder-test");
  for (const f of ["name", "host", "bucket", "flyApp"]) assert.notEqual(COPIES.test[f], COPIES.jessica[f], f);
  // Only the two copies: anything else is refused.
  assert.throws(() => testConfig(LIVE, { name: "gofarther-coder", host: "gofarther.dev", bucket: "gofarther-coder", flyApp: "gofarther-coder-machines" }), /not one of the test copies/);
  const c = testConfig(LIVE, COPIES.jessica);
  // The live settings are not changed by it.
  assert.equal(LIVE.name, "gofarther-coder");
  assert.equal(LIVE.r2_buckets[0].bucket_name, "gofarther-coder");
  // Refused: settings that would still share the live Worker's name, storage, address or machines.
  assert.throws(() => testConfig({ ...LIVE, name: "gofarther-coder-jessica" }, COPIES.jessica), /would share the live Worker's name/);
  assert.throws(() => testConfig({ ...LIVE, name: "gofarther-coder-test" }), /would share the live Worker's name/);
  assert.throws(() => testConfig({ ...LIVE, r2_buckets: [{ binding: "OTHER", bucket_name: "x" }] }), /no CODER_BUCKET/);
  assert.throws(() => testConfig({ ...LIVE, routes: [{ pattern: "jessica.gofarther.dev", custom_domain: true }] }, COPIES.jessica), /would share the live Worker's address/);
  assert.throws(() => testConfig({ ...LIVE, routes: [{ pattern: "test.gofarther.dev", custom_domain: true }] }), /would share the live Worker's address/);
  assert.ok(c);
  assert.throws(() => testConfig(null), /not a Worker's settings/);
});

test("TC3 (2026-11-10; two copies since 2026-11-13) the deploy button: test and jessica each go to their own copy in their own queue, every wrangler command of them names the copy's settings, their keys go only to it; gofarther.dev only from main, as before otherwise", () => {
  assert.match(FLOW, /target:\n\s+description: "live: gofarther\.dev \(from main only\) · test: the copy at test\.gofarther\.dev · jessica: the copy at jessica\.gofarther\.dev"\n\s+type: choice\n\s+options: \[live, test, jessica\]\n\s+default: live/);
  assert.match(FLOW, /group: \$\{\{ github\.event\.inputs\.target == 'test' && 'deploy-coder-test' \|\| github\.event\.inputs\.target == 'jessica' && 'deploy-coder-jessica' \|\| 'deploy-coder' \}\}/);
  assert.match(FLOW, /TARGET: \$\{\{ \(github\.event\.inputs\.target == 'test' \|\| github\.event\.inputs\.target == 'jessica'\) && 'test' \|\| 'live' \}\}/);
  assert.match(FLOW, /COPY: \$\{\{ github\.event\.inputs\.target == 'jessica' && 'jessica' \|\| 'test' \}\}/);
  assert.match(FLOW, /FLY_APP: \$\{\{ github\.event\.inputs\.target == 'test' && 'gofarther-coder-test-machines' \|\| github\.event\.inputs\.target == 'jessica' && 'gofarther-coder-jessica-machines' \|\| 'gofarther-coder-machines' \}\}/);
  assert.match(FLOW, /BUCKET: \$\{\{ github\.event\.inputs\.target == 'test' && 'gofarther-coder-test' \|\| github\.event\.inputs\.target == 'jessica' && 'gofarther-coder-jessica' \|\| 'gofarther-coder' \}\}/);
  assert.match(FLOW, /SITE: \$\{\{ github\.event\.inputs\.target == 'test' && 'https:\/\/test\.gofarther\.dev' \|\| github\.event\.inputs\.target == 'jessica' && 'https:\/\/jessica\.gofarther\.dev' \|\| 'https:\/\/coder\.gofarther\.dev' \}\}/);
  // The copy's own settings are made for the copy picked.
  assert.match(FLOW, /- name: "Test copy: its own settings \(from wrangler\.jsonc\)"\n\s+if: env\.TARGET == 'test'\n\s+run: node test-copy\.mjs "\$COPY"/);
  assert.match(FLOW, /- name: "gofarther\.dev only from main"\n\s+if: env\.TARGET == 'live' && github\.ref_name != 'main'/);
  // The live Worker's own steps run only for live.
  assert.match(FLOW, /- name: "Fly\.io: give the Worker the token"\n\s+if: steps\.fly\.outputs\.on == 'true' && env\.TARGET == 'live'/);
  assert.match(FLOW, /- name: Deploy Coder\n\s+if: env\.TARGET == 'live'\n\s+uses: cloudflare\/wrangler-action@v3/);
  // The test copy's steps: each wrangler command names wrangler.test.json.
  const testSteps = FLOW.split(/\n      - name: /).filter((x) => /^"Test copy:/.test(x));
  assert.equal(testSteps.length, 3);
  for (const step of testSteps) {
    assert.match(step, /\n\s+if: env\.TARGET == 'test'/);
    for (const line of step.split("\n").filter((l) => /wrangler@/.test(l))) assert.match(line, /--config wrangler\.test\.json/, line);
  }
  assert.match(testSteps[2], /npx --yes wrangler@4\.107\.0 secret bulk "\$f" --config wrangler\.test\.json\n\s+rm -f "\$f"/);
  // Nothing else in the deploy calls wrangler on the live Worker for a test (the bucket step names its own bucket).
  assert.match(FLOW, /r2 bucket create "\$BUCKET"/);
  assert.match(FLOW, /curl -fsS "\$SITE\/health"/);
  // The test copy's settings are never kept in git.
  assert.match(readFileSync(new URL("../.gitignore", import.meta.url), "utf8"), /^wrangler\.test\.json$/m);
});
