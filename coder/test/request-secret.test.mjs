// CODER'S request_secret, AS CLAUDE CODE'S request_credential (the owner, 2026-11-14: "Do all the talk to you tools execpt
// for the notify one"). Claude Code's side, as found that day: its definition in a Claude Code cloud session (description and
// inputs), its form in the Claude app (seen 2026-11-06: "Claude needs a secret for api.stripe.com", a Token field, Decline and
// Save, while the call runs: "Using Request Credential"), and its answer when the owner declined it ("Denied by user", an
// error; Claude then went on in the same turn).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const A = await import("../container/coder-agent.mjs");
const H = await import("../container/coder-hooks.mjs");
const X = await import("../container/coder-secrets.mjs");
const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const HERE = (p) => new URL("../" + p, import.meta.url);

// Claude Code's own words, as its cloud session gave them on 2026-11-14.
const CC_DESCRIPTION = "Ask the user for an API credential for a host. Ask as soon as you know the work needs a key for a host, before any call to the host fails: when the user or setup docs say a token or API key is needed, or when the work must make real calls to an API that no connector covers and you hold no key for, even if the network policy also blocks its host. Also ask when an HTTPS request fails with 401/403 for lack of credentials. Ask before you report no access or put made-up responses in the API's place. This is the preferred way to give a session access to an API that needs a token or API key, rather than asking the user to put one in an environment variable. Never ask the user to paste secrets into the chat; where you would tell them not to, call this instead. Calling this shows the user a secure form. A credential they save is stored on this session's environment, and the network proxy injects it into requests to that host from every session in that environment, including other people's sessions when the environment is shared: this session usually within a few seconds, and later sessions. Saving it also allows HTTPS requests to that host from those sessions, so do not add the host to the environment's allowed hosts for it. If get_environment is among your tools, first make the move its description calls for, unless the user asked for the credential here. If the credential will be saved on the user's Default all the same, because the session has no repository or could not be moved, say so in your message, then call this tool, and do not propose a move for a credential again in this session. If the user declined the move, call this tool only if they then ask for the credential. You never receive the value — the result only says whether a credential is now configured, and if not, why. If the call itself is denied, because the user declined or because the app they are using cannot show the form, no result comes back: do not call this again for that host, and tell them the credential can be added in the environment's settings, then retry the failing request once it has been. After `saved`, retry the failing request right away. Until the proxy picks the credential up, the request can still fail with 401/403 or with `request blocked: no rule allows host`: if it is refused again with one of those, wait about a minute and retry once more rather than change network settings. Do not wait for the proxy after a timeout or any other error. This cannot help with secrets that must exist inside the sandbox (database passwords, container registry pulls, SSH keys), GitHub (use the repository tools), or public package registries the proxy does not handle. A local key check is no reason to skip this tool. If a CLI or SDK will not start without a key and sends it in a header, give it a dummy value in the format it expects for that command, never a real one: the proxy replaces it.";
const CC_INPUTS = {
  host: "The exact hostname the credential is for, e.g. \"api.example.com\". Lowercase DNS name only — no scheme, path, port, IP address or wildcard. Shown to the user in the form.",
  reason: "One or two sentences: which request failed or which step needs the credential, and what it unblocks. The form may not show this, so say in your message, before you call, which network secret you need, for which host, and why. The secret's value is entered only in the form, never in chat. Plain text only: no URLs, links or markup (name the host instead).",
  display_name: "Optional short label to prefill in the form, e.g. \"Example API token\"; it names the credential in the environment's network secrets list. The user can change it. Plain text only: no URLs, links or markup.",
  header_name: "Optional. The HTTP header the API reads the key from, e.g. \"xi-api-key\" or \"X-Api-Key\". Send it only when the user or the API's documentation says the key goes in a header other than Authorization: Bearer; leave it out otherwise. One word of letters, digits, hyphens and underscores: at most 40 characters, in at most 5 hyphen-separated parts of at most 16 characters each, and the last part must be key, apikey, token, auth, authorization, secret, credential or credentials. The form cannot save a key under any other header: for an API that reads one, the user adds the key in the environment's settings. Prefills the form; the user can change it. Not used with suggested_type \"basic\". Never put a key's value in this or any other field.",
  prefix: "Optional. The word the API expects before the key in the header: one of Bearer, Token, Key, ApiKey, Api-Key, Bot, SSWS, Splunk or GenieKey, in any letter case. With the Authorization header it defaults to Bearer; with any other header_name it defaults to none, so pass prefix whenever the documentation shows a word before the key, Bearer included. The form cannot save a key with any other word before it: for an API that expects one, the user adds the key in the environment's settings. Not used with suggested_type \"basic\". Never put a key's value in this or any other field.",
  suggested_type: "Optional hint for the form's default: \"bearer\" for a token or API key sent in a header (Authorization: Bearer unless header_name and prefix say otherwise), \"basic\" for username and password.",
};
/** Claude Code's words with Coder's: the owner for the user, a chat for a session, Coder's tools and its proxy's own line. */
const asCoder = (s) => s
  .replace("from every session in that environment, including other people's sessions when the environment is shared: this session usually within a few seconds, and later sessions", "from every chat in that environment: this chat usually within a few seconds, and later chats")
  .replace("allowed hosts for it.", "allowed hosts for it (propose_env's allow_host).")
  .replace("If get_environment is among your tools", "If propose_env is among your tools")
  .replace("`request blocked: no rule allows host`", "`Blocked by this repo's network list`")
  .replace("GitHub (use the repository tools)", "GitHub (git and gh reach it through Coder's GitHub proxy)")
  .replace(/\bthe user\b/g, "the owner").replace(/\bthe user's\b/g, "the owner's").replace(/\bThe user\b/g, "The owner")
  .replace(/\bsessions\b/g, "chats").replace(/\bsession's\b/g, "chat's").replace(/\bsession\b/g, "chat");

test("RS1 what Coder is told: Claude Code's request_credential description and inputs word for word, with Coder's names; Gloopy keeps its own words", async () => {
  const tool = A.CODER_TOOLS.find((t) => t.function.name === "request_secret");
  assert.equal(tool.function.description, asCoder(CC_DESCRIPTION));
  assert.equal(tool.function.description, A.SECRET_WORDS);
  const p = tool.function.parameters;
  assert.deepEqual(p.required, ["host", "reason"]);
  assert.deepEqual(Object.keys(p.properties), ["host", "reason", "display_name", "header_name", "prefix", "suggested_type"]);
  for (const [k, words] of Object.entries(CC_INPUTS)) assert.equal(p.properties[k].description, asCoder(words), k);
  assert.deepEqual(p.properties.suggested_type.enum, ["bearer", "basic"]);
  assert.equal(p.properties.prefix.enum, undefined, "a word in any letter case, as Claude Code's");
  assert.ok(Object.values(p.properties).every((x) => x.type === "string"));
  // Nothing of the turn ending on the card any more, nor the old inputs.
  assert.doesNotMatch(tool.function.description, /turn ends|next message/);
  // CODER_SYSTEM's line about keys follows it after a decline.
  assert.match(A.CODER_SYSTEM, /the card IS how they give you a key \(only after they decline it, tell them it can be added in the environment's settings, as request_secret's description says\)/);
  // Gloopy: its own description (unchanged) and its own words for the same inputs, with no environment in them.
  const { GLOOPY_TOOLS } = await import("../container/gloopy-agent.mjs");
  const g = GLOOPY_TOOLS.find((t) => t.function.name === "request_secret").function;
  assert.match(g.description, /^Ask the owner for an API key \(or token\) for ONE site's API[\s\S]*Your turn ends there; the next message says whether they saved it\. Never ask for keys in the chat\.$/);
  assert.deepEqual(Object.keys(g.parameters.properties), Object.keys(p.properties));
  assert.deepEqual(g.parameters.required, ["host", "reason"]);
  assert.doesNotMatch(JSON.stringify(g.parameters), /environment/);
  assert.deepEqual(g.parameters.properties.suggested_type.enum, ["bearer", "basic"]);
});

test("RS2 the inputs' rules, as Claude Code's descriptions give them: the host, the header, the word before the key, the type; the form's defaults", () => {
  const ok = (a) => A.secretAsk({ reason: "To list the test charges.", ...a });
  // host: "Lowercase DNS name only — no scheme, path, port, IP address or wildcard."
  for (const bad of ["https://api.stripe.com", "api.stripe.com/v1", "api.stripe.com:443", "10.0.0.1", "*.stripe.com", "API.Stripe.com", " api.stripe.com", "localhost", "stripe", "", undefined, 7]) assert.equal(ok({ host: bad }).error, A.SECRET_ERRORS.host, String(bad));
  assert.match(A.SECRET_ERRORS.host, /^error: host must be the exact hostname the credential is for, e\.g\. "api\.example\.com": a lowercase DNS name only — no scheme, path, port, IP address or wildcard$/);
  assert.equal(ok({ host: "api.stripe.com" }).host, "api.stripe.com");
  // reason: required.
  for (const bad of [undefined, "", "   ", 3]) assert.equal(A.secretAsk({ host: "api.stripe.com", reason: bad }).error, A.SECRET_ERRORS.reason);
  // The form's defaults: Authorization with Bearer; another header with no word; a word given is kept, in its own spelling.
  assert.deepEqual(ok({ host: "api.stripe.com", display_name: "Stripe test key" }), { host: "api.stripe.com", reason: "To list the test charges.", name: "Stripe test key", header: "Authorization", prefix: "Bearer", kind: "bearer" });
  assert.deepEqual([ok({ host: "api.elevenlabs.io", header_name: "xi-api-key" }).header, ok({ host: "api.elevenlabs.io", header_name: "xi-api-key" }).prefix], ["xi-api-key", ""]);
  assert.equal(ok({ host: "api.x.com", header_name: "X-Api-Key", prefix: "bearer" }).prefix, "Bearer", "Bearer included, when the docs show it");
  assert.equal(ok({ host: "api.x.com", header_name: "authorization" }).prefix, "Bearer");
  for (const [w, want] of [["TOKEN", "Token"], ["key", "Key"], ["apikey", "ApiKey"], ["API-KEY", "Api-Key"], ["bot", "Bot"], ["ssws", "SSWS"], ["splunk", "Splunk"], ["geniekey", "GenieKey"]]) assert.equal(ok({ host: "api.x.com", prefix: w }).prefix, want, w);
  for (const bad of ["Basic", "Digest", "Bearer ", "sk_live_abc", 1]) assert.equal(ok({ host: "api.x.com", prefix: bad }).error, A.SECRET_ERRORS.prefix, String(bad));
  // header_name: "One word of letters, digits, hyphens and underscores: at most 40 characters, in at most 5 hyphen-separated
  // parts of at most 16 characters each, and the last part must be key, apikey, token, auth, authorization, secret,
  // credential or credentials."
  for (const h of ["Authorization", "X-Api-Key", "xi-api-key", "X-Auth-Token", "X-Authorization", "My_Service-Token", "a-b-c-d-secret", "Client-Credentials"]) assert.equal(ok({ host: "api.x.com", header_name: h }).header, h, h);
  for (const bad of ["Origin", "Cookie", "X-Api-Key-Id", "a-b-c-d-e-key", "X--Key", "-Key", "x".repeat(17) + "-key", "X Api Key", "X_Api_Key", "x".repeat(16) + "-" + "y".repeat(16) + "-zzz-key", 5]) assert.equal(ok({ host: "api.x.com", header_name: bad }).error, A.SECRET_ERRORS.header_name, String(bad));
  assert.equal(X.credentialHeader("abcdefghijklmnop-abcdefghijklmnop-abc-key"), false, "41 characters");
  assert.equal(X.credentialHeader("abcdefghijklmnop-abcdefghijklmnop-ab-key"), true, "40 characters");
  // suggested_type: "bearer" or "basic" ("username and password"), where header_name and prefix are "Not used".
  assert.deepEqual(ok({ host: "api.x.com", suggested_type: "basic", header_name: "not a header", prefix: "nope" }), { host: "api.x.com", reason: "To list the test charges.", name: "", header: "Authorization", prefix: "Basic", kind: "basic" });
  assert.equal(ok({ host: "api.x.com", suggested_type: "bearer" }).kind, "bearer");
  for (const bad of ["Basic", "oauth", 1]) assert.equal(ok({ host: "api.x.com", suggested_type: bad }).error, A.SECRET_ERRORS.suggested_type);
  assert.equal(ok({ host: "api.x.com", display_name: { x: 1 } }).error, A.SECRET_ERRORS.display_name);
  // Optional inputs given empty count as not given.
  assert.deepEqual(ok({ host: "api.x.com", display_name: "", header_name: "", prefix: "", suggested_type: "" }), ok({ host: "api.x.com" }));
  // Every refusal is an error, in the words of Claude Code's own description of the input.
  for (const m of Object.values(A.SECRET_ERRORS)) assert.match(m, /^error: /);
  assert.match(A.SECRET_ERRORS.header_name, /The form cannot save a key under any other header: for an API that reads one, the owner adds the key in the environment's settings\.$/);
  assert.match(A.SECRET_ERRORS.prefix, /The form cannot save a key with any other word before it: for an API that expects one, the owner adds the key in the environment's settings\.$/);
  // A key the reason or the name holds by mistake is hidden.
  assert.doesNotMatch(JSON.stringify(ok({ host: "api.x.com", reason: "use sk_live_FAKEkey12345", display_name: "ghp_abcdefghijklmnopqrstuvwxyz0123456789" })), /sk_live_51H|ghp_abcdef/);
});

test("RS3 the saved key: Claude Code's words before it are sent with it; its headers are kept (never narrower than before); hosts that never get one say why", () => {
  assert.deepEqual([...X.CREDENTIAL_PREFIXES], ["Bearer", "Token", "Key", "ApiKey", "Api-Key", "Bot", "SSWS", "Splunk", "GenieKey"]);
  for (const w of ["", "Bearer", "Token", "Key", "Basic", ...X.CREDENTIAL_PREFIXES]) assert.ok(X.PREFIXES.includes(w), w);
  assert.equal(X.headerValue({ value: "abc123", prefix: "SSWS" }), "SSWS abc123");
  assert.equal(X.headerValue({ value: "abc123", prefix: "Api-Key" }), "Api-Key abc123");
  assert.equal(X.headerValue({ value: "ana:pa55word", prefix: "Basic" }), "Basic " + Buffer.from("ana:pa55word").toString("base64"));
  // Every header the card takes is one a saved key keeps (normSecret, the Worker's egress); headers a site copies back never.
  for (const h of ["X-Authorization", "My_Service-Token", "Authorization", "X-Api-Key", "a_b-c_d-e_f-g_h-credentials"]) { assert.ok(X.credentialHeader(h), h); assert.ok(X.HEADER_RE.test(h), h); }
  for (const bad of ["Origin", "Host", "Referer", "Cookie", "Content-Length", "Transfer-Encoding", "Connection", "User-Agent"]) assert.equal(X.HEADER_RE.test(bad), false, bad);
  const kept = X.normSecret({ id: "a", hosts: ["api.x.com"], headers: [{ name: "X-Authorization", prefix: "Bot", value: "k123" }] });
  assert.deepEqual(kept.headers, [{ name: "X-Authorization", prefix: "Bot", value: "k123" }]);
  assert.equal(X.credentialPrefix("SPLUNK"), "Splunk");
  assert.equal(X.credentialPrefix("Basic"), null);
  assert.equal(X.credentialHost("api.stripe.com"), "api.stripe.com");
  assert.equal(X.credentialHost("Api.stripe.com"), null);
  // Never a key (Claude Code: "GitHub (use the repository tools), or public package registries the proxy does not handle").
  assert.equal(X.neverKeyWhy("api.stripe.com"), "");
  assert.match(X.neverKeyWhy("api.github.com"), /^Coder's GitHub proxy authenticates requests to GitHub instead \(git and gh use the owner's GitHub sign-in\), so no network secret is needed for it\.$/);
  assert.match(X.neverKeyWhy("registry.npmjs.org"), /^Coder's proxy never attaches a network secret to registry\.npmjs\.org: the Anthropic API and public package registries never get one\. For a private registry, ask for the key for that registry's own host\.$/);
  assert.match(X.neverKeyWhy("api.anthropic.com"), /never get one\.$/);
});

/** Coder's loop with hooks, the card's answers given by `answer`. */
async function loop(steps, { hooks = {}, answer = async () => ({ choice: "saved" }), run = {}, clock = null, ...opts } = {}) {
  const events = [], seen = [], hookCalls = [], asked = [];
  let n = 0;
  const r = await A.runCoder({
    send: async (req) => { seen.push(req); return steps[Math.min(n++, steps.length - 1)]; },
    exec: async (x) => {
      const mark = /<<coder-hook-stderr-[a-z0-9]+>>/.exec(String(x.command));
      if (mark && x.hook === true) { const input = JSON.parse(x.payload); hookCalls.push(input); return { code: 0, output: "\n" + mark[0] + "\n" }; }
      return { code: 0, output: run[x.command] || "ok\n" };
    },
    emit: (e) => events.push(e),
    ask: async (pid, o) => { asked.push({ pid, o }); return answer(pid, o); },
    here: () => "/work/shop", root: "/work/shop", chatId: "shop-rs",
    ...(clock ? { now: () => clock.t } : {}),
  }, { text: "check my stripe balance", messages: [], hooks: H.hooksFrom({ hooks }, "settings").list, ...opts });
  return { r, events, seen, hookCalls, asked };
}
const HOOKS = { PostToolUse: [{ matcher: "request_secret", hooks: [{ type: "command", command: "post.sh" }] }], PostToolUseFailure: [{ matcher: "request_secret", hooks: [{ type: "command", command: "fail.sh" }] }], PreToolUse: [{ matcher: "request_secret", hooks: [{ type: "command", command: "pre.sh" }] }] };

test("RS4 the card waits in the turn, as Claude Code's form does: Save answers \"saved\" and Coder goes on at once; its hooks see Claude Code's inputs and the result", async () => {
  const input = { host: "api.stripe.com", reason: "The balance check got 401 from api.stripe.com; a key unblocks it.", display_name: "Stripe test key", suggested_type: "bearer" };
  const t = await loop([say("I'm opening a secure form for your Stripe key.", [call("request_secret", input, "k1"), call("bash", { command: "curl -s https://api.stripe.com/v1/balance" }, "b1")]), say("Your balance is $0.")], { hooks: HOOKS, run: { "curl -s https://api.stripe.com/v1/balance": "{\"available\":[]}" } });
  assert.equal(t.r.status, "done");
  const card = t.events.find((e) => e.type === "secret");
  assert.match(card.pid, /^p[0-9a-z]{2,24}$/, "an answer the machine's /answer takes");
  const { at, pid, ...rest } = card;
  assert.deepEqual(rest, { type: "secret", host: "api.stripe.com", reason: input.reason, name: "Stripe test key", header: "Authorization", prefix: "Bearer", kind: "bearer" });
  assert.deepEqual(t.asked.map((x) => x.pid), [pid], "the step waits for that card");
  assert.ok(t.asked[0].o.until > 0, "until the job's time limit");
  assert.ok(t.events.some((e) => e.type === "permanswer" && e.pid === pid && e.choice === "saved"));
  assert.equal(t.r.messages.find((m) => m.tool_call_id === "k1").content, "saved");
  assert.equal(t.r.messages.find((m) => m.tool_call_id === "b1").content.includes("available"), true, "the request after it runs in the same turn");
  assert.equal(t.seen.length, 2);
  // Its hooks: Claude Code's input names as given, and its result.
  const pre = t.hookCalls.find((x) => x.hook_event_name === "PreToolUse");
  assert.deepEqual([pre.tool_name, pre.tool_input], ["request_secret", input]);
  const post = t.hookCalls.find((x) => x.hook_event_name === "PostToolUse" && x.tool_name === "request_secret");
  assert.deepEqual([post.tool_input, post.tool_response], [input, { output: "saved", code: 0 }]);
  assert.equal(t.hookCalls.some((x) => x.hook_event_name === "PostToolUseFailure"), false);
  // The card is no permission prompt: no PermissionRequest hook, no "refuse instead of asking" (Claude Code's form is the call itself).
  const d = await loop([say("", [call("request_secret", input, "k2")]), say("Done.")], { hooks: { PermissionRequest: [{ matcher: "", hooks: [{ type: "command", command: "perm.sh" }] }] }, denyInstead: true });
  assert.equal(d.hookCalls.length, 0);
  assert.equal(d.r.messages.find((m) => m.tool_call_id === "k2").content, "saved");
});

test("RS5 Decline is Claude Code's denial (\"Denied by user\", an error), and Coder goes on in the same turn; Stop stops; no answer by the time limit ends the job; with no way to show the card the call is denied", async () => {
  const input = { host: "api.stripe.com", reason: "The balance check needs a key." };
  const t = await loop([say("", [call("request_secret", input, "k1")]), say("The form was closed, so nothing was saved. You can add it in the environment's settings.")], { hooks: HOOKS, answer: async () => ({ choice: "no" }) });
  assert.equal(A.SECRET_DENIED, "error: Denied by owner");
  assert.equal(t.r.messages.find((m) => m.tool_call_id === "k1").content, "error: Denied by owner");
  assert.equal(t.r.status, "done");
  assert.equal(t.seen.length, 2, "Coder answers in the same turn, as Claude did");
  assert.match(t.r.summary || "", /form was closed/);
  const fail = t.hookCalls.find((x) => x.hook_event_name === "PostToolUseFailure");
  assert.deepEqual([fail.tool_name, fail.error], ["request_secret", "error: Denied by owner"]);
  assert.equal(t.hookCalls.some((x) => x.hook_event_name === "PostToolUse"), false);
  assert.ok(t.events.some((e) => e.type === "permanswer" && e.choice === "no"));
  // An answer that never came counts as declined.
  const lost = await loop([say("", [call("request_secret", input, "k1")]), say("Done.")], { answer: async () => null });
  assert.equal(lost.r.messages.find((m) => m.tool_call_id === "k1").content, "error: Denied by owner");
  // Stop.
  const s = await loop([say("", [call("request_secret", input, "k1"), call("bash", { command: "echo never" }, "b1")]), say("Done.")], { answer: async () => ({ choice: "stop" }) });
  assert.equal(s.r.status, "stopped");
  assert.ok(!s.events.some((e) => e.type === "result" && e.id === "b1"));
  // The job's time limit passes while it waits.
  const clock = { t: 1000 };
  const late = await loop([say("", [call("request_secret", input, "k1")]), say("Done.")], { clock, maxMs: 60_000, answer: async () => { clock.t += 61_000; return null; } });
  assert.equal(late.r.status, "time");
  assert.equal(late.r.messages.find((m) => m.tool_call_id === "k1").content, "not saved: Coder ran out of time waiting for the owner's answer");
  assert.ok(late.events.some((e) => e.type === "error" && /ran out of time waiting for your answer/.test(e.text)));
  // No channel for the owner's answer: "because the app they are using cannot show the form".
  const events = [];
  let n = 0;
  const steps = [say("", [call("request_secret", input, "k1")]), say("Done.")];
  const r = await A.runCoder({ send: async () => steps[Math.min(n++, 1)], exec: async () => ({ code: 0, output: "" }), emit: (e) => events.push(e) }, { text: "go" });
  assert.equal(r.messages.find((m) => m.tool_call_id === "k1").content, "error: Denied by owner");
  assert.equal(events.some((e) => e.type === "secret"), false, "no card that nobody can answer");
});

test("RS6 no card for a bad input (an error, and Coder goes on), for a host that never gets a key (\"not saved\", and why), or in a job started from GitHub", async () => {
  const t = await loop([say("", [call("request_secret", { host: "https://api.stripe.com/v1", reason: "x" }, "k1"), call("request_secret", { host: "api.x.com", reason: "x", header_name: "Cookie" }, "k2"), call("request_secret", { host: "api.github.com", reason: "x" }, "k3"), call("request_secret", { host: "registry.npmjs.org", reason: "x" }, "k4")]), say("Done.")]);
  assert.equal(t.events.some((e) => e.type === "secret"), false);
  assert.equal(t.asked.length, 0);
  const out = (id) => t.r.messages.find((m) => m.tool_call_id === id).content;
  assert.equal(out("k1"), A.SECRET_ERRORS.host);
  assert.equal(out("k2"), A.SECRET_ERRORS.header_name);
  assert.equal(out("k3"), "not saved: " + X.neverKeyWhy("api.github.com"));
  assert.equal(out("k4"), "not saved: " + X.neverKeyWhy("registry.npmjs.org"));
  assert.equal(t.r.status, "done");
  // From GitHub, as before (the tool is not even offered there).
  const g = await loop([say("", [call("request_secret", { host: "api.stripe.com", reason: "x" }, "k1")]), say("Done.")], { github: true });
  assert.match(g.r.messages.find((m) => m.tool_call_id === "k1").content, /^error: keys cannot be asked for in a job started from GitHub/);
  assert.equal(g.asked.length, 0);
});

test("RS7 Gloopy's card keeps its own way (Grok Bot's): the turn ends on it and the owner's next message says whether the key was saved; the same inputs and rules", async () => {
  const { GLOOPY_SYSTEM, GLOOPY_TOOLS } = await import("../container/gloopy-agent.mjs");
  const t = await loop([say("", [call("request_secret", { host: "api.openweathermap.org", reason: "To get today's weather.", display_name: "Weather", header_name: "X-Api-Key" }, "k1"), call("bash", { command: "echo never" }, "b1")]), say("Done.")], { system: GLOOPY_SYSTEM, tools: GLOOPY_TOOLS, nudges: false, who: "Gloopy" });
  assert.equal(t.r.status, "done");
  assert.equal(t.asked.length, 0, "no wait in the turn");
  const { at, ...card } = t.events.find((e) => e.type === "secret");
  assert.deepEqual(card, { type: "secret", host: "api.openweathermap.org", reason: "To get today's weather.", name: "Weather", header: "X-Api-Key", prefix: "", kind: "bearer" });
  assert.equal(t.r.messages.find((m) => m.tool_call_id === "k1").content, "asked the owner for a key for api.openweathermap.org; the next message says whether it was saved");
  assert.equal(t.r.messages.find((m) => m.tool_call_id === "b1").content, "not run: you asked the owner for a key first");
  const bad = await loop([say("", [call("request_secret", { host: "*.openweathermap.org", reason: "x" }, "k1")]), say("Done.")], { system: GLOOPY_SYSTEM, tools: GLOOPY_TOOLS, nudges: false, who: "Gloopy" });
  assert.equal(bad.r.messages.find((m) => m.tool_call_id === "k1").content, A.SECRET_ERRORS.host);
});

// ── CODER'S WORKER: THE CARD'S KEY, ITS ANSWER, THE END OF THE TURN ──
function fakeBucket() {
  const m = new Map();
  return { m, async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { m.set(k, typeof v === "string" ? v : String(v)); }, async delete(k) { m.delete(k); },
    async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
}
const ENV0 = { CODER_ON: "on", CODER_USERS: "me@x.y", GITHUB_APP_CLIENT_ID: "Iv1.abc", GITHUB_APP_CLIENT_SECRET: "shh", GITHUB_APP_SLUG: "gofarther-coder", CODER_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"), CODER_PUBLIC_URL: "https://coder.gofarther.dev" };
async function worker({ status = "running", result = null, events = [] } = {}) {
  const R = await import("../src/coder-routes.mjs");
  const { saveConnection } = await import("../src/coder-github.mjs");
  const uid = "user-1234567890abcdef", id = "shop-rs1";
  const bucket = fakeBucket();
  const env = { ...ENV0, CODER_BUCKET: bucket };
  await saveConnection(env, bucket, uid, { access: "ghu_user" }, "ana");
  const mk = "coder/" + uid + "/" + id + "/meta.json";
  await bucket.put(mk, JSON.stringify({ id, repo: "ana/shop", base: "main", branch: "coder/" + id, turn: 1, saved: 0, status, at: Date.now(), title: "x", mode: "auto" }));
  const toMachine = [];
  const box = () => ({ fetch: async (req) => {
    const p = new URL(req.url).pathname;
    if (req.method === "POST") toMachine.push({ p, body: await req.clone().json().catch(() => null) });
    if (p === "/answer") { const b = await req.json(); return Response.json(b.pid === "p1abcdef" ? { ok: true } : { ok: false, why: "That card is no longer waiting for an answer." }); }
    if (p === "/state") return Response.json(!result ? { running: status === "running", events: [] } : { running: false, events, next: events.length, result });
    return Response.json({ ok: true });
  } });
  const go = async (path, init = {}) => { const r = await R.handleCoder(new Request("https://gofarther.dev/api/coder/" + path, { ...init, headers: { "content-type": "application/json" } }), env, {}, { fetchFn: async () => new Response("{}", { status: 404 }), authUser: async () => ({ id: uid, email: "me@x.y" }), container: box }); return { status: r.status, data: await r.json() }; };
  return { R, bucket, env, uid, id, mk, go, toMachine, meta: () => JSON.parse(bucket.m.get(mk)) };
}

test("RS8 the Worker keeps the card's key as Claude Code's form would: a token in the header and after the word left on the card, or a username and password; a host that already has one is refused (Claude Code's changelog)", async () => {
  const { readEnvData } = await import("../src/coder-environments.mjs");
  const w = await worker();
  const save = (b) => w.go("projects/" + w.id + "/secret", { method: "POST", body: JSON.stringify(b) });
  const keys = async () => (await readEnvData(w.env, w.bucket, w.uid, "default")).secrets;
  // The form's rules for the header and the word before the key.
  let r = await save({ host: "api.x.com", header: "Cookie", prefix: "", value: "k123456" });
  assert.deepEqual([r.status, r.data.error], [400, "that header can't carry a key: one word of letters, digits, hyphens and underscores, at most 40 characters, in at most 5 hyphen-separated parts of at most 16 characters each, the last one key, apikey, token, auth, authorization, secret, credential or credentials (like X-Api-Key)"]);
  r = await save({ host: "api.x.com", header: "Authorization", prefix: "Digest", value: "k123456" });
  assert.deepEqual([r.status, r.data.error], [400, "the word before the key is one of Bearer, Token, Key, ApiKey, Api-Key, Bot, SSWS, Splunk or GenieKey, or none"]);
  r = await save({ host: "api.okta.example", name: "Okta", header: "Authorization", prefix: "ssws", value: "00abcDEF" });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.deepEqual((await keys()).map((k) => [k.hosts, k.name, k.headers]), [[["api.okta.example"], "Okta", [{ name: "Authorization", prefix: "SSWS", value: "00abcDEF" }]]]);
  assert.equal(JSON.stringify(r.data).includes("00abcDEF"), false, "never shown back");
  // A header with no word, the card's defaults when none is given (Authorization: Bearer), as before.
  assert.equal((await save({ host: "api.elevenlabs.io", header: "xi-api-key", prefix: "", value: "xi_123" })).status, 200);
  assert.equal((await save({ host: "api.stripe.com", value: "sk_test_ABC" })).status, 200);
  // Username and password: Authorization: Basic.
  assert.deepEqual((await save({ host: "api.mailgun.net", basic: true, username: "", password: "x" })).data.error, "type the username first");
  assert.deepEqual((await save({ host: "api.mailgun.net", basic: true, username: "a:b", password: "x" })).data.error, "a username can't have a colon (:) in it");
  assert.equal((await save({ host: "api.mailgun.net", name: "Mailgun", basic: true, username: "api", password: "key-123" })).status, 200);
  const all = await keys();
  assert.deepEqual(all.map((k) => [k.hosts[0], k.headers[0].name, k.headers[0].prefix]), [["api.okta.example", "Authorization", "SSWS"], ["api.elevenlabs.io", "xi-api-key", ""], ["api.stripe.com", "Authorization", "Bearer"], ["api.mailgun.net", "Authorization", "Basic"]]);
  assert.equal(X.headerValue(all[3].headers[0]), "Basic " + Buffer.from("api:key-123").toString("base64"));
  // A host that already has a secret: refused, pointing to it (the one saved stays).
  r = await save({ host: "api.stripe.com", value: "sk_test_NEW" });
  assert.deepEqual([r.status, r.data.error], [409, "This environment already has a secret for api.stripe.com. To change it, delete it in Environment → Network secrets, then save this one again."]);
  r = await save({ host: "api.okta.example", value: "00NEW" });
  assert.match(r.data.error, /already has a secret for api\.okta\.example \(Okta\)\./);
  assert.equal((await keys()).find((k) => k.hosts[0] === "api.stripe.com").headers[0].value, "sk_test_ABC");
  // Deleted, it can be saved again.
  await w.go("projects/" + w.id + "/secret?host=api.stripe.com", { method: "DELETE" });
  assert.equal((await save({ host: "api.stripe.com", value: "sk_test_NEW" })).status, 200);
});

test("RS9 the Worker passes the card's answer to the waiting step: \"saved\" only once a key for that host is on the chat's environment; Decline as no", async () => {
  const w = await worker();
  const answer = (b) => w.go("projects/" + w.id + "/answer", { method: "POST", body: JSON.stringify(b) });
  let r = await answer({ pid: "p1abcdef", choice: "saved", host: "api.stripe.com" });
  assert.deepEqual([r.status, r.data.error], [409, "No key for api.stripe.com is saved on this chat's environment yet."]);
  assert.equal(w.toMachine.filter((x) => x.p === "/answer").length, 0, "not passed on");
  r = await answer({ pid: "p1abcdef", choice: "saved", host: "https://api.stripe.com" });
  assert.equal(r.status, 409);
  await w.go("projects/" + w.id + "/secret", { method: "POST", body: JSON.stringify({ host: "api.stripe.com", value: "sk_test_ABC" }) });
  r = await answer({ pid: "p1abcdef", choice: "saved", host: "api.stripe.com" });
  assert.deepEqual(r.data, { ok: true });
  assert.deepEqual(w.toMachine.filter((x) => x.p === "/answer").at(-1).body, { project: w.id, pid: "p1abcdef", choice: "saved", comment: "" });
  // A key saved for every subdomain counts too.
  const v = await worker();
  await v.go("projects/" + v.id + "/env", { method: "GET" });
  await v.go("projects/" + v.id + "/secret", { method: "POST", body: JSON.stringify({ name: "Example", hosts: ["*.example.com"], headers: [{ name: "Authorization", prefix: "Bearer", value: "k_123456" }] }) });
  assert.deepEqual((await v.go("projects/" + v.id + "/answer", { method: "POST", body: JSON.stringify({ pid: "p1abcdef", choice: "saved", host: "api.example.com" }) })).data, { ok: true });
  // Decline.
  assert.deepEqual((await answer({ pid: "p1abcdef", choice: "no" })).data, { ok: true });
  assert.deepEqual(w.toMachine.filter((x) => x.p === "/answer").at(-1).body, { project: w.id, pid: "p1abcdef", choice: "no", comment: "" });
  // Gloopy's card still replaces a key for the same site (Gloopy has no screen to remove one).
  const R = await import("../src/coder-routes.mjs");
  const { readEnvData } = await import("../src/coder-environments.mjs");
  const bucket = fakeBucket();
  const env = { CODER_ON: "on", CODER_USERS: "me@x.y", CODER_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"), CODER_BUCKET: bucket, CODER_PUBLIC_URL: "https://gofarther.dev" };
  const deps = { fetchFn: async () => new Response("{}", { status: 404 }), authUser: async () => ({ id: "u1", email: "me@x.y" }), container: () => ({ fetch: async () => Response.json({ ok: true }) }) };
  const go = (path, init = {}) => R.handleCoder(new Request("https://coder.gofarther.dev/api/coder/" + path, { ...init, headers: { Authorization: "Bearer ok", "content-type": "application/json" } }), env, {}, deps);
  await go("gloopy");
  for (const value of ["first_123", "second_456"]) assert.equal((await go("projects/" + R.GLOOPY_ID + "/secret", { method: "POST", body: JSON.stringify({ host: "api.weather.example", value, name: "Weather" }) })).status, 200);
  assert.deepEqual((await readEnvData(env, bucket, "u1", "gloopy")).secrets.map((s) => s.headers[0].value), ["second_456"]);
});

test("RS10 the end of the turn: Coder's key card never leaves the chat waiting (it waited in its own turn); an older card that ended its turn still does", async () => {
  const at = Date.now();
  const w = await worker({ result: { status: "done", summary: "Done.", messages: [], mode: "auto" }, events: [{ type: "secret", pid: "p1abcdef", host: "api.stripe.com", reason: "x", at }, { type: "permanswer", pid: "p1abcdef", choice: "saved", at }, { type: "done", text: "Done.", at }] });
  await w.go("projects/" + w.id + "/state?since=0");
  assert.equal(w.meta().waiting, null);
  const old = await worker({ result: { status: "done", summary: "x", messages: [], mode: "auto" }, events: [{ type: "secret", host: "api.stripe.com", reason: "x", at }] });
  await old.go("projects/" + old.id + "/state?since=0");
  assert.equal(old.meta().waiting, "secret");
  // Its push still says Coder needs a key (Claude Code's push when it needs your input).
  const { pushesFor } = await import("../src/coder-push.mjs");
  assert.deepEqual(pushesFor([{ type: "secret", pid: "p1abcdef", host: "api.stripe.com", reason: "To check the balance." }], { title: "Shop" }), [{ kind: "actions", title: "Coder needs a key · Shop", body: "For api.stripe.com: To check the balance." }]);
});

test("RS11 Coder's machine: the step waits for the card, and the owner's \"saved\" (only for that card) lets Coder go on in the same turn", async () => {
  const http = await import("node:http");
  const { mkdtemp } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { createApp } = await import("../container/server.mjs");
  const root = await mkdtemp(join(tmpdir(), "coder-root-")), mem = await mkdtemp(join(tmpdir(), "coder-mem-")), git = await mkdtemp(join(tmpdir(), "coder-git-")), bgr = await mkdtemp(join(tmpdir(), "coder-bgr-"));
  const seen = [];
  let n = 0;
  const steps = [say("", [call("request_secret", { host: "api.stripe.com", reason: "The balance check needs a key." }, "k1")]), say("Saved, thanks.")];
  const srv = http.createServer(createApp({ root, memRoot: mem, gitRoot: git, bgRoot: bgr, send: async (req) => { seen.push(req); return steps[Math.min(n++, 1)]; } }));
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));
  const base = "http://127.0.0.1:" + srv.address().port;
  const post = (p, b) => fetch(base + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then((r) => r.json());
  const state = () => fetch(base + "/state?project=shop-rs2&since=0").then((r) => r.json());
  try {
    await post("/turn", { project: "shop-rs2", text: "check my balance", messages: [], mode: "auto", rules: { allow: [] } });
    let card = null;
    for (let i = 0; i < 200 && !card; i++) { card = (await state()).events.find((e) => e.type === "secret"); if (!card) await new Promise((ok) => setTimeout(ok, 30)); }
    assert.ok(card && card.pid, "the card is in the chat while its step waits");
    assert.equal((await state()).running, true);
    assert.equal((await post("/answer", { project: "shop-rs2", pid: "p9zzzzzz", choice: "saved" })).ok, false, "not the card that waits");
    assert.deepEqual(await post("/answer", { project: "shop-rs2", pid: card.pid, choice: "saved" }), { ok: true });
    let st; for (let i = 0; i < 200; i++) { st = await state(); if (st.result) break; await new Promise((ok) => setTimeout(ok, 30)); }
    assert.equal(st.result.status, "done");
    assert.equal(seen.length, 2, "one turn");
    assert.ok(seen[1].messages.some((m) => m.role === "tool" && m.tool_call_id === "k1" && m.content === "saved"));
    assert.ok(st.events.some((e) => e.type === "permanswer" && e.pid === card.pid && e.choice === "saved"));
  } finally { await post("/stop", { project: "shop-rs2" }).catch(() => {}); await new Promise((ok) => srv.close(ok)); }
});

// ── THE PAGE: THE CARD (keyCardHTML) ──
const ui = readFileSync(HERE("public/coder.js"), "utf8");
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
function cardOf(GLOOPY, S) {
  const from = ui.indexOf("  const KEY_WORDS = ");
  const to = ui.indexOf("\n  function permHTML(e) {");
  assert.ok(from > 0 && to > from);
  return new Function("GLOOPY", "S", "esc", "ICON", ui.slice(from, to) + "\nreturn { keyCardHTML, keySentAs, KEY_ID };")(GLOOPY, S, esc, { lock: "<svg></svg>" });
}

test("RS12 the card, as Claude Code's form: the name, the secret type (Token, or Username and password), the header and the word before the key can be changed; Coder's card is live while its step waits, Gloopy's until the owner's next message", () => {
  const ev = { type: "secret", pid: "p1abc123", host: "api.stripe.com", reason: "The balance check got 401.", name: "Stripe test key", header: "Authorization", prefix: "Bearer", kind: "bearer" };
  const S = { running: true, events: [{ type: "user", text: "go" }, ev], envInfo: { name: "Default" } };
  const C = cardOf(false, S);
  assert.equal(C.KEY_ID, "cdKey");
  let h = C.keyCardHTML(ev, 1);
  assert.match(h, /^<div class="cd-secret cd-secret-key is-live" data-secret-pid="p1abc123">/);
  assert.match(h, /<b class="cd-secret-t">Coder needs a secret for api\.stripe\.com<\/b>/);
  assert.match(h, /<p class="cd-secret-why">The balance check got 401\.<\/p>/);
  assert.match(h, /<p class="cd-secret-how">Sent as <code>Authorization: Bearer &lt;your key&gt;<\/code><\/p>/);
  assert.match(h, /This secret is saved on the environment Default: every chat that uses it can reach api\.stripe\.com with it\./);
  assert.match(h, /<label class="cd-secret-l" for="cdKeyName">Name \(optional\)<\/label><input id="cdKeyName" class="cd-secret-in" type="text" value="Stripe test key" maxlength="60"/);
  assert.match(h, /<select id="cdKeyType" class="cd-secret-in"><option value="token" selected>Token<\/option><option value="basic">Username and password<\/option><\/select>/);
  assert.match(h, /<input id="cdKeyHeader" class="cd-secret-in" type="text" value="Authorization" maxlength="40"/);
  assert.match(h, /<select id="cdKeyPrefix" class="cd-secret-in"><option value="">\(none\)<\/option><option value="Bearer" selected>Bearer<\/option><option value="Token">Token<\/option>[\s\S]*<option value="GenieKey">GenieKey<\/option><\/select>/);
  assert.match(h, /<label class="cd-secret-l" for="cdKeyIn">Token<\/label><input id="cdKeyIn" class="cd-secret-in" type="password" autocomplete="off" spellcheck="false">/, "Claude Code's field: Token");
  assert.match(h, /<div class="cd-secret-basic" hidden>/);
  assert.match(h, /<button type="button" class="cd-secret-no" data-secret-no="api\.stripe\.com" data-secret-pid="p1abc123">Decline<\/button><button type="button" class="cd-secret-save" data-secret-save="api\.stripe\.com" data-secret-pid="p1abc123" disabled>Save<\/button>/);
  assert.doesNotMatch(h, /value="sk_/, "never a key in the markup");
  // Answered: drawn as it was asked, with no fields and no mark for the redraw to keep.
  S.events.push({ type: "permanswer", pid: "p1abc123", choice: "saved" });
  h = C.keyCardHTML(ev, 1);
  assert.match(h, /^<div class="cd-secret cd-secret-key">/);
  assert.doesNotMatch(h, /<input|data-secret-pid|<button/);
  // Not running: an older card with a pid is never live again.
  const S2 = { running: false, events: [ev] };
  assert.doesNotMatch(cardOf(false, S2).keyCardHTML(ev, 0), /<input/);
  // Username and password; another header with no word.
  const basic = { ...ev, pid: "p2abc123", kind: "basic", header: "Authorization", prefix: "Basic" };
  h = cardOf(false, { running: true, events: [basic] }).keyCardHTML(basic, 0);
  assert.match(h, /Sent as <code>Authorization: Basic &lt;your username and password&gt;<\/code>/);
  assert.match(h, /<option value="basic" selected>Username and password<\/option>/);
  assert.match(h, /<div class="cd-secret-tok" hidden>/);
  assert.match(h, /<label class="cd-secret-l" for="cdKeyUser">Username<\/label>[\s\S]*<label class="cd-secret-l" for="cdKeyPass">Password<\/label><input id="cdKeyPass" class="cd-secret-in" type="password"/);
  const xi = { ...ev, pid: "p3abc123", header: "xi-api-key", prefix: "" };
  assert.match(cardOf(false, { running: true, events: [xi] }).keyCardHTML(xi, 0), /Sent as <code>xi-api-key: &lt;your key&gt;<\/code>[\s\S]*<option value="" selected>\(none\)<\/option>/);
  // Gloopy's: no pid, its own ids, live until the owner's next message.
  const g = { type: "secret", host: "api.weather.example", reason: "Today's weather.", name: "Weather", header: "Authorization", prefix: "Bearer", kind: "bearer" };
  const G = cardOf(true, { running: false, events: [g] });
  h = G.keyCardHTML(g, 0);
  assert.equal(G.KEY_ID, "glKey");
  assert.match(h, /^<div class="cd-secret cd-secret-key is-live">/);
  assert.match(h, /Gloopy needs a key for api\.weather\.example/);
  assert.match(h, /id="glKeyIn"/);
  assert.match(h, /data-secret-no="api\.weather\.example">Decline<\/button>/);
  assert.doesNotMatch(cardOf(true, { running: false, events: [g, { type: "user", text: "x" }] }).keyCardHTML(g, 0), /<input/);
  // What it says it sends follows the fields.
  assert.equal(C.keySentAs(false, "X-Api-Key", "Bot"), "X-Api-Key: Bot <your key>");
  assert.equal(C.keySentAs(false, "", ""), "Authorization: <your key>");
});

test("RS13 the card's buttons and the page's redraws: Save keeps the key, then tells the waiting step \"saved\" (again alone if that failed); Decline tells it no; Gloopy's say so in a message; the live card keeps its fields through a redraw", () => {
  const css = readFileSync(HERE("public/coder.css"), "utf8");
  // Save: the key first (the card's own fields, never another view's), then the answer with its host.
  assert.match(ui, /const keyVal = \(card, k\) => \{ const x = card\.querySelector\('#' \+ KEY_ID \+ k\); return x \? String\(x\.value \|\| ''\) : ''; \};/);
  assert.match(ui, /const r = await call\('\/projects\/' \+ encodeURIComponent\(id\) \+ '\/secret', \{ method: 'POST', body: JSON\.stringify\(f\.basic \? \{ host, name: f\.name, basic: true, username: f\.username, password: f\.password \} : \{ host, name: f\.name, header: f\.header, prefix: f\.prefix, value: f\.value \}\) \}\);\n        for \(const k of \['In', 'Pass'\]\) \{ const x = card\.querySelector\('#' \+ KEY_ID \+ k\); if \(x\) x\.value = ''; \}/, "what was typed leaves the card as it is sent");
  assert.match(ui, /const a = await call\('\/projects\/' \+ encodeURIComponent\(id\) \+ '\/answer', \{ method: 'POST', body: JSON\.stringify\(\{ pid, choice: 'saved', host \}\) \}\);/);
  assert.match(ui, /S\.keySaved = \{ \.\.\.\(S\.keySaved \|\| \{\}\), \[pid\]: true \};/, "a second press only tells the step again");
  assert.match(ui, /const a = await call\('\/projects\/' \+ encodeURIComponent\(S\.project\.id\) \+ '\/answer', \{ method: 'POST', body: JSON\.stringify\(\{ pid, choice: 'no' \}\) \}\);/);
  assert.match(ui, /if \(!pid\) return send\('I declined the secret for ' \+ b\.dataset\.secretNo \+ '\.'\);/);
  // Only the key card's own buttons (other cards borrow its button styles: a Don't allow once also sent "I declined the secret for undefined.").
  assert.doesNotMatch(ui, /on\('\.cd-secret-no'|on\('\.cd-secret-save'/);
  assert.match(ui, /on\('\[data-secret-no\]', 'click'/);
  assert.match(ui, /on\('\[data-secret-save\]', 'click'/);
  // The redraw keeps the live card's own node (its fields, the key too, never in the markup), and the cursor.
  assert.match(ui, /const keyKept = root\.querySelector\('\.cd-secret-key\[data-secret-pid\]'\);/);
  assert.match(ui, /if \(keyNew\) \{\n      keyNew\.replaceWith\(keyKept\);/);
  assert.ok(ui.indexOf("keyNew.replaceWith(keyKept)") > ui.indexOf("    wire(root);\n    const keyPid"), "after the new markup is wired, so the kept card keeps its own handlers only");
  assert.match(css, /\.cd-secret-field\{margin:0 0 10px\}/);
  assert.match(css, /\.cd-secret-row\{display:flex;gap:8px\}/);
  // The machine and the Worker take "saved".
  assert.match(readFileSync(HERE("container/server.mjs"), "utf8"), /\["yes", "always", "auto", "acceptEdits", "no", "saved"\]\.includes\(choice\)/);
});
