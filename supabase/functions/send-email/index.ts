// Supabase Auth "Send Email" hook → Cloudflare Email Service.
// Auth: standard-webhooks signature (SEND_EMAIL_HOOK_SECRET), not JWT.
// Links point at gofarther.dev/confirm (verifies token_hash directly), so
// they work regardless of the project's Site URL setting.
//
// Moved off Go Farther 2026-07-30 (owner stopped the account). This runs on
// Supabase's Deno, not on Cloudflare, so it CANNOT use the Workers `send_email`
// binding and goes through the REST API with a token instead. The Worker's own
// mail path uses the binding and needs no token at all.
//
// The send still happens in the BACKGROUND. GoTrue aborts this hook after 5s and
// a signup that trips that limit fails outright with "Failed to reach hook within
// maximum time" — so returning 200 immediately is not an optimisation, it is what
// stops a slow moment from breaking sign-in. Cloudflare should be faster than the
// ~3.5-4s Go Farther took, but the hook must not depend on that being true.
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const cfEndpoint = (accountId: string) =>
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/email/sending/send`;

const SUBJECTS: Record<string, string> = {
  signup: "Confirm your Go Farther account",
  magiclink: "Your Go Farther sign-in code",
  email: "Your Go Farther sign-in code",
  recovery: "Reset your Go Farther password",
  email_change: "Confirm your new email",
  invite: "You're invited to Go Farther",
};

Deno.serve(async (req) => {
  const accountId = Deno.env.get("CF_ACCOUNT_ID");
  const apiToken = Deno.env.get("CF_EMAIL_TOKEN");
  const hookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET");

  // A MISSING MAILER MUST NOT BREAK SIGNING UP.
  //
  // GoTrue treats a non-2xx from this hook as a failure of the whole auth
  // operation, so returning 500 here means one wrong character in a secret stops
  // people creating accounts at all — strictly worse than the mail simply not
  // arriving, which is the situation this is replacing. So: log it loudly, answer
  // 200, and let the account be created. The person can ask for another code once
  // the config is fixed; they cannot un-fail a signup that was refused.
  //
  // Named separately so the log says WHICH half is missing rather than "not
  // configured", because that is the whole question when this fires.
  const missing = [
    !accountId && "CF_ACCOUNT_ID",
    !apiToken && "CF_EMAIL_TOKEN",
  ].filter(Boolean);
  if (missing.length) {
    console.error("MAIL NOT CONFIGURED — no email sent. Missing:", missing.join(", "));
    return json({}, 200);
  }

  // The signature is different in kind and still refuses: it is the only thing
  // proving this request came from GoTrue and not from a stranger, so failing it
  // open would let anyone trigger mail to any address.
  if (!hookSecret) {
    console.error("SEND_EMAIL_HOOK_SECRET not set — refusing, since the caller cannot be verified");
    return json({ error: "hook secret not set" }, 500);
  }

  const payload = await req.text();
  let user: any, email_data: any;
  try {
    const wh = new Webhook(hookSecret.replace("v1,whsec_", ""));
    ({ user, email_data } = wh.verify(payload, Object.fromEntries(req.headers)) as any);
  } catch {
    return json({ error: "invalid signature" }, 401);
  }

  const kind = email_data.email_action_type || "email";
  const token = email_data.token || "";
  const link = `https://gofarther.dev/confirm?token_hash=${encodeURIComponent(email_data.token_hash || "")}&type=${encodeURIComponent(kind)}`;

  // The platform's own tokens: white ground, near-black ink, a black accent.
  // This was the last surface still wearing the retired dark brand (#0a0a0b with a
  // pink-to-amber gradient), which meant the one email a new customer sees looked
  // like a different product from the page they had just come from.
  //
  // Every colour is inline and literal rather than a variable: mail clients strip
  // <style> blocks, and several will not read a CSS custom property at all.
  const html = `
  <div style="margin:0;padding:32px 16px;background:#f4f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
    <div style="max-width:440px;margin:0 auto;background:#ffffff;border:1px solid rgba(0,0,0,.11);border-radius:18px;padding:32px 30px">
      <div style="font-weight:700;font-size:17px;color:#0b0b0e;margin-bottom:26px">
        <span style="display:inline-block;background:#000000;color:#ffffff;border-radius:7px;padding:2px 9px;margin-right:7px;font-weight:800">G</span>Go Farther
      </div>
      <p style="font-size:15px;color:rgba(11,11,14,.56);margin:0 0 6px">${SUBJECTS[kind] || "Your code"}</p>
      <div style="font-size:36px;font-weight:800;letter-spacing:9px;color:#0b0b0e;margin:10px 0 22px">${token}</div>
      <a href="${link}" style="display:inline-block;background:#000000;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 22px;border-radius:11px">Confirm &amp; sign in</a>
      <p style="font-size:13px;color:rgba(11,11,14,.56);margin:24px 0 0;line-height:1.5">
        The code expires in 1 hour. If you didn't ask for it, you can ignore this email.
      </p>
    </div>
    <p style="max-width:440px;margin:16px auto 0;font-size:12px;color:rgba(11,11,14,.42);text-align:center">gofarther.dev</p>
  </div>`;
  const text = `${SUBJECTS[kind] || "Your code"}: ${token}\n\nExpires in 1 hour. Or open: ${link}`;

  // Fire the email in the background so this hook returns immediately.
  //
  // No idempotency key: Cloudflare's send body takes to/from/subject/html/text and
  // nothing was found in its API reference for one, and sending a field the API
  // does not know risks the whole request being refused. Go Farther had one, so
  // this is a real if small regression — a GoTrue hook retry can now deliver the
  // same code twice. Two identical codes is a far smaller problem than a rejected
  // body, and the codes themselves stay single-use.
  const send = fetch(cfEndpoint(accountId), {
    method: "POST",
    headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: Deno.env.get("EMAIL_FROM") || "Go Farther <login@gofarther.dev>",
      to: user.email,
      subject: SUBJECTS[kind] || "Your Go Farther code",
      html,
      text,
    }),
  })
    .then(async (r) => {
      // The body is logged on failure because this runs detached — without it a
      // dead mailer is indistinguishable from a working one from out here, which
      // is how the previous provider's outage would have looked.
      if (!r.ok) console.error("Cloudflare send failed:", r.status, (await r.text().catch(() => "")).slice(0, 300));
    })
    .catch((e) => console.error("Cloudflare send threw:", String(e)));

  // Keep the worker alive to finish the background send after we respond.
  const rt = (globalThis as any).EdgeRuntime;
  if (rt && typeof rt.waitUntil === "function") rt.waitUntil(send);

  return json({}, 200);
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
