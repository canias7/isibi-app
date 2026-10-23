// A MARK TAKEN OFF THROUGH THE LOOK DOOR, ON A SITE STILL CARRYING THE OLD
// UPLOAD KEY (2026-10-23, audit A26-2). The look step's merge wiped a removed
// field to null, and `markOf` reads a stored null as "no form" and falls back
// to the legacy `config.logo`, so the uploaded picture stayed in the header
// while the reply said the logo was taken off. Driven through the real Worker
// with the model's answers supplied.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, settle, T } from "./fixtures/request-flow.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { markOf, markWire } from "../builder/site-mark.mjs";

blockNetwork();

const UPLOAD = "https://lmr.gofarther.app/u/logo-abc123.png";
const ICON = "https://lmr.gofarther.app/u/icon-abc123.png";

for (const field of ["wordmark", "favicon"]) {
  test(`LMR1 (${field}) a removal through the look door leaves no legacy upload showing`, async () => {
    const compiler = installCompiler();
    const P = platform({
      slug: "lmr-" + field + "-" + Math.random().toString(16).slice(2, 8), beside: false,
      answers: {
        route: [{ intent: "edit", layer: "look" }],
        [T.pick]: { fields: [field], removes: [field] },
      },
    });
    try {
      // THE OLD PAIR: an upload key beside a look with no form written.
      const cfg = JSON.parse(P.readObj(CONFIG_KEY(P.slug)));
      P.writeObj(CONFIG_KEY(P.slug), JSON.stringify({ ...cfg, logo: UPLOAD, icon: ICON }));
      assert.equal(markOf(JSON.parse(P.readObj(CONFIG_KEY(P.slug))), field).form, "image", "the fixture does not start with the upload showing");
      const r = await sendMessage(P, { message: "Take the " + (field === "wordmark" ? "logo" : "tab icon") + " off." });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      await settle(P, r.key);
      await P.settle();
      const after = JSON.parse(P.readObj(CONFIG_KEY(P.slug)));
      // THE OBSERVER IS ALIVE: the step wrote the field.
      assert.ok(Object.hasOwn(after.look || {}, field), "the look step never wrote " + field + ": " + JSON.stringify(after.look));
      assert.notEqual(markOf(after, field).form, "image", "the legacy upload is still the " + field + ": " + JSON.stringify(after.look[field]));
      const wire = markWire(after);
      assert.ok(!JSON.stringify(wire).includes(field === "wordmark" ? UPLOAD : ICON), "the upload still reaches the container");
    } finally { P.close(); compiler.uninstall(); }
  });
}
