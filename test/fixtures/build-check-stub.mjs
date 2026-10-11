// Preloaded with `node --import` (2026-10-11, round 4): answers EVERY network
// call the real `scripts/build-check.mjs` makes, in-process, so its entry
// point runs end to end with nothing leaving this machine. `fetch` and
// `https.request` are replaced before the script's first line; each call is
// appended to STUB_LOG as one JSON line. A call with no answer here is
// answered 599 and logged, never forwarded. The build POST (the one paid
// call) is logged and answered 500: a harness proves whether it was made.
//   STUB_BALANCE  the balance the credits read answers
//   STUB_RUNTIME  the runtime route's JSON (the image switch and the flags)
//   STUB_RUNTIME_STATUS  its status (200 by default)
import https from "node:https";
import { EventEmitter } from "node:events";
import { appendFileSync } from "node:fs";

const LOG = process.env.STUB_LOG;
const BALANCE = Number(process.env.STUB_BALANCE ?? 50);
const RUNTIME = JSON.parse(process.env.STUB_RUNTIME || "{}");
const RUNTIME_STATUS = Number(process.env.STUB_RUNTIME_STATUS || 200);
const note = (o) => { if (LOG) appendFileSync(LOG, JSON.stringify(o) + "\n"); };
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function answer(method, url) {
  const u = new URL(url);
  const p = u.pathname;
  if (method === "POST" && p === "/auth/v1/admin/generate_link") return json(200, { hashed_token: "stub-hash" });
  if (method === "POST" && p === "/auth/v1/verify") return json(200, { access_token: "stub-jwt", user: { id: "22175f41-6fbf-49d7-b039-a65078a0141c", email: process.env.OWNER_EMAIL } });
  if (method === "GET" && p === "/rest/v1/credits") return json(200, [{ balance: BALANCE }]);
  if (method === "GET" && p === "/rest/v1/credit_events") return json(200, [{ id: 430 }]);
  if (method === "GET" && (p === "/rest/v1/site_backends" || p === "/rest/v1/site_builds")) return json(200, []);
  if (method === "GET" && u.hostname.endsWith(".gofarther.app")) return new Response("not found", { status: 404 });
  if (method === "GET" && p === "/api/site/runtime") return json(RUNTIME_STATUS, RUNTIME_STATUS === 200 ? { ok: true, slug: u.searchParams.get("slug"), ...RUNTIME } : { ok: false });
  return null;
}

globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === "string" ? input : input.url;
  const method = (init.method || "GET").toUpperCase();
  const r = answer(method, url);
  note({ via: "fetch", method, url, status: r ? r.status : 599 });
  return r || new Response("no stub", { status: 599 });
};

https.request = (opts, cb) => {
  const req = new EventEmitter();
  let body = "";
  req.write = (c) => { body += c; };
  req.setTimeout = () => req;
  req.destroy = () => {};
  req.end = () => {
    note({ via: "https", method: opts.method, url: `https://${opts.hostname}${opts.path}`, body, status: 500 });
    const res = new EventEmitter();
    res.statusCode = 500;
    setImmediate(() => { cb(res); res.emit("data", Buffer.from('{"error":"stub: the build was posted"}')); res.emit("end"); });
  };
  return req;
};
