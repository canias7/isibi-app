// Proving a published site belongs to the business that owns it.
//
// Google Search Console, Bing Webmaster, Pinterest and Facebook all ask for the
// same thing: a `<meta>` tag with a token they generated, in the head of the
// site's home page. Until this there was no slot for one — every tag in a
// published head is composed by `__root.tsx` out of a sidecar the platform
// writes, and an owner could not add a character to either. So a business could
// not get itself indexed, could not see
// what it ranked for, and could not run an ad on Facebook against its own
// domain. Nothing was broken; there was simply no way in.
//
// AN ALLOW-LIST OF NAMES, NOT A SNIPPET, AND THAT IS THE WHOLE DESIGN.
//
// Every CMS offers "paste some HTML into your head", and every one of them is
// a stored-XSS hole on the customer's own domain. This module takes a PROVIDER
// and a TOKEN: the tag's name comes from a fixed table here, and the token is
// checked against the shape every one of these providers actually issues. There
// is therefore no escaping question to get wrong, because nothing arbitrary
// reaches the markup — the same reasoning that made `site-tokens.mjs` parse
// colours rather than pass strings through into a stylesheet.
//
// SCRIPTS ARE DELIBERATELY OUT, and that is a decision rather than a gap.
// Analytics — Google Analytics, Plausible, Fathom — is the other thing people
// put in a head, and it is a completely different question: it needs a
// `script-src` the published-site CSP does not grant, it puts a third party on
// every visitor's page, and on a small business's site it carries consent
// obligations we would be handing them silently. When that gets built it gets
// built as its own thing, with its own answer to all three.
//
// A leaf module: no imports, no I/O, so every decision here is testable on its
// own.

/**
 * WHO MAY BE PROVEN TO, and the exact tag each one asks for.
 *
 * Each entry is what that provider's own instructions tell an owner to paste.
 * The `meta` name is ours to emit and never comes from a caller, which is what
 * makes the token the only variable — and the token is checked below.
 */
export const VERIFIERS = {
  google: {
    meta: "google-site-verification",
    label: "Google Search Console",
    // What the owner is looking at when they come here, so the panel can tell
    // them which of the several strings on that page to copy.
    hint: "Search Console → Settings → Ownership verification → HTML tag",
  },
  bing: {
    meta: "msvalidate.01",
    label: "Bing Webmaster Tools",
    hint: "Bing Webmaster → Site verification → Meta tag",
  },
  pinterest: {
    meta: "p:domain_verify",
    label: "Pinterest",
    hint: "Pinterest Business → Settings → Claimed accounts → Claim website",
  },
  facebook: {
    meta: "facebook-domain-verification",
    label: "Facebook / Instagram",
    hint: "Meta Business Suite → Brand safety → Domains",
  },
  yandex: {
    meta: "yandex-verification",
    label: "Yandex Webmaster",
    hint: "Yandex Webmaster → Site rights → Meta tag",
  },
};

/** The provider names, in the order the panel offers them. */
export const VERIFIER_NAMES = Object.keys(VERIFIERS);

/**
 * A TOKEN IS AN OPAQUE STRING OF A KNOWN SHAPE, and refusing anything else is
 * what makes the emitted tag safe by construction rather than by escaping.
 *
 * Every provider in the table issues base64url-ish text — letters, digits,
 * `-`, `_`, `.` and sometimes `=` padding. None of them issues a space, a quote
 * or an angle bracket, so accepting one could only ever mean somebody pasted
 * the WHOLE `<meta …>` line, which this deliberately does not try to unpick:
 * see `readPastedTag` below, which does that as its own explicit step.
 *
 * Bounded at both ends. Google's is 43 characters and Facebook's is 30; the
 * floor stops a stray word being stored as a token that then silently fails
 * verification, and the ceiling stops the head growing without limit.
 */
export const MIN_TOKEN = 8;
export const MAX_TOKEN = 128;
const TOKEN = /^[A-Za-z0-9_.=-]+$/;

export function isVerificationToken(v) {
  if (typeof v !== "string") return false;
  const t = v.trim();
  return t.length >= MIN_TOKEN && t.length <= MAX_TOKEN && TOKEN.test(t);
}

/**
 * PEOPLE PASTE THE WHOLE TAG, because that is what the provider's page gives
 * them a copy button for. Refusing it and saying "just the token please" is a
 * support question we would be creating on purpose, so the content attribute is
 * lifted out when the value is obviously a tag.
 *
 * ONLY the `content` attribute, and only when the thing looks like a meta tag —
 * this is a convenience on the way IN, not a parser. Anything it cannot read
 * falls through to the token check, which refuses it with a message.
 */
export function readPastedTag(v) {
  const s = String(v == null ? "" : v).trim();
  if (!s.startsWith("<")) return s;
  const m = s.match(/\bcontent\s*=\s*["']([^"']*)["']/i);
  return m ? m[1].trim() : s;
}

/**
 * What is really stored, out of whatever a caller sent.
 *
 * ABSENT MEANS UNCHANGED AND EMPTY MEANS REMOVE — the rule every edit path in
 * this codebase already follows, and the only one that gives an owner a way to
 * take a verification off without a second verb. A provider we do not know is
 * dropped rather than stored, because a name nobody emits is a setting that
 * reads as applied and does nothing.
 *
 * Returns `{ verify, refused }` — the refusals travel, or a token that was
 * rejected for its shape is indistinguishable from one that was accepted, and
 * an owner whose verification silently never happens has nothing to act on.
 */
export function mergeVerification(current, patch) {
  const out = {};
  const cur = current && typeof current === "object" ? current : {};
  for (const name of VERIFIER_NAMES) {
    if (isVerificationToken(cur[name])) out[name] = String(cur[name]).trim();
  }
  const refused = [];
  const p = patch && typeof patch === "object" ? patch : {};
  for (const [name, raw] of Object.entries(p)) {
    if (!Object.hasOwn(VERIFIERS, name)) { refused.push({ name, reason: "unknown" }); continue; }
    // `undefined` is silence; anything else is an instruction, including the
    // empty string, which is the removal verb.
    if (raw === undefined) continue;
    const token = readPastedTag(raw);
    if (!token) { delete out[name]; continue; }
    if (!isVerificationToken(token)) { refused.push({ name, reason: "shape" }); continue; }
    out[name] = token;
  }
  return { verify: out, refused };
}

/**
 * The tags, as `{name, content}` pairs for the site's own document to render.
 *
 * PAIRS RATHER THAN HTML, because the head is no longer patched into a built
 * shell — under Start the document is `__root.tsx` rendered per request, and it
 * reads a sidecar the platform writes. So this is the wire format between the
 * two, and the split falls exactly where it should: **the platform decides which
 * names may be emitted at all, and the template renders what it is handed.**
 * A provider added here reaches every published site with no template change and
 * no site rebuilt — and, more importantly, a site cannot name its own tag.
 *
 * Emitted in a FIXED order — the table's, not the object's — so a site whose
 * settings have not changed produces a byte-identical head. Key order on a JSON
 * round trip is not something to depend on, and a head that reshuffles every
 * publish is a diff nobody can read.
 */
export function verificationPairs(verify) {
  const v = verify && typeof verify === "object" ? verify : {};
  const out = [];
  for (const name of VERIFIER_NAMES) {
    const token = v[name];
    if (!isVerificationToken(token)) continue;
    out.push({ name: VERIFIERS[name].meta, content: String(token).trim() });
  }
  return out;
}

/**
 * What to tell the owner, in one sentence.
 *
 * A refusal has to name the provider AND why, because "that didn't work" over a
 * 43-character opaque string leaves somebody re-pasting the same thing. The two
 * reasons need different actions: a shape refusal means they copied the wrong
 * part of the page, and an unknown provider means we do not support that one.
 */
export function verificationNote({ verify, refused } = {}) {
  const parts = [];
  const on = VERIFIER_NAMES.filter((n) => verify && isVerificationToken(verify[n]));
  if (on.length) parts.push("Verifying with " + on.map((n) => VERIFIERS[n].label).join(", ") + ".");
  const bad = Array.isArray(refused) ? refused : [];
  const shape = bad.filter((r) => r.reason === "shape").map((r) => (VERIFIERS[r.name] || {}).label || r.name);
  if (shape.length) {
    parts.push("Couldn't read the code for " + shape.join(", ") +
      " — copy the whole meta tag, or just the content=\"…\" part of it.");
  }
  const unknown = bad.filter((r) => r.reason === "unknown").map((r) => r.name);
  if (unknown.length) parts.push("Don't know how to verify with " + unknown.join(", ") + ".");
  return parts.join(" ");
}
