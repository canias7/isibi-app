// Which DNS records may be deleted to free a hostname for a Workers Custom Domain.
//
// The dangerous property is not "does it find the apex record" — it is "does it
// leave the OTHER records that share that exact name alone". The apex of
// gofarther.dev carries three MX rows (Cloudflare Email routing), an SPF TXT, a
// site-verification TXT and, one label down, the DKIM key and the DMARC policy.
// All of them are named `gofarther.dev`, identical to the A record being
// removed. Delete those on the way to freeing a hostname and the platform's own
// login codes start going to junk folders — days later, with nothing pointing
// back at a DNS change.
//
// The records below are the real ones read off the zone on 2026-08-06.
import { test } from "node:test";
import assert from "node:assert/strict";
import { conflictingRecords, CONFLICTING } from "../.github/scripts/free-domain.mjs";

const ZONE = "gofarther.dev";

// The zone as it actually was, minus the duplicates that add nothing.
const ZONE_RECORDS = [
  { id: "apex-a1", type: "A", name: "gofarther.dev", content: "104.21.36.66", proxied: true },
  { id: "apex-a2", type: "A", name: "gofarther.dev", content: "172.67.186.196", proxied: true },
  { id: "www-a", type: "A", name: "www.gofarther.dev", content: "104.21.36.66", proxied: true },
  { id: "docs", type: "A", name: "docs.gofarther.dev", content: "86.48.22.231", proxied: false },
  { id: "mailhost", type: "A", name: "mail.gofarther.dev", content: "86.48.22.231", proxied: false },
  { id: "relay", type: "A", name: "relay.gofarther.dev", content: "86.48.22.231", proxied: false },
  { id: "smtp", type: "A", name: "smtp.gofarther.dev", content: "86.48.22.231", proxied: false },
  { id: "ses-dkim", type: "CNAME", name: "465cklrqgkiv25gc7gmff.gofarther.dev", content: "x.dkim.amazonses.com", proxied: false },
  { id: "model", type: "CNAME", name: "model.gofarther.dev", content: "gofarther-ml", proxied: true },
  { id: "mx1", type: "MX", name: "gofarther.dev", content: "route1.mx.cloudflare.net", proxied: false },
  { id: "mx2", type: "MX", name: "gofarther.dev", content: "route2.mx.cloudflare.net", proxied: false },
  { id: "mx3", type: "MX", name: "gofarther.dev", content: "route3.mx.cloudflare.net", proxied: false },
  { id: "bounce-mx", type: "MX", name: "cf-bounce.gofarther.dev", content: "route1.mx.cloudflare.net", proxied: false },
  { id: "spf", type: "TXT", name: "gofarther.dev", content: "v=spf1 include:_spf.mx.cloudflare.net ~all", proxied: false },
  { id: "gverify", type: "TXT", name: "gofarther.dev", content: "google-site-verification=x", proxied: false },
  { id: "dmarc", type: "TXT", name: "_dmarc.gofarther.dev", content: "v=DMARC1; p=none;", proxied: false },
  { id: "dkim", type: "TXT", name: "cf2024-1._domainkey.gofarther.dev", content: "v=DKIM1;", proxied: false },
  { id: "lovable", type: "TXT", name: "_lovable.gofarther.dev", content: "lovable_verify=x", proxied: false },
];

const ids = (rs) => rs.map((r) => r.id).sort();

test("it takes the apex and www address records, and only those", () => {
  assert.deepEqual(ids(conflictingRecords(ZONE_RECORDS, ZONE)), ["apex-a1", "apex-a2", "www-a"]);
});

test("the apex MX and TXT rows survive — they share the deleted record's exact name", () => {
  const doomed = new Set(ids(conflictingRecords(ZONE_RECORDS, ZONE)));
  // Named individually rather than counted, so a filter that happened to keep
  // the right NUMBER of records while dropping the DKIM key still fails.
  for (const id of ["mx1", "mx2", "mx3", "spf", "gverify"]) {
    assert.ok(!doomed.has(id), id + " is named gofarther.dev and must not be deleted");
  }
  for (const id of ["dmarc", "dkim", "bounce-mx", "ses-dkim"]) {
    assert.ok(!doomed.has(id), id + " is mail authentication and must not be deleted");
  }
});

test("subdomains are out of scope — the mail stack and the tunnel stay", () => {
  const doomed = new Set(ids(conflictingRecords(ZONE_RECORDS, ZONE)));
  for (const id of ["docs", "mailhost", "relay", "smtp", "model"]) {
    assert.ok(!doomed.has(id), id + " is a subdomain and cannot conflict with the apex binding");
  }
});

test("a domain that merely ENDS WITH the zone name is a different domain", () => {
  // A suffix match — the obvious implementation — deletes somebody else's apex.
  const trap = [{ id: "trap", type: "A", name: "notgofarther.dev", content: "1.2.3.4" }];
  assert.deepEqual(conflictingRecords(trap, ZONE), []);
});

test("a deeper name under www is not www", () => {
  const rs = [{ id: "deep", type: "A", name: "a.www.gofarther.dev", content: "1.2.3.4" }];
  assert.deepEqual(conflictingRecords(rs, ZONE), []);
});

test("AAAA counts — an IPv6 record conflicts with a Custom Domain the same way", () => {
  const rs = [{ id: "v6", type: "AAAA", name: "gofarther.dev", content: "2606:4700::1" }];
  assert.deepEqual(ids(conflictingRecords(rs, ZONE)), ["v6"]);
  assert.ok(CONFLICTING.has("AAAA"));
});

test("a CNAME on the apex counts too", () => {
  const rs = [{ id: "cn", type: "CNAME", name: "gofarther.dev", content: "x.pages.dev" }];
  assert.deepEqual(ids(conflictingRecords(rs, ZONE)), ["cn"]);
});

test("names are compared case-insensitively at both ends", () => {
  const rs = [{ id: "loud", type: "A", name: "WWW.GoFarther.DEV", content: "1.2.3.4" }];
  assert.deepEqual(ids(conflictingRecords(rs, "GoFarther.dev")), ["loud"]);
});

test("an empty zone name selects NOTHING rather than everything", () => {
  // The direction that matters: a missing input must not read as a wildcard.
  for (const z of ["", null, undefined, "   "]) {
    assert.deepEqual(conflictingRecords(ZONE_RECORDS, z), [], JSON.stringify(z) + " must select nothing");
  }
});

test("it survives junk in the record list instead of throwing halfway through a delete loop", () => {
  const rs = [null, undefined, {}, { type: "A" }, { name: "gofarther.dev" }, ...ZONE_RECORDS];
  assert.deepEqual(ids(conflictingRecords(rs, ZONE)), ["apex-a1", "apex-a2", "www-a"]);
});

test("MX and TXT are not in the conflicting set at all", () => {
  // Stated directly as well as behaviourally: the set IS the safety argument,
  // so widening it should fail here and not only in a scenario test.
  for (const t of ["MX", "TXT", "SRV", "CAA", "NS", "SOA"]) {
    assert.ok(!CONFLICTING.has(t), t + " does not conflict with a Custom Domain and must never be deleted");
  }
});
