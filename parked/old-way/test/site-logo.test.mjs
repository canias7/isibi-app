// PARKED (2026-11-03, park-old-way): the old-way half of test/site-logo.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// "Hey, this is my logo, put it there."
//
// The owner's own words for how this should work, after turning down a picker
// in the uploads panel. The attachment IS which picture — nothing to match,
// nothing to remember — which is why the whole layer needs no model call.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { readLogoImage, logoRefusal, runLogoEdit, MAX_LOGO_BYTES } from "../builder/site-logo.mjs";
import { withConfig } from "../../../site-config.mjs";
import { MARKS, markWire, markUrlOk } from "../../../builder/site-mark.mjs";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const b64 = (u8) => Buffer.from(u8).toString("base64");
const dataUrl = (u8, mime = "image/png") => `data:${mime};base64,${b64(u8)}`;
const sniff = (b) => (b && b[0] === 0x89 && b[1] === 0x50 ? { mime: "image/png", ext: "png" } : null);

const deps = (o = {}) => {
  const seen = { stored: 0, saved: [], published: 0 };
  return {
    seen,
    d: {
      sniff,
      store: async () => { seen.stored++; if (o.storeThrows) throw new Error("R2 down"); return "storeUrl" in o ? o.storeUrl : "/u/cafe/abc.png"; },
      save: async ({ logo }) => { seen.saved.push(logo); if (o.saveThrows) throw new Error("pg down"); },
      publish: async () => { seen.published++; return o.publish === undefined ? { ok: true, files: 21 } : o.publish; },
    },
  };
};

/* ── reading the attached image ──────────────────────────────────────────── */

test("a real PNG data URL is read", () => {
  const r = readLogoImage(dataUrl(PNG), { sniff });
  assert.equal(r.ok, true);
  assert.equal(r.kind.ext, "png");
  assert.equal(r.bytes[0], 0x89);
});

test("NOTHING ATTACHED IS ITS OWN ANSWER, not a generic failure", () => {
  // The message has to say what to do — attach it — or the customer is left
  // with "that didn't work" and no idea that a file was the missing half.
  for (const empty of ["", null, undefined, 7, {}]) {
    assert.equal(readLogoImage(empty, { sniff }).reason, "none");
  }
  assert.match(logoRefusal("none"), /Attach/);
  assert.match(logoRefusal("none"), /the \+ button/); // the composer's attach button (no emoji, 2026-10-13)
});

test("AN SVG IS REFUSED, and the message says what to send instead", () => {
  // `/u/` serves `content-disposition: inline` from the site's OWN origin, and
  // an SVG is a document that can carry `<script>` — accepting one is stored
  // XSS on a customer's domain, which `nosniff` does not help with because the
  // type would be declared honestly. `site-uploads.mjs` refuses it for exactly
  // this reason and one rule beats two.
  //
  // It is also the refusal most likely to annoy somebody: a logo is the single
  // most likely thing a business has as an SVG, because that is what a designer
  // hands them. So it must not read as "that didn't work".
  const r = readLogoImage("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=", { sniff });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "svg");
  assert.match(logoRefusal("svg"), /PNG/);
});

test("…and an SVG dressed as a PNG is refused by the BYTES, not the label", () => {
  // The declared media type is whatever the caller wrote. Only the leading
  // bytes are an honest answer to "is this an image".
  const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  const r = readLogoImage(dataUrl(svg, "image/png"), { sniff });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "not_an_image");
});

test("anything that is not a base64 image data URL is refused", () => {
  for (const bad of [
    "https://example.com/logo.png",
    "javascript:alert(1)",
    "data:text/html;base64,PHNjcmlwdD4=",
    "data:image/png,notbase64",
    "data:image/png;base64,not base64 at all!!",
  ]) {
    assert.equal(readLogoImage(bad, { sniff }).ok, false, JSON.stringify(bad) + " was accepted");
  }
});

test("something far too large is refused BEFORE it is decoded", () => {
  // A 30 MB string should not become a 22 MB Uint8Array on the way to being
  // refused — this runs on a Worker with a memory bound.
  const huge = "data:image/png;base64," + "A".repeat(MAX_LOGO_BYTES * 2);
  const r = readLogoImage(huge, { sniff });
  assert.equal(r.reason, "too_big");
  assert.match(logoRefusal("too_big"), /2 MB/);
});

test("…and the DECODED size is checked too, not only the base64 length", () => {
  // The pre-decode bound is about what is worth decoding; this is the real size
  // of the thing that would be stored, and only one of the two is the limit.
  // Driven at a size that passes the first check and fails the second.
  const big = new Uint8Array(MAX_LOGO_BYTES + 10);
  big[0] = 0x89; big[1] = 0x50;
  const r = readLogoImage(dataUrl(big), { sniff });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "too_big");
});

test("with no sniffer at all nothing is accepted", () => {
  // Fails closed. A missing dependency must not become "every attachment is a
  // valid image", which would put arbitrary bytes on the site's own origin.
  assert.equal(readLogoImage(dataUrl(PNG), {}).ok, false);
  assert.equal(readLogoImage(dataUrl(PNG)).ok, false);
});

/* ── putting it on ───────────────────────────────────────────────────────── */

test("the logo is stored, saved and published, in that order", async () => {
  const { d, seen } = deps();
  const r = await runLogoEdit(d, { images: [dataUrl(PNG)] });
  assert.equal(r.ok, true);
  assert.equal(r.url, "/u/cafe/abc.png");
  assert.equal(seen.stored, 1);
  assert.deepEqual(seen.saved, ["/u/cafe/abc.png"]);
  assert.equal(seen.published, 1);
});

test("NOTHING IS SAVED IF THE UPLOAD FAILED", async () => {
  // Written the other way round, a failed upload leaves the site pointing at an
  // address that 404s — a broken-image glyph in the header of every page, which
  // is worse than the text it replaced.
  const { d, seen } = deps({ storeThrows: true });
  const r = await runLogoEdit(d, { images: [dataUrl(PNG)] });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "store");
  assert.deepEqual(seen.saved, []);
  assert.equal(seen.published, 0);
});

test("…and nothing is published if the save failed", async () => {
  const { d, seen } = deps({ saveThrows: true });
  const r = await runLogoEdit(d, { images: [dataUrl(PNG)] });
  assert.equal(r.ok, false);
  assert.equal(seen.published, 0);
});

test("a store that answers NULL is a failure, not a logo of nothing", async () => {
  const { d, seen } = deps({ storeUrl: null });
  const r = await runLogoEdit(d, { images: [dataUrl(PNG)] });
  assert.equal(r.ok, false);
  assert.deepEqual(seen.saved, []);
});

test("A FAILED PUBLISH SAYS THE LOGO IS SAVED, because it is", async () => {
  // A real state and not "nothing happened": the next publish of this site — a
  // colour change, a typo fix — will carry it. Saying otherwise would have them
  // send it again for no reason.
  const { d } = deps({ publish: { ok: false } });
  const r = await runLogoEdit(d, { images: [dataUrl(PNG)] });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "publish");
  assert.equal(r.url, "/u/cafe/abc.png");
  assert.match(r.msg, /saved your logo/i);
  assert.match(r.msg, /next change/);
});

test("the first usable attachment is the one used", async () => {
  const { d } = deps();
  const r = await runLogoEdit(d, { images: ["", dataUrl(PNG)] });
  assert.equal(r.ok, true);
});

// THE BROWSER'S OWN SHAPE (2026-09-25). The attach code makes `{name, data}`,
// and every case above posts a bare string — so a logo attached in the composer
// was refused as "none" while all of them passed.
test("an attachment in the composer's shape — {name, data} — is the logo", async () => {
  const { d, seen } = deps();
  const r = await runLogoEdit(d, { images: [{ name: "logo.png", data: dataUrl(PNG) }] });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(seen.saved, ["/u/cafe/abc.png"]);
  assert.equal(seen.published, 1);
});

test("…and the first attachment that carries a picture is used, past one that carries words", async () => {
  const { d } = deps();
  const r = await runLogoEdit(d, { images: [{ name: "notes.txt", text: "our colours" }, { name: "logo.png", data: dataUrl(PNG) }] });
  assert.equal(r.ok, true, JSON.stringify(r));
});

test("…while an attachment with no picture in it is still no logo", async () => {
  const { d, seen } = deps();
  const r = await runLogoEdit(d, { images: [{ name: "notes.txt", text: "our colours" }, { name: "x", data: 7 }] });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "none");
  assert.equal(seen.stored, 0);
});

// MORE THAN ONE PICTURE IS NOT ONE LOGO (2026-10-03, the owner: *"never
// silently choose which files to discard, and report any genuine attachment
// limit before execution."*). The first used to win without a word; once a
// request's own file and an answer's both go on, the first is not a choice
// anybody made. Refused before anything is stored, with the number.
test("TWO PICTURES ARE REFUSED, NEITHER CHOSEN: nothing stored, saved or published, and the number said — for the tab icon too", async () => {
  for (const tab of [false, true]) {
    const { d, seen } = deps();
    const r = await runLogoEdit(d, { images: [dataUrl(PNG), { name: "b.png", data: dataUrl(PNG) }], tab });
    assert.equal(r.ok, false, JSON.stringify(r));
    assert.equal(r.reason, "several");
    assert.equal(r.files, 2);
    assert.match(r.msg, /^That came with 2 files, and a site has one /);
    assert.match(r.msg, tab ? /one tab icon/ : /one logo/);
    assert.equal(seen.stored, 0, "a picture was stored");
    assert.deepEqual(seen.saved, []);
    assert.equal(seen.published, 0);
  }
  // A NOTE BESIDE ONE PICTURE IS STILL ONE PICTURE, and a blank entry is nothing.
  const { d } = deps();
  assert.equal((await runLogoEdit(d, { images: ["", { name: "notes.txt", text: "our colours" }, dataUrl(PNG)] })).ok, true);
});

// A PDF BESIDE THE LOGO IS NOT A SECOND LOGO (2026-10-23, audit A26-3). A
// request hands every file to the logo part, so a menu PDF meant for another
// part turned one picture into the "several" refusal.
test("A26-3: one picture beside a PDF is the logo; two pictures beside a PDF are still refused; a lone PDF is refused for what it is", async () => {
  const PDF = { name: "menu.pdf", data: "data:application/pdf;base64,JVBERi0xLjQK" };
  {
    const { d, seen } = deps();
    const r = await runLogoEdit(d, { images: [{ name: "logo.png", data: dataUrl(PNG) }, PDF] });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(seen.stored, 1);
  }
  {
    const { d } = deps();
    const r = await runLogoEdit(d, { images: [PDF, dataUrl(PNG), { name: "b.png", data: dataUrl(PNG) }] });
    assert.equal(r.reason, "several");
    assert.equal(r.files, 2, "the PDF was counted as a picture");
  }
  {
    const { d, seen } = deps();
    const r = await runLogoEdit(d, { images: [PDF] });
    assert.equal(r.ok, false);
    assert.equal(r.reason, "unreadable", JSON.stringify(r));
    assert.equal(seen.stored, 0);
  }
});

test("a refusal never publishes and never saves", async () => {
  const { d, seen } = deps();
  const r = await runLogoEdit(d, { images: ["data:image/svg+xml;base64,PHN2Zz4="] });
  assert.equal(r.ok, false);
  assert.equal(seen.stored, 0);
  assert.equal(seen.published, 0);
});

/* ── taking it off ───────────────────────────────────────────────────────── */

test("A REMOVAL NEEDS NO IMAGE, and is asked FIRST", async () => {
  // Checked before the attachment, or "take the logo off" is answered with
  // "attach a logo" — the opposite of what was asked, and it reads as the
  // builder not listening.
  const { d, seen } = deps();
  const r = await runLogoEdit(d, { remove: true });
  assert.equal(r.ok, true);
  assert.equal(r.removed, true);
  assert.deepEqual(seen.saved, [""], "the stored logo was not cleared");
  assert.equal(seen.stored, 0);
  assert.equal(seen.published, 1);
  assert.match(r.msg, /name/, "the reply does not say what the header shows now");
});

test("removal is a REAL boolean, not anything truthy", async () => {
  // `remove: "false"` off a wire would otherwise take a customer's logo off.
  const { d, seen } = deps();
  const r = await runLogoEdit(d, { remove: "true", images: [dataUrl(PNG)] });
  assert.equal(r.ok, true);
  assert.equal(!!r.removed, false, "a string took the logo off");
  assert.deepEqual(seen.saved, ["/u/cafe/abc.png"]);
});

test("a failed removal does not claim the logo is gone", async () => {
  const { d } = deps({ publish: { ok: false } });
  const r = await runLogoEdit(d, { remove: true });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "publish");
});

/* ── the wiring, which nothing else can see ──────────────────────────────── */

const worker = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
const chat = fs.readFileSync(new URL("../../../public/chat.js", import.meta.url), "utf8");
const header = fs.readFileSync(new URL("../../../builder/lovable/template/src/components/ui/site-header.tsx", import.meta.url), "utf8");
const buildServer = fs.readFileSync(new URL("../../../builder/build-server.mjs", import.meta.url), "utf8");

/** The brand writer's body. Anchored on the function rather than sliced to a
 *  byte count — a well-commented insertion is what has repeatedly walked a
 *  fixed window off the thing it was written to guard. */
function brandWriter() {
  const i = buildServer.indexOf("function writeSiteBrand(");
  assert.ok(i > 0, "the brand writer moved — rescope this");
  const end = buildServer.indexOf("\nfunction ", i + 10);
  const block = buildServer.slice(i, end > i ? end : undefined);
  assert.ok(block.length > 400, "the brand-writer window is suspiciously small — rescope this");
  return block;
}

// ── THE TAB ICON IS A SECOND SLOT, NOT A SMALLER LOGO ───────────────────────

test("the tab icon is stored under its own key, leaving the logo alone", async () => {
  const saved = [];
  const out = await runLogoEdit({
    sniff: () => ({ mime: "image/png", ext: "png" }),
    store: async () => "/u/x/abc.png",
    save: async (patch) => { saved.push(patch); },
    publish: async () => ({ ok: true, files: 3 }),
  }, { images: ["data:image/png;base64,aaaa"], tab: true });
  assert.equal(out.ok, true);
  assert.equal(out.target, "icon");
  // ONE KEY, and it must be the icon — writing `logo` here would put a wordmark
  // in the header nobody asked to change, and writing both would silently
  // replace the other piece of artwork.
  assert.deepEqual(saved, [{ icon: "/u/x/abc.png" }]);
  assert.match(out.msg, /tab/i);
});

test("without the flag it is still the header logo, byte for byte as before", async () => {
  const saved = [];
  const out = await runLogoEdit({
    sniff: () => ({ mime: "image/png", ext: "png" }),
    store: async () => "/u/x/abc.png",
    save: async (patch) => { saved.push(patch); },
    publish: async () => ({ ok: true, files: 3 }),
  }, { images: ["data:image/png;base64,aaaa"] });
  assert.equal(out.target, "logo");
  assert.deepEqual(saved, [{ logo: "/u/x/abc.png" }]);
  assert.match(out.msg, /header/i);
});

test("NOTHING MERELY TRUTHY SENDS ARTWORK TO THE TAB", async () => {
  // The rule `remove` already lives under one field over. A `tab` arriving as
  // the string "false" — which is truthy — must not take a wordmark off the
  // header and put it in a 16-pixel box.
  for (const tab of ["false", "true", 1, {}, []]) {
    const saved = [];
    await runLogoEdit({
      sniff: () => ({ mime: "image/png", ext: "png" }),
      store: async () => "/u/x/a.png",
      save: async (p) => { saved.push(p); },
      publish: async () => ({ ok: true }),
    }, { images: ["data:image/png;base64,aaaa"], tab });
    assert.deepEqual(saved, [{ logo: "/u/x/a.png" }], String(tab));
  }
});

test("a removal hits the slot it was asked about, and says what it goes back to", async () => {
  const saved = [];
  const out = await runLogoEdit({
    save: async (p) => { saved.push(p); },
    publish: async () => ({ ok: true, files: 2 }),
  }, { remove: true, tab: true });
  assert.equal(out.ok, true);
  assert.equal(out.target, "icon");
  assert.deepEqual(saved, [{ icon: "" }]);
  // Removing the tab icon does not leave the tab blank — the site returns to the
  // mark drawn from its initials, which is what every site has until one is sent.
  assert.match(out.msg, /initials/i);
  assert.doesNotMatch(out.msg, /header shows your name/i);
});

test("a failed publish names the right thing in both slots", async () => {
  for (const [tab, word] of [[true, /tab icon/i], [false, /logo/i]]) {
    const out = await runLogoEdit({
      sniff: () => ({ mime: "image/png", ext: "png" }),
      store: async () => "/u/x/a.png",
      save: async () => {},
      publish: async () => ({ ok: false }),
    }, { images: ["data:image/png;base64,aaaa"], tab });
    assert.equal(out.ok, false);
    assert.equal(out.reason, "publish");
    assert.match(out.msg, word);
  }
});
