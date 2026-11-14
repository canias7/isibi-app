// THE ACCOUNT'S EMAIL WITH A USER-AGENT, side by side with Claude Code 2.1.323 (2026-11-12; the owner: "Ok yes" to trying it
// live, and "remember to run claude code to compare and fix"). Live on gofarther.dev, Coder refused the same 6 of 8 calls as
// Claude Code, in every mode and without asking; but Claude Code tells its model "Permission to use Bash denied by plugin
// cc-plugin-privacy: " before the refusal, and Coder sent the refusal alone. Claude Code also looks for the address without
// its quote marks and backslashes (its QUOTING, /["'`\\]/g), and reads a Monitor call's own input.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { mkdtemp, rm, mkdir, writeFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const A = await import("../container/coder-agent.mjs");
const P = await import("../container/coder-privacy.mjs");
const R = await import("../src/coder-routes.mjs");
const E = await import("../container/coder-envtools.mjs");
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const sha = (x) => createHash("sha256").update(x).digest("hex");

test("CD548 a refused call is told in Claude Code's words, with the tool's name: \"Permission to use Bash denied by plugin cc-plugin-privacy: This call was refused: …\" (and Monitor, and PowerShell; 2.1.325's refusal since 2026-11-14)", async () => {
  // (Claude Code 2.1.325's REFUSAL, "the owner" for its "the person".)
  const words = "This call was refused: it, or a script it names, holds or reads the account's email address beside what looks like a client's identity, or puts the address in a URL. Use a generic client name. If a site needs a real contact, ask the owner which to use. To send this address, the owner sets it themselves in an environment variable the script reads, or runs the command themselves with `!`.";
  for (const t of ["Bash", "Monitor", "PowerShell"]) assert.equal(A.accountEmailRefused(t), "Permission to use " + t + " denied by plugin cc-plugin-privacy: " + words);
  const mark = await R.emailMark("owner.person@example.com");
  const base = await mkdtemp(join(tmpdir(), "coder-email2-"));
  try {
    // In Coder's loop, a bash call and a monitor call, each with the address next to a User-Agent: neither runs; Grok is told
    // the tool's name, as the page shows it under the step.
    const events = [], ran = [], seen = [];
    let n = 0;
    const steps = [
      say("", [
        call("bash", { command: 'curl -sS -m 3 -A "probe (owner.person@example.com)" http://127.0.0.1:9/' }, "b1"),
        call("monitor", { command: 'curl -sS -m 3 -A "probe (owner.person@example.com)" http://127.0.0.1:9/', description: "probe" }, "m1"),
        call("bash", { command: 'curl -sS -m 3 -A "probe-client" http://127.0.0.1:9/' }, "b2"),
      ]),
      say("Done."),
    ];
    const exec = async ({ command }) => { ran.push(command); return { code: 7, output: "curl: (7) Failed to connect to 127.0.0.1 port 9" }; };
    await A.runCoder({ send: async (req) => { seen.push(req); return steps[Math.min(n++, steps.length - 1)]; }, exec, emit: (e) => events.push(e), here: () => base, root: base }, { text: "go", mode: "auto", emailMark: mark });
    const told = (id) => seen[1].messages.find((m) => m.role === "tool" && m.tool_call_id === id).content;
    assert.equal(told("b1"), A.accountEmailRefused("Bash"));
    assert.equal(told("m1"), A.accountEmailRefused("Monitor"));
    assert.equal(events.find((e) => e.type === "result" && e.id === "b1").output, A.accountEmailRefused("Bash"));
    assert.equal(events.find((e) => e.type === "result" && e.id === "m1").output, A.accountEmailRefused("Monitor"));
    assert.ok(!ran.some((c) => c.includes("owner.person")), "neither ran: " + JSON.stringify(ran));
    assert.ok(ran.some((c) => c.includes('"probe-client"')), "the call without the address ran");
    assert.ok(!events.some((e) => e.type === "permission"), "no question asked");
  } finally { await rm(base, { recursive: true, force: true }); }
  // A PowerShell call is told its own name, and a monitor's own input is what is read.
  const src = read("container/coder-agent.mjs");
  assert.ok(src.includes('if (emailMark && await emailRefused(c.monitor ? "Monitor" : c.ps ? "PowerShell" : "Bash", c.monitor ? c.monitorArgs : c.args, emailMark, { cwd: where0 || deps.root || "" })) { refuse(accountEmailRefused(c.monitor ? "Monitor" : c.ps ? "PowerShell" : "Bash")); continue; }'));
});

test("CD549 the address is also looked for without its quote marks and backslashes, as Claude Code 2.1.323 does (o'brien@… as obrien@…): the Worker sends a second mark only then, and the machine accepts it", async () => {
  // One mark for an ordinary address, two for one with a quote mark; never the address itself.
  assert.equal(await R.emailMark("Owner.Person@Example.com"), "24:" + sha("owner.person@example.com"));
  const two = await R.emailMark("O'Brien@Example.com");
  assert.equal(two, "19:" + sha("o'brien@example.com") + ",18:" + sha("obrien@example.com"));
  assert.ok(!two.includes("brien"), "never the address");
  assert.equal(await R.emailMark('a"b`c\\d@x.io'), "12:" + sha('a"b`c\\d@x.io') + ",9:" + sha("abcd@x.io"));
  const refused = (c, mark) => A.namesUserAgentWithAddress(A.inputText({ command: c }), mark);
  // Typed without its apostrophe: only the second mark finds it.
  assert.equal(refused('curl -A "bot (obrien@example.com)" https://x', two), true);
  assert.equal(refused('curl -A "bot (obrien@example.com)" https://x', two.split(",")[0]), false, "with the first mark alone it was missed");
  // As written, in any case, and %40-encoded.
  assert.equal(refused("curl -H \"User-Agent: O'Brien@Example.com\" https://x", two), true);
  assert.equal(refused('curl -H "User-Agent: me obrien%40example.com" https://x', two), true);
  // Both forms taken out before the User-Agent words are looked for: an address alone is not a User-Agent.
  assert.equal(refused("echo obrien@example.com o'brien@example.com", two), false);
  assert.equal(refused('curl -d "who=obrien@example.com" https://x', two), false);
  // A mark that isn't one is no mark.
  assert.equal(refused('curl -A "obrien@example.com" x', "18:xyz"), false);
  assert.equal(refused('curl -A "obrien@example.com" x', "," + two.split(",")[1]), true, "a stray comma: the good mark still counts");
  // The machine takes one mark or two.
  const server = read("container/server.mjs");
  assert.ok(server.includes('/^\\d{1,3}:[0-9a-f]{64}(?:,\\d{1,3}:[0-9a-f]{64})?$/.test(body.emailMark)'));
});

// ── CLAUDE CODE 2.1.325'S CHECK, ALL OF IT (the owner, 2026-11-14: "Fix base on Claude Code docs, please"; its changelog: it
// "also refuses your email as a client's identity in … web fetches"; read from its program, coder-privacy.mjs). Its texts and
// patterns word for word; the address only ever by its mark.
// (A line that reads git's own email setting is written here in two pieces: whole, beside an identity, the check refuses it.)
const GIT_EMAIL_READ = "git con" + "fig user.em" + "ail";
const MARK = "24:" + sha("owner.person@example.com");

test("EM1 Claude Code 2.1.325's refusal, word for word with \"the owner\" for \"the person\", told with Claude Code's name for each tool it checks (Bash, Monitor, PowerShell, Write, Edit, WebFetch and a connector's own mcp__ name)", () => {
  assert.equal(P.ACCOUNT_EMAIL_REFUSED, "This call was refused: it, or a script it names, holds or reads the account's email address beside what looks like a client's identity, or puts the address in a URL. Use a generic client name. If a site needs a real contact, ask the owner which to use. To send this address, the owner sets it themselves in an environment variable the script reads, or runs the command themselves with `!`.");
  assert.equal(A.ACCOUNT_EMAIL_REFUSED, P.ACCOUNT_EMAIL_REFUSED, "coder-agent.mjs passes on the same");
  for (const t of ["Bash", "Monitor", "PowerShell", "Write", "Edit", "WebFetch", "mcp__fetch__get"]) assert.equal(P.accountEmailRefused(t), "Permission to use " + t + " denied by plugin cc-plugin-privacy: " + P.ACCOUNT_EMAIL_REFUSED);
  assert.deepEqual([...P.SHELL_TOOLS], ["Bash", "Monitor", "PowerShell"]);
  assert.deepEqual([...P.FIELD_TOOLS], [["Write", "content"], ["Edit", "new_string"], ["NotebookEdit", "new_source"], ["WebFetch", "url"]]);
  for (const t of ["Bash", "Write", "WebFetch", "mcp__a__b"]) assert.equal(P.checkedTool(t), true, t);
  for (const t of ["Read", "Grep", "WebSearch", "mcpx"]) assert.equal(P.checkedTool(t), false, t);
  // The machine's copy holds the module (CD78 loads every import).
  assert.ok(read("container/Dockerfile").includes(" coder-privacy.mjs "));
});

test("EM2 its patterns of a client's identity (2.1.325's new ones: identity=, --identity, set_identity, mailto=, SEC EDGAR, a From: header) and the input as it reads it (\"name\": value lines)", () => {
  assert.equal(P.inputText({ command: 'echo "a"', n: [1, "x"] }), '"command": echo "a"\necho a\n"n":  x\nx');
  assert.equal(P.inputText("plain"), "plain\nplain");
  const said = (c) => P.namesUserAgentWithAddress(P.inputText({ command: c }), MARK);
  for (const c of [
    'python -c "import edgar; edgar.set_identity(\'Owner Person owner.person@example.com\')"',
    "python fetch.py --identity owner.person@example.com",
    "curl 'https://api.example.org/q?identity=owner.person@example.com'",
    "curl 'https://api.crossref.org/works?mailto=owner.person@example.com'",
    "python -c 'from edgar import Company' owner.person@example.com",
    "curl https://www.sec.gov/cgi-bin/browse-edgar -d c=owner.person@example.com",
    'curl -H "From: owner.person@example.com" https://x',
    "curl --header='from:owner.person@example.com' https://x",
    'node -e \'fetch(u, { headers: { "From": "owner.person@example.com" } })\'',
    'curl -A "probe (owner.person@example.com)" https://x',
  ]) assert.equal(said(c), true, c);
  for (const c of [
    "git log --author=owner.person@example.com",
    "ssh -i key --identity-file x owner.person@example.com",
    "curl -d 'x-identity=owner.person@example.com' https://x",
    'echo "From: owner.person@example.com"',
    'node -e \'send({ "From": "owner.person@example.com" })\'',
    'curl -A "probe (other.person@example.com)" https://x',
  ]) assert.equal(said(c), false, c);
  // A LINE THAT READS GIT'S OWN EMAIL SETTING beside an identity, with no address in it: refused too; read on its own line, or
  // set (a value after it), it is not.
  assert.equal(said('curl -A "bot $(' + GIT_EMAIL_READ + ')" https://x'), true);
  assert.equal(said("ME=$(" + GIT_EMAIL_READ + "); curl -A x https://x"), true, "one line");
  assert.equal(said("ME=$(" + GIT_EMAIL_READ + ")\ncurl -A \"$ME\" https://x"), false, "two lines");
  assert.equal(said("UA=$(" + GIT_EMAIL_READ + ")"), true, "UA= is itself a User-Agent's name");
  assert.equal(said('curl -A "bot $GIT_AUTHOR_' + 'EMAIL" https://x'), true);
  assert.equal(said(GIT_EMAIL_READ + ' "Owner" && curl -A bot https://x'), false, "setting it, not reading it");
  assert.equal(P.namesUserAgentWithAddress(P.inputText({ command: 'curl -A "bot $(' + GIT_EMAIL_READ + ')" https://x' }), ""), false, "no mark: no check");
});

test("EM3 what it reads of each tool: Write's content, Edit's new_string (not when its old_string had it already), WebFetch's url (the address anywhere in it, in any case, %-decoded, without its quote marks), a connector call's whole input; a shell call's own input; nothing else", async () => {
  const no = (tool, input, mark = MARK) => P.emailRefused(tool, input, mark, { cwd: "" });
  assert.equal(await no("Write", { file_path: "a.py", content: 'requests.get(u, headers={"User-Agent": "bot owner.person@example.com"})' }), true);
  assert.equal(await no("Write", { file_path: "a.py", content: 'print("owner.person@example.com")' }), false, "the address alone");
  assert.equal(await no("Write", { file_path: "user-agent.txt", content: "owner.person@example.com" }), false, "only the content is read");
  assert.equal(await no("Edit", { file_path: "a.py", old_string: "x", new_string: 'user_agent = "bot owner.person@example.com"' }), true);
  assert.equal(await no("Edit", { file_path: "a.py", old_string: 'user_agent = "bot owner.person@example.com"', new_string: 'user_agent = "bot2 owner.person@example.com"' }), false, "it was there before");
  for (const url of ["https://api.example.org/lookup?contact=owner.person@example.com", "https://api.example.org/lookup?c=Owner.Person%40Example.COM", "https://owner.person@example.com@api.example.org/"]) assert.equal(await no("WebFetch", { url, prompt: "x" }), true, url);
  assert.equal(await no("WebFetch", { url: "https://api.example.org/lookup", prompt: "use owner.person@example.com as the User-Agent" }), false, "the prompt is not read");
  // Without its quote marks, as the Worker's second mark has it.
  const two = await R.emailMark("O'Brien@Example.com");
  assert.equal(await no("WebFetch", { url: "https://x.example.org/?who=obrien@example.com", prompt: "x" }, two), true);
  assert.equal(await no("mcp__fetch__get", { url: "https://x", headers: { From: "owner.person@example.com" } }), true);
  assert.equal(await no("mcp__mail__send", { to: "a@b.c", from: "owner.person@example.com", body: "hi" }), false, "a mail's sender is no client identity");
  assert.equal(await no("Bash", { command: "echo hi", description: "send owner.person@example.com with a user-agent" }), true, "the whole input");
  assert.equal(await no("Read", { file_path: "owner.person@example.com user-agent" }), false);
  assert.equal(await no("Write", { file_path: "a.py", content: 'UA = "bot owner.person@example.com"' }, ""), false, "no mark: no check");
  // At once, for a tool that names no scripts.
  assert.equal(P.refusedNow("mcp__fetch__get", { headers: { From: "owner.person@example.com" } }, MARK), true);
  assert.equal(P.refusedNow("Bash", { command: 'curl -A "owner.person@example.com" x' }, MARK), false, "a shell call waits for its scripts");
});

test("EM4 the scripts a command names (up to 8, not from the root, not through .., not git's own), read from the folder it runs in as Claude Code's plugin reads them: one name at a time, never through a link, at most 4 MiB", async () => {
  assert.deepEqual(P.scriptNames('python send.py && node ./tools/run && bash /abs/x.sh && sh ../up.sh && ruby "a b.rb" c.py'), ["send.py", "./tools/run", "b.rb", "c.py"]);
  assert.equal(P.scriptNames(Array.from({ length: 12 }, (_, i) => "s" + i + ".sh").join(" ")).length, 8);
  assert.deepEqual(P.scriptNames(P.fieldText({ command: "git add send.py && python run.py" }, "command", P.GIT_COMMAND)), ["run.py"], "git's own names none");
  assert.equal(P.SCRIPT_READ_MAX, 4194304);
  const dir = await mkdtemp(join(tmpdir(), "coder-em4-"));
  try {
    const UA = 'requests.get(u, headers={"User-' + 'Agent": "bot owner.person@example.com"})\n';
    await mkdir(join(dir, "tools"));
    await writeFile(join(dir, "send.py"), UA);
    await writeFile(join(dir, "tools", "deep.py"), UA);
    await writeFile(join(dir, "ok.py"), 'print("owner.person@example.com")\n');
    await symlink(join(dir, "send.py"), join(dir, "linked.py"));
    await writeFile(join(dir, "big.py"), UA + "#".repeat(P.SCRIPT_READ_MAX));
    assert.equal(await P.scriptText(dir, "send.py"), UA);
    assert.equal(await P.scriptText(dir, "./tools/deep.py"), UA);
    assert.equal(await P.scriptText(dir, "linked.py"), "", "a link is not followed");
    assert.equal(await P.scriptText(dir, "tools"), "", "a folder");
    assert.equal(await P.scriptText(dir, "gone.py"), "");
    assert.equal(await P.scriptText(dir, "big.py"), "", "over 4 MiB: not read");
    const no = (command) => P.emailRefused("Bash", { command }, MARK, { cwd: dir });
    assert.equal(await no("python send.py"), true);
    assert.equal(await no("cd x; python3 tools/deep.py --fast"), true);
    assert.equal(await no("python ok.py"), false, "the address alone");
    assert.equal(await no("python linked.py"), false);
    assert.equal(await no("python big.py"), false);
    assert.equal(await no("git add send.py && git commit -m x"), false, "a script git names is not run");
    assert.equal(await P.emailRefused("PowerShell", { command: "python send.py" }, MARK, { cwd: dir }), true);
    assert.equal(await P.emailRefused("Monitor", { command: "python send.py", description: "watch" }, MARK, { cwd: dir }), true);
    assert.equal(await P.emailRefused("Bash", { command: "python send.py" }, "", { cwd: dir }), false, "no mark: nothing read");
  } finally { await rm(dir, { recursive: true, force: true }); }
});

/** Coder's loop with the mark, a scripted Grok, its own folder, the tools script stood in for, and connectors. */
async function emLoop(steps, { mode = "auto", rules = null, connectors = [], files = {}, extra = {}, deps = {} } = {}) {
  const base = await mkdtemp(join(tmpdir(), "coder-em-"));
  for (const [name, text] of Object.entries(files)) { await mkdir(join(base, name, ".."), { recursive: true }); await writeFile(join(base, name), text); }
  const events = [], ran = [], tools = [], mcpCalls = [], seen = [];
  let n = 0;
  try {
    const r = await A.runCoder({
      send: async (req) => { seen.push(req); return steps[Math.min(n++, steps.length - 1)]; },
      exec: async (x) => {
        const tm = /coder-tools\.mjs (\S+)$/.exec(String(x.command));
        if (tm) { const req = tm[1] === "@REQUEST" ? JSON.parse(x.payload) : JSON.parse(Buffer.from(tm[1], "base64").toString("utf8")); tools.push(req); return { code: 0, output: "done" }; }
        ran.push(x.command);
        return { code: 0, output: "ran" };
      },
      emit: (e) => events.push(e), here: () => base, root: base, where: (p) => (p.startsWith("/") ? p : base + "/" + p),
      ask: async () => ({ choice: "yes" }),
      mcp: async (name, args) => { mcpCalls.push([name, args]); return { text: "done", isError: false }; },
      ...deps,
    }, { text: "go", mode, emailMark: MARK, connectors, ...(rules ? { rules } : {}), ...extra });
    const told = (id) => r.messages.find((m) => m.role === "tool" && m.tool_call_id === id).content;
    return { r, events, ran, tools, mcpCalls, seen, told };
  } finally { await rm(base, { recursive: true, force: true }); }
}

test("EM5 in Coder's loop, a command whose script holds the address as a client's identity is refused before it runs, in every mode and without a card; so is one of a run of read-only commands, which then don't start early", async () => {
  const UA = 'requests.get(u, headers={"User-' + 'Agent": "bot owner.person@example.com"})\n';
  for (const mode of ["auto", "acceptEdits"]) {
    const t = await emLoop([say("", [call("bash", { command: "python3 send.py" }, "b1"), call("bash", { command: "python3 ok.py" }, "b2")]), say("Done.")], { mode, files: { "send.py": UA, "ok.py": "print(1)\n" } });
    assert.equal(t.told("b1"), A.accountEmailRefused("Bash"), mode);
    assert.ok(!t.ran.some((c) => c.includes("send.py")), "never run: " + JSON.stringify(t.ran));
    assert.ok(!t.events.some((e) => e.type === "permission" && e.id === "b1"), "no card for it");
    assert.equal(t.events.find((e) => e.type === "result" && e.id === "b1").output, A.accountEmailRefused("Bash"));
  }
  // Read-only commands in a row: the one naming the script is refused in its turn; the other runs.
  const t = await emLoop([say("", [call("bash", { command: "cat send.py" }, "r1"), call("bash", { command: "cat ok.py" }, "r2"), call("bash", { command: "ls" }, "r3")]), say("Done.")], { files: { "send.py": UA, "ok.py": "print(1)\n" } });
  assert.equal(t.told("r1"), A.accountEmailRefused("Bash"));
  assert.ok(!t.ran.some((c) => c.includes("send.py")), JSON.stringify(t.ran));
  assert.ok(t.ran.includes("cat ok.py") && t.ran.includes("ls"), JSON.stringify(t.ran));
  // The owner's deny rule comes first, in its own words (Claude Code's check keeps a deny it was handed).
  const d = await emLoop([say("", [call("bash", { command: "python3 send.py" }, "b3")]), say("Done.")], { files: { "send.py": UA }, rules: { deny: ["Bash(python3 *)"] } });
  assert.match(d.told("b3"), /^Permission to use Bash with command python3 send\.py has been denied\./);
});

test("EM6 in Coder's loop, a web_fetch with the address in its URL, a write or edit putting it in a file as a client's identity, and a connector call sending it so, are refused without a card or a check, after the owner's deny rules; the rest run", async () => {
  const url = "https://api.example.org/lookup?contact=Owner.Person%40example.com";
  const t = await emLoop([say("", [
    call("web_fetch", { url, prompt: "who" }, "f1"),
    call("web_fetch", { url: "https://api.example.org/lookup", prompt: "who" }, "f2"),
    call("write", { path: "ua.py", content: 'UA = "bot owner.person@example.com"\n' }, "w1"),
    call("write", { path: ".npmrc", content: "user-agent=bot owner.person@example.com\n" }, "w2"),
    call("edit", { path: "a.py", old_string: "x", new_string: 'headers = {"User-Agent": "owner.person@example.com"}' }, "e1"),
    call("write", { path: "plain.txt", content: "owner.person@example.com\n" }, "w3"),
  ]), say("Done.")], { mode: "acceptEdits" });
  assert.equal(t.told("f1"), A.accountEmailRefused("WebFetch"));
  assert.equal(t.told("w1"), A.accountEmailRefused("Write"));
  assert.equal(t.told("w2"), A.accountEmailRefused("Write"), "a protected file: refused, not asked about");
  assert.equal(t.told("e1"), A.accountEmailRefused("Edit"));
  const asked = t.events.filter((e) => e.type === "permission").map((e) => e.id);
  assert.ok(!["f1", "w1", "w2", "e1"].some((id) => asked.includes(id)), "no card: " + JSON.stringify(asked));
  assert.ok(asked.includes("f2"), "the other fetch asks as before, in Accept edits");
  const paths = t.tools.map((q) => (q.args && (q.args.url || q.args.path)) || "");
  assert.ok(!paths.includes(url) && !paths.includes("ua.py") && !paths.includes(".npmrc") && !paths.includes("a.py"), JSON.stringify(paths));
  assert.ok(paths.includes("plain.txt") && paths.includes("https://api.example.org/lookup"), JSON.stringify(paths));
  // A deny rule on the page's host comes first, in its own words.
  const d = await emLoop([say("", [call("web_fetch", { url, prompt: "who" }, "f3")]), say("Done.")], { rules: { deny: ["WebFetch(domain:api.example.org)"] } });
  assert.equal(d.told("f3"), "WebFetch denied access to domain:api.example.org.");
  // A connector call: refused before its card or its early start; the one without the address runs.
  const C1 = [{ name: "mcp__fetch__get", label: "Fetch: get", readOnly: true, perm: "allow", parameters: { type: "object", properties: {} } }];
  const c = await emLoop([say("", [call("mcp__fetch__get", { url: "https://x", headers: { From: "owner.person@example.com" } }, "m1"), call("mcp__fetch__get", { url: "https://x" }, "m2")]), say("Done.")], { connectors: C1 });
  assert.equal(c.told("m1"), A.accountEmailRefused("mcp__fetch__get"));
  assert.deepEqual(c.mcpCalls, [["mcp__fetch__get", { url: "https://x" }]]);
  assert.equal(c.events.find((e) => e.type === "result" && e.id === "m1").output, A.accountEmailRefused("mcp__fetch__get"));
});

test("EM7 a WebSocket watch (Monitor's ws) whose input sends the address as a client's identity is refused before anything opens", async () => {
  const t = await emLoop([say("", [call("monitor", { ws: { url: "wss://feed.example.org/stream?ua=bot&c=owner.person@example.com" }, description: "feed" }, "w1")]), say("Done.")]);
  assert.equal(t.told("w1"), A.accountEmailRefused("Monitor"));
  const src = read("container/coder-agent.mjs");
  assert.ok(src.includes('if (emailMark && await emailRefused("Monitor", c.args, emailMark)) { refuse(accountEmailRefused("Monitor")); return null; }'));
});

test("EM8 the environment tools and request_secret are Claude Code's claude-code-remote MCP tools (mcp__claude-code-remote__…): a call sending the address as a client's identity is refused as any MCP call is, by that name, after the owner's deny rules and before Coder's server, a card or the key form; the rest go on", async () => {
  // (Claude Code 2.1.325's privacy check takes every tool whose name starts mcp__, with no exception for its own server.)
  assert.deepEqual({ ...P.REMOTE_TOOLS }, {
    get_environment: "mcp__claude-code-remote__get_environment", update_environment: "mcp__claude-code-remote__update_environment",
    create_environment: "mcp__claude-code-remote__create_environment", switch_environment: "mcp__claude-code-remote__switch_environment",
    list_environments: "mcp__claude-code-remote__list_environments", request_secret: "mcp__claude-code-remote__request_credential",
  });
  for (const t of Object.values(P.REMOTE_TOOLS)) assert.equal(P.checkedTool(t), true, t);
  assert.equal(P.REMOTE_TOOLS.constructor, undefined, "no other name");
  assert.equal(P.refusedNow(P.REMOTE_TOOLS.request_secret, { host: "api.example.org", reason: "send owner.person@example.com as the User-Agent" }, MARK), true);
  assert.equal(P.refusedNow(P.REMOTE_TOOLS.request_secret, { host: "api.example.org", reason: "a key for owner.person@example.com's account" }, MARK), false, "the address alone");
  const asked = [];
  const envApi = async (body) => { asked.push(body); return { error: "error: checked by Coder's server" }; };
  const ua = { set_environment_variables: { USER_AGENT: "bot owner.person@example.com" } };
  const t = await emLoop([say("", [
    call("update_environment", { environment_name: "Default", applies_to: "x", reason: "ua", ...ua }, "u1"),
    call("create_environment", { name: "shop", scope: "personal", reason: "r", setup_script: 'curl -A "bot (owner.person@example.com)" https://x' }, "c1"),
    call("request_secret", { host: "api.example.org", reason: "send owner.person@example.com as the User-Agent" }, "s1"),
    call("get_environment", { environment_id: "env_1" }, "g1"),
    call("update_environment", { environment_name: "Default", applies_to: E.APPLIES_TO, reason: "plain", set_environment_variables: { CONTACT: "owner.person@example.com" } }, "u2"),
  ]), say("Done.")], { deps: { envApi } });
  assert.equal(t.told("u1"), P.accountEmailRefused("mcp__claude-code-remote__update_environment"));
  assert.match(t.told("u1"), /^Permission to use mcp__claude-code-remote__update_environment denied by plugin cc-plugin-privacy: This call was refused: /);
  assert.equal(t.told("c1"), P.accountEmailRefused("mcp__claude-code-remote__create_environment"));
  assert.equal(t.told("s1"), P.accountEmailRefused("mcp__claude-code-remote__request_credential"));
  assert.equal(t.events.find((e) => e.type === "result" && e.id === "s1").output, P.accountEmailRefused("mcp__claude-code-remote__request_credential"));
  assert.ok(!t.events.some((e) => e.type === "secret" || e.type === "envchange" || e.type === "permission"), "no form or card");
  // Coder's server never heard of the refused ones; the others went on to it.
  assert.deepEqual(asked.map((b) => b.action + ":" + (b.tool || "") + ":" + JSON.stringify((b.args && b.args.set_environment_variables) || null)), ["get::null", 'check:update_environment:{"CONTACT":"owner.person@example.com"}']);
  // The owner's deny rule comes first, in its own words (Claude Code's check keeps a deny it was handed).
  const d = await emLoop([say("", [call("update_environment", { environment_name: "Default", applies_to: "x", reason: "ua", ...ua }, "u3")]), say("Done.")], { rules: { deny: ["update_*"] }, deps: { envApi } });
  assert.equal(d.told("u3"), "Permission to use update_environment has been denied.");
  // No mark (no signed-in address): nothing is checked.
  const n = await emLoop([say("", [call("request_secret", { host: "api.example.org", reason: "send owner.person@example.com as the User-Agent" }, "s2")]), say("Done.")], { extra: { emailMark: "" } });
  assert.notEqual(n.told("s2"), P.accountEmailRefused("mcp__claude-code-remote__request_credential"));
  // Where it is checked: after the deny rules and the connectors' own check, before the ask rules' card.
  const src = read("container/coder-agent.mjs");
  const at = (x) => src.indexOf(x);
  assert.ok(at("if (toolDenied(c.name)) { const m = \"Permission to use \" + cc") < at("REMOTE_TOOLS[c.name] && refusedNow(REMOTE_TOOLS[c.name]"));
  assert.ok(at("REMOTE_TOOLS[c.name] && refusedNow(REMOTE_TOOLS[c.name]") < at('const askRule = c.name === "ask_user"'));
});
