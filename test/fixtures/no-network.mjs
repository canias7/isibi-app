// ── NO REAL NETWORK IN A TEST (2026-10-09, parallel round 4) ───────────────
//
// Codex's aggregate local run was stopped by its own approval review, which
// flagged a possible call to the outside image service: a fixture put the
// real `fetch` back when its case ended, and work that case had left running
// (a background purchase, a reply writer, a queued delivery) could then reach
// the real network. A missing mock must fail loudly, not leave the machine.
//
// So a fixture that takes the wire puts THIS back when it is done, never the
// real `fetch`: loopback, `data:` and `blob:` still pass (the build server's
// own tests talk to a local port), and anything else is refused and recorded.
// A fixture's own catch-all (the 503 a stand-in answers for an address it does
// not know) records too, so a case can assert that nothing unexpected was
// asked for at all.

const REAL = globalThis.fetch;
const seen = [];

/** Addresses that never leave the machine. */
export function isLocal(url) {
  const u = String(url || "");
  if (/^(data|blob):/i.test(u)) return true;
  let host = "";
  try { host = new URL(u).hostname; } catch { return false; }
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
}

/** Note an address a stand-in was not set up to answer. */
export function noteUnexpected(method, url, by = "") {
  seen.push({ method: String(method || "GET").toUpperCase(), url: String(url || ""), by: String(by || "") });
}

/** Every unexpected request since the last `clearUnexpected()`, oldest first. */
export function unexpected() { return seen.slice(); }

/** Start counting again. */
export function clearUnexpected() { seen.length = 0; }

/** The fetch a fixture puts back: loopback passes; anything else is refused and recorded. */
export async function blockedFetch(input, init) {
  const url = String((input && input.url) || input || "");
  const method = String((init && init.method) || (input && input.method) || "GET");
  if (isLocal(url)) return REAL(input, init);
  noteUnexpected(method, url, "blocked");
  throw new TypeError("network blocked in tests: " + method.toUpperCase() + " " + url);
}

/** Put the blocking fetch in place for the whole test file. */
export function blockNetwork() { globalThis.fetch = blockedFetch; return blockedFetch; }
