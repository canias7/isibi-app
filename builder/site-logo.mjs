// The `logo` layer: a business's own artwork at the top of its own site.
//
// WHAT WAS THERE BEFORE: the business NAME, as text, on every site the platform
// has ever made. `SiteHeader` takes `brand: string` and `SiteChrome` takes
// `name: string` — there was no image slot anywhere in the frame, so a business
// with a logo could not use it at all.
//
// THE HARD HALF WAS NEVER THE SLOT, IT WAS SAYING WHICH PICTURE. Uploads are
// stored under a hash of their own contents, so there is no filename to match
// "use the one with the black lettering" against. A picker in the uploads panel
// was the first answer and the owner turned it down for the obvious better one:
// *"just normal, hey this is my logo put it there"*. **The attachment IS the
// choice** — nothing has to be matched, nothing has to be remembered, and it is
// how a person would say it to a person.
//
// COSTS ~0.3 CREDITS AND REWRITES NO PAGE. The URL is stored in the site's own
// `_meta` and read at COMPILE time, so every page gets the logo without one line
// of page source changing and without the pages model being called at all — the
// same shape as the `look` layer, and the reason this is a rung on the ladder
// rather than a revise.
//
// Plain module with its side effects injected, like `site-picture.mjs` beside
// it, so every decision here is tested with no R2, no model and no Worker.

/** 2 MB. A header logo is a small piece of artwork; anything larger is a photo. */
export const MAX_LOGO_BYTES = 2_000_000;

/**
 * What a data URL has to look like before it is decoded.
 *
 * The prefix is checked but NEVER trusted — `sniffImage` reads the real leading
 * bytes, and that is what decides. This only bounds what is worth decoding at
 * all, so a 30 MB string of anything is refused before it becomes a Uint8Array.
 */
const DATA_URL = /^data:image\/[a-z0-9.+-]+;base64,([A-Za-z0-9+/=]+)$/i;

/** How much base64 can encode 2 MB, with room for the padding. */
const MAX_B64 = Math.ceil(MAX_LOGO_BYTES * 4 / 3) + 64;

/**
 * Bytes out of an attached image, or a reason it cannot be one.
 *
 * `sniff` is injected rather than imported so this module stays free of the
 * Worker's own helpers and can be driven with anything in a test.
 *
 * SVG IS REFUSED, AND THIS IS THE ONE REFUSAL THAT WILL ANNOY SOMEBODY. A logo
 * is the single most likely thing a business has as an SVG — it is what a
 * designer hands them. But `/u/` serves `content-disposition: inline` from the
 * site's own origin and an SVG is a DOCUMENT that can carry `<script>`, so
 * accepting one is stored XSS on a customer's own domain, which `nosniff` does
 * not help with because the type would be declared honestly. `site-uploads.mjs`
 * already refuses it for exactly this reason; refusing it here too keeps one
 * rule rather than two, and the message says what to send instead rather than
 * just saying no.
 */
export function readLogoImage(dataUrl, { sniff } = {}) {
  const s = typeof dataUrl === "string" ? dataUrl : "";
  if (!s) return { ok: false, reason: "none" };
  if (/^data:image\/svg/i.test(s)) return { ok: false, reason: "svg" };
  const m = DATA_URL.exec(s);
  if (!m) return { ok: false, reason: "unreadable" };
  if (m[1].length > MAX_B64) return { ok: false, reason: "too_big" };

  let bytes;
  try {
    const bin = atob(m[1]);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } catch { return { ok: false, reason: "unreadable" }; }

  // CHECKED AFTER DECODING TOO, not only on the base64 length. The bound above
  // is about what is worth decoding; this is the real size of the thing that
  // would be stored, and only one of the two is the actual limit.
  if (bytes.length > MAX_LOGO_BYTES) return { ok: false, reason: "too_big" };
  const kind = typeof sniff === "function" ? sniff(bytes) : null;
  // THE DECLARED TYPE DECIDES NOTHING. A caller can write any media type into a
  // data URL, so the leading bytes are the only honest answer to "is this an
  // image" — the same rule the upload route already applies.
  if (!kind) return { ok: false, reason: "not_an_image" };
  return { ok: true, bytes, kind };
}

/** What to tell the customer when it could not be used. One sentence each. */
export function logoRefusal(reason) {
  switch (reason) {
    case "none":
      return "Attach the logo with the 📎 button and say it's your logo — I'll put it in the header.";
    case "svg":
      return "I can't use an SVG logo — export it as a PNG (with a transparent background if it has one) and attach that instead.";
    case "too_big":
      return "That image is too large for a logo — anything under 2 MB is plenty, and a PNG about 600px wide is ideal.";
    case "not_an_image":
      return "I couldn't read that as an image. A PNG, JPEG, WebP or GIF works.";
    default:
      return "I couldn't use that as a logo — try attaching it again as a PNG.";
  }
}

/**
 * Run the layer.
 *
 * `deps.store({bytes, kind})` → the public URL of the stored upload, or null.
 * `deps.save({logo})`         → persist it on the site.
 * `deps.publish()`            → recompile and republish.
 *
 * NOTHING IS SAVED UNTIL THE IMAGE IS STORED, and nothing is published until it
 * is saved. Written the other way round, a failed upload leaves a site pointing
 * at an address that 404s — a header with a broken-image glyph on every page,
 * which is worse than the text it replaced. Same ordering rule as the site
 * delete, one file over.
 */
export async function runLogoEdit(deps, { images, remove } = {}) {
  // A REMOVAL NEEDS NO IMAGE, and it has to be asked first — otherwise "take the
  // logo off" is answered with "attach a logo", which is the opposite of what
  // was asked and reads as the builder not listening. The router decides this,
  // the way it already decides a page deletion: three attempts to get a model to
  // volunteer a removal from the instruction alone failed against words it was
  // demonstrably reading.
  if (remove === true) {
    try { await deps.save({ logo: "" }); }
    catch { return { ok: false, reason: "store", msg: "That couldn't be saved just now — your site is unchanged. Try again." }; }
    const gone = await deps.publish();
    if (!gone || !gone.ok) return { ok: false, reason: "publish", msg: "I took the logo off but couldn't republish just now — try again in a moment." };
    return { ok: true, removed: true, files: gone.files, msg: "✅ Took the logo off — the header shows your name again." };
  }

  const first = Array.isArray(images) ? images.find((i) => typeof i === "string" && i) : null;
  const read = readLogoImage(first, deps);
  if (!read.ok) return { ok: false, reason: read.reason, msg: logoRefusal(read.reason) };

  let url = null;
  try { url = await deps.store({ bytes: read.bytes, kind: read.kind }); }
  catch { url = null; }
  if (!url) return { ok: false, reason: "store", msg: "I couldn't save that image just now — your site is unchanged. Try again." };

  try { await deps.save({ logo: url }); }
  catch { return { ok: false, reason: "store", msg: "I couldn't save that just now — your site is unchanged. Try again." }; }

  const pub = await deps.publish();
  // THE URL IS STORED AND THE PUBLISH FAILED, which is a real state and not a
  // failure to report as "nothing happened": the next publish of this site — a
  // colour change, a typo fix — will carry the logo. Said plainly rather than
  // pretending either way.
  if (!pub || !pub.ok) return { ok: false, reason: "publish", url, msg: "I saved your logo but couldn't republish just now. Try again, or it'll appear with your next change." };
  return { ok: true, url, files: pub.files, msg: "✅ That's your logo in the header now, on every page." };
}
