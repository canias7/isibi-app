// NOTIFICATIONS, LIKE CLAUDE CODE'S (owner, 2026-11-07, item 8: "no phone notifications"). Claude Code's
// docs (mobile, remote-control; read 2026-11-07): a push "when a long-running task finishes or when it
// needs a decision from you", or asked for ("notify me when the tests finish"); "Push when Claude decides"
// and "Push when actions required"; none while you are focused on the session. Web Push: RFC 8030, the
// sender's key RFC 8292 (VAPID), the message encrypted for its device RFC 8291.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const P = await import("../src/coder-push.mjs");
const HERE = (p) => new URL("../" + p, import.meta.url);
const te = new TextEncoder();
function fakeBucket() {
  const m = new Map();
  return { m, async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { m.set(k, typeof v === "string" ? v : String(v)); }, async delete(k) { m.delete(k); },
    async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
}
const KEY = Buffer.alloc(32, 7).toString("base64");
const UID = "user-1234567890abcdef", ID = "shop-n1";
async function hkdf(salt, ikm, info, n) {
  const k = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, k, n * 8));
}
/** A browser: its push keys, and how it opens a message (RFC 8291, the receiver's side). */
async function fakeDevice(endpoint = "https://fcm.googleapis.com/fcm/send/abc123") {
  const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const pub = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  const open = async (body) => {
    const b = new Uint8Array(body);
    const salt = b.slice(0, 16), idlen = b[20], asPub = b.slice(21, 21 + idlen), ct = b.slice(21 + idlen);
    const as = await crypto.subtle.importKey("raw", asPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
    const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: as }, pair.privateKey, 256));
    const ikm = await hkdf(auth, ecdh, new Uint8Array([...te.encode("WebPush: info\u0000"), ...pub, ...asPub]), 32);
    const key = await crypto.subtle.importKey("raw", await hkdf(salt, ikm, te.encode("Content-Encoding: aes128gcm\u0000"), 16), "AES-GCM", false, ["decrypt"]);
    const pt = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: await hkdf(salt, ikm, te.encode("Content-Encoding: nonce\u0000"), 12) }, key, ct));
    assert.equal(pt.at(-1), 2, "the last record's delimiter");
    return JSON.parse(new TextDecoder().decode(pt.slice(0, -1)));
  };
  return { sub: { endpoint, keys: { p256dh: P.b64u(pub), auth: P.b64u(auth) } }, open };
}

test("CD187 the encryption is RFC 8291's, byte for byte (its own example); a fresh message opens on the device; Coder's key signs a VAPID note for each push service (RFC 8292), made once and kept sealed", async () => {
  const u = P.unb64u;
  const asPub = u("BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8");
  const privateKey = await crypto.subtle.importKey("jwk", { kty: "EC", crv: "P-256", d: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw", x: P.b64u(asPub.slice(1, 33)), y: P.b64u(asPub.slice(33)) }, { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const publicKey = await crypto.subtle.importKey("raw", asPub, { name: "ECDH", namedCurve: "P-256" }, true, []);
  const out = await P.encryptPush(u("BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4"), u("BTBZMqHH6r4Tts7J_aSIgg"), te.encode("When I grow up, I want to be a watermelon"), { as: { privateKey, publicKey }, salt: u("DGv6ra1nlYgDCS1FRnbzlw") });
  assert.equal(P.b64u(out), "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN");
  // A fresh one (new keys and salt each time) opens on the device.
  const dev = await fakeDevice();
  const body = await P.encryptPush(u(dev.sub.keys.p256dh), u(dev.sub.keys.auth), te.encode(JSON.stringify({ title: "hi" })));
  assert.deepEqual(await dev.open(body), { title: "hi" });
  // CODER'S KEY: made once, sealed, the same next time.
  const bucket = fakeBucket(), env = { CODER_TOKEN_KEY: KEY, CODER_BUCKET: bucket };
  const v = await P.vapidKeys(env, bucket);
  assert.equal(P.unb64u(v.publicKey).length, 65);
  assert.deepEqual(await P.vapidKeys(env, bucket), v);
  assert.doesNotMatch(bucket.m.get("coder/push/vapid.json"), new RegExp(v.jwk.d), "the private key is never stored as it is");
  const jwt = await P.vapidJwt(v, "https://fcm.googleapis.com/fcm/send/abc", Date.UTC(2026, 10, 7, 12));
  const [h, b, sig] = jwt.split(".");
  assert.deepEqual(JSON.parse(new TextDecoder().decode(P.unb64u(h))), { typ: "JWT", alg: "ES256" });
  assert.deepEqual(JSON.parse(new TextDecoder().decode(P.unb64u(b))), { aud: "https://fcm.googleapis.com", exp: Date.UTC(2026, 10, 7, 12) / 1000 + 12 * 3600, sub: "https://gofarther.dev" });
  const pub = await crypto.subtle.importKey("raw", P.unb64u(v.publicKey), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  assert.equal(await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pub, P.unb64u(sig), te.encode(h + "." + b)), true);
});

/** The Worker's routes, for one owner; every push to a device recorded and opened. */
async function worker() {
  const { handleCoder } = await import("../src/coder-routes.mjs");
  const bucket = fakeBucket();
  const env = { CODER_ON: "on", CODER_USERS: "me@x.y", GITHUB_APP_CLIENT_ID: "Iv1.abc", GITHUB_APP_CLIENT_SECRET: "shh", CODER_TOKEN_KEY: KEY, CODER_PUBLIC_URL: "https://coder.gofarther.dev", CODER_BUCKET: bucket };
  const sent = [];
  let answer = 201;
  const fetchFn = async (url, init = {}) => { sent.push({ url: String(url), headers: init.headers, body: init.body }); return new Response("", { status: answer }); };
  const go = (path, init = {}) => handleCoder(new Request("https://gofarther.dev/api/coder/" + path, { ...init, headers: { "content-type": "application/json" } }), env, {}, { fetchFn, authUser: async () => ({ id: UID, email: "me@x.y" }), container: () => null });
  return { go, bucket, env, sent, fetchFn, setAnswer: (s) => { answer = s; } };
}

test("CD188 the owner's devices: only a browser's own push service is taken (never any other address), kept sealed; the two switches; a test push reaches the device signed and encrypted; a device the push service says is gone is forgotten", async () => {
  const w = await worker();
  const info = await (await w.go("push")).json();
  assert.deepEqual([info.decides, info.actions, info.devices, P.unb64u(info.key).length], [true, true, 0, 65], "both switches on, like Claude Code's two");
  const dev = await fakeDevice();
  const add = (s) => w.go("push/subscribe", { method: "POST", body: JSON.stringify(s) });
  for (const bad of [{ ...dev.sub, endpoint: "https://evil.example/push" }, { ...dev.sub, endpoint: "http://fcm.googleapis.com/x" }, { ...dev.sub, endpoint: "https://fcm.googleapis.com:8443/x" }, { ...dev.sub, endpoint: "https://fcm.googleapis.com.evil.example/x" }, { ...dev.sub, keys: { p256dh: "short", auth: dev.sub.keys.auth } }, { endpoint: dev.sub.endpoint }]) {
    assert.equal((await add(bad)).status, 400, JSON.stringify(bad).slice(0, 80));
  }
  assert.deepEqual(await (await add(dev.sub)).json(), { ok: true, devices: 1 });
  assert.equal((await (await add(dev.sub)).json()).devices, 1, "the same device once");
  assert.doesNotMatch(w.bucket.m.get(P.pushKey(UID)), /fcm\.googleapis|abc123/, "kept sealed");
  for (const ep of ["https://updates.push.services.mozilla.com/wpush/v2/x", "https://web.push.apple.com/Qx", "https://wns2-par02p.notify.windows.com/w/?token=x"]) assert.ok(P.cleanSub({ ...dev.sub, endpoint: ep }), ep);
  // THE SWITCHES.
  assert.deepEqual(await (await w.go("push/settings", { method: "POST", body: JSON.stringify({ decides: false }) })).json(), { ok: true, decides: false, actions: true });
  // A TEST: to the device, signed (VAPID) and encrypted (aes128gcm), whatever the switches.
  assert.deepEqual(await (await w.go("push/test", { method: "POST", body: "{}" })).json(), { ok: true, sent: 1 });
  const s = w.sent[0];
  assert.equal(s.url, dev.sub.endpoint);
  assert.deepEqual([s.headers["content-encoding"], s.headers.ttl, s.headers.urgency], ["aes128gcm", "86400", "normal"]);
  assert.match(s.headers.authorization, /^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]{87}$/);
  assert.deepEqual(await dev.open(s.body), { title: "Coder", body: "Notifications are on for this device.", tag: "coder", url: "/" });
  // GONE (the push service says 410): forgotten.
  w.setAnswer(410);
  assert.deepEqual(await (await w.go("push/test", { method: "POST", body: "{}" })).json(), { ok: true, sent: 0 });
  assert.equal((await (await w.go("push")).json()).devices, 0);
  w.setAnswer(201);
  await add(dev.sub);
  assert.equal((await (await w.go("push/unsubscribe", { method: "POST", body: JSON.stringify({ endpoint: dev.sub.endpoint }) })).json()).devices, 0);
});

test("CD189 what a running job sends: Coder's own notify, its question, a key or an approval it needs (actions required), the end of a long job (not a short one); each new step once; none about a chat the owner is looking at; each switch respected", async () => {
  const w = await worker();
  const L = await import("../src/coder-live.mjs");
  const dev = await fakeDevice();
  await w.go("push/subscribe", { method: "POST", body: JSON.stringify(dev.sub) });
  const started = Date.now() - 5 * 60_000;
  const setMeta = (o = {}) => w.bucket.put("coder/" + UID + "/" + ID + "/meta.json", JSON.stringify({ id: ID, repo: "ana/shop", title: "Fix the cart", turn: 2, status: "running", at: started, ...o }));
  await setMeta();
  const chat = UID + "/" + ID, pass = await L.livePass(w.env, chat, 2);
  const send = (from, events) => L.handleLive(new Request("https://coder.gofarther.dev" + L.LIVE_PATH, { method: "POST", headers: { "content-type": "application/json", "x-coder-chat": chat, "x-coder-turn": "2", "x-coder-live": pass }, body: JSON.stringify({ from, events }) }), w.env, { fetchFn: w.fetchFn });
  const opened = async () => Promise.all(w.sent.splice(0).map((s) => dev.open(s.body)));
  // A step that is not news: nothing. Coder's notify: a push, opening the chat.
  await send(0, [{ type: "bash", command: "npm test" }, { type: "notify", text: "The tests finished: 48 passed." }]);
  assert.deepEqual(await opened(), [{ title: "Coder · Fix the cart", body: "The tests finished: 48 passed.", tag: ID, url: "/?chat=" + ID }]);
  // The same steps sent again: no second push.
  await send(0, [{ type: "bash", command: "npm test" }, { type: "notify", text: "The tests finished: 48 passed." }]);
  assert.deepEqual(await opened(), []);
  // ACTIONS REQUIRED: a question, urgent.
  await send(2, [{ type: "question", text: "Which database?", options: [] }]);
  assert.equal(w.sent[0].headers.urgency, "high");
  assert.deepEqual((await opened()).map((x) => [x.title, x.body]), [["Coder needs your answer · Fix the cart", "Which database?"]]);
  await send(3, [{ type: "secret", host: "api.stripe.com", reason: "to run the payment tests" }, { type: "envchange", kind: "allow_host", host: "registry.example.com", reason: "the private packages" }]);
  assert.deepEqual((await opened()).map((x) => x.title), ["Coder needs a key · Fix the cart", "Coder asks to change the environment · Fix the cart"]);
  // THE END OF A LONG JOB (5 minutes): a push. Of a short one: none.
  await send(5, [{ type: "done", text: "Fixed the total; all 48 tests pass." }]);
  assert.deepEqual((await opened()).map((x) => [x.title, x.body]), [["Coder finished · Fix the cart", "Fixed the total; all 48 tests pass."]]);
  await setMeta({ at: Date.now() - 20_000 });
  await send(6, [{ type: "done", text: "Quick answer." }]);
  assert.deepEqual(await opened(), []);
  // THE OWNER IS LOOKING AT THE CHAT (its page polled, visible and focused): no push about it.
  await setMeta();
  await w.go("projects/" + ID + "/state?since=0&seen=1").catch(() => null);
  assert.equal(JSON.parse(w.bucket.m.get(P.seenKey(UID))).id, ID);
  await send(7, [{ type: "notify", text: "x" }]);
  assert.deepEqual(await opened(), []);
  // ANOTHER CHAT is not this one; a switch off stops its kind only.
  await w.bucket.put(P.seenKey(UID), JSON.stringify({ id: "other-chat", at: Date.now() }));
  await w.go("push/settings", { method: "POST", body: JSON.stringify({ actions: false }) });
  await send(8, [{ type: "question", text: "Off?" }, { type: "notify", text: "On." }]);
  assert.deepEqual((await opened()).map((x) => x.body), ["On."]);
});

test("CD190 Coder's notify tool (at most 3 a job); the page: Notifications in the account menu, its panel with Claude Code's two switches, this device on or off, a test; the service worker shows a push and opens its chat; polls say when the chat is being looked at; /?chat= opens it", async () => {
  const { runCoder } = await import("../container/coder-agent.mjs");
  const call = (args, id) => ({ id, type: "function", function: { name: "notify", arguments: JSON.stringify(args) } });
  const events = [];
  let i = 0;
  const steps = [{ message: { role: "assistant", content: "", tool_calls: [call({ message: "Tests  done:\n48 passed" }, "n1"), call({ message: "" }, "n2"), call({ message: "b" }, "n3"), call({ message: "c" }, "n4"), call({ message: "d" }, "n5")] } }, { message: { role: "assistant", content: "Done." } }];
  const r = await runCoder({ send: async () => steps[i++], exec: async () => ({ code: 0, output: "" }), emit: (e) => events.push(e) }, { text: "go" });
  assert.deepEqual(events.filter((e) => e.type === "notify").map((e) => e.text), ["Tests done: 48 passed", "b", "c"]);
  assert.match(r.messages.find((m) => m.tool_call_id === "n2").content, /^error: write the message/);
  assert.match(r.messages.find((m) => m.tool_call_id === "n5").content, /^error: at most 3 notifications a job/);
  // THE PAGE.
  assert.match(readFileSync(HERE("public/index.html"), "utf8"), /<button type="button" role="menuitem" id="gfNotify">Notifications<\/button><button type="button" role="menuitem" id="gfOut">Sign out<\/button>/);
  assert.match(readFileSync(HERE("public/app.js"), "utf8"), /\$\('gfNotify'\)\.addEventListener\('click', \(\) => \{ \$\('gfMenu'\)\.hidden = true; window\.dispatchEvent\(new CustomEvent\('gf:side', \{ detail: false \}\)\); window\.dispatchEvent\(new CustomEvent\('gf:notify'\)\); \}\);/);
  const ui = readFileSync(HERE("public/coder.js"), "utf8");
  assert.match(ui, /window\.addEventListener\('gf:notify', \(\) => \{ showNotifications\(\); \}\)/);
  assert.match(ui, /<b>Push when Coder decides<\/b>[\s\S]*<b>Push when actions are required<\/b>/);
  assert.match(ui, /reg\.pushManager\.subscribe\(\{ userVisibleOnly: true, applicationServerKey: keyBytes\(info\.key\) \}\)/);
  assert.match(ui, /navigator\.serviceWorker\.register\('\/sw\.js'\)/);
  assert.match(ui, /const seen = document\.visibilityState === 'visible' && document\.hasFocus\(\) \? '&seen=1' : '';/);
  assert.match(ui, /if \(want && S\.projects\.some\(\(x\) => x\.id === want\)\) return openProject\(want\);/);
  assert.equal((ui.match(/\bfetch\(/g) || []).length, 1, "still one door for every request");
  // THE SERVICE WORKER: shows a push; a tap opens (or focuses) the chat, on this site only; nothing cached.
  const sw = readFileSync(HERE("public/sw.js"), "utf8");
  const handlers = {};
  const shown = [], opened = [];
  const self = { addEventListener: (t, f) => { handlers[t] = f; }, location: { origin: "https://gofarther.dev" }, skipWaiting() {},
    registration: { showNotification: async (title, o) => shown.push({ title, ...o }) },
    clients: { claim: async () => {}, matchAll: async () => [], openWindow: async (u) => opened.push(u) } };
  new Function("self", sw)(self);
  assert.deepEqual(Object.keys(handlers).sort(), ["activate", "install", "notificationclick", "push"], "no fetch handler: nothing is cached");
  let wait;
  handlers.push({ data: { json: () => ({ title: "Coder needs your answer · Fix the cart", body: "Which database?", tag: ID, url: "/?chat=" + ID }) }, waitUntil: (p) => { wait = p; } });
  await wait;
  assert.deepEqual([shown[0].title, shown[0].body, shown[0].tag, shown[0].data.url], ["Coder needs your answer · Fix the cart", "Which database?", ID, "/?chat=" + ID]);
  handlers.push({ data: { json: () => ({ title: "x", url: "https://evil.example/" }) }, waitUntil: (p) => { wait = p; } });
  await wait;
  assert.equal(shown[1].data.url, "/", "only this site's own pages");
  handlers.notificationclick({ notification: { close() {}, data: { url: "/?chat=" + ID } }, waitUntil: (p) => { wait = p; } });
  await wait;
  assert.deepEqual(opened, ["https://gofarther.dev/?chat=" + ID]);
});
