// THE TEST COPIES (owner, 2026-11-10: "test what we have live without touching the other branches or merging", and "it
// wouldn't interfere with the main product, right?"): the live Worker's own settings (wrangler.jsonc), with a copy's own
// name, address, storage and machines, so it never touches gofarther.dev, its Worker or its data. The deploy button's
// "test" or "jessica" choice writes them as wrangler.test.json (`node test-copy.mjs test`, or `jessica`) and deploys
// that; nothing else changes. Two copies since the Gloopy and connectors work were both merged (2026-11-13).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Each test copy's own Worker, address, storage and machines (Fly.io app): test.gofarther.dev (made for the Gloopy work)
 * and jessica.gofarther.dev (made for the connectors work).
 */
export const COPIES = Object.freeze({
  test: Object.freeze({ name: "gofarther-coder-test", host: "test.gofarther.dev", bucket: "gofarther-coder-test", flyApp: "gofarther-coder-test-machines" }),
  jessica: Object.freeze({ name: "gofarther-coder-jessica", host: "jessica.gofarther.dev", bucket: "gofarther-coder-jessica", flyApp: "gofarther-coder-jessica-machines" }),
});
/** The first copy, test.gofarther.dev. */
export const TEST = COPIES.test;

/** wrangler.jsonc as JSON: its line and block comments and trailing commas taken out, never inside a string. */
export function stripJsonc(text) {
  const s = String(text);
  let out = "", i = 0, inString = false;
  while (i < s.length) {
    const c = s[i], d = s[i + 1];
    if (inString) {
      out += c;
      if (c === "\\") { out += d === undefined ? "" : d; i += 2; continue; }
      if (c === '"') inString = false;
      i++;
      continue;
    }
    if (c === '"') { inString = true; out += c; i++; continue; }
    if (c === "/" && d === "/") { while (i < s.length && s[i] !== "\n") i++; continue; }
    if (c === "/" && d === "*") { const end = s.indexOf("*/", i + 2); i = end < 0 ? s.length : end + 2; continue; }
    out += c;
    i++;
  }
  // A comma before a closing bracket (allowed in JSONC), outside strings.
  let clean = "", inStr = false;
  for (let k = 0; k < out.length; k++) {
    const c = out[k];
    if (inStr) { clean += c; if (c === "\\") { clean += out[k + 1] || ""; k++; } else if (c === '"') inStr = false; continue; }
    if (c === '"') { inStr = true; clean += c; continue; }
    if (c === ",") { let j = k + 1; while (j < out.length && /\s/.test(out[j])) j++; if (out[j] === "}" || out[j] === "]") continue; }
    clean += c;
  }
  return clean;
}

/**
 * A test copy's settings, from the live ones: its own name, its own address only, its own storage, the page and its
 * machines told the copy's address. Everything else (the code, the page, the machines' image, the every-minute run, the
 * accounts that may use it) is as live. Refuses anything that would still point at the live Worker's address or data.
 */
export function testConfig(live, copy = TEST) {
  if (!live || typeof live !== "object" || !live.name) throw new Error("not a Worker's settings");
  if (!Object.values(COPIES).includes(copy)) throw new Error("not one of the test copies");
  const TEST = copy;
  const c = JSON.parse(JSON.stringify(live));
  const url = "https://" + TEST.host;
  c.name = TEST.name;
  c.routes = [{ pattern: TEST.host, custom_domain: true }];
  delete c.route;
  c.vars = { ...(c.vars || {}), APP_ORIGIN: url, CODER_PUBLIC_URL: url, CODER_FLY_APP: TEST.flyApp };
  c.r2_buckets = (Array.isArray(c.r2_buckets) ? c.r2_buckets : []).map((b) => (b && b.binding === "CODER_BUCKET" ? { ...b, bucket_name: TEST.bucket } : b));
  if (!c.r2_buckets.some((b) => b && b.binding === "CODER_BUCKET")) throw new Error("the live settings have no CODER_BUCKET");
  // Nothing of the live Worker's own left: its name, addresses, storage or machines.
  const liveBuckets = (Array.isArray(live.r2_buckets) ? live.r2_buckets : []).map((b) => b && b.bucket_name).filter(Boolean);
  const liveHosts = (Array.isArray(live.routes) ? live.routes : []).map((r) => r && r.pattern).filter(Boolean);
  const leftover = [
    c.name === live.name ? "name" : "",
    c.routes.some((r) => liveHosts.includes(r.pattern)) ? "address" : "",
    c.r2_buckets.some((b) => b && liveBuckets.includes(b.bucket_name)) ? "storage" : "",
    live.vars && c.vars.CODER_FLY_APP === live.vars.CODER_FLY_APP ? "machines" : "",
  ].filter(Boolean);
  if (leftover.length) throw new Error("the test copy would share the live Worker's " + leftover.join(", "));
  return c;
}

// `node test-copy.mjs test` (or `jessica`): writes that copy's wrangler.test.json next to wrangler.jsonc (the paths in it
// stay as they are). Any other name is refused, so a typo never deploys anywhere.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const which = process.argv[2] || "test";
  const copy = Object.hasOwn(COPIES, which) ? COPIES[which] : null;
  if (!copy) { console.error("no test copy called " + which + ": the copies are " + Object.keys(COPIES).join(" and ")); process.exit(1); }
  const here = dirname(fileURLToPath(import.meta.url));
  const live = JSON.parse(stripJsonc(readFileSync(join(here, "wrangler.jsonc"), "utf8")));
  writeFileSync(join(here, "wrangler.test.json"), JSON.stringify(testConfig(live, copy), null, 2) + "\n");
  console.log("wrangler.test.json: " + copy.name + " at https://" + copy.host + " (storage " + copy.bucket + ", machines " + copy.flyApp + ")");
}
