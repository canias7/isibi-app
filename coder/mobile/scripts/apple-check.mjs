// BEFORE THE IPHONE BUILD (owner, 2026-11-06: "let me just give you the api"):
// with the owner's App Store Connect API key (a GitHub secret, never shown),
// register the app's ID with Apple if it is not there yet, and check the app
// exists in App Store Connect, so the build stops at once with a plain message
// instead of failing at the end. Apple's API cannot create the app itself:
// that one step is the owner's, in App Store Connect.
//
//   KID, ISS          the key's ID and issuer ID
//   KEY_PATH          the key file (AuthKey_….p8), put there for this run only
//   BUNDLE_ID         dev.gofarther.app      APP_NAME   Go Farther
import { readFileSync } from "node:fs";
import { createPrivateKey, sign } from "node:crypto";

const API = "https://api.appstoreconnect.apple.com/v1";

/** A short-lived token for Apple's API, signed with the key (ES256), 15 minutes. */
export function appleToken({ kid, iss, key, now = Date.now() }) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const t = Math.floor(now / 1000);
  const data = b64({ alg: "ES256", kid, typ: "JWT" }) + "." + b64({ iss, iat: t, exp: t + 900, aud: "appstoreconnect-v1" });
  const sig = sign("sha256", Buffer.from(data), { key: createPrivateKey(key), dsaEncoding: "ieee-p1363" }).toString("base64url");
  return data + "." + sig;
}

/** Register the ID if needed; say whether the app exists. Returns { registered, appExists }. */
export async function appleCheck({ kid, iss, key, bundleId, appName, fetchFn = fetch, log = console.log }) {
  const token = appleToken({ kid, iss, key });
  const call = async (method, path, body) => {
    const r = await fetchFn(API + path, { method, headers: { authorization: "Bearer " + token, "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const why = (j.errors && j.errors[0] && (j.errors[0].detail || j.errors[0].title)) || ("HTTP " + r.status);
      throw new Error("Apple said: " + why + (r.status === 401 ? " (check APPLE_API_KEY_ID, APPLE_API_ISSUER_ID and APPLE_API_KEY_P8)" : r.status === 403 ? " (the key needs the Admin or App Manager role)" : ""));
    }
    return j;
  };
  const found = await call("GET", "/bundleIds?filter[identifier]=" + encodeURIComponent(bundleId) + "&limit=200");
  let registered = false;
  if (!(found.data || []).some((d) => d.attributes && d.attributes.identifier === bundleId)) {
    await call("POST", "/bundleIds", { data: { type: "bundleIds", attributes: { identifier: bundleId, name: appName, platform: "IOS" } } });
    registered = true;
    log("Registered the app ID " + bundleId + " with Apple.");
  } else log("The app ID " + bundleId + " is already registered with Apple.");
  const apps = await call("GET", "/apps?filter[bundleId]=" + encodeURIComponent(bundleId) + "&limit=1");
  const appExists = (apps.data || []).length > 0;
  log(appExists ? "The app is in App Store Connect." : "The app is not in App Store Connect yet.");
  return { registered, appExists };
}

if (import.meta.url === "file://" + process.argv[1]) {
  const { KID, ISS, KEY_PATH, BUNDLE_ID = "dev.gofarther.app", APP_NAME = "Go Farther" } = process.env;
  appleCheck({ kid: KID, iss: ISS, key: readFileSync(KEY_PATH, "utf8"), bundleId: BUNDLE_ID, appName: APP_NAME })
    .then(({ appExists }) => {
      if (!appExists) {
        console.log("::error::Create the app in App Store Connect first: https://appstoreconnect.apple.com/apps → + → New App → iOS, name " + APP_NAME + ", Bundle ID " + BUNDLE_ID + ", any SKU (e.g. gofarther). Then press the button again.");
        process.exit(1);
      }
    })
    .catch((e) => { console.log("::error::" + String(e.message || e)); process.exit(1); });
}
