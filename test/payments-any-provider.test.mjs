// Payments are not Stripe-only (owner, 2026-11-02: any provider, on the owner's
// own key). On Market Lane (2026-11-04) "so can we take payments" — no provider
// named — got a Stripe checkout built: the page writer's own instructions said
// "payments through their own Stripe key". No instruction the AI is given may
// present one provider as the default; Stripe may be named only where the AI is
// told NOT to assume a provider, among the choices it offers when it asks the
// owner which one they use, and in the list of docs sites it may read.
import test from "node:test";
import assert from "node:assert/strict";
import { agentSystem, toolsFor } from "../builder/site-agent.mjs";
import { pagesRequest } from "../builder/page-gen.mjs";
import { SERVER_TOOLS } from "../builder/agent-server-tools.mjs";

const SPEC = { tables: [] };
const texts = () => {
  const out = [];
  for (const ownParts of [true, false]) out.push(["agent system (ownParts " + ownParts + ")", agentSystem(null, "", { ownParts })]);
  out.push(["agent tools", JSON.stringify(toolsFor({}))]);
  out.push(["server tools", JSON.stringify(SERVER_TOOLS)]);
  for (const mode of ["build", "revise"]) {
    for (const ownParts of [true, false]) {
      const rq = pagesRequest({ brief: "A shop that takes payments", spec: SPEC, brand: "Shop", model: "m", mode, ownParts, priorPages: mode === "revise" ? [{ path: "index.tsx", tsx: "export default 1" }] : undefined });
      out.push(["page writer " + mode + " ownParts " + ownParts, JSON.stringify(rq)]);
    }
  }
  return out;
};

test("no instruction names Stripe except to say: do not assume a provider (and the docs sites it may read)", () => {
  const all = texts();
  assert.ok(all.length >= 8 && all.every(([, t]) => t.length > 1000), "the observer is alive: every instruction text was built");
  // The one sanctioned sentence must itself still be there.
  assert.ok(all.some(([, t]) => /do not assume one \(not Resend, not Stripe/.test(t)), "the 'do not assume a provider' rule left the instructions");
  for (const [where, t] of all) {
    const scrubbed = t
      .replace(/do not assume one \(not Resend, not Stripe[^)]*\)/g, "")
      // The choices offered when the AI ASKS the owner which provider they use.
      .replace(/payments: Stripe, PayPal, Square/g, "")
      .replace(/(docs\.)?stripe\.com(\/docs)?/g, "");
    const m = /.{0,80}stripe.{0,80}/i.exec(scrubbed);
    assert.equal(m, null, where + " presents Stripe: …" + (m && m[0]) + "…");
  }
});
