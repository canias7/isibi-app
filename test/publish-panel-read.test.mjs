// Audit A15-4: under DRAFT_FIRST the Publish panel opened the pre-draft face
// ("Every change you make goes live on its own — there is nothing to
// publish", no Publish control) whenever no draft reading was cached: before
// the first GET /draft came back, or after one failed. Now the draft is read
// first: the draft door when it reads, a failed read said as one, and the
// pre-draft face only when the server says draft-first is off for the site.
// The real functions, out of public/chat.js, over a small fake document.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SRC = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
function fnSource(head) {
  const at = SRC.indexOf(head);
  assert.ok(at >= 0, head + " is not in public/chat.js");
  let depth = 0;
  for (let i = SRC.indexOf("{", at); i < SRC.length; i++) {
    if (SRC[i] === "{") depth++;
    else if (SRC[i] === "}" && --depth === 0) return SRC.slice(at, i + 1);
  }
  assert.fail(head + " has no closing brace");
}

function fakeDoc() {
  const byId = new Map();
  const el = () => {
    const e = { id: "", className: "", innerHTML: "", _q: new Map(), listeners: [] };
    e.querySelector = (sel) => {
      if (!e._q.has(sel)) {
        const m = /^#(\w+)$/.exec(sel);
        const present = sel === ".si-x" || (m && e.innerHTML.includes('id="' + m[1] + '"'));
        e._q.set(sel, present ? { textContent: "", onclick: null } : null);
      }
      return e._q.get(sel);
    };
    e.addEventListener = (t, f) => e.listeners.push(f);
    e.remove = () => { if (byId.get(e.id) === e) byId.delete(e.id); };
    return e;
  };
  return {
    byId,
    getElementById: (id) => byId.get(id) || null,
    createElement: () => el(),
    body: { appendChild: (e) => byId.set(e.id, e) },
  };
}

function panel({ draftFirst = true, cached = null, read }) {
  const doc = fakeDoc();
  const seen = { draftPanel: [] };
  const siteDraftState = {};
  if (cached) siteDraftState["fretwork-1"] = cached;
  const make = new Function("deps", [
    "const { document, siteDraftState, SiteList, sitesRemote, esc, ic, siteChipUrl, sbToast, siteSetLive, navigator } = deps;",
    "const globalThis = { draftFirstOn: deps.draftFirst };",
    "const siteDraftPanel = (site, d) => deps.seen.draftPanel.push(d);",
    "const loadDraftState = async (site) => { const d = await deps.read(); if (d) siteDraftState[site.slug] = d; return d; };",
    fnSource("async function siteDraftPanelRead("),
    fnSource("function sitePublishPanel("),
    "return { sitePublishPanel };",
  ].join("\n"));
  const api = make({
    document: doc, siteDraftState, seen, draftFirst, read: read || (async () => null),
    SiteList: { offlineFor: () => false }, sitesRemote: [], esc: (s) => String(s), ic: () => "",
    siteChipUrl: ({ slug }) => slug + ".gofarther.app", sbToast: () => {}, siteSetLive: () => {}, navigator: {},
  });
  return { api, doc, seen };
}
const site = { slug: "fretwork-1", name: "Fretwork" };
const LEGACY = /goes live on its own/;
const tick = () => new Promise((r) => setTimeout(r, 0));

test("draft-first on, nothing read yet: the panel reads the draft, then opens the draft door, never the pre-draft face", async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const d = { ok: true, enabled: true, unpublished: true, revision: 3 };
  const { api, doc, seen } = panel({ read: () => gate.then(() => d) });
  api.sitePublishPanel(site);
  const box = doc.getElementById("sitePubModal");
  assert.ok(box, "nothing opened");
  assert.doesNotMatch(box.innerHTML, LEGACY, "the pre-draft face was shown while the draft was read");
  assert.match(box.innerHTML, /Reading your draft/);
  release();
  await tick(); await tick();
  assert.deepEqual(seen.draftPanel, [d], "the draft door did not open from the reading");
});

test("draft-first on, the read fails: said as a failed read, with no Publish and no pre-draft face", async () => {
  const { api, doc, seen } = panel({ read: async () => null });
  api.sitePublishPanel(site);
  await tick(); await tick();
  const box = doc.getElementById("sitePubModal");
  assert.ok(box);
  assert.doesNotMatch(box.innerHTML, LEGACY);
  assert.match(box.querySelector("#spReading").textContent, /Couldn’t read your draft/);
  assert.equal(seen.draftPanel.length, 0);
});

test("draft-first on, read and not enabled for the site: the pre-draft face, drawn once the reading is cached", async () => {
  const { api, doc } = panel({ read: async () => ({ ok: true, enabled: false }) });
  api.sitePublishPanel(site);
  await tick(); await tick();
  assert.match(doc.getElementById("sitePubModal").innerHTML, LEGACY);
});

test("CONTROL: draft-first off, the pre-draft face at once, with no read", () => {
  let asked = 0;
  const { api, doc } = panel({ draftFirst: false, read: async () => { asked++; return null; } });
  api.sitePublishPanel(site);
  assert.match(doc.getElementById("sitePubModal").innerHTML, LEGACY);
  assert.equal(asked, 0);
});
