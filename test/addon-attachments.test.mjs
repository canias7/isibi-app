// A LEGACY ADD-ON POST THAT CARRIES ATTACHMENTS, TAKEN ON AS A REQUEST WITH
// ITS FILES (2026-10-09, parallel round 8).
//
// Round 7 took an addition posted straight to `/api/site/<slug>/addon` on as a
// one-part request — except a post with attachments, which stayed a job of its
// own and kept no automatic recovery. Now the post carries its files (as the
// routing call does) and they are kept with the request through the existing
// storage (`storeRequestFiles`), so every job of the request, its questions and
// its later parts have them with no page open. A post that only SAYS files came
// with it (an older page) is taken on with that fact, and the add-on step's
// picker is told the files never arrived: it may ask for them through its own
// question, and an answer that brings them joins the request's files.
//
// Through the REAL Worker (its routes, queue consumer, request driver and
// cron, `test/fixtures/request-flow.mjs`), with the network blocked. Each case
// checks the files, the final page, the statuses, provider calls, publication
// and accounting.
//
// ⚠ SUPPLIED-MODEL, STAND-IN-SERVICE PROOF ONLY.

import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, settle, tick, pump, call, browserBody, T } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";
import { blockNetwork, unexpected } from "./fixtures/no-network.mjs";

blockNetwork();

const slugOf = (k) => "att-" + k + "-" + Math.random().toString(16).slice(2, 8);
const statuses = (rec) => rec.parts.map((p) => p.status);
const reserveOf = (P, jobId) => P.ledger.filter((e) => e.ref.startsWith(jobId + "#") && e.reason === "reserve").map((e) => -e.delta);
const uploads = (P) => [...P.objects.keys()].filter((k) => k.startsWith("uploads/" + P.slug + "/"));
const purchases = (P) => [...P.objects.entries()].filter(([k]) => k.includes("/purchases/")).map(([, o]) => JSON.parse(o.body));
const calls = (P, tool) => P.modelLog.filter((m) => m.tool === tool).length;
const isUpload = (P) => (k) => k.startsWith("uploads/" + P.slug + "/");
const addonJobs = (P, key) => P.jobsOf(key).filter((j) => j.op === "addon");
const key32 = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const PNG_BYTES = 70;
const JPG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHSEeHx4dGhwcICQuJyAiLCMcHCg3KSwwMTQ0NB8nOT04MjwuMzQy/9k=";
const FILES = [{ name: "shopfront.png", data: PNG }, { name: "bench.jpg", data: JPG }];

const HOME = pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1><p>Bread from the harbour, every morning.</p></section>");
const VISIT = pageSrc("/visit", "<section className=\"come\"><h1>Come to the bakery</h1><p>The street.</p></section>");
const PAGES = [{ path: "index.tsx", source: HOME }, { path: "visit.tsx", source: VISIT }];
const ADD = "add a gallery page with a photo of the workshop bench, in the style of the pictures I attached";
const BENCH = "the workshop bench under the window, warm afternoon light";
const TOKEN = "@@IMG:" + BENCH + "@@";
const HEAD = "import { createFileRoute } from '@tanstack/react-router'\n"
  + "import { SafeImage } from '@/components/safe-image'\n"
  + "export const Route = createFileRoute('/gallery')({ component: Page })\n";
const GALLERY = HEAD + "function Page(){ return <main><h1>Gallery</h1><SafeImage src={\"" + TOKEN + "\"} alt=\"the workshop bench\" ratio=\"4/3\" /><p>Our work, up close.</p></main> }\n";
const MARK = /"" \/\*pending-photo:([0-9a-f]{24})\*\//;
const PLACED = /<SafeImage src=\{"\/u\/[^"]+\.jpg"\} alt="the workshop bench"/;
const ASK_FILES = { text: "Your pictures didn't come through — could you attach them again?", options: ["I'll attach them", "Go ahead without them"] };
const gallery = (P) => P.page("gallery.tsx") || "";

/** The supplied answers; the picker's every request is kept, to read what it was told. */
const BASE = (picked, o = {}) => ({
  pages: PAGES, images: true, replies: true, balance: 400,
  answers: {
    route: [{ intent: "addon", answered: true }],
    [T.adds]: (args, n) => { picked.push(JSON.stringify(args.messages)); return typeof o.pick === "function" ? o.pick(n) : { kinds: ["page", "photo"] }; },
    "add:page": { page: [{ path: "/gallery", name: "Gallery", purpose: "show our work", sections: ["a photograph"], components: ["card"] }] },
    "add:photo": { photo: [{ page: "/gallery", describe: BENCH, name: "bench" }] },
    [T.pages]: { pages: [{ path: "src/routes/gallery.tsx", source: GALLERY }] },
  },
});

async function withPlatform(opts, fn) {
  const compiler = installCompiler();
  const P = platform(opts);
  try {
    const out = await fn(P);
    await P.settle();
    assert.deepEqual(P.unexpected, [], "requests the stand-ins were not set up for");
    return out;
  } finally { P.close(); compiler.uninstall(); }
}
const post = (P, body) => call(P, "POST", "/api/site/" + P.slug + "/addon", body);

test("AT 4 — FILES THAT WOULD NOT ALL BE KEPT ARE NEVER A REQUEST THAT LOST SOME: a post whose attachment does not read stays a job of its own, and nothing is kept under any request", async () => {
  const picked = [];
  await withPlatform({ slug: slugOf("bad"), ...BASE(picked) }, async (P) => {
    const idem = key32();
    const a = await post(P, { instruction: ADD, picker: "sonnet", idem, tz: "Europe/London", attached: true, images: [FILES[0], { name: "broken.png", data: "not a data url" }] });
    assert.equal(a.status, 202, JSON.stringify(a.body));
    assert.ok(typeof a.body.job === "string" && !a.body.request, JSON.stringify(a.body));
    assert.equal(P.record(idem), null);
    assert.deepEqual([...P.objects.keys()].filter((k) => k.includes("/files/")), []);
    await pump(P);
  });
});

test("AT 5 — THE REQUEST FLOW DELIBERATELY OFF STAYS DISTINCT: a post with files is a job of its own, as before — no request, no files kept for one; the supported default (the flow on) is the request of AT 1", async () => {
  const picked = [];
  await withPlatform({ slug: slugOf("off"), ...BASE(picked) }, async (P) => {
    P.env.REQUEST_FLOW = "off";
    const idem = key32();
    const a = await post(P, { instruction: ADD, picker: "sonnet", idem, tz: "Europe/London", attached: true, images: FILES });
    assert.equal(a.status, 202, JSON.stringify(a.body));
    assert.ok(typeof a.body.job === "string" && !a.body.request, JSON.stringify(a.body));
    assert.equal(P.record(idem), null);
    assert.deepEqual([...P.objects.keys()].filter((k) => k.includes("/files/")), []);
    await pump(P);
  });
});

test("AT 6 — THE PAGE'S OWN POST CARRIES THE FILES: `siteAddon` (cut from public/chat.js) sends the files themselves beside `attached`, as the routing call does, so the server can keep them; with none it sends neither", () => {
  const site = { slug: "harbour-loaf", name: "Harbour Loaf", react: true, pages: [{ path: "/" }], msgs: [] };
  const withFiles = browserBody(site, { intent: "addon" }, ADD, FILES);
  assert.equal(withFiles.url, "/api/site/harbour-loaf/addon");
  assert.equal(withFiles.body.attached, true);
  assert.deepEqual(withFiles.body.images, FILES);
  const none = browserBody(site, { intent: "addon" }, ADD, []);
  assert.equal(none.body.attached, undefined);
  assert.equal(none.body.images, undefined);
});

// ── ROUND 9: EVERY FILE MUST READ, OR NONE IS KEPT AS IF IT WERE ALL ─────────
//
// Codex's reproduction: a valid file beside `data:image/png;base64,AAAAA` was
// taken on as a request holding ONE file — the second matched the data-URL
// pattern, failed to decode, and was skipped by the store without a word.
const BROKEN = { name: "broken.png", data: "data:image/png;base64,AAAAA" };
const filesKept = (P) => [...P.objects.keys()].filter((k) => k.includes("/files/"));
const b64Of = (d) => d.slice(d.indexOf(",") + 1).replace(/\s+/g, "");

test("AT 7 — CODEX'S REPRODUCTION, A VALID FILE BESIDE ONE THAT DOES NOT DECODE: never a request holding fewer files than it was sent — the post stays a job of its own (the existing fallback), nothing is kept under any request, and no partial file list is recorded anywhere", async () => {
  await withPlatform({ slug: slugOf("mixed"), ...BASE([]) }, async (P) => {
    const idem = key32();
    const a = await post(P, { instruction: ADD, picker: "sonnet", idem, tz: "Europe/London", attached: true, images: [FILES[0], BROKEN] });
    assert.equal(a.status, 202, JSON.stringify(a.body));
    assert.ok(typeof a.body.job === "string" && !a.body.request, "taken on as a request that lost a file: " + JSON.stringify(a.body));
    assert.equal(P.record(idem), null);
    assert.deepEqual(filesKept(P), []);
    await pump(P);
  });
});

test("AT 8 — EVERY FILE MALFORMED: the same — a job of its own, nothing kept, never a request that says it carries files it has none of", async () => {
  await withPlatform({ slug: slugOf("allbad"), ...BASE([]) }, async (P) => {
    const idem = key32();
    const a = await post(P, { instruction: ADD, picker: "sonnet", idem, tz: "Europe/London", attached: true, images: [BROKEN, { name: "two.jpg", data: "data:image/jpeg;base64,@@@@" }] });
    assert.equal(a.status, 202, JSON.stringify(a.body));
    assert.equal(P.record(idem), null);
    assert.deepEqual(filesKept(P), []);
    await pump(P);
  });
});

test("AT 9 — INVALID PADDING AND LENGTH, each beside a valid file: a lone extra character, missing padding, padding in the middle, too much padding, nothing after the comma, no Base64 marker — every one leaves the post a job with nothing kept", async () => {
  const bad = {
    "length 4n+1": "data:image/png;base64,AAAAA",
    "no padding": "data:image/png;base64,AAA",
    "padding inside": "data:image/png;base64,AA=AAAAA",
    "too much padding": "data:image/png;base64,A===",
    "padding past a quad": "data:image/png;base64,AAAA=",
    "empty": "data:image/png;base64,",
    "not base64": "data:image/png,AAAA",
  };
  await withPlatform({ slug: slugOf("pad"), ...BASE([]) }, async (P) => {
    for (const [what, data] of Object.entries(bad)) {
      const idem = key32();
      const a = await post(P, { instruction: ADD, picker: "sonnet", idem, tz: "Europe/London", attached: true, images: [FILES[0], { name: "x.png", data }] });
      assert.equal(a.status, 202, what + ": " + JSON.stringify(a.body));
      assert.ok(!a.body.request, what + ": taken on as a request");
      assert.equal(P.record(idem), null, what);
    }
    assert.deepEqual(filesKept(P), []);
    await pump(P, { max: 20 });
  });
});

test("AT 10 — VALID FILES IN THE SUPPORTED FORMATS, WITH LINE BREAKS AND SPACES IN THEIR BASE64: every one is kept, byte for byte what its Base64 decodes to, under its own type and name", async () => {
  const wrap = (d) => { const i = d.indexOf(",") + 1; const b = d.slice(i); return d.slice(0, i) + b.replace(/(.{8})/g, "$1\n ").trim(); };
  const WEBP = "data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==";
  const GIF = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
  const PDF = "data:application/pdf;base64,JVBERi0xLjQKJcOkw7zDtsOfCg==";
  const sets = [
    [{ name: "a.png", data: wrap(PNG) }, { name: "b.jpg", data: wrap(JPG) }, { name: "c.webp", data: WEBP }],
    [{ name: "d.gif", data: GIF.replace(",", ",\t \r\n") }, { name: "e.pdf", data: wrap(PDF) }],
  ];
  await withPlatform({ slug: slugOf("formats"), ...BASE([]) }, async (P) => {
    for (const set of sets) {
      const idem = key32();
      const a = await post(P, { instruction: ADD, picker: "sonnet", idem, tz: "Europe/London", attached: true, images: set });
      assert.equal(a.status, 200, JSON.stringify(a.body));
      const rec = P.record(idem);
      assert.equal(rec.files.length, set.length, JSON.stringify(rec.files));
      set.forEach((f, i) => {
        const kept = rec.files[i];
        assert.equal(kept.name, f.name);
        assert.equal(kept.type, f.data.slice(5, f.data.indexOf(";")));
        const want = Buffer.from(b64Of(f.data), "base64");
        assert.deepEqual(Buffer.from(P.objects.get(kept.key).body), want, f.name + ": the kept bytes are not what its Base64 decodes to");
        assert.equal(kept.bytes, want.length);
      });
    }
  });
});

test("NET — no request in this file left the machine", () => {
  assert.deepEqual(unexpected().filter((u) => u.by === "blocked"), []);
});
