// THE OLD APP'S LEFTOVERS (2026-11-06, the audit): the "list old stuff" button
// must stay read only, and it now also lists DNS records, tunnels and which
// Workers still use the open model server or the old Supabase project.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ROOT = new URL("../../", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");

test("CD98 (2026-11-06, the audit) list old stuff stays read only, and shows DNS records, tunnels and who uses model.gofarther.dev", () => {
  const y = read(".github/workflows/list-old-stuff.yml");
  assert.doesNotMatch(y, /-X\s*(DELETE|POST|PUT|PATCH)\b|--request\s*(DELETE|POST|PUT|PATCH)\b/i, "no request that changes anything");
  assert.doesNotMatch(y, /wrangler[^\n]*\b(delete|deploy|put|create)\b/i, "no wrangler command that changes anything");
  assert.match(y, /\/dns_records\?per_page=500/);
  assert.match(y, /\/cfd_tunnel\?is_deleted=false/);
  assert.match(y, /select\(\.content \| tostring \| endswith\("\.cfargotunnel\.com"\)\)/, "addresses in every zone that point at a tunnel");
  assert.match(y, /\/cfd_tunnel\/\$t\/configurations/, "each tunnel's own routes");
  assert.match(y, /grep -q 'model\\\.gofarther\\\.dev'/);
  assert.match(y, /grep -q 'lkpfeqrelvziltfwpuxi'/);
  // Yes or no only: never the Worker's code or its variables.
  assert.match(y, /echo "worker \$w: model\.gofarther\.dev=\$m  gofarther-ai-supabase=\$s"/);
  assert.doesNotMatch(y, /echo "\$text"|printf '%s\\n' "\$text"/);
});

test("CD99 (owner 2026-11-06, \"Do 1\") DELETE MODEL SERVER deletes only model.gofarther.dev and its tunnel; DELETE alone does not", () => {
  const y = read(".github/workflows/delete-old-stuff.yml");
  const job = (name) => { const from = y.indexOf("\n  " + name + ":\n"); assert.ok(from > 0, name); const rest = y.slice(from + 1); const next = rest.search(/\n  [a-z][a-z-]*:\n/); return next > 0 ? rest.slice(0, next) : rest; };
  const ms = job("model-server"), old = job("delete"), refused = job("refused");
  assert.match(ms, /if: \$\{\{ github\.event\.inputs\.confirm == 'DELETE MODEL SERVER' \}\}/);
  assert.match(old, /if: \$\{\{ github\.event\.inputs\.confirm == 'DELETE' \}\}/);
  assert.match(refused, /confirm != 'DELETE' && github\.event\.inputs\.confirm != 'DELETE MODEL SERVER'/);
  // Only the one name, never the zone's other records (mail, the site, coder.gofarther.dev).
  assert.match(ms, /dns_records\?name=model\.gofarther\.dev"/);
  assert.equal((ms.match(/-X DELETE/g) || []).length, 3, "the record, the tunnel's connections, the tunnel");
  assert.match(ms, /-X DELETE -H "\$H" "\$API\/zones\/\$ZONE\/dns_records\/\$id"/);
  assert.doesNotMatch(ms, /wrangler|old-stuff\/|branches|r2\/buckets|neon/i);
  // The tunnel goes only when no other DNS record still points at it.
  assert.match(ms, /if \[ "\$n" != "0" \]; then echo "tunnel \$t: \$n other record\(s\) still use it, so it stays"; continue; fi/);
  assert.ok(ms.indexOf("dns_records/$id") < ms.indexOf("cfd_tunnel/$t\""), "the record goes first, then the tunnel");
});
