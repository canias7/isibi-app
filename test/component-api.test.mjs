// The usage notes handed to the model on a repair, and the guard that stops them
// lying.
//
// A note that disagrees with the component is WORSE than no note: the model
// follows it, tsc refuses the page, and the repair pass — the very thing these
// notes exist to make work — is spent making the same mistake again. So nothing
// here is hand-written and nothing here is allowed to drift.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { build, render, extract } from "../builder/gen-component-api.mjs";
import { COMPONENT_API, COMPONENT_TYPES } from "../builder/component-api.mjs";
import { importedComponentApi, repairPrompt, pagesPrompt, UI_COMPONENTS } from "../builder/page-gen.mjs";
import { CORPUS_DIR } from "./fixtures/corpus.mjs";

const UI_DIR = "builder/lovable/template/src/components/ui";

/** The contents of the `{…}` opening at `open`, exclusive. */
function braced(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) return src.slice(open + 1, i); }
  }
  return null;
}

/**
 * Split on a separator that is not nested. A FLAT split reads
 * `items: { href?: string }[]` as a prop called `href` — this repo has written
 * a flat splitter and regretted it four times, and the one over the TYPE block
 * is safe from the regex-literal trap because a type annotation has no
 * regex literals in it.
 */
function splitTopLevel(s, sep) {
  const parts = [];
  let depth = 0, quote = null, start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) { if (c === quote && s[i - 1] !== "\\") quote = null; continue; }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if ("([{<".includes(c)) depth++;
    // `=>` is not a closing bracket: without this a function-typed prop drives
    // the depth negative and every field after it disappears.
    else if (">)]}".includes(c)) { if (!(c === ">" && s[i - 1] === "=")) depth = Math.max(0, depth - 1); }
    else if (c === sep && depth === 0) { parts.push(s.slice(start, i)); start = i + 1; }
  }
  parts.push(s.slice(start));
  return parts;
}

test("the committed notes match what the components actually take", () => {
  // The whole point. Re-derive from the files and require byte equality with
  // what is committed — so changing a prop and forgetting to regenerate fails
  // here rather than in somebody's published site.
  const fresh = render(build());
  const committed = fs.readFileSync("builder/component-api.mjs", "utf8");
  assert.equal(fresh, committed,
    "builder/component-api.mjs is stale — run `node builder/gen-component-api.mjs`");
});

test("no signature names a symbol that exists only inside the component file", () => {
  // THE MODEL IS HANDED THE SIGNATURE AND NOTHING ELSE. It cannot open the file,
  // so `model: keyof typeof MODELS` names something it has no way to look up —
  // and the guesses it makes from the prop name are exactly the ones TypeScript
  // refuses. Measured 2026-08-12 by compiling them: `model="last_click"` against
  // `"last-click"` is TS2820, `basis="legitimate-interest"` against
  // `"legitimate"` is TS2322. Not a runtime bug — the page fails to COMPILE, so
  // it is stubbed and the customer is billed for the build.
  //
  // DERIVED FROM THE KIT, not a list of the nine that shipped one: the pattern
  // is ordinary TypeScript and idiomatic, so the tenth is a matter of time.
  //
  // The exemption is real and is the reason this asks the SOURCE rather than
  // just grepping the signatures: `const X: Record<string, T> = {…}` has a
  // `keyof` of `string`, so resolving it would tell the model that the keys it
  // happens to hold are the only ones allowed. `care-icons` is that case, and
  // leaving its name unresolved is correct.
  const dir = path.join(process.cwd(), UI_DIR);
  const unresolved = [];
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".tsx"))) {
    const mod = f.replace(/\.tsx$/, "");
    const sig = COMPONENT_API[mod];
    if (!sig) continue;
    const src = fs.readFileSync(path.join(dir, f), "utf8");
    for (const m of sig.matchAll(/keyof typeof (\w+)/g)) {
      // Unannotated const -> TypeScript infers literal keys -> resolvable, so
      // the generator should have resolved it and something is wrong.
      if (new RegExp("\\bconst\\s+" + m[1] + "\\s*=\\s*\\{").test(src)) {
        unresolved.push(mod + ": " + sig.slice(0, 90));
      }
    }
    // A local `type X = "a" | "b"` (or an alias to a keyof) is the same failure
    // wearing a name — `tag-scope` was two hops from anything readable.
    for (const m of src.matchAll(/\btype\s+([A-Z][A-Za-z0-9]*)\s*=\s*([^;\n]+)/g)) {
      const body = m[2].replace(/keyof typeof (\w+)/g, (w, n) => {
        const c = new RegExp("\\bconst\\s+" + n + "\\s*=\\s*\\{").test(src);
        return c ? '"x" | "y"' : w;
      });
      if (!/^(?:"[^"]*"\s*\|\s*)+"[^"]*"$/.test(body.trim())) continue;
      if (new RegExp("\\b" + m[1] + "\\b").test(sig)) {
        unresolved.push(mod + ": names the local alias " + m[1]);
      }
    }
  }
  assert.deepEqual(unresolved, [],
    "the model is told to write one of these and cannot find out what they are:\n  " +
      unresolved.join("\n  "));
});

test("an array type is recorded as an array, not as one of its items", () => {
  // `export type QuoteFiles = { name: string; size: number }[]` was recorded
  // WITHOUT the `[]`, because the scan stopped at the closing brace. So the
  // model was told a list was a single item and wrote `files: { name, size }`
  // where the prop wants an array — a type error, page refused, whole site the
  // placeholder. Derived from the source rather than listing the two that were
  // wrong, since the next array-typed alias would be silently wrong too.
  const dir = path.join(process.cwd(), UI_DIR);
  const wrong = [];
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".tsx"))) {
    const mod = f.replace(/\.tsx$/, "");
    const recorded = COMPONENT_TYPES[mod];
    if (!recorded) continue;
    const src = fs.readFileSync(path.join(dir, f), "utf8");
    for (const name of Object.keys(recorded)) {
      // Does the SOURCE end this alias with `[]`?
      const m = new RegExp("export type " + name + "\\s*(?:<[^>]*>)?\\s*=\\s*\\{").exec(src);
      if (!m) continue;
      const body = braced(src, m.index + m[0].length - 1);
      if (body == null) continue;
      const after = src.slice(m.index + m[0].length + body.length + 1);
      const isArray = /^\s*\[\]/.test(after);
      if (isArray !== recorded[name].trim().endsWith("[]")) {
        wrong.push(mod + "." + name + " — source " + (isArray ? "IS" : "is NOT") +
          " an array, recorded as " + JSON.stringify(recorded[name].slice(-24)));
      }
    }
  }
  assert.deepEqual(wrong, [],
    "the model is told the wrong shape for these:\n  " + wrong.join("\n  "));
});

test("no prop is declared in the type and left out of the destructuring", () => {
  // `ClickCollect` declared `currency?: string` and never destructured it, so
  // the formatter named "GBP" outright and a euro shop that set the prop
  // correctly still priced every line in pounds. The prop is published in the
  // generated signature, so the model sets it and nothing happens — the worst
  // shape of wrong, because from the outside it looks handled.
  //
  // BOUND IS TESTED BY THE NAME APPEARING ANYWHERE in the destructuring text,
  // not by splitting it. Crude, and crude in the SAFE direction: it can only
  // miss a real one, never invent one. Splitting mis-parsed
  // `allow = /^[A-Za-z0-9 .,'&-]*$/` on the apostrophe inside the character
  // class and accused `personalisation-field`, which destructures `className`
  // perfectly well — a false alarm on correct code, which is the failure this
  // repo treats as worse than the miss.
  const dir = path.join(process.cwd(), UI_DIR);
  const unreadable = [];
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".tsx"))) {
    const src = fs.readFileSync(path.join(dir, f), "utf8");
    const re = /export function (\w+)\s*(?:<(?:[^<>()]|<[^<>()]*>)*>)?\s*\(\s*\{/g;
    let m;
    while ((m = re.exec(src))) {
      const dOpen = m.index + m[0].length - 1;
      const destruct = braced(src, dOpen);
      if (destruct == null) continue;
      const after = src.slice(dOpen + destruct.length + 2);
      const t = after.match(/^\s*:\s*\{/);
      if (!t) continue;
      const types = braced(src, dOpen + destruct.length + 2 + t[0].length - 1);
      if (types == null) continue;
      for (const part of splitTopLevel(types, ";")) {
        const name = (part.match(/^\s*([A-Za-z_$][\w$]*)\??\s*:/) || [])[1];
        if (!name) continue;
        // `x?: never` is a deliberate "you may not pass this" device — it is
        // there to refuse a wrong prop NAME, and has no value to destructure.
        if (/:\s*never\b/.test(part)) continue;
        if (!new RegExp("\\b" + name + "\\b").test(destruct)) {
          unreadable.push(f + "  " + m[1] + "(" + name + ")");
        }
      }
    }
  }
  assert.deepEqual(unreadable, [],
    "the signature offers these and the component cannot read them:\n  " + unreadable.join("\n  "));
});


test("the extractor survives a generic and an arrow type", () => {
  // Both of these silently produced WRONG output on the first run, and neither
  // failed loudly: `DataList<T>` was skipped entirely (a regex expecting `(`
  // straight after the name) and every prop after the first `() => void` was
  // dropped (`>` counted as a closing bracket, driving depth negative). The
  // result looked like a perfectly good, shorter signature.
  const generic = extract(`export function DataList<T>({ query, children }: {
    query: { isPending: boolean };
    children: (row: T, index: number) => React.ReactNode;
  }) {`);
  assert.equal(generic.length, 1, "a generic component must not be skipped");
  assert.deepEqual(generic[0].props.map((p) => p.split(":")[0]), ["query", "children"]);

  const arrows = extract(`export function X({ a, b, c }: {
    a: string; b?: () => void; c?: () => void;
  }) {`);
  assert.deepEqual(arrows[0].props.map((p) => p.split(/[?:]/)[0]), ["a", "b", "c"],
    "props after an arrow type must survive");
});

test("optionality and defaults are carried, because both change the call", () => {
  const got = extract(`export function X({ a, b = 5, c }: { a: string; b?: number; c?: "sm" | "lg" }) {`);
  const line = got[0].props.join(", ");
  assert.match(line, /a: string/);
  assert.match(line, /b\?: number = 5/, "a default tells the model it may omit the prop");
  assert.match(line, /c\?: "sm" \| "lg"/, "a small union is worth its tokens — the caller must pick one");
});



test("a build that never imported one of ours adds nothing at all", () => {
  const api = importedComponentApi([{ path: "index.tsx", source: 'import { Button } from "@/components/ui/button";' }]);
  assert.equal(api, null);
  const prompt = repairPrompt("a cafe", { tables: [] },
    [{ path: "index.tsx", source: 'import { Button } from "@/components/ui/button";' }], ["boom"], "Cafe");
  assert.ok(!/THE EXACT PROPS/.test(prompt), "no empty section when there is nothing to say");
});

test("the notes are only on the repair, never on the first call", () => {
  // The first call is every build; the repair is the minority that went wrong.
  // Put these on the first call and the saving becomes a cost on every site.
  const plain = pagesPrompt("a cafe", { tables: [] }, "Cafe");
  assert.ok(!/THE EXACT PROPS/.test(plain), "the first-pass prompt must stay lean");
  assert.ok(!/ReviewStars\(value/.test(plain), "no signatures on the first pass");
});


test("a number price is FORMATTED as money, never concatenated", () => {
  // Found by looking at a farm shop, not by any test: `currency + r.price`
  // rendered 3.2 as "£3.2" and 4200 as "£4200". Wrong on every site this kit
  // has ever built, on the component its own header calls "the single most
  // common shape on a site this platform builds" — and invisible to tsc, to
  // vite, to the lint and to every other check here, because a wrong money
  // format compiles perfectly.
  //
  // Asserted on the SOURCE rather than by rendering, because the failure was a
  // string concatenation and that is exactly what a source read can see.
  const src = fs.readFileSync(
    path.join(import.meta.dirname, "../builder/lovable/template/src/components/ui/price-list.tsx"), "utf8");
  assert.ok(!/currency\s*\+\s*r\.price/.test(src),
    "PriceList concatenates a raw number onto the symbol again — 3.2 renders as £3.2");
  assert.match(src, /toLocaleString\(/, "PriceList no longer formats its number at all");
  assert.match(src, /Number\.isInteger\(n\)\s*\?\s*0\s*:\s*2/,
    "the whole-vs-fractional rule is gone: a menu wants £12, and £3.2 is not a price");
  // The rule itself, evaluated rather than restated — a regex over the source
  // proves the code is there and not that it is right.
  const fmt = (n, currency = "£", locale = "en-GB") =>
    currency + n.toLocaleString(locale, {
      minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
      maximumFractionDigits: 2,
    });
  assert.equal(fmt(12), "£12");
  assert.equal(fmt(3.2), "£3.20");
  assert.equal(fmt(1.95), "£1.95");
  assert.equal(fmt(4200), "£4,200");
  assert.equal(fmt(1234.5), "£1,234.50");
  assert.equal(fmt(0), "£0");
});











test("two different destinations never get the same icon", () => {
  // Found by rendering a link hub: "Instagram · Website · Email" came out as
  // an Instagram mark and TWO IDENTICAL GLOBES. `email` was not in the map, so
  // it took the fallback — and the fallback was `Globe`, which is exactly what
  // `website` is. Nothing failed: the row rendered, the count was right, the
  // links worked, and the only thing that did not work was telling them apart.
  //
  // Two assertions, and the second is the general one: a fallback that
  // collides with a declared entry makes "we do not recognise this" look
  // identical to a specific answer.
  const UI = path.join(import.meta.dirname, "../builder/lovable/template/src/components/ui");
  const src = fs.readFileSync(path.join(UI, "social-links.tsx"), "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length));

  const map = code.match(/const ICONS[^=]*=\s*\{([\s\S]*?)\n\};/);
  assert.ok(map, "the icon map has changed shape and this guard can no longer read it");
  const entries = [...map[1].matchAll(/(\w+):\s*(\w+)/g)].map(([, k, v]) => [k, v]);
  assert.ok(entries.length >= 8, `only ${entries.length} networks mapped — the scan has broken`);

  const byKey = Object.fromEntries(entries);
  for (const k of ["email", "phone", "website", "instagram"]) {
    assert.ok(byKey[k], `${k} is no longer in the map — it falls through to the fallback`);
  }
  assert.notEqual(byKey.email, byKey.website, "email and website share an icon again");

  const fallback = code.match(/ICONS\[l\.network\.toLowerCase\(\)\] \|\| (\w+)/);
  assert.ok(fallback, "the fallback is gone or has moved");
  const used = new Set(entries.map(([, v]) => v));
  assert.ok(!used.has(fallback[1]),
    `the fallback is ${fallback[1]}, which a declared network also uses — an unknown network is indistinguishable from that one`);

  // And it has to be imported, or the page throws rather than rendering.
  assert.match(code, new RegExp(`^import \\{[^}]*\\b${fallback[1]}\\b`, "m"),
    `${fallback[1]} is used as the fallback and never imported`);
});
