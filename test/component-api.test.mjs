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
import { COMPONENT_API } from "../builder/component-api.mjs";
import { importedComponentApi, repairPrompt, pagesPrompt, UI_COMPONENTS } from "../builder/page-gen.mjs";

const UI_DIR = "builder/lovable/template/src/components/ui";

test("the committed notes match what the components actually take", () => {
  // The whole point. Re-derive from the files and require byte equality with
  // what is committed — so changing a prop and forgetting to regenerate fails
  // here rather than in somebody's published site.
  const fresh = render(build());
  const committed = fs.readFileSync("builder/component-api.mjs", "utf8");
  assert.equal(fresh, committed,
    "builder/component-api.mjs is stale — run `node builder/gen-component-api.mjs`");
});

test("every documented component is a real one, and the count is sane", () => {
  const known = new Set(UI_COMPONENTS);
  for (const name of Object.keys(COMPONENT_API)) {
    assert.ok(known.has(name), `${name} has notes but is not in UI_COMPONENTS`);
    assert.ok(fs.existsSync(path.join(UI_DIR, name + ".tsx")), `${name}.tsx does not exist`);
  }
  // Ours are the ones with no training data behind them, and they are the ones
  // that need describing. A collapse to a handful means the extractor broke.
  assert.ok(Object.keys(COMPONENT_API).length > 400,
    `only ${Object.keys(COMPONENT_API).length} components documented — the extractor has regressed`);
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

test("className is dropped, because all 500 take it", () => {
  const got = extract(`export function X({ a, className }: { a: string; className?: string }) {`);
  assert.deepEqual(got[0].props, ["a: string"]);
  // And it is stated once, where it belongs.
  const prompt = repairPrompt("a cafe", { tables: [] },
    [{ path: "index.tsx", source: 'import { ReviewStars } from "@/components/ui/review-stars";' }],
    ["boom"], "Cafe");
  assert.match(prompt, /takes\s*\nclassName|also takes\s+className/i);
});

test("a repair is given the props of what the page imported, and nothing else", () => {
  const pages = [{
    path: "index.tsx",
    source: `import { ReviewStars } from "@/components/ui/review-stars";
             import { DataList } from "@/components/ui/data-list";
             import { Button } from "@/components/ui/button";`,
  }];
  const api = importedComponentApi(pages);
  assert.match(api, /^review-stars — ReviewStars\(value: number/m, "the imported one is described");
  assert.match(api, /^data-list — DataList\(/m);
  // `button` is shadcn's: standard HTML props, thousands of real examples in
  // training. Describing it spends tokens to tell the model what it knows.
  assert.ok(!/^button —/m.test(api), "shadcn primitives are left out");
  // And the 400-odd it did NOT import must not be in there, or this costs the
  // 12,600 tokens the whole design exists to avoid.
  assert.ok(!/availability-grid/.test(api), "only what the page imported");
  assert.ok(api.split("\n").length <= 3);
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

test("the four APIs that were actually got wrong are now stated", () => {
  // Not invented failures — these are the four I guessed wrong in one sitting
  // while writing a demo page against components I had written hours earlier.
  // If the model has one line of names and one retry, it will do the same.
  assert.match(COMPONENT_API["review-stars"], /value: number/);     // guessed `rating`
  assert.match(COMPONENT_API["upload-progress"], /name: string, percent: number/);  // guessed `items`
  assert.match(COMPONENT_API["storage-bar"], /used: number, total: number/);        // guessed `cap`/`tier`
  assert.match(COMPONENT_API["comment-thread"], /root: React\.ReactNode/);          // guessed `comments`
});
