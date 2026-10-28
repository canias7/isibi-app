// THE TEST RUN OF THE SITE'S OWN SERVER CODE, INSIDE ITS SANDBOX (2026-10-28).
//
// Started by `server-dryrun.mjs` with no environment, Node's permission model
// (no file system beyond this file, no child processes, no workers) and, from
// root, an unprivileged user. Reads `[{ name, js, hooks }]` on stdin, runs each
// function once against a FAKE `site` helper — outside calls are answered here
// and never leave, the database answers no rows, files live in memory, every key
// "is set" — and prints `{ results: [...] }` on stdout.

const enc = new TextEncoder();
globalThis.fetch = async () => { throw new Error("server code called fetch directly; use site.fetch"); };

function fakeSite(hosts, rec) {
  const files = new Map();
  return {
    slug: "test-site",
    key(name) {
      if (!/^[A-Z][A-Z0-9_]{0,63}$/.test(String(name))) throw new Error("a key name is uppercase letters, digits and _");
      rec.keys.add(String(name));
      return "@@gfkey:" + name + "@@";
    },
    hasKey(name) { rec.keys.add(String(name)); return true; },
    async fetch(url, init = {}) {
      const u = new URL(String(url));
      if (u.protocol !== "https:") throw new Error("that address is refused: not https");
      const host = u.hostname.toLowerCase();
      rec.calls.push({ host, method: String((init && init.method) || "GET").toUpperCase() });
      if (!hosts.includes(host)) throw new Error("this function did not declare " + host + " in `hosts`");
      if (rec.calls.length > 10) throw new Error("too many outside calls in one request");
      // A PLAUSIBLE EMPTY ANSWER: JSON that reads as an empty success, and a
      // stream for code that streams.
      const body = JSON.stringify({ ok: true, id: "test", data: [], choices: [{ message: { content: "test" } }], content: [{ type: "text", text: "test" }] });
      return new Response(body, { status: 200, headers: { "content-type": "application/json" } });
    },
    async sql(text) { rec.sql.push(String(text).slice(0, 80)); return []; },
    files: {
      async put(name, body) { files.set(String(name), body); },
      async get(name) { return files.has(String(name)) ? new Response(files.get(String(name))) : null; },
      async delete(name) { files.delete(String(name)); },
      async list() { return [...files.keys()].map((name) => ({ name, size: 1 })); },
    },
  };
}

const SAMPLE_ROW = { id: 1, name: "Test Visitor", customer_name: "Test Visitor", email: "test@example.com", phone: "+440000000000", created_at: "2026-01-01 10:00:00", payment_status: "paid", amount: 15, total: 15, quantity: 1, places: 1 };

async function runOne({ name, js, hooks }) {
  const rec = { keys: new Set(), calls: [], sql: [] };
  const out = { name, ok: false, ran: [] };
  let mod;
  try { mod = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64")); }
  catch (e) { return { ...out, error: "it does not load: " + String((e && e.message) || e).slice(0, 200), kind: "load" }; }
  if (typeof mod.default !== "function") return { ...out, error: "it has no function as its default export", kind: "shape" };
  const hosts = Array.isArray(mod.hosts) ? mod.hosts.filter((h) => typeof h === "string").map((h) => h.toLowerCase()) : [];
  const events = Array.isArray(hooks) && hooks.length ? hooks : [null];
  for (const event of events) {
    const body = event
      ? JSON.stringify({ event, table: /^\w+:(\w+)$/.test(event) ? event.split(":")[1] : null, row: event.startsWith("cron:") || event === "tick" ? null : SAMPLE_ROW })
      : JSON.stringify({ message: "Hello", messages: [{ role: "user", content: "Hello" }] });
    const req = new Request("https://test-site.example/api/db/test-site/fn/" + name, { method: "POST", headers: { "content-type": "application/json" }, body });
    try {
      const res = await Promise.race([
        mod.default(req, fakeSite(hosts, rec)),
        new Promise((_, no) => setTimeout(() => no(new Error("it did not answer within 8 seconds")), 8000)),
      ]);
      if (!event && !(res instanceof Response)) return { ...out, error: "it answered with something other than a Response", kind: "shape", keys: [...rec.keys] };
      if (res instanceof Response) await res.text();
      out.ran.push(event || "request");
    } catch (e) {
      const msg = String((e && e.message) || e).slice(0, 200);
      // A CODE MISTAKE (a name that does not exist, a call on nothing, a host it
      // never listed) is the code's; anything else may only be our sample input.
      const code = e instanceof ReferenceError || e instanceof TypeError || /did not declare|called fetch directly|not https|too many outside calls/.test(msg);
      return { ...out, error: msg, kind: code ? "code" : "input", keys: [...rec.keys], calls: rec.calls };
    }
  }
  return { ...out, ok: true, keys: [...rec.keys], calls: rec.calls };
}

let input = "";
process.stdin.on("data", (d) => { input += d; });
process.stdin.on("end", async () => {
  let list = [];
  try { list = JSON.parse(input); } catch { list = []; }
  const results = [];
  for (const item of Array.isArray(list) ? list : []) results.push(await runOne(item));
  process.stdout.write(JSON.stringify({ results }));
  process.exit(0);
});
void enc;
