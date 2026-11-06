// The phone app's settings (owner, 2026-11-06: the phone apps).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
const read = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const png = (f) => { const b = readFileSync(new URL("../" + f, import.meta.url)); assert.equal(b.toString("latin1", 1, 4), "PNG", f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test("M1 the app opens gofarther.dev, says it is the app, keeps GitHub's sign-in inside, and has an offline page", () => {
  const c = JSON.parse(read("capacitor.config.json"));
  assert.equal(c.appId, "dev.gofarther.app"); assert.equal(c.appName, "Go Farther");
  assert.equal(c.server.url, "https://gofarther.dev");
  assert.deepEqual(c.server.allowNavigation, ["github.com"]);
  assert.equal(c.server.errorPath, "offline.html"); assert.ok(existsSync(new URL("../www/offline.html", import.meta.url)));
  assert.match(c.appendUserAgent, /^GoFartherApp\/\d+\.\d+\.\d+$/, "the page hides its download buttons and handles links");
  assert.equal(c.server.cleartext, undefined, "never plain http");
  const pkg = JSON.parse(read("package.json"));
  for (const v of Object.values({ ...pkg.dependencies, ...pkg.devDependencies })) assert.match(v, /^\d+\.\d+\.\d+$/, "exact versions");
});

test("M2 the Android and iPhone projects are named Go Farther and use the GF icons", () => {
  assert.match(read("android/app/src/main/res/values/strings.xml"), /<string name="app_name">Go Farther<\/string>/);
  assert.match(read("ios/App/App/Info.plist"), /<key>CFBundleDisplayName<\/key>\s*<string>Go Farther<\/string>/);
  assert.match(read("android/app/src/main/res/values/ic_launcher_background.xml"), /#0D1B2A/);
  assert.deepEqual(png("ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"), [1024, 1024]);
  assert.deepEqual(png("android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png"), [192, 192]);
  // The iPhone icon has no see-through parts (Apple refuses those).
  const b = readFileSync(new URL("../ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png", import.meta.url));
  assert.equal(b[25], 2, "RGB, no transparency");
});

test("M3 TestFlight: the app answers Apple's encryption question once (standard HTTPS only), and the build button signs with an App Store Connect key, never storing it", () => {
  assert.match(read("ios/App/App/Info.plist"), /<key>ITSAppUsesNonExemptEncryption<\/key>\s*<false\/>/);
  const wf = readFileSync(new URL("../../../.github/workflows/build-mobile.yml", import.meta.url), "utf8");
  for (const s of ["APPLE_TEAM_ID", "APPLE_API_KEY_ID", "APPLE_API_ISSUER_ID", "APPLE_API_KEY_P8"]) assert.match(wf, new RegExp("secrets\\." + s));
  assert.match(wf, /-allowProvisioningUpdates -authenticationKeyPath/);
  assert.match(wf, /plutil -insert method -string app-store-connect "\$P"/);
  assert.match(wf, /- name: Remove the key\n\s+if: always\(\)/);
  assert.doesNotMatch(wf, /echo "\$P8"|cat .*AuthKey/, "the key is never printed");
});


test("M4 the Apple check: a real ES256 token Apple can verify; registers the app ID only when missing; says plainly when the app is not in App Store Connect", async () => {
  const { generateKeyPairSync, verify } = await import("node:crypto");
  const { appleToken, appleCheck } = await import("../scripts/apple-check.mjs");
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const key = privateKey.export({ type: "pkcs8", format: "pem" });
  const tok = appleToken({ kid: "KID123", iss: "ISS-UUID", key, now: 1_800_000_000_000 });
  const [h, p, s] = tok.split(".");
  assert.deepEqual(JSON.parse(Buffer.from(h, "base64url")), { alg: "ES256", kid: "KID123", typ: "JWT" });
  assert.deepEqual(JSON.parse(Buffer.from(p, "base64url")), { iss: "ISS-UUID", iat: 1_800_000_000, exp: 1_800_000_900, aud: "appstoreconnect-v1" });
  assert.ok(verify("sha256", Buffer.from(h + "." + p), { key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(s, "base64url")), "the signature checks out");
  // Not registered, no app yet
  const calls = [];
  const fake = (state) => async (url, init) => {
    calls.push([init.method, url.replace("https://api.appstoreconnect.apple.com/v1", ""), init.body ? JSON.parse(init.body) : null]);
    assert.match(init.headers.authorization, /^Bearer [\w-]+\.[\w-]+\.[\w-]+$/);
    if (url.includes("/bundleIds?")) return new Response(JSON.stringify({ data: state.ids }));
    if (url.endsWith("/bundleIds")) return new Response(JSON.stringify({ data: { id: "B1" } }), { status: 201 });
    if (url.includes("/apps?")) return new Response(JSON.stringify({ data: state.apps }));
    return new Response("{}", { status: 404 });
  };
  const r1 = await appleCheck({ kid: "K", iss: "I", key, bundleId: "dev.gofarther.app", appName: "Go Farther", fetchFn: fake({ ids: [{ attributes: { identifier: "dev.gofarther.app.other" } }], apps: [] }), log: () => {} });
  assert.deepEqual(r1, { registered: true, appExists: false });
  assert.deepEqual(calls[1], ["POST", "/bundleIds", { data: { type: "bundleIds", attributes: { identifier: "dev.gofarther.app", name: "Go Farther", platform: "IOS" } } }]);
  // Already registered, app exists: nothing is created
  calls.length = 0;
  const r2 = await appleCheck({ kid: "K", iss: "I", key, bundleId: "dev.gofarther.app", appName: "Go Farther", fetchFn: fake({ ids: [{ attributes: { identifier: "dev.gofarther.app" } }], apps: [{ id: "A1" }] }), log: () => {} });
  assert.deepEqual(r2, { registered: false, appExists: true });
  assert.equal(calls.some(([m]) => m === "POST"), false);
  // A wrong key: a plain message naming the secrets to check
  await assert.rejects(appleCheck({ kid: "K", iss: "I", key, bundleId: "x.y", appName: "n", fetchFn: async () => new Response(JSON.stringify({ errors: [{ title: "Authentication credentials are missing or invalid." }] }), { status: 401 }), log: () => {} }), /check APPLE_API_KEY_ID, APPLE_API_ISSUER_ID and APPLE_API_KEY_P8/);
});
