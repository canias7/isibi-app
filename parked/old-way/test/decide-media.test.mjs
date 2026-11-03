// PARKED (2026-11-03, park-old-way): the old-way half of test/decide-media.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// THE OWNER'S CHOSEN OPTIONS FOR AUDIT FINDINGS 20, 22, 23, 24 AND 25
// (2026-10-23; docs/history/2026-10-23-decide-media.md).
import test from "node:test";
import assert from "node:assert/strict";
import { qrCodesOnHost, qrForgetRefusal } from "../../../builder/site-qr-list.mjs";
import { runNavEdit, navSlots, NAV_TOOL } from "../../../builder/site-nav.mjs";

// ── 20 (#115, A10-4): a draft file moved into the site before the edit ─────
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { loadWorker, makeCtx } from "../../../test/fixtures/worker-harness.mjs";
import { withWire, envFor, USER } from "../../../test/fixtures/live-ask.mjs";
import { mediaBucket } from "../../../test/fixtures/r2-media.mjs";
import { MEDIA_PART_BYTES } from "../../../site-media.mjs";
const SiteMedia = createRequire(import.meta.url)("../../../public/site-media.js");
const mfix = (n) => new Uint8Array(readFileSync(new URL("../../../test/fixtures/media/" + n, import.meta.url)));
async function mcall(worker, env, method, path, { body, json } = {}) {
  const init = { method, headers: { Authorization: "Bearer some-token" } };
  if (json !== undefined) { init.body = JSON.stringify(json); init.headers["content-type"] = "application/json"; }
  if (body !== undefined) { init.body = body; init.headers["content-length"] = String(body.length); }
  const res = await worker.fetch(new Request("https://gofarther.dev" + path, init), env, makeCtx());
  let parsed = null;
  try { parsed = JSON.parse(await res.text()); } catch { parsed = null; }
  return { status: res.status, body: parsed };
}
async function mupload(worker, env, base, bytes, name) {
  const st = await mcall(worker, env, "POST", base, { json: { name, size: bytes.length, type: "" } });
  const parts = [];
  for (let n = 1; n <= st.body.parts; n++) {
    const p = await mcall(worker, env, "PUT", base + "/" + st.body.session + "/" + n, { body: bytes.subarray((n - 1) * MEDIA_PART_BYTES, n * MEDIA_PART_BYTES) });
    parts.push({ n, etag: p.body.etag });
  }
  return mcall(worker, env, "POST", base + "/" + st.body.session + "/complete", { json: { parts } });
}

// ── 22 (#162, A25-1): a photo attached to a message is stored and offered first
import { jobBody } from "../../../builder/request.mjs";
import { storeAttachedPhotos, attachedFirst } from "../../../builder/attached-photos.mjs";
import { pictureRequest } from "../../../builder/site-picture.mjs";
import { attachments } from "../../../builder/site-context.mjs";
const PNG = "data:image/png;base64,iVBORw0KGgo=";

test("the picture rung stores the message's photos and puts them first in its library", () => {
  const src = readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  const at = src.indexOf('if (eLayer === "picture") {');
  assert.ok(at > 0);
  const end = src.indexOf("runPictureEdit({", at);
  const lib = src.indexOf("library: async () => {", end);
  assert.ok(end > 0 && lib > 0);
  assert.match(src.slice(at, end), /storeAttachedPhotos\(/, "the rung does not store the attached photos");
  assert.match(src.slice(lib, lib + 1200), /attachedFirst\(picAttached\.files,/, "the library does not list them first");
});

// ── 23 (#168, A26-4): a logo attached to the first build goes in the header ─
import { driveBuild, GOOD_DESIGN, BRIEF, JPEG_DATA } from "../../../test/fixtures/build-route.mjs";
import { ownLogoSentence } from "../../../builder/attached-photos.mjs";
const buildBody = (extra = {}) => ({ brief: BRIEF, images: [], qa: [], chat: "c", ...extra });

// ── 24 (#173, A27-7): a menu change about one page applies only there ───────
const navPage = (p, links) => ({
  path: "src/routes/" + p,
  source: `import { SiteChrome } from "@/components/ui/site-chrome";\nexport default function P() {\n  return (\n    <SiteChrome name="Kiln" links={[${links}]}>\n      <h1>Hello</h1>\n    </SiteChrome>\n  );\n}\n`,
});
const NAV_ROUTES = ["/", "/menu", "/status"];
const FULL = `{ label: "Home", href: "/" }, { label: "Menu", href: "/menu" }, { label: "Status", href: "/status" }`;
const navSays = (input) => ({ send: async () => ({ content: [{ type: "tool_use", input }], usage: { input_tokens: 1, output_tokens: 1 } }) });
const menuOf = (pages, file) => navSlots(pages.filter((p) => p.path.endsWith(file)))[0].items.map((i) => i.label);
