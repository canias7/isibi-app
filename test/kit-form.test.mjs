// THE KIT'S FORM PRIMITIVES RENDER OUTSIDE A FORM (run 34, 2026-09-04).
//
// `useFormField` is shadcn's: it threw "should be used within <FormItem>" for
// a `<FormLabel>` or `<FormControl>` used as an ordinary label or wrapper. A
// generated page on fretwork-1's `/gear` did exactly that — the addon's new
// page — and the crash was total: the server render fell back to an empty
// shell, the client threw the same error, and the error boundary showed
// "This page didn't load" to every visitor. The render check reported it and
// the publish shipped it (the ship-it rule: a report, never a refusal). The
// signature list cannot say "only inside a FormItem" — a nesting is not a
// prop — so, as with `Figure`, the fix is the wall: the obvious use works.
//
// DRIVEN, NOT READ. The kit file is transpiled with the TypeScript the root
// declares and rendered with react-dom/server, both ways: bare, which must
// render; and inside a real react-hook-form with an error on the field, which
// must still carry that error to the label, the control and the message. A
// source read could only pin the spelling of a guard clause.
//
// THE PACKAGES: the template's own `node_modules` when installed (the shape
// the real bundle sees), else the root's, which declares the same eight at the
// template's ranges for exactly this — CI's unit job installs the root only,
// the recorded "a CI step that does not install what the tests import" trap.
// It does not skip: a guard that never runs in CI proves nothing there.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const ROOT = new URL("../", import.meta.url);
const TEMPLATE = path.join(ROOT.pathname, "builder/lovable/template");
const rootRequire = createRequire(import.meta.url);
const ts = rootRequire("typescript");

// The template's copy first, the root's second; neither is a skip.
function resolver() {
  const tries = [];
  try { const r = createRequire(path.join(TEMPLATE, "package.json")); r.resolve("react-hook-form"); r.resolve("react-dom/server"); tries.push(r); } catch { /* not installed here */ }
  tries.push(rootRequire);
  return (id) => {
    let last;
    for (const r of tries) { try { return r(id); } catch (e) { last = e; } }
    throw new Error(`the kit guard cannot load ${id} from the template or the root: ${last && last.message}`);
  };
}

// Load one kit file: transpile TSX → CommonJS and run it with the kit's own
// `@/` aliases pointing back into this loader.
function loadKit(file, req, cache = new Map()) {
  const abs = path.join(TEMPLATE, file);
  if (cache.has(abs)) return cache.get(abs);
  const src = fs.readFileSync(abs, "utf8");
  const js = ts.transpileModule(src, {
    fileName: abs,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const mod = { exports: {} };
  const local = (id) => {
    if (id.startsWith("@/")) {
      const rel = "src/" + id.slice(2);
      for (const ext of [".tsx", ".ts"]) { if (fs.existsSync(path.join(TEMPLATE, rel + ext))) return loadKit(rel + ext, req, cache); }
      throw new Error(`kit alias not found: ${id}`);
    }
    return req(id);
  };
  new Function("require", "module", "exports", js)(local, mod, mod.exports);
  cache.set(abs, mod.exports);
  return mod.exports;
}

const req = resolver();
const React = req("react");
const { renderToString } = req("react-dom/server");
const { useForm } = req("react-hook-form");
const F = loadKit("src/components/ui/form.tsx", req);
const h = React.createElement;

test("a bare FormLabel, FormControl, FormDescription and FormMessage render outside any form", () => {
  // The shape that crashed /gear: the primitives as an ordinary label and wrapper.
  const html = renderToString(h("div", null,
    h(F.FormLabel, null, "Your name"),
    h(F.FormControl, null, h("input", { name: "n" })),
    h(F.FormDescription, null, "as it appears on the ticket"),
    h(F.FormMessage, null, "required"),
  ));
  assert.match(html, /<label[^>]*>Your name<\/label>/, "the bare label did not render");
  assert.match(html, /<input[^>]*name="n"/, "the bare control did not render its child");
  assert.match(html, /as it appears on the ticket/);
  assert.match(html, /required/);
  // The control is wired the way a real one is: its id is what the label points at.
  const forId = html.match(/<label[^>]*for="([^"]+)"/);
  assert.ok(forId && /-form-item$/.test(forId[1]), "the label points at no form item id");
  assert.match(html, /aria-invalid="false"/, "a bare control reports an error it cannot have");
});

test("inside a real form the field's error still reaches the label, the control and the message", () => {
  function Real() {
    const form = useForm({ defaultValues: { email: "" }, errors: { email: { type: "required", message: "Email is required" } } });
    return h(F.Form, form, h(F.FormField, {
      control: form.control, name: "email",
      render: ({ field }) => h(F.FormItem, null, h(F.FormLabel, null, "Email"), h(F.FormControl, null, h("input", field)), h(F.FormMessage, null)),
    }));
  }
  const html = renderToString(h(Real));
  assert.match(html, /<label[^>]*class="[^"]*text-destructive[^"]*"[^>]*>Email<\/label>/, "the error no longer colours the label");
  assert.match(html, /aria-invalid="true"/, "the error no longer marks the control invalid");
  assert.match(html, /Email is required/, "the error message no longer renders");
  // One id binds the three: the label's `for`, the control's `id`, the message's id prefix.
  const forId = html.match(/<label[^>]*for="([^"]+)"/)[1];
  assert.ok(html.includes(`id="${forId}"`), "the label and the control no longer share the FormItem's id");
  assert.ok(html.includes(`id="${forId}-message"`), "the message no longer carries the FormItem's id");
});

test("the hook order is stable across the two shapes (no conditional hook)", () => {
  // A component that renders a bare label and, in a second pass, the same
  // label inside a FormItem — React refuses a changed hook count between
  // renders in development, and a conditional `useId` would be exactly that.
  const src = fs.readFileSync(path.join(TEMPLATE, "src/components/ui/form.tsx"), "utf8");
  const hook = src.slice(src.indexOf("const useFormField = () => {"), src.indexOf("\n};", src.indexOf("const useFormField = () => {")));
  assert.ok(hook.length > 50, "useFormField is missing");
  // Every hook call in it is THE WHOLE STATEMENT — `const x = useThing(…);` —
  // never a branch of a ternary, an `&&`, or an `if`. A server render cannot
  // see a conditional hook (one pass, one branch), so the shape is read: the
  // sweep's `itemContext ? "" : React.useId()` survived a looser read that
  // looked for the hook right after the `?`.
  const hookLines = hook.split("\n").filter((l) => /\buse[A-Z]\w*\(/.test(l) && !/^\s*\/\//.test(l));
  assert.ok(hookLines.length >= 4, `useFormField calls fewer hooks than it did (${hookLines.length})`);
  for (const line of hookLines) {
    assert.match(line, /^\s*const \w+ = (?:React\.)?use[A-Z]\w*\([^)]*\);\s*(?:\/\/.*)?$/, `a hook that is not the whole statement: ${line.trim()}`);
  }
  assert.doesNotMatch(hook, /throw new Error/, "useFormField throws again");
});
