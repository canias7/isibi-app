// Audit A15-5: a Publish the server answers `already: true` (the revision was
// already applied, worker.js `publishDraft`) changed nothing, and the panel
// toasted "Published — …" anyway; after a Versions restore under draft-first
// the page never read the draft again, so the panel stayed on the old draft.
// The click handler is run for real, out of public/chat.js, with its free
// names handed in.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SRC = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
function block(head, from = 0) {
  const at = SRC.indexOf(head, from);
  assert.ok(at >= 0, head + " is not in public/chat.js");
  let depth = 0;
  for (let i = SRC.indexOf("{", at); i < SRC.length; i++) {
    if (SRC[i] === "{") depth++;
    else if (SRC[i] === "}" && --depth === 0) return SRC.slice(at, i + 1);
  }
  assert.fail(head + " has no closing brace");
}

const panelAt = SRC.indexOf("function siteDraftPanel(site, d) {");
const clickSrc = block("go.onclick = async () => {", panelAt);

async function press(answer) {
  const said = [];
  const go = { disabled: false, textContent: "Publish this draft" };
  const run = new Function("deps", [
    "const { go, apiFetch, sbToast, close, siteDraftState, paintDraftChip, siteDraftFrameKey, siteDraftFollow, slug, site, stalled, revision, version, d } = deps;",
    "let sent = false; const sendRevision = revision; const siteActionTalk = undefined; const sendEffort = undefined;",
    "return (async () => { " + clickSrc.slice(clickSrc.indexOf("{") + 1, -1) + " })();",
  ].join("\n"));
  await run({
    go, slug: "fretwork-1", site: {}, stalled: false, revision: 5, version: "01790000000005-aaaaaa", d: {},
    apiFetch: async () => ({ ok: true, status: 200, json: async () => answer }),
    sbToast: (m) => said.push(m), close: () => {}, siteDraftState: {}, paintDraftChip: () => {},
    siteDraftFrameKey: () => "", siteDraftFollow: () => {},
  });
  return said;
}

test("a Publish the server answers `already` is said as nothing new, never 'Published'", async () => {
  const said = await press({ ok: true, already: true, revision: 5, state: { unpublished: true } });
  assert.equal(said.length, 1, JSON.stringify(said));
  assert.doesNotMatch(said[0], /^Published/);
  assert.match(said[0], /already published/);
});

test("CONTROL: a real publication is still said as published", async () => {
  const said = await press({ ok: true, already: false, revision: 5, state: { unpublished: false } });
  assert.deepEqual(said, ["Published — your live site is up to date"]);
});

test("after a Versions restore under draft-first, the draft is read again", () => {
  const restore = block("const restore = async (id, label) => {", SRC.indexOf("async function siteVersions(site) {"));
  const ok = restore.indexOf("Restored — your site is live on that build.");
  assert.ok(ok > 0, "the restore's success toast moved");
  const reread = restore.indexOf("if (globalThis.draftFirstOn === true && typeof loadDraftState === 'function') loadDraftState(site);");
  assert.ok(reread > ok, "the restore does not read the draft again after it succeeds");
});
