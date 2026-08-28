// The SHARE CARD — the picture a chat app shows when the site's link is pasted
// somewhere (2026-08-28, owner's call: "ok build it").
//
// Composed FREE, per build, in the container: the site's name (or its drawn
// wordmark) and its description on the theme's own paper and ink, rendered to
// a 1200×630 PNG by the Chromium that is already in the image for the render
// check. No model call. It exists because the only other source of an og:image
// is the owner's uploads folder — and a `tool` build buys zero photographs by
// design, so every tool site the platform has ever made shipped a bare
// text-only card, forever (measured live on northgroup-17 against shoeroom-1,
// whose bought photographs are why the shopfront HAS one).
//
// PRECEDENCE IS A PERSON FIRST, same as the logo and the icon: the worker's
// `siteOgImage` still prefers an owner upload, and this card is only the
// fallback for the site with none — which is most sites, most of the time.
//
// A LEAF ON PURPOSE except for `isColor` — the one shared reading of "is this
// string safe to put in a stylesheet", which is exactly the question the token
// overrides pose here too. This module composes STRINGS; the browser drive
// (launch, screenshot, write) stays in build-server.mjs beside the render
// check whose launcher it shares.

import { isColor } from "./site-tokens.mjs";
import { oklchToRgb } from "./site-theme.mjs";

// THE SIZE EVERY UNFURLER WANTS, pinned outright (the RESUME_MAX_REFIRES
// lesson: a derived assertion moves with the constant it derives from).
// 1200×630 is the documented og:image size for WhatsApp, iMessage, Slack,
// Facebook and X alike, and `summary_large_image` is keyed off its presence.
export const CARD_W = 1200;
export const CARD_H = 630;

const esc = (s) => String(s == null ? "" : s)
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#39;");

// An OKLCH triple → a CSS rgb() string. `oklchToRgb` answers 0..1 floats and
// clamps into sRGB itself, so this only rounds.
const rgb = (t) => {
  const [r, g, b] = oklchToRgb(t[0], t[1], t[2]).map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255));
  return `rgb(${r},${g},${b})`;
};

/**
 * The card's three colours: the resolved theme's LIGHT half — the default look
 * a visitor gets. `tokens` is accepted for the reason `writeTokens` still runs
 * in the container: the field came OFF the production payload on 2026-08-24
 * ("the look is the theme plus this sheet, nothing else"), so on today's wire
 * it is always absent and the theme decides — but version skew and
 * hand-written payloads reach the container directly, and a patch that still
 * arrives should paint the card the way it paints the site. Each value goes
 * through `isColor` HERE because it lands in a style attribute of markup this
 * module composes — the favicon's second-reading rule.
 *
 * THE STATED LIMIT: a model stylesheet that repaints the ground (`css` is the
 * on-request layer) is NOT read — parsing colour declarations out of raw model
 * CSS is a second reader of a format with recorded traps (last-wins, `.dark`
 * blocks, the minifier's percentage rewrites), and being slightly off-brand on
 * that minority of sites costs less than a wrong parse on all of them.
 */
export function cardColors(theme, tokens) {
  const light = theme && theme.light;
  const out = {
    paper: light && light.paper ? rgb(light.paper) : "#ffffff",
    ink: light && light.ink ? rgb(light.ink) : "#18181b",
    accent: light && light.accent ? rgb(light.accent) : "#18181b",
  };
  const t = tokens && typeof tokens === "object" ? tokens : {};
  if (typeof t.background === "string" && isColor(t.background)) out.paper = t.background;
  if (typeof t.foreground === "string" && isColor(t.foreground)) out.ink = t.foreground;
  if (typeof t.primary === "string" && isColor(t.primary)) out.accent = t.primary;
  return out;
}

/**
 * The whole card as one self-contained HTML document — no external fetches,
 * no scripts, system fonts only (the Dockerfile installs `fonts-liberation`
 * and `fonts-noto-core` for exactly this: a screenshot in a fontless container
 * renders every glyph as tofu, and nothing else in the image ever needed a
 * font FILE).
 *
 * The name is the model's and the description is the customer's, so both are
 * escaped on the way in; the drawn wordmark is `cleanMark`-validated bytes and
 * rides as a data: URI in an <img>, which is what makes its own intrinsic
 * width/height size it rather than the attributes painting at 240px.
 *
 * NO DOMAIN LINE on the card, deliberately: the container cannot know the
 * public host (the site zone and custom domains are the worker's business),
 * and every chat app prints the domain under the card itself — a wrong host
 * baked into pixels would outlive a domain change.
 */
export function cardHtml({ title, description, colors, wordmarkSvg }) {
  const c = colors || cardColors(null, null);
  const name = String(title == null ? "" : title).trim().slice(0, 120) || "App";
  const desc = String(description == null ? "" : description).trim().slice(0, 220);
  // Size tiers rather than one size: a 120-character business name at 96px is
  // clipped mid-word, and CSS cannot size type by its own length.
  const size = name.length > 48 ? 52 : name.length > 24 ? 72 : 96;
  const brand = wordmarkSvg
    ? `<img src="data:image/svg+xml;base64,${Buffer.from(String(wordmarkSvg)).toString("base64")}" alt="" style="display:block;height:150px;width:auto;max-width:${CARD_W - 216}px;object-fit:contain;object-position:left center">`
    : `<div style="font-weight:700;font-size:${size}px;line-height:1.04;letter-spacing:-0.02em;color:${c.ink};overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${esc(name)}</div>`;
  return `<!doctype html><html><head><meta charset="utf-8"></head>
<body style="margin:0;width:${CARD_W}px;height:${CARD_H}px;overflow:hidden">
<div style="width:${CARD_W}px;height:${CARD_H}px;box-sizing:border-box;background:${c.paper};display:flex;flex-direction:column;justify-content:center;padding:0 108px;font-family:system-ui,'Liberation Sans','Noto Sans',sans-serif">
  <div style="height:6px;width:84px;background:${c.accent};margin-bottom:36px"></div>
  ${brand}
  ${desc ? `<div style="font-weight:400;font-size:30px;line-height:1.4;color:${c.ink};opacity:.66;margin-top:28px;max-width:30em;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical">${esc(desc)}</div>` : ""}
</div></body></html>`;
}
