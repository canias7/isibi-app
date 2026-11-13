// YOUR SECURITY KEY FOR GLOOPY'S BROWSER (the owner, 2026-11-11: "Finish the browser"; Grok Bot's "Use hardware
// security keys": the Bot's browser can use a key plugged into your desktop, each use approved first). A page in
// Gloopy's browser, in the cloud, asked to sign in with a security key, and you chose "Use my security key" on its card
// (or in the live view). Here, on your own computer, a small window of this app, at that page's own site address, asks
// your key to sign that very request (the browser's own WebAuthn: your key's touch), and the answer goes back to the
// page. The window's page never comes from the site: this app makes it, so nothing of the site runs here. Only a
// sign-in (never a new key), only for a site with a name over https, and only for that site's own domain.
"use strict";

/** The address the small window opens at (on the site's own origin; served by this app, never fetched). */
const KEY_PATH = "/.well-known/gofarther-security-key";
/** The most your key's touch is waited for. */
const KEY_MS = 2 * 60 * 1000;
const TRANSPORTS = ["usb", "nfc", "ble", "hybrid", "internal", "smart-card"];
const b64uOk = (v, max) => typeof v === "string" && v.length <= max && /^[A-Za-z0-9_-]*$/.test(v);

/**
 * A SIGN-IN THIS APP MAY DO: `origin`, the asking page's (a site with a name over https), and its request kept to what
 * a security key sign-in has (the same rules as on Gloopy's computer). Throws when it is anything else.
 */
function keyAskOf(origin, raw) {
  let u;
  try { u = new URL(String(origin || "")); } catch { u = null; }
  if (!u || u.protocol !== "https:" || u.origin !== origin || !/^([a-z0-9-]+\.)+[a-z][a-z0-9-]*$/i.test(u.hostname)) throw new Error("not a site this app signs in to");
  const host = u.hostname.toLowerCase();
  const r = raw && typeof raw === "object" ? raw : {};
  if (!b64uOk(r.challenge, 1024) || r.challenge.length < 16) throw new Error("not a sign-in request");
  const rpId = typeof r.rpId === "string" && r.rpId ? r.rpId.toLowerCase() : host;
  if (!(rpId === host || (host.endsWith("." + rpId) && rpId.includes(".")))) throw new Error("not a sign-in for this site");
  const allow = Array.isArray(r.allowCredentials) ? r.allowCredentials : [];
  if (allow.length > 64) throw new Error("not a sign-in request");
  const allowCredentials = allow.map((c) => {
    if (!c || !c.id || !b64uOk(c.id, 1400)) throw new Error("not a sign-in request");
    return { id: c.id, transports: (Array.isArray(c.transports) ? c.transports : []).map(String).filter((t) => TRANSPORTS.includes(t)) };
  });
  const userVerification = ["required", "preferred", "discouraged"].includes(r.userVerification) ? r.userVerification : "preferred";
  const timeout = Math.max(30_000, Math.min(KEY_MS, Math.round(Number(r.timeout) || KEY_MS)));
  const appid = typeof r.appid === "string" && /^https:\/\//.test(r.appid) && r.appid.length <= 300 ? r.appid : "";
  return { origin: u.origin, host, request: { challenge: r.challenge, rpId, timeout, userVerification, allowCredentials, ...(appid ? { appid } : {}) } };
}

/** The small window's own page (made here; the site's page never loads). Its words are set by signIn, not written in. */
const KEY_PAGE = '<!doctype html><html><head><meta charset="utf-8"><title>Use your security key</title><style>'
  + "html,body{margin:0;height:100%;font:15px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#faf9f7;color:#1c1917}"
  + "main{padding:26px 28px}h1{font-size:17px;margin:0 0 10px}p{margin:0 0 10px;color:#44403c}b{color:#1c1917}.s{font-size:13px;color:#78716c}"
  + '</style></head><body><main><h1>Use your security key</h1><p>Gloopy\'s browser wants to sign in to <b id="site"></b>.</p><p>Insert your security key and touch it.</p><p class="s" id="note">This window closes by itself.</p></main></body></html>';

/**
 * IN THE SMALL WINDOW (run there, so self-contained): the request, signed by your key as the browser does for a page of
 * that site; what the key signed, as text; or why not (the browser's own word for it).
 */
async function signIn(o) {
  document.getElementById("site").textContent = o.site;
  const un = (v) => Uint8Array.from(atob(String(v).replace(/-/g, "+").replace(/_/g, "/")), (ch) => ch.charCodeAt(0));
  const b64u = (b) => { const a = new Uint8Array(b); let t = ""; for (let i = 0; i < a.length; i++) t += String.fromCharCode(a[i]); return btoa(t).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
  const q = o.request;
  try {
    const c = await navigator.credentials.get({ publicKey: { challenge: un(q.challenge), rpId: q.rpId, timeout: q.timeout, userVerification: q.userVerification,
      allowCredentials: q.allowCredentials.map((x) => ({ type: "public-key", id: un(x.id), ...(x.transports.length ? { transports: x.transports } : {}) })), ...(q.appid ? { extensions: { appid: q.appid } } : {}) } });
    const ext = c.getClientExtensionResults ? c.getClientExtensionResults() : {};
    return { credential: { id: c.id, rawId: b64u(c.rawId), response: { clientDataJSON: b64u(c.response.clientDataJSON), authenticatorData: b64u(c.response.authenticatorData), signature: b64u(c.response.signature), userHandle: c.response.userHandle ? b64u(c.response.userHandle) : "" },
      authenticatorAttachment: c.authenticatorAttachment || "cross-platform", clientExtensionResults: typeof ext.appid === "boolean" ? { appid: ext.appid } : {} } };
  } catch (e) {
    return { error: String((e && e.name) || "NotAllowedError").slice(0, 40), message: String((e && e.message) || "").slice(0, 200) };
  }
}

/**
 * THE APP'S SECURITY KEY SIGN-INS. `deps`: Electron's BrowserWindow and session, and parent (the app's own window, for
 * the small one to sit on). One at a time.
 */
function makeKeys(deps) {
  const { BrowserWindow, session } = deps;
  let busy = false, n = 0;
  return {
    get: async ({ origin, request } = {}) => {
      let ask;
      try { ask = keyAskOf(origin, request); } catch (e) { return { error: "SecurityError", message: String(e.message) }; }
      if (busy) return { error: "InvalidStateError", message: "Your key is in use for another sign-in." };
      busy = true;
      // A session of its own, kept nowhere (no cookies of the site, none left after), whose https is only this page.
      const part = session.fromPartition("gofarther-security-key-" + ++n);
      const at = ask.origin + KEY_PATH;
      part.protocol.handle("https", (req) => (req.url === at ? new Response(KEY_PAGE, { headers: { "content-type": "text/html; charset=utf-8" } }) : new Response("", { status: 404 })));
      const parent = typeof deps.parent === "function" ? deps.parent() : null;
      const win = new BrowserWindow({ width: 440, height: 250, resizable: false, minimizable: false, maximizable: false, fullscreenable: false, show: true, title: "Use your security key", autoHideMenuBar: true,
        ...(parent && !parent.isDestroyed() ? { parent } : {}), webPreferences: { session: part, contextIsolation: true, sandbox: true, nodeIntegration: false } });
      let timer = null;
      try {
        await win.loadURL(at);
        const r = await Promise.race([
          win.webContents.executeJavaScript("(" + signIn.toString() + ")(" + JSON.stringify({ site: ask.host, request: ask.request }) + ")", true),
          new Promise((ok) => win.once("closed", () => ok({ error: "NotAllowedError", message: "The window was closed." }))),
          new Promise((ok) => { timer = setTimeout(() => ok({ error: "NotAllowedError", message: "Your key wasn't touched in time." }), KEY_MS + 5000); }),
        ]);
        return r && typeof r === "object" ? r : { error: "NotAllowedError" };
      } catch (e) {
        return { error: "NotAllowedError", message: String((e && e.message) || e).slice(0, 200) };
      } finally {
        clearTimeout(timer);
        busy = false;
        try { if (!win.isDestroyed()) win.close(); } catch { /* gone */ }
        try { part.protocol.unhandle("https"); } catch { /* gone */ }
      }
    },
  };
}

module.exports = { makeKeys, keyAskOf, signIn, KEY_PATH, KEY_PAGE, KEY_MS };
