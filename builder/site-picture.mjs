// The `picture` layer: change a photograph on a page that already exists.
//
// WHY IT IS NEEDED. Photographs are bought at BUILD time from `@@IMG:…@@`
// tokens, and after that nothing could touch them. `budgetFor` buys none on a
// revise (a revise re-derives the same budget and the model writes fresh
// descriptions, so nothing matches what was bought last time — ~94 credits of
// new pictures for ones the owner already had), and no lane could swap one
// either. So "use a photo of MY shop instead of that one" had no path at all,
// and neither did filling a slot the build left empty.
//
// EVERY SLOT ON EVERY SITE IS EMPTY TODAY, which is what makes this the useful
// half rather than a refinement: the fal balance has never been funded, so no
// photograph has ever been generated and every `SafeImage` on every published
// site is drawing its placeholder. The owner's OWN photographs — a real shop
// photographed on a real phone — need no image model at all, and are better
// than a generated one for a business that has them.
//
// THE ALT TEXT IS THE HANDLE. A generated page writes
// `<SafeImage src="…" alt="The row of chairs, Saturday morning" ratio="4/3" />`,
// so every slot already carries a sentence describing the picture, written for a
// screen reader and perfectly suited to being matched against "the one of the
// chairs". Nothing new has to be stored to address them.
//
// NO PAGE MODEL CALL. The swap is a string replacement at a known offset, the
// way `site-text.mjs` edits words — so this costs one cheap classification and
// the picture itself, never the ~5 credits of regenerating a page.
//
// Plain module with its side effects injected, like `site-apply.mjs` beside it.

// ONE READING OF THE FILE-TO-ROUTE MAPPING, shared with the addon and page
// lanes. `readNeedsPlace` compares a route the model named against the pages
// this site has, and those arrive as file paths.
import { routeOf } from "./site-addon.mjs";

/** Haiku. Matching a sentence to a list of sentences is not a design task. */
export const PICTURE_MODEL = "claude-haiku-4-5";
export const PICTURE_MAX_TOKENS = 1200;

/** How many slots the model is shown. A page with more than this is a contact sheet. */
export const MAX_SLOTS = 60;

/** How many pictures one instruction may change. "Replace all the shop photos" is real. */
export const MAX_PICTURE_OPS = 8;

/**
 * WHICH PART OF A PICTURE SURVIVES THE CROP — the five `SafeImage` accepts.
 *
 * `centre` is in the list because putting a picture back is a real instruction,
 * and it is written by REMOVING the attribute rather than writing the word: a
 * centred picture and one that never had a focus are the same picture, so a site
 * put back is byte-identical to one that was never touched.
 */
export const FOCUS_VALUES = ["centre", "top", "bottom", "left", "right"];

/**
 * Every picture on the page, with the exact span of its `src` value.
 *
 * ONLY A LITERAL `alt` IS ADDRESSABLE, and that is a real limit rather than an
 * oversight. `{SPREADS.map((s) => <SafeImage alt={s.alt} …/>)}` is ONE element
 * rendering many pictures, so there is no single span to replace and no sentence
 * to match against — changing it means changing the data it maps over, which is
 * a page edit. Skipping it is what stops this layer half-doing that.
 *
 * The span is the VALUE, quotes excluded, so a replacement never has to guess
 * how the attribute was written. `src={null}` and `src={photo}` are recorded
 * with `expr: true` — the first is a slot a page can legitimately have and the
 * second is bound to something, so only the first is offered.
 */
export function imageSlots(pages) {
  const out = [];
  for (const p of Array.isArray(pages) ? pages : []) {
    if (!p || typeof p.path !== "string" || typeof p.source !== "string") continue;
    const src = p.source;
    // `<SafeImage` and `<img` — the two things that draw a photograph. Every
    // other kit component that carries one draws it THROUGH SafeImage, but from
    // a prop rather than an attribute, so it is not addressable here.
    const re = /<(SafeImage|img)\b/g;
    let m;
    while ((m = re.exec(src))) {
      const open = m.index;
      // The element ends at the first `>` that is not inside a string or a
      // braced expression. A naive indexOf(">") stops inside `alt="a > b"`.
      const end = elementEnd(src, open);
      if (end < 0) continue;
      const el = src.slice(open, end);
      const alt = literalAttr(el, "alt");
      if (!alt) continue;
      const s = attrSpan(el, "src");
      if (!s) continue;
      // WHICH PART OF THE PICTURE SURVIVES THE CROP. Recorded alongside the
      // src because both are edits to ONE element and have to be written in one
      // back-to-front pass — applied separately, the first write moves the
      // second's offsets into the middle of an attribute.
      //
      // `focusInsertAt` is just past the tag name, which is a position that
      // exists on every element whether or not it has the attribute yet, and
      // needs no guess about where the other attributes end.
      const f = attrSpan(el, "focus");
      out.push({
        page: p.path, tag: m[1], alt,
        focus: f && !f.expr ? el.slice(f.from, f.to).trim() : "",
        // An EXPRESSION is not our slot — `focus={row.crop}` is a value the
        // site's own data decides, and overwriting it drops the binding. The
        // skip-rather-than-guess rule every other scanner here lives under.
        focusAt: f && !f.expr ? open + f.from : null,
        focusTo: f && !f.expr ? open + f.to : null,
        focusBound: !!(f && f.expr),
        focusInsertAt: open + m[0].length,
        // THE EXPRESSION'S TEXT IS KEPT, not flattened to null. Recorded as null
        // for every expression slot, `isEmptySlot` could not tell `src={null}`
        // — a slot waiting to be filled — from `src={row.photo}`, which is a
        // picture the site's own data decides. Both read as empty, so the model
        // would be offered a bound picture as a free slot and would overwrite
        // the binding with one photograph for every row.
        value: el.slice(s.from, s.to),
        expr: s.expr,
        at: open + s.from, to: open + s.to, quoted: !s.expr,
      });
      if (out.length >= MAX_SLOTS) return out;
    }
  }
  return out;
}

/** The index just past the element's opening tag. */
function elementEnd(src, from) {
  let depth = 0, quote = "";
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (quote) { if (c === quote) quote = ""; continue; }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if (c === "{") { depth++; continue; }
    if (c === "}") { depth = Math.max(0, depth - 1); continue; }
    if (c === ">" && !depth) return i + 1;
  }
  return -1;
}

/** A string-literal attribute's value, or "" for anything computed. */
function literalAttr(el, name) {
  const m = new RegExp("\\b" + name + '\\s*=\\s*"([^"]*)"').exec(el);
  return m ? m[1].trim() : "";
}

/**
 * Where an attribute's VALUE sits inside the element.
 *
 * `expr` covers `src={null}` and `src={photo}` alike; the caller separates them,
 * because a null is an empty slot to fill and a binding is a picture some other
 * value decides.
 */
function attrSpan(el, name) {
  const q = new RegExp("\\b" + name + '\\s*=\\s*"').exec(el);
  if (q) {
    const from = q.index + q[0].length;
    const to = el.indexOf('"', from);
    return to < 0 ? null : { from, to, expr: false };
  }
  const b = new RegExp("\\b" + name + "\\s*=\\s*\\{").exec(el);
  if (!b) return null;
  const from = b.index + b[0].length;
  let depth = 1;
  for (let i = from; i < el.length; i++) {
    if (el[i] === "{") depth++;
    else if (el[i] === "}" && !--depth) return { from, to: i, expr: true };
  }
  return null;
}

/** A slot with nothing in it — what every picture on every site is today. */
export function isEmptySlot(slot) {
  if (!slot) return false;
  if (slot.expr) return String(slot.value ?? "").trim() === "" || /^null$/.test(String(slot.value ?? "").trim());
  return String(slot.value || "").trim() === "";
}

export const PICTURE_TOOL = {
  name: "choose_pictures",
  description: "Say which of this site's picture slots the instruction is about, and what should go in each one.",
  input_schema: {
    type: "object",
    properties: {
      pictures: {
        type: "array",
        description:
          "One entry per picture this instruction actually changes, and nothing else. A slot you do not mention " +
          "keeps whatever it has.\n" +
          "RETURN AN EMPTY ARRAY IF NO SLOT MATCHES. The list below is every picture the site has; if the thing " +
          "they are describing is not among them, saying so is correct and costs them nothing. Putting a photograph " +
          "of the wrong thing on a real business's home page is not.",
        items: {
          type: "object",
          properties: {
            page: { type: "string", description: "The page path, exactly as listed below." },
            alt: { type: "string", description: "The picture's description, copied EXACTLY from the list below. This is how the slot is identified." },
            file: {
              type: "string",
              description:
                "THE OWNER'S OWN PHOTOGRAPH, named exactly as listed under their uploads. PREFER THIS WHENEVER ONE " +
                "FITS — it is a real picture of their real business, it is free, and it is better than anything that " +
                "can be made up. Leave it out only when nothing they have uploaded suits this slot.",
            },
            describe: {
              type: "string",
              description:
                "Only when no uploaded photograph fits: a short description of the picture to MAKE for this slot. " +
                "Say what is in it, plainly — \"a barber's chair by a window in the late afternoon\". This costs the " +
                "owner real money for each one, so do not describe a picture nobody asked for.",
            },
            clear: { type: "boolean", description: "True to REMOVE the picture from this slot, leaving the space empty." },
            focus: {
              type: "string",
              enum: ["centre", "top", "bottom", "left", "right"],
              description:
                "WHICH PART OF THE PICTURE TO KEEP when it has to be cropped to fit its space. Use this for \"his " +
                "head is cut off\", \"you can't see the sign\", \"it's chopping the top off\", \"show more of the " +
                "left\".\n" +
                "\"top\" keeps the top of the photograph — faces, heads, a shop sign. \"bottom\" keeps the bottom — " +
                "a table, a plate, the ground. \"left\" and \"right\" for a subject off to one side. \"centre\" is " +
                "the ordinary one and puts it back.\n" +
                "IT COSTS NOTHING AND CHANGES NO PHOTOGRAPH — it moves the crop of the picture already there. So " +
                "when somebody says a picture is cut off, this is the answer and a new picture is NOT: replacing it " +
                "charges them for an image they did not ask for and would very likely be cut off the same way.\n" +
                "ON ITS OWN, or alongside `file` when the new photograph needs framing too. Leave it out when the " +
                "framing is not what they are talking about.",
            },
          },
          required: ["page", "alt"],
        },
      },
      needsPlace: {
        type: "string",
        description:
          "The page they want a picture ON, when that page has NO slot for one — \"/about\". Only alongside an EMPTY " +
          "`pictures` array, and only when they are asking for a picture to be ADDED somewhere that has none.\n" +
          "THIS IS THE DIFFERENCE BETWEEN A REFUSAL AND THE WORK. Every slot the site has is listed below, so a page " +
          "that is not among them has nowhere to put a photograph and swapping cannot help — saying so here sends it " +
          "to the step that can add one. LEAVE IT OUT when they meant a slot that IS listed and you simply could not " +
          "tell which: that is an honest no, and guessing here costs them a page rewrite they did not ask for.",
      },
    },
    required: ["pictures"],
  },
};

const PICTURE_SYSTEM =
  "You choose which photograph goes where on a small business's website. You are given every picture slot the " +
  "site has — each with the page it is on and the description already written for it — the photographs the owner " +
  "has uploaded, and one instruction from them.\n\n" +
  "MATCH ON WHAT THE PICTURE IS OF. The descriptions were written to say what each photograph shows, so \"the one " +
  "of the chairs\" is the slot whose description mentions chairs. When two could fit and only one was asked for, " +
  "change neither and return an empty list — they will say which.\n\n" +
  "USE WHAT THEY HAVE UPLOADED WHENEVER IT FITS. A real photograph of their real shop beats anything made up, and " +
  "it costs them nothing. Only describe a new picture when they have uploaded nothing that suits.\n\n" +
  "CHANGE ONLY WHAT THEY ASKED FOR. Every other picture is there because it was wanted.";

/** The slots and the owner's uploads, as text. */
export function pictureDigest(slots, library) {
  const out = [];
  const byPage = new Map();
  for (const s of Array.isArray(slots) ? slots : []) {
    if (!byPage.has(s.page)) byPage.set(s.page, []);
    byPage.get(s.page).push(s);
  }
  for (const [page, list] of byPage) {
    out.push("PAGE " + page);
    for (const s of list) out.push("  \"" + s.alt + "\"" + (isEmptySlot(s) ? "   (empty — no picture yet)" : ""));
  }
  if (!out.length) out.push("(this site has no picture slots at all)");
  const files = (Array.isArray(library) ? library : []).filter((f) => f && f.name).slice(0, 60);
  out.push("");
  out.push(files.length
    ? "PHOTOGRAPHS THE OWNER HAS UPLOADED\n" + files.map((f) => "  " + f.name).join("\n")
    : "PHOTOGRAPHS THE OWNER HAS UPLOADED\n  (none yet)");
  return out.join("\n");
}

export function pictureRequest({ instruction, slots, library }) {
  return {
    model: PICTURE_MODEL,
    max_tokens: PICTURE_MAX_TOKENS,
    tools: [PICTURE_TOOL],
    tool_choice: { type: "tool", name: "choose_pictures" },
    system: [{ type: "text", text: PICTURE_SYSTEM }],
    messages: [{
      role: "user",
      content: "THE PICTURES THIS SITE HAS\n" + pictureDigest(slots, library) +
        "\n\nWHAT THEY ASKED FOR\n" + String(instruction || "").trim().slice(0, 2000),
    }],
  };
}

/** Description length, matched to what the image model is actually given. */
export const MAX_DESCRIBE = 240;

/**
 * What came back, checked against the slots that were offered.
 *
 * A SLOT IS MATCHED ON PAGE **AND** ALT, never alt alone: two pages of one site
 * legitimately carry the same picture description, and a model naming only the
 * alt would change whichever the scan happened to find first — on a page nobody
 * mentioned. The same pair twice is one change, because a model listing a slot
 * again is repeating itself rather than asking for two edits.
 *
 * AN UPLOADED FILE MUST BE ONE THE OWNER REALLY HAS. It becomes a URL under
 * their own uploads prefix, so a name the model invented would publish a broken
 * image — which is the one outcome `SafeImage` cannot draw around.
 */
/**
 * The page a picture is wanted ON that has no slot for one, or null.
 *
 * BOUNDED TO A PAGE THE SITE REALLY HAS. The value decides which page a MODEL
 * CALL is spent rewriting, so an invented path buys a page edit for a page that
 * does not exist. The pages are right here in the slot list that was offered.
 *
 * A PAGE THAT ALREADY HAS A SLOT IS REFUSED, and that is the load-bearing half.
 * A model that both matched nothing AND named a page it was shown slots for has
 * contradicted itself: the honest reading is "I could not tell which of these
 * you meant", which is the cheap refusal, not a page rewrite. Without this,
 * every failure to match becomes a paid edit.
 */
export function readNeedsPlace(reply, slots) {
  const blocks = reply && Array.isArray(reply.content) ? reply.content : [];
  const use = blocks.find((b) => b && b.type === "tool_use");
  const raw = use && use.input && use.input.needsPlace;
  if (typeof raw !== "string") return null;
  const want = raw.trim().toLowerCase();
  if (!want.startsWith("/")) return null;
  const list = Array.isArray(slots) ? slots : [];
  if (!list.length) return null;
  // A SLOT'S `page` IS A FILE PATH AND `needsPlace` IS A ROUTE, and comparing
  // them raw is comparing two different things: `src/routes/index.tsx` never
  // equals `/`, so the refusal below could not fire and every unmatched
  // instruction naming any path would have bought a page rewrite. Found by
  // mutation — deleting this check changed nothing, because the tests reached
  // it through `startsWith("/")`, which had already refused every file path
  // they used. One guard masking another, and the fixture hid it.
  //
  // `routeOf` IS IMPORTED rather than reimplemented: the file-to-route mapping
  // has been written five times in this repo and each copy has been wrong at
  // least once (`menu/index.tsx` → `/menu/index`, `about.team.tsx` →
  // `/about.team`).
  if (list.some((sl) => sl && routeOf(sl.page) === want)) return null;
  return want;
}

export function readPictures(reply, slots, library) {
  const blocks = reply && Array.isArray(reply.content) ? reply.content : [];
  const use = blocks.find((b) => b && b.type === "tool_use");
  const raw = (use && use.input && use.input.pictures) || [];
  const bySlot = new Map();
  for (const s of Array.isArray(slots) ? slots : []) bySlot.set(s.page + "\u0000" + s.alt, s);
  const files = new Set((Array.isArray(library) ? library : []).map((f) => f && f.name).filter(Boolean));

  const out = [], seen = new Set();
  for (const c of Array.isArray(raw) ? raw : []) {
    if (!c || typeof c !== "object") continue;
    const key = String(c.page || "") + "\u0000" + String(c.alt || "").trim();
    const slot = bySlot.get(key);
    if (!slot || seen.has(key)) continue;

    // THE ENUM IS ENFORCED HERE, IN CODE, and not merely declared in the schema
    // above — a value the component does not know falls back to the middle, so
    // writing one is a change reported as applied that moves nothing. Refused on
    // a slot whose framing is BOUND to data, and on a bare `<img>`, which has no
    // such prop: writing it there emits an attribute that does nothing at all.
    // A REFUSED FRAMING IS NOT AN UNMATCHED PICTURE, and telling the customer it
    // was is the works-but-cannot-say-so disease. Measured: all four refusal
    // paths answered "I couldn't match that to any of the pictures on your
    // site" about a picture named correctly and found — the one sentence that
    // sends them looking for the wrong thing.
    //
    // TWO REASONS, because two are what the customer can act on. "It already
    // shows that" means stop asking; "I can't change that one's framing" means
    // this picture is decided elsewhere. A value the MODEL got wrong reports as
    // the second, which is accurate from their side of the screen.
    let refused = null, focus = null;
    if (c.focus !== undefined && c.focus !== null && c.focus !== "") {
      if (!FOCUS_VALUES.includes(c.focus) || slot.tag !== "SafeImage" || slot.focusBound) refused = "cannot";
      // ALREADY THAT WAY IS NOT A CHANGE. `centre` and an absent attribute are
      // the same picture, so putting a centred one back must not rewrite a file.
      else if (c.focus === (slot.focus || "centre")) refused = "already";
      else focus = c.focus;
    }
    // AN ENTRY CAN BE BOTH WORK AND A REFUSAL, and collapsing the two loses the
    // half that is silent. A swap that also named an impossible framing swaps —
    // and the framing was still asked for and still did not happen, so the
    // refusal rides along rather than being dropped. `refused` is a NOTE here;
    // what makes an entry work is having something to write.

    if (c.clear === true) { out.push({ slot, clear: true, focus, refused }); seen.add(key); }
    else if (typeof c.file === "string" && files.has(c.file)) { out.push({ slot, file: c.file, focus, refused }); seen.add(key); }
    else {
      const describe = String(c.describe || "").trim().slice(0, MAX_DESCRIBE);
      // A DESCRIPTION IS WHAT GETS PAID FOR, so an empty one is dropped rather
      // than sent: $0.15 to find out what an image model does with no prompt.
      //
      // A FRAMING CHANGE ON ITS OWN IS THE WHOLE POINT, though, and it costs
      // nothing: "his head is cut off" must not have to buy a new photograph to
      // be answered, and a replacement would very likely be cropped the same
      // way. So an entry carrying a focus and no picture is kept.
      if (!describe) { if (focus || refused) { out.push({ slot, focus, refused }); seen.add(key); } continue; }
      out.push({ slot, describe, focus, refused });
      seen.add(key);
    }
    if (out.length >= MAX_PICTURE_OPS) break;
  }
  return out;
}

/**
 * Put the chosen pictures into the stored source.
 *
 * BACK TO FRONT, and that is not a detail. Each replacement changes the length
 * of the file, so applied in order every offset after the first lands wherever
 * the text has moved to — silently, in the middle of an attribute. The same
 * reason `site-text.mjs` applies its edits in reverse.
 *
 * `src={null}` BECOMES `src="…"`, quotes and all: the recorded span is the value
 * inside the braces, so writing a bare URL there would emit `src={https://…}`,
 * which is not valid TSX. The braces are replaced along with what they held.
 */
export function applyPictures(pages, choices) {
  // THE COPY HERE IS BELT-AND-BRACES AND SAYS SO RATHER THAN PRETENDING TO BE
  // TESTED. A mutant removing it survived the whole suite, correctly: every
  // changed page is written back as `{ ...page, source }`, a fresh object, so
  // nothing is mutated either way. It is kept because that guarantee is an
  // emergent property of a line one edit away from changing, and the failure it
  // would cause — the caller's stored pages silently rewritten before the
  // compile that decides whether to keep them — is unrecoverable.
  const byPath = new Map((Array.isArray(pages) ? pages : []).map((p) => [p.path, { ...p }]));
  const perPage = new Map();
  for (const c of Array.isArray(choices) ? choices : []) {
    // A FOCUS-ONLY CHOICE CARRIES NO URL and is still work. Gated on the url
    // alone, "his head is cut off" would be read, priced, reported — and
    // dropped here before anything was written.
    if (!c || !c.slot || (c.url === undefined && !c.focus)) continue;
    if (!perPage.has(c.slot.page)) perPage.set(c.slot.page, []);
    perPage.get(c.slot.page).push(c);
  }
  const changed = [];
  for (const [path, list] of perPage) {
    const page = byPath.get(path);
    if (!page) continue;
    // ONE SORTED LIST OF EDITS, NOT TWO PASSES. The framing and the photograph
    // are two writes to one element, and a second pass over offsets the first
    // pass moved lands in the middle of an attribute. Collected first, then
    // applied back to front together.
    const edits = [];
    for (const c of list) {
      const s = c.slot;
      if (c.url !== undefined && c.url !== null) {
        const value = JSON.stringify(String(c.url || ""));
        // The braces are part of what is replaced when the attribute was written
        // as an expression, so `src={null}` and `src=""` both end up `src="…"`.
        edits.push({
          at: s.quoted ? s.at : s.at - 1,
          to: s.quoted ? s.to : s.to + 1,
          text: s.quoted ? value.slice(1, -1) : value,
        });
      }
      if (!c.focus) continue;
      // `centre` REMOVES the attribute rather than writing the word, so a
      // picture put back looks exactly like one that never had a focus.
      const back = c.focus === "centre";
      if (s.focusAt != null) {
        // A stored value to replace — or, putting it back, the whole attribute
        // including the ` focus="` in front of it and the quote behind.
        edits.push(back
          ? { at: s.focusAt - ' focus="'.length, to: s.focusTo + 1, text: "" }
          : { at: s.focusAt, to: s.focusTo, text: c.focus });
      } else if (!back) {
        edits.push({ at: s.focusInsertAt, to: s.focusInsertAt, text: ' focus="' + c.focus + '"' });
      }
    }
    if (!edits.length) continue;
    let src = page.source;
    for (const e of edits.sort((a, b) => b.at - a.at)) src = src.slice(0, e.at) + e.text + src.slice(e.to);
    byPath.set(path, { ...page, source: src });
    changed.push(path);
  }
  return { pages: [...byPath.values()], changed };
}

/** The four token kinds, in the shape `pageCredits` prices. One price table, everywhere. */
export function pictureUsage(reply) {
  const u = (reply && reply.usage) || {};
  return {
    in: Number(u.input_tokens) || 0,
    out: Number(u.output_tokens) || 0,
    cacheRead: Number(u.cache_read_input_tokens) || 0,
    cacheWrite: Number(u.cache_creation_input_tokens) || 0,
    model: PICTURE_MODEL,
  };
}

/** What the customer is told. Names the picture, because they cannot see a src. */
export function pictureReply({ used = [], made = [], cleared = [], framed = [], refused = [], failed = 0 } = {}) {
  const bits = [];
  const name = (c) => "“" + c.slot.alt + "”";
  if (used.length) bits.push("put your own photograph" + (used.length > 1 ? "s" : "") + " on " + used.map(name).join(", "));
  if (made.length) bits.push("made " + (made.length === 1 ? "a new picture" : made.length + " new pictures") + " for " + made.map(name).join(", "));
  if (cleared.length) bits.push("took the picture off " + cleared.map(name).join(", "));
  // ITS OWN SENTENCE, AND IT SAYS WHICH WAY IT MOVED. "Adjusted the framing" is
  // not something the owner can check against the page; "shows the top" is.
  // NAMED SEPARATELY FROM A SWAP, or a framing change on a picture that was
  // also replaced reads as though the replacement is what fixed it.
  if (framed.length) {
    const where = (c) => c.focus === "centre" ? "the middle again" : "the " + c.focus;
    bits.push("moved " + framed.map((c) => name(c) + " to show " + where(c)).join(", "));
  }
  let msg = bits.length ? "✅ " + bits.join(", ").replace(/^./, (c) => c.toUpperCase()) + "." : "";
  // THE REFUSALS, NAMED. Folded into the generic "I couldn't match that" they
  // read as the picture not existing, which is the one thing that is certainly
  // not true — the model found it and copied its description back.
  const already = refused.filter((r) => r.refused === "already");
  const cannot = refused.filter((r) => r.refused === "cannot");
  const notes = [];
  if (already.length) {
    // READ OFF THE SLOT, NOT THE CHOICE. A refused entry carries no focus of its
    // own — that is what refusing it means — so the choice's field is null and
    // the sentence came out "already shows the null". What is true and useful is
    // what the picture shows TODAY.
    const has = (r) => (r.slot.focus || "centre") === "centre" ? "the middle" : "the " + r.slot.focus;
    notes.push(already.map(name).join(", ") + (already.length === 1 ? " already shows " : " already show ") +
      has(already[0]) + ".");
  }
  if (cannot.length) {
    notes.push("I couldn't change the framing of " + cannot.map(name).join(", ") +
      " — that one's decided by the page itself.");
  }
  if (!msg && notes.length) return notes.join(" ");
  if (!msg) msg = "I couldn't match that to any of the pictures on your site.";
  if (notes.length) msg += " " + notes.join(" ");
  // A PICTURE THAT COULD NOT BE MADE IS SAID OUT LOUD. It leaves the slot
  // exactly as it was, which looks identical to a change that was never asked
  // for — and the owner has to know before they go looking for it.
  if (failed) msg += " " + (failed === 1 ? "One picture" : failed + " pictures") + " couldn't be made just now — those slots are unchanged.";
  return msg;
}

/**
 * The whole picture layer.
 *
 * `deps.send(request)`      → the Messages API response.
 * `deps.library()`          → the owner's uploaded photographs: [{name, url}].
 * `deps.generate(describe)` → a made picture's URL, or null. May be absent.
 *
 * ESCALATES ONLY WHEN THE SITE HAS NO PICTURE SLOTS AT ALL. A model that read
 * the slots and matched none does NOT escalate: the rungs above cannot swap a
 * photograph either, so sending them up spends ~25 credits to fail differently.
 * The same call `runDataEdit` and `runRulesEdit` both make.
 *
 * A PICTURE THAT CANNOT BE MADE IS NOT A FAILED EDIT. `generate` returning null
 * — no image model configured, no balance, a refused prompt — leaves that slot
 * alone and the others still change. Refusing the whole batch would mean an
 * owner who asked for one uploaded photograph and one made one gets neither.
 */
export async function runPictureEdit(deps, { instruction, pages } = {}) {
  const slots = imageSlots(pages);
  if (!slots.length) return { ok: false, escalate: true, reason: "no-slots", usage: null };

  let library = [];
  try { library = (await deps.library()) || []; } catch { library = []; }

  let reply;
  try { reply = await deps.send(pictureRequest({ instruction, slots, library })); }
  catch (e) { return { ok: false, escalate: false, reason: "send", error: e, usage: null }; }
  const usage = pictureUsage(reply);

  const all = readPictures(reply, slots, library);
  const refused = all.filter((c) => c.refused);
  // WORK IS HAVING SOMETHING TO WRITE, not the absence of a refusal — an entry
  // can be both, and splitting on the note drops a real swap on the floor.
  const picked = all.filter((c) => c.clear || c.file || c.describe || c.focus);
  // EVERY ENTRY REFUSED IS AN ANSWER, NOT A MISS. Falling through to the
  // no-match branch below would report a picture the model found and named as
  // one it could not find — and would send an "already that way" to the
  // needs-place escalation, buying a page rewrite to do nothing.
  if (!picked.length && refused.length) {
    return { ok: false, escalate: false, reason: "no-change", usage, refused, msg: pictureReply({ refused }) };
  }
  if (!picked.length) {
    // ── NOWHERE TO PUT IT IS NOT "I COULD NOT TELL WHICH" ───────────────────
    //
    // This lane fills a slot that already exists — `imageSlots` finds
    // `<SafeImage>` and `<img>`, and inserting a new element into arbitrary TSX
    // is exactly the guess that breaks a page. So "add a photo to the about
    // page", on a page that has none, came back as a REFUSAL: the one shape of
    // picture request this layer's own description advertises and the code
    // cannot do.
    //
    // SIDEWAYS, NOT UP. The layer that CAN is `page` — one page, one model call
    // — whose description already covers "add a block built from parts the page
    // already has", and a `SafeImage` is a part the kit has. The rung ABOVE
    // rewrites every page of the site to add one picture, which is the wrong
    // answer at roughly twice the price.
    //
    // THE MODEL DECIDES, because it is the only party that has just read every
    // slot on the site. Guessing here would send a mistyped SWAP to a page
    // rewrite it never needed. An absent `needsPlace` keeps the honest refusal.
    const place = readNeedsPlace(reply, slots);
    if (place) return { ok: false, escalate: true, reason: "needs-place", layer: "page", page: place, usage };
    return { ok: false, escalate: false, reason: "no-match", usage, msg: pictureReply({}) };
  }

  const byName = new Map((Array.isArray(library) ? library : []).map((f) => [f && f.name, f && f.url]).filter(([n]) => n));
  const resolved = [], used = [], made = [], cleared = [], framed = [];
  let failed = 0;
  for (const c of picked) {
    if (c.focus) framed.push(c);
    // A FRAMING CHANGE WITH NO PICTURE IS THE COMMON CASE and costs nothing —
    // no image model, no money. It carries no url, so without this it falls
    // through to the generate branch and is counted as a picture that could not
    // be made, on the one instruction that never wanted one.
    if (c.focus && !c.clear && !c.file && !c.describe) { resolved.push(c); continue; }
    if (c.clear) { resolved.push({ ...c, url: "" }); cleared.push(c); continue; }
    if (c.file) { resolved.push({ ...c, url: byName.get(c.file) || "" }); used.push(c); continue; }
    if (typeof deps.generate !== "function") { failed++; continue; }
    let url = null;
    try { url = await deps.generate(c.describe); } catch { url = null; }
    if (!url) { failed++; continue; }
    resolved.push({ ...c, url });
    made.push(c);
  }
  if (!resolved.length) return { ok: false, escalate: false, reason: "nothing-made", usage, failed, msg: pictureReply({ failed }) };

  const { pages: next, changed } = applyPictures(pages, resolved);
  return {
    ok: true, pages: next, changed, used, made, cleared, framed, refused, failed, usage,
    msg: pictureReply({ used, made, cleared, framed, refused, failed }),
  };
}
