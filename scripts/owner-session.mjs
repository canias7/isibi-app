// SIGNING IN AS THE OWNER, ONCE, FOR EVERY SCRIPT THAT NEEDS IT.
//
// Lifted out of build-as-owner.mjs when `answer-read.mjs` arrived needing the
// same twenty lines. A second copy of an authentication handshake is this repo's
// "two lists of the same thing" in its most expensive form: the copies drift,
// and the drift shows up as one script mysteriously unable to sign in while the
// other is fine — a failure that looks like a credential problem and is not.
//
// NO PASSWORD IS INVOLVED. The service key asks GoTrue's admin API for a
// one-time magic link, and the link is immediately exchanged for a session. The
// link is consumed by that exchange, so nothing reusable is left behind.
//
// THE LOG LINES LIVE HERE, not at the call sites, and that is deliberate: the
// build log's "step 1"/"step 2" wording is what a session reads when a sign-in
// goes wrong, and two callers free to describe the same handshake differently is
// how one of them ends up saying less. `log` is injected so each caller keeps
// its own timestamping and file writing.

/** A secret described by its length, never shown. */
export const desc = (v) => (v ? `set (${String(v).length} chars)` : "MISSING");

/**
 * Open a session as `email`, returning the JWT and the ready-made auth headers.
 *
 * THROWS rather than exiting. A module that calls `process.exit` decides the
 * caller's failure mode for it — build-as-owner wants a `FATAL:` line in its own
 * log file, and a one-shot reader wants a non-zero exit, and neither should be
 * imposed by the handshake.
 */
export async function ownerSession({ supabaseUrl, serviceKey, anonKey, email, log = () => {} }) {
  const svc = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "content-type": "application/json" };

  log("step 1 — asking GoTrue admin for a one-time magic link (no password involved)");
  const gl = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
    method: "POST", headers: svc,
    body: JSON.stringify({ type: "magiclink", email }),
  });
  const glBody = await gl.json().catch(() => ({}));
  const tokenHash = glBody.hashed_token || (glBody.properties && glBody.properties.hashed_token);
  log(`step 1 — generate_link answered ${gl.status}; token_hash ${desc(tokenHash)}`);
  if (!gl.ok || !tokenHash) throw new Error("could not generate a sign-in link: " + JSON.stringify(glBody).slice(0, 300));

  log("step 2 — exchanging the one-time token for a session (consumes the link)");
  const vr = await fetch(`${supabaseUrl}/auth/v1/verify`, {
    method: "POST", headers: { apikey: anonKey, "content-type": "application/json" },
    body: JSON.stringify({ type: "magiclink", token_hash: tokenHash }),
  });
  const session = await vr.json().catch(() => ({}));
  const jwt = session.access_token;
  log(`step 2 — verify answered ${vr.status}; access_token ${desc(jwt)}; user=${(session.user && session.user.email) || "?"}`);
  if (!vr.ok || !jwt) throw new Error("could not open a session: " + JSON.stringify(session).slice(0, 300));
  // WHO WE ACTUALLY SIGNED IN AS. The build script spends real credits, so it
  // refuses to proceed as anybody but the account it was told to be — and the
  // check belongs here rather than there, because every future caller of this
  // handshake wants it and none of them should have to remember it.
  if (session.user && session.user.email && session.user.email !== email) {
    throw new Error(`signed in as ${session.user.email}, expected ${email} — refusing to act as anybody else`);
  }
  return { jwt, user: session.user || null, auth: { Authorization: `Bearer ${jwt}`, "content-type": "application/json" } };
}
