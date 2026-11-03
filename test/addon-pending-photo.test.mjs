// AN ADDITION'S UNFINISHED PHOTOGRAPHS, KEPT AS PENDING WORK (2026-10-09,
// parallel round 5).
//
// Until now an addition whose photograph's purchase could not be told was
// published with an empty frame, its part ended partial, and the photograph
// was never placed: the customer had to ask again. Now the frame is published
// MARKED with the purchase it waits on, the part is held on it, and once the
// purchase is known a placement step fills that frame with that photograph —
// the addition is never made again, nothing is bought again on a guess, and
// nothing has to be sent again. An independent part carries on meanwhile.
//
// Through the real request driver, queue consumer, add-on route and picture
// step, with supplied model answers and a stand-in image service, on a wire
// that refuses anything it was not set up for. Each case asserts separately:
// the provider's calls, the addition's own model calls (never repeated), the
// publishes, the page, the task states and what was charged.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, settle, tick, pump, call, readWritten, T } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";
import { blockNetwork, unexpected } from "./fixtures/no-network.mjs";

blockNetwork();

const slugOf = (k) => "ap-" + k + "-" + Math.random().toString(16).slice(2, 8);
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
const statuses = (rec) => rec.parts.map((p) => p.status);
const reserveOf = (P, jobId) => P.ledger.filter((e) => e.ref.startsWith(jobId + "#") && e.reason === "reserve").map((e) => -e.delta);
const uploads = (P) => [...P.objects.keys()].filter((k) => k.startsWith("uploads/" + P.slug + "/"));
const purchases = (P) => [...P.objects.entries()].filter(([k]) => k.includes("/purchases/")).map(([, o]) => JSON.parse(o.body));
const jobsOfPart = (P, key, n) => P.jobsOf(key).filter((j) => j.idem_key.startsWith(key + "-p" + n + "-"));
const runJobs = (P, key, n) => jobsOfPart(P, key, n).filter((j) => !/\/api\/site\/route(?![\w/-])/.test(String(P.bodyOf(j.id) ? P.bodyOf(j.id).url : "")));
const publishedOf = (P, key, n) => jobsOfPart(P, key, n).filter((j) => j.published_at).length;
const reservesOf = (P, key, n) => runJobs(P, key, n).map((j) => reserveOf(P, j.id));
const calls = (P, tool) => P.modelLog.filter((m) => m.tool === tool).length;
const isUpload = (P) => (k) => k.startsWith("uploads/" + P.slug + "/");
const buyAgain = (P, key, n) => call(P, "POST", "/api/site/request/" + P.slug + "/" + key + "/buy-again", { part: n });

const TIKTOK_LINE = "Follow us on TikTok at @oldloaf";
const TIKTOK_TO = "Follow us on TikTok at @harbourloaf";
const VISIT_TT = pageSrc("/visit", "<section className=\"come\"><h1>Come to the bakery</h1><p>" + TIKTOK_LINE + "</p></section>");
const HOME = pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1><p>Bread from the harbour, every morning.</p></section>");
const PAGES = [{ path: "index.tsx", source: HOME }, { path: "visit.tsx", source: VISIT_TT }];
const TIKTOK = "Change our TikTok link on the Visit page to @harbourloaf";
const ADD = "add a gallery page with a photo of the workshop bench";
const BENCH = "the workshop bench under the window, warm afternoon light";
const MSG = TIKTOK + ", and " + ADD + ".";
const GALLERY_SRC = "import { createFileRoute } from '@tanstack/react-router'\n"
  + "import { SafeImage } from '@/components/safe-image'\n"
  + "export const Route = createFileRoute('/gallery')({ component: Page })\n"
  + "function Page(){ return <main><h1>Gallery</h1><SafeImage src=\"@@IMG:" + BENCH + "@@\" alt=\"the workshop bench\" ratio=\"4/3\" /><p>Our work, up close.</p></main> }\n";
const lineId = (args, file, line) => {
  const at = String(args.messages[0].content).split("\n").find((l) => l.includes("[" + file + "] " + line));
  return Number(String(at || "-1.").split(".")[0]);
};
const ROUTES = [
  { intent: "edit", layer: "text", page: "/visit", alsoAsked: [ADD], targets: [{ change: 0, writes: ["page:/visit"] }, { change: 1, writes: ["page:/gallery", "images"] }] },
  { intent: "addon" },
];
const BASE = (o = {}) => ({
  pages: PAGES, images: true, replies: true, balance: 400,
  answers: {
    route: (args, n) => ROUTES[Math.min(n, 1)],
    [T.text]: (args) => ({ edits: [{ id: lineId(args, "visit.tsx", TIKTOK_LINE), to: TIKTOK_TO }] }),
    [T.adds]: { kinds: ["page", "photo"] },
    "add:page": { page: [{ path: "/gallery", name: "Gallery", purpose: "show our work", sections: ["a photograph"], components: ["card"] }] },
    "add:photo": { photo: [{ page: "/gallery", describe: BENCH, name: "bench" }] },
    [T.pages]: { pages: [{ path: "src/routes/gallery.tsx", source: GALLERY_SRC }] },
  },
  ...o,
});
const gallery = (P) => P.page("gallery.tsx") || "";
/** A frame marked for a purchase: the empty literal and the purchase's mark (round 6). */
const MARKED = /\{"" \/\*pending-photo:[0-9a-f]{24}\*\/\}/;
/** The addition's own model work: its designers and its page writer. */
const additionCalls = (P) => ({ adds: calls(P, T.adds), design: calls(P, T.design), pages: calls(P, T.pages) });

test("NET — no request in this file left the machine", () => {
  assert.deepEqual(unexpected().filter((u) => u.by === "blocked"), []);
});
