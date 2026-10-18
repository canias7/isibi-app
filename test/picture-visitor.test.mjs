// AUDIT A03-2 (2026-10-18): THE PICTURE STEP OFFERED A VISITOR'S FORM UPLOAD
// AS ONE OF "THE PHOTOGRAPHS THE OWNER HAS UPLOADED". A site whose form takes
// a picture keeps strangers' files under the same upload prefix, marked
// `visitor`; the share picker and the conversation already left them out, the
// picture step's library did not. Driven through the real edit route: the
// request the picture model is sent names the owner's photo and never the
// visitor's.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, settle } from "./fixtures/request-flow.mjs";
import { PAGES } from "./fixtures/live-ask.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";

blockNetwork();

const OWNER = "1111111111111111111111111111111111111111111111111111111111111111.jpg";
const VISITOR = "2222222222222222222222222222222222222222222222222222222222222222.jpg";
// A HOME PAGE WITH A HERO PHOTOGRAPH, so the step has a slot to fill.
const HERO = "import { createFileRoute } from '@tanstack/react-router';\nexport const Route = createFileRoute('/')({ component: Page });\nfunction Page() { return (<main><section><img src=\"https://images.example.com/hero.jpg\" alt=\"Loaves on the counter\" /><h1>Fold Lane</h1></section></main>); }\n";
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1]);

test("PV1 A VISITOR'S FORM UPLOAD IS NEVER OFFERED TO THE PICTURE STEP AS THE OWNER'S PHOTOGRAPH — the owner's photo is offered, the stranger's is not", async () => {
  const compiler = installCompiler();
  const asked = [];
  const slug = "pv1-" + Math.random().toString(16).slice(2, 8);
  const P = platform({
    slug, balance: 100, pages: [{ path: "index.tsx", source: HERO }, ...PAGES.filter((p) => p.path !== "index.tsx")],
    answers: {
      route: { intent: "edit", layer: "picture", targets: [{ change: 0, writes: ["picture"] }] },
      choose_pictures: (args) => { asked.push(JSON.stringify(args.messages)); return { pictures: [] }; },
    },
  });
  try {
    await P.env.SITES_BUCKET.put("uploads/" + slug + "/" + OWNER, JPEG, { httpMetadata: { contentType: "image/jpeg" } });
    await P.env.SITES_BUCKET.put("uploads/" + slug + "/" + VISITOR, JPEG, { httpMetadata: { contentType: "image/jpeg" }, customMetadata: { visitor: "1" } });
    const r = await sendMessage(P, { message: "Use one of my uploaded photos for the hero." });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    await settle(P, r.key, { rounds: 20 });
    assert.ok(asked.length > 0, "the picture model was never asked — this case watched nothing");
    const said = asked.join("\n");
    assert.ok(said.includes(OWNER), "the owner's own photo was not offered");
    assert.ok(!said.includes(VISITOR), "a visitor's form upload was offered as the owner's photograph");
  } finally { await P.settle(); P.close(); compiler.uninstall(); }
});
