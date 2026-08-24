// THE FOOTER'S CONTACT SLOTS — that they exist, that they are WIRED, and that
// the generator is told about them.
//
// Every one of these guards a failure this repo has already paid for:
//
//   - a prop the chrome accepts and never forwards is the wiring death, thirteen
//     recorded instances, and it is invisible from either end on its own;
//   - a slot on disk that no rule mentions is reachable by nothing — the 27
//     blocks and the 196 examples were deleted for exactly that;
//   - a named type the model cannot resolve makes it GUESS the shape, which is
//     the `Column<T>` / `fallbackSeed` class and costs a compile.
//
// Source-reading, because a .tsx cannot be imported here. The behavioural half
// — the derived `tel:` link, the de-duplicated nav — is asserted against a real
// build in test/integration/site-build.mjs, since only a build can show it.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PAGE_RULES, componentApiFor } from "../builder/page-gen.mjs";
import { COMPONENT_API, COMPONENT_TYPES } from "../builder/component-api.mjs";

const UI = path.join(import.meta.dirname, "../builder/lovable/template/src/components/ui");
const footer = fs.readFileSync(path.join(UI, "site-footer.tsx"), "utf8");
const chrome = fs.readFileSync(path.join(UI, "site-chrome.tsx"), "utf8");

/** The destructured parameter names of a component, in source order. */
function propsOf(src, name) {
  const i = src.indexOf(`export function ${name}({`);
  assert.ok(i >= 0, `${name} is not declared the way this scan expects`);
  const open = src.indexOf("{", i);
  const close = src.indexOf("}", open);
  return src.slice(open + 1, close)
    .split(",").map((s) => s.split("=")[0].trim()).filter(Boolean);
}

// The three footer slots this change exists for. Named rather than derived,
// because the point of the file is that THESE reached the footer — a derived
// list would shrink to nothing the moment somebody deleted them, which is the
// failure mode, not the test passing.
const FOOTER_SLOTS = ["contact", "legal", "social"];

test("the footer really takes the contact slots", () => {
  const props = propsOf(footer, "SiteFooter");
  for (const slot of FOOTER_SLOTS) {
    assert.ok(props.includes(slot), `SiteFooter does not take \`${slot}\``);
  }
});

test("every footer prop the chrome accepts, it also forwards", () => {
  // DERIVED FROM THE FOOTER, not from a list here: a fourth slot added later is
  // covered without anybody remembering this file. The chrome is the only caller
  // of SiteFooter, so a prop it accepts and drops is a slot that exists,
  // typechecks, and silently renders nothing.
  const take = propsOf(footer, "SiteFooter").filter((p) => p !== "className" && p !== "brand");
  const call = /<SiteFooter\b([^/>]*)/.exec(chrome);
  assert.ok(call, "site-chrome.tsx no longer renders <SiteFooter> the way this scan expects");
  const chromeProps = propsOf(chrome, "SiteChrome");
  for (const p of take) {
    assert.ok(chromeProps.includes(p), `SiteChrome does not accept \`${p}\`, so no page can ever set it`);
    assert.match(call[1], new RegExp(`\\b${p}=`), `SiteChrome accepts \`${p}\` and does not pass it to SiteFooter`);
  }
});

test("the tel: link is DERIVED from the phone, never a second prop", () => {
  // Two values for one number is two things that can disagree, and the one that
  // disagrees silently is the one nobody dials by hand to check.
  const props = propsOf(footer, "SiteFooter");
  assert.ok(!props.some((p) => /tel|phoneHref/i.test(p)), "the footer takes a separate tel prop");
  // The anchor's href IS the derivation — `telHref(` merely appearing somewhere
  // in the file is satisfied by a dead helper nothing calls.
  assert.match(footer, /href=\{telHref\(/, "the phone's link is not derived from the phone");
});

test("a tel:/mailto: nav link is dropped from the FOOTER when contact supplies it", () => {
  // Measured by rendering: the reference page carries its number as a nav link
  // AND in `contact`, and both printed on one footer row, which reads as a
  // fault. Asserted on the CONDITION — a filter that drops every tel: link
  // whether or not there is a contact block would take the number off the
  // footer of a site that has no other copy of it.
  assert.match(footer, /contact\?\.phone\s*&&\s*href\.startsWith\("tel:"\)/,
    "the footer no longer drops a duplicate tel: link, or does it unconditionally");
  assert.match(footer, /contact\?\.email\s*&&\s*href\.startsWith\("mailto:"\)/,
    "the footer no longer drops a duplicate mailto: link, or does it unconditionally");
  // The HEADER keeps everything: a call-now link belongs there, and this filter
  // must never have reached it.
  assert.doesNotMatch(chrome, /startsWith\("tel:"\)/, "the tel: filter has leaked into the chrome/header");
});

test("the generator is told the slots exist — through the SIGNATURE, not through prose", () => {
  // A slot no rule mentions is a slot the model never fills — this repo deleted
  // 289 files that were on disk and reachable by nothing, and the footer was in
  // exactly that state before the rule existed: no phone, no address, no hours,
  // unreachable at any price because there was no slot to fill.
  //
  // THE 1,822-CHARACTER RULE WENT ON 2026-08-24 AND THE CAPABILITY DID NOT, which
  // is the whole point of the trade. It existed because `contact?: SiteContact`
  // is a type NAME, and `COMPONENT_TYPES` is per module while `site-chrome.tsx`
  // imports that type from `site-footer` — so the signature stopped at a bare
  // name and rule 3 correctly told the model not to invent fields on it. The
  // signature resolves the type across modules now, so the same fact costs ~250
  // characters instead of 1,822 and is stated where the model is already reading.
  const sig = String(COMPONENT_API["site-chrome"]);
  for (const slot of FOOTER_SLOTS) {
    assert.ok(sig.includes(slot + "?:") || sig.includes(slot + ":"),
      `SiteChrome's signature no longer offers \`${slot}\``);
  }
  const line = componentApiFor(["site-chrome"]);
  for (const field of ["phone", "email", "address", "hours"])
    assert.ok(line.includes(field),
      `the resolved SiteContact shape lost \`${field}\` — the model is back to guessing`);
  assert.match(line, /NavLink = \{ label: string; href: string \}/,
    "`links` and `legal` no longer resolve to a shape either");
});

test("SiteContact resolves to its fields, so the model cannot guess the shape", () => {
  // `contact?: SiteContact` in a signature is a type NAME. Unresolved, the model
  // invents the fields and the page fails to compile — the failure `Column<T>`
  // and `fallbackSeed` both were.
  const shape = COMPONENT_TYPES["site-footer"] && COMPONENT_TYPES["site-footer"].SiteContact;
  assert.ok(shape, "SiteContact is not in COMPONENT_TYPES, so the model only sees the name");
  for (const field of ["phone", "email", "address", "hours"]) {
    assert.ok(shape.includes(field), `SiteContact's resolved shape is missing \`${field}\``);
  }
  // Keyed by module — COMPONENT_API is an object, and a regex over the whole of
  // it would be satisfied by any component that happens to mention the word.
  assert.match(String(COMPONENT_API["site-chrome"]), /contact\?: SiteContact/,
    "the model-facing SiteChrome signature no longer offers `contact`");
});

test("the reference page demonstrates the slots it is safe to demonstrate", () => {
  // The model copies this page. It carries `contact` and `social`, and
  // deliberately NOT `legal`: the template has no privacy route, so an example
  // linking to one would teach the dangling link the router refuses.
  const ref = fs.readFileSync(
    path.join(import.meta.dirname, "../builder/lovable/template/src/routes/index.tsx"), "utf8");
  assert.match(ref, /contact:\s*\{/, "the reference page stopped demonstrating `contact`");
  assert.match(ref, /social:\s*\[/, "the reference page stopped demonstrating `social`");
  assert.doesNotMatch(ref, /^\s*legal:\s*\[/m,
    "the reference page now demonstrates `legal` — it must point at a route the template has");
});
