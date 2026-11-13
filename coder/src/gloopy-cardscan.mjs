// A CARD FROM A PHOTO (owner, 2026-11-13: "yes if dots and bot have it do it pls"; Grok Bot's Vault: "For a card, choose
// Scan with camera or Upload a photo to fill it from the card, or type it in"). The owner's photo of their own card is read
// once by Grok's vision, here on Coder's Worker, to fill the New card form on their own page: its number, expiry and name.
// The photo is not kept, nothing of it reaches Gloopy, and the card is saved only when the owner checks it and saves it.

import { coderSend, coderModel } from "../container/coder-model.mjs";
import { luhn } from "./gloopy-vault.mjs";

/** What the reader is asked (its answer is checked here, never trusted as it is). */
export const SCAN_ASK = "You read a payment card for its owner, who is adding their own card to their password manager. Read the card in the picture. Answer with JSON only, nothing else: {\"number\": \"the card number, digits only\", \"expiry\": \"MM/YY\", \"name\": \"the name on the card\"}. Leave out anything you can't read clearly. If the picture shows no payment card, answer {}.";

/**
 * The card read from a photo ({ type, data }: a picture as checkImages gives it): { ok, number, expiry, name } for the
 * form (a number that passes the Luhn check, an expiry MM / YY), or { error } in the owner's words, with what could be
 * read. `send`: Grok (coderSend) by default.
 */
export async function scanCard(env, image, { fetchFn = fetch, send = null } = {}) {
  const req = { model: coderModel(env), messages: [{ role: "system", content: SCAN_ASK }, { role: "user", content: "The card:", images: ["data:" + image.type + ";base64," + image.data] }], webSearch: false };
  let r;
  try { r = await (send || coderSend(env, { fetchFn }))(req); } catch { return { error: "The photo couldn't be read just now. Try again, or type the card." }; }
  const text = String((r && r.message && r.message.content) || "");
  const m = /\{[\s\S]*\}/.exec(text);
  let j = {};
  try { j = m ? JSON.parse(m[0]) : {}; } catch { j = {}; }
  const out = {};
  const number = String((j && j.number) || "").replace(/\D/g, "");
  if (/^\d{12,19}$/.test(number) && luhn(number)) out.number = number.replace(/(\d{4})(?=\d)/g, "$1 ");
  const e = /^\s*(\d{1,2})\s*\/\s*(\d{2}|\d{4})\s*$/.exec(String((j && j.expiry) || ""));
  if (e && Number(e[1]) >= 1 && Number(e[1]) <= 12) out.expiry = e[1].padStart(2, "0") + " / " + e[2].slice(-2);
  const name = String((j && j.name) || "").replace(/[\p{Cc}\p{Cf}]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 100);
  if (name) out.name = name;
  if (!out.number) return { error: "No card number could be read from that photo. Try a sharper photo, closer and in good light, or type the card.", ...out };
  return { ok: true, ...out };
}
