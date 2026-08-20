// One colour, changed — the escape hatch from an anchored look.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  TOKENS, SIZES, ASKABLE, WRITABLE, MAX_TOKENS, isColor, isLength, valueHint,
  normalizeLength, stripThemeRadius, validForWrite,
  luminance, withContrast, parseTokens, mergeTokens, tokensCss, tokenNote,
  PAIRED, saidFor, askedNames,
} from "../builder/site-tokens.mjs";
import { computedSql } from "../site-schema.mjs";

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

  // SPLIT BY KIND, because the two are mapped differently: a colour becomes a
  // class through `--color-<name>`, and `--radius` through the `--radius-*`
  // scale derived from it. One check for both would have demanded a
  // `--color-radius` that has no reason to exist.
  const mapped = new Set([...css.matchAll(/--color-([a-z0-9-]+):/g)].map((m) => m[1]));
  const colours = WRITABLE.filter((t) => !SIZES.includes(t));
  assert.deepEqual(colours.filter((t) => !mapped.has(t)), [],
    "these have no Tailwind class, so no page can use them");
  for (const t of SIZES) {
    assert.match(css, new RegExp("--" + t + "-lg:\\s*[^;]*var\\(--" + t + "\\)"),
      t + " must be the value the kit's scale is DERIVED from, or changing it moves nothing");
  }
});

test("the dark palette declares every COLOUR, since the patch writes both", () => {
  // `tokensCss` writes `:root` AND `.dark`. A colour the dark block never
  // declares would be introduced by us there rather than overridden.
  //
  // Sizes are deliberately exempt: `--radius` is declared once and does not vary
  // by mode, so our patch adds a declaration to `.dark` rather than overriding
  // one. Same value either way, so it changes nothing — stated rather than left
  // as a scan that quietly fails.
  const css = fs.readFileSync(new URL("../builder/lovable/template/src/styles.css", import.meta.url), "utf8");
  const declared = declaredIn(css, ".dark");
  assert.ok(declared.size > 30, `only ${declared.size} tokens found at .dark — the scan broke`);
  assert.deepEqual(WRITABLE.filter((t) => !SIZES.includes(t) && !declared.has(t)), []);
  for (const t of SIZES) assert.equal(declared.has(t), false, t + " now varies by mode — this exemption needs revisiting");
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
  for (const t of ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5",
                   "sidebar", "sidebar-foreground", "sidebar-primary", "sidebar-border",
                   "radius-sm", "radius-lg", "radius-xl"]) {
    assert.equal(ASKABLE.includes(t), false, t + " is excluded on purpose — see the comments on TOKENS and SIZES");
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

// ── corners ───────────────────────────────────────────────────────────────────

test("a real CSS length is accepted", () => {
  for (const v of ["0", "4px", "0.75rem", ".5rem", "9999px", "50%", "1.5em", "12PX"]) {
    assert.equal(isLength(v), true, v + " should be a length");
  }
});

test("anything that is not a plain length is refused", () => {
  // Same discipline as the colour parser, same reason: this is written into a
  // stylesheet, so the anchors are the guard. `calc()` is refused rather than
  // parsed — the kit's derived sizes already wrap this value in one.
  for (const v of ["-4px", "calc(1rem)", "calc(var(--radius) + 4px)", "4", "4 px",
                   "0px; }*{display:none}", "auto", "inherit", "1vw", "1e3px", "", "   ",
                   null, undefined, {}, [], "var(--radius)"]) {
    assert.equal(isLength(v), false, JSON.stringify(v) + " must be refused");
  }
});

test("a negative radius is refused rather than written", () => {
  // A negative border-radius is invalid CSS, so a browser drops the declaration
  // and the customer is told a change was applied that did nothing. Refusing
  // says so instead — the silent-failure direction this file keeps closing.
  assert.equal(isLength("-1rem"), false);
  assert.deepEqual(parseTokens({ radius: "-1rem" }).dropped, ["radius"]);
});

test("corners and colours are validated by their OWN rules", () => {
  // One shared validator would have refused every radius a customer ever asked
  // for while reporting the token as unknown — and accepted `#fc0` as a length.
  assert.deepEqual(parseTokens({ radius: "0", background: "#fc0" }).tokens,
    { radius: "0", background: "#fc0" });
  assert.deepEqual(parseTokens({ radius: "#fc0" }).dropped, ["radius"], "a colour is not a length");
  assert.deepEqual(parseTokens({ background: "4px" }).dropped, ["background"], "a length is not a colour");
});

test("square corners are expressible, and are not read as 'nothing'", () => {
  // `0` is the whole point of "make the corners square", and it is the value
  // most likely to be lost to a truthiness check somewhere on the way.
  const css = tokensCss({ radius: "0" });
  assert.match(css, /--radius: 0;/);
  assert.equal(parseTokens({ radius: "0" }).tokens.radius, "0");
  assert.equal(mergeTokens({ radius: "1rem" }, { radius: "0" }).radius, "0");
});

test("any zero is the SAME zero, whatever unit it was written in", () => {
  // MEASURED, not reasoned. The kit derives its sizes with
  // `calc(var(--radius) ± Npx)`. A bare `0` makes each of those a
  // `<number> + <length>`, which CSS says is invalid, so every declaration is
  // dropped and every corner comes out square. `0px` and `0rem` are valid
  // lengths, so `rounded-xl` stays at 4px.
  //
  // Rendered side by side: `0` gave button 0 / card 0 / input 0, and `0px` gave
  // 0 / 4 / 0 — the same instruction producing a square site or a half-square
  // one depending on which unit the model happened to pick.
  for (const v of ["0", "0px", "0rem", "0em", "0%", "0PX"]) {
    assert.equal(normalizeLength(v), "0", v);
    assert.equal(parseTokens({ radius: v }).tokens.radius, "0", v);
  }
  assert.equal(normalizeLength("0.5rem"), "0.5rem", "a real length is left exactly as written");
  assert.equal(normalizeLength("10px"), "10px");
});

test("a theme's own corner rules give way to an explicit radius", () => {
  // 280 OF THE 500 THEMES hard-set `border-radius` on buttons and inputs as
  // real rules rather than through `--radius` — measured. On those, "round the
  // corners" moved the cards and left every button square, which is a feature
  // reported as broken rather than as the theme's design.
  const css = "button.x { border-radius: 0; color: red; }\n" +
    ":root { --radius: 0rem; }\n" +
    ".y { border-top-left-radius: 3px; border-bottom-right-radius: 3px }";
  const out = stripThemeRadius(css);
  assert.ok(!/border-radius/.test(out) && !/border-top-left-radius/.test(out), out);
  assert.match(out, /color: red/, "nothing else may be lost");
  assert.match(out, /--radius: 0rem;/, "the custom property is NOT a corner rule — our patch overrides that");
});

test("stripping corner rules cannot damage what it is handed", () => {
  for (const v of [null, undefined, "", "{}", ":root{--radius:1rem}"]) {
    assert.equal(typeof stripThemeRadius(v), "string", JSON.stringify(v));
  }
  assert.equal(stripThemeRadius(":root{--radius:1rem}"), ":root{--radius:1rem}");
});

test("the theme keeps its corners when nobody asked for a radius", () => {
  // The other half, and the one that protects every existing site: with no
  // override the theme's CSS is written exactly as it is today.
  assert.equal(validForWrite({ background: "#fc0" }).radius, undefined);
  assert.equal(validForWrite({}).radius, undefined);
  assert.equal(validForWrite({ radius: "wide" }).radius, undefined, "an unusable radius is not an ask");
  assert.equal(validForWrite({ radius: "0" }).radius, "0", "and square corners ARE an ask");
});

test("the container asks ONE question about the radius", () => {
  // The theme's corner rules give way and the patch is written from the same
  // reading. Two readings would eventually disagree, and the failure is silent:
  // the theme's rules dropped for a radius that was never written.
  const server = fs.readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8");
  assert.match(server, /const wantsRadius = validForWrite\(payload\.tokens\)\.radius !== undefined;/);
  // THE PROPERTY, NOT THE ARGUMENT LIST. This was pinned to the exact call
  // `writeTheme(payload.seeds, { dropRadius: wantsRadius })` and went red the
  // day a second option was passed beside it — a test about word order failing
  // a correct change. What it protects is that the ONE reading above is what
  // decides the strip.
  const call = /writeTheme\(payload\.seeds,\s*\{([^}]*)\}\)/.exec(server);
  assert.ok(call, "nothing calls writeTheme with the payload's palette");
  assert.match(call[1], /dropRadius:\s*wantsRadius/, "the strip is decided by a second reading of the patch");
  const i = server.indexOf("function writeTheme(");
  const body = server.slice(i, server.indexOf("\n}", i));
  assert.match(body, /dropRadius \?[\s\S]{0,200}?stripThemeRadius\(css\)/,
    "the strip no longer hangs off the one reading");
  assert.match(body, /:\s*css;/,
    "with no override the theme's CSS must be written unchanged");
});

test("the corner radius survives the contrast pass untouched", () => {
  // It has no `-foreground` partner and no luminance. A pass that tried to give
  // it one would write `--radius-foreground`, which nothing reads.
  const out = withContrast({ radius: "4px", background: "#0d3b3b" });
  assert.equal(out.radius, "4px");
  assert.equal("radius-foreground" in out, false);
});

test("the model is told corners take a length, not a colour", () => {
  // Described as "#rrggbb" it would answer in hex, the parser would refuse it,
  // and the customer would be told we could not use their colour.
  assert.equal(valueHint("background"), "#rrggbb");
  assert.notEqual(valueHint("radius"), "#rrggbb");
  assert.match(valueHint("radius"), /length/i);
  for (const t of ASKABLE) assert.ok(valueHint(t), t + " has no value hint");
});

test("corners have a plain-language name too", () => {
  assert.match(tokenNote({ radius: "0" }, []), /corner/i);
  assert.ok(!tokenNote({ radius: "0" }, []).includes("radius"), "token names are not customer words");
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

test("THE TEXT ON EACH SURFACE CAN BE ASKED FOR — and the derivation yields to it", () => {
  // REVERSED 2026-08-18. This asserted the nine paired colours were REFUSED at
  // the ask layer, on the reasoning that a designer setting one directly would
  // "defeat the contrast pass". Measured: it does not defeat it, it OVERRIDES
  // it — `withContrast` has always skipped a pairing whose partner is already
  // present — so what the refusal actually did was make "the text on the cards
  // is too light" unanswerable at any price, while the automatic choice stayed
  // a ceiling rather than a default.
  for (const name of PAIRED) {
    assert.deepEqual(parseTokens({ [name]: "#ffffff" }).tokens, { [name]: "#ffffff" },
      "`" + name + "` cannot be asked for, so nobody can correct it");
  }
  // THE PROPERTY THE WHOLE CHANGE RESTS ON, asserted rather than assumed: an
  // explicit value survives the pass that would otherwise compute one.
  assert.equal(withContrast({ card: "#ffffff", "card-foreground": "#3b82f6" })["card-foreground"], "#3b82f6",
    "an explicit text colour is overwritten by the derivation");
  assert.equal(withContrast({ background: "#101418", "muted-foreground": "#3b82f6" })["muted-foreground"], "#3b82f6",
    "an explicit quiet-text colour is overwritten by the ground rule");
  // …and with nothing named, the derivation still does its job.
  assert.equal(withContrast({ card: "#ffffff" })["card-foreground"], "#0a0a0a");
  // A NAME THAT IS NEITHER A TOKEN NOR A PAIRING IS STILL REFUSED.
  assert.deepEqual(parseTokens({ "card-backdrop": "#fff" }).dropped, ["card-backdrop"]);
});

test("every askable name has a plain name, and no two share one", () => {
  // Two tokens sharing a plain name makes one reply say "Updated the look —
  // card colour, card colour" about two different changes — the clash
  // `site-style.mjs` already records, now with nine more names in the pot.
  const said = ASKABLE.map((n) => saidFor(n));
  assert.equal(new Set(said).size, said.length,
    "two tokens are described to the customer with the same words: " +
      said.filter((n, i) => said.indexOf(n) !== i).join(", "));
  for (const n of ASKABLE) {
    assert.notEqual(saidFor(n), n, "`" + n + "` has no plain name, so the reply prints the raw token");
  }
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
  const { tokens, dropped } = parseTokens({ background: "#fff", "chart-1": "#f00", "--sidebar": "#f00", nonsense: "#0f0" });
  assert.deepEqual(tokens, { background: "#fff" });
  assert.deepEqual(dropped.sort(), ["--sidebar", "chart-1", "nonsense"]);
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
  for (const v of [{}, null, undefined, { "chart-1": "#f00" }, { background: "red" }, { radius: "wide" }]) {
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
  assert.equal(tokenNote({ background: "#ffcc00" }, []), "Changed the page colour.");
  assert.match(tokenNote({ background: "#fff", primary: "#000" }, []), /page colour and button colour/);
  assert.ok(!tokenNote({ primary: "#000" }, []).includes("primary"), "token names are not customer words");
  // AND IT SAYS COLOUR, because `site-style.mjs` composes a SECOND sentence into
  // the same note block and its words are about shape and weight. This said
  // "buttons" and "borders", so a build that moved the border colour and the
  // border weight printed "Changed the borders." twice about two different
  // things. The cross-module guard lives in test/site-style.mjs; this pins the
  // half that made the clash — a colour names itself as one.
  assert.match(tokenNote({ primary: "#000", border: "#ccc", input: "#eee" }, []),
    /button colour, border colour and input colour/);
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

test("the tool says the text on a surface is AUTOMATIC, and when to override it", () => {
  // FOUND BY MUTATION — the only survivor of the sweep on this change. Making
  // the nine askable is worth nothing if the model sets them on every colour
  // change: the automatic pairing is right nearly always, so a model that names
  // both gives the customer a text colour they never chose. The permission and
  // the restraint are ONE change, and only the restraint lives in prose, which
  // is exactly the kind of rule a later edit drops silently.
  const at = worker.indexOf("ONLY when the message asks for a specific COLOUR");
  assert.ok(at > 0, "the tokens tool no longer opens the way this scan expects");
  const desc = worker.slice(at, worker.indexOf("// THE HINT IS DERIVED PER TOKEN", at));
  assert.ok(desc.length > 200, "the description window collapsed to nothing");
  assert.match(desc, /WORKED OUT FOR YOU/,
    "the tool does not say the text colour is automatic, so it gets set on every colour change");
  // AND THE POSITIVE CASE, or the model reads a flat prohibition and the nine
  // are unreachable in practice however askable they are in code — the failure
  // `publicView` has already cost a whole site over, twice.
  assert.match(desc, /NAME THE TEXT ONLY WHEN THE TEXT IS WHAT THEY ARE TALKING ABOUT/,
    "the tool never says WHEN to name a text colour, so nobody ever will");
});

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
  assert.match(worker, /ASKABLE as SITE_TOKEN_NAMES/, "…and that name must be the module's export");
  // THE HINT TOO. Described as "#rrggbb", `radius` would be asked for in hex,
  // refused by the parser, and reported back as a colour we could not use.
  assert.match(worker, /description: siteTokenHint\(t\)/, "each token's value hint must be derived, not one line for all");
});

test("contrast runs at the point of USE, so the stored patch stays the customer's own", () => {
  // Stored post-contrast, a later revise that changes the background would find
  // a foreground already "set" and leave the old derived one in place —
  // unreadable text arriving one revise later than the change that caused it.
  const store = worker.indexOf("VALUES ('site_tokens'");
  const line = worker.slice(worker.lastIndexOf("\n", store), store + 200);
  assert.ok(!/withContrast/.test(line), "the stored patch must be what was asked for, not what was derived");
});

// ── retiring a feature ────────────────────────────────────────────────────────

test("a retired table is offered to the generator by nothing", async () => {
  // Half of what makes retiring work: `grantsFor` withdraws its public access,
  // and the digest stops the generator writing a page against it. Told about
  // it, the model builds a list that renders empty and a form that 401s —
  // which looks broken rather than removed.
  const { schemaDigest } = await import("../builder/page-gen.mjs");
  const spec = { tables: [
    { name: "menu", access: "display", columns: ["name"] },
    { name: "enquiries", access: "collect", retired: true, columns: ["message"] },
  ] };
  const d = schemaDigest(spec);
  assert.match(d, /menu/);
  assert.ok(!/enquiries/.test(d), "a retired table must not be described to the model:\n" + d);
});

test("a retired table is reachable from the web by nobody", async () => {
  const { grantsFor } = await import("../site-rls.mjs");
  for (const access of ["display", "collect", "user", "feed", "admin"]) {
    const retired = grantsFor({ name: "t", access, retired: true });
    assert.deepEqual(retired.filter((s) => /^GRANT /.test(s)), [],
      access + ": a retired table must have no grants at all");
    // AND THE WITHDRAWAL HAS TO BE ACTIVE. Emitting no grant removes nothing —
    // a GRANT persists, so a table granted on an earlier build kept its
    // privilege and the removed form went on taking submissions. The REVOKE is
    // what makes retiring real, which is why it is asserted on the retired case
    // rather than left to the general one.
    assert.ok(retired.some((s) => /^REVOKE ALL ON "t" FROM anonymous;/.test(s)),
      access + ": retiring emits no REVOKE, so an earlier grant still stands");
    assert.ok(retired.some((s) => /^REVOKE ALL ON "t" FROM authenticated;/.test(s)), access);
    assert.ok(grantsFor({ name: "t", access }).filter((s) => /^GRANT /.test(s)).length > 0 || access === "admin",
      access + ": the un-retired case must still grant something, or this proves nothing");
  }
});

test("retiring keeps the data — nothing drops a declared table or column", () => {
  // A `collect` table holds real customers' bookings. A model reading "remove
  // the booking page" must never be one step from deleting them.
  //
  // TWO `DROP COLUMN`S ARE LEGITIMATE and both are named rather than excluded by
  // a pattern. Each drops a GENERATED column — derived from other columns and
  // holding nothing of its own — because Postgres has no "replace column" and
  // both are rebuilt when a table's declaration changes: `_fts` when the
  // full-text configuration moves, a `computed` column when its parts do. A
  // blanket "no DROP anywhere" assertion failed on the first, which was the
  // assertion being wrong rather than the code.
  const src = fs.readFileSync(new URL("../site-schema.mjs", import.meta.url), "utf8");
  assert.ok(!/DROP\s+TABLE/i.test(src), "the schema engine must never drop a table");
  const drops = [...src.matchAll(/DROP\s+COLUMN[^\n]*/gi)].map((m) => m[0]);
  assert.equal(drops.length, 2, "unexpected column drops: " + drops.join(" ; "));

  // AND THE PROPERTY THAT MAKES THE SECOND ONE SAFE, which a count cannot see.
  // `computed` names the column it creates, so a declaration naming an EXISTING
  // column would drop the customer's data and replace it with a derived value —
  // on every revise, silently. Refused in `computedSql`, and asserted here
  // rather than only there, because this is the test that exists to say the
  // engine never destroys a row.
  const cols = new Set(["title", "first_name", "last_name"]);
  assert.deepEqual(
    computedSql({ name: "t", computed: { title: ["first_name"] } }, cols), [],
    "a computed column named after a real column must be refused — it would DROP it");
  assert.deepEqual(
    computedSql({ name: "t", computed: { id: ["first_name"] } }, cols), [],
    "and a managed column even more so");
  assert.equal(
    computedSql({ name: "t", computed: { full_name: ["first_name", " ", "last_name"] } }, cols).length, 1,
    "…while a genuinely new name is still emitted, or the assertions above pass on a dead function");
  assert.match(drops[0], /tsv/, "the only column drop must be the managed search column");
});

test("`retired` survives BOTH allow-lists on the way through the schema engine", () => {
  // `coerceTable` and `norm.push` each build their output field by field, so a
  // property nobody added to those literals is dropped SILENTLY on every build
  // — the fifth-layer death `teamScope` suffered, where the flag was
  // declarable, given DDL, stored and read, and stripped by the one function
  // every schema passes through.
  const src = fs.readFileSync(new URL("../site-schema.mjs", import.meta.url), "utf8");
  assert.match(src, /retired: retiredOf\(def\)/, "the designer's flag is not parsed");
  assert.match(src, /norm\.push\(\{[^}]*retired: t\.retired/, "…or it is parsed and then dropped");
  // AND NOT COERCED ON THE WAY THROUGH. `!!` collapses "said nothing" into
  // "not retired", which is what let a later revise wipe the flag.
  assert.ok(!/retired: !!/.test(src), "`retired` must stay three-valued — undefined means 'keep what it was'");
});

test("saying nothing about a table does not un-retire it", async () => {
  // THE BUG THIS EXISTS FOR. The schema merge is whole-object per table, so a
  // later revise that re-listed a table without mentioning `retired` wiped the
  // flag and restored its public write grant — a contact form the owner removed
  // quietly taking submissions again, with nothing on the site to show for it.
  // `normalizeSchema` is the one function every schema passes through — the
  // same one that silently dropped `teamScope` for five layers. `parseSchemaSpec`
  // only reads the file; it normalises nothing.
  const { normalizeSchema } = await import("../site-schema.mjs");
  const of = (def) => (normalizeSchema({ tables: [def] }).tables || [])[0];

  assert.equal(of({ name: "t", access: "collect", columns: ["a"], retired: true }).retired, true);
  assert.equal(of({ name: "t", access: "collect", columns: ["a"], retired: false }).retired, false,
    "false is the only way to put a removed feature back");
  assert.equal(of({ name: "t", access: "collect", columns: ["a"] }).retired, undefined,
    "saying nothing must stay UNDEFINED, not become false");
});

test("the merge inherits a flag this run said nothing about", () => {
  // The other end of the same invariant, on the source: `undefined` has to be
  // distinguished from `false` at the point the two schemas are merged.
  const src = fs.readFileSync(new URL("../site-schema.mjs", import.meta.url), "utf8");
  // THIS WAS ONE SPECIAL CASE AND IS NOW THE GENERAL RULE. It pinned the exact
  // `retired` line; the override is whole-object, so EVERY field a revise did
  // not restate was being dropped, not just that one — measured, a revise that
  // re-declared a table for an unrelated reason lost its `confirm`.
  assert.match(src, /for \(const k of Object\.keys\(prevT\)\) \{\s*\n\s*if \(t\[k\] === undefined \|\| t\[k\] === null\) t\[k\] = prevT\[k\];/,
    "a table re-listed without a field must keep whatever that field was");
  // NULL HAS TO COUNT AS SILENCE. `coerceTable` turns an unmentioned optional
  // into an explicit null — `confirm: normalizeConfirm(def)` is null when none
  // was declared — so filling only on `undefined` fixes nothing for exactly the
  // fields this exists for. Asserted apart from the loop above, because the
  // `undefined` half alone looks correct and covers none of the real cases.
  assert.match(src, /t\[k\] === undefined \|\| t\[k\] === null/,
    "an unmentioned optional field is stored as null, so null must read as silence");
  // …and a value that IS stated still wins, or nothing could ever be changed:
  // `retired: false` is how a removed feature is put back, and false is neither.
  assert.ok(!/t\[k\] === undefined \|\| !t\[k\]/.test(src),
    "falsy is being read as silence, so `retired: false` can never restore a table");
});

test("an apply that declares nothing cannot erase the stored schema", () => {
  // A LOOK-ONLY REVISE NOW REACHES HERE WITH ZERO TABLES.
  //
  // "Make the background yellow" declares nothing to store, and until 2026-08-09
  // the route refused it outright — so this line could never be reached with an
  // empty `norm`. Now it can, and `_meta.schema` is the ONLY copy the request
  // path reads: writing `{tables: []}` over a real schema takes every table off
  // the data API while its rows sit untouched in Postgres.
  //
  // The merge above normally hands the stored tables back. It is wrapped in a
  // bare `catch {}`, though — a transient read failure leaves `mergedTables` as
  // that empty list, and this would publish it.
  const src = fs.readFileSync(new URL("../site-schema.mjs", import.meta.url), "utf8");
  const write = src.indexOf(`INSERT INTO _meta (k,v) VALUES ('schema', ?)`);
  assert.ok(write > 0, "the schema write moved — rescope this");

  // Anchored on what is IMMEDIATELY above the write, not on the guard existing
  // somewhere in the file: a condition that does not enclose the statement is
  // not a guard.
  const before = src.slice(src.lastIndexOf("\n", src.lastIndexOf("\n", write - 1) - 1), write);
  assert.match(before, /if \(mergedTables\.length \|\| norm\.length\) \{/,
    "the schema write is not gated — an apply with nothing to say erases the site's tables");

  // BOTH HALVES ARE LOAD-BEARING, and either alone is wrong in a different way.
  // `norm.length` alone skips the write on the ordinary revise that merged
  // successfully and declared nothing, leaving `_meta` stale against DDL that
  // just ran. `mergedTables.length` alone is what the merge failure produces.
  // Asserted apart so a mutation dropping one is caught.
  const cond = before.slice(before.indexOf("if ("));
  assert.ok(/mergedTables\.length/.test(cond), "the merged list is not consulted");
  assert.ok(/norm\.length/.test(cond), "this run's own tables are not consulted");
  assert.ok(/\|\|/.test(cond) && !/&&/.test(cond),
    "the two halves are ANDed — either can be empty on a legitimate apply, so " +
    "requiring both skips writes that must happen");
});

test("THE CAP DROPS EXACTLY WHAT IT HAS TO, AND NOT ONE MORE", () => {
  // The identical slice-before-dedup bug `mergeStyle` carried, one module over.
  // `[...Object.keys(b), ...keys]` lists a RESTATED colour twice — once from the
  // edit, once from the merge — so slicing before the Set let a duplicate occupy
  // a slot and the kept set came out short. A customer with a full patch lost an
  // extra earlier colour they never asked to change, silently.
  const names = ASKABLE.slice(0, MAX_TOKENS);
  assert.equal(names.length, MAX_TOKENS, "not enough askable tokens to fill the cap");
  const prior = Object.fromEntries(names.map((n) => [n, "#101010"]));
  // Restate one, add one that is not already stored.
  const extra = ASKABLE[MAX_TOKENS];
  assert.ok(extra, "the cap is the whole askable list — this case cannot arise");
  const out = mergeTokens(prior, { [names[0]]: "#ffcc00", [extra]: "#00ccff" });
  assert.equal(Object.keys(out).length, MAX_TOKENS,
    "the cap allows " + MAX_TOKENS + " and the merge kept " + Object.keys(out).length);
  assert.equal(out[names[0]], "#ffcc00", "the restated colour kept its OLD value");
  assert.equal(out[extra], "#00ccff", "the new colour was dropped");
});

test("the reported ask is the names the model gave, not the wrapper's keys", () => {
  // THE BUG THIS REPLACES, measured live 2026-08-20. The build response did
  // `Object.keys(tokenAsk)` where `tokenAsk` is `{tokens, dropped}` — so the
  // field was the constant ["tokens","dropped"] on every build ever made.
  //
  // That defeats its whole stated purpose. It exists so "the model never asked
  // for a colour" and "it asked and we lost it downstream" stop being the same
  // observation; both wrapper keys are always present, so the field was never
  // empty and could never say the first one. Telling those apart is worth a
  // paid build.
  assert.deepEqual(askedNames({ background: "#ffcc00" }, []), ["background"]);

  // KEPT PLUS DROPPED — a refused name is the strongest evidence the model DID
  // ask, and it is the case where nothing changed and the cause is ours.
  assert.deepEqual(askedNames({ background: "#ffcc00" }, ["chart-1"]), ["background", "chart-1"]);
  assert.deepEqual(askedNames({}, ["chart-1"]), ["chart-1"]);

  // UNDEFINED, NOT [], when the model named nothing — so a build that changed
  // no look serialises exactly as it did before this field existed, and the
  // field's ABSENCE is the signal rather than its length.
  assert.equal(askedNames({}, []), undefined);
  assert.equal(askedNames(null, null), undefined);
  assert.equal(askedNames(undefined, undefined), undefined);

  // AND THE WRAPPER ITSELF MUST NOT PRODUCE AN ANSWER. This is the exact shape
  // that shipped: handed `{tokens, dropped}` where a token map was meant, the
  // old code answered ["tokens","dropped"]. Passing the wrapper as `kept` now
  // yields those key names only if somebody re-introduces the mistake, so this
  // asserts the CALL SITE convention rather than the helper alone.
  const wrapper = { tokens: { background: "#ffcc00" }, dropped: [] };
  assert.notDeepEqual(askedNames(wrapper.tokens, wrapper.dropped), ["tokens", "dropped"]);
});

test("the build response reports the ask through askedNames, with tokenNote's own arguments", () => {
  // DERIVED FROM THE SOURCE, because the helper being correct proves nothing
  // about the call site — and the call site is where the bug was. The two lines
  // sit one apart and must take the SAME arguments, or the reported names and
  // the customer-facing sentence can disagree about what was asked for.
  const raw = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  // COMMENTS BLANKED BEFORE THE ABSENCE IS JUDGED. The comment above that line
  // explains the bug and therefore SPELLS IT — `Object.keys(tokenAsk)` — so the
  // first draft of this guard went red against the fix it was written for.
  // Prose describing a deletion contains the deleted thing: the trap this repo
  // has recorded eight times, committed here on the same day as two others.
  // Length-preserving, so nothing else shifts.
  const worker = raw
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + " ".repeat(m.length - p.length));
  assert.ok(worker.length === raw.length, "the blanker changed the length — offsets would be wrong");
  for (const [ask, kept] of [["tokenAsk", "tokens"], ["styleAsk", "style"]]) {
    assert.match(worker, new RegExp(`askedNames\\(${ask}\\.${kept}, ${ask}\\.dropped\\)`),
      `the ${ask} report is not built from the same arguments its note is`);
    assert.doesNotMatch(worker, new RegExp(`Object\\.keys\\(${ask}\\)`),
      `${ask}'s wrapper keys are being reported again — that field is a constant`);
  }
});
