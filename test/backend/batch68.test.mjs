// Batch 68 — on:{update} function triggers (field-change automation)
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 68");

// Track the async trigger promises so we can await them, and capture function execution.
const waits = [];
h.ctx.waitUntil = (p) => { if (p && p.then) { waits.push(p); p.catch(() => {}); } };
const saved = [];
const hfetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const u = typeof input === "string" ? input : (input && input.url) || "";
  const method = (init.method || "GET").toUpperCase();
  if (u.includes("/rest/v1/site_functions")) {
    // one function: on update of "deals", save the new stage to a collection
    return new Response(JSON.stringify([{ owner_id: "owner-1", published_site_id: null, name: "onstage",
      spec: { on: { update: "deals" }, steps: [{ do: "save", collection: "stagelog", data: { stage: "{{input.stage}}", id: "{{input.id}}" } }] } }]),
      { status: 200, headers: { "content-type": "application/json" } });
  }
  if (u.includes("/rest/v1/site_collections") && method === "POST") { try { saved.push(JSON.parse(init.body)); } catch {} return new Response("{}", { status: 201 }); }
  return hfetch(input, init);
};

const slug = "b68";
await c.ensure(slug);
await c.schema(slug, { tables: { deals: { access: "feed", columns: [{ name: "name", type: "text" }, { name: "stage", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token;
await c.post(`/api/db/${slug}/rows/deals`, { name: "D", stage: "new" }, { token: A });
const id = (await c.get(`/api/db/${slug}/rows/deals`)).json.rows[0].id;
saved.length = 0; waits.length = 0;
// PATCH the stage → should fire the on:update function
const pr = await c.patch(`/api/db/${slug}/rows/deals/${id}`, { stage: "won" }, { token: A });
t.ok(pr.json.ok, "PATCH ok");
await Promise.allSettled(waits); // let the async trigger finish
t.ok(saved.length === 1, "on:{update} function fired exactly once");
t.eq(saved[0] && saved[0].data && saved[0].data.stage, "won", "trigger received the new stage via {{input.stage}}");
t.eq(String(saved[0] && saved[0].data && saved[0].data.id), String(id), "trigger received the row id");

globalThis.fetch = hfetch;
t.done(); h.restore();
