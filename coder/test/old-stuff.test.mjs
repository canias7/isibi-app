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
  assert.match(y, /grep -q 'model\\\.gofarther\\\.dev'/);
  assert.match(y, /grep -q 'lkpfeqrelvziltfwpuxi'/);
  // Yes or no only: never the Worker's code or its variables.
  assert.match(y, /echo "worker \$w: model\.gofarther\.dev=\$m  gofarther-ai-supabase=\$s"/);
  assert.doesNotMatch(y, /echo "\$text"|printf '%s\\n' "\$text"/);
});
