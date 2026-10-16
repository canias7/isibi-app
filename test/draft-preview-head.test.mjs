// THE PREVIEW'S HEAD IS THE VERSION IT SERVES (2026-10-16, Codex's review of
// `fbd53dca`).
//
// `saveAsDraft` wrote every version's sidecar to one `sitemeta-draft/<slug>.json`,
// with no version and no fence. Codex paused an older save immediately before
// that write, finished a newer save, then resumed the older one: the draft
// stayed on the newer version, its preview's head became the OLDER one, and
// both saves answered success. Now nothing shared is written: the preview copy
// of the site's script reads the head staged INSIDE the version it serves
// (`builds/<slug>/<version>/state/sidecar.json`, immutable), and a save that
// finishes last with an older script puts the draft's own version back up.
//
//   DPH1  two overlapping saves, deterministic, through the real `saveAsDraft`,
//         `stageBuild` and `readBuild`, and the real site-script reader:
//         (a) the older save paused exactly where the shared write was (after
//             its record and editable copy, before its preview) and resumed
//             after the newer save finished: it puts no script up, and the
//             preview serves the newer version with the NEWER head;
//         (b) the older save's upload landing AFTER the newer save's (paused
//             inside its upload): its look afterwards puts the newer version
//             back up, with the newer head;
//         both answer success (the older one's code stands in the history, as
//             before), nothing shared is written, the live head and pointer do
//             not move; CONTROL: a single save puts its own version up
//   DPH2  the real site-script reader (`server.ts`, transpiled, nothing else
//         changed): previewing reads the head of `SITE_VERSION`; a request that
//         is not a preview reads the live head; a version staged without one
//         reads the live head; the generated foundation copy carries the same
//         reader
//   DPH3  storage permissions: a container job may write its version's staged
//         head (with `builds/`) and may no longer write `sitemeta-draft/`
//   DPH4  the Worker's re-preview (`previewVersion`), on real draft saves: it
//         puts a staged version's own script up as the preview; an unstaged
//         version is refused and the preview is left as it was; both
//         activation paths hand it to the draft save
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { saveAsDraft, readDraft, DRAFT_KEY } from "../site-draft.mjs";
import { stageBuild, readBuild, buildPrefix, STATE_DIR } from "../site-builds.mjs";
import { allowedJobKey } from "../builder/job-gateway.mjs";
import { FOUNDATION_FILES } from "../builder/foundation-files.mjs";
import { platform, sendMessage, settle, T } from "./fixtures/request-flow.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";
import { loadWorkerModule } from "./fixtures/worker-harness.mjs";

blockNetwork();

const SLUG = "dph";
const V_LIVE = "01790500000000-aaaaaa";
const V_OLD = "01790600000000-bbbbbb";
const V_NEW = "01790600000500-cccccc";
const HEAD = { [V_LIVE]: "The live words", [V_OLD]: "The older draft's words", [V_NEW]: "The newer draft's words" };
const SERVER_SRC = new URL("../builder/lovable/template/src/server.ts", import.meta.url);

/** R2 as the draft code reads it: get, and put honouring `onlyIf`. */
function store() {
  const m = new Map();
  let n = 0;
  const deps = {
    m,
    get: async (k) => (m.has(k) ? { etag: m.get(k).etag, text: async () => m.get(k).body } : null),
    put: async (k, body, _ct, cond = {}) => {
      const cur = m.get(k);
      if (cond && cond.etagMatches && (!cur || cur.etag !== cond.etagMatches)) return null;
      if (cond && cond.etagDoesNotMatch === "*" && cur) return null;
      const etag = "e" + (++n);
      m.set(k, { body: String(body), etag });
      return { etag };
    },
    list: async (prefix) => [...m.keys()].filter((k) => k.startsWith(prefix)).sort().map((key) => ({ key })),
    remove: async (k) => { m.delete(k); },
  };
  return deps;
}
/** A version staged as a publish stages it: its files, its script, its head. */
async function stage(deps, version) {
  const r = await stageBuild(deps, {
    slug: SLUG, version, files: { "index.html": { t: "<p>" + version + "</p>" } },
    worker: { code: "// site-version: " + version + "\nexport default {}", build: "b-" + version.slice(-6) },
    state: { sidecar: JSON.stringify({ description: HEAD[version] }) },
    manifest: { parent: V_LIVE },
  });
  assert.equal(r.ok, true, JSON.stringify(r));
}
async function liveSite(deps) {
  await stage(deps, V_LIVE);
  await deps.put("current/" + SLUG + ".json", JSON.stringify({ version: V_LIVE, build: "b-aaaaaa", parent: "", job: null, activatedAt: "x" }), "application/json");
  await deps.put("sitemeta/" + SLUG + ".json", JSON.stringify({ description: HEAD[V_LIVE] }), "application/json");
}

// ── THE REAL SITE-SCRIPT READER ─────────────────────────────────────────────
//
// `server.ts` transpiled as it is; only its three imports are stood in for:
// Start's handler answers with the head the script set, the build constants are
// the version's, and `setSiteMeta` keeps what it is given.
async function siteScript(version) {
  const src = readFileSync(SERVER_SRC, "utf8");
  const imports = [
    'import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";',
    'import { SITE_BUILD, SITE_SLUG, SITE_VERSION, SITE_PARENT } from "./site-brand";',
    'import { setSiteMeta, type SiteMeta } from "./site-runtime";',
  ];
  for (const i of imports) assert.ok(src.includes(i), "the site script's imports moved — rescope this: " + i);
  let body = src;
  for (const i of imports) body = body.replace(i, "");
  const head = [
    "let __meta = null;",
    "const setSiteMeta = (m) => { __meta = m; };",
    "const createStartHandler = () => async () => new Response(JSON.stringify(__meta));",
    "const defaultStreamHandler = null;",
    "const SITE_BUILD = 'b';",
    "const SITE_SLUG = " + JSON.stringify(SLUG) + ";",
    "const SITE_VERSION = " + JSON.stringify(version) + ";",
    "const SITE_PARENT = '';",
  ].join("\n");
  const js = ts.transpileModule(head + "\n" + body, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return (await import("data:text/javascript;base64," + Buffer.from(js + "\n//" + Math.random()).toString("base64"))).default;
}
/** The head a document of `version`'s script gets, as a preview or not. */
async function headSeen(deps, version, { preview = true } = {}) {
  const script = await siteScript(version);
  const env = { SITES: { get: async (k) => deps.get(k), head: async (k) => (deps.m.has(k) ? {} : null) } };
  await deps.put("sites/" + SLUG + "/site.live", "1", "text/plain");
  const res = await script.fetch(new Request("https://x.gofarther.app/", { headers: preview ? { "x-site-preview": "1" } : {} }), env);
  const m = JSON.parse(await res.text());
  return m && m.description;
}

/** The preview slot: which version's script is up, as the uploads leave it. */
function previewSlot(deps) {
  const slot = { version: null, uploads: [] };
  const up = (code) => { const v = /site-version: (\S+)/.exec(code)[1]; slot.version = v; slot.uploads.push(v); return { ok: true }; };
  slot.previewOf = (version) => async () => up("// site-version: " + version);
  slot.repreview = async (version) => { const b = await readBuild(deps, SLUG, version); if (!b || !b.worker) return { ok: false }; return up(b.worker); };
  return slot;
}
const gate = () => { let open; const p = new Promise((r) => { open = r; }); return { wait: () => p, open }; };

test("DPH1 TWO OVERLAPPING SAVES — the older one resumed after the newer finished never leaves its head (or its script) on the draft: the preview serves the newer version with the newer head; both answer success; nothing shared is written; nothing live moves", async () => {
  for (const where of ["before-preview", "inside-upload"]) {
    const deps = store();
    await liveSite(deps);
    await stage(deps, V_OLD);
    await stage(deps, V_NEW);
    const slot = previewSlot(deps);
    const live0 = deps.m.get("current/" + SLUG + ".json").body;
    const head0 = deps.m.get("sitemeta/" + SLUG + ".json").body;
    const g = gate();
    let reached = false;
    // THE OLDER SAVE: paused where the shared write was, or inside its upload.
    const older = saveAsDraft(deps, {
      slug: SLUG, version: V_OLD, base: V_LIVE,
      afterActivate: where === "before-preview" ? async () => { reached = true; await g.wait(); } : undefined,
      preview: where === "inside-upload" ? async () => { reached = true; await g.wait(); return slot.previewOf(V_OLD)(); } : slot.previewOf(V_OLD),
      repreview: slot.repreview,
      commit: async () => {},
    });
    for (let i = 0; i < 50 && !reached; i++) await new Promise((r) => setTimeout(r, 1));
    assert.equal(reached, true, where + ": the older save never reached its pause — this case tests nothing");
    // THE NEWER SAVE, whole.
    const newer = await saveAsDraft(deps, { slug: SLUG, version: V_NEW, base: V_LIVE, preview: slot.previewOf(V_NEW), repreview: slot.repreview, commit: async () => {} });
    assert.equal(newer.ok, true, JSON.stringify(newer));
    assert.equal(slot.version, V_NEW);
    // THE OLDER SAVE RESUMES.
    g.open();
    const old = await older;
    assert.equal(old.ok, true, where + ": the older save (its record taken first) did not answer success: " + JSON.stringify(old));
    const { draft } = await readDraft(deps, SLUG);
    assert.equal(draft.version, V_NEW, where + ": the draft is not on the newer version");
    assert.equal(slot.version, V_NEW, where + ": the preview was left on the older script: " + JSON.stringify(slot.uploads));
    if (where === "inside-upload") {
      assert.deepEqual(slot.uploads, [V_NEW, V_OLD, V_NEW], "the older upload's landing was not followed by the newer version going back up");
      assert.equal(old.previewed.repaired, true, JSON.stringify(old.previewed));
    } else {
      assert.deepEqual(slot.uploads, [V_NEW], "the overtaken save put its script up");
      assert.equal(old.previewed.superseded, true, JSON.stringify(old.previewed));
    }
    // THE HEAD THE PREVIEW SHOWS: the newer version's own, read by the real script.
    assert.equal(await headSeen(deps, slot.version), HEAD[V_NEW], where + ": the preview's head is not the newer version's");
    assert.equal([...deps.m.keys()].some((k) => k.startsWith("sitemeta-draft/")), false, where + ": a shared draft sidecar was written");
    assert.equal(deps.m.get("current/" + SLUG + ".json").body, live0, where + ": the live pointer moved");
    assert.equal(deps.m.get("sitemeta/" + SLUG + ".json").body, head0, where + ": the live head changed");
  }
  // CONTROL: one save puts its own version up, with its own head.
  const deps = store();
  await liveSite(deps);
  await stage(deps, V_OLD);
  const slot = previewSlot(deps);
  const one = await saveAsDraft(deps, { slug: SLUG, version: V_OLD, base: V_LIVE, preview: slot.previewOf(V_OLD), repreview: slot.repreview, commit: async () => {} });
  assert.equal(one.ok, true);
  assert.deepEqual(slot.uploads, [V_OLD]);
  assert.equal(await headSeen(deps, V_OLD), HEAD[V_OLD]);
});

test("DPH2 THE REAL SITE-SCRIPT READER — previewing reads the head of the version it serves; a visitor's request reads the live head; a version staged without one reads the live head; the generated copy carries the same reader", async () => {
  const deps = store();
  await liveSite(deps);
  await stage(deps, V_OLD);
  await stage(deps, V_NEW);
  assert.equal(await headSeen(deps, V_OLD), HEAD[V_OLD]);
  assert.equal(await headSeen(deps, V_NEW), HEAD[V_NEW]);
  assert.equal(await headSeen(deps, V_NEW, { preview: false }), HEAD[V_LIVE], "a request that is not a preview read a draft's head");
  deps.m.delete(buildPrefix(SLUG, V_NEW) + STATE_DIR + "sidecar.json");
  assert.equal(await headSeen(deps, V_NEW), HEAD[V_LIVE], "a version with no staged head did not fall back to the live one");
  const src = readFileSync(SERVER_SRC, "utf8");
  const gen = FOUNDATION_FILES.find((f) => String(f.path).endsWith("src/server.ts"));
  assert.ok(gen, "the generated foundation copy of server.ts is missing");
  assert.equal(gen.source, src, "the generated foundation copy is not the template's server.ts — run builder/gen-foundation.mjs");
  assert.ok(!src.includes("sitemeta-draft/"), "the site script still reads a shared draft sidecar");
});

test("DPH3 STORAGE PERMISSIONS — a container job may write its version's staged head and may no longer write a shared draft sidecar", () => {
  const id = "a".repeat(32);
  assert.equal(allowedJobKey(SLUG, id, buildPrefix(SLUG, V_NEW) + STATE_DIR + "sidecar.json"), true, "a job may not write its version's staged head");
  assert.equal(allowedJobKey(SLUG, id, "sitemeta-draft/" + SLUG + ".json"), false, "a job may still write the shared draft sidecar");
  assert.equal(allowedJobKey(SLUG, id, buildPrefix("other", V_NEW) + STATE_DIR + "sidecar.json"), false, "a job may write another site's staged head");
});

test("DPH4 THE WORKER'S RE-PREVIEW ON REAL DRAFT SAVES — `previewVersion` puts a staged version's own script up as the preview; an unstaged version is refused and the preview left as it was; both activation paths hand it to the draft save", async () => {
  const compiler = installCompiler();
  const bare = (t) => (t == null ? t : String(t).replace(/\n[ \t]+$/, ""));
  const FROM = ["Follow us on TikTok at @oldloaf", "Come to the bakery", "Open every day"];
  const TO = ["Follow us on TikTok at @harbourloaf", "Come and see us", "Open six days"];
  const VISIT = pageSrc("/visit", "<section className=\"come\"><h1>" + FROM[1] + "</h1><p>" + FROM[0] + "</p><p>" + FROM[2] + "</p></section>");
  const HOME = pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1></section>");
  const said = (args) => String(args.messages[0].content);
  const lineId = (args, line) => Number(String(said(args).split("\n").find((l) => l.includes("[visit.tsx] " + line)) || "-1.").split(".")[0]);
  let n = 0;
  const P = platform({
    slug: "dph-" + Math.random().toString(16).slice(2, 8), pages: [{ path: "index.tsx", source: HOME }, { path: "visit.tsx", source: VISIT }], liveScripts: true, balance: 400,
    answers: {
      route: () => ({ intent: "edit", layer: "text", page: "/visit", targets: [{ change: 0, writes: ["page:/visit"] }] }),
      [T.text]: (args) => { const i = Math.min(n++, 2); return { edits: [{ id: lineId(args, FROM[i]), to: TO[i] }] }; },
    },
  });
  const { draftFirstApi } = await loadWorkerModule();
  const draft = () => JSON.parse(bare(P.readObj(DRAFT_KEY(P.slug))));
  try {
    const r0 = await sendMessage(P, { message: "Change our TikTok link to @harbourloaf." });
    await settle(P, r0.key, { rounds: 20 });
    P.env.DRAFT_FIRST = "on";
    for (const message of ["Change the Visit heading to Come and see us.", "Say we are open six days."]) {
      const r = await sendMessage(P, { message });
      const { rec } = await settle(P, r.key, { rounds: 20 });
      assert.equal(rec.parts[0].status, "done", JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    }
    const d = draft();
    assert.equal(d.revs.length, 2, JSON.stringify(d.revs));
    const [first, second] = d.revs.map((r) => r.version);
    assert.equal(P.previewScript(), second, "the preview is not the draft's newest version");
    // THE RE-PREVIEW puts the named staged version's own script up.
    const back = await P.run(() => draftFirstApi.previewVersion(P.env, P.slug, first));
    assert.equal(back.ok, true, JSON.stringify(back));
    assert.equal(P.previewScript(), first, "the re-preview did not put that version's script up");
    const fwd = await P.run(() => draftFirstApi.previewVersion(P.env, P.slug, second));
    assert.equal(fwd.ok, true);
    assert.equal(P.previewScript(), second);
    // AN UNSTAGED VERSION: refused, nothing uploaded.
    const none = await P.run(() => draftFirstApi.previewVersion(P.env, P.slug, "01790999999999-zzzzzz"));
    assert.equal(none.ok, false);
    assert.equal(P.previewScript(), second, "a refused re-preview changed the preview");
    await P.settle();
    assert.deepEqual(P.unexpected, [], "requests the stand-ins were not set up for");
  } finally { P.close(); compiler.uninstall(); }
  // BOTH ACTIVATION PATHS HAND IT TO THE DRAFT SAVE, landmark to landmark.
  const w = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const wired = w.split("repreview: toDraft ? (v) => previewVersion(env, slug, v) : undefined,").length - 1;
  assert.equal(wired, 2, "the edit and build activations do not both hand the re-preview to the draft save (" + wired + ")");
});
