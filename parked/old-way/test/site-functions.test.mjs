// PARKED (2026-11-03, park-old-way): the old-way half of test/site-functions.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// THE SITE'S OWN SERVER CODE (2026-10-28): the model writes a `server-<name>`
// part; the site's Worker runs it at /api/db/<site>/fn/<name> through the
// `site` helper; the builder refuses code that reaches around the helper.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTemplate } from "../../../test/fixtures/template-ts.mjs";
import { checkServerPart, vetServerCode, importsServer } from "../../../builder/server-code.mjs";

const KEY = "sk-live-owner-secret-123456";
const env = { OPENAI_KEY: KEY, APP_CONN: "" };
const url = (n) => new URL("https://kiln.gofarther.app/api/db/kiln/fn/" + n);
const req = (n, init) => new Request(url(n), { headers: { "CF-Connecting-IP": "1.2.3." + Math.random() }, ...init });

function memBucket() {
  const m = new Map();
  return {
    m,
    async get(k) { const v = m.get(k); return v ? { body: new Response(v.body).body, httpMetadata: v.meta, size: String(v.body).length } : null; },
    async put(k, body, o = {}) { m.set(k, { body: typeof body === "string" ? body : new TextDecoder().decode(body), meta: o.httpMetadata }); },
    async delete(k) { m.delete(k); },
    async list({ prefix }) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key, size: 1 })), truncated: false }; },
  };
}

test("SF17 the router and the add-on step send 'the site should DO something' to the writer with server code", async () => {
  const { ASK_TOOL } = await import("../builder/site-ask.mjs");
  assert.match(JSON.stringify(ASK_TOOL), /SOMETHING THE SITE DOES that it does not do yet is an addition too/);
  const add = readFileSync(new URL("../../../builder/site-add.mjs", import.meta.url), "utf8");
  // The api kind that used to point here went with the prebuilt features (2026-10-29).
  assert.doesNotMatch(add, /An OUTSIDE service a page reads live/);
  assert.match(add, /WITH the site's own server code when it needs one/);
});

// THE `site` HELPER IS TYPED (2026-10-30): a server part's `site: SiteHelper`
// is the route's own `makeSite` return type, declared globally by
// `site-functions.ts`, so `tsc` reads a wrong call as an error, not as `any`.
// Typechecked as the template's program would: `site-functions.ts` and the
// part, with the template's compiler options; only the part's own diagnostics
// are read (the template's other imports are not this test's).
async function typecheckPart(source) {
  const { createRequire } = await import("node:module");
  const { existsSync } = await import("node:fs");
  const path = await import("node:path");
  const tpl = new URL("../../../builder/lovable/template/", import.meta.url).pathname;
  const tsLocal = path.join(tpl, "node_modules/typescript/lib/typescript.js");
  const ts = existsSync(tsLocal) ? createRequire(import.meta.url)(tsLocal) : createRequire(import.meta.url)("typescript");
  const cfg = ts.parseJsonConfigFileContent(ts.readConfigFile(path.join(tpl, "tsconfig.json"), ts.sys.readFile).config, ts.sys, tpl);
  const part = path.join(tpl, "src/routes/-parts/server-typed-check.tsx");
  const host = ts.createCompilerHost({ ...cfg.options, types: [] });
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (f, lang, ...rest) => (path.resolve(f) === part ? ts.createSourceFile(f, source, lang, true) : getSourceFile(f, lang, ...rest));
  const fileExists = host.fileExists.bind(host);
  host.fileExists = (f) => path.resolve(f) === part || fileExists(f);
  const program = ts.createProgram([path.join(tpl, "src/lib/site-functions.ts"), part], { ...cfg.options, types: [], noEmit: true }, host);
  const sf = program.getSourceFile(part);
  assert.ok(sf, "the part is in the program");
  return [...program.getSemanticDiagnostics(sf), ...program.getSyntacticDiagnostics(sf)].map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
}
