// EACH CHAT'S MACHINE ITS OWN LOCK KEY (owner, 2026-11-07, "ok" to the plan:
// step 2). On Fly.io a machine can be reached through Fly's front door; one key
// for all of them meant a chat that read its own could work another chat's.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

const { controlKeySync, controlKeyFor } = await import("../src/coder-control.mjs");
const F = await import("../src/coder-fly.mjs");
const TKEY = "t".repeat(44);

test("CD139 each machine's lock key is an HMAC of its own Fly name under Coder's secret: one machine's key gives nothing for another's; a machine from before keeps the shared one until it updates", async () => {
  const a = await F.flyNames("user-1-shop-a1"), b = await F.flyNames("user-1-shop-b2");
  const ka = await controlKeyFor(TKEY, a.machine), kb = await controlKeyFor(TKEY, b.machine);
  assert.equal(ka, createHmac("sha256", "coder-control-v2|" + TKEY).update("machine:" + a.machine).digest("hex"), "a real HMAC-SHA256");
  assert.match(ka, /^[0-9a-f]{64}$/);
  assert.notEqual(ka, kb, "each machine its own");
  assert.notEqual(ka, controlKeySync(TKEY), "not the old shared key");
  assert.equal(await controlKeyFor(TKEY, a.machine), ka, "the same every time");
  assert.notEqual(await controlKeyFor("u".repeat(44), a.machine), ka, "and only Coder's secret makes it");
  assert.equal(await controlKeyFor("", a.machine), "");
  // Which key a machine is asked with: its own once it was made or updated with it (lock 2), else the shared one.
  const env = { CODER_TOKEN_KEY: TKEY };
  assert.equal(await F.machineLock(env, a.machine, { lock: 2 }), ka);
  assert.equal(await F.machineLock(env, a.machine, {}), controlKeySync(TKEY));
  assert.equal(await F.machineLock(env, a.machine, null), controlKeySync(TKEY));
  assert.equal(await F.machineLock({}, a.machine, { lock: 2 }), "", "no secret, no key");
  // Its settings carry its own key when given one.
  const cfg = F.machineConfig({ CODER_FLY_APP: "a", CODER_FLY_IMAGE: "i", CODER_TOKEN_KEY: TKEY }, "v", { lock: ka });
  assert.equal(cfg.env.CODER_CONTROL_KEY, ka);
  assert.equal(JSON.stringify(cfg).includes(TKEY), false, "never Coder's secret itself");
});

test("CD142 a machine being made or updated (which first fetches Coder's 6.9 GB image) is given 5 minutes to answer; a plain wake 1 minute; a job counts as lost only after 8", async () => {
  const { readFileSync } = await import("node:fs");
  const R = await import("../src/coder-routes.mjs");
  assert.equal(F.FLY_WAKE_MS, 60 * 1000);
  assert.equal(F.FLY_PULL_MS, 5 * 60 * 1000);
  assert.equal(R.START_GRACE_MS, 8 * 60 * 1000);
  assert.ok(R.START_GRACE_MS > F.FLY_PULL_MS, "a start is never counted lost while its machine may still be fetching the image");
  const src = readFileSync(new URL("../src/coder-fly.mjs", import.meta.url), "utf8");
  assert.match(src, /await writeRec\(bucket, names\.key, rec\);\n\s+await untilAnswers\(env, rec\.id, deps, FLY_PULL_MS\);\n\s+return \{ rec \};/, "a new machine");
  assert.match(src, /if \(u\.ok\) \{ rec = \{ \.\.\.rec, image: s\.image, shape, small: u\.small, lock: 2 \}; pulled = true; \}/, "updated: a new image or a new size");
  assert.match(src, /await untilAnswers\(env, rec\.id, deps, pulled \? FLY_PULL_MS : FLY_WAKE_MS\);/, "an updated one; a plain wake as before");
});
