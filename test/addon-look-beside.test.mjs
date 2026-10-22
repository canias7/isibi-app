// AN ADDITION THAT WRITES THE LOOK, BESIDE ANOTHER PART (2026-10-22, audit
// A04-5).
//
//   ALB1  a QR addition cleared by its targets as a component (not a config
//         writer) runs beside a text part. It stores `look.qr` before its
//         publish, so it takes the site's turn there instead of refusing
//         `turn-lost` for a turn it was never given: its first run lands,
//         both parts are done, and the addition is not run a second time.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, settle, T } from "./fixtures/request-flow.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";

blockNetwork();

const TT_FROM = "Follow us on TikTok at @oldloaf";
const TT_TO = "Follow us on TikTok at @harbourloaf";
const TIKTOK = "Change our TikTok link on the Visit page to @harbourloaf";
const QR = "add a QR code on the Menu page that opens our Visit page";
const HOME = pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1></section>");
const VISIT = pageSrc("/visit", "<section className=\"come\"><h1>Come to the bakery</h1><p>" + TT_FROM + "</p></section>");
const MENU = pageSrc("/menu", "<section className=\"menu\"><h1>Menu</h1></section>");
const SHOWS = { path: "src/routes/menu.tsx", source: MENU.replace("<h1>Menu</h1>", "<img src={SITE_QRS.visit.src} alt=\"Come to the bakery\" /><h1>Menu</h1>") };
const until = async (cond, ms = 6000) => { const end = Date.now() + ms; while (Date.now() < end) { if (cond()) return true; await new Promise((ok) => setTimeout(ok, 10)); } return cond(); };
const lineId = (args, file, line) => {
  const at = String(args.messages[0].content).split("\n").find((l) => l.includes("[" + file + "] " + line));
  return Number(String(at || "-1.").split(".")[0]);
};

test("ALB1 A QR ADDITION BESIDE A TEXT PART TAKES THE TURN AT ITS LOOK STORE — its first run is not lost as `turn-lost`; it lands once and both parts are done", async () => {
  const compiler = installCompiler();
  const ref = { P: null, key: null };
  const P = platform({
    slug: "alb-" + Math.random().toString(16).slice(2, 8), pages: [{ path: "index.tsx", source: HOME }, { path: "visit.tsx", source: VISIT }, { path: "menu.tsx", source: MENU }], beside: true, balance: 400,
    answers: {
      route: [
        { intent: "edit", layer: "text", page: "/visit", alsoAsked: [QR], targets: [{ change: 0, writes: ["page:/visit"] }, { change: 1, writes: ["component:qr"] }] },
        { intent: "addon", targets: [{ change: 0, writes: ["component:qr"] }] },
      ],
      [T.text]: async (args) => {
        // THE TEXT PART STAYS OPEN until the addition's first try has ended.
        await until(() => ref.key && ref.P.jobsOf(ref.key).some((j) => j.op === "addon" && j.result));
        return { edits: [{ id: lineId(args, "visit.tsx", TT_FROM), to: TT_TO }] };
      },
      [T.adds]: { kinds: ["qr"] },
      "add:qr": { qr: { name: "visit", points: "/visit", label: "Come to the bakery", page: "/menu" } },
      [T.pages]: { pages: [SHOWS] },
    },
  });
  ref.P = P;
  try {
    const r = await sendMessage(P, { message: TIKTOK + ", and " + QR + "." });
    ref.key = r.key;
    assert.equal(r.status, 200, JSON.stringify(r.body));
    // EVERYTHING AS THE QUEUE HANDS IT OVER, the text job left running beside.
    const running = [];
    for (let i = 0; i < 40; i++) {
      const m = P.queue.shift();
      if (!m) { await new Promise((ok) => setTimeout(ok, 20)); if (!P.queue.length && P.jobsOf(r.key).filter((j) => j.op === "addon" && j.state === "done").length) break; continue; }
      running.push((async () => { const { deliver } = await import("./fixtures/request-flow.mjs"); return deliver(P, m); })());
      await new Promise((ok) => setTimeout(ok, 5));
    }
    await Promise.allSettled(running);
    const { rec } = await settle(P, r.key, { rounds: 20 });
    const addons = P.jobsOf(r.key).filter((j) => j.op === "addon");
    assert.ok(addons.length >= 1, "the addition never ran");
    const first = JSON.parse(addons[0].result.body);
    assert.notEqual(first.error, "turn-lost", "the addition's first run was lost for a turn it was never given: " + JSON.stringify(first).slice(0, 300));
    assert.equal(first.ok, true, JSON.stringify(first).slice(0, 400));
    assert.equal(addons.length, 1, "the addition ran again");
    assert.deepEqual(rec.parts.map((p) => p.status), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.ok(P.page("visit.tsx").includes(TT_TO), "the text part's change is missing");
    await P.settle();
  } finally { P.close(); compiler.uninstall(); }
});
