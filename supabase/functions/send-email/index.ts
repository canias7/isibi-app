// Supabase Auth "Send Email" hook → Go Farther mailer.
// Auth: standard-webhooks signature (SEND_EMAIL_HOOK_SECRET), not JWT.
// Links point at isibi.ai/confirm.html (verifies token_hash directly), so
// they work regardless of the project's Site URL setting.
//
// Deployed to the fifa-tournament-hub Supabase project as `send-email`
// (verify_jwt OFF — the webhook signature is the auth). Secrets used:
// GO_FARTHER_API_KEY, SEND_EMAIL_HOOK_SECRET, optional EMAIL_FROM.
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const GF_ENDPOINT = "https://lkpfeqrelvziltfwpuxi.supabase.co/functions/v1/mailer";

const SUBJECTS: Record<string, string> = {
  signup: "Confirm your isibi account",
  magiclink: "Your isibi sign-in code",
  email: "Your isibi sign-in code",
  recovery: "Reset your isibi password",
  email_change: "Confirm your new email",
  invite: "You're invited to isibi",
};

Deno.serve(async (req) => {
  const apiKey = Deno.env.get("GO_FARTHER_API_KEY");
  const hookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET");
  if (!apiKey) return json({ error: "GO_FARTHER_API_KEY not set" }, 500);
  if (!hookSecret) return json({ error: "SEND_EMAIL_HOOK_SECRET not set" }, 500);

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
  const link = `https://isibi.ai/confirm.html?token_hash=${encodeURIComponent(email_data.token_hash || "")}&type=${encodeURIComponent(kind)}`;

  const html = `
  <div style="font-family:Inter,system-ui,sans-serif;background:#0a0a0b;color:#f4f4f5;padding:36px;border-radius:16px;max-width:480px;margin:0 auto">
    <div style="font-weight:800;font-size:18px;margin-bottom:18px">
      <span style="background:linear-gradient(135deg,#ffd60a,#a855f7);border-radius:8px;padding:3px 9px;color:#0a0a0b">i</span>
      isibi
    </div>
    <p style="font-size:15px;color:#c9c9cf;margin:0 0 10px">${SUBJECTS[kind] || "Your code"}:</p>
    <div style="font-size:38px;font-weight:800;letter-spacing:10px;margin:14px 0;color:#ffd60a">${token}</div>
    <p style="font-size:13px;color:#8b8b93;margin:16px 0 0">The code expires in 1 hour. If you didn't request it, you can ignore this email.</p>
    <p style="font-size:12px;color:#5c5c66;margin-top:18px">Or just click: <a href="${link}" style="color:#a855f7">confirm &amp; sign in</a></p>
  </div>`;
  const text = `${SUBJECTS[kind] || "Your code"}: ${token}\n\nExpires in 1 hour. Or open: ${link}`;

  const r = await fetch(GF_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "send",
      from: Deno.env.get("EMAIL_FROM") || "isibi <login@isibi.ai>",
      to: user.email,
      subject: SUBJECTS[kind] || "Your isibi code",
      html,
      text,
      idempotency_key: email_data.token_hash || undefined,
    }),
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    console.error("Go Farther send failed:", r.status, detail);
    return json({ error: "send failed", detail: detail.slice(0, 300) }, 500);
  }
  return json({}, 200);
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
