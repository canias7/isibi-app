// THE TEST COPY (owner, 2026-11-10: "test what we have live without touching the other branches or merging"): the
// deploy button's "test" choice puts the branch picked on its own Worker at test.gofarther.dev, with its own storage,
// machines and queue, and never touches gofarther.dev, its Worker, its keys or its data.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripJsonc, testConfig, TEST } from "../test-copy.mjs";

const LIVE = JSON.parse(stripJsonc(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8")));
const FLOW = readFileSync(new URL("../../.github/workflows/deploy-coder.yml", import.meta.url), "utf8");

test("TC1 (2026-11-10) wrangler.jsonc read as JSON: comments go, never a // or /* inside a string (an address, a key)", () => {
  assert.deepEqual(JSON.parse(stripJsonc('{\n  // a comment\n  "a": "https://x.example/y", /* another */ "b": "say \\"//\\" and /* this */",\n  "c": [1, 2,],\n}\n')), { a: "https://x.example/y", b: 'say "//" and /* this */', c: [1, 2] });
  assert.equal(LIVE.name, "gofarther-coder");
  assert.equal(LIVE.vars.SUPABASE_URL, "https://ujrqdmmtcptvimazlhom.supabase.co");
});

test("TC2 (2026-11-10) the test copy's settings: its own name, address, storage and machines, the page and its machines told the test address; everything else as live; nothing of the live Worker's own", () => {
  const c = testConfig(LIVE);
  assert.deepEqual(TEST, { name: "gofarther-coder-test", host: "test.gofarther.dev", bucket: "gofarther-coder-test", flyApp: "gofarther-coder-test-machines" });
  assert.equal(c.name, "gofarther-coder-test");
  assert.deepEqual(c.routes, [{ pattern: "test.gofarther.dev", custom_domain: true }]);
  assert.deepEqual(c.r2_buckets, [{ binding: "CODER_BUCKET", bucket_name: "gofarther-coder-test" }]);
  assert.deepEqual([c.vars.APP_ORIGIN, c.vars.CODER_PUBLIC_URL, c.vars.CODER_FLY_APP], ["https://test.gofarther.dev", "https://test.gofarther.dev", "gofarther-coder-test-machines"]);
  // Everything else is the live Worker's: the code, the page, the machines' image, the every-minute run, who may use it.
  const rest = (x) => { const { name, routes, r2_buckets, vars, ...o } = x; const { APP_ORIGIN, CODER_PUBLIC_URL, CODER_FLY_APP, ...v } = vars; return { ...o, vars: v }; };
  assert.deepEqual(rest(c), rest(LIVE));
  // The live settings are not changed by it.
  assert.equal(LIVE.name, "gofarther-coder");
  assert.equal(LIVE.r2_buckets[0].bucket_name, "gofarther-coder");
  // Refused: settings that would still share the live Worker's name, storage, address or machines.
  assert.throws(() => testConfig({ ...LIVE, name: "gofarther-coder-test" }), /would share the live Worker's name/);
  assert.throws(() => testConfig({ ...LIVE, r2_buckets: [{ binding: "OTHER", bucket_name: "x" }] }), /no CODER_BUCKET/);
  assert.throws(() => testConfig({ ...LIVE, routes: [{ pattern: "test.gofarther.dev", custom_domain: true }] }), /would share the live Worker's address/);
  assert.throws(() => testConfig(null), /not a Worker's settings/);
});

test("TC3 (2026-11-10) the deploy button: test goes to the test copy in its own queue, every wrangler command of it names the test copy's settings, its keys go only to it; gofarther.dev only from main, as before otherwise", () => {
  assert.match(FLOW, /target:\n\s+description: "live: gofarther\.dev \(from main only\) · test: a separate copy at test\.gofarther\.dev"\n\s+type: choice\n\s+options: \[live, test\]\n\s+default: live/);
  assert.match(FLOW, /group: \$\{\{ github\.event\.inputs\.target == 'test' && 'deploy-coder-test' \|\| 'deploy-coder' \}\}/);
  assert.match(FLOW, /FLY_APP: \$\{\{ github\.event\.inputs\.target == 'test' && 'gofarther-coder-test-machines' \|\| 'gofarther-coder-machines' \}\}/);
  assert.match(FLOW, /BUCKET: \$\{\{ github\.event\.inputs\.target == 'test' && 'gofarther-coder-test' \|\| 'gofarther-coder' \}\}/);
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
