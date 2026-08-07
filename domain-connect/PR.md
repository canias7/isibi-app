# Description

A new template for **Go Farther** (<https://gofarther.dev>), a website builder. The
service publishes a customer's generated site on their own domain, served through
Cloudflare for SaaS. The template points the domain at the hostname we serve it
from — that is the entire integration, so it is one record per group and one
variable.

`%target%` is the hostname the site is served from. It is a value we control and
put into the signed apply URL; the end user never types it.

## Type of change

- [x] New template
- [ ] Bug fix (non-breaking change which fixes an issue in the template)
- [ ] New feature (non-breaking change which adds functionality to the template)
- [ ] Breaking change (fix or feature that would cause existing template behavior to be not backward compatible)

# How Has This Been Tested?

Please mark the following checks done
- [x] Template functionality checked using [Online Editor](https://domainconnect.paulonet.eu/dc/free/templateedit)
- [x] Template file name follows the pattern `<providerId>.<serviceId>.json`
- [x] resource URL provided with `logoUrl` is actually served by a webserver

# Checklist of common problems

- [x] `syncPubKeyDomain` is set — **this is mandatory**; omitting it requires explicit justification in the PR description or the PR will be rejected
- [x] `warnPhishing` is **not** set alongside `syncPubKeyDomain` — the two must not appear together
- [x] `syncRedirectDomain` is set whenever the template uses `redirect_uri` in the synchronous flow
- [x] no TXT record contains SPF content (`"v=spf1 ..."`) — use the `SPFM` record type instead
- [x] `txtConflictMatchingMode` is set on every TXT record that must be unique per label or content prefix (e.g. DMARC)
- [x] no variable is used as a bare full record value (e.g. `@ TXT "%foo%"`) unless necessary — prefer `@ TXT "service-foo=%foo%"`; if bare, justify in the PR description
- [x] no bare variable is used as the full `host` label — the non-variable parts are fixed to limit misuse (e.g. `%dkimkey%._domainkey`, not `%dkimhost%`); if bare, justify in the PR description
- [x] no variable is used in the `host` field to create a subdomain — use the `host` parameter or `multiInstance` instead
- [x] `%host%` does not appear explicitly in any `host` attribute
- [x] `essential` is set to `OnApply` on records the end user may need to modify or remove without breaking the template (e.g. DMARC)

Notes on the points above, where a check needs explaining rather than just ticking:

- **No TXT records at all**, so the SPF and `txtConflictMatchingMode` rules have
  nothing to apply to.
- **`%target%` is a bare variable in `pointsTo`**, which the "bare full record
  value" rule is about for TXT. It is a CNAME/APEXCNAME target, where a hostname
  is the only legal value and there is no prefix to add. It is not a host label
  and it is not user-supplied.
- **`essential` is not set on either record.** Both rules describe records the
  user may need to change without breaking the template; here each record *is*
  the service, and removing it takes the site offline. There is nothing for the
  user to keep.
- **`syncRedirectDomain` is two of our own hostnames, no wildcard.**

## Why two groups rather than one record with `hostRequired`

The service has to serve both `example.com` and `www.example.com`, and only one
of them per apply — a hostname must be registered with our platform before it
will serve, so applying both would point a name at us that we are not hosting.

A single `CNAME` at `@` with `hostRequired: false` was the first draft, and the
schema correctly refuses it. Setting `hostRequired: true` instead would have made
the bare domain unreachable, which is the case customers ask for by name. So the
apex record is an `APEXCNAME` in group `apex`, the subdomain record is a literal
`www` `CNAME` in group `www`, and the apply URL names exactly one group.

**On the apex/subdomain test requirement.** Three runs are included. The `apex`
group is tested both without a `host` and with one, and it is worth saying what
the second shows: `APEXCNAME` has no `host` field, so the apply's `host` is
ignored and the record still lands at the apex — which is the behaviour we want
and the reason a host parameter is harmless here.

The `www` group carries a **literal** `www` label rather than a variable, so it
is not relocatable: applying it with `host=www` would write
`www.www.example.com`. That is a misuse rather than a supported case, and our
apply URL never sends a `host` at all — it names a `groupId` and nothing else.

## Note on DCTL1038

The lint's info-level note — *APEXCNAME and REDIRxxx records are not widely
supported* — is understood and is exactly why there are two groups. A provider
without `APEXCNAME` support still serves our customers through the `www` group,
and the panel falls back to copyable records for anyone whose provider offers
neither.

## Online Editor test results

**Editor test link(s):**

- `apex`, no host — `sharpfadebarbers.com` → `APEXCNAME` → `saas.gofarther.dev`:
  [test](https://domainconnect.paulonet.eu/dc/free/templateedit?token=H4sIAMEVdmoC%2F91T227aQBD9FWulPtWAwQ4XS5WaC2mqKglKUzVRhKzBO9ir2l53d41LEP%2FeWRMCJLz0tU%2F2zuXMmTMzK2YwLzMwyMIVK5VcCI7qK2chS%2BQclElRtTkumPvqvIGcgtkX6Vxu%2FOTTqBYixiZPCwJ7Nb2LdmqcvYQsUGkhCxZ2XZbJRP5QGYWmxpQ67HQO6nesv10WCaVx1LESpWlS2USKwjgmFdrhMgdROGCfuK3jLGXlzCqRGacWJnV2TNqWAigBswwvDjANqARN2MDsMU%2BlNgX1c1CN%2FmyryJ25krnF1MsinlSzb7i8aEKOaGlD7pALhbE5HuTWdd1%2Bm2YJ3OHvivJI6TlkGgkrhf0nQUrFNQufVswsSyv%2B6WT8cH5zej22U7Ry6XtJ5g%2BbNj%2BQ1RhSvjv0PJclSlZlM0go8Q9bu68wWwjLgp5E8N%2FwbMJ6unbZsyww2vGc0ki3GthmyjlwnIGa0Xq0Y5nvSrIXuEg0iRuGlF6CglzbDd4CPR1Hmm6hnpj9b8D2gTYdNOkA%2Bo3%2BlrpICqkw0vQFUymSxaiKVM%2BrzIgIatiZeBxBWWZL6lSTl0CPT6TYXMhnu9lgwIrwvvaBpBGPba%2FCihr4%2FmDoI7b8UXzSCvp9aI2CgdeCfm%2BEAEGXB6O94z162Ueudyc4ao2FEWBP8zSrYanZej11aWr%2FUTs0eg10wxHYsJ7X67e8Ycsb3HcHYW8Y%2Bn476A17J72Pnhd6nqWP2mzaW9FW7O8D%2B3V%2F%2B%2FNWFZfaG1%2FFV%2F64vj47e%2Fz%2B%2BJzGie6cq%2BH1eTCZiwd%2BxeUntv4Lzbm3f4EFAAA%3D)
- `apex`, `host=www` — the host is ignored, record still at the apex:
  [test](https://domainconnect.paulonet.eu/dc/free/templateedit?token=H4sIAEk8dmoC%2F91TTU%2FbQBD9K9ZKnOqEtRtIsFSpaQmIIlJKqVIVRdbYHtsr2V53dx03RPnvnXUIJJBLrz3ZOx9v5r2ZWTGDZV2AQRasWK3kQiSorhIWsEymoEyOqp%2FggrnPzimUFMwupXOx8ZNPo1qIGLs8LQjs2fQm2mkxegpZoNJCVizwXFbITP5QBYXmxtQ6OD7eq39s%2Ff26yigtQR0rUZsuld1KURnH5EI7iSxBVA7YJ27rOEvZOFEjCuO0wuTOSyd92wIoAVGB53uYBlSGJuhgdjrPpTYV8dmrRn%2BWKiZOqmRpMfWyim%2Bb6BqX513IAS1tyB0mQmFsDge5bdv2X6fZBu7wd0N5pHQKhUbCymH3SZBSJZoFDytmlrUVf3w7%2Bfl5Or6Z2ClaufS9JPPRhuYRWY0h5b0R5y7LlGzqbpBQ4x%2B2dp9hthC2C3pSg%2F%2BGZxPW87XLHmWF4UufcxrpVgNLpk4hwQhUROvRj2X5umSHGIoud9MkIdSgoNR2ibdYD4fB5lu0hw5u%2FoS3i7Xh0SEA6FdTsAREVkmFoaYvmEaROEY1pH3ZFEaE0MKLKYlDqOtiSXw1eQn08FyqzZ18tPsNBqwUb2vvCRsmsaUrrLR8MDo5i1KvF3sD3hskHvSAn6W993Dq%2Banv%2BV402Dnhg%2Fd94Ib3ZEetsTIC7I2OixaWmq3Xc5fG938xogXQQPccgo30uX%2Fa46MeH977PPD84GTYHw39kzP%2FHecB55YBarNhuKLd2N0Kxi%2Bns8t29r26mOSDcpiN2tnXdjy7lp%2B4Tr9lM%2FHrMZ5c3aT5F%2FmBrf8CvcwzII0FAAA%3D)
- `www`, no host — `www.sharpfadebarbers.com` → `CNAME` → `saas.gofarther.dev`:
  [test](https://domainconnect.paulonet.eu/dc/free/templateedit?token=H4sIAMIVdmoC%2F91TwW7aQBD9FWulnGrApAQbSz2kTZqmEYRGaYqCkDW2x7Cq7XV21xiK%2BPfOmhAgcOm1J3t35r1582ZnxTRmRQoamb9ihRRzHqO8jZnPpiIBqWcomzHOmf0WHEBGyexGWF83cYoplHMeYY1TnMjero6yrQrD15Q5SsVFzvy2zVIxFT9lSqkzrQvlt1oH9Vsm3izyKcFiVJHkha6hbCh4ri0948qKRQY8t8AccVvHWorSCkueaqviembtlDSNBJAcwhSvDjg1yClqv6bZUz4TSufUz0E1%2BjOtYmwlUmSGUy3zaFiGd7i8qlNOeGlSHjDmEiN9Osmuqqr5HmYEPOBLSThyOoFUIXHNYP9IlELGivnjFdPLwph%2FObwefRlc9q%2FNFI1d6lHQ9dmmzTO61Zqcb3uOY7OpFGVRDxIKXLC1%2FUazpTAq6EgC%2F43PANaTtc3%2BiByDnc4JjXTrgWmmSCDGEGRIz6MZiWxXkr3SBbwG1oyELkBCpswD3vKMTxNNtkxjZv5rrj2ejf4aDaDeuW%2BE82kuJAaKvqBLSaZoWZLnWZlqHkAFu6s4CqAo0iX1qShKpOMjI%2FPNbmyMjEGDMeC48oGdQRyZRnk9oK7rtnvoNnodL2l0oouLRi9KvAb0LhwPPddzo2hvcU9u9YnN3ZmNSmGuOZi1vEwrWCq2Xk9smth%2F0wyNXQFtbwAm7dw57zYcr%2BG4j23XP%2Ff8j51mp9d2vO4Hx%2FEdx8hHpTftrehF7L8F1vv97SkdLT4vwpvuPPnu3s0HL8Nf9yNv0F484A91%2B6Sen577ogX9T2z9F9DmC%2FF7BQAA)
