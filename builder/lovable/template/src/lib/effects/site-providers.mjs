// Sending one email or one text through the site owner's own provider
// (2026-10-27: moved out of worker.js so a site's own Worker runs the same
// code the platform did; the site template carries a byte-identical copy,
// kept in step by test/site-effects-copy.test.mjs).
//
// Every key here is the SITE OWNER'S own (Resend, SendGrid, Postmark, Twilio,
// Vonage, MessageBird). Nothing of the platform's.

export async function readCapped(resp, maxBytes) {
  if (!resp || !resp.body || !resp.body.getReader) {
    const ab = await resp.arrayBuffer();
    return new Uint8Array(ab).subarray(0, maxBytes);
  }
  const reader = resp.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value && value.length) {
        chunks.push(value);
        total += value.length;
        if (total >= maxBytes) break; // ceiling hit — stop pulling more bytes
      }
    }
  } finally {
    try { await reader.cancel(); } catch {}
  }
  const out = new Uint8Array(Math.min(total, maxBytes));
  let off = 0;
  for (const c of chunks) {
    if (off >= out.length) break;
    const take = Math.min(c.length, out.length - off);
    out.set(c.subarray(0, take), off);
    off += take;
  }
  return out;
}

export async function postProviderEmail(provider, key, from, to, subject, html) {
  let url, headers, bodyObj;
  if (provider === "sendgrid") { url = "https://api.sendgrid.com/v3/mail/send"; headers = { Authorization: "Bearer " + key, "Content-Type": "application/json" }; bodyObj = { personalizations: [{ to: [{ email: to }] }], from: { email: from }, subject, content: [{ type: "text/html", value: html }] }; }
  else if (provider === "postmark") { url = "https://api.postmarkapp.com/email"; headers = { "X-Postmark-Server-Token": key, "Content-Type": "application/json", Accept: "application/json" }; bodyObj = { From: from, To: to, Subject: subject, HtmlBody: html }; }
  else { url = "https://api.resend.com/emails"; headers = { Authorization: "Bearer " + key, "Content-Type": "application/json" }; bodyObj = { from, to, subject, html }; }
  try {
    const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify(bodyObj), signal: AbortSignal.timeout(12000) });
    await readCapped(resp, 4096);
    return { ok: resp.status >= 200 && resp.status < 300, status: resp.status };
  } catch { return { ok: false, status: 0 }; }
}
/**
 * Send one text through whichever provider the owner configured.
 *
 * Three shapes, kept as data rather than three code paths, because they differ
 * only in where the credential and the fields go. Twilio is form-encoded and
 * basic-auth'd; MessageBird and Vonage are JSON.
 *
 * NEVER THROWS — `sendSms` treats a falsy `ok` as a refusal and the booking has
 * already succeeded either way.
 */
export async function postProviderSms(provider, key, secret, from, to, body) {
  let url, headers, payload, form = false;
  if (provider === "twilio") {
    url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(key)}/Messages.json`;
    headers = { Authorization: "Basic " + btoa(key + ":" + secret), "Content-Type": "application/x-www-form-urlencoded" };
    payload = new URLSearchParams({ From: from, To: to, Body: body }).toString();
    form = true;
  } else if (provider === "vonage") {
    url = "https://rest.nexmo.com/sms/json";
    headers = { "Content-Type": "application/json" };
    // Vonage carries its credential IN THE BODY rather than a header — the one
    // real irregularity here, and the reason this is a switch and not a table.
    payload = { api_key: key, api_secret: secret, from, to: to.replace(/^\+/, ""), text: body };
  } else {
    url = "https://rest.messagebird.com/messages";
    headers = { Authorization: "AccessKey " + key, "Content-Type": "application/json" };
    payload = { originator: from, recipients: [to], body };
  }
  try {
    const resp = await fetch(url, {
      method: "POST", headers,
      body: form ? payload : JSON.stringify(payload),
      signal: AbortSignal.timeout(12000),
    });
    const text = await readCapped(resp, 4096);
    // VONAGE ANSWERS 200 ON FAILURE. Its `messages[].status` is "0" for
    // success and a numeric error code otherwise, so trusting the HTTP status
    // here would report every rejected message as sent — and the owner would
    // be told their customer was texted when nobody was.
    if (provider === "vonage") {
      let j = null; try { j = JSON.parse(text); } catch { /* not json */ }
      const first = j && Array.isArray(j.messages) && j.messages[0];
      return { ok: !!(first && String(first.status) === "0"), status: resp.status };
    }
    return { ok: resp.status >= 200 && resp.status < 300, status: resp.status };
  } catch { return { ok: false, status: 0 }; }
}
