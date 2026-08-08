// One colour, changed — the escape hatch from an anchored look.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  TOKENS, WRITABLE, MAX_TOKENS, isColor, luminance, withContrast,
  parseTokens, mergeTokens, tokensCss, tokenNote,
} from "../builder/site-tokens.mjs";

// ── what may be a colour ──────────────────────────────────────────────────────

test("real colours are accepted", () => {
  // `#ff00` is in here on purpose: four digits is RGBA shorthand and is legal
  // CSS. Alpha is ALLOWED — `luminance` ignores it, so the contrast pass still
  // picks readable text, and a translucent border is a reasonable thing to ask
  // for. A fully transparent surface just falls through to the page behind it,
  // which is odd but not broken, and refusing valid CSS on a technicality is
  // not this guard's job.
  for (const v of ["#fc0", "#ff00", "#ffcc00", "#ffcc0080", "#FFCC00",
                   "rgb(255, 204, 0)", "rgb(255 204 0)", "rgba(255,204,0,0.5)",
                   "hsl(48, 100%, 50%)", "oklch(0.85 0.18 95)", "oklch(0.85 0.18 95 / 0.5)",
                   "lab(50% 40 59)", "lch(50% 70 40)"]) {
    assert.equal(isColor(v), true, v + " should be a colour");
  }
});

test("anything that could be CSS instead of a colour is refused", () => {
  // THE WHOLE POINT OF THE ALLOW-LIST. This value is written into a stylesheet
  // in the build container, so a `;` or a `}` closes the declaration and the
  // rule and appends whatever came next. There is no correct escape for
  // "arbitrary text in a CSS value"; the set of things a colour can look like
  // is small enough to list instead.
  for (const v of [
    "#fc0; } body { display: none",
    "red; }*{color:red}",
    "url(https://evil.example/x.png)",
    "var(--secret)",
    "expression(alert(1))",
    "image-set('a.png')",
    "#fc0 !important",
    "attr(data-x)",
    "</style><script>alert(1)</script>",
    "rgb(255,204,0) /* ",
    "//evil",
    "#fc0\\3b  color:red",
    "", "   ", null, undefined, 0, {}, [], "#gg0000", "#f", "#ff", "#fffff", "#fffffff",
    "rgb(255)", "notacolor", "transparent", "currentColor", "inherit",
  ]) {
    assert.equal(isColor(v), false, JSON.stringify(v) + " must be refused");
  }
});

test("a named colour is refused, deliberately", () => {
  // Not an oversight — the 148 CSS names would have to be carried here, and the
  // model is told to answer in hex. Pinned so "we forgot red" and "we decided
  // against names" do not look identical in a year.
  for (const v of ["red", "rebeccapurple", "white", "black"]) assert.equal(isColor(v), false);
});

test("a function that is not a colour function is refused", () => {
  // NOT covered by the numeric-argument rule, and that is why the name list
  // exists: `translate(1, 2)` and `scale(1 2 3)` take exactly the arguments a
  // colour does. Written into a stylesheet as a colour, a browser drops the
  // declaration and the customer is told the change was applied — the same
  // silent failure the required separator fixed.
  for (const v of ["translate(1, 2)", "scale(1 2 3)", "calc(1 2 3)", "rotate(45 1 1)", "matrix(1 2 3)"]) {
    assert.equal(isColor(v), false, v + " must be refused");
  }
});

test("both patterns are anchored, which is what refuses CSS", () => {
  // THE GUARD, after a sweep proved the explicit `;{}<>` check, the `/*` check
  // and the length bound were all inert: `^…$` already refuses every one. That
  // makes the anchors load-bearing rather than incidental, so they are pinned —
  // unanchor either pattern and `#fc0; } body { display: none }` is a colour.
  const src = fs.readFileSync(new URL("../builder/site-tokens.mjs", import.meta.url), "utf8");
  const hex = src.match(/const HEX = (\/.*\/i?);/);
  assert.ok(hex, "the hex pattern moved — re-point this guard");
  assert.ok(hex[1].startsWith("/^") && /\$\/i?$/.test(hex[1]), "the hex pattern must be anchored at both ends: " + hex[1]);
  assert.match(src, /"\^\(rgb\|/, "the function pattern must start anchored");
  assert.match(src, /"\\\\s\*\\\\\)\$"/, "…and end anchored");
  assert.equal(isColor("#" + "f".repeat(200)), false, "and an absurd input is still refused");
  assert.equal(isColor("rgb(" + "1,".repeat(60) + "1)"), false);
});

// ── the list is real ──────────────────────────────────────────────────────────

// The template declares its palette across SEVERAL `:root` blocks — a small one
// near the top and the real one further down — so a scan that took the first
// found four tokens and reported the list broken. Every block, unioned.
function declaredIn(css, selector) {
  const out = new Set();
  let i = 0;
  for (;;) {
    i = css.indexOf(selector + " {", i);
    if (i < 0) break;
    let depth = 0, end = i;
    for (let j = css.indexOf("{", i); j < css.length; j++) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") { depth--; if (!depth) { end = j; break; } }
    }
    for (const m of css.slice(i, end).matchAll(/--([a-z0-9-]+):/g)) out.add(m[1]);
    i = end + 1;
  }
  return out;
}

test("every token we allow is one the template actually declares", () => {
  // A NAME NOBODY READS IS A NO-OP THAT REPORTS SUCCESS. The patch writes
  // `--whatever: #fc0` into the stylesheet whether or not anything consumes it,
  // so a typo here — or a token the template drops later — is a colour change
  // the customer is told was applied and that moves nothing on the page. That
  // is the exact failure shape this repo has recorded at five separate layers.
  //
  // Checked against BOTH halves, because they fail differently: the `:root`
  // blocks are what the patch overrides, and the `@theme` block is what makes
  // `bg-success` a class at all. A token declared but not mapped is unreachable
  // from a page; a token mapped but not declared has no value to start from.
  const css = fs.readFileSync(new URL("../builder/lovable/template/src/styles.css", import.meta.url), "utf8");
  const declared = declaredIn(css, ":root");
  assert.ok(declared.size > 30, `only ${declared.size} tokens found at :root — the scan broke`);
  assert.deepEqual(WRITABLE.filter((t) => !declared.has(t)), [],
    "these are written into the stylesheet and read by nothing");

  const mapped = new Set([...css.matchAll(/--color-([a-z0-9-]+):/g)].map((m) => m[1]));
  assert.deepEqual(WRITABLE.filter((t) => !mapped.has(t)), [],
    "these have no Tailwind class, so no page can use them");
});

test("the dark palette declares them too, since the patch writes both", () => {
  // `tokensCss` writes `:root` AND `.dark`. A token the dark block never
  // declares would be introduced by us there rather than overridden — harmless
  // today, and worth knowing if it ever stops being true.
  const css = fs.readFileSync(new URL("../builder/lovable/template/src/styles.css", import.meta.url), "utf8");
  const declared = declaredIn(css, ".dark");
  assert.ok(declared.size > 30, `only ${declared.size} tokens found at .dark — the scan broke`);
  assert.deepEqual(WRITABLE.filter((t) => !declared.has(t)), []);
});

test("the status colours are askable, and carry their own readable text", () => {
  // 33 kit components paint with `success`/`warning` and all 33 are offered to
  // the generator, so they really do appear on generated pages — they were the
  // only page colours a customer could not touch at all.
  assert.ok(TOKENS.includes("success") && TOKENS.includes("warning"));
  assert.equal(withContrast({ success: "#116644" })["success-foreground"], "#fafafa");
  assert.equal(withContrast({ warning: "#ffd166" })["warning-foreground"], "#0a0a0a");
  assert.match(tokenNote({ success: "#116644" }, []), /success/, "and they have a plain-language name");
});

test("what is deliberately OUT stays out", () => {
  // Each of these is a decision with a reason in the module, and "we forgot" and
  // "we decided against" look identical in a list of names a year later.
  for (const t of ["radius", "chart-1", "chart-2", "chart-3", "chart-4", "chart-5",
                   "sidebar", "sidebar-foreground", "sidebar-primary", "sidebar-border"]) {
    assert.equal(TOKENS.includes(t), false, t + " is excluded on purpose — see the comment on TOKENS");
    assert.equal(WRITABLE.includes(t), false, t + " must not be writable either");
  }
});

test("every plain-language name covers a token that can be asked for", () => {
  // The note is the only thing the customer reads. A token with no entry falls
  // back to its raw name and says "Changed the popover" at somebody.
  const src = fs.readFileSync(new URL("../builder/site-tokens.mjs", import.meta.url), "utf8");
  const said = src.slice(src.indexOf("const SAID"), src.indexOf("});", src.indexOf("const SAID")));
  for (const t of TOKENS) {
    assert.match(said, new RegExp('(^|[\\s{,])"?' + t + '"?\\s*:'), t + " has no plain-language name");
  }
});

// ── contrast ──────────────────────────────────────────────────────────────────

test("a changed surface gets a legible partner", () => {
  // THE FAILURE THIS EXISTS FOR IS TOTAL, not cosmetic: a theme's foreground is
  // picked for its own background, so "make the background black" on a light
  // theme paints near-black text on black. The page renders perfectly and
  // cannot be read, and the customer had no way to know they had to ask for the
  // second colour too.
  assert.equal(withContrast({ background: "#ffcc00" }).foreground, "#0a0a0a");
  assert.equal(withContrast({ background: "#101010" }).foreground, "#fafafa");
  assert.equal(withContrast({ primary: "#003366" })["primary-foreground"], "#fafafa");
  assert.equal(withContrast({ card: "#ffffff" })["card-foreground"], "#0a0a0a");
});

test("an explicitly chosen pair is left alone, however bad", () => {
  const out = withContrast({ background: "#000000", foreground: "#111111" });
  assert.equal(out.foreground, "#111111", "the customer named both — that is their call");
});

test("a surface whose luminance cannot be read leaves its partner alone", () => {
  // A guess here is worse than no change: the wrong guess is unreadable text.
  const out = withContrast({ background: "oklch(0.85 0.18 95)" });
  assert.equal("foreground" in out, false);
  assert.equal(out.background, "oklch(0.85 0.18 95)", "the surface itself still applies");
});

test("the quiet text follows the GROUND, not its own token's name", () => {
  // FOUND BY LOOKING AT A RENDER. `text-muted-foreground` is drawn on the page,
  // not on `--muted`, so a dark background under a light theme left every line
  // of body copy in the light theme's dark grey — almost invisible, on a page
  // that compiled, bundled, published and passed every assertion in the suite.
  assert.equal(withContrast({ background: "#0d3b3b" })["muted-foreground"], "#a1a1aa");
  assert.equal(withContrast({ background: "#ffcc00" })["muted-foreground"], "#52525b");
});

test("the quiet text stays QUIET — it is not filled from the pairing loop", () => {
  // Derived after the loop, `muted-foreground` would be filled from `--muted`
  // and come out as the same near-white as the main text: readable, and no
  // longer a hierarchy. The ordering is the whole difference.
  const out = withContrast({ background: "#0d3b3b", muted: "#0d3b3b" });
  assert.equal(out["muted-foreground"], "#a1a1aa");
  assert.notEqual(out["muted-foreground"], out.foreground);
});

test("a chosen quiet colour is left alone", () => {
  assert.equal(withContrast({ background: "#0d3b3b", "muted-foreground": "#ff0000" })["muted-foreground"], "#ff0000");
});

test("the background drags NOTHING else with it", () => {
  // A first attempt also moved `card`, `popover` and `muted` onto the new
  // ground. That is a design decision nobody asked for, and it made `--muted`
  // equal to the page — so every loading skeleton became invisible.
  const out = withContrast({ background: "#0d3b3b" });
  for (const k of ["card", "popover", "muted", "primary", "border"]) {
    assert.equal(k in out, false, k + " must not be moved by a background change");
  }
  assert.deepEqual(Object.keys(out).sort(), ["background", "foreground", "muted-foreground"]);
});

test("a derived partner really reaches the stylesheet", () => {
  // THE ASK LIST AND THE WRITE LIST ARE DIFFERENT, and sharing one silently
  // enforced the stricter at both: `card-foreground` and `muted-foreground` are
  // names the designer is deliberately not offered, so with a single allow-list
  // the function that derives them had its output dropped by the function meant
  // to write it.
  const css = tokensCss(withContrast({ background: "#0d3b3b", card: "#123" }));
  assert.match(css, /--muted-foreground: #a1a1aa;/);
  assert.match(css, /--card-foreground: #fafafa;/);
  assert.match(css, /--foreground: #fafafa;/);
});

test("an expanded patch is not truncated by the ASK cap", () => {
  // A legal ask of MAX_TOKENS surfaces expands past MAX_TOKENS once every
  // partner is derived. Capping the write at the ask's number would silently
  // drop the readable text colours — the exact half that must never be lost.
  const ask = {};
  for (const t of TOKENS.slice(0, MAX_TOKENS)) ask[t] = "#0d3b3b";
  const css = tokensCss(withContrast(ask));
  const written = (css.match(/--[a-z-]+:/g) || []).length / 2;   // :root and .dark
  assert.ok(written > MAX_TOKENS, `only ${written} written for an ask of ${MAX_TOKENS}`);
});

test("a name the designer may not ask for is still refused at the ASK layer", () => {
  // The write list is wider; the ask list must not have widened with it, or a
  // designer could set a derived partner directly and defeat the contrast pass.
  assert.deepEqual(parseTokens({ "card-foreground": "#fff" }).tokens, {});
  assert.deepEqual(parseTokens({ "muted-foreground": "#fff" }).dropped, ["muted-foreground"]);
});

test("withContrast does not invent tokens for surfaces nobody set", () => {
  assert.deepEqual(Object.keys(withContrast({})), []);
  assert.deepEqual(Object.keys(withContrast({ border: "#ff0000" })), ["border"],
    "a border has no foreground partner and must not grow one");
});

test("luminance reads the shapes it claims to", () => {
  assert.equal(luminance("#000000"), 0);
  assert.equal(luminance("#ffffff"), 1);
  assert.ok(luminance("#fff") === 1, "shorthand hex expands");
  assert.ok(Math.abs(luminance("rgb(255,255,255)") - 1) < 1e-9);
  assert.ok(Math.abs(luminance("rgb(100%, 100%, 100%)") - 1) < 1e-9);
  assert.equal(luminance("oklch(0.5 0 0)"), null, "unreadable is null, never a guess");
  assert.equal(luminance("nonsense"), null);
  assert.equal(luminance(null), null);
});

// ── parsing ───────────────────────────────────────────────────────────────────

test("an unknown token is dropped, not renamed or passed through", () => {
  const { tokens, dropped } = parseTokens({ background: "#fff", radius: "2rem", "--chart-1": "#f00", nonsense: "#0f0" });
  assert.deepEqual(tokens, { background: "#fff" });
  assert.deepEqual(dropped.sort(), ["--chart-1", "nonsense", "radius"]);
});

test("a token is accepted with or without the leading dashes, and in any case", () => {
  assert.deepEqual(parseTokens({ "--Background": "#fff" }).tokens, { background: "#fff" });
  assert.deepEqual(parseTokens({ " PRIMARY ": "#fff" }).tokens, { primary: "#fff" });
});

test("a bad value drops its token and says so", () => {
  const { tokens, dropped } = parseTokens({ background: "red; }*{}", primary: "#003366" });
  assert.deepEqual(tokens, { primary: "#003366" });
  assert.deepEqual(dropped, ["background"]);
});

test("junk input parses to nothing rather than throwing", () => {
  for (const v of [null, undefined, "", 0, "background", true, [1, 2, 3], [null]]) {
    assert.deepEqual(parseTokens(v).tokens, {}, JSON.stringify(v));
  }
});

test("an array of {token, color} is read too", () => {
  // A tool schema can be changed to an array and this should not silently
  // become "no colours at all", which is indistinguishable from working.
  assert.deepEqual(parseTokens([{ token: "background", color: "#fff" }, { name: "primary", value: "#000" }]).tokens,
    { background: "#fff", primary: "#000" });
});

test("more than the cap is refused rather than truncated silently", () => {
  const many = {};
  for (const t of TOKENS) many[t] = "#ffffff";
  const { tokens, dropped } = parseTokens(many);
  assert.equal(Object.keys(tokens).length, MAX_TOKENS);
  assert.equal(dropped.length, TOKENS.length - MAX_TOKENS, "the overflow must be reported, not vanish");
});

// ── merging ───────────────────────────────────────────────────────────────────

test("a revise ADDS to the patch instead of replacing it", () => {
  // A revise names only what it is changing, so a replacing merge hands back
  // the theme's own background on the second revise — which reads as the first
  // instruction being forgotten.
  assert.deepEqual(mergeTokens({ background: "#ffcc00" }, { accent: "#003366" }),
    { background: "#ffcc00", accent: "#003366" });
});

test("the newest instruction wins on the same token", () => {
  assert.deepEqual(mergeTokens({ background: "#ffcc00" }, { background: "#003366" }), { background: "#003366" });
});

test("a merge that would exceed the cap keeps the NEW colours", () => {
  // The customer is looking at the result of their most recent instruction.
  const prior = {};
  for (const t of TOKENS.slice(0, MAX_TOKENS)) prior[t] = "#ffffff";
  const merged = mergeTokens(prior, { destructive: "#ff0000" });
  assert.equal(Object.keys(merged).length, MAX_TOKENS);
  assert.equal(merged.destructive, "#ff0000", "the newly asked-for colour must survive");
});

test("a stored patch that has gone bad cannot poison a build", () => {
  // `_meta` is read back as JSON and could hold anything an older version wrote.
  assert.deepEqual(mergeTokens({ background: "url(x)" }, { primary: "#003366" }), { primary: "#003366" });
  assert.deepEqual(mergeTokens("nonsense", null), {});
});

// ── the CSS ───────────────────────────────────────────────────────────────────

test("an empty patch writes NOTHING, not an empty rule", () => {
  // A site that never asked for a colour must get a byte-identical stylesheet
  // to the build before this existed.
  for (const v of [{}, null, undefined, { radius: "2rem" }, { background: "red" }]) {
    assert.equal(tokensCss(v), "", JSON.stringify(v));
  }
});

test("the patch is written for BOTH modes", () => {
  // The template ships a dark palette and a visitor can be in either. Patching
  // `:root` alone gives the customer a yellow background that is yellow for
  // them and white for half their visitors — reported as "it didn't work" by
  // somebody looking at a correctly-patched page in the other mode.
  const css = tokensCss({ background: "#ffcc00" });
  assert.match(css, /:root \{[^}]*--background: #ffcc00;/);
  assert.match(css, /\.dark \{[^}]*--background: #ffcc00;/);
});

test("nothing unparseable can reach the stylesheet", () => {
  const css = tokensCss({ background: "#fc0; } body { display:none", primary: "#003366" });
  assert.ok(!css.includes("display:none"));
  assert.match(css, /--primary: #003366;/);
  // Two rules, two braces each, and nothing else.
  assert.equal((css.match(/\{/g) || []).length, 2);
  assert.equal((css.match(/\}/g) || []).length, 2);
});

// ── the note ──────────────────────────────────────────────────────────────────

test("the note names what changed in plain words", () => {
  assert.equal(tokenNote({ background: "#ffcc00" }, []), "Changed the background.");
  assert.match(tokenNote({ background: "#fff", primary: "#000" }, []), /background and buttons/);
  assert.ok(!tokenNote({ primary: "#000" }, []).includes("primary"), "token names are not customer words");
});

test("a refused colour is NAMED, not swallowed", () => {
  // Somebody who asks for a colour we cannot use, and is told nothing, reads
  // the unchanged page as the builder being broken.
  const n = tokenNote({}, ["accent"]);
  assert.match(n, /Couldn/);
  assert.match(n, /highlights/);
  assert.match(n, /#/, "it must say what a usable answer looks like");
});

test("a build that asked for no colour gets no sentence", () => {
  for (const args of [[{}, []], [null, null], [{}, undefined], [undefined, []]]) {
    assert.equal(tokenNote(...args), "", JSON.stringify(args));
  }
});

// ── the seams ─────────────────────────────────────────────────────────────────

const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const server = fs.readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8");

test("the patch is written AFTER the theme, which is the whole mechanism", () => {
  // These are the same custom properties the theme declares, so the override is
  // entirely a question of order. Written first, it is silently overwritten and
  // the feature does nothing — a failure with no error anywhere.
  const theme = server.indexOf("const themeUsed = writeTheme(");
  const tokens = server.indexOf("const tokensUsed = writeTokens(");
  assert.ok(theme > 0, "the theme write moved — re-point this guard");
  assert.ok(tokens > 0, "nothing applies the token patch in the container");
  assert.ok(theme < tokens, "the patch must be written after the theme, or later never wins");
});

test("the container's token write cannot fail a build that otherwise worked", () => {
  const i = server.indexOf("function writeTokens(");
  const body = server.slice(i, server.indexOf("\n}", i));
  assert.equal((body.match(/try \{/g) || []).length, 2, "both the render and the read must be guarded");
  assert.match(body, /catch/);
});

test("the chain from the designer to the stylesheet is unbroken", () => {
  // SEVEN LINKS, and any one missing makes the feature dead while every test
  // passes — which is the failure this repo has recorded at five separate
  // layers. The designer can ask, the ask is parsed, it is merged with what the
  // site already had, it is stored, it is passed to the build, it reaches the
  // container payload, and the container writes it.
  assert.match(worker, /tokens: \{\s*\n\s*type: "object"/, "the designer must be able to ask");
  assert.match(worker, /mergeTokens\(priorTokens, designed && designed\.tokens\)/, "the ask must merge with the stored patch");
  assert.match(worker, /INSERT INTO _meta \(k,v\) VALUES \('site_tokens'/, "the patch must be stored");
  assert.match(worker, /site_look','site_tokens'/, "…and read back on a revise");
  // THE WHOLE STATEMENT, condition included. Anchored on the assignment alone
  // this passed against `if (false) priorTokens = JSON.parse(r.v)` — a mutant
  // that leaves the text intact and reads nothing back, so every revise would
  // start from an empty patch and forget the last colour. Selecting a row and
  // then not carrying it is the shape that has killed a feature here before.
  assert.match(worker, /if \(r\.k === "site_tokens" && r\.v\)\s*priorTokens = JSON\.parse\(r\.v\)/,
    "the stored patch must be read back on a revise");
  assert.match(worker, /tokens: siteTokens,/, "the build must be given it");
  assert.match(worker, /tokens: Object\.keys\(tokens \|\| \{\}\)\.length \? withContrast\(tokens\) : undefined/,
    "the container payload must carry it, with the contrast pass");
  assert.match(server, /tokensCss\(tokens\)/, "the container must render it");
  assert.match(worker, /tokensNote: tokenNote\(tokenAsk\.tokens, tokenAsk\.dropped\)/,
    "…and the customer must be told, or a colour that did not land reads as the builder being broken");
});

test("the container really WRITES the patch, not just reports it", () => {
  // The only unit-level hold on the write itself. A `writeTokens` that returns
  // `{applied:true}` and writes nothing is a feature that reports success and
  // does nothing — caught end to end by `test/integration/site-build.mjs`,
  // which compiles a real bundle and reads the colour out of it, but that runs
  // in its own CI job and not in `npm test`.
  const i = server.indexOf("function writeTokens(");
  assert.ok(i > 0, "writeTokens is gone");
  const body = server.slice(i, server.indexOf("\n}", i));
  assert.match(body, /fs\.writeFileSync\(STYLES,[^)]*css/,
    "the rendered CSS must be written to the stylesheet, not merely computed");
  assert.ok(body.indexOf("fs.writeFileSync") < body.indexOf("applied: true"),
    "…before it reports success");
});

test("the designer's token list is the module's, not a second copy", () => {
  // A hand-written enum here would drift from `TOKENS` and offer the model a
  // property that `parseTokens` then silently drops — a colour change that
  // reports success and does nothing.
  assert.match(worker, /SITE_TOKEN_NAMES\.map/, "the tool schema must be derived from the module");
  assert.match(worker, /TOKENS as SITE_TOKEN_NAMES/, "…and that name must be the module's export");
});

test("contrast runs at the point of USE, so the stored patch stays the customer's own", () => {
  // Stored post-contrast, a later revise that changes the background would find
  // a foreground already "set" and leave the old derived one in place —
  // unreadable text arriving one revise later than the change that caused it.
  const store = worker.indexOf("VALUES ('site_tokens'");
  const line = worker.slice(worker.lastIndexOf("\n", store), store + 200);
  assert.ok(!/withContrast/.test(line), "the stored patch must be what was asked for, not what was derived");
});
