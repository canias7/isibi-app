// SIGNING AND TOKENS FOR CODER'S SECRETS (owner, 2026-11-06, "7": like Claude
// Code's secret types). Used only by the proxy (root); the AI never sees any of it.
//   oauth  OAuth 2.0 client credentials: a token from the token URL, cached until it expires
//   gcp    a Google Cloud service account: a signed JWT exchanged for a token
//   aws    AWS Signature Version 4 on each request
//   body   a parameter added to a JSON or form body
import { createHash, createHmac, createSign } from "node:crypto";

const tokens = new Map(); // key → { token, until }

/** A bearer token for an oauth or gcp secret (cached until a minute before it expires). */
export async function bearerFor(kind, c, { fetchFn = fetch, now = Date.now } = {}) {
  const key = kind + ":" + (kind === "oauth" ? c.tokenUrl + "|" + c.clientId + "|" + c.scope : JSON.parse(c.keyJson).client_email + "|" + c.scope);
  const hit = tokens.get(key);
  if (hit && hit.until > now()) return hit.token;
  let body;
  const url = kind === "oauth" ? c.tokenUrl : "https://oauth2.googleapis.com/token";
  if (kind === "oauth") {
    body = new URLSearchParams({ grant_type: "client_credentials", client_id: c.clientId, client_secret: c.clientSecret, ...(c.scope ? { scope: c.scope } : {}) });
  } else {
    const k = JSON.parse(c.keyJson);
    const iat = Math.floor(now() / 1000);
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const unsigned = b64({ alg: "RS256", typ: "JWT", ...(k.private_key_id ? { kid: k.private_key_id } : {}) }) + "." + b64({ iss: k.client_email, scope: c.scope, aud: url, iat, exp: iat + 3600 });
    const sig = createSign("RSA-SHA256").update(unsigned).sign(k.private_key).toString("base64url");
    body = new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: unsigned + "." + sig });
  }
  const r = await fetchFn(url, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" }, body: body.toString() });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || typeof j.access_token !== "string") throw new Error("the token request failed (" + r.status + ")");
  tokens.set(key, { token: j.access_token, until: now() + Math.max(60, Number(j.expires_in) || 3600) * 1000 - 60000 });
  return j.access_token;
}
export const forgetTokens = () => tokens.clear();

const sha = (b) => createHash("sha256").update(b).digest("hex");
const hmac = (k, s) => createHmac("sha256", k).update(s).digest();
const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (ch) => "%" + ch.charCodeAt(0).toString(16).toUpperCase());

/** AWS Signature Version 4: the headers to add to one request. */
export function sigv4({ method, host, path, headers = {}, body = Buffer.alloc(0) }, c, now = new Date(), { contentSha = true } = {}) {
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const day = amzDate.slice(0, 8);
  const [rawPath, rawQuery = ""] = String(path || "/").split("?");
  const canonPath = c.service === "s3" ? rawPath : rawPath.split("/").map((p) => enc(decodeURIComponent(p))).join("/");
  const query = rawQuery.split("&").filter(Boolean).map((kv) => { const [k, v = ""] = kv.split("="); return [enc(decodeURIComponent(k.replace(/\+/g, " "))), enc(decodeURIComponent(v.replace(/\+/g, " ")))]; })
    .sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : a[0] < b[0] ? -1 : 1)).map(([k, v]) => k + "=" + v).join("&");
  const payloadHash = sha(body);
  const add = { host, "x-amz-date": amzDate, ...(contentSha ? { "x-amz-content-sha256": payloadHash } : {}), ...(c.sessionToken ? { "x-amz-security-token": c.sessionToken } : {}) };
  const all = { ...Object.fromEntries(Object.entries(headers).filter(([k]) => /^(content-type|content-md5|x-amz-[a-z0-9-]+)$/i.test(k) && !/^x-amz-(date|content-sha256|security-token)$/i.test(k)).map(([k, v]) => [k.toLowerCase(), String(v).trim().replace(/\s+/g, " ")])), ...add };
  const names = Object.keys(all).sort();
  const canon = [method.toUpperCase(), canonPath || "/", query, names.map((k) => k + ":" + all[k] + "\n").join(""), names.join(";"), payloadHash].join("\n");
  const scope = day + "/" + c.region + "/" + c.service + "/aws4_request";
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha(canon)].join("\n");
  const kSign = hmac(hmac(hmac(hmac("AWS4" + c.secretAccessKey, day), c.region), c.service), "aws4_request");
  const signature = createHmac("sha256", kSign).update(toSign).digest("hex");
  return { ...add, authorization: "AWS4-HMAC-SHA256 Credential=" + c.accessKeyId + "/" + scope + ", SignedHeaders=" + names.join(";") + ", Signature=" + signature };
}

/** A body with one parameter set: JSON objects and form bodies; anything else is left as it is. */
export function withBodyParam(contentType, buf, param, value) {
  const ct = String(contentType || "").toLowerCase();
  if (ct.includes("application/json")) {
    let o; try { o = buf.length ? JSON.parse(buf.toString("utf8")) : {}; } catch { return null; }
    if (!o || typeof o !== "object" || Array.isArray(o)) return null;
    o[param] = value;
    return Buffer.from(JSON.stringify(o));
  }
  if (ct.includes("application/x-www-form-urlencoded") || !buf.length) {
    const q = new URLSearchParams(buf.toString("utf8")); q.set(param, value);
    return Buffer.from(q.toString());
  }
  return null;
}
