// PARKED (2026-11-03, park-old-way): the old-way half of test/media-route.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// VIDEO AND AUDIO THROUGH THE REAL ROUTES (2026-10-14, the owner's two-area
// batch): the real Worker, its owner gate and its serving, with R2 as the
// binding behaves (`test/fixtures/r2-media.mjs`) and the sign-in and site
// ownership supplied (`test/fixtures/live-ask.mjs`).
//
// Upload in parts → the library lists it, by kind, with its own allowance →
// it plays: `HEAD`, a range `206`, a seek's suffix range, `416` past the end,
// `304` on its ETag → it is replaced at the same address (a new ETag, so a
// cached copy revalidates) → a page that plays it stops a delete until the
// owner confirms → deleted, it is gone. Before a site exists: kept for the
// account, invisible to another, and moved into the library by the build
// that claims the address, where the page writer is given its address. And
// the edit page step and the add-on writer are shown the library's video
// and audio by address. What these cannot show — a real browser playing and
// seeking — is `test/media-playback.test.mjs`.
import test from "node:test";
import assert from "node:assert/strict";
import { loadWorker, makeCtx } from "../../../test/fixtures/worker-harness.mjs";
import { withWire, envFor, USER } from "../../../test/fixtures/live-ask.mjs";
import { mediaBucket } from "../../../test/fixtures/r2-media.mjs";
import { driveBuild, GOOD_DESIGN, BRIEF, BUILD_USER } from "../../../test/fixtures/build-route.mjs";
import { MEDIA_PART_BYTES, MEDIA_CACHE, mediaLimits } from "../../../site-media.mjs";
import { readFileSync } from "node:fs";

const TOKEN = "Bearer some-token";
const fixture = (n) => new Uint8Array(readFileSync(new URL("../../../test/fixtures/media/" + n, import.meta.url)));

async function call(worker, env, method, path, { body, json, headers = {} } = {}) {
  const init = { method, headers: { Authorization: TOKEN, ...headers } };
  if (json !== undefined) { init.body = JSON.stringify(json); init.headers["content-type"] = "application/json"; }
  if (body !== undefined) { init.body = body; init.headers["content-length"] = String(body.length); }
  const res = await worker.fetch(new Request("https://gofarther.dev" + path, init), env, makeCtx());
  const buf = new Uint8Array(await res.arrayBuffer());
  let parsed = null;
  try { parsed = JSON.parse(new TextDecoder().decode(buf)); } catch { parsed = null; }
  return { status: res.status, headers: res.headers, bytes: buf, body: parsed };
}

/** The page's upload: start, every part, finish — through the real routes. */
async function upload(worker, env, base, bytes, name, extra = {}) {
  const st = await call(worker, env, "POST", base, { json: { name, size: bytes.length, type: "", ...extra } });
  if (st.status >= 300) return { st };
  const parts = [];
  for (let n = 1; n <= st.body.parts; n++) {
    const p = await call(worker, env, "PUT", base + "/" + st.body.session + "/" + n, { body: bytes.subarray((n - 1) * MEDIA_PART_BYTES, n * MEDIA_PART_BYTES) });
    if (p.status >= 300) return { st, p };
    parts.push({ n, etag: p.body.etag });
  }
  const done = await call(worker, env, "POST", base + "/" + st.body.session + "/complete", { json: { parts } });
  return { st, done };
}

test("BUILD: the drafts the message names move into the new site's library, and the page writer is given their addresses", async () => {
  const name = "c".repeat(32) + ".mp4";
  const draft = "drafts/" + BUILD_USER.id + "/" + name;
  let writer = "";
  const r = await driveBuild({
    design: { input: GOOD_DESIGN },
    body: { brief: BRIEF + " Put our bakery tour video on the home page.", images: [], qa: [], chat: "c", media: [name, "f".repeat(32) + ".mp3"] },
    stored: { [draft]: "a small video" },
    onFetch: async (url, init) => {
      if (url.includes("/v1/messages")) {
        const b = JSON.parse(String((init && init.body) || "{}"));
        if (b.tool_choice && b.tool_choice.name === "write_pages") writer = JSON.stringify(b.messages || "");
      }
      return null;
    },
  });
  assert.ok(r.reply, "the build answered nothing");
  assert.ok(r.store.has("uploads/harbour-loaf/" + name), "the draft did not move into the site's library");
  assert.equal(r.store.has(draft), false, "the draft was kept after it moved");
  assert.deepEqual(r.reply.media.placed, [{ name, url: "/u/harbour-loaf/" + name, kind: "video" }]);
  // `file` (2026-10-18): the stored name, so the page can keep a file that may be moved later.
  assert.deepEqual(r.reply.media.missing, [{ name: "f".repeat(32) + ".mp3", file: "f".repeat(32) + ".mp3", why: "it was no longer kept" }]);
  // WHERE THE FILES WENT IS THE WRITER'S OWN REPLY (2026-10-15): it is given
  // the facts — the moved file marked, the missing one with why — and no
  // sentence of ours narrates the move; only the file that could not be
  // moved keeps a fixed technical line.
  assert.doesNotMatch(r.reply.contextNote || "", /is in your site's file library now|were given (its|their) address/, "the build still narrates the move in a fixed sentence");
  assert.equal(r.reply.contextNote, 'Not added to your site\'s file library: "' + "f".repeat(32) + '.mp3" (it was no longer kept).');
  assert.match(r.seen.designer[0], /THE OWNER'S VIDEO AND AUDIO FILES, which go into the site's own library/, "the designer was not told");
  assert.ok(writer, "the page writer was never asked — this case cannot see what it is shown");
  assert.match(writer, new RegExp("/u/harbour-loaf/" + name), "the page writer was not given the address");
  assert.match(writer, /FILES THE OWNER ATTACHED TO THIS REQUEST, moved into the site's file library for it: \\"c{32}\.mp4\\"/, "the writer was not told which file this request moved in");
  assert.match(writer, /In `notes`, tell the owner in your own words where each one is played/, "the writer was not asked to say it in its reply");
  assert.match(writer, /FILES THE OWNER ATTACHED THAT COULD NOT BE ADDED to the site: \\"f{32}\.mp3\\" \(it was no longer kept\)/, "the writer was not told what could not be moved");
});
