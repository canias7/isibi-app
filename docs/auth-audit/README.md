# Auth layer — production audit

Run against `https://isibi.ai` · 148 passed, 5 failed.


## the site

- ✅ build returns 200
- ✅ every declared table was created
- ✅ the display table was seeded
- ❌ a real app was published, not the placeholder — `page=placeholder stage=- error=- notes=Your database is live, but writing the pages didn't work this time — send it again to retry. cost=0 files=[] problems=[]`

## signup

- ✅ signup creates an account and returns a session
- ✅ a short password is refused
- ✅ an invalid address is refused
- ✅ a duplicate address is 409 `exists`
- ✅ a BREACHED password is refused

## login

- ✅ login returns a session for the right password
- ✅ a wrong password is 401
- ✅ an unknown address answers BYTE-IDENTICALLY to a wrong password

## sessions and token kinds

- ✅ `me` resolves a session to the account
- ✅ `me` with no token is 401
- ✅ `me` with a garbage token is 401
- ✅ `me` with a truncated token is 401
- ✅ a token is useless against a different site
- ✅ `sessions` lists this account's devices
- ✅ exactly one device is marked `current`
- ✅ the token's own device appears in the list
- ✅ a device is named, not dumped as a UA string
- ✅ revoking ONE device succeeds
- ✅ the revoked device's token stops working
- ✅ the device you are reading from still works
- ✅ revoking it twice is a 404, not a silent success
- ✅ an unknown sid answers identically to somebody else's

## account controls

- ✅ changing a password needs the CURRENT one
- ✅ a BREACHED new password is refused
- ✅ a signed-in member can change their password
- ✅ the password change signs OTHER sessions out
- ✅ ...and keeps the one that made the change
- ✅ the old password no longer works
- ✅ the new password does
- ✅ changing an address needs the current password
- ✅ a member can change their address
- ✅ the new address logs in
- ✅ the old address does not

## data scoping

- ✅ a `display` table is readable by anyone
- ✅ a MASKED column is redacted for the public
- ✅ no query string can unmask it
- ✅ a `display` table refuses a public write
- ✅ a `collect` table refuses a public READ
- ✅ a `user` table answers 401 to a signed-OUT visitor
- ✅ a member can write to a `user` table
- ✅ a `user` read returns ONLY the caller's own rows
- ✅ another member's row answers 404, NOT 403
- ✅ a `publicView` projection is readable by anyone
- ✅ the projection carries NO id

## submissions and claim links

- ✅ anyone can submit to a `collect` table
- ✅ the submission comes back with a CLAIM token
- ✅ a `unique` constraint refuses the same slot twice (409)
- ✅ ...but a different slot is accepted
- ✅ a claim token reads back that one row
- ✅ a bad claim is 404
- ✅ a claim does NOT open the neighbouring row
- ✅ a claim token is NOT a session
- ✅ a claim can cancel its own row
- ✅ cancelling twice is idempotent, not an error

## roles, and the owner's door

- ✅ an `admin` table refuses a plain member's write
- ✅ the owner can list the site's members
- ✅ the member list does NOT carry password hashes
- ✅ the owner can grant a role
- ✅ ...and the granted role can now write
- ✅ the owner can suspend a member
- ✅ a suspended member's token stops working at once
- ✅ a suspended member's login is byte-identical to a wrong password
- ✅ ...and can reinstate them

## who may become a member

- ✅ the owner can close signups
- ✅ a CLOSED site refuses a new account
- ✅ the owner can require an invite
- ✅ invite-only refuses a signup with no code
- ✅ a wrong code answers identically to no code
- ✅ the owner can mint an invite code
- ✅ a valid code lets somebody in
- ✅ a one-use code cannot be used twice
- ✅ a domain allow-list refuses an address outside it
- ✅ ...and admits one inside it
- ✅ a SUBDOMAIN does not match
- ✅ a lookalike domain does not match

## second factor — authenticator app

- ✅ a member to enrol exists
- ✅ enrolling needs a session
- ✅ an authenticator secret is issued
- ✅ ...with an otpauth:// URI a real app can scan
- ✅ a wrong code does not turn it on
- ✅ a started-but-unconfirmed factor does not gate sign-in
- ✅ a code from a real authenticator turns it on
- ✅ ...and hands over recovery codes, once
- ✅ with 2FA on, the password alone returns a PENDING token, never a session
- ✅ the pending token does NOT open the account
- ❌ presenting the code completes the sign-in — `401 {"error":"That code didn't match.","code":"totp"}`
- ❌ ...and THAT token is a working session — ``
- ✅ the SAME code cannot be used twice inside its window
- ✅ a session cannot be presented in place of a pending token

## recovery codes

- ✅ a recovery code stands in for the app
- ✅ ...and says how many are left
- ✅ a spent recovery code is refused
- ✅ recovery codes can be regenerated
- ✅ regenerating invalidates the codes somebody may still have on paper
- ✅ turning the factor off needs the password
- ✅ ...and with the password, it comes off
- ✅ sign-in returns a plain session again

## brute force — the escalating delay

- ✅ an account to attack exists
- ✅ the right password works before any of this
- ✅ six wrong passwords are all refused the same way
- ✅ the CORRECT password is now refused too — the delay is in force
- ✅ ...and the refusal is byte-identical to a wrong password, not an oracle
- ✅ the delay ends by itself and the real person gets back in

## single sign-on — the parts that are ours

- ✅ an owner can configure a provider
- ✅ the sign-in page is offered the configured provider
- ✅ ...and second factors are NOT offered as a way in
- ✅ reading the config back never returns the secret
- ✅ ...and it tells the owner the exact redirect URI to register
- ✅ starting a sign-in is a 302 to the provider
- ✅ it carries the OWNER's client_id, so one revocation cannot take down every site
- ✅ PKCE is on, and it is S256
- ✅ the redirect_uri is this site's callback, not something a caller chose
- ✅ the state is a signed token, not a random string
- ✅ a callback with no state is refused
- ✅ a callback with a forged state is refused
- ✅ a SESSION token presented as state is refused
- ✅ a state minted for one provider is refused by another
- ✅ a VALID state gets past our checks and fails at the provider instead
- ✅ a browser arriving at the callback gets a page, not JSON
- ✅ ...which reports the failure instead of signing anyone in
- ✅ an off-site `next` is reduced to a path on this site

## teams — the shared read model

- ✅ an owner can create a team
- ✅ a team needs a name
- ✅ an owner can put members in a team
- ✅ the assignment is on the member rows, not just in the response
- ✅ a team member can write a team-scoped row
- ✅ so can somebody with no team
- ❌ the row is stamped with the writer's team — `team_id=undefined expected=1 row={"id":1,"title":"ada-deal","value":"100","owner_id":1,"created_at":"2026-07-29 17:26:51"}`
- ✅ a teamless writer's row carries no team
- ❌ a team-mate sees the team's rows, not just their own — `200 []`
- ✅ a member with NO team sees ONLY their own rows
- ✅ ...and the team cannot see the teamless member's row
- ✅ the owner's team list counts its members
- ✅ an owner can delete a team
- ✅ its members are released, so the team's rows stop being visible
- ✅ deleting a team that is gone is 404

## the published site, in a real browser

- ✅ the published site serves 200
- ✅ no uncaught error on load
- ✅ a member can be signed in from inside the published page
- ✅ the stored session actually opens a member-scoped read
- ✅ a passkey can be enrolled from the published site
- ✅ ...and the browser's real attestation is accepted
- ✅ a registration challenge cannot be used twice
- ✅ a passkey signs in with no account named
- ✅ ...and the session it mints is a working one
- ✅ a captured assertion cannot be replayed
- ✅ the passkey is listed on the account
- ✅ a passkey can be removed
- ✅ removing it twice does not silently succeed

## The published site

![published](01-published-site.png)

![content](02-seeded-content.png)
