// NO HARNESS MAY POST A FIELD THE BUILD CONTAINER DOES NOT READ.
//
// The 500-theme registry left the product on 2026-08-20 and `writeTheme` stopped
// taking a NAME — it takes three authored colours. `theme-seam.mjs` was converted
// with it; `theme-render.mjs` and `page-gen-eval.mjs` were not, and went on
// posting `theme: "broadsheet"` into a field nothing reads. So four themed sites
// were built on the TEMPLATE'S OWN palette, photographed, and filed as the
// theme's, and the eval measured a pipeline with no palette in it — which its own
// header calls worse than no harness.
//
// It went red on exactly ONE assertion (`the theme applied`, a field read off the
// response) and green on every other, in both files, for a day. That is the shape
// worth guarding: a payload key that stops being read is invisible from the
// harness's side, because a JSON body silently accepts anything.
//
// DERIVED AT BOTH ENDS. The allowed set is whatever `build-server.mjs` reads off
// `payload`, so a field added there needs nothing here, and a field removed there
// fails at every harness still sending it.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const DIR = path.join(ROOT, "test/integration");
const SERVER = path.join(ROOT, "builder/build-server.mjs");

// WHOLE-LINE ONLY. Blanking from any `//` eats a line holding a URL, and every
// one of these call sites is `fetch(\`http://127.0.0.1:${PORT}/build\`)` — an
// over-blanking scanner HIDES the payloads it is meant to read, which is the
// direction that costs a bug rather than a false alarm.
const blankLineComments = (src) =>
  src.split("\n").map((l) => (/^\s*\/\//.test(l) ? " ".repeat(l.length) : l)).join("\n");

/**
 * Walks from a bracket at `i` to its match, honouring strings, template literals
 * and nesting. A flat scan is wrong here and this repo has written one four
 * times: a payload is full of braces belonging to something else.
 */
function bracketEnd(src, i) {
  let depth = 0;
  for (let k = i; k < src.length; k++) {
    const c = src[k];
    if (c === '"' || c === "'" || c === "`") {
      const q = c;
      k++;
      while (k < src.length) {
        if (src[k] === "\\") { k += 2; continue; }
        if (src[k] === q) break;
        if (q === "`" && src[k] === "$" && src[k + 1] === "{") {
          let d = 1;
          k += 2;
          while (k < src.length && d > 0) {
            if (src[k] === "{") d++;
            else if (src[k] === "}") d--;
            k++;
          }
          k--;
        }
        k++;
      }
      continue;
    }
    if (c === "{" || c === "[" || c === "(") depth++;
    else if (c === "}" || c === "]" || c === ")") { depth--; if (depth === 0) return k; }
  }
  return -1;
}

/** The top-level keys of the object literal spanning [open, close]. */
function topKeys(src, open, close) {
  const keys = [];
  const push = (chunk) => {
    const m = /^\s*(?:\.\.\.)?\s*(?:(["'])([^"']+)\1|([A-Za-z_$][\w$]*))\s*(?::|$)/.exec(chunk);
    if (m) keys.push(m[2] || m[3]);
  };
  let depth = 0, start = open + 1;
  for (let k = open; k <= close; k++) {
    const c = src[k];
    if (c === '"' || c === "'" || c === "`") { k = bracketEnd(src, k) === -1 ? k : k; }
    if (c === "{" || c === "[" || c === "(") depth++;
    else if (c === "}" || c === "]" || c === ")") {
      depth--;
      if (depth === 0) { push(src.slice(start, k)); break; }
    } else if (c === "," && depth === 1) {
      push(src.slice(start, k));
      start = k + 1;
    }
  }
  return keys;
}

function buildPayloads() {
  const out = [];
  for (const f of fs.readdirSync(DIR).filter((n) => n.endsWith(".mjs"))) {
    const src = blankLineComments(fs.readFileSync(path.join(DIR, f), "utf8"));
    for (const m of src.matchAll(/\b(?:post|JSON\.stringify)\(\{/g)) {
      const open = m.index + m[0].length - 1;
      const close = bracketEnd(src, open);
      if (close === -1) continue;
      const keys = topKeys(src, open, close);
      // `files` is the discriminator: every build POST carries the page source,
      // and nothing else stringified in these harnesses does. Keying on the URL
      // instead would miss `site-build.mjs`, whose 50-odd payloads go through one
      // `post()` helper several hundred lines from the literals.
      if (!keys.includes("files")) continue;
      out.push({ file: f, line: src.slice(0, open).split("\n").length, keys });
    }
  }
  return out;
}

const containerReads = () =>
  new Set([...fs.readFileSync(SERVER, "utf8").matchAll(/payload\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1]));

test("the build container reads a real set of payload fields", () => {
  const reads = containerReads();
  // A scan that silently stopped matching would report every harness clean, which
  // is the reassuring way to say nothing was checked.
  assert.ok(reads.size >= 10, `only found ${reads.size} payload reads in build-server.mjs`);
  for (const must of ["files", "slug", "seeds"]) {
    assert.ok(reads.has(must), `build-server.mjs no longer reads payload.${must}`);
  }
});

test("every build payload an integration harness posts is read by the container", () => {
  const reads = containerReads();
  const payloads = buildPayloads();
  // The floor is the other half: with the walker broken this finds nothing and
  // the loop below passes over an empty list.
  assert.ok(payloads.length >= 40, `only found ${payloads.length} build payloads — the scan is broken`);

  const dead = [];
  for (const p of payloads) {
    for (const k of p.keys) if (!reads.has(k)) dead.push(`${p.file}:${p.line} posts \`${k}\``);
  }
  assert.deepEqual(dead, [], "a harness posts a field the build container does not read:\n  " + dead.join("\n  "));
});

test("the walker really finds a dead key — it is not passing over nothing", () => {
  // Drives the extractor over the exact shape both stale harnesses had, so the
  // check above cannot go quietly vacuous the day the anchors change.
  // `mode`, not `theme`: this fixture's dead key was `theme` until 2026-08-27,
  // when the registry returned and the container legitimately started reading
  // `payload.theme` — the premise assertion below is what caught that, which is
  // its job. `mode` went on 2026-08-23 and has no way back (site-dark.test.mjs
  // holds the absence), so it is the stable choice of a key nothing reads.
  const src = 'const built = await post({ files: ROUTES, slug: "look", title: "Cutler Row", mode });\n';
  const open = src.indexOf("{", src.indexOf("post("));
  const keys = topKeys(src, open, bracketEnd(src, open));
  assert.deepEqual(keys, ["files", "slug", "title", "mode"]);
  assert.ok(!containerReads().has("mode"), "payload.mode is read again — this guard's premise has moved");
});

test("the walker is not fooled by a nested object or a template literal", () => {
  const src = 'post({ files: { "index.tsx": `a ${x({ y: 1 })} b`, "menu.tsx": M }, slug: `s-${n}`, seeds })\n';
  const open = src.indexOf("{", src.indexOf("post("));
  assert.deepEqual(topKeys(src, open, bracketEnd(src, open)), ["files", "slug", "seeds"]);
});
