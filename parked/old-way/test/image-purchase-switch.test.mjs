// PARKED (2026-11-03, park-old-way): the old-way half of test/image-purchase-switch.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// THE IMAGE-PURCHASE SWITCH, IN THE EXECUTION PATH (2026-10-11, the owner:
// *"Enforce the image-spending restriction in the execution path rather than
// relying only on wording in the prompt."*). `IMAGE_PURCHASES=off` refuses
// every photograph at `makeSitePhoto`, before anything leaves for the image
// service. Through the real request driver, queue consumer, add-on route and
// picture step, with supplied model answers and a stand-in image service: a
// message asking for a photograph makes NO provider call with the switch off,
// and exactly the usual one with it on (the control). The switch reaches the
// container (`JOB_ENV_NAMES`), the runtime route reports it, and the deploy
// keeps production as it was unless the secret says off.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { platform, sendMessage, settle, call, T } from "../../../test/fixtures/request-flow.mjs";
import { installCompiler } from "../../../test/fixtures/cf-containers.mjs";
import { page as pageSrc } from "../../../test/fixtures/live-ask.mjs";
import { blockNetwork } from "../../../test/fixtures/no-network.mjs";
import { imagePurchasesOn, IMAGE_PURCHASES_OFF } from "../../../builder/site-images.mjs";
import { JOB_ENV_NAMES } from "../../../builder/edit-job.mjs";

blockNetwork();

const slugOf = (k) => "ips-" + k + "-" + Math.random().toString(16).slice(2, 8);
const BENCH = "the workshop bench under the window, warm afternoon light";
const ADD = "add a gallery page with a photo of the workshop bench";
const GALLERY_SRC = "import { createFileRoute } from '@tanstack/react-router'\n"
  + "import { SafeImage } from '@/components/safe-image'\n"
  + "export const Route = createFileRoute('/gallery')({ component: Page })\n"
  + "function Page(){ return <main><h1>Gallery</h1><SafeImage src=\"@@IMG:" + BENCH + "@@\" alt=\"the workshop bench\" ratio=\"4/3\" /><p>Our work, up close.</p></main> }\n";
const PAGES = [{ path: "index.tsx", source: pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1><p>Bread every morning.</p></section>") }];
const BASE = (slug) => ({
  slug, pages: PAGES, images: true, replies: true, balance: 400,
  answers: {
    route: { intent: "addon" },
    [T.adds]: { kinds: ["page", "photo"] },
    "add:page": { page: [{ path: "/gallery", name: "Gallery", purpose: "show our work", sections: ["a photograph"], components: ["card"] }] },
    "add:photo": { photo: [{ page: "/gallery", describe: BENCH, name: "bench" }] },
    [T.pages]: { pages: [{ path: "src/routes/gallery.tsx", source: GALLERY_SRC }] },
  },
});
async function run(slug, off) {
  const compiler = installCompiler();
  const P = platform(BASE(slug));
  try {
    if (off !== undefined) P.env.IMAGE_PURCHASES = off;
    const r = await sendMessage(P, { message: ADD + "." });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const { rec } = await settle(P, r.key);
    const rt = await call(P, "GET", "/api/site/runtime?slug=" + encodeURIComponent(P.slug));
    await P.settle();
    const uploads = [...P.objects.keys()].filter((k) => k.startsWith("uploads/" + P.slug + "/"));
    return { rec, images: P.imageLog.length, uploads, gallery: P.page("gallery.tsx") || "", runtime: rt };
  } finally { P.close(); compiler.uninstall(); }
}

test("IMAGE_PURCHASES=off: an addition asking for a photograph makes no provider call and stores no image; the page is still added; the runtime route says purchases are off", async () => {
  const o = await run(slugOf("off"), "off");
  assert.equal(o.images, 0, "a photograph was asked of the image service with purchases off");
  assert.deepEqual(o.uploads, []);
  assert.ok(o.gallery.includes("<h1>Gallery</h1>"), "the page was not added");
  assert.doesNotMatch(o.gallery, /@@IMG/, "the photo token was left in the page");
  assert.notEqual(o.rec.parts[0].status, "uncertain", "a refused purchase was held as if it might have been made: " + JSON.stringify(o.rec.parts[0]));
  assert.equal(o.runtime.status, 200, JSON.stringify(o.runtime.body));
  assert.equal(o.runtime.body.imagePurchases, false, JSON.stringify(o.runtime.body));
});

test("CONTROL: with the switch unset, and with any value but off, the same message buys its one photograph", async () => {
  for (const v of [undefined, "on"]) {
    const o = await run(slugOf("on"), v);
    assert.equal(o.images, 1, "control (" + v + "): the photograph was not bought");
    assert.equal(o.runtime.status, 200, JSON.stringify(o.runtime.body));
    assert.equal(o.runtime.body.imagePurchases, true);
  }
});
