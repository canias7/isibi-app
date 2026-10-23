// AUDIT A25-3 AND A25-5 (2026-10-23): A NEW PICTURE THAT IS NOT MADE IS TOLD
// AS WHAT HAPPENED. With purchases switched off (production since
// 2026-10-17) or credits short, the picture step said "I couldn't match that
// to any of the pictures on your site. One picture couldn't be made just now"
// — the model HAD matched the slot, and "just now" invites a retry that cannot
// work. A build's reply fact said "the image service answered without them",
// though it was never asked. Driven through the real edit route (switch off),
// then the step and the build facts directly.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, settle } from "./fixtures/request-flow.mjs";
import { PAGES } from "./fixtures/live-ask.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { pictureReply, runPictureEdit } from "../builder/site-picture.mjs";
import { pictureOutcomes } from "../builder/site-images.mjs";
import { buildReplyFacts } from "../builder/site-reply.mjs";

blockNetwork();

const HERO = "import { createFileRoute } from '@tanstack/react-router';\nexport const Route = createFileRoute('/')({ component: Page });\nfunction Page() { return (<main><section><img src=\"https://images.example.com/hero.jpg\" alt=\"Loaves on the counter\" /><h1>Fold Lane</h1></section></main>); }\n";

test("PU1 THROUGH THE ROUTE, PURCHASES OFF: a described picture is not made, nothing is bought, and the reply names the switch — no \"couldn't match\", no \"just now\"", async () => {
  const compiler = installCompiler();
  let asked = 0;
  const slug = "pu1-" + Math.random().toString(16).slice(2, 8);
  const P = platform({
    slug, balance: 100, pages: [{ path: "index.tsx", source: HERO }, ...PAGES.filter((p) => p.path !== "index.tsx")],
    answers: {
      route: { intent: "edit", layer: "picture", targets: [{ change: 0, writes: ["picture"] }] },
      choose_pictures: () => { asked++; return { pictures: [{ page: "index.tsx", alt: "Loaves on the counter", describe: "a sunset over the harbour" }] }; },
    },
  });
  try {
    P.env.IMAGE_PURCHASES = "off";
    const r = await sendMessage(P, { message: "Put a photo of a sunset in the hero." });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const { rec } = await settle(P, r.key, { rounds: 20 });
    assert.ok(asked > 0, "the picture model was never asked — this case watched nothing");
    assert.equal(P.imageLog.length, 0, "a photograph was asked of the image service with purchases off");
    assert.equal(rec.parts[0].why, "nothing-made", JSON.stringify(rec.parts[0]));
    const said = P.jobsOf(r.key).map((j) => JSON.stringify(P.answerOf(j))).join("\n");
    assert.match(said, /can't be made for sites at the moment/, "the reply does not name the switch: " + said.slice(0, 2000));
    assert.doesNotMatch(said, /couldn't match that to any of the pictures/, "the reply says the slot was not matched");
    assert.doesNotMatch(said, /couldn't be made just now/, "the reply still invites a retry");
  } finally { await P.settle(); P.close(); compiler.uninstall(); }
});

const PAGE = { path: "index.tsx", source: HERO };
const step = (why) => ({
  send: async () => ({ content: [{ type: "tool_use", name: "choose_pictures", input: { pictures: [{ page: "index.tsx", alt: "Loaves on the counter", describe: "a sunset" }] } }], usage: { input_tokens: 1, output_tokens: 1 } }),
  library: async () => [],
  generate: async () => null,
  ...(why === undefined ? {} : { unmadeWhy: () => why }),
});

test("PU2 the step: a failed-only answer never says \"couldn't match\"; off and short each say why; an unknown cause keeps \"just now\"", async () => {
  const off = await runPictureEdit(step("off"), { instruction: "x", pages: [PAGE] });
  assert.equal(off.reason, "nothing-made");
  assert.doesNotMatch(off.msg, /couldn't match/);
  assert.match(off.msg, /can't be made for sites at the moment/);
  assert.doesNotMatch(off.msg, /just now/);
  const short = await runPictureEdit(step("short"), { instruction: "x", pages: [PAGE] });
  assert.match(short.msg, /aren't enough credits/);
  assert.doesNotMatch(short.msg, /couldn't match|just now/);
  const unknown = await runPictureEdit(step(), { instruction: "x", pages: [PAGE] });
  assert.doesNotMatch(unknown.msg, /couldn't match/);
  assert.match(unknown.msg, /couldn't be made just now/);
  // CONTROLS: nothing matched still says so; a refusal beside a failure keeps both.
  assert.match(pictureReply({}), /couldn't match that/);
  const both = pictureReply({ failed: 1, refused: [{ slot: { alt: "Mo" }, refused: "cannot" }] });
  assert.match(both, /couldn't change the framing/);
  assert.match(both, /couldn't be made/);
});

test("PU3 a build with purchases off: the refused photographs are \"not tried\" because purchases are off — never \"the image service answered without them\"", () => {
  const plan = { images: [{ page: "/", describe: "a loaf on a board" }] };
  const buy = { bought: [], attempted: ["a loaf on a board"], notTried: [], refused: ["a loaf on a board"], unresolved: [] };
  const off = pictureOutcomes({ plan, budget: 1, buy: { ...buy, off: true } });
  assert.deepEqual(off.map((x) => [x.status, x.why]), [["not-attempted", "off"]]);
  const text = buildReplyFacts({ pictures: off }).facts.map((f) => f.text).join("\n");
  assert.match(text, /never tried, because new photographs cannot be made for sites at the moment/);
  assert.doesNotMatch(text, /answered without them/);
  // CONTROL: switched on, a refusal is still the image service's.
  const on = pictureOutcomes({ plan, budget: 1, buy });
  assert.deepEqual(on.map((x) => x.status), ["failed"]);
});
