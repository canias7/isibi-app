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
