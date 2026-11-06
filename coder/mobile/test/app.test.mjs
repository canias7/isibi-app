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
  assert.deepEqual(r1, { registered: true, appExists: false, created: false, createError: "" });
  assert.deepEqual(calls[1], ["POST", "/bundleIds", { data: { type: "bundleIds", attributes: { identifier: "dev.gofarther.app", name: "Go Farther", platform: "IOS" } } }]);
  // Already registered, app exists: nothing is created
  calls.length = 0;
  const r2 = await appleCheck({ kid: "K", iss: "I", key, bundleId: "dev.gofarther.app", appName: "Go Farther", fetchFn: fake({ ids: [{ attributes: { identifier: "dev.gofarther.app" } }], apps: [{ id: "A1" }] }), log: () => {} });
  assert.deepEqual(r2, { registered: false, appExists: true, created: false, createError: "" });
  assert.equal(calls.some(([m]) => m === "POST"), false);
  // With create: Apple allows it → the app is made; Apple refuses → its words are kept, nothing breaks
  const withApps = (allow) => async (url, init) => {
    if (url.includes("/bundleIds?")) return new Response(JSON.stringify({ data: [{ id: "BID9", attributes: { identifier: "dev.gofarther.app" } }] }));
    if (url.includes("/apps?")) return new Response(JSON.stringify({ data: [] }));
    if (url.endsWith("/apps") && init.method === "POST") {
      const b = JSON.parse(init.body);
      assert.deepEqual(b, { data: { type: "apps", attributes: { name: "Go Farther", sku: "gofarther", primaryLocale: "en-US", bundleId: "dev.gofarther.app" }, relationships: { bundleId: { data: { type: "bundleIds", id: "BID9" } } } } });
      return allow ? new Response(JSON.stringify({ data: { id: "APP1" } }), { status: 201 }) : new Response(JSON.stringify({ errors: [{ detail: "The resource 'apps' does not allow 'CREATE'. Allowed operations are: GET_COLLECTION, GET_INSTANCE, UPDATE" }] }), { status: 403 });
    }
    return new Response("{}", { status: 404 });
  };
  assert.deepEqual(await appleCheck({ kid: "K", iss: "I", key, bundleId: "dev.gofarther.app", appName: "Go Farther", create: true, fetchFn: withApps(true), log: () => {} }), { registered: false, appExists: true, created: true, createError: "" });
  const refused = await appleCheck({ kid: "K", iss: "I", key, bundleId: "dev.gofarther.app", appName: "Go Farther", create: true, fetchFn: withApps(false), log: () => {} });
  assert.equal(refused.appExists, false); assert.match(refused.createError, /does not allow 'CREATE'/);
  // A wrong key: a plain message naming the secrets to check
  await assert.rejects(appleCheck({ kid: "K", iss: "I", key, bundleId: "x.y", appName: "n", fetchFn: async () => new Response(JSON.stringify({ errors: [{ title: "Authentication credentials are missing or invalid." }] }), { status: 401 }), log: () => {} }), /check APPLE_API_KEY_ID, APPLE_API_ISSUER_ID and APPLE_API_KEY_P8/);
});

test("M5 (live run, 2026-11-06) the Apple check runs before the code is there, names a missing secret, drops a stray new line, and says plainly when a value looks wrong", async () => {
  const { execFileSync } = await import("node:child_process");
  const { mkdtempSync, readFileSync: rf } = await import("node:fs");
  const { join } = await import("node:path");
  const { tmpdir } = await import("node:os");
  const wf = readFileSync(new URL("../../../.github/workflows/build-mobile.yml", import.meta.url), "utf8");
  const block = wf.split("      - name: Check the Apple secrets are there\n")[1].split("      - uses: actions/checkout@v4")[0];
  assert.match(block, /working-directory: \$\{\{ runner\.temp \}\}/, "not in coder/mobile (not checked out yet)");
  const script = block.split("        run: |\n")[1].split("\n").map((l) => l.replace(/^ {10}/, "")).join("\n");
  const run = (env) => { const dir = mkdtempSync(join(tmpdir(), "apple-")); const ge = join(dir, "env"); try { const out = execFileSync("bash", ["-e", "-c", script], { env: { PATH: process.env.PATH, GITHUB_ENV: ge, ...env }, cwd: dir }).toString(); return { code: 0, out, env: rf(ge, "utf8") }; } catch (e) { return { code: e.status, out: String(e.stdout) }; } };
  const good = { A: "ABCDE12345\n", B: "LTWQLJ0000", C: "70ce51ce-0000-4f97-a56d-000000000000", D: "-----BEGIN PRIVATE KEY-----\nAAA\n-----END PRIVATE KEY-----" };
  const ok = run(good);
  assert.equal(ok.code, 0, ok.out);
  assert.match(ok.env, /^TEAM=ABCDE12345\nKID=LTWQLJ0000\nISS=70ce51ce-0000-4f97-a56d-000000000000\n$/, "the stray new line is dropped");
  assert.match(ok.out, /::add-mask::ABCDE12345/);
  const miss = run({ ...good, B: "" });
  assert.notEqual(miss.code, 0); assert.match(miss.out, /::error::Missing GitHub secrets: APPLE_API_KEY_ID/);
  const bad = run({ ...good, A: "my team", D: "not a key" });
  assert.notEqual(bad.code, 0); assert.match(bad.out, /APPLE_TEAM_ID \(10 letters and numbers[\s\S]*APPLE_API_KEY_P8 \(the whole \.p8 file/);
});
