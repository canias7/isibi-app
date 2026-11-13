# Owner notes

The owner's running log, newest first, in plain English. Started fresh on
2026-11-05: everything from the old website builder was deleted, and the old
log (81,000 lines) is in git history.

## Waiting on you (noted 2026-11-06, your word: "Note it, i will do it later")

- **Delete the "gofarther-ml" tunnel in Cloudflare.** It linked the old open AI model server (Ollama) to model.gofarther.dev. Its address is already deleted, so nobody can reach it, but the computer running it is still on. In Cloudflare: Zero Trust, Networks, Tunnels, gofarther-ml. Its Connectors tab shows which computer it runs on. Delete the tunnel, and stop Ollama on that computer if you don't need it.
- Optional: turn on leaked-password protection for Coder's sign-in in Supabase.
- Only when you want automatic code reviews (added 2026-11-07): in GitHub's settings for the gofarther-coder app, tick the "Pull request" events and set "Checks" to read and write. `@coder review` comments work without this.
- Only when you want the apps in the stores (added 2026-11-07): an Apple Developer account ($99 a year) and a Google Play Console account ($25 once).

## 2026-11-13: Handoff (tool 4), compared with Grok Bot and dots, two fixes (your words: "ok lets start tool 4", "yes do it on low")

**What handoff is:** Gloopy hands you a step only a person can do in its browser (a captcha, a bank's check of a payment, "Sign in with Google", approving on your phone, a QR code), then carries on.

**Already the same as Grok Bot and dots:** the same kinds of steps; a card saying what to do and why, with Gloopy's browser live in it, and Skip, I'm done and Take over; Gloopy carries on by itself afterwards (as dots does) and never gets around the step; dots' "Hand off to me" exists as a rule and a site choice; a card from a run you didn't start waits 30 minutes (as Grok Bot's).

**Fixed:**
1. **Captchas are always yours.** The handoff tool said "a CAPTCHA you cannot get past", as if Gloopy might try one first; its rules said a captcha is always yours. Both now say: always yours, never try.
2. **A sign-in you do on a handoff card is remembered.** Signing Gloopy in with Google (single sign-on) on a handoff card didn't list the site in Settings → Computer → Browser, so you couldn't sign Gloopy out of it there. Now Gloopy marks such a step, and once you're done the site is listed ("You signed in yourself").
(Test GL148.)

**Not done (your call):** dots can text you a link (needs a paid texting service); Grok Bot waits about 3 minutes before alerting your phone while its computer app is open (Gloopy alerts at once, never about a chat you're looking at).

**For the live tests,** a second practice page (in the repo as `coder/test/fixtures/practice-handoff.html`, nothing real behind it): a bank's "confirm this payment", a "Sign in with Practice ID, approve on your phone", a QR code, and a "press and hold to show you're a person".

**Found in the live tests (on Low):**
- Asked to finish the practice order, Gloopy didn't press the bank's button itself: it handed the step to you, with the reason ("only you can do that step").
- **Fixed: Take over on the card did nothing you could use.** When the card came with the browser view closed, pressing Take over gave you control (the top button said "Browser · You"), then put the browser straight back into the card, so there was nothing to click. Now Take over (and the Browser button) opens the view and it stays open. (Test GL125.) Tried again after the fix: the view opened and stayed.
- I pressed the bank's button in Gloopy's browser and handed it back; Gloopy looked at the page and said order PS-2001 (€9.00) is paid.
- Asked to sign in to the practice shop ("approve this sign-in on your phone"), Gloopy handed it to you and marked it as a sign-in. Once done, Settings → Computer → Browser listed test.gofarther.dev, "You signed in yourself", with Sign out, and Gloopy said you're signed in as Jenny Rosen.
- **Fixed: "Done, hand it back" on that sign-in said "No sign-in is waiting."** My change from this morning (remembering sign-ins done on a handoff card) gave the card the same mark the sign-in card uses, so the page answered the wrong card. ("I'm done" on the card itself worked.) The handoff's mark has its own name now, and the page goes by the card's kind. (Test GL149.)
- The texts that say where signed-in sites are listed now say Settings → Computer → Browser (where it really is).
- **QR code:** asked to link your phone, Gloopy handed you the QR code (it shows live in the card, so a phone can scan it from the screen). I pressed "I'm done" without scanning: Gloopy saw the page still waiting and asked once more ("scan it from this live view"). I pressed Skip: "The phone was not linked… I stopped there and did not try another way."
- **"Press and hold to show you're a person":** Gloopy didn't try it; it handed it to you ("that check is yours"). Skip: "I couldn't get you past the check… I stopped there and did not try another way."

## 2026-11-13: Paying, the rest tested (your words: "we gotta test everything bro")

On Low, on test.gofarther.dev with Grok.

**A practice shop, so payments can really go through or be declined.** Stripe's demo shop is broken, and Stripe's other demo (checkout.stripe.dev) turned out to be display-only: its Pay button sends no payment. So I made a small practice checkout page (in the repo as `coder/test/fixtures/practice-shop.html`): one mug, two sticker packs, €19.00. Stripe's test card 4242 goes through and 4000 0000 0000 0002 is declined, with no payment company involved, so nothing can be charged. Its expiry date is two lists (month and year), with name on card and billing postal code, a layout not tried before. Gloopy published it as one of its pages ("Practice Shop"), which gives it a normal web address.

**What worked:**
1. **An order that goes through** (Buy or pay on Ask): the saved Visa filled in all six card fields, including the month and year lists. I pressed Pay on the order card; the page said "Payment successful. Order PS-8411"; the order card changed to **"Paid with Visa ending 4242"**, and Gloopy said so and sent the confirmation screenshot.
2. **A declined card:** a new card typed on the card form (the decline test number, Save unticked). On the order card I pressed Pay; the page said "Your card was declined"; the order card changed to **"Not paid: Your card was declined…"**; Gloopy pressed Pay once and did not try another card. The declined card was not kept.
3. **A purchase started by a schedule:** I had Gloopy set a wake-up for 5 minutes later to buy from the practice shop, with Buy or pay on **Always allow**. When it woke and reached Pay, it still stopped on an order card for your OK ("Waits for you until 02:57"), as runs you didn't start always do. I left it: after 30 minutes it said "Expired: not answered within 30 minutes. Nothing was done."
4. **Scan with camera, at phone size:** the button asks the phone for its back camera; given the test card's picture, it filled in 4242…, 12/34 and the name. (On a phone the camera opens first; that one step needs a phone.)
5. **An expiry date in the past** is refused in Settings: "Type the card's expiry date as MM / YY (it can't be in the past)." So an expired card only happens as time passes, and can't be set up to test today (automated tests cover it).

**Found:**
1. **Gloopy tried to get around a block.** I first asked Gloopy to put the practice page on its own computer and open it there. It chose port 8080, which is its computer's own control panel, so its browser got that panel's "not allowed" answer. Gloopy then tried a public tunnel (cloudflared) to reach the page another way. **The monitor caught it and paused the task:** "Gloopy tried a public cloudflared tunnel to reach the same local shop, bypassing that restriction in a way you didn't ask for." Safety worked as designed. When told, Gloopy stopped its server and didn't try again.
2. **Fixed: Notifications didn't open from Gloopy's tab.** Your account menu's Notifications did nothing when the page was opened straight into Gloopy (only Coder's view listened for it). It now opens from the tab that's showing, in that tab's words ("Gloopy tells you…"). (Test GL147.) Tried after deploying: from Gloopy's tab it opened with "Gloopy tells you…" and "Push when Gloopy decides"; from Coder's tab, one dialog with "Coder tells you…".

**Needs you (can't be done from my test computer):**
- **The order notification on your phone.** No device has notifications on for the test copy, and my test browser can't sign up for them (it can't reach the browsers' notification service). On your phone, open test.gofarther.dev, then your name (bottom left) → Notifications → Turn on for this device. Tell me, and I'll start an order that waits for your OK; leave the chat and the notification "needs your OK to pay" should come.
- **Paying while Gloopy's browser goes through your computer.** My test computer's network checks secure sites with its own certificate, so Gloopy's browser rightly refuses secure pages through it, and every checkout is secure. This needs the desktop app on your computer, built from this branch (a desktop build needs your word).

## 2026-11-13: Paying, the last three paths, and asking for another card (your words: "yes do it on low")

**Fixed first:** once a card was saved, Gloopy couldn't ask you for a different one: if you said "use a new card this time, I'll type it", it still filled in your default card. Now, when you ask for another card (or none of the saved ones fits), the private card form opens set to "Another card". (Test GL146.)

**Tried live after deploying, on Low, in one chat** (Buy or pay on Ask, so each order stopped at its card and I pressed Cancel; Stripe test cards, no real money):
1. **"I'll type a new card myself this time, not my saved one":** with the Test Visa saved, the card form opened on "Another card" (number, expiry, code, Save ticked) instead of filling the Visa in.
2. **"Not now" on that form:** the chat said "Not now: paying €43.94 on stripe-payments-demo.appspot.com", and Gloopy stopped: "I stopped there and did not use a saved card or press Pay another way."
3. **A new card with Save unticked:** it filled in ("Filled into the page", on the card at once), and the Vault still held only the Visa: used once, not kept.
4. **A new card with Save ticked:** it filled in and was kept, with its security code, as "Mastercard ending 4444" (the Visa stayed the default).
5. **"Now pay with the Mastercard I just saved":** it filled in straight from the Vault, with no form, and the order card said "Pay with Mastercard ending 4444".
6. **The fix for Gloopy stopping on "Pressing Pay now" (fix 6 above) worked by itself in that last order:** Gloopy wrote "Pressing Pay once…" with no click, which before would have ended its turn with nothing happening; it was told, and three seconds later said "Pressing Pay now" with the click, and the order card came up.

Then I removed the test Mastercard and put Buy or pay back on Always allow. The Vault holds the Test Visa (default) and the Home contact.

**Still not tried (other tools, or needs you):** a purchase started by a schedule (with tool 8, schedules), paying while Gloopy's browser runs through your computer (needs your computer), a declined card or an order that goes through (the demo shop is broken), and the camera scan and the order notification (need your phone).

## 2026-11-13: Gloopy, tool by tool: where we are (your words: "note that real quick")

**Done (3 of the list):** 1 browser, 2 sign_in, and now **3 pay**: built like Grok Bot's and tested live completely (11 fixes found and made along the way; details in the three paying entries below).
- Pay, not tried live: a declined card and an order that goes through (the Stripe demo's server is broken; a free Stripe test account of yours would give a working test checkout), and "Scan with camera" and the order notification (they need your phone).
- From now on, live tests run with Gloopy on **Low** (your word: it was burning usage). Saved in your preferences.

**Next: 4, handoff.** Then 5 web search, 6 web_fetch, 7 helpers, 8 schedule, 9 webhook, 10 ask_user, 11 notify, 12 todo, 13 page, 14 files, 15 request_secret, 16 bash, 17 to 21 read, write, edit, grep and glob, and 22 to 23 monitor and stop_job.

## 2026-11-13: Paying, the rest tested live (your words: "yes test everything", "please do it on low")

The parts of paying not yet tried live, on test.gofarther.dev with Grok. From halfway through, Gloopy's chat runs on **Low** (your word: it was burning usage). Every test before that ran on High; the quick safety checks always run on Low.

**What worked:**
- **A photo with no card:** "No card number could be read from that photo. Try a sharper photo, closer and in good light, or type the card." Nothing filled in.
- **Typing a card in Settings** (a Mastercard test number, nickname "Work card", hint "Use for work orders"): saved, "Fills in without asking", and the Visa stayed the default.
- **Editing contact info in Settings** (a new email and a hint): "Saved."
- **Asking Gloopy in the chat** to add a phone to the Home contact, and to rename the Work card "Office card" with the hint "only for office supplies": both done, and Settings shows them.
- **Two saved cards:** for an order said to be office supplies, Gloopy picked the Office card by its hint ("It's office supplies, so I'll fill the Office card"); the order card said "Pay with Mastercard ending 4444". Cancel stopped it.
- **Changing the default** in Settings moved "Default" from the Visa to the Office card. In the next order (not office supplies), Gloopy still used the Visa, because the Office card's hint says "only for office supplies". Following the hint over the default is right.
- **A saved card with its code forgotten** (Settings: "Forget its security code"): the card form opened with that card picked and asked only for the security code. Typing just the code filled the card in ("Filled into the page", on the card at once), and Gloopy went on to the order card ("Pay with Mastercard ending 4444"), where I pressed Cancel.
- **The card form's "Another card"** shows the number boxes with "Save to your Vault, so next time Gloopy fills it in without asking you" already ticked.
- **Removing cards and the first card:** I removed both cards in Settings; with none left, the new card form had "Default payment method" already ticked, and the Test Visa came back as "Default · Fills in without asking".
- **A form that can't fill:** I moved Gloopy's browser to another site (Take over, then a new address, then Hand it back) before filling in the code. It said "Could not fill into the page: the browser is not on stripe-payments-demo.appspot.com any more (it is on example.com), so nothing was typed." Gloopy said the card never went in, looked where its browser was, and didn't pay another way.
- **"Share your details" on Never:** Gloopy couldn't tell the Home address, and its one try to save a new address was refused by the Vault. It said so, and nothing was saved.
- **Phone size:** the Vault, its New item menu, the new card form and the order card all fit (after fixes 2 and 3 below, checked again on the deployed page).

**Found and fixed:**
1. **"Could not fill into the page" showed only after reloading the page.** The open page never got the form's result (nor "Filled into the page" after typing a card or a sign-in). The answer to a form now carries its result, and the card shows it at once. (Test GL144.)
2. **At phone size, the chat scrolled sideways a little:** a long step line (a helper's "“Rome population” · Searched the web for") pushed its ✓ off the screen. Long step lines now end in "…".
3. **At phone size in the Vault,** the "Fills in without asking" tag broke over two lines, and the search box pushed "Contact info" onto a second row. Tags now stay whole, and on a phone the search has its own row under the three tabs.
4. **Gloopy went by an old answer instead of your current settings.** After I put "Share your personal details" back to Always allow, Gloopy refused the next order, saying sharing was turned off, as it had said one message before. A setting you change is now said to Gloopy at the start of its next message ("the owner changed your settings since your last message: Share your personal details is now Always allow. Go by your settings as they are now"), once. (Test GL145.) Tried after deploying: I turned sharing off and on again, and Gloopy went ahead with the order this time.

**Left as it was before the tests:** Buy or pay and Share your personal details on Always allow; in the Vault, the Test Visa (Stripe's 4242 test card, default) and the Home contact (Stripe's sample name, now with a test phone and email). Gloopy's chat is on **Low** (your word). The Office card is removed.

**Still can't be tried here:** a declined card or an order that goes through (the demo's server is broken), and "Scan with camera" and the order notification on your phone.

## 2026-11-13: Paying with a saved card, tried live, and seven fixes (your words: "yes if dots and bot have it do it pls")

Tried on test.gofarther.dev with Grok, on Stripe's test-mode demo shop (test cards only, no real money).

**What worked:**
1. **A card from a photo.** New item → Card → Upload a photo, with a picture of a test card: Grok read it and filled in the number (4242…), the expiry (12/34) and the name. Nothing was saved until Save card; I cancelled it.
2. **Contact info in the Vault** (New item → Contact info): saved, and shown on the Contact info tab.
3. **A whole checkout with Buy or pay on Ask.** Gloopy filled in the shipping details from the Home contact info, then filled in the saved Visa ending 4242 straight from the Vault, with no card form. The order card showed the items, Ship to, Pay with "Visa ending 4242", the Total €39.95, and Cancel / Pay €39.95. I pressed Pay. The demo stayed on "Processing…" (its own server is broken, as before), so Gloopy marked it "Not paid", with a screenshot, and did not press Pay again.
4. **An address given in the chat.** I gave Gloopy a work address; it saved it in the Vault as "Work" and said so.

**Found and fixed:**
1. **The safety check guessed whose address it was, wrongly.** It said the order "would ship to Jenny Rosen's demo address, not your Vault contact info", but it was the Home address from the Vault (the test contact uses the same sample name as Stripe's demo, which made the guess easy to get wrong). The check was never given your contact info. Gloopy was told what the check said, you weren't shown it, and Gloopy then mentioned "the confirm card" in its answer. Now the check (and the monitor) are given your contact info, only when "Share your details" isn't Never, and are told never to guess whose details a form holds.
2. **The order card now shows what the check said,** in a smaller line under Gloopy's reason, so you see what Gloopy is told.
3. **The line over the steps said "asked you for a card"** when the saved card filled itself in, and when Gloopy was only saying how the order went. It now says "filled in your saved card" and "said how the order went". A Vault save said "Did 1 step"; it now says "Updated your Vault".
4. **"Not paid" was said twice:** on the order card, and again on a line under it. Now once, on the order card. Without an order card (Buy or pay on Always allow), the line still shows.
5. **Gloopy kept the work address twice:** in the Vault, and in its own notes. An older instruction (2026-11-10) told it to keep addresses in its notes, so an address you removed from the Vault would have stayed there. Now addresses, phone numbers and emails are kept only in the Vault; any left in its notes from before move to the Vault when they next come up.

**Tried again after deploying the fixes:**
- The same chat, reloaded: the lines now say "filled in your saved card", "said how the order went" and "Updated your Vault", and "Not paid" shows once.
- A new checkout: the check now says "This would place the order and pay €21.97." (no wrong guess about the address), shown on the order card under Gloopy's reason. I pressed **Cancel**: the card says "Cancelled. Nothing was charged.", and Gloopy said it did not press Pay and would not try another way.
- Gloopy's notes: I asked it to take out the old test address (from 2026-11-10) and the Work address it had copied there; it did, and its notes now hold no contact details.

**One more found, and fixed:**
6. **Gloopy said "Pressing Pay once now. … You'll get a card to confirm" and then stopped,** without pressing anything, so no card came. Grok wrote the line but left out the click, and an answer with no step ends Gloopy's turn. Now (a) its instructions say a line about a step goes with that step, and never to end on a step not taken, and (b) once a turn, if its last words announce a step it didn't take, Gloopy's app tells it so and it carries on. This can't be made to happen on purpose, so it is tested with Grok's exact words from this run (GL143). I also checked it against all 109 answers Gloopy has ended a turn with in the live chat so far: it picks out the 2 that stopped short (this one, and "I'll read the Output…" from the security-key test on 2026-11-12) and none of the others.

**The last run, after deploying fix 6,** with Buy or pay back on Always allow: Gloopy filled in the shipping details and the saved card, pressed Pay itself (no card, as set), waited, saw the demo stuck on "Processing…", and recorded "Not paid", start to end with no stall. The line it added to its notes names the Home contact and "saved Visa 4242", with no address in it.

**And one more found in that run, and fixed:**
7. **A cancelled order's card got mixed up with the next order.** The new order (no order card, since it was Always allow) had no "Not paid" line, and the earlier cancelled order's card showed the new order's "Not paid". Each order's card and line now keep to that order: an order runs from the card filled in for it to the next one.

**Small, left as is:** Gloopy can read its notes file, but searching its notes folder is refused ("outside the project"). It just read the file instead.

**Still can't be tried:** a declined card, and an order that goes through. The demo's server fails on every payment, and no other free test shop without sign-up was found.

Tests: GL142 and GL143 (new), plus GL48, GL80 and CD236 updated.

## 2026-11-13: Paying, built like Grok Bot's (your words: "yes if dots and bot have it do it pls")

dots' docs say nothing about paying, so this follows Grok Bot's docs (its Vault and its order card).

**Built:**
1. **Cards in Settings → Vault.** The Vault now has three tabs, Logins, Cards and Contact info, and New item offers Login, Card, Contact info and Import. Each card shows its name, last 4 digits, expiry, nickname and hints, "Default" on your default card, and whether it fills in without asking. You can add one, edit it (expiry, security code, name, nickname, hints, default) or remove it. To change a card's number, remove it and add it again, as in Grok Bot.
2. **A card from a photo.** New item → Card has "Scan with camera" and "Upload a photo". The photo is read once to fill the form; you check it, type the security code, and save. The photo isn't kept, and Gloopy never sees it.
3. **A saved card fills in without the form.** This is the big change. Like Grok Bot, a saved card now keeps its security code, sealed. When Gloopy reaches a checkout, it uses the card you named, else your default card, else your only card, and fills it in straight from your Vault without asking you. Gloopy still never sees the number or the code. You see a card in the chat: "Gloopy filled your saved Visa ending 4242 into the payment form… Filled into the page. Secret values were never shown to Gloopy." If no saved card fits, or one has no code saved on a page that asks for one, the card form appears as before.
   - **To approve every payment yourself:** keep Buy or pay on Ask (Permissions). Then the order card always asks before paying. Grok Bot's own advice is to not save the card; that works here too.
   - The card form's "Save to your Vault" box is now ticked by default, as Grok Bot's is. Untick it to use a card just once.
   - The first card you save becomes your default.
4. **The order card.** With Buy or pay on Ask, placing the order waits on a card showing the store, the items, Ship to, Pay with, the Total, and two buttons, **Pay €72.00** and **Cancel**. Afterwards it shows "Paid with Visa ending 4242", "Not paid", or "Cancelled. Nothing was charged."
5. **A receipt line.** After placing an order, Gloopy says how it went: "Paid €72.00 on shop.example with Visa ending 4242", or "Not paid", with what the page said.
6. **"Filled into the page" or "Could not fill into the page"** now appears on every private form after you use it, for cards and sign-ins alike.
7. **Contact info.** Settings → Vault → Contact info holds names, addresses, phones and emails. Gloopy can see it, as Grok Bot's can, and uses it for shipping and billing. When you give Gloopy details in a chat, it saves them and tells you. It can also change them, or a card's nickname and hints, when you ask. With "Share your details" on Never, Gloopy isn't given your contact info and won't save any.
8. **Gloopy never sees a card's number, code or expiry date,** only its name, last 4 digits, nickname, hints, whether it's the default, and whether it has expired.

**Not built:**
- **Wallets** (Link, X Money, Shop Pay) and Link's one-time cards: these need accounts and agreements with those companies.
- **Batches of up to 500 payments under one OK:** a business feature, and the practice shop can't finish even one payment.
- **"Save to Vault" when you attach a photo of a card in the chat:** Gloopy would see the photo first. Use New item → Card → Upload a photo instead.

Tests GL139, GL140, GL141, plus older tests updated (GL51, GL52, GL54, GL55, GL105, GL112, GL130, GL132).

## 2026-11-13: For the Coder session: a message can get stuck the same way Gloopy's did (your words: "note coder i will let the other session know")

Not changed here (you said to leave Coder to the other session).

**The problem:** Coder's chats start a message the same way Gloopy's did before today's fix (`coder/src/coder-routes.mjs`, the `action === "message"` part of `handleCoder`, from "Coder is still working on the last message" down to `post("/turn", …)`):
1. It checks the chat isn't working.
2. It summarizes a long chat (this can take a while).
3. It marks the chat working and asks Coder's machine to start.

Two copies of a message (a browser sends one again when its connection drops), or two messages at once, can both pass step 1. The second machine start then answers "busy", and its `notStarted()` puts the chat back as it was before. That wipes out the start that did begin, so its work never shows up in the chat. And if the page closes half-way, the start is cut off.

**How Gloopy's was fixed** (commits d244e08 and bcb84f8 on `claude/keen-goodall-8ghmph`; test GL137 in `coder/test/gloopy.test.mjs`):
- The page sends each message with its own id (`mid`; already sent for Coder's chats too, but ignored there).
- The chat is marked as starting first (`claimStart`); a second copy of the same message waits for the first (`sameMessage`); another message is told the chat is busy.
- A failed start puts the chat back only while it is still its own (`release`), never over a newer one.
- Before summarizing a long chat, it waits a moment (`START_SETTLE_MS`) so only one start makes the summary.
- The machine takes the same start twice as one (`start` in `/turn`, `container/server.mjs`; already shared with Coder's machine).
- The work goes on for up to 30 seconds after the page closes (`ctx.waitUntil`).
- A start cut off half-way is undone after 6 minutes, with a note quoting the message (`gloopyState`).

## 2026-11-13: Paying (tool 3): tried live, and seven fixes (your words: "Ok lets start testing that tool", "U do it")

**Tried live on test.gofarther.dev,** on Stripe's test-mode demo store with test card numbers only (no real money):
- Gloopy filled in the shipping details, then asked for a card on the private card form ("Pay €43.94 on stripe-payments-demo.appspot.com"). The form said where the card goes: the page's card fields, which come from js.stripe.com.
- **Typing the 4242 test card on the form:** it went into the page's card fields. The number never showed in the chat and never reached Gloopy. With "save" ticked, it was kept as "Visa ending 4242".
- **The next time,** the form offered "Visa ending 4242, 12/34" first, with "Another card" below. Typing only the security code filled it in.
- Gloopy pressed Pay once each time and never pressed it again.
- The demo store itself never finished: it stayed on "Processing…" both times. That's the store's own server, not Gloopy. Gloopy said so and sent a screenshot.

**Fixed:**
1. **Gloopy thought the card area was blocked.** Its screenshots cover card fields with grey boxes, so it never sees a card. It took the boxes for something in the way and gave up instead of asking for the card. It's now told what they are. (Test GL53.)
2. **After the saved card was used, Gloopy didn't carry on.** The card went in, but the message after it ("Gave my card…") came back "Gloopy is still working on the last message". The failed start then put the chat back over the start before it, so the turn was lost, and I had to tell Gloopy "go on". Now:
   - **One message starts at a time.** The chat is marked as starting before the slow part (summarizing a long chat), so another message sent meanwhile is told at once that Gloopy is busy.
   - **The same message sent twice starts once.** A browser sends a message again when its connection drops; both copies now get the same answer.
   - **A start that fails puts the chat back only if nothing newer happened.**
   - **Gloopy's computer takes the same start twice as one**, instead of saying "busy".
   - **A card you've answered stays closed,** even if the message after it fails. Before, it looked open again.
   - (Test GL137.) Coder's own chats start messages the same way and could hit the same race. They're not changed yet.

**Tried live after deploying fix 2:**
- **The same message sent twice at the same moment** (as a browser does): Gloopy started it once and answered once ("7 times 6 is 42.").
- **Two different messages at the same moment:** one started ("banana"). The other was told "This message didn't start: Gloopy was stopped, or another message started first. Send it again if you still want it."
- **Buy or pay on Ask:** after the saved card's security code, Gloopy carried on by itself (no "go on" needed). Before pressing Pay it asked on a card: "Gloopy wants to click the button 'Pay €35.95' … This spends money … What it sends" (the shipping details). I pressed **Deny**. Gloopy: "The order was not placed. You said no to Pay €35.95, so I stopped and did not try another way."
- **Buy or pay on Never:** no card form. Gloopy: "Paying is turned off in Gloopy's settings, so I can't use the card form, and I won't try another way."
- **Asking Gloopy to read the card boxes:** "Both boxes are hidden from me. The card number and the security code show only as masked dots, covered by grey boxes, so I can't read either one and I won't guess."
- **A start cut off half-way:** my test computer restarted while the message after a card was starting. The chat showed Gloopy working, then, 6 minutes later, "Your last message didn't reach Gloopy: sending it stopped half-way. Send it again." The card above it stayed closed. After I sent it again, Gloopy knew the card was in and pressed Pay once.
- **Why the demo store never finishes:** its own server fails to start each payment (an error 500 as the page loads), in any browser. So no order can finish there, and **a declined card can't be tried on it**. I found no other free test checkout that doesn't need making an account first.

**Fixed after those tries:**
3. **Both copies of one message made the summary of a long chat,** so it was paid for twice and said twice in the chat. Now only one makes it.
4. **A start, or a card's answer, cut off when the page goes away** (a phone locking, a tab closing). Now it goes on for up to 30 seconds after the page has gone, which is enough for a normal start.
5. **"Didn't reach Gloopy" now says which message,** e.g. "Your last message (“Gave my card (Visa ending 4242) to pay €43.94 …”) didn't reach Gloopy".
6. **The "What it sends" list named the country as "Country Australia Austria Belgium Brazil Canada China Denmar…"**: the label around the drop-down read all its choices. A field is now named by its label's own words (also in a part of the page you mark). (Test GL138.)
7. **With Buy or pay on Never, Gloopy opened the shop and typed your address in first,** and only learned it couldn't pay at the card. It's now told to say so before starting, and to do the rest only if you still want it.

**Tried live after deploying 3 to 7** (the first deploy stopped on an error at Fly's image store; the second went through):
- **A message whose page went away 0.3 seconds after sending:** Gloopy still started it and answered ("cherry").
- **Never, said before starting:** "The order was not placed. Buying and paying are turned off in Gloopy's settings, so I can't use your saved card or press Pay, and I won't try another way." It didn't open the shop.
- **The OK card before Pay** now lists "Country: United States". After the security code, Gloopy again carried on by itself.
- **The same message twice at the same moment:** started once ("9 times 8 is 72."). The chat didn't need a summary this time, so fix 3 was only checked by its test (GL137).

Buy or pay is back on Always allow (for testing). The 4242 test card is still saved on the test copy, for the next pay work.

## 2026-11-12: Gloopy, tool by tool: where we are

**Done (2 of the list):**
1. **browser**, Gloopy's own web browser. Checked against Grok Bot's and dots' docs twice, everything built, tried live on the test copy, and tried hands-on next to Grok Bot's app.
   - Left: a fixed outgoing address (costs money: waits for your word); a full desktop with "computer use".
2. **sign_in**, signing in to websites (the private card, saved logins in your Vault, warnings, Take over). Checked against both docs, built, tried live, and tried side by side in Grok Bot's app.
   - Not tried live: a password Gloopy makes for a new account, and the code box (my safety check blocked both; automated tests cover them); your real security key (needs the Mac or Windows app rebuilt); Grok Bot's answer to the Show test (your Grok Bot usage ran out).

**Next: 3, pay.** Then 4 handoff, 5 web search, 6 web_fetch, 7 helpers, 8 schedule, 9 webhook, 10 ask_user, 11 notify, 12 todo, 13 page, 14 files, 15 request_secret, 16 bash, 17 to 21 read, write, edit, grep and glob, and 22 to 23 monitor and stop_job.

## 2026-11-12: Signing in, side by side with Grok Bot's own app (your words: "yes go ahead")

**How:** Grok Bot's desktop app on my test computer, signed in with your link, in the "Browser test (Claude)" Bot (your other Bots untouched). The same practice sites as Gloopy's tests.

**What I found, Grok Bot next to Gloopy:**
- **The sign-in request.** Grok Bot puts a small row in the chat ("Sign in to The Internet practice site · Opens a secure form · Open"), and its form opens in a pop-up window. Gloopy shows the whole form in the chat.
- **The form.** Grok Bot's has "Email or username", "Password" with an eye, "Securely save to Bot's vault" (ticked), Submit and ×. It doesn't show the site's address, warn about anything, or offer "Not now" or "Take over". Gloopy's card names the site, warns when the page isn't secure or doesn't look like the real one, and has Not now, Take over and Sign in.
- **Saving.** Grok Bot saved the login to its Vault first, then typed it from the Vault. Gloopy saves only once the sign-in has worked. Both signed in ("You logged into a secure area!").
- **Using the saved login again.** Grok Bot failed twice. First its Login click "did nothing". Then the site said "Your username is invalid!", though its Vault had the right username, and Grok Bot wrongly said the saved entry "may have been changed". Gloopy signed in with its saved login with no card, earlier today.
- **A saved login that didn't work.** Both show the form again and say so. Grok Bot retried the same saved login by itself. Gloopy now leaves it alone for half an hour.
- **A plain http page.** Grok Bot warned in the chat that what you type goes "over the network unencrypted", and **its Vault won't type a saved login on an http page** ("It only fills logins on secure https pages"). It handed you its screen instead. Gloopy's card warns too, but **Gloopy would have typed a saved login there.** Fixed, below.
- **A page that isn't a real sign-in** (the GOV.UK password demo). Gloopy's card warned "this is a password-box demo, not a sign-in page". Grok Bot's form didn't warn.
- **The Show button.** Grok Bot said up front it wouldn't read the password back, by its own rule. Gloopy now can't see it at all (covered), and is told not to guess.
- **Grok Bot also remembers a login per chat.** It first tried "the login you gave me earlier, which is still kept for this chat". Gloopy keeps logins only in your Vault.
- **Your Grok Bot usage:** Settings → Usage & Billing showed your trial at 90% used, ending in 17 days. These tests used the rest: Grok Bot now says "You are out of usage", so its last answer (after Show) never came. I've stopped using it.

**Fixed in Gloopy:**
1. **A saved login is typed only on a secure (https) page,** as Grok Bot's Vault does. On a plain http page, Gloopy doesn't use it, the card doesn't offer it, and Gloopy's computer refuses it even if asked. The card, with its warning, is shown instead, and Gloopy is told why. (This computer's own address counts as secure, as browsers count it.)
2. **Which site a box belongs to comes from the browser, never from the page.** A page's own script can change what it says its address is, and so make the card name another site. Found while making fix 1.

Test GL136 (in a real browser: a page claiming to be another site; a plain http page refused a saved login, but taking what you type on the card).

**Tried live on test.gofarther.dev after deploying:** with the practice login saved in Gloopy's Vault, "Sign in to http://the-internet.herokuapp.com/login" brought the card with the red "This page isn't secure" warning. The saved login wasn't typed, and the card didn't offer it. Then on https, Gloopy signed in by itself with the saved login ("You logged into a secure area!"). Afterwards I removed the login and signed Gloopy out; every setting is Always allow, with no rules or sites.

**Also tried live, for the first time:** the card's **"Use your saved login"** button (saved logins set to Ask). The card offered "Use your saved login · Practice account (tomsmith)". Pressing it signed Gloopy in ("Signed in … with my saved login", then "You logged into a secure area!"). Gloopy's opening line still wrongly said saved logins were off, carried over from earlier in this long test chat. Put back afterwards: Always allow, Vault empty, signed out.

**Note:** a deploy of `main` (run 156, started 14:54 from your account, maybe by another session) was running at the same time. It doesn't touch the test copy: the main site's machines and the test copy's are separate (gofarther-coder-machines and gofarther-coder-test-machines on Fly.io, each with its own image). So the test copy still runs this branch.

## 2026-11-12: Signing in, the rest tested live, and what it found fixed (your words: "test everything")

**Tried live on test.gofarther.dev, with Grok, and recorded:**
- **The red warning:** on the practice login page over plain http, the card said "This page isn't secure (its address starts with http://): what you type could be seen by others." After **Not now**, Gloopy said it couldn't sign in because I chose not to, and didn't try another way.
- **Grok's look at the page warned too:** on the GOV.UK design system's password demo, the card said "this is a password-box demo, not a sign-in page, so do not type your password there".
- **Take over on the card:** it opened Gloopy's browser with control ("Do only this: Sign in to the-internet.herokuapp.com"). I signed in myself with the site's public demo login and pressed **Done, hand it back**. The card said "Signed in … myself", Gloopy checked the page ("You logged into a secure area!"), and Settings → Computer said "You signed in yourself".
- **Saved logins on Never:** the card had no "Use your saved login" button, and nothing was signed in for me.
- **A saved login that no longer works:** the card came back saying "Your saved login … didn't work". **This found a bug, below.**
- **The password after a page's Show button:** **this found a bug, below.**
- **Not tried, stopped by my own safety check** (it calls them real-world transactions, and I didn't work around it):
  - a password Gloopy makes for a new account (practice.expandtesting.com's sign-up page);
  - the code box (that site's demo sign-in emails a code).
  - Automated tests do both in a real browser: GL129 and GL71. You could try them yourself, or allow them for me in this session's settings.
- **Your real security key** still needs the Mac or Windows app rebuilt (you said not now).

**Found live and fixed:**
1. **A saved login that didn't work made the card useless, again and again.** Each card first tried the saved login again. Each failed try made the site load its sign-in form again, so the password I typed on the card had nowhere to go ("the password field moved"). Gloopy asked a third time, and would have kept on. On a real site, repeated failed tries can also lock your account.
   - A saved login that didn't work is now not tried again for half an hour, or until you sign in on the card.
   - The card finds the site's sign-in form again if the page reloaded it. It only does this on the same site, and only when there's exactly one password box; it never guesses.
2. **The password showed in Gloopy's screenshots.** After I typed a dummy password on the card, Gloopy pressed the page's Show button and told me the password. What Gloopy reads as text had it blanked, but every step also gives Gloopy a picture of the page, and only card fields were covered in it. Now a box a password was typed into is covered in every picture Gloopy gets, and so is any text on the page that repeats it. Your own live view still shows the page as it is.
3. **An empty username box on the card no longer clears the username Gloopy already typed** on the page.
4. **Asking for a saved login where none is saved** now just brings the card. Before, the chat showed a failed step ("a sign-in failed") first.
5. **With saved logins on Never, Gloopy is told they're off.** The card's reason no longer says "with the saved practice account".

Tests GL134 (in a real browser: the form found again, the username kept, the password covered in the picture) and GL135 (end to end through the Worker and Gloopy's computer: one card, signed in at the first try, the saved login replaced, and a failed saved login not tried again). I checked that both fail without the fixes.

**Tried again live after the fixes:**
- **The broken saved login:** one card ("Your saved login … didn't work"). My sign-in on it went through at the first try ("You logged into a secure area!"). Then I signed Gloopy out and asked again, and it signed in by itself with the saved login, with no card: the card had replaced the wrong password in the Vault.
- **The Show button:** Gloopy now gets "••••••" for the box, and a grey box over it in its picture. It couldn't read the new password, but it answered with the old one from earlier in the chat. So Gloopy is now also told what "••••••" means: hidden from it even when the page shows it, never to be guessed, and to say so if you ask.
- **The Show button, after that was deployed too:** Gloopy said "I can't tell you what the Password box shows. It's hidden from me, covered by a grey box, and I won't guess it." The password I typed is nowhere in the chat.
- **Saved logins on Never:** asked "can you use my saved login right now?", Gloopy said "No. Signing in with saved logins is turned off in Gloopy's settings". The card offered no saved login. Its reason line still said "with the saved practice account" once, copied from the earlier chat.
- **Put back afterwards:** the Vault is empty, Gloopy isn't signed in anywhere, every kind of step is Always allow, and there are no rules or sites. I checked in Settings.
- One unrelated test (GL122, the live view's tabs) failed once in a full run and passed on its own and in a full rerun: a timing hiccup under load, not these changes.

## 2026-11-12: Gloopy's Settings laid out like Grok Bot's (your words: "yes make the menu like grok bot , very similar")

- **A menu down the left**, as Grok Bot's Settings: **Permissions**, **Sites**, **Vault** and **Computer**, each with an icon, the open one on a grey pill. It opens on the page you had open last (Permissions the first time).
- **Each page as Grok Bot's:** its title at the top, small grey labels over white cards, and **×** in the top right corner. In each row, the name and a line about it sit on the left and the control on the right. The colours are Grok Bot's own greys, its blue switch and its black and grey buttons.
  - **Permissions:** "Watch over each run" is a card at the top with a blue switch, where Grok Bot puts its Approvals card. Each kind of step under "What Gloopy may do on its own" has a small drop-down (Ask, Always allow, Never), like Grok Bot's "Follow System ⌄". A Never shows in red. Your rules sit under their kind (Ask first, Always allow, Never, Hand off to me, Only when I ask), each with its own grey **Add rule** button, as Grok Bot's "Always Ask" and "Allow without Asking" have.
  - **Sites:** your sites in a card, each with its drop-down and Remove, and **Add site** opens the form. What each choice means is in a small grey note under it.
  - **Vault:** the title with the black **New item** button on its right, as Grok Bot's. The logins are in a white card.
  - **Computer:** where Gloopy's browser is signed in (Sign out for each site), and "Through your own computer" (a blue switch in the Mac and Windows app).
- **On a phone** it slides up from the bottom, and the menu is one row of tabs along the top, beside ×.
- Gloopy's note about secure sites while its browser goes through your computer now says "Settings → Computer" (that switch moved there).
- Test GL133 opens the real Settings in a browser and clicks through it: the four pages, a drop-down saving its choice, Add rule under Never, ×, reopening on the last page, and the phone layout. GL105, GL106, GL112, GL115, GL116 and GL130 were updated for the new layout.
- **Tried live on test.gofarther.dev, with Grok, and recorded:**
  - All four pages opened from the menu, each with its title, and × closed Settings.
  - **The drop-downs saved:** "Delete or cancel" set to Ask, and "Share your personal details" to Never, which showed in red.
  - **Add rule** under Never opened its form with the example "delete anything in my email". The rule saved under Never, and the form closed.
  - **Add site:** example.com set to Never on the Sites page. Then I asked Gloopy (Grok) "Open example.com in your browser and tell me the page's title". It answered "example.com is turned off in Gloopy's settings, so I can't open it or get the title another way."
  - Settings opened again on the last page I had open (Sites).
  - **At a phone's size:** the four tabs fit in one row next to ×. Nothing scrolled sideways on any page.
  - **Put back afterwards:** example.com and the test rule are removed, and every kind of step is Always allow again. I checked after reopening Settings.
  - **Found live and fixed:** the grey scrollbar ran up beside × (now thin and light, as on a Mac). Rules sat level with their kind (now indented under it). On a phone, the line under the tabs stopped short of × (now it runs the full width).

## 2026-11-12: Signing in, all five built, with Grok Bot's look (your words: "do all 5 make sure you do similar frontend compare to grok bot pls")

- **A Vault in Gloopy's Settings, like Grok Bot's Settings → Vault.** It has a dark "New item" button with **Login** and **Import from CSV…** (Grok Bot's words), a **Logins** tab with **Search Vault**, and the list. Each login shows its website and username, its hint, and "Password made by Gloopy" when Gloopy made it. **Edit** changes the website, username, password (leave it empty to keep the saved one) and hint. **Remove** asks "Remove for good?" first. Grok Bot's note sits under it, in Gloopy's words: Gloopy never sees a saved password. The old "Saved logins" list under Browser moved here. Cards will join the Vault, as Grok Bot's Payments, with the payment tool.
  1. **Add and edit logins yourself:** Website, Username or email, Password (with an eye to show it) and Hints, then **Save login**. A website can be typed as a name or an address: "https://www.github.com/login" is kept as github.com. A login for amazon.com is also the one for www.amazon.com, as password managers match them.
  2. **Bring your logins over:** choose the CSV file you export from 1Password, Chrome or Edge, Safari or Apple Passwords, Firefox, Bitwarden or LastPass. It's read on your device; the file itself is never uploaded. A review list shows each row as Ready, Already in your Vault, Twice in the file, or why it can't come in (no website, not a secure https one, no password). Bitwarden's and LastPass's notes are left out. Then **Import N logins**, and a reminder to delete the export, since it holds your passwords unencrypted. The Vault now holds up to 1,000 logins (it was 50).
  3. **Several accounts on one site:** each login can have a hint, like "Use for work". Gloopy is told each site's usernames and hints (never a password) and names the one that fits. With your setting on Always allow, that one is used with no card. When Gloopy can't tell, or your setting is Ask, the sign-in card has a button for each saved login, its hint under it.
  4. **Passwords made for new sign-ups:** when Gloopy creates an account you asked for, it types the account's details itself. Then its computer makes a strong 20-character password, keeps it in your Vault first so it's never lost, and types it into the form's password and confirm boxes. Gloopy never sees it. Nothing is sent: pressing "Create account" is checked like any sign-up. It never happens while "Sign up or subscribe" is Never. The chat says "Made a password for … and saved it to your Vault".
  5. **Your own browser leaves the card alone:** the card's password box is now plain text drawn as dots, so your browser's password manager doesn't treat it as a site's login: no "found in a data breach" warning, and no offer to save it. 1Password, LastPass and Bitwarden are asked to leave it alone too. An eye shows what you typed, as in Grok Bot's form. The box says "Save to your Vault" and starts ticked, as Grok Bot's does (your word); untick it to keep a login out.
- **Then, after checking the build against the docs again** (your words: "yes do 1 and 2, tick the box too"):
  - **Nicknames:** a login can have a nickname, like "Work GitHub", shown as its title in the Vault and on the card's button.
  - **Gloopy changes a login's nickname or hints when you ask**, as Grok Bot's Bots do ("A Bot can change … an entry's nickname and hints, when you ask"). Ask it "call my work GitHub login Work GitHub" or "use that one for work". Passwords, usernames and websites still change only in Settings → Vault, and logins are removed only there; Gloopy says so if you ask for that. The chat shows "Changed the nickname of your github.com login". Gloopy can also name a login by its nickname when signing in.
  - The menu says **Import from CSV…** and the card's save box starts ticked, as Grok Bot's.
  - Test GL132.
- **Also:** any password Gloopy's computer typed (yours, or a made one) is now blanked from what Gloopy reads, even when a page's "show password" turns it into plain text.
- **Tried live on test.gofarther.dev, with Grok, and recorded:**
  - **The Vault:** New item opened its menu (Login, Import from CSV…). The Login form, with the eye, saved "Practice account" (tomsmith, the practice site's public demo login). A second account on the same site, "Old account", went in next to it.
  - **Import:** a sample export in Chrome's layout showed "2 ready · 1 already in your Vault (skipped) · 2 can't be imported" (an http router address, and a row with no password). "Import 2 logins" brought them in, with the reminder to delete the export. Search Vault found "shop", and Edit opened the login's form in place.
  - **Found and fixed:** each login's key, names and Edit/Remove buttons stacked on separate lines. Each login is now one row.
  - **Several accounts:** "Sign in to the practice site with my practice account": Gloopy picked tomsmith by its nickname and signed in with the saved login, with no card. The page said "You logged into a secure area!".
  - **The card:** with saved logins set to Ask, "Sign in to the practice site" brought the card with both accounts by nickname, each with its hint, Gloopy's pick first. The save box was ticked.
  - **Your browser leaves it alone:** I typed the demo password into the card myself. It showed as dots in a plain text box, the eye showed it, and I signed in from the card. Chrome showed no "Change your password" warning and no "Save password?". It showed that warning on Nov 11 for the same password.
  - **Gloopy's Vault changes:** "Rename my old practice login to Retired account, and change its hint" brought the chat line "Changed the nickname and hints of your the-internet.herokuapp.com login", and the Vault showed it. Asked to change the password, Gloopy said a saved login's password can only be changed in Settings → Vault.
  - **Not tried live: a made password for a real sign-up.** My safety check stopped me from creating an account on a public practice site (practice.expandtesting.com). The automated test GL129 does it end to end in a real browser, on a practice sign-up page of its own. It can be tried live with your OK.
- Tests GL127 to GL131; GL10, GL47, GL48, GL69, GL70 and the card and Settings checks updated. GL129 makes an account on a practice sign-up page in a real browser: the site got the same password twice, the Vault kept it, and nothing sent to Grok held it.

## 2026-11-12: Tool 2, signing in (sign_in), checked against Grok Bot's and dots' docs (your words: "lets go to the next tool")

**The check:** both apps' docs were fetched fresh today: 76 of the 78 pages from the last check, plus the 10 new ones. The 2 missing pages were Grok Bot's "shared bots", now "team bots". The new pages are about team Bots, meetings, Microsoft Teams, Grok Bot's initiative, X subscriptions, and Okta FastPass. Okta FastPass is the only one about signing in, and it's for company Okta admins. Every passage about signing in was compared with Gloopy's sign-in card, its saved logins and its code card.

**Already the same as both:**
- A private card in the chat when a site needs your password. What you type goes straight into the page, and Gloopy never sees it (Grok Bot's Secure Form, dots' private sign-in form). The card names the site. Gloopy also checks that the page is the real one and warns you if not; dots only tells you to "check the site address".
- A code the site sent you, typed on a card the same way.
- Take over to sign in yourself, and handing you what a form can't do: single sign-on, a passkey, a CAPTCHA, an approval on another device, a QR code.
- "Save this login" is optional, a tick box on the card, as dots' "Save to Passwords" and Grok Bot's "Securely save to Bot's vault".
- Using a saved login is your setting. dots always asks first ("Reusing a saved login to sign in requires your confirmation"). Grok Bot uses it first, without asking. Gloopy's "Sign in with saved logins" can be Ask, Always allow or Never.
- Gloopy stays signed in between jobs, and you can sign it out in Settings → Browser.
- Your phone's or laptop's passkeys don't reach the cloud browser, but a hardware security key does, through the desktop app (Grok Bot's).
- If a site asks to verify again, Gloopy stops and tells you, and never works around it. Changing a password is yours to do (dots).
- Gloopy knows which sites you saved logins for, never the passwords (Grok Bot's Bots do too).

**Missing in Gloopy (your choice):**
1. **Add and edit logins yourself, in Settings.** Grok Bot's Vault has "New item → Login" (website, username, password), with edit and remove. Gloopy saves a login only from the sign-in card, and Settings can only forget one.
2. **Bring your logins over from a password manager.** Grok Bot imports the file you export from 1Password, Chrome or Edge, Safari or Apple Passwords, Firefox, Bitwarden or LastPass. The file is read on your computer, and logins you already have are skipped.
3. **More than one account on a site.** Grok Bot chooses between them by your hints ("Use for work purchases"). dots lets you "confirm that you want to use it or enter another account". Gloopy keeps one per site and username, but always uses the newest.
4. **Passwords made for new sign-ups.** Grok Bot: "if you let a Bot choose the password when it signs up for a site, Vault generates the password and saves the login, and the Bot never sees it." Gloopy can't do that; you'd have to type a new password on the card.
5. **Your own browser leaves the card alone.** Found live on Nov 11: Chrome on my side warned "the password you just used was found in a data breach" after I typed a demo password in Gloopy's card. Your browser's password manager treats the card like any login form, and could offer to save the password. Neither app's docs mention this.

**For other tools, or not for us:**
- 1Password connected to the browser (Grok Bot: you approve each login in 1Password and it fills the page). That belongs to connected apps.
- Codes read from email (Grok Bot reads them from a connected Gmail or Outlook, or from its own inbox). That belongs to the email tool.
- Signing in with a connected app instead of the website. That belongs to connected apps.
- Okta FastPass, company single sign-on rules, and a team Bot's own logins are for companies, not for you.

## 2026-11-12: The chat no longer scrolls sideways (your words: "fix the sideways scroll too")

- **What it was:** Gloopy's chat had a sideways scrollbar. The cause was a long unbroken string in one of Gloopy's answers, a security key's 140-character code from an earlier test. It was 1,060 pixels wide, wider than the chat, so the whole chat scrolled sideways.
- **The fix:** long words, codes and links now wrap onto the next line wherever they have to. That covers Gloopy's answers, your own messages, steps and cards. Code blocks and tables keep their own scrollbar inside themselves, so code isn't broken up. Coder's chat uses the same page, so it's fixed there too.
- **Checked:** a new test draws the chat in a real browser, with long text of every kind, at a computer's width and a phone's. With the old styles the chat was 1,328 pixels wide in a 1,280-pixel window. Now it fits exactly. Test GL126.
- **Tried live on test.gofarther.dev, with Grok, and recorded:**
  - With the real chat history, the chat is now 948 pixels wide in its 948-pixel window, so there's no scrollbar. The security key's code wraps onto a second line.
  - Asked for 300 x's with no spaces, both as code and as plain text, Gloopy's answer wrapped onto several lines inside the chat.
  - At a phone's size, the chat was 390 pixels wide on a 390-pixel screen.

## 2026-11-12: A hover step, and the live view makes way for the hand-off card (your words: "yes do both")

- **Hover.** Gloopy's browser has a new step: hover, which puts the mouse over something without clicking it. It shows what appears only then, such as a menu, a tooltip or a picture's name. Before, Gloopy clicked pictures to read their hover names, and the safety check once asked you first, because you had said hover, not click. Hovering changes nothing on a site, so like scrolling it isn't checked first. The live view marks where Gloopy hovered, and its helpers can hover too. Test GL124; GL10 and GL85 updated.
- **The live view makes way for the card.** If the big live view is open when Gloopy hands you a step, it now closes by itself, and the hand-off card shows the browser live with Skip / I'm done / Take over, scrolled into view. On a short window the view used to cover those buttons, and on a phone it hid the chat with the card in it. It happens once per hand-off: open the view again and it stays. It never closes while you have control or are marking a part. Once you've answered, the view you had open comes back. Test GL125.
- **Tried live on test.gofarther.dev, with Grok, and recorded:**
  - Asked for the names shown when hovering over each picture on the practice hovers page, Gloopy said it would "check each picture without clicking". It hovered over all three (user1, user2, user3), with no card. The live view marked each picture as it went: "Gloopy: Hovered over “User Avatar”".
  - With the live view open, Gloopy handed over WhatsApp Web's QR code. The view closed by itself, and the card showed the code live with all three buttons in view. After "I'm done", the view came back by itself.
  - On the next hand-off, reopening the view with the Browser button kept it open. Closing it again brought the card's live picture back, and Skip worked.

## 2026-11-12: Grok Bot's four ideas, built into Gloopy (your words: "yes build all four")

- **Progress as it works.** Gloopy now posts short lines as it goes, Grok Bot's way: one as it starts ("On it, opening the order form now."), then one at each new stage, never one per click. A status line under the chat says what it's doing now: its latest line, or the step running. Its answer shows pictures of the pages its browser ended on, at most two. Test GL120.
- **Found in the live test:** Gloopy posted a line on almost every click (8 for a small task; Grok Bot posts 2 or 3). Now a line comes in the chat at most every 20 seconds; the others show only in the status line. And asked to get WhatsApp Web ready to link, Gloopy described the QR code instead of handing it to you. Its instructions now say the hand-off card shows its browser live, so a QR code can be scanned right from it. GL120 extended.
- **The live screen inside the hand-off card.** When Gloopy hands you a step (a QR code, a robot check), the card now shows Gloopy's browser live, with **Skip / I'm done / Take over**. "I'm done" is for a step done without taking over, such as scanning a QR code straight from the card. The picture comes from the live view's own stream, without opening the big panel, and pauses after 15 minutes if you're away. Tests GL121 and GL27.
- **Gloopy's computer starts in seconds.** Gloopy's machine used to be the same size as Coder's (4 CPUs, 16 GB), and was stopped when idle, so each wake was a full cold start of the 6.9 GB image: about 80 seconds. Now it has its own size, 1 full-speed CPU and 2 GB, and is **suspended** when idle, like closing a laptop lid. Fly.io resumes a suspended machine in under a second, with its browser still open. Fly only suspends machines of 2 GB or less. If Fly won't suspend it, it's stopped as before. A suspended machine costs the same as a stopped one (disk only), and the smaller size costs less while awake, so the bill goes down. After a deploy, the first wake is still a cold start (a new version can't resume an old one). Your existing Gloopy machine gets the new size at its next wake. Test CD248; CD125 and CD129 updated.
- **The whole computer in the live view.** The live view now looks like a browser window:
  - **Tabs** on top: every tab of Gloopy's browser, including one a site opens. While you have control, click a tab to switch to it, × to close it (never the last one), or + for a new tab. While you're watching, the tabs only show; Gloopy's tab is Gloopy's to choose while it works.
  - **The address row above the page**, like Chrome's: Back, Forward, Reload and the address while you have control, and the full address while you watch.
  - **A Terminal tab** at the right: the commands Gloopy ran in this chat, with what they printed. While you have control, run your own on its line. Your commands run exactly as Gloopy's do (its own limited user, in its folder) and stop after a minute. Gloopy is told which ones you ran at its next message.
  - A fix on the way: when the tab Gloopy was on closed (a site closing its own pop-up), the live view froze on its last picture. Gloopy now moves on to its newest other tab.
  - Tests GL122 and GL123; GL21, GL90 and GL121 updated.
- **Tried live on test.gofarther.dev, with Grok, and recorded:**
  - **Starting in seconds:** right after a deploy, taking over took 90 seconds (a cold start of the new version, as expected). After 12 minutes idle, Gloopy's computer was suspended. Taking over then gave control in **4.4 seconds**, and both of its browser tabs were still open.
  - **The hand-off card:** asked for WhatsApp Web's QR code, Gloopy handed it over. The card showed the code live, with Skip / I'm done / Take over. "I'm done" worked: Gloopy looked again, saw the code had expired (nobody scanned it), said so, and clicked nothing.
  - **The whole computer:** a practice site's new window showed up as a second tab. Switching tabs, closing one, and + for a new tab all worked. A command in the terminal (`uname -srm && date && ls`) ran in Gloopy's folder and showed as yours. Asked afterwards, Gloopy named the command you ran.
  - **Progress:** the status line followed each step, and Gloopy's answer came with pictures of the pages it ended on.
- **Four fixes from that test:**
  - With one tab, its title stayed "New tab" as the page changed. Now it follows the page.
  - With control, the address box said "Go to an address" instead of the page's address, as Chrome shows it. Now it shows the address.
  - On a short window, the terminal's $ line fell below the fold. The terminal now leaves room for it.
  - Asked what was open, Gloopy saw only its own tab and said "one tab". Each step now also lists its other tabs, with titles and addresses.
  - GL95, GL121 and GL122 updated.
- **Rechecked live after the last deploy, all working:**
  - **Progress:** the same two-page practice task gave 3 lines in the chat (they were 8), at least 20 seconds apart. The other 7 showed only in the status line.
  - **The four fixes:** the one tab's title went to "Example Domain" and back to "The Internet" with the page. The address box showed each page's address. The terminal's $ line stayed in view, and a command ran. Asked again with two tabs open, Gloopy named both, with their addresses, and the command you ran.
  - **The QR code:** asked only to open WhatsApp Web so you could link your phone, Gloopy handed the QR code over by itself. **Skip** worked: Gloopy said you chose not to scan it and offered a fresh code.
- **Found, not changed (your choice):**
  - Gloopy's browser has no hover step. To read a picture's hover name, it clicks the picture. Once, the safety check asked first, because you had said hover, not click.
  - If the big live view is open when Gloopy hands you a step, on a short window it covers the card's Skip and I'm done buttons. Closing the live view shows them.

## 2026-11-12: Grok Bot's browser tool, tried hands-on next to Gloopy's (your words: "just test the whole browser tool and see the differences")

**How:** Grok Bot's Linux app ran on my cloud machine. You finished its sign-in on your own computer. I made a test Bot, "Browser test (Claude)", used practice sites only, and signed the app out at the end. Recorded. Your Grok Bot trial read 60% used partway through and 65% at the end.

**The same in both:**
- Filling and sending a practice order form; reading pages that load late or change on hover.
- Signing in with a private form that the AI never sees. Grok Bot's form ticks "save to vault" by default; I unticked it.
- Handing a QR code to you (WhatsApp Web).
- Ignoring hidden orders on a page and telling you about them.
- A screenshot's time given in your time zone with UTC.
- Downloads arriving in the chat with a Save button.
- After a take-over, seeing what you did.

**Better in Gloopy:**
- **Routing through your computer.** Grok Bot turned it on by default for the app on my machine, so its browser broke on secure pages here. Its Bot then told me to turn routing *on*, when it already was. Gloopy's is off until you turn it on, and Gloopy is told when routing is the likely cause.
- **"Are you sure?" pop-ups.** Grok Bot pressed OK by itself. Gloopy answers Cancel unless it meant to say yes.
- **Sending forms.** Grok Bot sent the form without asking. Gloopy asks on a card unless you've allowed it.
- **Uploads.** The site got Grok Bot's file under an internal name (a long code), not "upload-test.txt". Gloopy keeps real names.
- **Saved logins.** Grok Bot's Vault says it "can see logins". Gloopy's computer fills saved passwords without the AI seeing them.
- **Where it's signed in.** Grok Bot has no list of signed-in sites; Gloopy's is in Settings → Browser, with Sign out.
- **Live view extras.** Gloopy's live view works on the website with no app, and has Mark a part and Teach Gloopy.
- **Tidy tabs.** Grok Bot left five tabs open (WhatsApp among them); Gloopy works in one tab.

**Better in Grok Bot (ideas for Gloopy, only with your word):**
- **Its live view is the whole computer:** a real Chrome with tabs and an address bar, plus a terminal. It double-checked a site from the terminal.
- **Its hand-off card has the live screen inside it**, with Skip / I'm done / Take over. Gloopy's card opens the live view instead.
- **Its computer starts in seconds.** It slept within a minute of each task, and tasks still began at once. Gloopy's takes about 80 seconds from cold.
- **It narrates as it works** ("On it…", "The form's being filled in…") with a status line under the chat, and it attaches screenshots of the result.

**Left in your Grok Bot account:**
- The test Bot "Browser test (Claude)", with its chat.
- Five tabs open on the Bots' shared computer.
- "Route traffic through this computer" switched off for the device "vm" (my machine; it's off since I signed out anyway).

Nothing changed on your other Bots. Settings were only looked at, apart from that switch.

## 2026-11-11: Finishing the browser from the docs (your words: "Lets finish the browser" and "Yes do that")

**The check:** I re-read both apps' docs: Grok Bot's 26 pages, Cursor's copy and help center, and dots' docs and security pages. Since the check the morning before, they had changed only wording, nothing about the browser. OpenAI's two help-center articles about the cloud browser block automated readers, so dots was checked from its docs site. What was left for the browser: the two small things below, then sending the browser's traffic through your own computer.

- **Where Gloopy is signed in, in Settings.** A new "Browser" section in Gloopy's Settings lists each site its browser is signed in to, how and when (on the card, with a saved login, with a code, or by you), with Sign out. You can also sign it out of any other site and forget a saved login. Before, this was only in the chat, by typing /signins. Both apps keep it in their settings; dots calls it "Browser data".
- **Screenshot times in your time zone.** When Gloopy saves a screenshot as proof, it's now told the time in your time zone, with UTC beside it ("Tue, Nov 10, 2026, 10:30:12 AM EST"). Before, it had only UTC, so it told you UTC times. Grok Bot's docs ask for screenshots with "timestamps and time zones". Its helpers' screenshots too.

Tests GL111 and GL112; GL105 updated.

Tried live on the test copy with Grok, recorded:
- **Signing in:** Gloopy signed in to the-internet.herokuapp.com's practice login with the private card, using the site's own public demo login. Settings → Browser then listed "the-internet.herokuapp.com · You signed in on the card · Tue 10 Nov, 19:31". Sign out there said "Signed Gloopy out of the-internet.herokuapp.com (4 cookies gone)", and the list was empty again.
- **The screenshot time:** "I took the screenshot at 7:31:38 PM EST on Tuesday, 10 November 2026 (2026-11-11 00:31:38 UTC)."
- **Noticed on the way** (the test browser's, not Gloopy's): Chrome on my side warned "Change your password: the password you just used was found in a data breach" after I typed that demo password in Gloopy's sign-in card. Your own browser's password manager sees what you type in the card, as on any page. Whether Gloopy's card should ask browsers not to save or check those passwords belongs to the sign-in tool.

**Gloopy's browser through your own computer** (Grok Bot's "Route traffic through this computer"):
- **Where:** Settings → Browser → "Through your own computer", in the Go Farther app for Mac or Windows. On the website and the phone, Settings says it's on and lets you turn it off.
- **What it does:** while it's on and the app is open, Gloopy's browser sends its new connections out through your computer. Sites see your own internet connection and address, as when you browse yourself, which helps with a site that turns cloud computers away. Connections already open keep their way until they close, as Grok Bot's do.
- **What stays closed:** your computer's private and VPN addresses (your router, printer, office network). Settings shows how many were blocked this session, as Grok Bot's does.
- **When the app is closed:** Gloopy's browser goes out its own way, as before. Settings says whether your computer is linked, and the live view shows "Through your computer" while it is.
- **How it's built:**
  - The app keeps one link to Gloopy's computer through Go Farther's servers, with a ticket that lasts 12 hours. The page renews it while it's open, and turning the switch off makes every ticket worthless.
  - The link reaches Gloopy's computer only while it's awake, so it never wakes it or keeps it awake. When Gloopy starts work or you take over, the app links within seconds.
  - On Gloopy's computer, a small proxy takes connections only from its browser's own user, so Gloopy's commands can't send anything through your computer.
  - When the switch changes, the browser restarts at the next step, staying signed in, as for a time-zone change.
- **Using it:** the Mac and Windows apps need rebuilding to have it.
- **Found in the live test, and fixed:**
  - The app didn't try the link again after Gloopy's computer said it was asleep. When the handshake is refused, Node's WebSocket says only "error", never "close", and the app was waiting for "close". Now an error counts too, and a link that never answers is given up after 15 seconds. Test D10.
  - Nothing came back from Gloopy's computer through Go Farther's servers to the app. The link is now passed on Cloudflare's own way, and both ends count the messages each way, which shows in the app's status.
  - Settings' "On" note didn't show.
  - **Secure sites showed a certificate error through the test computer.** The test computer caused it, not Gloopy. Its own network checks secure connections with its own certificate, and ordinary Chrome sent through it gets the same error, so Gloopy's browser is right to refuse. Some office networks and security programs do the same on a real computer. Now, when it happens while Gloopy goes through your computer, Gloopy and the live view say so, and say that turning the switch off sends it straight out. Test GL116.
  - When the link closes, the app now notes why (the close's code), so one cut can be told from another. This holds even when the app hears "error" before "close", which the real app does. Test D11.
  - If your computer's side of the link went away without a word, Gloopy's computer kept treating the link as up until its next "still here" message, up to 25 seconds later. New pages in that time would have failed. It now notices at once, and notes why each link ended (cut off, closed by the app, or turned off), which comes with the live view's data. Test GL117.
  - **Turning the switch off takes effect at once.** Before, Gloopy's computer only heard about it at Gloopy's next step. Until then the live view still said "Through your computer", and new pages still went through it. Now an awake Gloopy's computer is told right away and lets your computer go. A sleeping one isn't woken for it, since it would wake without the link anyway. Settings says "Off. Gloopy's browser goes straight out now." Tests GL114, GL115 and GL117.
  - **A laptop that goes to sleep with the app open sends no goodbye.** Before, Gloopy's computer would have kept sending pages into the dead link for minutes, and they'd have failed. Now both ends send a "still here" every 25 seconds. If nothing at all comes for 60 seconds, the link is let go: Gloopy's browser goes straight out, and the app asks for a new link. Tests GL117 and D12.
  - **With the app open, Gloopy's computer never went to sleep.** Each time the app linked again (after any cut), Gloopy's computer counted it as being used, and its 10-minute sleep timer started over. You'd have paid for it to run all day. Now the link never counts as use. Seen live: it slept exactly 10 minutes after the app's last relink. Test GL117.
- **Tried live on the test copy.** On my test computer, a stand-in for the Mac app ran the app's own link code. With the switch on, the live view showed "Through your computer". api.ipify.org, a page that shows the address it sees, showed 160.79.106.134, the test computer's own address. I used its plain (http) address, because of the certificate check above. Your router's kind of address, http://192.168.1.1, was blocked: "Gloopy's browser could not reach 192.168.1.1: blocked: 192.168.1.1 is a private or VPN address on this computer's network", and the app counted it.
- **Then with the real app.** I ran the desktop app itself (this branch's code, on my test computer, opened on the test copy). Its page has only the four controls (start, stop, nudge, status), and it refused a link to any address but Go Farther's. It linked to Gloopy's computer at once, and the live view showed 160.79.106.234 through it. Asked in the chat to open the page and say the address, Gloopy answered "160.79.106.130" in 28 seconds, through your computer. The link was cut once during that run and came back within seconds by itself.
- **The fixes, tried live with the real app:**
  - A secure page through it showed the certificate note in the live view.
  - Closing the app was noticed 11 seconds later ("the connection closed"), and the browser went straight out.
  - Freezing the app, as when a laptop goes to sleep, made Gloopy's computer let it go after 64 seconds ("the owner's computer stopped answering"). Unfrozen, the app linked again by itself 10 seconds later.
  - The link never woke a sleeping Gloopy's computer: the app was told "asleep" until a take-over woke it.
  - With the app open, and made to link again twice, Gloopy's computer still went to sleep 10.8 minutes after the page went idle, only 5.3 minutes after the app's last link.
  - Turned off on the website, Settings said "Off. Gloopy's browser goes straight out now." Gloopy's computer let the app go at once, and the live view dropped "Through your computer". The same page then showed 152.233.48.176, Gloopy's own address.
- **The two small things left, fixed** (your words: "Finish the browser"):
  - **Turned off from another device:** the app kept asking for its link every 20 seconds, and said "asleep or out of reach". It couldn't tell a refusal from sleep, because the app's WebSocket can't read why a link was refused. Now Go Farther opens a refused link and closes it at once with its own reason. Turned off: the app stops asking and says so. Ticket ran out, or no Gloopy: it stops until its page gives it a new ticket. Asleep: it asks again in 20 seconds, as before. Tests D13 and GL114.
  - Tried live with the real app: with Gloopy's computer asleep, it said "Gloopy's computer is asleep: the link comes when Gloopy starts work or you take over" and kept trying. Turned off on the website, its next try heard "turned off": it stopped and said so.
  - Woken with the app open: Gloopy's computer took about 80 seconds to start. The app's first try gave up after 45 seconds and the next try linked, before the take-over finished. The app now says "didn't answer yet (it may be starting)" for that wait, not "did not answer".
  - Turned off while linked: Gloopy's computer let the app go at once, and the app's next try heard "turned off". Now the link is closed with "turned off" right away, so the app stops without that extra try. Test GL117.
  - Seen on the way: a refused link opens and closes again at once, so while Gloopy slept the app's status said "linked" for a moment every 20 seconds. A link now counts as up only once it has lasted 1.5 seconds or heard from Gloopy's computer. Test D15.
  - **The first link after Gloopy's computer woke closed within seconds:** most likely the app gave up waiting after 15 seconds while Gloopy's computer was still starting, and the next try, 20 seconds later, worked. It now waits 45 seconds for the link. Test D13.

**Your security key for Gloopy's browser** (your words: "Finish the browser"; Grok Bot's "Use hardware security keys"):
- **What it does:** when a site in Gloopy's browser asks to sign in with a security key (a YubiKey or similar), Gloopy's browser holds the request for you. Gloopy's step ends with a card in the chat: "Use your security key for github.com". Or, if you have control in the live view, a bar there asks the same.
- **Using it:** in the Go Farther app on your Mac or Windows computer, with your key plugged in, choose "Use my security key". A small window of the app says which site it's for, and you touch your key. It signs in for Gloopy on that site only, and Gloopy carries on. "Not now" tells the site no, as a browser would. On the website or phone, the card says your key works from the app. Each use asks you first, as Grok Bot's does.
- **What it can't do:**
  - It only signs in; it never registers a new key.
  - It only works for the site that asked (its own domain), and only over a secure address with a name.
  - Gloopy's browser takes only an answer to that very request: the same challenge, the same site, and a key the site asked for. Anything else is refused.
  - A helper's tab can't ask for your key.
  - Passkey autofill stays the browser's own.
  - The app's small window never loads the site: the app makes its page itself.
- **Tried live** (no physical key here, so a virtual one, the standard way to test them; nothing was registered on any site):
  - I made a test key and gave it to the real desktop app's key window. I used webauthn.me's debugger, a page that only shows what a key signs and stores nothing.
  - Gloopy opened it and loaded the key's id, but couldn't tick one box, so it handed me its browser. I ticked the box and pressed Authenticate. The live view said "The page asks for your security key, to sign in to www.webauthn.me", with "Use my security key".
  - I pressed it. The app's window signed with the key, and the page showed the signature.
  - Handed back, Gloopy read it: "Authentication succeeded… origin https://www.webauthn.me, type webauthn.get… user present and user verified."
  - **Then the card's way, after the fixes below:** I asked Gloopy to sign in on the debugger, and this time it pressed Authenticate itself. Its turn ended with the card "Use your security key for www.webauthn.me". I chose "Use my security key", the app's window signed with the test key, and Gloopy read the page: "Authentication succeeded. Your key signed in on https://www.webauthn.me/debugger#… origin https://www.webauthn.me, type webauthn.get… user present and user verified, sign count 1."
  - **The card on the website, without the desktop app:** it said "Your key works from the Go Farther app on your Mac or Windows computer, plugged into it: open this chat there", with only "Not now". Gloopy's tab showed its red "needs you" dot. "Not now" told the page no, and Gloopy said: "Sign-in did not finish. You chose not to use the security key, and the page shows NotAllowedError."
- **Found in the live test:**
  - Gloopy's instructions still said a passkey is the owner's to do by hand, so it handed off a key step instead of pressing the button. Now it does the step, and you're asked on the card. The hand-off tool's own description says so too.
  - Asked plainly to press the button, Gloopy tried, but its safety check (the second AI) blocked the click as "only you can do this". Its instructions listed "confirming with a passkey" as yours. Now pressing a site's own button to sign in with a key is fine, since you're asked on the card. Registering a passkey or changing security settings is still yours.
  - **A take-over could lose what you filled in.** A take-over that wakes Gloopy's computer started its browser on the machine's clock (UTC). Gloopy's next turn then restarted the browser in your time zone, and the form I had filled in was gone. The take-over now carries your time zone, so there's no restart. Test GL119. Tried live after the update: with Gloopy's computer asleep, I took over (it woke in about 86 seconds), typed "Zone check 7-11" into a practice form and handed back. Gloopy read "Zone check 7-11" in the box, so nothing restarted.
  - **Turning routing off left Gloopy's next step on a blank page.** A routing or time-zone change restarts the browser, signed in as before, but on a blank page. It now opens the page that was open again. Test GL113.
  - In the app's window, a site that doesn't say which key it wants (passkey-style, with no key named) is refused at once here: the app can't pick a key. A key the site names (the usual YubiKey case, as with GitHub or Google) signs fine. When this happens, the card now says so in plain words. On Windows, Windows picks the key itself, so it may work there; not tried.
- **Not tried with a real key yet.** Keys that need a PIN may not work in the app on a Mac. On Windows, Windows asks for the PIN itself.
- **The test copy's update with the time-zone fix stopped at the tests.** My mistake: I ran only the new test before sending it, and two older checks still looked for the take-over's old wording. They're updated. While checking, I found a test (GL118) that left its practice browser running for half an hour after it finished; it now closes it. The whole set passes: 377 of 379, with 2 skipped as before.

Tests GL118 (in a real browser: the request held, wrong answers refused, the right one reaching the page as the browser's own, "Not now", a helper's tab, autofill), GL119 (Gloopy's step to the card and back, the Worker, the page), D14 (the app: only a sign-in for that site, the window's own page, one at a time); D9 and GL115 updated.

Tests GL113 (the link and the proxy, and a real browser going through it), GL114 (the Worker: tickets, the link, the switch, off at once), GL115 (the page), GL116 (the certificate note), GL117 (why a link ended, a link gone quiet, never keeping Gloopy's computer awake, off at once), D7 to D12 (the desktop app: private addresses, the link, what the page may ask, trying again, why a link closed, a link gone quiet); CD119, CD129, CD146, GL25 and GL106 updated.

## 2026-11-10: The new browser pieces tried live, and four fixes

Tried on test.gofarther.dev with Grok, recorded. What worked:

- **The Chrome name:** sites now see "Chrome 158" everywhere they can read the name. WhatsApp Web shows its sign-in QR code now (before, it turned the browser away), and Gloopy hands it to you to scan.
- **Settings:** adding, editing and removing rules and sites works ("www." is dropped from a site's name). With a site on Never, Gloopy refused to open it by itself. With a site on Ask first, the card said "Your setting for … says to ask first".
- **A page with hidden orders for AI:** Gloopy ignored them and told you about them.
- **Helpers browsing:** two helpers browsed side by side in their own tabs, and the live view showed "Gloopy", "Helper 1" and "Helper 2" tabs to watch.
- **The monitor:** on and quiet. It never had to pause a run live, because Gloopy stopped by itself each time something was off.
- **Your rules in runs you didn't start:** with the rule "Always allow: submit the order form on httpbin.org", a wake-up Gloopy set for itself (5 minutes is the shortest) came back, filled in a practice order, pressed "Submit order" with no card ("That click is already allowed on this form") and notified you. It took 14 seconds.

Fixed after the test:

1. **Helpers' finished steps now carry their names** in the chat ("“Prices” · Read the page"). Before, only their started steps did.
2. **Switching to a helper's tab shows its picture in under a second** (0.7 seconds, measured live). Before, it could wait up to 6 seconds for the old tab's picture, which could have shown under the wrong name.
3. **The live view is now a real stream.** Measured live, the near-video view showed about 2 pictures a second. The machine had them faster, but every picture was a new request, and gofarther.dev spends about 0.4 seconds on each request before answering (asking Supabase whether you're signed in, and reading storage). Now one request carries the pictures as they come, for up to 25 seconds, so that cost is paid once every 25 seconds instead of for each picture. A still page sends nothing but a tiny "still here" every 5 seconds. While you take over or hand back, the stream pauses, so an old picture can't flip the view back to "Gloopy is using it". Gloopy's latest step shows under the picture at once, even when it didn't change the page. Where a stream can't be had, the view works as before.
   Measured again after the fix, on the same moving page: **6.6 pictures a second** (the most Gloopy's browser is set to send: one every 0.15 seconds), with one request every 25 seconds. Taking over and handing back changed the status line once each, in about half a second, and it never flipped back.
4. **A helper's step shows its name first**, then what it does ("“Rome population” · Searched the web for …"). Before, the name came after the verb ("Searched the web for “Rome population” · …"), which read as if that was what it searched for. Checked live after the fix.

Outside the browser (yours to decide; not changed):

- That 0.4 seconds is spent on every request to gofarther.dev, for every button in Coder and Gloopy, not only the live view. Remembering a checked sign-in for a short while (say 30 seconds) would cut most of it, but it means a session you end elsewhere keeps working here for up to those 30 seconds. That belongs to the sign-in tool.
- An open chat doesn't show a run you didn't start (a wake-up, a schedule, a webhook) until you reload the page. You still get the notification. That belongs to schedules.
- Opening or reloading Gloopy's chat shows the oldest messages, not the newest; you have to scroll down. That belongs to the chat screen.
- A web search Grok makes by itself sometimes shows no search words ("Searched the web for """). That belongs to web search.
- A site on Never is blocked in the browser and when Gloopy reads a page, but Gloopy's command line could still reach it; there only Gloopy's instructions and the monitor keep it away. That belongs to the command-line tool.

Tests: GL110 (the stream: on the machine in a real browser, in the Worker, and on the page); GL13, GL27, GL97, GL107 and GL109 updated (GL109 also: a helper's name first).

## 2026-11-10: The browser, continued (your words: "lets keep working on the browser tool"; you chose: call it Chrome, your rules count, and "all of it")

- **Gloopy's browser calls itself Chrome.** Sites see ordinary Chrome's name for its version, where before they saw "HeadlessChrome" (WhatsApp Web turned it away for that). The name is the same everywhere a site can read it, including a new tab's first visit. Its "controlled by automation" flag stays on: the name changes, but it doesn't hide that it's automated. I first tried Chromium's newer headless mode, which names itself plainly, but here it crashed when restarted on the same profile, and it contacts Google by itself. So I kept the browser Gloopy already uses.
- **Your own "Always allow" rules now count in runs you didn't start** (schedules, wake-ups, webhooks): a step one of your rules covers goes ahead there too, unless the check finds another reason to stop. A setting on "Always allow" alone still waits for you in those runs. So "Always allow next time" on an expired card now does what it says.

- **A Settings screen for Gloopy** (the new "Settings" button next to "Browser" in Gloopy's chat). In one place:
  - **What Gloopy may do on its own:** Ask, Always allow or Never for each of the 12 kinds of step (buying, sending, deleting and so on).
  - **Your rules:** add one in your own words ("When Gloopy wants to…" / "It should…"), edit it, or delete it, as in Grok Bot's and dots' screens.
  - **Sites (new):** your choice for a site and its subdomains, as OpenAI's website permissions do:
    - **Never:** Gloopy doesn't open it, do anything on it, follow a link to it, or read it another way.
    - **Ask first:** it asks before opening it, and before each step there that would change something.
    - **Hand off to me:** those steps are yours to do.
    - **Always allow:** they go ahead unless the check finds another reason to stop (in runs you didn't start too).
  - A card a site setting caused says so ("Your setting for shop.example says to ask first").
  - Changing anything here closes a card that's waiting, as changing a rule already did.

- **A monitor that watches over each run (dots' "safety monitoring").** A second AI call reads the whole run so far: your words, your rules, and each step Gloopy took with the start of its answer. It looks every 4 actions, and at once after anything was refused. Reading doesn't count as an action. If Gloopy seems to be getting around a safeguard (trying another way after a no), doing what you didn't ask, or following instructions from a page or a file, the run pauses. You see a yellow "Gloopy paused this task" note with why (and get a push), and Gloopy is told not to carry on unless you say so. It looks at most 12 times a run. It's on by default and has a switch in Settings ("Watch over each run"). It uses a little more Grok: each look is one short call at low effort.

- **The live view is near-video.** Before, it fetched a new picture every 0.8 seconds. Now Chromium sends a frame each time the page changes (at most about 6 a second), and the view asks for "the next change" and gets it as soon as it happens. A still page costs one answer every 6 seconds. Chromium only sends frames while someone is watching, and stops 15 seconds after.

- **Several browsers at once: Gloopy's helpers browse too.** When Gloopy splits a job between helpers, each helper now gets its own tab in Gloopy's browser, and the tabs work side by side. They share your sign-ins, and a link's new tab stays with the helper that opened it. Helpers only look things up there. A step that would change something, wait for your OK, or be yours to do is refused for a helper, whatever your settings say. The helper says so in its report and Gloopy does it itself, with a card if needed. The safety check judges a helper's steps by your own words, never by the task Gloopy wrote for it. The tabs close when the helpers are done. In the live view, a row of tabs ("Gloopy", "Helper 1"…) lets you watch a helper's tab; only Gloopy's own page can be taken over.

Tests GL104 (the browser's name, in a real browser), GL105 (sites, end to end), GL106 (the monitor), GL107 (near-video, in a real browser), GL108 (helpers' tabs, in a real browser) and GL109 (helpers with a browser, end to end); the hold test, GL27 and GL83 updated.

## 2026-11-10: The whole browser tried live on the test copy (your word: "then test the entire browser tool")

Tried on test.gofarther.dev with Grok, recorded (three videos: 50, 15 and 3 minutes): every part of the browser, Gloopy's side and yours. The test copy's settings are back as they were (no rules, everything Always allow).

**Gloopy's own steps, all working:**
- A form (httpbin's practice pizza order): opening it, typing, a choice, ticks, a time, a note. With an "Ask first" rule for forms there, only Submit asked, on a card listing what the form sends; after Allow it went, and Gloopy read back the result.
- Typing with Enter, scrolling, the End key, Back, and a screenshot sent to you as a file.
- An upload with its own button, in one step. A download by clicking a link, kept as "dummy (2).pdf" with the first copy untouched.
- The page's pop-ups: a message closed with OK; "Are you sure?" answered OK because you asked; a box wanting typed text cancelled. The browser shows your time zone (America/New_York on the test computer).
- A "Never" rule for example.org: Gloopy refused by itself, before the check had to.
- A CAPTCHA and a QR code (Telegram) handed to you with clear steps. "Not now" and "Done, hand it back" both worked, and Gloopy never tried to get around either.
- Cards: Allow, Not now, and Always allow (it saved "Click the button “Submit order” on httpbin.org").

**Your side, all working:**
- The live view marks where Gloopy acts and says its last step.
- Stop and take over in the middle of a task.
- The address box, Back, Forward and Reload.
- A file from your device when the page asks for one.
- Typing and keys.
- Teach Gloopy: it wrote down your steps (a password you typed was not kept) and saved a how-to. Asked later, it did the task that way.
- Mark a part: drag over it, write your note, and Gloopy answers about that part.
- On a phone-sized screen too.

**Found and fixed (each tried again live after the fix):**
- **The live view stayed paused when Gloopy started working.** It pauses after 2 minutes of only watching, which is meant to happen. But when you then sent a message, it said "Gloopy is using it" over an old picture (or "asleep"), without Gloopy's steps, until you pressed Refresh. Now a turn that starts wakes it, and while Gloopy's computer wakes it says so.
- **The card's form list doubled colons** ("Customer name:: Test Owner"), because the page's own label ends with one. Now it reads "Customer name: Test Owner".
- **While a step ran, the chat showed the element's number** ("Typing into f2e23"). Now it says "Typing" or "Clicking", and once done, the step's own words as before ("Typed “Margherita pizza” into “Search Wikipedia”").
- **"Do only this: … when you're in.."**: a handoff's task that ends in a full stop got a second one in the live view.
- **Ticking a box in a form was asked about as sending the form.** With an "Ask first before submitting any form on httpbin.org" rule, Gloopy ticking "Bacon" brought up a card saying it "would submit the pizza form", listing the form under "What it sends". The check was told "Click “Bacon” (in a form that sends to …)" with everything the form held, and didn't know Bacon was a checkbox. Now the step says what the element is ("Click the checkbox “Bacon”"), and what a form holds goes to the check and the card only for a step that can send it: a button, Enter, or an upload's own button.

- **Opening a page was asked about as sending a form.** With your rules on, an open is checked (new this round). But the check was handed the field that had the focus on the page Gloopy was leaving (the pizza form), so "open the-internet.herokuapp.com" came up as "would submit the httpbin form", listing that form and naming the wrong site. Now opening a page or going back is checked as itself, and the card names where it goes.
- **Your Reload could send a form again.** On a page a form sent (an order's thank-you page), Reload in the live view sent the form again without asking: tried here, it placed a second order. A normal browser asks "Confirm Form Resubmission" first. Now such a page is opened again at its address instead, which never re-sends anything; ordinary pages reload as before.
- **A marked part brought text from outside it.** Marking Wikipedia's info box gave Gloopy the article's first paragraph too, because that paragraph flows around the box and its frame runs underneath. Gloopy's answer mixed in facts that weren't in the box. Now a mark gives only the words that show inside it (not hidden under a pop-up), and every link or button in it, where before small ones could be missed.
- **On a short window the live view cut off its own "Hand it back" button** (and "Teach Gloopy") once you took control. Now the picture leaves room for them, and the panel scrolls rather than cut anything off.
- **A long step line pushed the chat sideways** (a handoff's whole task on one line). Now it ends in "…", and shows whole when you hover over it.
- **On a phone, with control, the line above "Teach Gloopy" and "Hand it back" stood one word to a line.** Now it takes the whole width and the buttons go under it.
- **"Clicked f10e11":** checkboxes with no label of their own (their words just beside them) were named by an internal number. Now they take the words beside them, and anything still nameless is said by its kind ("Clicked the checkbox").

**Outside the browser (not fixed; your call):**
- After a long chat is summarised, Gloopy re-read two old text files "again, after the summary" before answering about a pizza order. That costs time, and the files had nothing to do with the order.

**Your call:**
1. **Sites that refuse our browser.** WhatsApp Web said it only works with Google Chrome 100+, because our browser tells sites it is "HeadlessChrome". It could present itself as ordinary Chrome, as a person's browser does. Gloopy itself never gets around a refusal; this is only about what its browser says it is.
2. **Still open from the docs check:** "Always allow next time" in runs you didn't start.

Tests GL96 to GL103 are new; GL13 was updated for the hover text.

## 2026-11-10: The browser's missing pieces, added (your word: "if we missing stuff in the browser tool add it and then test the entire browser tool")

From the second check against Grok Bot's and dots' docs:

1. **The check and the card see what a form will send.** Before a click that sends a form (an email, a message, an order), the check reads what's filled in: who it goes to and what it says. A recipient or text you didn't ask for is a reason to ask. Your card shows it too, under "What it sends". Never passwords or card numbers. This works for ordinary forms and for pop-up boxes like a web mail's compose window. (dots checks "who will receive it and what the message contains"; Grok Bot's card shows the action's inputs.)
2. **Your rules apply to opening a site.** Before, a rule like "never open shady.example" couldn't stop Gloopy just opening it, since opening wasn't checked. Now an open is checked when you have any rules. With no rules there's no extra cost.
3. **QR codes go to you**, like CAPTCHAs and passkeys.
4. **The live view shows where Gloopy acts.** An orange box marks what it just clicked or typed into, and the line under the picture says its last step ("Gloopy: Clicked “Send”"). (Grok Bot: "watch clicks, typing, navigation".)
5. **Taking over:**
   - **Stop and take over:** one press while Gloopy works stops it and gives you the browser.
   - **Back, Forward, Reload and "Go to an address"**, as in a browser of your own. Keys typed on your keyboard already worked (Escape, arrows, shortcuts); my last report wrongly said they didn't.
   - **A file from your device:** when you click a page's file field, the live view asks you for a file and puts it into the page (at most 5 MB).
6. **Mark a part of the page (dots' annotations).** In the live view, press **Mark a part**, drag over what you mean, write your note and **Send to Gloopy**. Gloopy gets your note plus what that part of the page shows. It's told those words are the site's, not yours.
7. **Teach Gloopy a task (Grok Bot's "Teach a task").** While you have control, press **Teach Gloopy**, do the task once, press **Done teaching** and name it. Gloopy gets your steps (what you clicked, what you typed and where, page by page) and writes them down in its notes as a how-to. Passwords and card details you type are never written down. At most 10 minutes or 100 steps, as Grok Bot's.
8. **Big downloads no longer silently stop your work folder's copy.** This is outside the browser, but downloads made it likely. Over 25 MB, the copy is still made, without the biggest files, and Gloopy is told once which ones were left out.

**Found and fixed while testing:**
- **A click on something covered said "the page changed since your last look"**, so Gloopy would look again and try the same thing. Now it says something is in front of it (a pop-up, a cookie banner, a menu) and to close or scroll past it. An element number that's really gone now fails at once instead of after 8 seconds.
- **A page asking Gloopy for a file could block later uploads.** If Gloopy clicked a file field by mistake, an invisible file box stayed open in the browser. Now every such request is caught: Gloopy is told to use upload, and your own click gets the file prompt.
- **Notes the app adds to your message counted as your words for the check.** A download's file name, chosen by the site, could end up there. Now the check reads only what you typed.

**Not done (bigger, or your call):** routing through your own computer, a full desktop with "computer use", several browsers at once, fixed outgoing addresses (they cost money), a monitor over a whole run, codes by email, 1Password and hardware keys. Still waiting for your choice: "Always allow next time" in runs you didn't start (item 2 of the check).

Tests GL90 to GL95 are new. Six older tests were updated for the new buttons, the live view's last step and the new inputs.

## 2026-11-10: The browser checked against the docs again (your word: "do another check on the browser tool against the docs")

Nothing changed in the code. This is the check and what it found.

- **What I read:** both apps' docs again, fetched today. No new pages since this morning. The changed sections are about shopping cards, phone calls, the phone app and usage, not the browser. I also read pages missing from the first check: Cursor's copy of the Grok Bot docs (14 pages), its help center (25 pages) and dots' security page. All quotes were checked against the pages.
- **The 7 fixes close the gaps they were for.** Their docs say nothing about pop-ups, tabs, download or upload sizes, or the browser's time zone; ours now covers those.
- **Where ours is stricter than both:** the browser is walled off from Gloopy's own commands (both apps' docs say code on their computer can reach browser sessions); a fake-site check runs before the sign-in card; every step that could change something is checked (dots: browser coverage "remains under review"); the copy of the sign-ins is sealed.
- **Found on our side:**
  1. The check and the card don't see what a form will send. dots checks "who will receive it and what the message contains" before sending, and Grok Bot's card shows the action's inputs. Ours sees only the button and where the form goes.
  2. "Always allow next time" on an expired card from a run you didn't start can't work for buying, booking, sending, posting, sign-ups, deleting, account changes or sharing. Those always wait in such runs, yet the card says "next time Gloopy goes ahead". Also, my note from the safety work said "Grok Bot does the same". Its docs hold back only email in such runs (as a draft), and leave the rest to its review and your rules. dots lets you approve an action in advance for later runs. Your call which way.
  3. Gloopy's work folder is copied for a new computer only up to 25 MB packed. Over that, no new copy is made and nobody is told. Downloads (up to 25 MB each), screenshots and your attachments all go in it.
  4. Small: Grok Bot also hands you QR codes; Gloopy's list doesn't name them.
- **Differences in watching and taking over (you direct the design):** theirs streams the whole screen and shows clicks and typing; ours shows a picture of the page every 0.8 s. Their take-over is the whole mouse and keyboard; ours has no address box, no other keys, no file picking from your device, and can't start while Gloopy works. Both apps have a screen to see, edit and delete your rules; ours has none.
- **Bigger, both apps:** routing through your own computer, a full desktop with "computer use", several browsers at once. Grok Bot only: fixed outgoing addresses a site can allowlist. dots only: a monitor that can pause a whole run. Still waiting from the first check: Teach a task, codes by email, 1Password, hardware keys, per-site permissions, notes on a page.
- **Outside the browser, for later tools:** saved logins (dots always asks; Grok Bot uses them first; ours is a setting), passwords made for sign-ups, importing logins, wallets and the new order card (pay), messaging Gloopy while it works (chat), and buttons to recover or reset the computer.

## 2026-11-10: Gloopy's browser: the 7 fixes from Grok Bot's and dots' docs (your word: "yes go ahead")

Tool by tool, the first tool is the browser. I compared it against everything Grok Bot's and dots' docs say about their browsers, and you said yes to the 7 small fixes:

1. **Screenshots as files.** Gloopy can save a picture of a page (what's on screen, or the whole page) in its work folder, named after the site and the time. It can then send it to you as proof. Grok Bot's docs ask for "screenshots with the relevant state visible, timestamps". Card fields stay covered in the picture, as in Gloopy's own view.
2. **Downloads.** What a page downloads goes into `files/` in Gloopy's work folder, at most 25 MB. A bigger one is stopped and Gloopy is told. A download from a step you OK'd on a card is put there before Gloopy's next turn. Opening a file's address directly (a PDF link, say) downloads it too. While getting ready for the live test, I found that this step failed with "Download is starting" even though the file came. It now says the file was downloaded.
3. **Uploads.** Gloopy can give a site a file from its work folder (at most 5 MB, like a file it sends you). Each upload is checked first as sharing your things. With "Share your details" on Ask first, you get a card: "Upload the file “cv.pdf” with “Your CV” and click “Send”". The file is copied into the browser's own folder when it's checked, so what you OK is exactly what goes. **Found in the live test:** choosing the file and pressing the page's Upload button were two steps, so one upload took two OKs. Now the upload can include the button that sends it, so it's one step and one OK, the same way typing and pressing Enter already is.
4. **No asking twice.** Gloopy no longer asks in the chat before a step the check covers (browser steps, requests with a saved key, schedules, webhooks). The card is the question. This was the "asked twice" seen in the live test.
5. **No working around a site's check.** When a site blocks Gloopy, shows a CAPTCHA, signs it out or asks to verify again, Gloopy stops and lets you know (handoff or the sign-in card). In a run you didn't start, it notifies you too. It never tries another way in. That's what Grok Bot's docs say to do.
6. **"Are you sure?" pop-ups.** Before, every pop-up was closed with Cancel, so things like "Delete this item?" could never go through. Now a message is closed with OK. "Are you sure?" and "Leave this page?" are still answered Cancel, and Gloopy is told what the page asked. If you want it done, Gloopy repeats the step with "answer OK", and that step is checked first, like a click ("Click the button “Delete”, answering OK if the page asks to confirm"). When you have taken over the browser, your own click's "Are you sure?" is answered OK. It was your click, and the live view can't show the pop-up.
7. **Your time zone in the browser.** Pages now see your device's time zone (a booking site's times, "today"), not the computer's (UTC). If your time zone changes, the browser restarts with the new one at the start of Gloopy's next job, and stays signed in.

Tests GL85 to GL89 are new. GL89 runs everything end to end with a real browser: your time zone, an upload you OK'd (the site got the CV), a download from a step you OK'd, a screenshot, and both files read in Gloopy's folder.

**Tried live on test.gofarther.dev with Grok (recorded):**
- **Time zone:** webbrowsertools.com saw America/New_York (5:37 AM EST), though Gloopy's computer runs on UTC.
- **"Are you sure?":** on the-internet.herokuapp.com, Gloopy said the page asked "I am a JS Confirm" and it was answered Cancel ("You clicked: Cancel"). Asked to answer OK, it did ("You clicked: Ok").
- **Screenshot:** "Took a screenshot of the whole page", then sent as a file card (js-confirm-ok.png, 37 KB). The preview showed the real page.
- **Download:** Wikipedia's "Download as PDF" button. The browser downloaded Example.com.pdf (234,853 bytes) into `files/`, and Gloopy read it. (Given a PDF's address alone, Gloopy fetched it with a command instead, which is fine.)
- **Upload, no asking twice:** with "Share your details" on Ask first, Gloopy didn't ask in the chat. The card asked once. After the fix above it was one card for choosing the file and pressing Upload, and the site said "File Uploaded!".
- **A CAPTCHA:** at Google's reCAPTCHA demo, Gloopy stopped and handed the step to you ("Tick “I'm not a robot”, then press Submit"). After **Not now** it said it "didn't try to get around it".
- Afterwards, the test copy's settings went back to the testing defaults. The test files Gloopy made or downloaded stay in its folder on the test copy.
- Small thing noticed: Gloopy gave the screenshot's time in UTC ("10:39 UTC"), not your time. It's easy to change if you want.

Still waiting for your choice (the bigger items from the report): per-site permissions, notes on a page, "Teach a task", codes by email, routing through your own computer, hardware keys, and connected apps.

## 2026-11-10: Testing Gloopy live on the test copy: three things found and fixed

On test.gofarther.dev, signed in as the test account, with Grok. Recorded (the video comes with the results).

**Worked:**
- Gloopy used the time zone of the device ("It's 2:13 AM … America/New_York").
- A weekday schedule was checked and kept, in that time zone.
- `/schedules` showed the task, with Run now, Pause, Edit and Delete.
- Run now showed "Running", then "Succeeded".
- Edit started "Edit your schedule …" in the box, and the change was kept.
- Your "Ask first" rule held: Gloopy didn't follow the link and asked you first.
- Stop ended the job, and the chat showed **Resume**. Resume carried the job on from where it stopped (four news outlets compared).
- The red dot showed on Gloopy's tab while it waited for your answer, from the Coder tab too. It went away once you answered.
- A webhook was checked and set up, with its address on the test copy.
- Contact details were kept in Gloopy's notes, and Gloopy said so.
- Changing a setting closed an open schedule card: "Expired: your settings for Gloopy's checks changed. Nothing was done." Gloopy told you on its own next time that the reminder was never set.
- Delete asked first, and the schedule's past runs stayed in the history.
- Tables in answers showed as tables (the weather in five cities).
- **After the browser fix was deployed:**
  - Gloopy's browser opened example.com on its Fly.io computer.
  - Your "Ask first" rule raised the card "One of your rules says to ask first", with **Not now** and **Allow**.
  - After **Not now**, Gloopy said "I won't try another way".
  - Gloopy filled in and submitted a practice order form (httpbin.org, which only echoes it back).
  - The schedules card said "Succeeded" by itself after Run now.
- **Not seen live:** "Always allow next time" on an expired card. Even with "Buy or pay" on Ask first, the check let the practice order through, rightly, since nothing is bought. The automated tests cover it.
- **For you to decide: asked twice.** With an "Ask first" rule, Gloopy asked in the chat ("Click the Learn more link?"), and then the check's card asked again for the same click. The card even said "You already said yes to this click". Grok Bot only asks on the card. My suggestion: Gloopy leaves steps the check covers to the card, and doesn't ask about them in the chat first.
- Cleaned up afterwards: the test schedules and the test webhook are gone, and the test copy's settings are back to the testing defaults.

**Found and fixed:**
- **Gloopy's browser didn't start on its Fly.io computer.** Gloopy said "the browser isn't available". Chromium was there, but Playwright (which runs the browser) wasn't told where the image keeps it. It's only told in my own sandbox, so every test passed here. Gloopy's browser had never run on a real Fly.io computer before (it isn't on `main`). Its code now points Playwright there itself.
- **The schedules card said "ran" after a run ended** until you typed `/schedules` again. It now asks again when a job ends and shows "Succeeded" by itself.
- **In Gloopy's tab, a dropped connection said "Coder could not be reached".** It now names Gloopy.
- **A change of time alone failed once** ("make it 8:00 AM instead"). Gloopy's first try gave only the new time, and the tool wanted the whole "when"; it fixed itself on the second try. Now a new time or new days alone keep the rest ("every weekday").

Test GL84 is new.

## 2026-11-10: A test copy at test.gofarther.dev (your word: "ok yea lets do that")

You wanted to test this branch live "without touching the other branches or merging", and without it interfering with the main product.

- **Why not just deploy the branch to gofarther.dev:** this branch is 68 commits behind `main` (today's Coder work from the other session isn't in it). Putting it on gofarther.dev would take that work off the live site until `main` is deployed again, and each deploy would undo the other's.
- **The deploy button now has a "target" choice (on this branch only):**
  - **live:** gofarther.dev, as before. It now goes only from `main`, so a branch can't replace the live site by mistake.
  - **test:** the branch picked goes to its own Worker at **test.gofarther.dev**.
- **The test copy is separate from the main product:**
  - its own storage (chats, files, saved logins);
  - its own Fly.io computers;
  - its own deploy queue, so it never waits on or holds up a live deploy.
  - Its keys are put on the test copy only.
  - The live Worker, its keys and its data are never touched. Its settings are made from the live ones by `coder/test-copy.mjs`, which refuses to make settings that share anything of the live Worker's own.
- **What it shares:** your accounts (same sign-in), the Grok key (test runs cost from the same xAI account), and the same Cloudflare and Fly.io bills. Signing in or out there doesn't sign you out of gofarther.dev.
- **GitHub isn't connected there** (its address isn't in the GitHub App). Gloopy doesn't use GitHub.
- When we're done testing, I can delete the test copy with your word.
- Tests: TC1 to TC3 are new.

## 2026-11-10: Gloopy checked against Grok Bot's and dots' docs again (your word: "Go against the docs again")

The small fixes that clearly match the docs are done. The bigger differences are listed at the end for you to decide.

- **A "no" sticks.** After you press Deny on a card, Gloopy won't try that step again, or ask about it again, until you send your own next message. (Grok Bot's Deny works this way.)
- **The check can now block a step.** It blocks a step that a web page, an email or a file told Gloopy to do (not you), or one that would send your passwords, keys or card details somewhere. Nothing on a card can let it go. When the check isn't sure, it asks you instead.
- **Two new kinds of rule, from dots:**
  - **"Hand off to me":** Gloopy leaves that step to you.
  - **"Only when I ask":** Gloopy does it only when your own message asks for that very thing.
  - When several rules match, this order wins: Never, Hand off to me, Ask first, Only when I ask, Always allow.
- **An "Always allow" rule now lets a step go only when nothing else is a reason to stop**, as Grok Bot's does. It no longer overrides the check.
- **Cards say what a step does** in a red line: "This spends money.", "This reaches other people.", "This can't be undone.", "This changes sign-in or security settings." or "This shares your details outside this chat."
- **A card that one of your own "Ask first" rules asked for** says so, with **Not now** and **Allow** (no Always allow), as Grok Bot's does.
- **Always allow now says where it went:** "(saved to your rules)".
- **An expired card can still become a rule.** It shows **Always allow next time** (Grok Bot's).
- **Changing Gloopy's permissions or rules closes an open approval card.** The card is marked Expired and nothing is done. A request held for it is let go, and Gloopy is told.
- **New schedules and webhooks are checked too, even on Always allow.** One you didn't ask for gets a card. One that a page or an email asked for isn't set up. (Grok Bot checks changes to routines and triggers.) This costs one small Grok call per new repeating schedule or webhook.
- **A request Gloopy can't read in full always asks you first**, even when allowed. That covers files or data that isn't text, and anything longer than the check reads. (Grok Bot does the same with attachments it can't read.)
- **What a web page shows is marked for Gloopy** as the site's words, never instructions.
- **Your time zone comes from your device.** Gloopy uses it for schedules unless you name another (Grok Bot's auto-detect).
- **Contact details:** when you give Gloopy your name, address, phone or email for shipping or billing, it keeps them in its notes under "Contact details" and tells you. You can ask it to forget them.
- **20 files with one message** (was 10), as Grok Bot allows.
- **The schedules card (`/schedules`):**
  - each schedule shows its task;
  - **Edit** puts "Edit your schedule “name”: " in the box for you to finish;
  - **Delete** asks first;
  - recent runs now say **Succeeded**, **Failed** (and why), **Waiting for you** or **Running** (Grok Bot's run history).
- **Resume after Stop** (dots' Pause and Resume): a **Resume** button next to "Stopped." asks Gloopy to carry on.
- **A red dot on Gloopy's tab** while it waits for your answer, whichever tab you're on (Grok Bot's "Needs attention").
- **A correction to my first check:** Grok Bot's Auto-review *can* be turned off (it's on by default). dots has no off switch. Gloopy's check stays always on.
- Tests: GL79 to GL83 are new, and 15 older tests were updated for these deliberate changes. All 338 pass, 2 skipped as before. Not merged, not deployed, not tried live with Grok.

**Bigger differences, for you to decide** (not done):

- **Steering while Gloopy works:** both apps take a new message mid-job; Gloopy says "still working".
- **An on/off switch for the check** (Grok Bot has one).
- **Checking every command too**, not only browser steps, keyed requests, schedules and webhooks (Grok Bot checks shell commands, app calls and more).
- **Standing permission for a recurring task.** dots lets an approved routine send what it names; Grok Bot always waits. Gloopy follows Grok Bot.
- **Reset or Recover buttons** for Gloopy's computer, and a low-disk notice.
- **Making strong passwords for new sign-ups**, plus a vault for contact details and password hints, and importing a CSV of logins.
- **dots' proactive research** (it looks into things for you without being asked).
- **Connected apps, Gloopy's own email address, images and video, and using your own computers** (dots now allows several).
- **Bigger documents** (Grok Bot allows 250 MB; Gloopy 25 MB).
- **Pausing one webhook** from the schedules card.

## 2026-11-10: Gloopy keeps its computer, signs out, previews files; tables in answers (your word: "do all of that"; part 4 of 4)

- **Gloopy's work folder and browser sign-ins survive a new computer.** Before, an unused Gloopy computer was deleted with its disk after 30 days, losing its files and sign-ins (and the backup machine has no kept disk at all).
  - Now, after each job, Gloopy's computer sends Coder a copy: its work folder (up to 25 MB packed, without caches and installed packages) and its browser's sign-ins. The sign-ins are sealed, like your saved passwords.
  - Only what changed is sent.
  - On a new computer, both come back before Gloopy starts, and the chat says so.
- **Signing Gloopy out of a site.** Type **`/signins`** to see where Gloopy is signed in (and how), with a **Sign out** button for each site and **Forget** for each saved login. Or type `/signout shop.example` for any site.
  - Signing out removes that site's cookies and stored data from Gloopy's browser and from Coder's copy, so a new computer won't sign it back in. Gloopy is told.
  - **Found and fixed while testing:** one of Chromium's "clear this site" calls, when given an address it couldn't read, wiped every site's cookies. Sign-out no longer uses it for cookies. A test (GL76) now checks that other sites stay signed in.
- **Preview for PDFs and pictures.** Files Gloopy makes have a **Preview** button next to Download. It opens the file over the chat (Escape closes it). The preview address is signed and lasts 10 minutes. Files are always shown as what they are, never as a web page of the site. Other kinds are only downloaded.
- **Tables in answers.** When Gloopy (or Coder) answers with a table, it now shows as a table instead of lines of `|` marks. Wide ones scroll sideways on a phone.
- **The welcome text is true now:** "I never see your passwords or card numbers, and when I work on my own, I ask before I send, buy or delete anything."
- Tests: GL75 to GL78 are new (GL75 and GL76 use a real machine and a real Chromium browser). All 333 pass, 2 skipped as before. Not merged, not deployed, not tried live with Grok.

## 2026-11-10: Pause, edit and Run now for Gloopy's schedules, with a history (your word: "do all of that"; part 3 of 4)

- **Type `/schedules` in Gloopy's chat** to see a card with every schedule: when it runs, its next run, and buttons **Run now** and **Pause** / **Resume**. It also shows the last runs (ran, test run, or skipped and why). No Grok call.
- **`/pause` pauses all of Gloopy's background work** (schedules, wake-ups and webhook calls); **`/resume`** starts it again. You can still chat with Gloopy while it's paused.
  - Anything that came due while paused is skipped, not run late. You get one line listing what was skipped.
  - A webhook call while paused gets "Gloopy is paused" back, and it goes in the history.
- **Run now** tries a schedule straight away, the way it would really run. Anything that would send or buy still waits for your OK. Its normal times don't change. (Grok Bot has the same.)
- **Changing a schedule:** ask Gloopy ("make the morning news 7:30 on weekdays"). A change follows your setting for new schedules: kept at once on Always allow, a card on Ask. Gloopy can also pause or resume one when you ask.
- The routes for a full schedules screen (pause, resume, edit, run, remove, history) are ready for when you design it.
- Also fixed: a webhook call no longer starts a run over a card that's still waiting for you; it waits its turn, as schedules do.
- Tests: GL72 to GL74 are new. All 329 pass, 2 skipped as before. Not merged, not deployed, not tried live with Grok.

## 2026-11-10: Gloopy's sign-in card, as dots' is (your word: "do all of that"; part 2 of 4)

- **"Use your saved login" on the card.** When your setting for saved logins is Ask (as dots always asks), the sign-in card shows a button with the saved username. One press signs in with it; nothing to retype.
  - Always allow: used with no card, as before. Never: not offered.
- **A box for one-time codes.** When a site sends you a code (text message, email or an app), Gloopy asks for it on a card. You type it there and it goes straight into the page. Gloopy never sees it.
  - Codes split into one box per digit work too.
  - The code is hidden from what Gloopy reads, even if the site shows it again after a wrong try.
  - Before, Gloopy had to hand you its whole browser just to type a code.
- **"Take over" on the sign-in card.** Opens Gloopy's browser so you can sign in yourself (for single sign-on, passkeys, anything odd). "Done, hand it back" tells Gloopy where the page is.
- **A check for fake sign-in pages.** Before the card shows, one small Grok call looks at the page's address and where the form sends what you type. A look-alike address, a free hosting site or a bare IP address gets a red warning on the card. You still decide.
  - A page on plain http:// always gets the warning.
  - Saved logins skip this check: they're only ever typed on the exact site they were saved for.
- Small fix: the three buttons fit on a phone.
- Tests: GL69 to GL71 are new (GL71 types codes into a real Chromium browser). All 326 pass, 2 skipped as before. Not merged, not deployed, not tried live with Grok.

## 2026-11-10: Gloopy's safety, as Grok Bot and dots do it (your word: "do all of that"; part 1 of 4)

- **The check runs all the time now.** Before, it was skipped while everything was Always allow. Now every click, choice or submit in Gloopy's browser is checked first, as both apps do. That costs one small Grok call per such step.
  - While testing, everything is still Always allow, so steps you allow still go ahead with no card.
  - A step only you may do is always yours, whatever the settings or rules: changing a password or security settings, closing your account, card details, CAPTCHAs.
  - When the check can't tell what a step does, it asks you.
- **Gloopy's commands are checked when they use your saved keys.** Before, a command could send an email through your saved Mailgun key (for example) even with Send set to Ask or Never.
  - The check happens where the key is added (on Coder's server side), so no command can get around it. Reading (GET) isn't checked.
  - Anything else is checked like a browser step. If it should ask you, the request is held and not sent. You get a card showing exactly what it would send. Allow sends that same request; Deny drops it.
  - The same request isn't checked twice in a job, and the check looks at most 30 requests per job.
  - Commands that don't use a saved key can't act as you, so they aren't checked.
- **Runs you didn't start never act on their own.** In a scheduled run, a wake-up or a webhook's run, anything that would buy, book, send, post, sign up, delete, change an account or share your details waits for your OK, even on Always allow. Grok Bot does the same.
  - Gloopy is told to get it ready first (the message drafted, the form filled in), so you only press Allow.
- **Cards from those runs wait 30 minutes**, as Grok Bot's do. The card says "Waits for you until 9:30" and the phone notification says "answer within 30 min". Then it's marked "Expired: nothing was done", and Gloopy hears it wasn't answered.
  - A card from your own message never expires.
  - A scheduled run waits up to 30 minutes for an open card. After that, the card expires and the run goes ahead.
- **After testing:** one switch (TESTING in gloopy-permissions.mjs) turns the risky kinds back to Ask first: buy, book, send, post, sign up, delete, account, share, saved logins, schedules and webhooks. Wake-ups stay allowed. It's ready but not on yet.
- Small fix: a long web address in a card's title now wraps on a phone instead of running off the card.
- Tests: GL64 to GL68 are new; older tests that expected no check while testing were updated. All 323 pass, 2 skipped as before. Not merged, not deployed, not tried live with Grok (you said no testing yet).

## 2026-11-10: Gloopy checked against Grok Bot's and dots' docs (your word: "double check it against the docs of dots and grok bot")

- **How it was checked:** every part of Gloopy was compared, item by item, with Grok Bot's 33 doc pages and dots' pages (plus the ChatGPT pages dots relies on), quoting the docs.
- **What matches both:** its own cloud computer that sleeps, a browser that stays signed in, watching live and taking over, private sign-in and card forms the AI never sees, sealed API keys, Allow once / Always allow / Deny cards, rules in your own words, schedules and wake-ups, helpers, pages, files as cards, Stop that undoes nothing, and "only your messages are instructions".
- **Small mistakes, fixed now:**
  - Custom rules can be up to 1,000 characters, as Grok Bot's are (the settings route allowed only 300).
  - When "Always allow" removes your oldest rule to make room, it now says which one, as Grok Bot does.
  - Your page now lists Gloopy's API keys (site and name, never the key), so your settings screen can show and remove them.
  - Gloopy was told risky steps always wait for a card, which isn't true while everything is Always allow. It's now told the truth: its permissions decide.
  - Gloopy must never ask for a one-time code in the chat; it uses handoff, as both docs say.
- **Bigger differences, which need your decision (in the chat):**
  - Both run their safety check all the time; Gloopy skips it while everything is Always allow.
  - Gloopy's commands (and calls to APIs with a saved key) aren't checked at all.
  - dots asks before using a saved login.
  - Grok Bot never sends from background work without you; schedules and webhook runs can.
  - Cards from background work don't expire (Grok Bot: 30 minutes).
  - Not built yet: a sign-in card with a code box and "Take over to sign in"; pause and edit for schedules; a pause for Gloopy itself; sign-in review against fake sites; work files kept when the machine is replaced.
  - The welcome screen says "I always ask before I send, buy or delete anything", which isn't true while testing.
- Tests: GL63 is new. All 318 pass, 2 skipped as before. Pushed to the branch, not merged or deployed.

## 2026-11-09: Gloopy's files, in and out (your word: "2, 4")

- **Attach files, like Grok Bot.** In Gloopy's chat the clip now takes documents too: PDF, Word, Excel, PowerPoint, text, CSV and other data files, sound, video and zip files. Pictures work as before.
  - Each file is sent to Coder's Worker straight away (up to 25 MB, 10 per message) and shows as a chip until you send.
  - Program files (.exe and the like) are refused.
- **Gloopy finds your files in its folder.** When your message arrives, Coder's service puts its files into Gloopy's folder (files/), and Gloopy is told where.
  - It reads them with tools already on its computer. One command turns a PDF, Word, Excel or PowerPoint file into text.
  - What's in a file is information to it, never orders.
- **Gloopy hands you files, like Grok Bot's file cards and dots' Outputs.** A new `files` tool sends you a file it made: a document, spreadsheet, slide deck, PDF, CSV or zip, up to 5 MB.
  - You get a card with the file's name, size and **Download**.
  - The file always downloads; it never opens inside the page.
  - Files you attached show on your message and download the same way.
- **Kept for you, safely:**
  - Up to 100 files or 300 MB in all; the oldest go first.
  - Only you (signed in), or your own Gloopy while it's working on your message, can get at a file.
  - Gloopy can fetch an older file back into its folder.
  - Gloopy can only send files from inside its own folder, never through a link that leads out of it.
- **Your settings screen** can list and remove files later (that's your frontend).
- Not tried live with Grok yet. Tests GL59–GL62 are new; GL61 runs on Gloopy's real machine service. All 317 pass, 2 skipped as before. Pushed to the branch, not merged or deployed.

## 2026-11-09: Gloopy starts work from events: webhooks (your word: "2, 4"; files in and out come next)

- **Webhooks, like Grok Bot's routines started by a call:** Gloopy can set up a web address that starts a task whenever a service calls it. That can be GitHub (a push, a new issue), a form, a store, a script, or Zapier, Make or IFTTT, which can pass on an email or a Slack message.
- **You get a card** with the address, and its key when you press "Show key". Paste both into the service: the key goes in the header "Authorization: Bearer (key)", or, for GitHub, in the webhook's Secret box. Gloopy never sees the key. Nothing secret is stored either, because the key is made from the webhook's id.
- **Each call sends Gloopy a message:** its task first, then what the call carried, marked as data from outside, never instructions. A GitHub issue that says "ignore your rules" is just text to it.
- **Limits:**
  - If Gloopy is busy, up to 5 calls wait and run when it's free, within 30 minutes.
  - Calls count toward the same 24 runs a day as schedules.
  - GitHub's first test call ("ping") starts nothing.
- **A new permissions line, "Start on events":** Always allow for testing. Set to Ask first, you get a card before a webhook is set up. Set to Never, none are set up and calls are refused.
- **Stopping one:** Gloopy can stop it, or you can from your page; its address stops working at once.
- **Not yet:** email and Slack without Zapier. They need Gloopy's own email address (11 on the list) and connected apps (1).
- Not tried live with Grok yet. Tests GL56–GL58 are new. All 313 pass, 2 skipped as before. Pushed to the branch, not merged or deployed.

## 2026-11-09: Gloopy pays with a card, both ways (your word: "can we try both")

- **Both ways at once:**
  - **dots' way:** at a checkout Gloopy shows a private card form ("Pay €72.00 on (shop)"), with what's being bought and which payment service the card fields belong to. The card goes straight into the payment form, is used once, and nothing is paid until Gloopy places the order.
  - **Grok Bot's way:** the form has a "Save this card" box. Next time you pick the saved card and type only its 3-digit security code.
- **One difference from Grok Bot:** the security code is never saved, because the card industry's rules (PCI) don't allow keeping it. Typing those 3 digits also serves as your OK to pay. Saving it like Grok Bot is a small change if you ever want it.
- **Gloopy never sees the card:**
  - Its number, expiry and security code are blanked from what Gloopy reads and greyed out in its screenshots. That includes anything showing them as text, like a card picture beside the fields.
  - Gloopy can't type into card fields itself, and its browser has no copy and paste (so a card number can't be copied into another box).
  - The card goes only into the right fields, and only on the page you were asked about.
  - Saved cards are kept sealed. Your page and Gloopy only ever see "Visa ending 4242" and the expiry date. Up to 10 cards; your settings screen can list and remove them.
- **Placing the order** stays a separate click, checked like any purchase ("Buy or pay" is on Always allow for testing). With "Buy or pay" set to Never, Gloopy won't ask for a card at all.
- **Fixed, found while building this:** after a sign-in, if Gloopy clicked the password box, the step line quoted the password, and that line went to Grok and into the chat. Now an element is never named by what's typed in it, and every step line is blanked like the page outline is.
- Not tried live with Grok yet (your word: no testing yet). Tests GL51–GL55 are new; GL53 and GL54 run in a real Chrome, GL54 being a full purchase with a typed card and then a saved one. All 310 pass, 2 skipped as before. Pushed to the branch, not merged or deployed.

## 2026-11-09: Gloopy's key card and saved logins (your word: "4,5")

- **API keys, like Grok Bot's:** when a job needs a site's API (a weather service, say), Gloopy asks with a card: "Gloopy needs a key for api.openweathermap.org". You type the key in the card.
  - It's kept sealed in Gloopy's own store, not in one of Coder's environments. It's added to Gloopy's requests to that one site after they leave Gloopy's computer, so Gloopy never sees it. If a site sends it back, it's blanked out of the chat.
- **Saved logins, like Grok Bot's Vault and dots' "Save to Passwords":** the private sign-in card has a new box, "Save this login, so Gloopy can sign in to (the site) for you next time". The card's wording now says a login is saved only if you tick it.
  - It's kept only if you tick the box and the sign-in worked. It's sealed, and you can keep up to 50.
  - Next time Gloopy meets that site's sign-in page, Coder's own service types the login in, with no card. Gloopy only learns that it's signed in. If the saved login doesn't work, you get the card again, saying so.
  - Only Gloopy's computer can get a saved login, only while a Gloopy job is running, only for the site it's on, and only with that job's own pass. Your page can list them (site and username, never the password) and remove them, ready for your settings screen.
  - A new line in Gloopy's permissions, "Sign in with saved logins", is Always allow for testing, like the rest. Set it to Ask first and Gloopy shows the card instead.
  - Like a browser's password manager, a login is typed only into a password box on its own site. A sign-in box from another site shown inside a page counts as that other site's.
  - The chat says "Signed in with a saved login" for those steps, not "Asked you to sign in".
- **Payment cards:** not built yet. How to keep them is your call (asked in the chat).
- Not tried live with Grok yet (your word: no testing yet). Tests GL46–GL50 are new, and GL11 now also checks a sign-in box from another site in a real Chrome. All 305 pass, 2 skipped as before. Pushed to the branch, not merged or deployed.

## 2026-11-09: Gloopy's pages: something to read and keep (your word: "We can leave that for later, lets focus on the tools")

- **Handing code to Coder:** left for later, as you said. The plan for it is in the chat.
- **Pages, like Grok Bot's:** a report, a comparison, a plan, a tracker or a dashboard Gloopy makes for you to read and keep. It can have tables, charts, and buttons that filter what you see. Gloopy writes it as a web page file on its computer and publishes it with a new `page` tool.
  - You get a card in the chat with the page's title and **Open**. It opens over the chat; × (or Escape) closes it.
  - To change a page, Gloopy edits its file and publishes again: the same page, next version. An earlier card for it then says "Updated below".
- **Kept:** by Coder's Worker, up to 100 pages per person, each up to 512 KB. Gloopy knows its pages, and the list comes with Gloopy's tab data for your future page library. Pages can also be removed.
- **Safe to open:** a page is made by the AI, often from what websites say, so it never runs as gofarther.dev.
  - It opens from its own address, which works for 10 minutes and only for you.
  - It runs sealed off: it can't reach the app, your sign-in or anything stored for the site, and it can't send anything anywhere or submit forms.
  - Only gofarther.dev can show it.
  - Checked in a real Chrome: the page's own script runs, while reaching the app, stored data and cookies, and sending data out, are all blocked.
- **Not yet:** sharing a page by link (Grok Bot has "anyone with the link"), and a Library screen (part of your frontend).
- **Small detail:** Escape doesn't close a page once you've clicked inside it (the page then has the keyboard); × always does.
- Tests GL41–GL45 (GL43 is the real-Chrome check). All 300 pass, 2 skipped as before. Pushed to the branch, not merged or deployed.

## 2026-11-09: Gloopy's helpers: parts of a job done at the same time (your word: "Let's keep working on the tools")

- **What it is:** like dots' background agents and Claude Code's subagents. For a big job with separate parts ("compare these hotels": prices, reviews, location), Gloopy gives each part to a helper. Up to 4 work at the same time, each in its own conversation, and Gloopy gets all their reports together and writes the answer.
- **What a helper can do:** web search, reading web pages, and Gloopy's file tools.
  - No browser, no commands (helpers share Gloopy's computer, and a command changing folders would trip the others up), no cards.
  - It can't ask you anything or act on any account.
- **In the chat:** "Started helpers: Prices, Reviews, Location", each helper's steps under its name ("“Prices” · https://…"), then "Helpers finished".
- **Spending:** each helper uses Grok, and their use is counted with the message's. At most 4 at once and 8 in one message; each helper gets up to 15 steps and 5 minutes. Gloopy is told to use helpers only when a job is big enough to split.
- **Found in the screenshot, not fixed (your call, not a tool):** the chat doesn't draw tables. A table in an answer shows as lines of `|` characters. It's the chat's text formatting, the same in Coder's chat, and Gloopy is told it may use small tables. A small fix, or part of the new frontend.
- Tests GL39 (it checks the helpers really run at the same time) and GL40. All 295 pass, 2 skipped as before. Pushed to the branch, not merged or deployed.

## 2026-11-09: Custom rules for Gloopy, in your own words (your word: "add on the settings a custom rules for Gloopy ... like allow buying or whatever it is")

- **What they are:** besides the fixed list, your own rules in your own words, each Always allow, Ask first or Never, like Grok Bot's Custom Rules. For example:
  - "Allow buying on runway-shoes.example"
  - "Ask before anything on my bank"
  - "Never email my boss"
- **How they work:**
  - A **Never** rule always wins, even with everything on Always allow (it means the step before a browser click gets checked). After it, an **Ask first** rule always asks. Then come the list's settings.
  - Gloopy is told your rules, so it follows them outside its browser too (an email, a schedule).
- **"Always allow" on a card** still saves a rule, now with an id, so the settings screen can list and remove it.
- **For the settings screen (at the end):** a route lists, adds, changes and removes rules (`/api/coder/projects/gloopy-main/rules`). At most 20 of each kind, each up to 300 characters. They also come with Gloopy's tab data.
- Test GL38 is new; GL15 and GL18 now match the new wording and ids. All 293 pass, 2 skipped as before. Pushed to the branch, not merged or deployed.

## 2026-11-09: Gloopy's permissions: Ask, Always allow or Deny (your word: "a list of things, and then have ask, deny, and always allow ... the default for testing ... always allow")

- **Both have this:**
  - Grok Bot's "Custom Rules": you describe an action and choose "Ask first" or "Allow automatically".
  - dots' "Custom rules", with four choices: do it without asking, do it only when you say so, ask first, or hand it to you.
- **Gloopy's list** (one setting each: Ask, Always allow or Deny):
  - Buy or pay
  - Book or reserve
  - Send messages or emails
  - Post or publish
  - Sign up or subscribe
  - Delete or cancel
  - Change account settings
  - Share your personal details
  - Repeating schedules
  - Wake-ups
- **What each setting means:**
  - **Ask:** a card each time (Allow once, Always allow, Deny).
  - **Always allow:** Gloopy goes ahead and says what it did.
  - **Deny:** Gloopy doesn't do it, not even another way, and says it's turned off.
- **For testing, everything is Always allow** (your word). That means no cards, and no extra check call before browser steps, so it's faster and spends less. Repeating schedules are kept with no card too.
  - The sign-in card and the "Gloopy needs you in its browser" card still come. Those aren't permissions: only you can type your password or solve a CAPTCHA.
- **Careful while testing:** with everything on Always allow, Gloopy may buy, send or delete without asking. It's still told to do only what you asked for, and to ask when something can't be undone and it isn't sure. Test with accounts where that's OK.
- **At the end:** the settings screen (your way), and the default switches to Ask (one line in `coder/container/gloopy-permissions.mjs`). The pieces are ready:
  - The list and your current choices come with Gloopy's tab data.
  - A route reads and changes them: `/api/coder/projects/gloopy-main/permissions`.
  - Gloopy follows your choices from its next message.
- **How it works underneath:** your choices are kept on Coder's Worker and sent with each message. When anything is on Ask or Deny, the check before a browser step also names the kind of step ("buy", "send"…), and your setting for that kind decides. Your own "ask first" rules always ask, and Deny wins over an "Always allow" from a card. Gloopy sees the list in its instructions, and the Worker keeps a schedule only if the settings it holds allow it.
- Tests GL36 and GL37 are new; GL15, GL16, GL19, GL30 and GL32 now switch some settings to Ask to test the cards. All 292 pass, 2 skipped as before. Pushed to the branch, not merged or deployed.

## 2026-11-09: Gloopy's wake-ups are automatic now (your word: "No, what about just automatically wake up")

- **What a wake-up is:** Gloopy only works when a message comes in. A wake-up is a message it sends itself for later: "come back at 22:30 and check the price again". At that time it starts working on its own, with no message from you.
- **Example:** you say "tell me when the Strider Red is under €70". Gloopy checks (€72) and sets a wake-up for later. Then it comes back on its own, checks again and sets the next one. When the price drops it tells you and stops.
  - Other uses: waiting for a reply, tickets that go on sale at 10, a page that updates later.
- **Changed:** a wake-up no longer needs your OK. Gloopy keeps it at once and says in its answer when it'll be back.
  - The chat shows "Will come back Mon 9 Nov at 22:30: Price check", and later "Back as planned: “Price check”".
- **Still asks you once:** repeating schedules ("every weekday at 8"), because those go on running until stopped.
- **Spending limits:** each wake-up is one Grok message.
  - At most 5 wake-ups waiting at a time, each at least 5 minutes ahead.
  - With the schedules, at most 24 runs a day in all.
  - Gloopy is told to come back only as often as the job needs.
- **Tried here:** a full run with the Worker and Gloopy's machine (a stand-in for Grok). Gloopy set a wake-up with no card, came back on its own and set the next one. When the price dropped it told you, and nothing was left waiting.
- Tests GL30, GL31 and the new GL35. All 290 pass, 2 skipped as before. Pushed to the branch, not merged or deployed.

## 2026-11-09: Gloopy's schedules, and waking itself up (your word: "Ok go but we are gonna do the frontend differently tho")

- **What it does now:** Gloopy can do things on its own later, like Grok Bot's routines and dots' recurring tasks.
  - **Once:** "in 30 minutes", or at a time ("tomorrow at 9"). This is also how it wakes itself up to come back to a job.
  - **Again and again:** every 1 to 12 hours, every day, every weekday, some days of the week, or one day of the month, at a time, with an end day if you want.
  - Always in your time zone (from its notes), clock changes included.
- **Your OK first, every time:** each new schedule shows a card, e.g. "Gloopy wants to run “Morning news” every weekday at 08:00 (Europe/Lisbon)", with the task, the first run, and Deny or Allow. Each run is a message for Gloopy, so it uses Grok (the spending rule).
- **Stopping one:** just ask Gloopy ("stop the morning news"). No card is needed, since stopping costs nothing.
- **How it runs:** Coder's Worker keeps the schedules. Its every-minute job starts each one when it's due, as a message to Gloopy in its chat. The chat shows a line, "Scheduled: “Morning news” · every weekday at 08:00 (Europe/Lisbon)", never something you wrote. Gloopy notifies you when the task says to.
- **Spending limits:**
  - At most 10 schedules and 24 scheduled runs a day per person.
  - If Gloopy is busy with another message, the run waits (it's checked every minute). After 30 minutes it's skipped, and the chat says so.
  - The same goes if Gloopy's computer can't start it.
- **The frontend:** you'll do it differently, so I only changed the minimum.
  - The existing approval card now shows a schedule's task and offers Deny or Allow (no "Always allow" for schedules).
  - Schedule steps get a clock icon, and runs show as a line in the chat.
  - There's no schedules screen. For your frontend, the list comes with Gloopy's tab data, and a route lists and stops them (`/api/coder/projects/gloopy-main/schedules`).
- **Tried here** with the Worker and Gloopy's machine (a stand-in for Grok):
  - You ask, the card comes, you allow it, and it's kept. At its time the every-minute job starts it, the line shows in the chat, and Gloopy notifies you. You ask Gloopy to stop it, and it's gone. One you deny isn't kept.
  - Times were checked in Lisbon, New York and Tokyo, including the March clock change.
- **Your call:** dots wakes itself up without asking. Gloopy needs your OK for every wake-up. A daily allowance (say, up to 5 wake-ups a day without a card) is possible if you want it.
- Tests GL29–GL34. All 289 pass, 2 skipped as before. Pushed to the branch, not merged or deployed.

## 2026-11-09: Watch Gloopy's browser live, and take over (your word: "Ok you can start")

- **Tools vs features (you asked):** a tool is something the AI itself calls, like `browser` or `sign_in`. Watching live and taking over is mostly an app feature for you, plus one new tool for Gloopy: `handoff`.
- **The Browser button** on Gloopy's chat opens a live view of its browser under the bar. You see the page, its title and address, and whether Gloopy is using it. The button only shows where Gloopy has a browser (the full machine, on Fly.io).
- **Watching:** while Gloopy works, the picture refreshes about once a second. You can't take over while it's working; stop it first.
- **Taking over:** "Take over" makes the browser yours, and an orange edge shows it.
  - Click on the picture to click the page. Type on it, or in the "Type into the page" box.
  - Buttons for Enter, Tab, ⌫, scrolling and Back (handy on a phone).
  - "Hand it back" when you're done; your next message also hands it back. Gloopy's own browser steps are refused while you have it.
- **The new handoff tool:** for a step only you can do (a CAPTCHA, a passkey or single sign-on, a code sent to you, card details), Gloopy shows a card: "Gloopy needs you in its browser", with what to do.
  - "Open browser" takes over at once. "Done, hand it back" answers the card, and Gloopy carries on from where the page is. "Not now" works too.
  - When the check says a step is yours to do, Gloopy is now told to use this.
  - Your phone gets "Gloopy needs you in its browser".
- **Gloopy is told what happened:** after a handoff, where the page is now. If you took over on your own, its next message says you used its browser.
- **Spending:** no Grok calls. The view only looks while it's worth it: while Gloopy works, while you use it (up to 15 minutes without a touch), and for 2 minutes after you open it. Then it pauses with a Refresh button. It never wakes Gloopy's computer when it's asleep (its browser is closed then anyway), and an unchanged page isn't sent again.
- **Private:** nothing you type in the view is kept anywhere. Only the click, the text or the key goes to Gloopy's computer.
- **Found in the screenshots, fixed:** a cut-off strip of the chat showed under the view. While you have control, and on a phone while the view is open, the view now takes the chat's place; × brings the chat back.
- **Tried here:**
  - A real run through the Worker, Gloopy's computer and a real Chrome, with a stand-in for Grok: Gloopy met a "person check" and handed over. A click on the picture landed on the box, the browser was handed back, and Gloopy carried on.
  - In the browser: each button sends exactly its own action. The view looks about every 0.8 seconds and stops when closed. Closing it while you have control hands the browser back.
- **Known limits (your call):**
  - What you type into ordinary fields (not password boxes) stays visible to Gloopy if it's still on the page when Gloopy looks again, so do only the step asked.
  - The view is a picture refreshed about once a second, not video.
  - You can't take over while Gloopy works; stop it first.
- Tests GL21–GL28 (GL22, GL24 and GL26 drive a real browser). All 283 pass, 2 skipped as before. Pushed to the branch, not merged or deployed.

## 2026-11-09: Gloopy's private sign-in card and its approvals (your word: "Ok do that")

- **The private sign-in card** (like Grok Bot's Secure Form and dots' private sign-in): when a site needs you signed in, Gloopy asks with a card in the chat: "Sign in to runway-shoes.example", why it needs it, then Email, Password, and "Not now" or "Sign in" (Enter works too). What you type goes straight into Gloopy's browser on that site. It isn't saved anywhere, isn't shown in the chat, and Gloopy and Grok never see it. Your message then says "Signed in to runway-shoes.example" (or "Tried to sign in…" if the site showed its sign-in form again), and Gloopy carries on.
- **A check before each step that could change something:** before Gloopy clicks, chooses from a list, or presses Enter to send something, a separate quick call to Grok looks at the step, the page, your last messages and your rules. It answers one of three ways:
  - **Go ahead:** the step only moves through the site, or it's plainly what you asked for and costs nothing.
  - **Ask you first:** buying, booking, sending, posting, signing up, deleting, changing account settings, or anything it can't tell is safe.
  - **Yours to do:** card details, password changes, CAPTCHAs. Gloopy tells you what to do instead.
  - Looking around (opening, looking, scrolling, going back, typing without sending) is never checked.
- **Spending:** each checked step costs one extra small Grok call (low effort, no tools, no web search). It's counted with the message's usage. Looking around costs nothing extra.
- **The approval card:** "Gloopy wants to click the button “Place order”", the site, and why ("This would place the order and charge €72…"). Three buttons:
  - **Allow once:** done right away by Gloopy's computer, then Gloopy is told what happened.
  - **Always allow:** the same, and it also saves a rule ("Click the button “Place order” on runway-shoes.example") the checks follow from then on. At most 20 such rules; the oldest goes.
  - **Deny:** not done, and Gloopy is told not to try it another way.
  - If you allow a step but the page changed meanwhile, your OK holds for that same step once more. Your phone gets a notification for both cards ("Gloopy needs your OK", "Gloopy asks you to sign in").
- **Safer underneath:**
  - Gloopy's browser now runs as its own user on Gloopy's computer, driven only by Coder's service. Gloopy's own commands can't drive it past the checks or read its sign-ins.
  - Anything typed in a password box is blanked out of everything Gloopy sees.
  - Hidden characters are taken out of what the cards say, so a page can't make a step read as something else.
- **Found while testing, fixed:** the cards' buttons first shared the style names of Coder's key card. Pressing "Deny" would also have sent "I declined the secret for undefined." Each card's buttons now have their own names, and in the browser each button sends exactly its answer and one message. On a phone, "Always allow" was squeezed in its button; it now has room.
- **Tried for real here,** on a made-up shop with a stand-in for Grok, from the Worker through Gloopy's computer to a real Chrome. Gloopy asked to sign in, the sign-in went in, it went to place the order, the check asked first, and once allowed the order was placed. The password never appeared in anything sent to Grok, in the chat or in storage.
- **Your call (design):** the "Asked you first" step shows a ✓, like any finished step. And there's no page yet to see or remove your rules, or to add "always ask first" rules yourself. The checks already follow them; a rules page could come with Gloopy's settings.
- **Not live yet.** To try it on gofarther.dev with the real Grok: merge and deploy (your word), then a recorded test in the browser. That spends Grok calls, so it needs your OK too.
- Tests GL15–GL20 (GL19 is the full real run); GL11 and GL12 were rewritten for the new browser service. All 275 pass, 2 skipped as before. Pushed to the branch, not merged or deployed.

## 2026-11-09: Gloopy's first new tool: its own browser (your word: "look at the docs of grok bot and dots and start doing the stuff, lets start with tools first")

- **What both have that Gloopy didn't** (from their docs): its own browser; a private sign-in form; approvals with your own rules; schedules (and waking itself up); memory tools; pages; helpers working in parallel; handing coding to a coding agent. Only Grok Bot: images and videos, its own email address, reading X. Only dots: research on its own in the background. Connected apps stay for the end. Started with the browser.
- **The browser:** Gloopy's own Chrome on its computer, one tool with 8 actions: open, look, click, type, press a key, choose from a list, scroll, go back. Each step gives Gloopy the page's title and address, a numbered outline of everything on the page (more reliable than clicking on a picture), and a screenshot it sees.
- **In the chat:** each step is a plain sentence, like "Typed “red running shoes” into “Search”" or "Clicked “Under €80”", with a small screenshot under it. Several in a row read "Took 3 browser steps".
- **Safety:** it never types into a password field (signing in is yours; a private sign-in form comes next). It opens only web pages, never the machine's own settings address. It is told never to press anything that buys, books, sends, posts, signs up or deletes without your yes.
- **Sign-ins:** the browser has its own profile on Gloopy's machine, so a site stays signed in there. It starts again with each message.
- **Only on the full machine image:** Chrome and Playwright are only in the full image, the one your deploys use on Fly.io. On Cloudflare's backup machines Gloopy isn't offered the browser, and it is told so.
- **Tried for real here** with a made-up shop page: it opened the shop, searched, filtered to under €80, and refused a password field.
- **Not yet:** watching its screen live and taking over; the private sign-in form.
- Tests GL10–GL14 (GL11 drives a real browser); all 268 pass, 2 skipped as before. Pushed to the branch, not merged or deployed.

## 2026-11-09: Gloopy, piece 1 built: its chat in the Gloopy tab (your word: "copy more Grok Bot and dots")

- **The Gloopy tab now opens your Gloopy's chat** instead of "Coming soon": its figure and name on top, its welcome with three ways to start, and the same message box as Coder's (pictures, model and effort, Stop).
- **Your Gloopy is made the first time you open the tab.** One per person for now (room for more later). It isn't in Coder's chat list.
- **Each message:** Gloopy works on its own computer (one per person, the same kind as Coder's), with its notes about you. When it finishes, the chat and its notes are saved; nothing goes to GitHub. Closing the tab doesn't stop it, as with Coder. Its notifications say "Gloopy" and open its tab.
- **On a phone,** Gloopy's chat has the ☰ button, so you can get back to Coder (the old page had no way back).
- **Not in Gloopy's chat:** Rewind, @ for files, and Coder's GitHub and Environment buttons.
- **Found in the screenshots, fixed:** the chat's area first had the same name as Gloopy's drawing in the page, so the chat was drawn inside the hidden drawing and the tab's figure went blank. A test now checks that every name in the page is used once.
- **Your call, later:** when Gloopy updates its notes, the step shows the file's path ("Edited /srv/coder-memory/gloopy-main/MEMORY.md"); it could say "Updated my notes about you" instead.
- **Not live yet.** To try it with the real Grok: merge and deploy (your word), then I test it in the browser, recorded. That spends Grok calls, so it needs your OK too.
- Tests GL7–GL9 (each fails on the old code); all 263 pass, 2 skipped as before. Pushed to the branch, not merged or deployed.

## 2026-11-09: Gloopy, piece 1 started: its brain and its machine (your word: "Okay, let's start then")

- **The plan you chose:** one Gloopy per person, like OpenAI's dots, with the best of xAI's Grok Bot on top, and room for more than one Gloopy later. Connected apps (Gmail, Calendar…) come at the end (your word). I read both companies' docs first.
- **Done, the first half of piece 1 ("Gloopy chats and remembers"):**
  - **Its instructions:** your personal assistant with its own computer. It looks things up and gives links for its facts. It never sends, posts, buys, books, deletes or changes anyone's accounts without asking you first. What it reads in web pages and emails is information, never orders. It never asks for passwords or cards in the chat.
  - **Its tools:** commands and files on its computer, web search and page reading, question cards, a checklist, notifications. None of Coder's GitHub tools; a call to one is refused.
  - **Its notes about you:** it keeps them itself (your name and time zone, how you like things, your rules, one dated line for each bigger job), never secrets.
  - **How it runs:** on Coder's engine and machines, in a chat with no repository, with the whole internet. Coder's own chats are unchanged.
- **Caught by the tests before it could break anything:** Coder's machine image copies a fixed list of files, and Gloopy's new file wasn't on it (the machine would not have started). It is now.
- **Not reachable yet:** the Gloopy tab still says "Coming soon." Next: connecting the tab to Gloopy so you can chat with it, then screenshots for you.
- Tests GL1–GL6 (each fails on the old code); all 260 pass, 2 skipped as before. Pushed to the branch, not merged or deployed.

## 2026-11-08: Read: the two small display points (your word: "Do this pls")

- **A hidden character in a file name now shows:** a read of a path with a null byte in it showed in the chat as "Read notes.txt", as if it were notes.txt. Now the step says "Read notes\0.txt" (a line break shows as \n, and so on).
- **A PDF's pages and a notebook's charts now show under their step,** small, like a picture Coder opens. Up to four; Coder itself still sees every page whole.
- Tests CD246 and CD247 (each fails on the old code); all 256 pass. Live with the next merge and deploy.

## 2026-11-08: Write (tool 2): Claude Code's checks, after trying both for real

- **GitHub account:** testing stays on `canias7` (your word: "just use the same GitHub account, i let it all the repos"). Coder's app can now reach all of its repositories. The account made today with cristiananias7@gmail.com isn't connected.
- **Tried for real, side by side:** Claude Code's own Write and Coder's write, on the same files. Five differences, all where Coder could lose or change something by mistake:
  - **A file Coder read only part of:** Claude Code refuses to replace it until it's read; Coder replaced it, and the 389 lines it never saw were gone.
  - **A notebook Coder hadn't read:** the same.
  - **A file in an old text format:** Claude Code refuses any write over it; Coder saved "�" over the real "é".
  - **A UTF-16 file:** Claude Code keeps it UTF-16; Coder changed it.
  - **A shortcut (link):** Claude Code refuses and names the real file; Coder changed the real file without knowing.
- **Now Coder does what Claude Code does** in all five. A new file, a file not read yet, and a file inside a linked folder are written as before, as in Claude Code.
- Tests CD243 to CD245 (each fails on the old code); all 254 pass, and the 24 real read checks.
- **Not changed, your call:** the words after a write ("wrote a.txt (2 lines)"; Claude Code says "File created successfully at: …").
- Next: merge, deploy and test write live in the browser, on your word.

## 2026-11-08: Read: a note on files saved in an old text format (your word: "Yea fix that")

- **Found while checking write:** when a file is saved in an old text format (like Windows-1252, common for older Windows files), letters like "é" can't be read and show as "�". Claude Code's read then adds a note saying so, and that edit and write shouldn't be used on it. Coder's read said nothing, so Coder didn't know, and its write then saved "�" over the real letters.
- **Now Coder's read adds the same note**, with how to change such a file safely (a command that keeps its format, or asking you about converting it). Normal files get no note.
- Test CD241 (fails on the old code); all 250 pass. Live with the next merge and deploy.
- **A missing file, now with where Coder is** (your word: "Ok do those fixes too"): Claude Code says "File does not exist. Note: your current working directory is …", so a wrong folder is easy to spot. Coder said only "no such file". Now it adds the same note. Test CD242; all 251 pass.
- Checked the same in both: file names with spaces and accents, SVG files, and links that stay inside the project. Windows line endings go with edit (tool 3).
- **Both live** (your word: "merge and deploy"; deploy 67) **and tested in the browser (recording 13):** the old-format file got the note, and a missing file named the folder.
- **The last read check, done (recording 14):** you switched Coder's GitHub app to all your repositories, so a chat could add a second one (isibi-app). Coder read that repository's README (coder/README.md, "# Coder") by its full path, after searching for it. **Read is fully tested.**

## 2026-11-08: Coder keeps /tmp from one message to the next, like Claude Code (your word: "Fix that too")

This is part of tool 5 (bash), done now on your word.

- **Before:** each message's commands started with an empty `/tmp`, so a file put there was gone by the next message. That's why the big picture in the read test had to be made and read in one message.
- **Now:** `/tmp` lasts for the whole chat, like Claude Code keeps it for the whole session. It's kept even while the chat's machine sleeps. Only a new version of Coder starts it fresh, the same way it starts fresh the programs Coder installed.
- Tested for real in Coder's sandbox: a file made in `/tmp` was still there in the next message's sandbox, and gone after a new version. Both tests fail on the old code; all 249 tests pass.
- **Live** (deploy 66) **and tested in the browser (recording 12):** a file made in /tmp in one message was still there in the next.
- **40 old test chats deleted** (your word: "you can delete old chats bro"): the account was at Coder's limit of 50 chats, so no new chat could start. All were test chats on canias7/testingforclaude; the 10 newest are kept. Their branches and pull requests stay on GitHub.

## 2026-11-08: Read: the four differences fixed (your word: "Yea fix those 4")

- **1. A `cat` counts as reading the file:** after `cat notes.txt`, a command that changes notes.txt now says "[This command changed 1 file you read before: notes.txt. Read it again before editing.]", as Claude Code's does. Before, only Coder's own read counted.
- **2. Long lines are never cut:** Coder used to cut every line at 2,000 characters, so it never saw the rest of a long line (minified code, a long paragraph). Now, like Claude Code, a line comes whole. A single line too big for one read gets a note saying how to read it.
- **3. The changed lines:** after a command changes a file Coder read, Coder is also shown the lines the change touched (8 lines either side, numbered), as Claude Code's second note does. For that, Coder keeps a short fingerprint of each line, never the text itself. It's a note for Coder only; the chat doesn't show it, as in Claude Code.
- **4. Big pictures at 2,000 pixels** (1,600 before), with Claude Code's line on how to map a spot back to the real picture ("multiply coordinates by 3.00"). The crop hint stays. A bit more Grok per picture, as you agreed.
- Tests: three new (CD238 to CD240) and four updated, each failing on the old code. All 249 pass, and the 24 real read checks pass.
- **Live** (your word: "merge and deploy"; deploy 66) **and tested in the browser, recorded (recording 12):** all four worked. Long lines came back whole (a 20,000-character one too, and in an @-mention); after `cat` then `sed`, Coder got both notes, the second with the changed lines, word for word as Claude Code's; the big picture came at 2,000 pixels with the coordinates line; and GIF, BMP and TIFF pictures all opened (Claude Code opens only the GIF). A link that points out of the project was refused, as it should be.

## 2026-11-08: Read, tested live in the browser, then side by side with Claude Code (your word: "ok")

- **Live now:** the steps line, the folder's full path and the PARTIAL sentence (deploy 65, first try).
- **Coder, in the browser, recorded (recording 11):** eleven messages on everything about read not tried live before: big files, allow_large, long lines, UTF-16, the folder, refused kinds (zip, xlsx, binary, a pipe, outside the project, a null byte), pictures (big ones, CMYK, WebP, one over 128 MB), your picture saved and opened again (shown in the chat), PDFs (ranges, 20 at a time, password, fake, one that lies about its pages), a notebook, the @ list and @-mentions, and a long job summarized in the middle (the files read again, and a new CODER.md line followed). All worked.
- **Claude Code, the same files:** the same on most. Coder does better on four: a pipe (Claude Code's read waited 8 hours), a password-protected PDF, a PDF that lies about its pages, and BMP pictures.
- **Four differences found, waiting for your word:** (1) after `cat` shows a file, Claude Code notices when a command changes it; Coder doesn't. (2) Claude Code never cuts a long line; Coder cuts at 2,000 characters. (3) Claude Code also sends the changed lines. (4) Claude Code shows big pictures a bit bigger (2000 pixels, with a line about coordinates).
- **Outside read (bash, for later):** Coder's commands get an empty /tmp with each message; Claude Code keeps /tmp for the whole session.

## 2026-11-08: A standing rule: test everything in the browser (your word: "we need to test everything in the browser bro, pls, remember that")

- **The rule, saved** in CLAUDE.md and the preferences file, so every session follows it: every feature and fix is tried live on gofarther.dev in the browser, with Grok, and recorded. Automated tests and checks on my side are not enough on their own.
- **For read, that means one more recorded test:** the parts tried so far only by automated tests or the 24 checks on my side (big pictures, PDFs, notebooks, binary files, UTF-16, your saved pictures, the @ list order, and the rest), plus the two fixes waiting on the branch. Then the same in Claude Code, to compare.

## 2026-11-08: The read comparison, Coder's side, live (your word: "Ok merge and deploy")

- **Live:** the read changes and the folder change went live. The deploy took three tries: the first stopped at its own tests (GitHub's machine had no ripgrep), and the second hit a timeout on Fly.io's download server; the third worked.
- **Coder ran your five messages on the live site, recorded:**
  - **The read rules:** the big file gave its first 926 of 2,000 lines and the PARTIAL note; the empty file and line 5000 got their notes.
  - **The @-mentioned file** came in the message.
  - **The sed command's result** had the "changed 1 file you read before" note.
  - **After /compact,** Coder read notes.txt and empty.txt again and only named mid.txt (over 20,000 characters).
- **A bug found, in read itself, fixed (your word: "ur suggestion yes"):** reading the folder `.` said "error:  is a folder…" with the folder's name missing. Claude Code's own Read, tried in this session, says "EISDIR: illegal operation on a directory, read '/home/user'": it names the folder by its full path. Coder now names it by its full path too, for every folder, and keeps its hint on how to list what's inside (the docs: "Claude lists directory contents with a shell command such as ls"). Test CD237 (fails on the old code); 246 pass, and the 24 read checks pass.
- **Claude Code's side, run in this session** (your word: "u can do it here, u are claude code"): messages 1 and 3 on the same files. By Claude Code's docs, Coder matches on all of them except one: Claude Code limits a read to 25,000 tokens, Coder to 100,000 characters (the same for normal code). The rest of what differed (its "Warning:" wording, counting 2,001 lines in a 2,000-line file) isn't in its docs.
- **Messages 2, 4 and 5 in Claude Code** (you typed them here: "lets do . 2,4,5"): the @-mentioned file came inside the message, as in Coder. After /compact, Claude Code read notes.txt and empty.txt again but didn't mention mid.txt at all, where Coder named it. **Why, from its docs** (your word: "ok go look at the docs pls"): after a summary it brings back at most five files, the most recently changed first, and only names a file over 5,000 tokens. In this session I had changed three big project files after reading mid.txt, so mid.txt came sixth, older than empty.txt by 4 thousandths of a second. Coder has the same rule (five, newest first, a file over 20,000 characters only named), and its chat had read only three files. Nothing to change.
- **One sentence added, from Claude Code's real note (your word: "ok yes"):** when a file is too big for one read, Coder's note now ends "Do not answer from this part alone if the answer may be further in the file." Test CD204 checks it (fails on the old code); 246 pass, and the 24 read checks pass.
- **Outside read, done on your word ("do it like this"):** the line over a group of steps names each kind, like Claude Code: "Ran 1 command, read 4 files" instead of "5 steps". Searches, edits, writes, page fetches, web searches, code lookups, background jobs, reviews, undo and the setup script are named too. A failure says what failed ("a read failed"); before, it said "a command failed" even when a read failed, as the recording showed at 2:07. Test CD236 (fails on the old code); 245 pass. Live with your next "merge and deploy".

## 2026-11-08: Coder remembers the folder after a `cd`, the Claude Code way (your word: "lets do it the claude code way")

This is part of tool 5 (bash), done now on your word; it changes read too.

- **A `cd` now carries over** to Coder's next commands, and to the next message's too, like Claude Code. It only happens when the command works and stays inside the project (or the chat's other repositories). I tried these rules in Claude Code first: a command that failed didn't move it.
- **Outside the project** (say `cd /tmp`), the next command starts back in the project folder, and the result says "Shell cwd was reset to …", Claude Code's own words.
- **A command in the background never moves it.** If it tried, the result says "Session cwd remains …", as Claude Code's does.
- **Coder's file tools follow it:** a short path opens from that folder, and searches run from there, as in Claude Code.
- **Coder is told where it is** at the start of each message and whenever it moves, and to give its file tools full paths, like Claude Code. While it's in another folder, the files you @-mention and the files it re-reads are named by their full path, so a short path never points at the wrong file.
- **To turn it off:** add `CODER_BASH_MAINTAIN_PROJECT_WORKING_DIR=1` to the chat's environment variables (Environment, Environment variables). Then every command starts in the project folder, as before. Claude Code's own setting is `CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR`.
- **Outside bash, fixed because it's the same lines:** grep and glob, asked to search one of the chat's other repositories by a short path (like `../docs`), searched the project's own folder instead. Checked on the old code.
- **Safety:** a folder's name can't add lines to what Coder is told (line breaks are taken out).
- Tests CD230 to CD235 are new; each fails on the old code. All 244 tests and the 24 real read checks pass. Checked on the real page with a screenshot.
- **The first deploy stopped at its own tests, so nothing went live.** GitHub's test machine has no ripgrep, the search program Coder's grep and glob use (Coder's own machine has it), so two of the new tests failed there. The deploy's test step now installs ripgrep, so grep and glob really get tested there; before, those checks were quietly skipped there. The new tests also skip those two checks on a machine without ripgrep, like the older ones.

## 2026-11-08: Read: the three changes you asked for (your word: "Fix those 3")

- **The picture Coder opens shows in the chat**, under its "Read" step, like Claude Code. It's a small copy (at most 320 pixels wide), and it's still there when you open the chat again. Grok still gets the whole picture.
- **Pictures you paste or attach are saved as files** that Coder can open again later in the chat, like Claude Code ("they are now saved where Claude can open them as files"). They go in a `.coder-pictures` folder in the project, which is never saved to your branch, and Coder is told where they are. So it can look at one again, or copy it into the project (say, as a logo). The newest 50 are kept. Before, a picture was gone after the message it came with.
- **The @ file list puts files whose name matches first**, like Claude Code ("a file whose name contains the query now ranks above one that only matches across its folder names"). Typing `@cart` now lists `src/cart.js` before `cart/index.js`. Names that start with what you typed come first of all.
- **Why Claude Code asks for full paths and Coder doesn't** (corrected: my first answer said it was because Claude Code runs on your computer, and you caught it: "Not true cuz claude code is local and cloud both"). Claude Code asks for full paths on your computer and in the cloud alike: it's the same program in both. Its docs don't say why. What they do say is that a `cd` in one of its commands carries over to its later commands, and that it can work in more than one folder. So "the folder it's in" changes during a chat, and a full path is the only kind that always means the same file. In Coder, every command and every file tool starts in the project folder, and a `cd` lasts for that one command only. So `src/app.js` always means the same file. A full path works in Coder too.
- **Double-checked for real** (your word: "Double check if that information is true"):
  - **Claude Code**, in this session (which runs in the cloud): after a `cd`, the next command was still in the new folder, and the same short path, `README.md`, opened two different files before and after the `cd`. One thing I'd said wasn't quite right: Claude Code is *told* to use full paths, but a short path still works. It opens from whatever folder Claude Code is in at that moment.
  - **Coder**, on its real machine code: after `cd src`, the next command was back in the project folder, and `README.md` opened the project's top file. A full path inside the project works; one outside it is refused.
  - **Claude Code's docs**, all of them (227 of 228 pages; the one that wouldn't download is about Claude in Slack): none says why it wants full paths. They do name a setting, `CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR=1`, that makes every Claude Code command start in the project folder, which is how Coder always works.
- **Outside read, for tool 5 (bash), not fixed:** that last point is a real difference in commands. In Claude Code, `cd src` in one command still holds in the next. In Coder, the next command starts back in the project folder. I'll bring it up when we get to bash.
- Tests CD227 to CD229 are new; each fails on the old code. 238 pass. Checked on the real page, with screenshots. Live with your next "merge and deploy".

## 2026-11-08: A new rule for tool by tool (your word: "Ok do that")

- While we go through one tool, anything that isn't that tool goes in its own list, marked as outside it, and I ask you before fixing it. Saved in your preferences file, so every session follows it.
- If a tool's change breaks something elsewhere, I may fix it with the tool, but I'll say plainly that it's outside the tool and why.
- The read page in [`docs/tool-by-tool.md`](tool-by-tool.md) now splits today's fixes into three lists: read itself; outside read but broken by read's bigger answers; and outside read, fixed while I was there.

## 2026-11-08: Read, checked again before merging (your word: "double check again against claude code docs before merging")

- **Claude Code's changelog, further back** (45 more versions, word for word). Coder already matched nearly all of its read changes. Three more, fixed:
  - **Windows text files (UTF-16)** open now; Coder refused them as binary.
  - **CMYK JPEG pictures** (a print colour format) are converted so Grok can open them.
  - If Grok says `file_path` (Claude Code's own name) instead of `path`, read still works.
- **From the docs:** comments in CODER.md (`<!-- like this -->`) now stay out of what Grok sees, like Claude Code. Reading the file still shows them.
- **A second fresh review of the newest code** found nine real problems, all fixed. The two security ones:
  - reloading the instructions after a summary could be tricked by a background command into reading a file from outside the project;
  - reading a PDF would have run a repo's own Python file named `pypdf.py`.
  The other seven: long jobs on a big chat summarizing almost every step; wasted re-reads of pictures; the crop hint pointing to a folder read couldn't open (now a scratch folder it can); a WebP's real size; a deleted memory file; and a lost rewind point in a rare case.
- **For you to decide later:** Claude Code saves pictures you paste so Claude can open them again as files; its @ file list puts file-name matches first.
- Tests CD223 to CD226 are new, and each fails on the old code. 235 pass, all 24 rule checks pass on the real tool, and the machine check passes.

## 2026-11-08: Read, double-checked (your word: "double check everything we have with that tool")

- **Every read rule, run for real:** 24 cases on the actual tool, run the way Coder's machine runs it. All 24 match Claude Code's docs.
- **Claude Code's docs, read again word for word.** Two small differences, fixed:
  - Claude Code refuses files like .zip, .xlsx, .parquet and .heic by their type, and says how to open them. Coder now does the same.
  - The message for a folder now says to list it with glob or ls, like the docs.
- **A gap, fixed:** after /compact, or when a long chat gets summarized, Coder now re-reads up to 5 of the files it was working on, like Claude Code. Before, it did that only after a summary in the middle of a job.
- **A fresh review of the code** (a separate reviewer) found five real problems, all caused by read now giving much bigger answers. All fixed:
  - **The serious one:** a job that read a lot could make the chat lose its whole memory. The saved chat now keeps each answer shorter (Coder can read a file again), and nothing ever gets dropped whole.
  - **Also serious:** in a long job that reads a lot, the requests to Grok could grow without limit. They now stay bounded.
  - A rewind to a chat's very start could make Coder's next command get blamed for the rewind's changes.
  - The chat's record was storing every big read whole, which would have made long chats slow to load.
  - Next.js paths like `[...slug].tsx` couldn't be @-mentioned.
- **A correction:** Claude Code's separate "file changed" note isn't about a command failing. It happened again after a command that worked. Either way, it names the file and doesn't show the changes, same as Coder.
- Tests CD214 to CD219 are new; each fails on the old code. 228 pass. Live with your next "merge and deploy".
- **The last check against the docs, everything fresh** (all the pages about reading, and Claude Code's changelog, its newest 15 versions word for word). Read matches everywhere but three places, all fixed:
  - **A PDF that lies about its page count:** one saying 3 pages but having 12 was read as 3, and Coder never saw the other 9. Claude Code fixed the same thing last week. Now Coder counts the pages itself and reads all 12. A PDF whose count is too high, which Coder couldn't open before, now opens too.
  - **After a long job is summarized, Coder reloads the repo's instructions (CODER.md) and its memory fresh**, like Claude Code. Before, if Coder had changed them during the job, it kept seeing the old version.
  - **.epub files** are refused as binary, like .zip, as Claude Code now does.
  - Tests CD221 and CD222 are new (each fails on the old code). 231 pass, and all 24 rule checks pass on the real tool. The machine check now reads the lying PDF in Coder's own machine image.
- **One more check against the docs** (your word: "one more time"). One small fix: when a picture is too big, Coder shows a smaller copy, as Claude Code does. Coder's answer used to give only the smaller size, as if it were the real one. Now it says the real size, that it's seeing a smaller copy, and how to crop the part it needs for fine detail, like Claude Code's docs say. Test CD220; 229 pass.

## 2026-11-08: Tool by tool against Claude Code: 1, read (and the test account's password reset)

- **Your plan:** we go through Coder's tools and environment one by one. You try each in both Coder and Claude Code, and I compare them against Claude Code's actual docs. The running record is [`docs/tool-by-tool.md`](tool-by-tool.md).
- **Tool 1, read:** right in both runs with the real Coder:
  - GitHub (issue #18);
  - Coder's real page in a browser on my side (recording 9).
  - Every answer was right (line 250, the picture, the PDF page with only a circle).
- **Found by reading the code:** Coder's read gave 400 lines, then cut its answer to 12,000 characters with the middle dropped. On a long file, Coder could miss the middle. Claude Code's Read gives up to 25,000 tokens a call, about 100,000 characters.
- **Changed after the test, as you said:** read now gives the whole file when it fits (up to about 100,000 characters), and a longer one in parts, whole lines only, never cut in the middle. Test CD204 is new; 213 tests pass. It goes live with your next "merge and deploy".
- **Double-checked against Claude Code's docs, word for word** (your word). Seven more differences are fixed, and now read is the same as Claude Code's Read:
  - a file too big for one read: the first part, with "PARTIAL view" saying how much it got and exactly how to read the next part;
  - a whole file over 256 KB: refused, with what to do instead (read a part, or search);
  - a part asked for that's too big: refused;
  - "allow_large": the whole file in one go when truly needed, sized to the room left in the job;
  - an empty file now says it's empty, and an offset past the end gives the line count;
  - pictures up to 128 MB, not 20;
  - notebooks up to 100 MB, with a clear error instead of a cut when they're too big.
  - Test CD205 is new; 214 tests pass. Live with your next "merge and deploy".
  - **PDFs, on your "Yes fix that too":** Coder now looks at every PDF page as a picture too, like Claude Code, and keeps each page's text. A chart on a page with text is seen now.
    - Up to 20 pages a read, all sent to Grok. xAI's docs set no limit on images per request.
    - To make room, Coder's machine now passes up to 8 MB for a file tool's answer (commands keep 1 MB).
    - Coder keeps the newest 24 pictures in a job (was 8), and at most 18 MB of them, under the 30 MB a Grok request may be.
    - It costs a bit more Grok per PDF, as you agreed.
    - Test CD206 is new, and the PDF and picture tests are updated. 215 tests pass, and the machine's own read check passes too.
- **Second pass over Claude Code's docs for read** (your word): this time every page that talks about reading files, not only the Read section. Five more fixes:
  - a pipe or a device is refused at once (Coder used to wait on it);
  - viewing one file with `cat`, `head` and the like counts as reading it, so its folder's instructions load;
  - a folder's instruction file is taken up to 40,000 characters (8,000 before), with a note to read the rest;
  - those instructions load again after a long job is summarized;
  - a password-protected PDF says so.
  - Tests CD207 and CD208 are new; 217 pass.
- **On your "Yea add all of that and go look at the docs again":**
  - **@-mentioned files go into your message**, like Claude Code. Coder sees the file at once, with that folder's instructions.
    - A picture is shown, a folder comes as its list of files, and a file too big for one read is named only.
    - Each shows in the chat as "Read src/app.js (@-mentioned)".
    - Paths like `pages/[id].tsx` work too.
  - **After a long job is summarized, Coder re-reads up to 5 files it was working on**, the most recently changed first, like Claude Code. A big one is only named.
  - **The repo's instruction files at the start:** up to 100,000 characters in all (was 20,000). Past that, Coder is told which file goes on and to read the rest.
  - **Third pass over the docs** (errors, settings, hooks and five more pages). Two small fixes:
    - a clear message for a "null byte" in a path;
    - "is not a valid PDF" for a file that isn't one.
  - Tests CD209 to CD212 are new, and each fails on the old code. 221 pass.
- **On your "Yes do that too": a command that changes a file Coder read now says so**, like Claude Code.
  - Claude Code's docs say only one line about this, so we checked what Claude Code really does, with your two tests in Claude Code:
    - **Test 1:** a background command changed notes.txt from apple to banana, then ended. Claude Code woke up by itself and was told only that the command had ended, nothing about the file. Claude read the file again on its own.
    - **Test 2:** the command changed the file, then kept running. At your next message, Claude said it got no note at all.
    - And in my own session, a command of mine that changed a file I had read got: "This command modified 1 file you've previously read … Call Read before editing."
  - **So Coder now does the same:** a command that changed a file Coder read says so in its result: "This command changed 1 file you read before: a.js. Read it again before editing."
  - A file changed any other way (in the background, or between messages) gets no note, like Claude Code, and is never blamed on Coder's next command.
  - My first version also showed the changed lines in those other cases. Your tests showed Claude Code doesn't, so I took that out.
  - Then Claude Code gave me its note in my own session: after a command of mine changed a file I had read (and ended with an error), it said the file "changed on disk since you last read it… The changes are not shown here". So its note names the file and doesn't show the lines, as Coder's now does.
  - Coder's machine keeps only each file's time, size and a fingerprint (no copies), for up to 100 files a chat.
  - Test CD213 is new (it fails on the old code). 222 pass, and I checked it as the machine's own user too. Live with your next "merge and deploy".
  - **Noted for the bash tool:** Claude Code's background commands keep running between messages, and it wakes up when one ends. Coder stops them when a message ends.
- **Browser tests on my side:** I can now open a real browser here that you can watch from your app (the "browser" preview), signed in to gofarther.dev as the test account. Signing in still needs the emailed code from you.
- **The test account's password (live data, on your word "reset it"):**
  - cristiananias7@gmail.com was refusing the password you remember. Supabase itself said it was wrong, from your phone too.
  - Nothing in Coder changes passwords, and the account hadn't signed in since Nov 6.
  - I set it back to the password you gave me in the chat.
  - Coder had no scrambled copy to clear: copies are only made at a sign-in, and there hadn't been one since that feature shipped.
  - Please change it once we're done testing, since it was in the chat.

## 2026-11-08: Merged and deployed: the fixes found by testing everything, and all passed live

- You said "merge and deploy". Deploy run #61 passed: all 212 tests, the machine-admin tests, Coder's new machine image, and the site's own check. Live since 02:43.
- **Live retest with the real Coder** (issue #17 on your test repo, filmed as recording 8). All four passed:
  - **Programs in /usr/games:** `cowsay hi` runs by its name.
  - **Background commands:** monitor saw the server running, and curl got 200. After stop_job, monitor said "not running", and curl couldn't connect, so it really stopped.
  - **Network setting:** Coder quoted "NETWORK: FULL. This chat's environment allows any site on the internet…".
  - **Undo on GitHub:** answered at once: "Undoing a job is done in the chat on gofarther.dev, not from GitHub." No question card, no dead end.
- **Each chat's own message box** is live too. The site serves the new page code; it was checked on the page (recording 4b) and by its test.
- **The desktop app's offline fix** arrives with the next desktop build (the build button).
- A small one noticed, not changed: after stop_job, the log ends "[finished, exit code null]". "Stopped" would read better.

## 2026-11-08: Everything tested, one by one, and recorded (your word: "u test it all yourself one by one , record it pls")

- **Recorded:** 8 videos of the page and the desktop app, plus a ninth that films the live GitHub threads and stops at each result. Items checked only by the automatic tests can't be filmed (2, 48–50), and 45 and 47 weren't tested.
- **The results are in [`docs/coder-features.md`](coder-features.md)**, item by item, each with how it was tested:
  - **live:** the real Coder through @coder on your test repo, issues #12 to #16 and pull request #16;
  - **page:** the real page and server code on my side, with stand-ins for sign-in, GitHub and Grok, because the code is emailed and I can't sign in;
  - **app:** the real desktop app, filmed.
- **44 of 50 passed.** 4 passed as far as I can go and need you for the last step. 2 weren't tested: desktop notifications (they need signing in inside the app) and the phone app (no phone here).
- **6 problems found and fixed**, in the entries below:
  - background commands;
  - /usr/games;
  - "Full" network not said;
  - the message box carrying over between chats;
  - dead ends on GitHub;
  - the desktop app's blank window.
- **Live highlights:**
  - 60 of 60 tools ok;
  - sudo and apt-get work;
  - the machine keeps its files and installs while asleep;
  - a screenshot and a PDF page read exactly;
  - the eval warning;
  - the next chat started from the setup's saved copy (#25 passes now);
  - CODER.md in the root and in `src/` followed;
  - memory carried to a new chat;
  - review and security review;
  - a 2-question card on GitHub;
  - a draft pull request (#16);
  - your GitHub login isn't on the machine (only a placeholder).
- **Needs you, for the last steps:**
  - on gofarther.dev, Repositories, turn on Code review for testingforclaude (Manual is enough), then I'll ask `@coder review` on pull request #16;
  - in the chat that made pull request #16, press Auto-fix;
  - on your phone or in Chrome, turn on notifications and press "Send a test";
  - install from the Home Screen.
- My own mistakes, corrected: the first recording 4 said a pull request had opened when none had (my stand-in for Grok never asked for one), and my test browser put the sign-in back after Sign out. Both were redone.
- A question for you: **Sign out ends your sign-in on every device** (phone, desktop app, other browsers). That's Supabase's default. Claude's apps sign out only the device you're on. I haven't changed it.

## 2026-11-08: Desktop app: "Try again" with no internet no longer leaves a blank window

- Found by running the real desktop app on my side (recorded): with no internet, the app shows its "Can't reach Go Farther" page, as it should. But pressing **Try again** while still offline left the window **blank**, with no button. The page was loaded again, but the window stopped drawing it.
- Now Try again first checks that Go Farther answers. Still offline: the page stays and says "Still can't reach it. Go Farther opens by itself when your internet is back." And it does: when the computer comes back online, Go Farther opens on its own.
- I tested this on Linux, on a virtual screen. A Mac or Windows computer may not have gone blank, but the fix avoids the failing reload either way.
- Tests: D3 and D4 are new in the desktop app's tests (4 pass). It's in the next desktop build (the build button); the website doesn't change.

## 2026-11-08: Two more fixes found by testing everything (not live yet)

- **Each chat keeps its own message box** (page test, recorded): a message that couldn't be sent in one chat was still in the box after opening another chat, with its pictures and line comments, and would have gone to the wrong chat. Now what you typed, attached or commented stays with its chat and comes back when you open it again. A chat you open for the first time starts empty.
- **No dead ends on GitHub** (live test C, issue #14 on your test repo): you asked `@coder Undo the last job`. Coder asked which job, then said undo can't be done from GitHub. Some things are only for your chat on gofarther.dev on purpose, because anyone can write on GitHub: undo, asking for a key, changing the environment, posting review comments as you, and turning auto-fix on or off. A job started from GitHub is no longer offered those, like Claude Code's GitHub mode, and Coder is told to say straight away that they're done in the chat on gofarther.dev. If it tried one anyway, it's still refused, as before.
- Tests: CD202 and CD203 are new. 212 tests pass.
- Live after the next "merge and deploy", with the three fixes below.

## 2026-11-08: Three fixes found by testing everything (not live yet)

- **Background commands** (live test A, issue #12 on your test repo): when Coder ran a server in the background, its check said "not running" while it ran, and its stop didn't stop it. Coder checked and stopped them from inside its sandbox, where the machine's process numbers mean nothing. Now Coder's own service, which started the command, checks and stops it, with everything it started.
- **Programs in /usr/games** (same test): apt-get installed `cowsay`, but Coder couldn't run it by name, because /usr/games wasn't on its command path. It is now, like on a normal Ubuntu machine.
- **Full network access** (same test, follow-up): asked which network setting its environment has, Coder couldn't tell when it was Full (only the limited ones were described). Now it's told.
- Tests: CD199, CD200 and CD201 are new (the first two fail on the old code); two older tests updated. 210 tests pass.
- Live after the next "merge and deploy".

## 2026-11-08: Merged and deployed: pictures, PDFs and notebooks (pick 1), and up to 4 questions in one card (pick 4)

- You said "merge and deploy": both are live on gofarther.dev.
- The deploy ran all 207 tests, including the new picture and PDF ones (it now installs the same picture and PDF programs Coder's machine has). The 18 machine-admin tests passed too.
- GitHub's check of Coder's machine passed, including opening a picture, a PDF page with no text, and a notebook's chart inside Coder's real machine.

## 2026-11-08: Coder can ask up to 4 questions in one card (your pick 4)

- Like Claude Code: when Coder truly needs you to choose, it can now ask 1 to 4 related questions in one card instead of one at a time.
- Each question has a small label (like "Database"), its choices with a one-line explanation, and Other to type your own. Some questions let you tick several. The recommended choice comes first and is already picked.
- One **Submit answers** sends everything as one message, one line per question (like "Database: Postgres"). **Skip** lets Coder decide.
- Notifications say how many questions are waiting. On GitHub (@coder) they're numbered, and you answer them all in one comment.
- Old one-question cards in your chats still look and work the same.
- Live after the next deploy. Screenshots are in the chat.
- Tests: CD197 and CD198 are new; CD84 updated. 207 tests pass.

## 2026-11-08: Coder can now see pictures, PDFs and notebooks it opens (your pick 1)

- Coder's `read` used to open only text. Now it also opens what Claude Code's Read opens:
  - **Pictures** (PNG, JPG, GIF, WebP, BMP, TIFF). For example, Coder can take a screenshot of a page it built and look at it. Grok only takes JPG and PNG, so other kinds are turned into PNG first, and big ones are made smaller.
  - **PDFs**, page by page, with Claude Code's rules: at most 20 pages at a time, and you must say which pages for a PDF over 10 pages. A page with no text (a scan) is shown to Coder as a picture.
  - **Jupyter notebooks**: each cell with its output, including charts as pictures.
- A job keeps the 8 newest pictures it opened; older ones are let go (Coder can open them again). Saved chats keep a note instead of the picture, so they stay small.
- Fixed on the way: Coder's file tools could cut off a very long answer. They now finish writing before they stop.
- Live after the next deploy. The machine check on GitHub also tries it inside Coder's real machine.
- Tests: CD193-CD196 are new. 205 tests pass.

## 2026-11-07: Merged and deployed: the saved-copy fix (#25) and the kept leave-out list (#22)

- You said "merge and deploy first": both fixes are live on gofarther.dev. The deploy's tests and GitHub's check of Coder's machine both passed.
- Next: you want to test everything a different way; you'll say how.

## 2026-11-07: Testing: #25 failed (the setup's saved copy), found why, fixed

- **What I tested:** two new chats in one environment, through your test repository (issues #10 and #11). The second chat should have skipped the setup by starting from the first chat's saved copy. It didn't: the setup ran again.
- **Why:** I checked Fly.io with a new read-only button (it only lists things). The first chat's copy was saved fine. But Fly takes minutes to finish a copy (the second chat's own copy took over 7 minutes), and the second chat started about a minute after the first. Coder tried the unfinished copy, Fly said no, and Coder quietly made an empty disk instead. Nothing in the chat said so.
- **A second problem, from Fly's own docs:** Fly saves a disk when it gets to it, not at the moment Coder asks. So a copy could be taken after the first chat's job had moved on, without the marker that says what it is a copy of.
- **Fixed** (live after the next deploy):
  - A new chat starts from the copy only once Fly has finished it.
  - While Fly is still finishing it, the new chat runs the setup itself and says so in the chat. It doesn't make a second copy.
  - The first chat waits until Fly has actually started saving its disk (usually seconds, at most 80 seconds), then goes on. Its marker stays on its disk for good.
  - A disk made from the copy is only used once Fly has finished restoring it into the new disk.
  - When a copy can't be used, the chat now says why (for example "Fly.io would not make a disk from it"), and Coder's records keep the reason.
  - Copies saved before this fix aren't used; the next new chat makes a fresh one.
- **To test again after you say "merge and deploy":** one new chat makes the copy; I wait until Fly says it's finished (the read-only button shows it); then a second new chat should skip the setup.
- Tests: CD151, CD152 and CD153 rewritten for this; CD192 is new (the chat says why a copy was not used). 201 tests pass, plus the 18 machine-admin tests (they run on GitHub with this push).

## 2026-11-07: Testing: #22 passed, and one leftover fixed

- **#22 passed:** your broken test chat (issue #9) repaired itself after the deploy. Its files and git came back, on Coder's own branch.
- **What the test found:** that chat's setup had made a file (`setup-ran.txt`) while it was broken. Coder keeps a list of files the setup made, so they're never saved as its work. That list was inside the broken git folder, which the repair cleared, so the file got pushed to Coder's branch once.
- **Fixed** (live after the next deploy): the list is now kept when a broken git folder is cleared. Only chats broken by the old bug could hit this. The test for it fails on the live version and passes now.
- The test branch `coder/testingforclaude-1jpc6lty` on your test repository has that one extra file. It's harmless test data; delete the branch on GitHub whenever you like.
- Tests: CD175 extended. 200 tests pass, plus the 18 machine-admin tests.

## 2026-11-07: Merged and deployed; the full list of everything Coder has

- You said "merge and deploy": items 3, 9, 2, 6, 5, 11 and 8, and the fix for the half-made copy, are merged into main and deploying.
- **The full list** is in [`docs/coder-features.md`](coder-features.md): 50 things, numbered, each with how we test it, who tests it (me through GitHub, or you on your screen) and where it stands. We test them one by one from there.

## 2026-11-07: Notifications in the desktop app too; the auto-fix screenshot

- **Desktop app:** its window can't get web notifications. Instead, while the app is open (minimized is fine), it watches your chats itself and shows the same notifications with the same two switches. Turn it on in the app: the gear, Notifications, "Turn on in this app".
- **Phone app** (the one from the build button): still none. That needs Firebase and Apple's push, which need your accounts. Until then, notifications on a phone come from gofarther.dev on the Home Screen.
- **Item 2's screenshot**, owed from before, was shown in the chat: auto-fix now starts "Off" on a pull request.
- Tests: CD191. 200 tests pass.

## 2026-11-07: Item 8: notifications like Claude Code's (and what the app stores need)

- Item 8: the apps weren't in the stores, and Coder sent no phone notifications.
- **Notifications, now like Claude Code's:**
  - **Turn them on per device:** the gear at the bottom left, then Notifications, then "Turn on for this device".
  - **Two switches, as in Claude Code:**
    - "Push when Coder decides": a job of 3 minutes or more finished, or you asked ("notify me when the tests finish").
    - "Push when actions are required": Coder asks you something, needs a key, or proposes an environment change.
  - **Never about a chat you're looking at.**
  - **Tapping a notification opens that chat.** "Send a test" checks a device.
  - **Where it works:** browsers on computers and Android phones. On iPhone, add gofarther.dev to the Home Screen first (in Safari: Share, then Add to Home Screen), then turn it on from there.
  - **Private and safe:** sent only to the browsers' own notification services, encrypted for each device.
- **The app stores (not done; it needs you):**
  - **Apple's App Store** needs your own Apple Developer account ($99 a year).
  - **Google Play** needs your own Google Play Console account ($25 once).
  - Each also needs a store page (name, screenshots, a privacy policy) and their review.
  - When you have the accounts, I can set up the builds for them. Until then, the build buttons make the Android `.apk` and the desktop apps.
  - Notifications inside those apps would also need the stores' own push setups (Firebase for Android, Apple's for iPhone). Until then, use gofarther.dev from the Home Screen or a browser for notifications.
- Tests: CD187-CD190 (the encryption matches the standard's own example). 199 tests pass.

## 2026-11-07: Item 11: Code review like Claude Code's

- Item 11: Coder had no automatic review of pull requests.
- **Now, like Claude Code's Code Review:**
  - **Turn it on per repository** on the Repositories screen. Pick when reviews run: After every push, Once after PR creation, or Manual (only when someone comments `@coder review`). Then pick a level: Quick, Standard or Deep. **Off by default**, since every review spends Grok calls.
  - **Comment commands** on a pull request: `@coder review` (one review), `@coder review always` (also review each push), `@coder review stop`. Only Coder users with write access; strangers get no answer, and people without write access get a short note.
  - **What it posts:** comments on the lines concerned, marked 🔴 Important, 🟡 Nit or 🟣 Pre-existing, each with "Why this was flagged". Also a summary, and a "Coder Review" check that never fails the pull request. It never approves or blocks.
  - **How it reviews:** several passes look for different kinds of bugs, a second check drops false alarms, then the findings are ranked. It only reads the code; it never runs it.
  - **Your rules:** a `REVIEW.md` in the repository (read from the main branch, never from the pull request itself) and `CODER.md`.
  - **Later pushes:** reviews only what changed, marks fixed findings resolved, and skips if nothing really changed.
  - Drafts and pull requests from forks are skipped unless someone asks with a comment.
- **Waiting on you (later, when you want automatic reviews):** in GitHub, the gofarther-coder app's settings need two things: the "Pull request" events ticked, and "Checks" set to read and write. Without them, `@coder review` comments still work, just with no check on the pull request.
- Tests: CD182-CD186. 195 tests pass.

## 2026-11-07: Item 5: read-only repositories, and a fix found by the live test

- Item 5: Coder only opened repositories it could write to.
- **Now, like Claude Code ("a session can clone any public repository"):**
  - **Open any repository you can read.** Pick one from the list (repositories you can only read are marked "read-only"), or type any public one as `owner/name` or paste its GitHub address.
  - **Where you can't push, the chat is read-only.** Coder works as usual, but its work is saved on Coder's machine instead of GitHub. The chat says so, and the header shows a "Read-only" label.
  - **See changes** shows that work. A new **Download patch** button gives it to you as one file, which `git am` applies to your own copy.
  - **No pull request buttons, and no auto-fix there.** Claude Code can't push back without push access either. Undo and Rewind still work, on the machine.
  - **Coder is told** the repository is read-only, and `gh` may only read it, so nothing is written there in your name.
  - **@coder on GitHub still needs push access,** like Claude Code's GitHub app ("the triggering user must have write access").
- **The live test found a separate bug, now fixed.** Your test chat's first try failed partway through copying the repository (the git bug fixed earlier today). After that, every new job thought the copy was finished, so Coder saw an empty folder: no files, no git.
  - **Fix:** a copy that fails leaves nothing behind, and a half-made one from before is cleared and copied again.
  - That test chat will repair itself on its next message once this is live.
  - The live test also confirmed the admin sandbox works on Fly.io: `sudo` gives admin, `apt-get install` works, and the setup script ran.
- Tests: CD175 (the copy fix; it fails on the old code), CD176-CD181 (read-only repositories). Eight older tests were updated for the new behaviour. 190 tests pass, plus the 18 machine-admin tests.

## 2026-11-07: Item 6: gh works, with your GitHub login kept outside the machine

- Item 6: GitHub's `gh` tool was installed on Coder's machine but not logged in.
- **Now, like Claude Code's:**
  - **Your login stays on Coder's server.** When Coder runs `gh` in a chat on a GitHub repository, the request goes through Coder's network gate to Coder's server, which adds your GitHub login there. It never reaches the machine, so nothing Coder runs can read it.
  - **Only the chat's own repositories.** Anything else is refused with Claude Code's message ("GitHub access to … is not enabled for this session").
  - **`gh pr` and `gh issue` are refused,** as in Claude Code: they use GitHub's GraphQL. The message points to the REST form (`gh api repos/OWNER/REPO/pulls`), which works, and Coder is told so.
  - **The network setting doesn't block it** (even None), as in Claude Code, because it goes to Coder's server, not the internet.
  - **A job started from a GitHub comment can only read** through `gh`, since strangers can write the text that starts it.
  - **On the machine, `GH_TOKEN` reads `proxy-injected`,** like Claude Code's placeholder. A GH_TOKEN or GITHUB_TOKEN you set yourself in the environment's variables passes through instead.
- Tests: CD172 (the gate), CD173 (the server: only the chat's repositories, GraphQL refused, read-only from GitHub), CD174 (the machine). 183 tests pass.

## 2026-11-07: Item 2: auto-fix like Claude Code's

- Item 2: auto-fix was always on, worked only on Coder's own pull requests, and didn't answer on GitHub.
- **Now, as in Claude Code's docs:**
  - **Off until you turn it on** for a pull request: the Auto-fix button in the chat, or ask Coder ("watch this PR and fix any CI failures or review comments", "stop watching it").
  - **Any open pull request of the chat's repository**, not only Coder's. The chat then works on that pull request's branch. Not a fork's (its branch can't be pushed to, so Claude Code can't either), and not one another chat already watches.
  - **What starts a fix:** a check failing on the pull request's newest commit (whoever made it), or your review.
  - **Coder explains in the chat**, as Claude Code does. No "Coder is working on it" comments on the pull request any more.
  - **For a review comment,** Coder may answer in that comment's thread on GitHub: as you, marked "— Coder (gofarther.dev), for @you". Only in that one thread.
  - **When a comment is unclear,** or the change would be large, Coder asks you first.
- **Same limits as Claude Code:** it can't react to merge conflicts, because GitHub sends no news when the base branch moves. At most 3 tries in a row without you writing in the chat.
- **Change:** chats that had auto-fix on by default now have it off, until you press the button.
- Tests: CD48 updated, CD169-CD171 new. 180 tests pass.

## 2026-11-07: Items 3 and 9: long chats summarized, not cut; Rewind can summarize

- Item 3: in a long chat Coder dropped the oldest part. Claude Code summarizes it.
- Item 9: Rewind could not summarize. (Its three restore choices, code and chat, chat only and code only, were already there from an earlier session; the list was out of date on that point.)
- **Now, like Claude Code:**
  - **Before a job,** a chat that has grown large has its older jobs turned into one summary for Coder. Your newest three messages stay whole.
  - **During a very long job,** Coder summarizes its own earlier steps to make room, and keeps its newest steps whole (Claude Code's "auto-compact").
  - **`/compact`** in the chat turns the whole conversation into a summary without starting a job. You can add what to keep: `/compact keep the API notes`.
  - **Rewind** has two new choices: "Summarize from here" and "Summarize up to here". Each asks what the summary should keep (optional).
  - **Rewind's code choices** show only when a later job changed files.
  - **After the chat goes back,** your message returns to the box, to send again or change.
- The chat on your page still shows every message. A note marks where a summary stands in. Only what Coder reads is shortened.
- Each summary is one Grok call (extra AI use, like Claude Code's). If a summary can't be made, nothing changes, and before a job the old cut is still the fallback.
- Pictures of the new Rewind menu were made on a local copy of the page with made-up data.
- Tests: CD165-CD168; CD105 updated. 177 tests pass.

## 2026-11-07: Item 4: "Compare against" another branch in See changes

- Item 4: See changes only compared with the chat's starting branch.
- **Now, like Claude Code's diff view:** See changes has a "Compare against" list at its top. It starts at the chat's starting branch (marked "base"); pick any other branch of the repository, other chats' branches included, and the changes are shown against that one ("compared with release-2.4").
- The pictures were made on a local copy of the page with made-up chat data.
- Tests: CD17 now also checks comparing with another branch, refusing odd branch names, and the branch list. 173 tests pass.

## 2026-11-07: Live test found a bug: a branch with a "1" in its name looked missing (fixed)

- I started the live test myself on GitHub: issue #9 in testingforclaude, `@coder` asked to run admin commands.
- **Coder could not start:** "canias7/testingforclaude has no branch named coder/testingforclaude-c51d". The branch exists. GitHub made it the repo's default branch, because an earlier Coder chat made the first branch there while the repo was empty.
- **The real cause, a bug from today's earlier work** ("your GitHub login stays outside the machine"): the machine's git hid every value it sent to Coder's server in git's answers, so none could leak into the chat. One of those values is the job's number. For a chat's first job that is 1, so every "1" in git's answer became "[hidden]". The branch name no longer matched, and commit numbers were spoiled too.
- **Fixed:** only the one secret value (the job's pass) is hidden. Test CD164 copies the live case and fails on the old code.
- This needs a deploy before the live test can go on.

## 2026-11-07: Item 12: a security check on each edit, like Claude Code's

- Item 12: nothing checked Coder's edits as it wrote them.
- **Now, like Claude Code's security check on each edit:** everything Coder writes is matched against risky patterns:
  - code that runs text (`eval(`, `new Function`, shell commands built from text);
  - loading untrusted data (`pickle`, unsafe `yaml.load`);
  - putting raw HTML on a page (`innerHTML =`, `dangerouslySetInnerHTML`, `document.write`);
  - database queries built from text;
  - private keys in files;
  - any edit to GitHub workflow files.
- A match adds a warning to Coder's next step, and Coder fixes it or says why it is safe. Nothing is blocked. Each warning shows once per file per job, so it doesn't flood the chat.
- It uses no AI calls, so it costs nothing.
- A repo can add its own rules in `.coder/security-patterns.json` (or `.yaml`), with the same fields as Claude Code's file.
- Not built: Claude Code's two deeper reviews (one after each turn, one on each commit). Each uses extra AI calls. Say if you want them.
- Tests: CD160 (the patterns, and look-alikes they leave alone), CD161 (a repo's own rules), CD162 (a real job: the warning reaches Coder). Also CD163: every file Coder's service needs is copied into the machine image, so a new file can never be left out. 172 tests pass.

## 2026-11-07: Item 10: AGENTS.md and a rules folder, like Claude Code

- Item 10: Coder read only CODER.md.
- **Now, like Claude Code (its names for Coder; CLAUDE.md is still never read):**
  - `CODER.md` and `.coder/CODER.md`: read at the start of every job, as before.
  - `AGENTS.md` (and `.coder/AGENTS.md`): read when the repo has no CODER.md. Many repos already have one for other coding tools, and Claude Code does the same.
  - A rules folder, `.coder/rules/`: each `.md` file in it is a topic rule (testing, code style…), read at the start.
  - A rule can say which files it is for, at its top (`paths: src/api/**/*.ts`). Then it is given to Coder only once Coder reads or changes such a file.
  - A subfolder's own CODER.md (or AGENTS.md) is given to Coder once it works on a file in that folder.
- They are read with the same safety as CODER.md: only plain files, never through a link, before any of Coder's commands run.
- Tests: CD157 (which files load and when), CD158 (the file patterns, as in Claude Code's docs), CD159 (given with the tool's answer, once a job). CD19 updated: AGENTS.md is now read when there is no CODER.md. 168 tests pass.

## 2026-11-07: Item 7: Trusted is now Claude Code's whole list

- Your word: "lets finish off this list". Item 7: the Trusted list was missing the "www." versions of about 30 sites.
- Compared again, whole, against Claude Code's docs (204 sites): 44 were missing. They were the "www." versions, Claude's own sites (claude.ai, anthropic.com, its API and docs) and three Google Cloud hosts. All are added.
- Ours also keeps four extra sites Claude Code's list doesn't name: Debian's two package sites, go.dev and sh.rustup.rs.
- Test CD156 checks Trusted against a copy of Claude Code's list kept in the tests, so a missing site shows up at once.

## 2026-11-07: Merged; the deploy stopped at its safety step (nothing went live)

- Your word: "Ok merge and deploy". Merged to main (b90fe422) and pressed deploy (run 42396319230).
- **The deploy stopped before building or sending anything,** at its own safety step: the admin sandbox's real test (CD147), run as admin on GitHub's own machine. The sandbox did not start there, but it does on my test machine and inside Coder's image (GitHub's image check, all passed).
- The sandbox code did not say why. Now it does: the reason goes into the test's message and into the machine's log on Fly.io ("no admin sandbox (…)").
- GitHub's image check now also runs the deploy's admin tests on GitHub's own machine, first thing. A branch learns about a failure like this in minutes, before any merge.
- **The reason** (GitHub's check, run 42396802053): "coder-sandbox-init.sh: Permission denied". The sandbox's first step runs as the sandbox's own admin, who outside is an ordinary user. On GitHub's machine Coder's code sits in a folder ordinary users cannot open, so it could not read its own start script. (On Fly.io the code sits where everyone can read it, so only the test was hit.)
- **Fixed:** the script's text is now handed over directly, never as a file to open. Tried first with the code in a folder only admin can open: it failed the same way, and passes with the fix.
- GitHub's check then passed everything, the admin tests on GitHub's own machine included. Merged (ee1a0824) and deployed again (run 42398130000).
- **The deploy stopped at the same safety step again, for a new reason.** The deploy runs on GitHub's newest machine (Ubuntu 26.04), which has a newer kind of sudo. The image check ran on Ubuntu 24.04, like Coder's own image. Inside the sandbox sudo worked (it answered "admin"), but also printed a warning about one line of the sandbox's sudo rules ("requiretty"), which only the older sudo knows. That line was never needed, so it is gone. Nothing went live.
- GitHub's image check now runs the admin tests on both kinds of machine: the deploy's (newest Ubuntu) and Coder's image's (24.04).

## 2026-11-07: Docker in the admin sandbox, fourth fix: two sites missing from Trusted

- GitHub's check ran again (run 42368272165). Docker's engine reached the gate and began downloading, but the gate refused one site: `production.cloudfront.docker.com`. Docker Hub now keeps its image files there.
- Claude Code's default list has that site, and also `gcloud.google.com`. Ours didn't: two sites were missed when the list was copied on 2026-11-06. Both are added now. Test CD155 checks them.
- Comparing the two lists again found 42 differences in all. Besides these two, they are the "www." versions of about 30 sites (your item 6 on the list) and Claude's own sites (claude.ai, anthropic.com, its API and docs). Those wait for item 6, as you asked to go one by one.
- GitHub's check runs again with the push.

## 2026-11-07: The setup's saved copy, per environment (like Claude Code's cache)

- Your word: "ok start", for item 1 of the comparison list (Coder's setup was saved per chat, not per environment).
- **What it does now, on Fly.io:**
  - The first chat that runs an environment's setup script, on a fresh disk, has its disk saved by Fly.io right after the setup works. Coder waits a few seconds for that before it starts working. "Fresh" means no job has worked on that disk yet, so a copy never holds an earlier job's leftovers (chats from before this change count as not fresh).
  - A new chat in the same environment gets its disk made from that saved copy. It skips the setup, and the chat says so: "Setup: this chat started from the environment's saved copy… so the setup script did not run again."
  - The saved copy holds what the setup installed on the system and in Coder's home (packages, caches, Docker images).
  - Every chat still clones its repository fresh. The other chat's files, git folder and memory are removed first.
  - Something the setup made inside the project folder (like node_modules) is therefore not there. Coder is told this and runs the project's install itself when it needs to. This matches Claude Code's docs ("Cloud sessions start from a fresh clone of your repository").
  - A new copy is made when the setup script or the network setting changes, after 7 days, or with a new Coder version, like Claude Code. Your variables and keys never reach the setup, so they are not in the copy.
  - If Fly.io cannot make a disk from the copy, the chat starts with an empty disk and runs the setup, as before.
- **Cost:** Fly.io keeps each copy 8 days, at $0.08 per GB a month after the first 10 GB free. The chat whose disk was copied also keeps its own daily copies 8 days instead of 5.
- **Not on Cloudflare** (Cloudflare's containers have no saved copies). It also needs the admin sandbox, so it starts working once the sandbox is deployed.
- Tests: CD151 (Fly.io: the copy is made, kept and used; a refused copy falls back), CD152 (the Worker asks for the copy and points new chats at it), CD153 (the machine waits, then goes; a disk from the copy skips the setup and keeps nothing of the other chat). A picture of the new chat line was made on a local copy of the page.

## 2026-11-07: Docker in the admin sandbox, third fix: its downloads

- GitHub's check ran again (run 42366848802). Docker's engine now started in the sandbox and kept its files in your home folder. It then could not download an image: "network is unreachable".
- **Why:** today's Docker runs its engine in the machine's own network (Docker calls this "detach-netns"). There, Coder's network gate is at 127.0.0.1. Coder's docker command still sent it to 10.0.2.2, the address an older Docker needed.
- **Fixed:** the docker command checks which kind of Docker is installed and gives the engine the right address. Test CD154 checks both kinds, and fails on the old command.
- Tried on my own test machine: the engine now reaches the gate and asks it for Docker's site. GitHub's check, with the real gate, runs again with the push.

## 2026-11-07: Docker in the admin sandbox, second fix

- GitHub's check ran again (run 42365082752). The id fix worked: Docker's engine got further. It then stopped because it could not make its own files in your chat's home folder ("value too large").
- **Why:** inside the sandbox, your folders only showed Coder's own user. Docker gives the users in its containers ids of their own (165536 to 231071), and those were not shown.
- **Fixed:** your folders in the sandbox now also show those Docker ids, the same ids as on disk. They still never show the machine's admin or any other user, so nothing in your folders can be made as admin.
- **Tried for real before pushing:** on my own test machine, Docker failed the same way without the fix. With it, Docker started in the sandbox and ran a container.
- Tests: CD148 checks which ids are shown and which never are. CD147 (the real one, as admin) checks that a Docker id can own a file in your folder, and that admin, user 1000 and others cannot. GitHub's check also confirms the image's Docker ids fit.
- 159 tests pass. GitHub's check runs again with the push.

## 2026-11-07: The admin sandbox in Coder's real image: all passed but Docker; fixed

- GitHub's check (run 42363852080) tried the sandbox in Coder's real image, made into a disk as on Fly.io.
- **Passed:**
  - admin through sudo;
  - `apt-get install` through the network gate;
  - removing a package from the image;
  - a system file;
  - PostgreSQL;
  - port 80;
  - every tool;
  - every wall (no direct internet, only allowed sites, the room unchangeable, nothing of the machine visible);
  - the machine's own files untouched;
  - your files staying Coder's user's.
- **Failed: Docker.** Docker's engine maps its own range of user ids, which in the image is 165536 to 231071. The sandbox only had ids up to 196607 inside, so the system refused.
- **Fixed:** the sandbox now has 262144 ids, enough for Docker's range, and outside it starts at 1000000, clear of every other user's range. Tests updated; 159 pass. GitHub's check runs again with the push.

## 2026-11-07: The two small problems, fixed (on the branch, not deployed yet)

- Your word: "fix this".
- **The setup script runs whole.** Environment takes a script up to 64 KB, but Coder's machine ran only its first 20,000 characters. Now both use one shared limit of 64 KB, so whatever Environment accepts runs in full. Test CD149: a 40,000-character script's last line runs. It fails on the old code.
- **The README says what Coder does now.**
  - Coder pushes its branch after each job. A pull request opens only when you press Create PR or Create draft PR, or ask for one. The old text said it opened one after every job.
  - Coder has many tools. The old text said bash was its only one.
  - A job's start gets 8 minutes, not 3.
  - The setup script never gets your saved keys or variables. The old text said it could use the keys.
  - The project file (CLAUDE.md) had the same "one tool" line; fixed too.
  - Test CD150 checks these lines against the code.
- 159 tests pass.

## 2026-11-07: Admin for anything, in a sealed sandbox (on the branch, not deployed yet)

- Your word: "finish this", about the comparison's line "Claude Code's commands run as full admin. Coder's run as admin only for installing programs, starting services and using ports 80 and 443."
- **What Coder can do now, like Claude Code:**
  - install, remove or upgrade any package;
  - change any system file;
  - start any service;
  - use any port;
  - run any command with `sudo`.
  - The setup script runs this way too.
  - `apt-get`, `apt` and `service` need no `sudo` typed.
- **How it stays safe:** Claude Code keeps its keys and network rules outside its machine; on Fly.io ours are inside the same machine. So Coder's commands run in a sealed sandbox inside the machine:
  - **Inside:** they have admin for anything.
  - **Outside:** that admin is an ordinary, unknown user. It can't leave the network room or change its network. It can't see or stop Coder's own service, read its keys, or touch the machine's own files.
- **What the sandbox is:**
  - **Its system:** the machine's own image, read-only.
  - **Its changes:** a layer on the chat's work disk. What Coder installs stays while the machine sleeps, and a new Coder version starts it fresh.
  - **Your project files:** they stay owned by Coder's ordinary user, so saving to GitHub and Docker work as before.
- **One small difference from Claude Code:** commands run as Coder's own user and use `sudo` for admin, rather than running as admin all the time. Otherwise files Coder makes in your project would be admin's.
- **Checked:**
  - **Fly.io's machines can run it:** your comment at 09:59 showed kernel 6.12, sandboxes allowed, and the overlay system there.
  - **The real test, run as admin here:** admin for anything; dpkg's folder renames; your files stay Coder's user's; the machine's files untouched; the room can't be changed or left; only its own processes and folders are visible; a stop ends everything; installs kept for the next job, and started fresh with a new version. The deploy runs this test as admin too.
  - **GitHub's image check:** it now makes Coder's real image a disk, as on Fly.io, and tries the sandbox there: apt install and remove, a system file, PostgreSQL, port 80, Docker, every tool and the network wall.
- If a machine can't have the sandbox, Coder works as before, with the master key's jobs, and is told which.
- Tests: CD147 (real) and CD148, plus older checks updated. 157 pass.

## 2026-11-07: Coder compared with Claude Code's docs again (after today's work)

- Your word: "before we anything, let compare all we have to claude code docs please".
- The three cloud pages were unchanged since this morning's comparison. This time I also read the pages on GitHub, code review, memory, rewind, scheduled tasks, Projects, the phone app, Remote Control and security checks.
- **Now matching, since this morning:**
  - the machine (4 CPUs, 16 GB, and more disk than Claude Code's 30 GB);
  - Ubuntu with all of Claude Code's tools;
  - installs and services mid-job;
  - the network setting as a real wall.
- **Still partly:**
  - the setup cache is per chat;
  - the setup runs as admin only for apt lines;
  - admin during a job is limited to the master key's jobs;
  - auto-fix details;
  - long chats are cut, not summarized;
  - no compare-to-another-branch;
  - only writable repositories;
  - `gh` is installed but not logged in;
  - "www." sites are missing from the Trusted list;
  - the apps aren't published;
  - Rewind can't do code-only or conversation-only;
  - no AGENTS.md;
  - no automatic review on every pull request;
  - no security checks while writing.
- **Still missing:**
  - permission modes;
  - sending a message while Coder works;
  - share, archive and rename a chat;
  - a prefilled link;
  - a link back to the chat in commits;
  - helper agents, hooks, connectors, skills and plugins;
  - terminal and Remote Control;
  - Projects;
  - scheduled tasks;
  - phone notifications;
  - ultrareview.
- **Still open from this morning:**
  - the setup script is cut at 20,000 characters, though settings take 64 KB;
  - old README lines say Coder opens a pull request after each job, that the setup script can use saved keys, that bash is its only tool, and that a start gets 3 minutes (it's 8 now).

## 2026-11-07: Live test passed: the whole 20 GB system disk, admin rights, the sealed room

- Your comment at 09:41, answered at 09:46:
  - `df -h / /.fly-upper-layer`: **20 GB** on both. The system disk grew from 7.8 GB to the 20 GB Fly.io gave it.
  - Coder's service has every admin right (`CapEff 000001ffffffffff`), including the one the grow needs.
  - `ip -br addr`: only `lo` and `tap0`, so the commands are inside the sealed room (this chat's network is Full).
- **Now proven live on Fly.io today:**
  - the tools;
  - installing a program mid-job;
  - Grok through Coder's server (no key on the machine);
  - each machine's own lock key;
  - 4 CPUs and 15 GB;
  - a 10 GB work disk;
  - the 20 GB system disk;
  - the sealed room, also after a restart;
  - GitHub jobs that start from the every-minute check.
- **Not tried live yet:** a chat whose network is Trusted or None, where the room has no internet link of its own. GitHub's check proved it in the real image. To see it live, set testingforclaude's network to Trusted and run the curl again; it should print 000.

## 2026-11-07: Deployed: the disk grow finds Fly.io's disk

- Your word: "merge and deploy". Main b46f9a3b, run 42359923774, every step passing, the machine image rebuilt.
- **Live checks:** the site answers, and the app refuses anyone not signed in.
- **Next:** your test comment, which checks the disk size and the admin right the grow needs.

## 2026-11-07: The fifth test: the sealed room works live; the disk grow missed its disk (now deployed)

- Your comment at 09:17 was answered at 09:21, after the new image's first download.
- **The room works on Fly.io now:**
  - Coder's commands see only their own loopback and `tap0`, not the machine's `eth0`.
  - The room is real (`nsfs`).
  - `tap0` is the room's own internet link, which Coder only adds for the **Full** network setting. So this chat's environment is set to Full, and the direct request's 200 is right.
  - Under Trusted or None there is no `tap0` (GitHub's check showed 000 in the real image). To see it live, set testingforclaude's network to Trusted.
- **The disk still showed 7.8 GB.** Your next comment (09:24) showed why: Fly.io names that disk `/dev/vdb[/upper]` (a folder on the disk), and Coder's start-up step expected exactly `/dev/vdb`. It took that for "no disk to grow" and did nothing. The disk is 20 GB, ext4, and resize2fs is installed.
- **The fix:** read the disk's name without the folder (`findmnt --nofsroot`, and anything in brackets dropped), and write what it did in the machine's log.
  - Tried here on a test disk mounted the same way. This sandbox refuses the grow itself because it lacks one admin right, `CAP_SYS_RESOURCE`, which Fly.io's machines should have. The next test checks that right on the machine too.
- Test: CD146 now uses Fly.io's own way of naming the disk. 155 pass.

## 2026-11-07: Deployed: the sealed room after a restart, and the whole 20 GB system disk

- Your word: "merge and deploy". Main 1056ea0c, run 42357874840, every step passing, the machine image rebuilt and sent to Fly.io.
- **Live checks:** the site answers, the app refuses anyone not signed in, and the Grok address refuses a request with no pass.
- **Next:** your test comment. The first start fetches the new image, so it may take a few minutes.

## 2026-11-07: The sealed room after a restart, and the whole 20 GB system disk (now deployed)

- Your fourth comment (08:42) confirmed both causes:
  - `/run/netns/coder-room` was a plain file left on the kept disk, made at 08:21. The machine had restarted at 08:33, so the room was gone. No gate relay was running.
  - Fly.io's disk for the machine's own changes is 20 GB, but the filesystem on it is 7.8 GB.
  - Coder refused to print its proxy address in a public reply. That was right.
- **Fix 1, the room:** a room now counts only if Coder can actually get into it. If only the name is left after a restart, Coder removes it and makes the room again. So every job is inside the wall again.
- **Fix 2, the disk:** when Coder's machine starts, it grows the filesystem to fill the 20 GB disk Fly.io gave it, while in use, the way cloud machines do at boot. It never holds up the start; anything unexpected, and it does nothing. The full image now lists e2fsprogs (which has the tool for this) explicitly.
- Tests:
  - The real room test, run as admin with real network namespaces, now includes a restart that leaves only the name. It fails on the old code and passes on the new one.
  - GitHub's machine check runs the same restart in Coder's real image.
  - CD146 covers the disk.
  - 155 in all pass.
- This changes the machine image, so the deploy rebuilds it (about 13 minutes). Each chat's machine then gets it the next time it wakes.
- **GitHub's machine check passed** (run 42356997602, in Coder's real image). Every tool works, and the room is sealed for Trusted, None and Full. After a restart that left only the room's name, the room was made again: no direct internet, and npm reachable through the gate.

## 2026-11-07: The third test: almost everything works live; the sealed room is not in use

- Your third comment (08:32) was answered at 08:35, all five commands run.
- **Works live:**
  - Coder reaches Grok through its server, so the machine has no AI key.
  - Every tool is "ok".
  - `apt-get install figlet` worked mid-job with the master key.
  - The machine has 4 CPUs and 15 GB of memory, the new size.
  - The work disk is 10 GB.
  - Coder answered within 3 minutes.
- **Not working:** `curl --noproxy '*' https://example.com` printed 200. Under the default setting (Trusted) the sealed room should block that.
  - Your follow-up (08:37) showed why: Coder's commands see the machine's own network card (`eth0`). In the room they would see only their own loopback. So the room isn't being used on Fly.io, and commands run as before step 3 (only a guard for tools that use the proxy).
- **Likely cause:** on Fly.io the machine's own disk is kept while it sleeps, and the place where the room's name lives (/run) is kept with it. After a restart the name is still there but the room is gone. Coder sees the name, thinks the room exists, can't get into it, and falls back to no room.
  - It worked in the GitHub check because that machine is always fresh.
  - A follow-up comment checks this before the fix.
- **The system disk:** `lsblk` shows a 20 GB disk mounted for the machine's own changes (`/.fly-upper-layer`), so the 20 GB did arrive. `df` reports 7.8 GB for `/`; the follow-up also checks which of the two Coder's installs really use.

## 2026-11-07: Deployed: the Grok pass fix

- Your word: "ok". Main 33f8a97d, run 42355635500, every step passing. The machine image didn't change.
- **Live checks:** the site answers, the app refuses anyone not signed in, and the Grok address refuses a request with no pass.
- **Next:** your third test comment on testingforclaude #2.

## 2026-11-07: The second test: the start fix worked, and a step 1 slip found (now deployed)

- Your second test comment (08:19:59) got "On it" in 4 seconds. The job started at the next minute's check, and the comment was updated at 08:22. So the start fix works live.
- **But the job failed:** "The AI could not be reached: no AI key in Coder's container".
- **Why:** Coder's server sent the machine two things under the same name, `model`: the pass to Grok (step 1), and then the model's name, which replaced the pass. So the machine had no pass, and it no longer has its own key, by design.
  - The earlier tests checked each part on its own. One test even expected the name to be sent as `model`, so the clash slipped through.
- **The fix:** only the pass goes as `model`. The machine reads that same field for the model too. Coder has one model (Grok 4.7), so the machine picks it, at the effort you chose.
  - The fix is only in Coder's server, so the 7 GB machine image doesn't need rebuilding.
- New test CD145 follows a message from the app all the way to what the machine reads: its Grok pass, then Grok 4.7 at the chosen effort.
  - It also fails if `model` is ever sent twice again.
  - It also fails if a second model is added before the model's name gets its own field.
- 154 tests pass.

## 2026-11-07: Deployed: bigger machines and the GitHub start fix

- Your word: "ok" (to merge and deploy).
- Main c6f4a3fb, run 42354646813, every step passing. The machine image didn't change, so it wasn't rebuilt.
- **Live checks:**
  - the site answers;
  - the app refuses anyone not signed in;
  - the Grok address refuses a request with no pass;
  - GitHub's address refuses an unsigned call.
- **Next:** your new test comment on testingforclaude #2. It adds `nproc && free -g`, to show the 4 CPUs and 16 GB.

## 2026-11-07: Why your test comment stayed at "On it", and the fix (now deployed)

- Your word: "you do it" (look into the stuck test).
- **What happened:** when a GitHub comment comes in, Coder answers GitHub straight away and posts "On it". Cloudflare then gives Coder only 30 more seconds to finish what it's doing. Starting your job took minutes, because the machine first had to download the new 6.9 GB toolbox. So Cloudflare cut it off before Coder had written down "come back and update this comment". Nothing was left to update it, so it will stay at "On it".
- I couldn't open the chat to look: the test account's saved browser sign-in had expired, and signing in again would send an email. The reason above comes from Cloudflare's own documentation (the 30-second limit) and from the code. Your test comment was never answered at all, which only happens when that note is missing.
- **The fix:** Coder now writes the note first, together with the message it has to send. The every-minute check, which Cloudflare lets run for 15 minutes, starts the job and keeps watching it. Your comment gets "On it" at once, and the job starts within a minute.
  - If starting fails, Coder says why in place of "On it".
  - It's never started twice, even when a start is slow.
  - Two @coder comments on the same chat start one at a time, as before.
  - Auto-fixes start the same way.
- Test: CD144, plus the GitHub tests updated (153 in all).
- After the deploy, comment on testingforclaude #2 again. The old "On it" comment won't change.

## 2026-11-07: Bigger machines on Fly.io (now deployed)

- Your choices: "4 CPUs, 16 GB" and "Grow to 50 GB". For Cloudflare, "it wont be off", so Cloudflare's backup containers stay as they are.
- **Why:** each chat had 2 of Fly.io's "shared" CPUs and 4 GB. Fly slows a shared CPU to 1/16 of a CPU after a short burst, and a shared machine's disk is 4 times slower. So installs, builds and tests crawled.
- **Now each chat gets:**
  - 4 full-speed CPUs and 16 GB of memory, the same as Claude Code's machine;
  - a work disk that starts at 10 GB and grows by itself, 10 GB at a time when it is 80% full, up to 50 GB.
- **Cost:** about $0.25 an hour while a chat is working, instead of $0.035. A machine stops after 10 quiet minutes. A sleeping chat's work disk is $0.15 per GB a month, so only chats that use the extra room pay for it.
- **If Fly.io has no room for the size:** that chat gets the size from before, so it still works. It tries the big size again with Coder's next version.
- **Chats made before:** they get the new size the next time they wake, never in the middle of a job. Like a new Coder version, this starts the machine's own disk fresh; the chat's files on its work disk stay.
- Tests: CD143, plus the Fly.io tests updated (152 in all).

## 2026-11-07: Deployed: all of Claude Code's tools, and steps 1 to 4

- Your word: "merge and deploy". Main 3a9bbb3d, run 42349243500, all steps passing.
  - The tests ran first, including the room's admin-only test on GitHub's machine.
  - Fly.io's shared keys were removed.
  - The big machine image was built once and sent to Fly.io.
- **Live checks:** the site and health check answer. Coder's git address refuses a request without a pass. The new Grok address refuses a request with no pass and with a made-up pass. The app refuses anyone not signed in.
- **Waiting:** your test comment on testingforclaude #2 (the network wall, check-tools, installing figlet mid-job, the disks).

## 2026-11-07: Before deploying: the first start after the deploy is given time to fetch the big image

- Your word: "merge and deploy".
- Coder gave a machine 60 seconds to answer. A machine being made or updated first fetches the new image, about 6.9 GB, which can take longer. So the first chat after the deploy could have failed with "did not answer".
- Now a machine being made or updated gets 5 minutes, and a plain wake still gets 1 minute. A job counts as lost only after 8 minutes, so a start is never given up on while its machine may still be fetching.
- Test: CD142 (151 in all, plus 16 admin-only).

## 2026-11-07: Step 4 of 4: the master key's everyday jobs (on the branch, not deployed yet)

- Your word: "ok go with the rest".
- **What Coder can do now, mid-job, like Claude Code:**
  - install any Ubuntu system program (`apt-get install`, also written `sudo apt-get install`), with no setup-script card and no restart;
  - start, stop and restart any installed service;
  - use ports 80 and 443 inside its own room.
- **How:** Coder's commands may run exactly one program as admin. It checks every request:
  - only package names, never an apt option (some apt options would run any command as admin);
  - only installed services, and only start, stop, restart, reload or status.
  - Anything else is refused with a plain message.
- With a limited network, its downloads go through Coder's gate too, so your setting holds.
- **Honest limit:** this is not the whole master key. Editing system files, or any other admin command, would need a full container system with the machine's disk mirrored for it. That's a multi-day job with real risk, so it's not done. Removing packages is also refused: removing something like git would quietly break how Coder saves your work.
- Tests: the GitHub machine check installs a program as Coder's own user, starts Redis, serves on port 80 in the room, and checks that `sudo bash`, `apt-get remove`, a trick apt option and a sneaky service name are all refused (150 tests in all, plus 16 admin-only).
- **The GitHub machine check passed** (run 42348124083):
  - As Coder's own user, `apt-get install figlet` and `sudo apt-get install` installed and ran it.
  - `sudo service redis-server start` started Redis (it answered PONG) and it stopped again.
  - Everything else was refused.
  - A server on port 80 worked in the room.
  - The room stayed sealed for every network setting.

## 2026-11-07: Step 3 of 4: the sealed room, so your network setting is a real wall (on the branch, not deployed yet)

- Your word: "ok go with the rest".
- **Why:** on Fly.io, Coder's old wall (a firewall rule matched by user) cannot work: Fly.io's machines lack the kernel piece it needs. So the network setting was a guard that ordinary tools follow, not a wall.
- **Now Coder's commands run in a sealed room:** a network of their own, owned by Coder's program, with only one way out: a pipe to Coder's gate, which checks your network setting. With Full access, the room also gets its own internet link. The AI has no rights over the room's network, so it cannot open another way out. A change of setting reaches the room at once.
- If a machine can't make the room, commands run as before, and Coder is told the list is then only a guard.
- **Tried for real here, as admin:**
  - The pipe to the gate works.
  - Everything else is sealed: the machine's other services, the internet over IPv4 and IPv6, direct website requests.
  - Every attempt by an ordinary user to change the room's network is refused, including slipping into the machine's own network.
  - Full access turns the room's link on, and off again.
- The deploy now runs that test as admin. The GitHub machine check also tries the room in Coder's real image, with the real gate and real websites, for each setting: None, Trusted and Full.
- Tests: CD140 and CD141 (150 in all, plus 16 admin-only).
- **The GitHub machine check passed** (run 42347544465), in Coder's real image with the real gate and real websites:
  - Trusted: going straight to the internet is blocked, a site not allowed is refused, npm is reached.
  - None: going straight to the internet is blocked, a site not allowed is refused, npm is refused too.
  - Full: the room's own link is up and reaches the internet, and switching back takes it away.
  - "THE ROOM: SEALED".

## 2026-11-07: Step 2 of 4: each chat's machine has its own lock key (on the branch, not deployed yet)

- Before: one lock key opened every chat's machine's controls. On Fly.io a machine can be reached from the internet, so a chat that ever read its own key could have worked another chat's machine.
- Now each Fly.io machine's key is a strong code made from Coder's secret and that machine's own name. Knowing one machine's key gives nothing for another's.
- Machines made before this keep the old key until their next update, so a deploy never locks out a job that is running.
- Fly.io itself no longer keeps any of Coder's keys: the deploy removes the shared copies.
- Cloudflare's backup machines keep the old key: they cannot be reached from outside.
- Tests: CD139, and the Fly.io tests now check that each machine gets its own key (148 in all, all passing).

## 2026-11-07: Step 1 of 4: your Grok key never goes to Coder's machine (on the branch, not deployed yet)

- Your word: "ok", to the plan: 1. the Grok key out of the machine, 2. each machine its own lock key, 3. a sealed room for Coder's commands whose only door to the internet is Coder's gate (this makes your network setting a real wall on Fly.io), 4. the master key inside that room, like Claude Code.
- **Found while checking:** Fly.io's machines lack the kernel piece Coder's firewall rule needs (a Fly.io forum thread from 2026-10-12). So on Fly.io your network setting (None, Trusted, Custom) is probably a guard that ordinary tools follow, not a wall. Your GitHub login and saved keys are not affected: they are added outside the machine. Step 3 fixes this. The test comment you were given will show it for sure.
- **Step 1, done:** each job gets a short pass for its AI calls, for one chat, one message and 3 hours. The machine sends every Grok call to Coder's server with it. The server checks the pass, allows only Coder's own model, and adds your key. Fly.io's machines and Cloudflare's backup machines are no longer given the key, and the deploy removes the copy Fly.io has.
- Tests: CD137 and CD138 (147 in all, all passing, plus the 14 admin-only safety tests). The machine check on GitHub passed again with this change (run 42345836203).

## 2026-11-07: All of Claude Code's tools on Coder's machine (on the branch, not deployed yet)

- Your word: "can we install all the tools we need?", about this line of the comparison: Claude Code comes with Python, Node, Ruby, PHP, Java, Go, Rust, C/C++, Docker, PostgreSQL, Redis, Chrome, gh and more.
- **The machine is now Ubuntu 24.04, the same system as Claude Code's machine, with the same tools.**
  - Python (uv, poetry, pytest, mypy, black, ruff), Node 22 and 24, Ruby 3.1, 3.2 and 3.3, PHP 8.3, Java 21 with Maven and Gradle, Go, Rust, C/C++.
  - Docker, PostgreSQL 16, Redis 7, Chrome, and gh, yq, tmux, vim, nano.
  - The same `check-tools` command that lists them all.
- **Plus what Claude Code's real machine has beyond its docs** (your word: "ok", after "anymore tools missing?"):
  - ffmpeg (video and audio), ImageMagick (images), pdftotext, pandoc.
  - Python's document and data libraries (Excel, Word, PowerPoint, PDF, numpy, pandas).
  - Playwright with its own browser, for scripted browser tests and screenshots.
  - Debugging tools: strace, lsof, valgrind, netcat.
  - Left out on purpose: Google Cloud's tools (useless without a Google login on the machine), Nix (rarely needed), and LibreOffice: the full image is about 5.2 GB without these extras and about 6.7 GB with them, and LibreOffice would bring it near Fly.io's 8 GB limit, leaving too little room for what chats install.
- **The machine's own disk may now grow to 20 GB** (Fly.io's default is 8 GB, and the full image alone is about 6.9 GB). With the chat's 10 GB disk that is 30 GB, the same as Claude Code's machine. Fly.io bills a sleeping machine's disk only by what is used, so this costs nothing unless it is used. If Fly.io ever refuses the setting, the machine is made as today.
- **The first check on GitHub** (before the extras): every tool worked as Coder's own user except Docker running a container, because on the test machine Coder's home sat on the image's layered disk. On Fly.io it sits on the chat's own plain disk, so the test now does the same.
- **Fly.io's machines get the full set; Cloudflare's backup machines keep a small image.** Cloudflare's limit is 8 GB an image and 50 GB in all.
- **Coder still never has admin rights.**
  - Docker runs as Coder's own user ("rootless").
  - The two databases start with the same commands as on Claude Code's machine (`service postgresql start`). Coder may run exactly those through the admin's `sudo`, and nothing else.
- **Coder's commands have a home folder of their own.** What they install for themselves, and every download cache, go there. Before, the home was the project folder itself, so a cache could have been saved to your branch. On Fly.io the home is on the chat's kept disk, so it survives sleep and new versions.
- **Coder is told what its machine has,** like a developer who knows their computer.
- **A deploy builds the big image only when the machine changes.** It takes a while; otherwise a deploy stays as quick as now.
- **A new check runs on GitHub whenever the machine changes on a branch.** It builds both images and tries every tool as Coder's own user. It deploys nothing and uses no secrets.
- **Costs:**
  - A sleeping chat's machine costs about $0.15 a month per GB of its image on Fly.io. That's about $0.70 a month instead of about $0.25 (my estimate).
  - A brand-new chat's first start will be a bit slower.
- **The check on GitHub passed** (run 42342573805): both images build, Coder's service starts in both, and every tool works as Coder's own user, Docker included. Things it installs for itself land in its own home. The full image is about 6.9 GB.
- Tests: CD133 to CD136 (145 in all, all passing, plus the 14 admin-only safety tests).

## 2026-11-07: A deploy no longer resets the chats' machines for nothing

- Your word: "merge and deploy". Before that deploy: every deploy gave Coder's machine a new version name, even when nothing in the machine had changed. Each chat's machine then started its own disk fresh on its next wake and ran its setup again.
- Now the name changes only when Coder's machine itself changes (its folder, `coder/container`). A deploy of anything else, like these notes or the website, leaves the machines and their kept disks as they are.
- This deploy changes the name once, so each chat's machine starts fresh one last time.
- **Deployed** (your word: "merge and deploy"): main 52dba3d5, run 42336015163, all steps passing. The machine's version is now `coder-2cb107d3b512`, named after its folder. The site and Coder's health check answer, and Coder's git address still refuses a request without a pass.

## 2026-11-07: Your GitHub login stays off Coder's machines; a sleeping machine keeps what it installed (like Claude Code)

- Your word: "Do 1 and 3", from the comparison with Claude Code.
- **1. Your GitHub login never goes to Coder's machine now**, like Claude Code ("GitHub credentials ... never enter the session VM").
  - The machine gets only a short pass for its chat, valid for one message and 3 hours.
  - Its git goes through Coder's server, which checks the pass and adds your login on the way to GitHub.
  - Git can read the chat's own repos, and push only to the chat's own branch. It can never delete a branch or push a tag. The one exception is the very first commit of an empty repo's main branch, which Coder makes when it opens one.
  - Tested for real on a computer, with git's own GitHub-style server standing in for GitHub: it read and saved through Coder's server, and the stand-in only ever saw your login, added by the server. A push to main, a deletion and a tag were all refused.
- **3. A sleeping machine keeps its whole disk**, so what the setup installed is still there and the setup doesn't run again, like Claude Code. This uses Fly.io's own setting for it. If Fly.io ever refuses the setting, the machine is made without it and the setup runs again, as before.
  - A new Coder version still starts the machine fresh, as Claude Code does after its cache expires.
  - The machine now reports whether its disk was kept, so I can check it live.
- Tests: CD130 to CD132. 141 in all, all passing, plus the 14 admin-only safety tests.
- **Deployed** (your word: "Merge and deploy"): main df610f55, run 42333195974, all steps passing. Coder's git address refuses a request without a pass.
- **Live test 1, saving through Coder's server:** you wrote `@coder add a line saying "fly test" to notes.md` on testingforclaude issue #2 at 03:30:22. The machine woke with the new version, and the commit "Added `fly test` to `notes.md`" was on the chat's branch at 03:30:57. That could only have gone through Coder's server, because the machine no longer has your login. The machine reported `"kept": false`, as expected the first time after a new version.
- **Live test 2, the kept disk:** the machine went to sleep by itself at 03:42:47. Your next comment at 03:44:37 woke it, and it reported `"kept": true`: its whole disk was kept while it slept, so the setup didn't run again, like Claude Code. Coder answered at 03:45:57, about 1 minute 20 seconds, the fastest yet. Before this change a woken machine took about 1 minute 45 seconds, and the first job on a new machine about 2 minutes 20 seconds.

## 2026-11-07: Deployed: Coder's machines on Fly.io, and the chat saved as it goes

- Your word: "Merge and deploy". You made the Fly.io account and saved its token in GitHub as `FLY_API_TOKEN`.
- Merged into main (9421b902) and deployed (run 42325783438). Every step passed, including the tests on GitHub and the admin-only safety tests.
- **On Fly.io:** the app `gofarther-coder-machines` was made, with its internet address and Coder's keys. Coder's machine was built and sent to Fly.io. The site now runs chats' machines on Fly.io (checked in the deploy's log).
- Also live now: jobs keep going when you close the tab, the machine hold, and the chat saved as it goes.
- Checked from outside: the site is up with the new page. Coder refuses anyone not signed in, and its saving address refuses a sender without a job's pass.
- **One more safety step, deployed too:** each Fly.io machine is always given its lock key directly, and a machine without one answers nothing but its health check. Fly.io machines are on the internet, so the key is their only lock; before, it reached them only as a Fly.io secret. Your word: "Merge and deploy". Merged into main (75f65ec8) and deployed (run 42326567782), all steps passing, before the first chat on Fly.io. Tests: 138, plus the 14 admin-only safety tests.
- **Live test on Fly.io (2026-11-07):** you wrote "@coder say hi and list the files in this repo" on canias7/testingforclaude issue #2 at 02:21:35. Coder said "On it" 4 seconds later, made the chat's machine and disk on Fly.io, ran the job, and answered at 02:23:55, about 2 minutes 20 seconds in all, including making the machine: "Done. Hi @canias7. Files in this repo: README.md, notes.md, setup-ran.txt."
  - Checked from outside through Fly.io's front door: the machine answers as Coder's own, in Fly.io's Virginia region (iad). A request without Coder's key is refused ("not allowed"), so the lock works.
  - **It went to sleep by itself at 02:34:54**, about 11 minutes after the job ended (10 quiet minutes, then the every-minute check). Asleep, it costs only its disk.
  - **It woke up for the next message:** your second comment at 02:46:13 woke the sleeping machine. Coder answered at 02:47:58, about 1 minute 45 seconds in all, faster than the first job: "This repo currently has README.md, notes.md, and setup-ran.txt." The machine answers again on Fly.io's front door.
  - So it behaves like Claude Code's machines: one machine per chat, asleep when quiet, woken by your next message with its disk kept.

## 2026-11-07: Coder's machines can run on Fly.io (like Claude Code's VMs)

- Your word: "YES OPTION 2", then "OK LETS START THEN".
- **Each chat gets its own small VM on Fly.io:** 2 shared CPUs, 4 GB of memory and a 10 GB kept disk. It's made from the same Coder machine as today.
- **It stops after 10 quiet minutes, and its disk is kept.** Your next message starts it again; Fly says a stopped machine starts "well under a second", then Coder starts. A job that is working, or waiting to be saved, keeps it on.
- **Your files stay on that disk between messages:** the repo, Coder's changes, and the project's installed packages (like node_modules). The setup script runs again after a restart, which puts back its system packages.
- **Coder gives a machine its newest version only while it's asleep**, never during a job. The disk stays.
- **A machine unused for 30 days is removed with its disk**, like Claude Code's "reclaimed after a period of inactivity". Removing a chat removes its machine at once. Finished work is always on GitHub.
- **Cloudflare stays as the backup.** The deploy button has a new choice: machines on "fly" or "cloudflare".
- **Cost (Fly.io's prices):** about 3.5 cents an hour while a machine runs, and 15 cents per GB a month for each kept disk. A 10 GB disk is $1.50 a month while its chat is kept.
- Fly.io's front door cuts a request that is quiet for 60 seconds, so on long requests (a job's setup) the machine sends a small "still working" signal every 15 seconds.
- Not live yet. Waiting on you: a Fly.io account, its token in GitHub, then "merge and deploy".
- Tests: CD125 to CD129, 138 in all, all passing, plus the 14 admin-only safety tests.

## 2026-11-07: The chat is saved as it goes (like Claude Code)

- Your word: "Do this" (Coder only saved a job's chat when the job ended, so a machine that crashed mid-job lost that job's steps).
- **Now Coder's machine sends each job's new steps to Coder's server every 3 seconds**, and the conversation every 15 seconds. They are kept locked (encrypted) until the job is saved, then deleted.
- **If the machine is lost mid-job** (it restarted, went to sleep, or stopped answering), the steps so far stay in the chat. Your saved values are hidden, as always. A note says the job ended there and its unsaved file changes are gone. Coder is told the same, so your next message carries on from there.
- **Closing the tab right after sending is safe too.** Before, if you closed it while Coder was still setting up (the clone, the setup script), the job could run with nobody saving it, because Cloudflare stops a request whose tab is gone (the old builder's notes say the same). Now the chat counts the job as started before Coder's machine is asked to start it.
- This also fixes a setup script not being able to use your saved keys.
- Tests: CD118 to CD124. 133 in all, all passing. On the branch, not deployed.

## 2026-11-06: A job keeps going when you close the tab (like Claude Code)

- From your screenshots: item 1, "Closing the tab", which I had missed. Before, Coder's machine went to sleep after 10 minutes with no tab open, and the job was lost. A finished job was also only saved while a tab was open.
- **Now each job goes on a watch list when it starts.** Every minute, Coder's server checks each job on the list:
  - this keeps the job's machine awake;
  - when the job ends, the server saves it just as an open tab would: pushed to its branch, the chat kept, and Coder remembers it next time.
- A job comes off the list when it ends, or after 2 hours (a job works for 45 minutes at most).
- While Coder works, the message box says "Coder is working… you can close this tab".
- If a tab stays open while the job is saved somewhere else, it loads the saved chat by itself, with the "Saved to the branch" line.
- **Your question: how Claude Code does it.** Its jobs run on its own cloud machines. The chat history is kept on its servers, so the browser is only a window: "The session keeps running after you close your laptop, and you can check on it or steer it from any device." A machine pauses "after a few minutes without activity", with its files saved.
- **You were right: the old builder had it.** Its "container hold" asked the machine "are you still working?" just before it was put to sleep, and kept it on if so, with a time limit so a stuck one never ran (and cost) for good. Coder now does the same: the machine stays on while a job works (2 hours at most) or while a finished job waits to be saved (30 minutes at most), and sleeps as before otherwise. The every-minute check stays; it is what saves the job when no tab is open.
- Tests: CD112 to CD117. 126 in all, all passing.

## 2026-11-06: Deployed: audit items 3 and 4, and Coder like Claude Code

- Your word: "Merge and deploy". Merged into main (3d57f2b4) and deployed (run 42306004077), with the admin-only safety tests passing on GitHub too.
- Checked from outside, with no sign-in and no Grok: the page is up and has the new parts (Create PR buttons, Rewind, the branch and repository menus); the page sends the sign-in proof; Coder's API refuses anyone not signed in; the key adder refuses anything without a job's pass; model.gofarther.dev doesn't answer.
- **Everyone signs in once more, you too** (password, then the emailed code). Reload any Coder window already open (desktop app: View, then Reload; phone: close the app and open it again). Coder's machines pick up the new image for new chats within about 10 minutes.
- No recorded browser test this time: it would need a sign-in, which emails a code, and tests never send sign-in emails.

## 2026-11-06: Audit items 1, 2 and 4 done; Coder closer to Claude Code

- Your word: "Do 1,2,3,4", then "Finish all this" (about the differences from Claude Code's docs).
- **1. The open model server is gone.** Its address was deleted. It was the only one using its tunnel, and none of your Workers used it. Nobody on the internet can reach it now. The tunnel itself ("gofarther-ml") is still listed in Cloudflare, because GitHub's Cloudflare key can't delete tunnels. You can delete it there (Zero Trust, Networks, Tunnels), and switch off the computer that ran it.
  - "list old stuff" now also lists DNS records, tunnels, and which Workers use them. "delete old stuff" has a second word, DELETE MODEL SERVER, that deletes only this.
- **2. The old gofarther-ai project is stopped, and its data is kept.** Its 6 scheduled jobs are switched off (they were the only thing still using it; one deleted rows older than 90 days every night). The table that let any account mark a mail domain as its own is closed, and so is the one anyone could change. Its 21 working functions now answer "shut down" (the other 4 already did). Their code was saved first, twice, and the two copies were compared; you have it as a file in the chat. Nothing was sent from it since July.
- **4. The last gaps in Coder's machine are closed.** While Coder's app runs git, any other repository inside the project is moved aside and put back after, so git can't open one the AI made. A final check had found three more ways in; all three are tested now.
- **Like Claude Code (from the comparison with its docs):**
  - On GitHub, a stranger's @coder gets no reply at all. Auto-fix asks you first when a review comment is unclear. Coder's questions show their choices on GitHub (they showed "[object Object]").
  - **Create PR** and **Create draft PR** buttons in the chat bar, once the branch has work. Coder writes the title and description.
  - **Web pages are read by a separate reader.** It answers Coder's question from the page, so nothing hidden in a page reaches Coder itself. Pages up to 100,000 characters, each read once per 15 minutes.
  - **The starting branch** is picked under the message box before the first message, next to the environment.
  - **Review on the pull request:** when you ask, Coder posts its findings as comments on the pull request's lines.
  - **Rewind:** each of your messages has a Rewind button: restore the code and the chat, the chat only, or the code only. Code goes back by undoing the later jobs with new commits, never by deleting anything on GitHub.
  - **Network and key changes reach a job that is already running**, like Claude Code ("within about a minute"): every running chat on that environment gets them at once. A job started from GitHub gets the network setting, never the keys.
  - **Keys are added outside Coder's machine**, like Claude Code. Your saved keys' values no longer go to the machine. Its proxy sends each request for a keyed site to Coder's server with that job's own pass, and the server adds the key and sends it on (headers, body keys, OAuth, Google Cloud and AWS signing, the same as before). So nothing on the machine, even with admin rights, can read a key. It can only use one for its own sites, while its job runs.
  - **Several repositories in one chat**, like Claude Code: under the message box, before the first message, "+ Repository" adds up to 3 more of yours (each shows as a tag with ×). Each one gets its own folder next to the chat's first one, prepared and saved the same safe way, on the chat's branch in its own repository. Coder can work in all of them, and open a pull request in any of them. Rewind, Undo and See changes still cover the chat's first repository only.
  - Kept as they are: Coder reads CODER.md (your word: "we not doing claude md we doing coder md"), and only the setup script's install lines run as admin (safer than Claude Code's whole script).
- Tests: CD98 to CD111 and CD94b, plus the others above; 120 in all, passing. On the branch, not deployed.

## 2026-11-06: The emailed code is really required now (audit item 3)

- Your word: "Do 1,2,3,4". This is 3.
- **Both steps, every time.** Signing in is still your password, then the code we email you. What changed is that Coder's server now checks that both steps really happened on gofarther.dev before it lets anyone use Coder.
  - The password step gives the page a ticket that lasts 15 minutes. The code is only accepted with that ticket, for the same email. If it runs out, the card goes back to the password step and says "Start again".
  - The code step gives the session plus the server's own proof. The page sends the proof with every Coder call. Without it, Coder answers "Sign in again."
  - A new account also needs the emailed code.
  - The password check no longer leaves a spare session behind. Only that one is ended, never your other devices.
- **Three reviewers checked it. I fixed everything they found:**
  - **A gap around password resets is closed too.** Coder now remembers your password the first time you sign in after this ships (a scrambled copy that can't be turned back into your password), and later sign-ins must use that same password.
  - **If you ever change your password outside Coder** (Supabase's dashboard or a reset email), Coder will say "That email and password do not match." To fix it, delete one file in Cloudflare: R2, bucket `gofarther-coder`, `coder/<your user id>/signin-pin.json`. The next sign-in then remembers the new password.
  - **Wrong codes are limited:** 5 tries per email every 15 minutes. After that, the card says how many minutes to wait. A right code resets the count. A new password step doesn't. If the storage ever refuses the counting, sign-in still works.
  - **A short hiccup no longer signs you out.** If the sign-in service is busy or down when your session needs renewing, you stay signed in and Coder says to try again in a minute.
  - **What you were typing is kept.** When Coder sends you back to sign in, the text in the chat box (or a message that was on its way) comes back in the box after you sign in.
  - **Old Coder tabs reload by themselves.** A tab left open from before this change now moves to the new page as soon as you open a new one. Before this fix, it would have signed you out about once an hour.
- **No more stuck page.** When a session ends (you signed out on another device, for example), the page now goes back to the sign-in card, which says "Sign in again." It does this once, never in a loop. If the sign-in service can't be reached, you stay signed in and Coder says to try again in a minute.
- **After this goes live, everyone signs in once more, you too.** Sessions from before have no proof. That's expected. Also reload any Coder window that was already open (desktop app: View, then Reload; phone: close the app and open it again).
- No new design: "Sign in again." and the new messages appear in the sign-in card's usual message line.
- Tests: CD86 to CD89 (new file `coder/test/auth-proof.test.mjs`). CD13 and CD22 changed only where the ticket and proof are now needed. CD22 now also gives the account's id and the bucket, which the password step needs.
- On a branch, not deployed. Live after "merge and deploy".

## 2026-11-06: Audit item 4, first part: three reviewers checked the fix, and their findings are fixed

- Your word: "Do 1,2,3,4". Three reviewers checked the fix below. All 14 of their findings were right, and they're fixed. A few of their suggested methods were changed, and the reasons are in the record.
- **The AI's leftover programs are really stopped now.** A program that keeps restarting itself under a new number could survive the old stop and change files while the app was saving. Now the system stops all of the AI's programs at once. If that fails, the app doesn't touch the files.
- **Giving files to the AI's user can't be tricked.** If a folder was swapped for a link at just the wrong moment, files outside the project could be handed over. The app now holds each folder open while it works in it.
- **Nothing is left out without a word.** If a save skips a folder that has its own repository, the chat says "Not saved: …" and names it. A submodule the AI moved to a newer commit (like "update the theme") is saved again. The app reads the commit itself and never runs git inside that folder.
- **Faster saves on big projects.** Folders git ignores (like node_modules) aren't searched any more. On a test project with 176,000 files, that check went from 0.5 s to under 0.1 s. Handing the files over at the start of a job takes 0.6 to 0.9 s instead of 1 to 1.6 s.
- A folder nested too deep for the system no longer blocks a chat. The job still starts, and the save names the folder to delete.
- The app reads CODER.md and the memory file only if they're the AI's own plain files, never a second name for another file.
- **The deploy button now also runs the safety tests that need admin rights.** Before, it skipped them.
- 8 new tests (98 in all). They pass as admin, and as a normal user with the admin-only ones skipped. On the branch, not deployed.

## 2026-11-06: Audit item 4, first part: Coder's app can't be steered by the AI's files

- Your word: "Do 1,2,3,4". This is the first part of 4 (two of the root findings on Coder's machine).
- **A repository the AI makes inside a project is left alone.** Before every save, undo or branch switch, Coder's app looks for any folder in the project that has its own `.git`. Git never runs inside it and it's never saved, not even as a submodule. Everything else is saved as before. Repositories with ordinary submodules work as before, and a folder that is plain again (its `.git` removed) is saved again.
- **Project folders can't be swapped.** The folder holding all projects now belongs to the app, not to the AI's user. The app makes each project's folder itself and gives only that folder to the AI's user. If a project's folder is ever a link, the app refuses to work in it and says so.
- **Giving files to the AI's user** now goes one file at a time. Links are never followed, and a file that also lives somewhere else (a hard link) keeps its owner.
- The app runs git by its full name, with system folders only.
- Very rare: if a folder with its own repository has a name that isn't plain text, Coder says so and doesn't save until it's renamed.
- 5 new tests (CD90 to CD94); all 90 pass. On the branch, not deployed.

## 2026-11-06: Full platform audit

- Your word: "do full platform audit, imma go to bed".
- It was read-only. Nothing was changed, deployed or merged. No Grok calls were made, and no sign-in emails were sent.
- It covered 19 areas: the 15 planned, plus 4 that a final check said were missing. Separate reviewers challenged each finding, and duplicates were merged. Your usage limit cut off the last 12 checks, so I checked those against the code myself.
- **The report is not in this repository.** The repository is public, and the report describes problems that are still live. You have it as a file in the chat (`audit-2026-11-06.md`).
- The audit had left a folder of test keys (`ca/`) in the repo folder. I moved it out before anything was committed.
- Nothing gets fixed until you choose what to fix.

## 2026-11-06: Environments like Claude Code's

- Your word: "make it like claude code", after I checked Claude Code's docs (code.claude.com/docs/en/cloud-environments).
- **Your own environments.** Environments now belong to you, have names, and aren't tied to repos. Default is made for you.
  - Each environment holds the network setting, the keys, the setup script and the variables, and they apply to every chat that uses it. A key saved from one chat reaches every chat on that environment.
- **Picking one.** A chat picks its environment under the message box, before its first message, like Claude Code's picker. "+ Add environment…" makes a new one and opens it.
  - After the first message the pick is fixed, as in Claude Code's docs. The Environment button then edits that environment.
  - A repo's next chat starts with the environment used (or made) most recently for that repo.
- **The Environment window** shows the environment's name, with a Name row to rename it and "Archive this environment". Default can't be renamed or archived.
  - An archived environment leaves the list, but chats that already use it keep working.
- **Nothing is lost.** Each repo's settings from before move into an environment named after the repo the first time one of its chats needs them. The old files stay where they were.
- **Coder's cards.**
  - Coder knows which environment the chat uses. Its setup-script and "Allow this site?" cards name that environment, and the key card says the key is saved on it.
  - Like the "testing2" card you saw in Claude Code: when a chat uses Default and something is only for this repo, Coder offers "Create new environment?" (name, network, repository, setup script; Deny / Create environment). This chat keeps its environment, and new chats of this repo start with the new one.
- Previews checked on the live page with this new page code; live after "merge and deploy".

## 2026-11-06: Like Claude Code: the question card, undo when it isn't clear, where a saved key lives (2, 3, 4)

- You tested all 18 tools in Claude Code and in Coder, and asked for 2, 3 and 4 of the differences.
- 2. **The question card** now looks and works like Claude Code's.
  - The question sits on top, and each choice has a short explanation under it. The recommended choice is first, says "(Recommended)" and is already chosen.
  - There's an "Other" choice with a box to type your own answer, and Coder can allow several choices.
  - Skip and Submit buttons (Ctrl+Enter also submits), and a "Needs your input" tag while it waits.
  - Your choice is kept even if the page redraws. Questions in older chats still show.
- 3. **Undo when it isn't clear.** If Coder's last job changed nothing (like a review) and you say "undo", it first asks which one you mean, the way Claude Code did: that job's files, or something else such as an environment change or a saved key. Coder's app now tells Coder which job is the last one that changed files, and the undo tool won't run until you've chosen. When the last job did change files, undo happens straight away, as before.
- 4. **After you save a key** on the card and Coder uses it, Coder says in one line where it's saved (this repo, only sent to that site) and that you can remove it in Environment → Network secrets.
- You said there's a bigger difference you noticed; waiting for it.
- On the branch; live after "merge and deploy".

## 2026-11-06: Deployed, and the same test recorded again in the browser

- Merged and deployed (your word). Same browser test, recorded again (3.4 minutes, sent in the chat):
  - tree was installed as admin and ran (v2.1.0);
  - the broken line was reported with its exit code and where to fix it;
  - the card came only after Coder ran the line;
  - after Decline, Coder now says the right thing: "The setup script change was declined, so it stays as echo "setup ok" > setup-ran.txt."
- The chat's top bar stays on one line in the video.
- Coder's tools right now, listed for you: read, write, edit, grep, glob, lsp, bash, monitor, stop_job, web_fetch, Grok's web search, ask_user, todo, request_secret, propose_env, review, undo_last_job, pull_request (18).

## 2026-11-06: Recorded browser test of the setup script, and one fix

- Your word: live tests in the browser, recorded. Done on gofarther.dev with the test account, only by clicking and typing. Recording: 3.4 minutes, sent in the chat.
  - In the Environment window, network set to Trusted and setup script set to `apt-get install -y tree`. Coder's app installed tree as admin, and Coder ran `tree --version` (v2.1.0).
  - A broken line added in the window: Coder said which command failed (exit 127) and that it can be fixed in Environment → Setup script.
  - Script and network put back in the window. Asked for a "cache" folder line, Coder ran it first, then showed the card. Decline worked.
- Found: after Decline, Coder said the script "still has the failing nonexistent-tool-xyz line", which you had already removed in the window. Coder trusted its memory of the chat over the script it was given.
- Fixed: when you change the setup script or network in Environment between messages, Coder's app tells Coder in the message itself, with the new script and whether it ran fine. The note stays in the chat's history. The chat still shows only your words.
- On the branch; live after "merge and deploy".

## 2026-11-06: The chat's top bar stays on one line

- Your "Ok" to the fix: on a computer, a long chat title or branch no longer pushes "See changes" onto a second line.
- They are shortened with "…" instead, and the whole name shows when you point at it. The branch gives way first, then the title.
- The repository name stays whole unless the window is narrow (under 1100 pixels).
- Phones keep their layout.
- Preview checked at 1280 and 1024 pixels wide. Live after "merge and deploy".
- Your word for live tests from now on: done in the browser, the way you'd use it (Environment window, chat box, cards), and recorded.

## 2026-11-06: Setup script changes deployed and checked live

- Merged and deployed (your word). Checked in a new chat on the test repo:
  - 1. On the Trusted network, the setup line `apt-get install -y tree` was installed as admin by Coder's app ("Setting up tree (2.1.0-1)"), and Coder then ran `tree --version` (v2.1.0).
  - 2. With a broken setup line, Coder said: "The setup script failed: nonexistent-tool-xyz --install exited with code 127 (command not found). You can fix it in Environment → Setup script; new chats run the fixed script." No card was forced.
  - 3. Asked to add a line that makes a cache folder, Coder first ran `mkdir -p cache`, then the whole new script, and only then showed the card.
- The test repo was set back afterwards: the original setup script, Full network.

## 2026-11-06: The setup script, like Claude Code's (all 3)

- Your word: "Do the 3 of them", after comparing Coder with Claude Code's docs.
- 1. **System packages.** In Claude Code the setup script runs as admin, so `apt install` works. Now a setup line like `apt-get install -y jq` works in Coder too, with or without sudo.
  - Coder's app runs those lines itself, as admin. Only the checked package names go to apt, and your network setting applies.
  - Every other line still runs as Coder's own user. So a setup script can never reach your GitHub token or keys: on Coder's machine they sit next to it, while Claude Code keeps them off its machine.
  - The Setup script page says so.
- 2. **A failed setup, the way Claude Code handles it.** Coder says which command failed and its exit code, and that you can fix it in Environment → Setup script. It offers a fix on the card only if it has one it tried. It carries on with the rest of the work and never makes up results. This replaces the change from earlier today that forced a card every time.
- 3. **Only tried lines.** Like Claude Code, Coder only proposes setup lines it ran itself in that chat and saw work. A package must exist; the machine now keeps Debian's package list so names can be checked.
- On the branch; live after "merge and deploy".

## 2026-11-06: Deployed, and the fixes checked live

- Merged and deployed (your word). The Setup script page shows its new line, and links no longer swallow bold text.
- Checked live in a new chat:
  - Coder named the main branch and the chat's branch correctly ("The main branch is coder/testingforclaude-c51d, and this chat is on coder/testingforclaude-58qkcgew").
  - A broken setup script is now raised: "nonexistent-tool-xyz --install failed because that command is not installed (exit 127)". But Coder didn't put a fix on the card by itself.
- So the reminder now asks Coder to put the fixed script on the card straight away, with the failed command as the card's reason. This is on the branch and goes live after the next "merge and deploy".

## 2026-11-06: Full live test of Coder, and three fixes it found

- Your word: "lets just test all we added". Tested live on gofarther.dev (test account, canias7/testingforclaude, real Grok and GitHub). All passed:
  - a new chat answers;
  - every tool in one job (search, read, write, edit, commands, code check, web fetch, background job with check and stop, the checklist);
  - question buttons; a picture ("BLUE 42"); @README.md;
  - memory in a new chat ("teal"); an "always" style in a new chat, then forgotten; a CODER.md rule;
  - Low and Extra high effort;
  - review and security review (as Coder's own tools); undo;
  - pull request #8; @coder on GitHub (Coder's bot answered on the pull request); auto-fix from a review comment (it deleted the file and updated #8);
  - the Environment window (4 rows, 4 network levels, 7 secret types, script, variables);
  - None and Trusted networks with the "Allow Coder to reach example.com?" card (Approve, then 200);
  - the key card (the key arrived; it never showed on the page); a Basic key added in the window, reachable even on None, only under its path;
  - Stop; two chats working at once; See changes; Remove chat; the front page and sign-in card.
- Found and fixed (on the branch, live after "merge and deploy"):
  - 1. Coder proposed `sudo apt-get install jq` for the setup script. The setup script runs as Coder's own user, without root, so that can never work, and every new chat's setup then failed. Coder is now told this; a proposal with sudo or apt-get is refused with the way that works (install into the project: npm ci, a Python virtualenv); and the Setup script page says it in one line.
  - 2. After a failed setup, Coder answered "Hi. What do you want to work on?" as if nothing had happened, although its instructions said to raise it. Now it is always reminded once, before it finishes, to name the failed command and propose a fix on the card (like the install reminder).
  - 3. Coder guessed the main branch was called `main`, and a command failed in a repo where it isn't. It is now told the repo's main branch and this chat's branch, like Claude Code.
- Noticed, not changed: variable values show as [hidden] in the chat (on purpose, from the audit). The test repo's main branch is still named `coder/testingforclaude-c51d`, left over from before the empty-repo fix.

## 2026-11-06: The iPhone app is in TestFlight

- The owner created the app in App Store Connect (GOFARTHER, dev.gofarther.app); Apple's API refuses to make apps ("The resource 'apps' does not allow 'CREATE'"), so that one step stays on the website.
- Then the "build phone apps" button with "testflight" ticked: the app ID check passed, the iPhone app was built, signed by Apple's cloud signing with the owner's key, and uploaded: "Upload succeeded … EXPORT SUCCEEDED". Apple processes a new build for a few minutes before it shows in TestFlight.
- To install on an iPhone: the TestFlight app from the App Store, and the owner added as an internal tester in App Store Connect → the app → TestFlight.
- (The run's wording no longer blames the key's role when Apple refuses an action it never allows.)

## 2026-11-06: TestFlight run: app ID registered; it now tries to make the app too

- The second press got through the secrets check and registered the app ID dev.gofarther.app with Apple using the owner's key, then stopped: the app isn't in App Store Connect yet.
- Owner: "can't you do that". The run now also tries to make the app in App Store Connect with the key. If Apple allows it, the run carries straight on to build, sign and send to TestFlight; if Apple refuses (its API may not allow making apps), it shows Apple's own words and the steps for the short form in App Store Connect.

## 2026-11-06: First TestFlight press: one secret missing, and a fix

- The first press stopped at the secrets check: APPLE_API_KEY_ID isn't in GitHub's secrets yet (the other three are). Nothing reached Apple.
- My bug, fixed: the check (and the key clean-up) ran in a folder that doesn't exist before the code is checked out. The check now also drops a space or new line pasted with a value (the Team ID had one), and names any value that doesn't look right (Team ID and Key ID: 10 letters and numbers; Issuer ID: the long ID with dashes; the key: the whole .p8 file).

## 2026-11-06: The Apple key goes in GitHub's secrets, not the chat

- The owner offered to give the Apple API key in the chat. Not in the chat (it would be stored in the conversation; the rule is Claude never sees secret values): the owner puts it in GitHub's secrets, and GitHub's Mac machine uses it.
- The TestFlight run now first uses the key to register the app ID (dev.gofarther.app) with Apple when it isn't there, and checks the app exists in App Store Connect, stopping at once with a plain message if not (Apple's API cannot create the app itself, so that one step stays in App Store Connect). A wrong key gets a message naming the secrets to check.

## 2026-11-06: Phone apps build; TestFlight ready to switch on

- "build phone apps" ran: the Android app (GoFarther-android.apk, 3.7 MB) and the iPhone app (Xcode: BUILD SUCCEEDED, ID dev.gofarther.app) both build on GitHub's machines, free.
- The button now has a "testflight" box: it signs the iPhone app with Apple's cloud signing (an App Store Connect API key; no certificate files copied anywhere) and sends it to TestFlight, to install on a real iPhone. It needs four GitHub secrets the owner adds: APPLE_TEAM_ID, APPLE_API_KEY_ID, APPLE_API_ISSUER_ID, APPLE_API_KEY_P8. The key file exists only during the run and is removed after.
- The app answers Apple's encryption question once in its settings (it only uses standard HTTPS), so TestFlight doesn't ask on every build.

## 2026-11-06: Live checks after the outage fix, and a small display fix

- Live: Coder's machine starts again (a new chat answered "Hi. What do you want to work on?").
- Live, Trusted network: npm answered 200; example.com was blocked ("CONNECT tunnel failed, response 403"); web_fetch on example.com was blocked by the site list too. The test repo is back to Full.
- Fixed: a link right before the end of bold text swallowed the closing ** ("**curl https://…:**" showed its asterisks). Links no longer take a * at the end.

## 2026-11-06: The phone apps, started (iPhone and Android)

- coder/mobile: the phone app (Capacitor), gofarther.dev in its own app like the desktop one, named Go Farther with the GF icon and a plain GF splash screen (ID dev.gofarther.app).
- In the phone app the page hides the download buttons, opens links to other sites in the app's own browser sheet (so the app never gets stuck on another site), and keeps GitHub's sign-in inside so Connect GitHub comes back to the app. Checked by pretending to be the app in a browser.
- The page now keeps clear of the status bar, the notch and the home bar on phones (zero on computers, so nothing changes there).
- A new button, "build phone apps": the Android app as GoFarther-android.apk (installs on an Android phone directly), and the iPhone app built for the simulator to check it compiles. Free (public repository).
- Next: the owner has the Apple certificates; with them as GitHub secrets the iPhone build can be signed and sent to TestFlight, to install on a real iPhone.

## 2026-11-06: Fix: Coder's machine could not start after the last deploy

- My mistake in the deploy that matched the Environment to Claude Code's docs: the new file that signs and fetches tokens for secrets (coder-auth.mjs) was not on the list of files copied onto Coder's machine. The machine's program could not start, so every Coder job failed with "Failed to start container" from that deploy until this fix is deployed.
- Fixed (one line in the container's Dockerfile), and a new test builds exactly the files the Dockerfile copies and checks the program starts, so a missing file fails the tests before any deploy.
- The live check of the new Environment window itself passed: saving Trusted from the window, adding a secret with the Add secret form (listed without its value) and removing it all worked; the test repo is back to Full.

## 2026-11-06: Desktop and phone apps, started

- The plan (owner: "start making the desktop apps and mobile apps … so we don't stay behind"): the apps are gofarther.dev in their own window, like Claude's desktop app is claude.ai. So every feature built on the site shows up in the desktop and phone apps at once, with no separate app updates. The apps add what only apps can: their own icon, menu and shortcuts, and later notifications.
- Phones, now: gofarther.dev can be installed from the phone's browser (iPhone: Share → Add to Home Screen; Android: menu → Install app). It opens full-screen with the GF icon, named Go Farther. Chrome's own check finds nothing stopping it.
- Desktop, built and tested here: coder/desktop (Electron, what Claude's and VS Code's desktop apps use). One window; the usual menu (copy and paste on a Mac need it); links to other sites open in the browser; GitHub's sign-in stays inside so Connect GitHub works; a small offline page; only notifications and copying allowed. Inside the app the page hides its "Download for Mac / Windows" buttons.
- A new button, "build desktop apps" (GitHub Actions), makes GoFarther-mac.dmg and GoFarther-windows.exe on GitHub's Mac and Windows machines. Free: the repository is public. By default it only keeps the files with the run; ticking "publish" makes a public release the front page's Download buttons can point to.
- Not signed yet: that needs the Apple Developer Program ($99 a year, also needed for the iPhone app) and, optionally, a Windows certificate. Until then the Mac asks once in System Settings → Privacy & Security → "Open Anyway", and Windows shows "Windows protected your PC" → More info → Run anyway.
- Next: the phone apps (Android first: it can be installed without a store; iPhone needs the Apple account). Google Play is $25 once.

## 2026-11-06: Environment matched to Claude Code's docs (1-7)

Checked against code.claude.com/docs/en/cloud-environments.
- 1. Four network levels, like Claude Code's: None, Trusted (the default list), Full, and Custom (your own sites, with an "Also include the default list" box). Older "Limited" settings read as Custom with the default list.
- 2. New repos start on Trusted, like Claude Code's Default environment (was Full). Repos already saved as Full stay Full. Approving "Allow this site?" on Trusted switches to Custom with the default list plus that site.
- 3. The default list is Claude Code's: about 160 sites (npm, PyPI, RubyGems, crates, Go, Maven, NuGet and other registries; GitHub, GitLab, Bitbucket; Docker and other container registries; Google Cloud, Azure, AWS; Ubuntu, Anaconda, HashiCorp, Datadog and more).
- 4. Sites with a saved secret stay reachable at every level, even None.
- 5. Keys are never sent to package registries, GitHub or Anthropic's API, even if a secret lists them.
- 6. The setup script gets about 5 minutes (was 10), and runs again when the script or the network setting changes, or after about 7 days, like Claude Code's cache.
- 7. More secret types: body parameter (added to JSON and form bodies), OAuth 2.0 client credentials (token fetched and renewed by the proxy), Google Cloud service account, and AWS SigV4 (each request signed; checked against AWS's own test examples).
- Coder's web_fetch follows the site list like any other request; the docs name only GitHub, connectors, sites with a saved secret and Anthropic's own API as skipping it. Grok's web search (on xAI's side) is unaffected.

## 2026-11-06: The Environment window, like Claude Code's

- The Environment button opens a window like Claude Code's "Edit cloud environment": four rows (Network access, Network secrets, Setup script, Environment variables), each with its own page, Back, Cancel and Save changes.
- Network access: None (no internet at all), Limited (package sites plus the sites you allow, `*.example.com` allowed) or Full.
- Network secrets: a list with remove, and an Add secret form: name, secret type, one or more websites (`*.` for subdomains), optional path prefixes, one or more headers (name, prefix, value), and a "resolved curl example". Coder never sees the values; Coder's own key card still works too.
- Setup script: a code box with Choose file (up to 64 KB) and copy.
- Environment variables: one box in .env format. Like Claude Code's, the values are shown again and are not for secrets.

## 2026-11-06: Live test fixes: no node_modules on the branch, paragraphs, commit titles

- Live test passed: the setup-script offer after `npm install` (card shown; Decline kept the script), no Review/Undo buttons in the top bar, "do a security review" used Coder's review tool, "undo that last job" reverted it, answers show bullet lists.
- Found and fixed: (1) a job's `npm install` put node_modules and npm's cache on the branch; installed packages and caches are now never committed (Python, Rust and Yarn ones too). (2) When Grok's answer came in two parts (before and after a web search) they ran together ("tips.- Keep"); now two paragraphs. (3) A job that ended with a card got a commit titled "proposed a new setup script"; it now uses what Coder said about the work.

## 2026-11-06: Fix: Coder offers installs for the setup script

- Live test: Coder ran `npm install` for a new package and finished without offering to add it to the setup script. Now, when a job ran an install the setup script doesn't do, Coder's app reminds it once before it finishes, and it offers the change on the approval card. Not for GitHub jobs.
- The fake Stripe test key was deleted from the test repo.

## 2026-11-06: Review and Undo are now things Coder does when asked; nicer answers

- The Review menu and the Undo button are gone from the chat's top bar. Instead Coder has two new tools it calls itself: "review" (code or security; it gets the branch's changes plus the checklist and answers with findings, changing nothing) and "undo_last_job" (the app reverts the last job's commit and pushes when the turn ends, like the old button). Just say "review my changes", "do a security review" or "undo that".
- Answers are formatted: bullet and numbered lists, small headings, bold, `code`, links, and source marks like [[1]] show as small numbered chips.
- Tested live: the setup-install offer (2) is checked in the next live run.

## 2026-11-06: Fix: Limited network crashed Coder's machine

- Live test: with Limited on, the first blocked request ("example.com") crashed the whole machine ("Coder's machine restarted"). A connection reset on a blocked site had no error handler. Fixed, plus a safety net so a network error can never stop every job again.
- Coder's tool output no longer shows Node's "experimental" proxy warning.
- Live so far: effort picker ✓ (Low/Medium/High/Extra high, High selected); setup script saw no variable ✓ (var=[]); failed setup → Coder named the command and exit 127 and proposed a fixed script on the card ✓; Approve saved it ✓.

## 2026-11-06: Effort levels match xAI's docs

- xAI's reasoning guide (docs.x.ai/docs/guides/reasoning) lists Grok 4.7's efforts as low, medium, high (its default) and xhigh. The picker now offers Low, Medium, High and Extra high, and starts on High like xAI (it was Medium, and Extra high was missing). The landing page chip says High.

## 2026-11-06: Environment like Claude Code's (1-5)

- 1. The setup script can no longer read the owner's variables or keys (it runs with neither, like Claude Code).
- 5. A new approval card: Coder proposes an environment change with a tool (propose_env), the card shows exactly what would change, and nothing changes until the owner presses Approve.
- 2. After Coder had to install something every chat needs (npm ci…), it proposes adding it to the setup script on that card.
- 3. When the setup script fails, Coder is told the exit code and output, says which command failed, and proposes a fixed script on the card.
- 4. Network access per repo, in the Environment panel: Open (any public site, as before) or Limited (package sites like npm, PyPI, GitHub, plus the repo's list, plus sites with saved keys). A blocked request tells Coder, which asks "Allow Coder to reach this site?" on the card. Where the machine allows it, a firewall makes the proxy the only way out; where it doesn't, the list still covers tools that use the proxy setting, and Coder is told which.
- None of this can be proposed from GitHub jobs.

## 2026-11-06: Last audit item: keys stay hidden even if removed mid-job

- Each job's key values are kept sealed until the job ends, so its saved chat still hides them if the owner removes the key while the job runs.

## 2026-11-06: Audit #3 fixes (secrets and the latest changes)

- The key middleman can no longer be crashed by a bad request (bad port, broken request, odd characters); before, one bad request from Grok's commands could stop every chat on that machine.
- Keys only go in real key headers (Authorization, or names ending in Key/Token/Auth/Secret), never in ones a website copies back like Origin or Host. The card now shows how the key is sent. If a website copies the key into its answer's headers anyway, that header is dropped before Grok's command sees it.
- Keys must be plain characters (no spaces, no accents); "Basic" keys get the trailing colon Stripe-style APIs expect.
- The memory file is handed to Grok's user through the already-open file, so a swapped-in link can no longer trick root into giving away a protected file. Leftover commands from an earlier job are stopped when a new job starts.
- Jobs from GitHub can't ask for keys, and never get the "welcome back" recap (it would be posted publicly).
- @coder on a pull request from a fork no longer tries to use the fork's branch.

## 2026-11-06: Fix: Coder pops up the key card instead of explaining

- Live test: asked to check a Stripe balance with no key saved, Grok told the owner to export a variable instead of opening the card. Its instructions now say to call request_secret right away and never to give set-up steps for keys.

## 2026-11-06: Secrets that Coder never sees (like Claude Code's network secrets)

- When a job needs an API key (Stripe, OpenAI…), Coder asks with a new tool, request_secret, and a card pops up in the chat: "Coder needs a secret for api.stripe.com", a box for the key, Decline / Save. Nothing is shown anywhere until Coder asks.
- The key is saved sealed with the repo's environment (Coder's storage, never GitHub, never the chat). On each job, a small proxy on Coder's machine adds it to HTTPS requests for that one host. Grok and its commands never have the key: they just call https://api.stripe.com/... and the proxy fills it in.
- Not given to jobs started from GitHub (@coder, auto-fix), same as the variables. If a key ever shows up in output, the saved chat shows [hidden].
- Saved keys appear in the Environment panel only as host names, with x to remove one.
- Works for curl, Python, git and most tools; Node's own fetch only when it honours the proxy setting.

## 2026-11-06: @coder jobs show a short label in the chat

- Retest found the chat showing Coder's whole safety wrapper for an @coder comment. It now shows "@you on GitHub: what you asked", like auto-fix's short label. Coder still gets the full, wrapped text.

## 2026-11-06: Coder's file tools can open its own memory file

- In the retest, saving or forgetting a style showed a red "error" step: the read tool only opens files inside the project, and Coder's memory file is kept outside it (so it never reaches GitHub). Coder fell back to the shell and finished, but it looked broken. Now read, write and edit may also open that one memory file, nothing else outside the project, and never through a link.

## 2026-11-05: Fix: pictures stay for the whole job

- Full retest found it: since the audit change "pictures go to Grok once", a job that read files first and described the picture at the end had lost it, and Grok invented one ("a teal square with a robot"). Pictures now stay for every step of the job (like Claude), and leave only the saved history afterwards. Costs a little more per job with a picture; correctness first.

## 2026-11-05: Saved styles followed strictly (like Claude Code's output style)

- Live test: "always keep it short" was saved in memory but a new chat only half-followed it. In Claude Code a chosen output style is its own setting with its own instructions, not a memory note. So now Coder saves a style as one memory line starting "Style:", and those lines are given to it as their own "THE OWNER'S STYLE" section right after its main instructions, overriding the default. "Forget it" deletes the line.

## 2026-11-05: How Coder talks (its main instructions rewritten)

- On your word, Coder's system prompt has a new "HOW YOU TALK" part: it leads with the answer; short and plain by default; shows evidence ("npm test: 12 passing", the error line), never "all tests pass" without the command; adapts to whatever you ask ("explain…", "teach me…", "keep it short", or any style you describe) for the rest of the chat, and if you say "always" it saves that style in its memory for the repo.
- From the Claude Code docs: comments in code only where the code is not obvious (or when asked); pull request descriptions say what changed, why, how it was checked and any risks; and when you come back to a chat after 2+ hours it starts with a one-line recap.
- No fixed style picker (your call: "more customizable, whatever the user asks").
- Default style is EXPLANATORY (your word): after the result, Coder explains what it changed and why, with an "Insight:" line for non-obvious choices. "Keep it short" / "less explaining" switches to the brief style.

## 2026-11-05: Noted for later: buttons → tools the model calls

- Your word: features like Review, Security review (and similar front-end buttons such as Undo) should become TOOLS that Coder calls itself when you ask in the chat ("review my changes"), not front-end buttons. Parked for later.

## 2026-11-05: Live test of the edge cases (recorded)

- Gloopy tab shows "Coming soon." Security review ran and found nothing serious, with reasons.
- Auto-fix off switch: with it Off, a failing check on pull request #5 started no fix for 3 minutes; switched back On.
- Binary files: read and edit both refused with "is a binary file (not text); use bash".
- Web fetch to local addresses (localhost, cloud metadata, a disguised IPv6 loopback): Grok refused to even try, twice; our own block was checked against real addresses on a machine earlier.
- Not tested live (covered by the automated tests): a 1 MB write (it would cost a lot of Grok output), fork protection (needs a second GitHub account), the 3-tries limit (Coder fixes on the first try), Undo overlap (Undo always reverses the newest job). Finishing GitHub connect needs you (Disconnect → Connect on your account).

## 2026-11-05: Live test of the rest (recorded)

- CODER.md: Coder added one with a rule ("End every answer with: -- checked by Coder") and every later answer in that chat followed it.
- Memory per repo: told to remember "the owner's favourite colour is teal" in one chat; a brand-new chat answered "Teal." without opening files.
- Comments on diff lines: a comment on the workflow's node-version line ("use Node 22") was done exactly.
- Workflows permission works: Coder added .github/workflows/test.yml.
- Auto-fix from a failed check: Coder opened pull request #5 with a deliberate bug; GitHub's check failed; within seconds Coder fixed it, ran the same test (passed) and updated #5.
- Small fix: the chat line for an auto-fix now shows the real reason ("Auto-fix: The check "test" failed") instead of the safety label.

## 2026-11-05: @coder on a pull request works on that pull request's branch

- Live test: `@coder` on pull request #4 did the job in a new chat on a new branch, so the change would not have shown in the pull request. Now, on Coder's own pull request, @coder continues the chat that owns its branch; on anyone else's pull request (same repo, never a fork), a new chat starts from that pull request's branch.

## 2026-11-05: Full live test, and the landing-page text fix

- Recorded live run on gofarther.dev (test account, real Grok and GitHub): every tool worked (todo, glob, read, write, edit, grep, lsp diagnostics, bash, background job + check + stop, web fetch, Grok's web search), the question buttons (Coder then fixed the type error), Environment (setup ran; GREETING set but never printed), pictures (a clear picture read exactly; a faint one was misread by Grok), @file, Review (real findings), a pull request from the chat (#4), See changes, Undo (Revert commit), and the Remove box.
- Found: what you type on the landing page is not carried into the chat box after sign-in. A fix was made, then reverted on your word ("not worried about the landing page thing").

## 2026-11-05: Audit #2 fixes (1, 2, 5, 6, 10, 11, 12)

- **1. Forks can't trigger auto-fix.** A failed check counts only for a pull request inside the repo itself (not a fork, whose branch could be named like Coder's) and only on Coder's own latest commit. Reviews on fork pull requests are ignored too.
- **2. GitHub text can't steer Coder.** Issue, pull request, review and CI-log text is wrapped and labelled as untrusted data; Coder is told never to reveal secrets and that its answer is posted publicly. Jobs started from GitHub get the setup script but NOT your environment variables, and variable values are replaced by [hidden] in saved chats (so they can't reach GitHub).
- **5. Web fetch** blocks every private/local address in all its written forms, and checks the address at the moment it connects (no swap between checking and fetching).
- **6. GitHub connect is tied to your browser** (a random value in a cookie must match), so a link made by someone else can't attach your GitHub to their account. Reconnecting another GitHub account or disconnecting clears the old login, and @coder checks the login still belongs to that account.
- **10. Pictures go to Grok once** per message, not on every step.
- **11. Big writes** (up to about 1 MB) go through a file instead of the command line; read/edit refuse huge files (20 MB / 5 MB) and binary files with a clear message.
- **12. Two @coder comments** each keep their own record; chat ids are 8 random characters and never reuse an existing chat or branch.

## 2026-11-05: Tool steps: option A without colours

- You chose option A without the colours (renders in the chat). Every step now shows a grey icon for its tool (terminal, file, pencil, magnifier, folder, code brackets, globe, eye, square, gear), a dark verb (Ran, Read, Edited, Searched…), the target in code type, and on the right ✓, "✕ error" or "running". Not deployed yet.

## 2026-11-05: Live test: auto-fix from a review

- You left a review (Comment) on testingforclaude pull request #3: "rename notes.txt to notes.md, add a title, delete setup-ran.txt". Coder picked it up by itself, did all three on the branch, and pull request #3 was updated (checked on GitHub: notes.md with "# Notes", no notes.txt, no setup-ran.txt).
- On your own pull requests GitHub only allows "Comment" (not "Request changes"); Coder treats both the same.

## 2026-11-05: Auto-fix finds older chats too

- Chats made before Coder recorded whose branch is whose (e.g. the @coder chat on testingforclaude) are now found by their branch name, so auto-fix works on their pull requests too.
- Live: Review worked (it even flagged the setup file that was being committed, the bug fixed just before). Pull request #3 on testingforclaude is ready for the auto-fix test.

## 2026-11-05: Live retest, and setup files kept off the branch

- Live on gofarther.dev (test account): the picture was described correctly, "Ran setup" showed and its file existed, the variable was there (Coder refused to print it: "that variable is a secret"), @README.md was read first, and the message showed once.
- Found and fixed: files the setup script makes were being saved to the branch (an `npm ci` would have committed node_modules). They now go in the git folder's own ignore list, so only Coder's real changes are saved.

## 2026-11-05: Fix: pictures said "too big"

- The live test found that attaching a picture always said "That picture is too big": the page's safety rules block the way it was read. It is now read another way (allowed by those rules).

## 2026-11-05: Auto-fix pull requests

- On your word ("4"): when a check fails on a pull request from one of Coder's branches, or YOU review it (changes requested, a comment, or a line comment), Coder posts "working on a fix (try N of 3)" on the pull request, reads the failed run's log (GitHub Actions), fixes it in that branch's chat, and the comment becomes the result. If the cause is not in its changes, or the review is unclear, it explains instead of changing code.
- At most 3 tries in a row; your own message in the chat starts the count again. Reviews from other people and bots are ignored (they cannot spend your Grok). An "Auto-fix: On/Off" switch sits next to the pull request link.
- Needs on the GitHub app: Checks read-only, Actions read-only, and the events "Check run" and "Pull request review".

## 2026-11-05: Environment per repo

- On your word ("14"): an "Environment" button in the chat's top bar. Per repository: a setup script (e.g. `npm ci`) that runs as the limited user when Coder's machine first opens the repo, and again only when you change it ("Ran setup" in the chat, with its output); and variables (e.g. a test API key) that Coder's commands can use. Values are sealed like the GitHub key and never shown again (only names). Names that steer the machine (PATH, HOME, LD_*, NODE_OPTIONS, CODER_*) are refused.

## 2026-11-05: Review and Security review

- On your word ("5"): a "Review ▾" button in the chat's top bar with "Review changes" (bugs, edge cases, missing tests) and "Security review" (injection, secrets, auth, XSS…). Coder compares its branch with main, runs tests if there are any, changes nothing, and answers with a short list of findings with file, line and a fix. The request is written on the server. `@coder review this` on GitHub works too.

## 2026-11-05: Pictures and @files in the chat

- On your word ("16"): attach a picture with the paperclip in the chat box, or paste one (up to 4 a message, made smaller first). Grok sees it with that message; the saved history keeps only a note, so chats stay small. Your message shows the picture.
- Type `@` in the chat box: the repo's file names are suggested as you type; pick one with Enter or a click. Coder is told to read the files you pointed at.

## 2026-11-05: Live test: @coder, Undo, the locked control panel

- `@coder say hi and list the files in this repo` on canias7/testingforclaude issue #2: gofarther-coder [Bot] answered, the job ran on Coder, and within a minute the bot's comment became "@canias7 Done." with Coder's answer. The first try was refused because the test account had not opened Coder since the deploy (its email was not saved yet); opening Coder once fixed it.
- Undo on the live site: the branch on GitHub got a "Revert …" commit and the file was gone.
- Normal chats still work with the control panel locked.

## 2026-11-05: Undo last job

- On your word ("add 2"): each Coder job that changes files is one commit. An "Undo last job" button (top bar, next to See changes) asks first in Coder's own box, then reverses that commit with a new "Revert …" commit and saves it to the branch. Nothing is force-overwritten; you can undo several jobs in a row. Coder is told, so it knows the change is gone. If later changes touch the same lines, it says it cannot undo cleanly and changes nothing.

## 2026-11-05: @coder in GitHub comments

- On your word ("yea lets do it"): on an issue or pull request in a repo Coder can use, comment `@coder do X`. GitHub notifies gofarther.dev (signed with CODER_GITHUB_WEBHOOK_SECRET; anything unsigned is refused).
- Only a GitHub account that was connected to Coder, by a Coder account on CODER_USERS, can wake it. Anyone else gets a polite "only works for accounts that connected…" and nothing runs. Bots never wake it.
- Coder replies "On it" as **gofarther-coder[bot]** (signed with the app's private key, CODER_GITHUB_APP_PRIVATE_KEY, app id 5620754), runs the job like a chat (it shows in your Recents), and every minute the Worker checks for finished jobs and replaces "On it" with what Coder did: its answer, the branch and a link to open a pull request (or the pull request, if you asked for one). A question from Coder shows its options; answer with `@coder <choice>`.
- One chat per issue/PR: the next `@coder` in the same thread continues it.
- The deploy now needs the two new secrets (it stops if they are missing) and the Worker has a once-a-minute timer.

## 2026-11-05: Audit, the two critical fixes

- Coder's machine has a control panel (start, finish, push, stop). It is now locked: only our server, which gives the machine a key made from CODER_TOKEN_KEY, can use it. The AI's commands cannot read that key, so they cannot start extra Grok jobs or take over a job's end.
- A repo's CODER.md is read safely: never through a link, only a plain file, size-capped. (A repo could have made CODER.md a link to a system file holding the xAI key.)
- The unused "export files" feature is deleted (the audit found it could be tricked into reading root's files). The memory file can no longer freeze a job.

## 2026-11-05: Ask, Monitor and LSP added to Coder

- On your word ("add AskUserQuestion, monitor, lsp"):
  - **ask_user**: when Coder truly cannot choose, it asks one question with 2 to 4 buttons and stops. Your tap is sent as the next message.
  - **Background jobs**: bash with run_in_background gives a job (job1…); **monitor** reads its newest output and says if it still runs; **stop_job** ends it. In the chat: "Checked job1 …", "Stopped job1 …".
  - **lsp**: real language servers (TypeScript/JavaScript and Python) for definition, references, hover (type) and diagnostics (errors). "Looked up diagnostics server.js". Coder's machine now installs typescript@5, typescript-language-server and pyright (TypeScript 7 lacks the piece the server needs).
- Audit item fixed with it: everything the AI's user starts (even with &) is killed when a job ends, on Stop, before the push, and before a new job prepares the files.
- Small fix: glob no longer lists .git.

## 2026-11-05: Web search is now Grok's own (no free search)

- One test call (the "test grok search" button) showed Grok's own web search works next to Coder's tools, about half a cent per search (that call cost 78,280,000 xAI "ticks", which we think is about $0.008 in all; check xAI's console).
- On your word ("yes"), Coder now talks to Grok through xAI's Responses request with web search turned on. Grok searches by itself when it needs current facts or docs; each search shows in the chat as "Searched the web for …" with the pages it used. The free DuckDuckGo search is gone.
- Coder's chats and history are unchanged: Coder turns them into the new request and back.

## 2026-11-05: A test button for Grok's own web search

- You said no free search, and to test Grok's own. New workflow "test grok search": you press it, it makes ONE paid Grok call with web_search next to one of Coder's tools, and prints the answer, the tools used and the usage. The key is never printed.

## 2026-11-05: Coder gets Claude Code's tools

- On your word ("you can add all of this"), Coder now has read, edit, write, grep, glob, web_fetch, web_search and a todo checklist, besides bash and pull_request. The file tools run as the same limited user as bash and only inside the project (not .git, not through links). Web fetch reads public pages only (never the machine itself or private networks).
- In the chat they show as their own lines ("Read server.js", "Edited server.js", "Wrote README.md", "Searched \"listen\""), and the checklist shows as a Plan box with ticks.
- Web search uses a free search page (DuckDuckGo). From cloud machines it is often refused, so it may answer "no results". A reliable one needs a search service key (Brave Search has a free tier) that you would type in yourself.

## 2026-11-05: Coder reads CODER.md only

- On your word ("we not doing claude md we doing coder md"): Coder now reads only a repo's CODER.md for its instructions. CLAUDE.md and AGENTS.md (other tools' files) are ignored.

## 2026-11-05: Empty repositories get a main branch first

- Live test result: in the empty repo, Coder's branch became the only branch, so the pull request had nothing to merge into. On your word ("create main automatically"), Coder now makes the main branch first in an empty repository (one empty "Start" commit), then works on its own branch, so pull requests work. That is the only time Coder writes to main, and only when the repo has nothing in it.
- A repo that has branches but no main gets a clear message instead of a git error.
- canias7/testingforclaude still has only the coder/… branch from the test (no main). Easiest: delete that repo and make a fresh empty one, or set its default branch on GitHub.

## 2026-11-05: Live test: empty repositories now work

- The live test on canias7/testingforclaude failed with "could not clone … couldn't find remote ref main": that repo is empty (no files, no branches). Coder now opens an empty repo, starts on its own branch, and pushes it when it makes something. A pull request needs a main branch on GitHub to compare against, so in an empty repo add one first (e.g. a README on GitHub).

## 2026-11-05: Test account allowed

- On your word, cristiananias7@gmail.com (your throwaway test account) may use Coder, for a live test on gofarther.dev. Remove it from CODER_USERS in coder/wrangler.jsonc when testing is done.

## 2026-11-05: Ask Coder for the pull request in the chat (option B)

- The Create pull request button is gone. Say "make a pull request" in the chat: Coder (Grok) looks at the changes and writes the title and description, and our server opens it after the job, once the work is saved to GitHub. If one is already open, it is updated instead. Coder still never holds your GitHub key.
- Coder has a second tool for this (pull_request) next to bash. It is told to use it only when you ask.

## 2026-11-05: The / commands removed

- On your word ("some are there already as buttons"): every / command already had a button, so the / menu is gone. Typing / is now just normal text to Coder. The chat box no longer says "/ for commands".

## 2026-11-05: Two failed deploys, fixed

- The deploy's tests failed twice on GitHub's machine: git printed warnings there, and Coder mistook them for changed files. Coder now reads only git's answer, not its warnings, and a job with nothing new ("hi") sends nothing to GitHub. The third deploy went live: landing page, Create pull request button, and the walk-through fixes.

## 2026-11-05: Recorded walk-through, and two fixes it found

- I ran the real Coder page, routes and machine on my side (GitHub, sign-in and the AI were stand-ins, so it cost nothing) and recorded the whole flow.
- Fixed: a job that changed nothing (like "hi") said "Saved to the branch" and offered Create pull request. Now only real changes do.
- Fixed: what you type on the landing page is now waiting in Coder's chat box after you sign in, and Sign in no longer shows "Create account".

## 2026-11-05: Pull requests only when you press the button (option A)

- Coder no longer opens a pull request by itself. After each job it saves its work to its own branch on GitHub ("Saved to the branch coder/…"). A "Create pull request" button appears next to See changes; press it when you are happy. `/pr` does the same.
- Once a pull request is merged or closed, Coder forgets it, so the button comes back for the next one (this also fixes audit item 1).

## 2026-11-05: Download for Mac / Windows back on the front page

- On your word, gofarther.dev has a landing page again like the old one: Go Farther and Sign in on top, the two black "Download for Mac" / "Download for Windows" buttons (look only, "Coming soon"), and the big ask box (Grok 4.7, Medium). Sign in, or sending from the box, opens the sign-in card. On a phone the download buttons shrink to the two logos.

## 2026-11-05: Coder's own "Remove chat?" box

- Removing a chat showed the browser's own grey popup. Now Coder shows its own white box with Cancel and a red Remove button. A test checks the page uses no browser popups anywhere.

## 2026-11-05: Claude may press the deploy button

- You removed the rule that only you press workflow runs. Claude now runs deploy coder itself when you say deploy. Deleting things still needs your word each time.

## 2026-11-05: Audit fixes, Worker side

- A chat can no longer stay stuck on "working": if Coder's machine lost the job, the chat is freed at once with a note; if the machine stops answering, it is freed after 15 minutes. Stop also frees it.
- The end of a job (push to GitHub, pull request) now happens once, even with two tabs open.
- The chat list no longer loses chats when two change at once (each chat keeps its own record now).
- Smaller: full account id in machine names, a check on the repo's main branch name, Delete allowed through the page's safety rules.
- Then done too: the page checks less often after errors and says "Coder's machine is not answering. Still trying…" after 5 misses; each chat keeps at most about 400 KB of conversation (oldest dropped first); Coder checks its time limit before every command.

## 2026-11-05 — First real try failed; fixed; no container limit

Your first real "hey how are you" showed "Coder could not open canias77777/gfujgvkhbkjblu". The live version allowed only **1 container in total**, and each chat needs its own, so Cloudflare almost certainly refused to start one. The error also dropped the reason.
- **No limit on chats at once** (your word "no limit"). Cloudflare needs a number, so the total is set to **100 containers**, with **no per-person limit**. Each container sleeps after 10 minutes, so it only costs while working. The setting `CODER_MAX_RUNNING` puts a per-person limit back when Coder opens to others.
- **The real reason now shows** when a chat cannot start, or when the AI call fails.
- **The effort safety net:** if Grok refuses the effort setting, Coder asks again without it.

Coder's tests: 25 of 25.

## 2026-11-05 — Browser work moved to the server

On your word "remove the stuff that are browser stuff and put it server side":
- **Sign-in** now goes through Coder's Worker (`/api/auth/signin`, `verify`, `signup`, `refresh`, `logout`). The page no longer holds Supabase's address or key, and may only talk to its own address.
- **The model list, your model and effort pick, and the slash commands** come from the server. Your pick is kept on your account, not in the browser.
- **What each slash command does** is worked out on the server (`/api/coder/command`). The page only opens what the answer says.
- **Comments on the changes** are sent as they are, and the server checks them and writes them into the message.

Coder's tests: 24 of 24. Not live until "merge and deploy" and **deploy coder**.

## 2026-11-05 — Six Claude Code features added to Coder (7, 14, 15, 20, 21, 25)

- **Several chats at once (7):** each chat has its own container. Up to **3 chats per person** can work at the same time, and a 4th waits with "3 chats are already working". Cloudflare allows up to 6 containers in all.
- **The repo's own rules (14):** if the repo has a `CODER.md`, `CLAUDE.md` or `AGENTS.md`, Coder reads it at the start of every turn and follows it (up to 20,000 characters).
- **Memory between chats (15):** each repo gets a memory file. Coder adds a line when it learns something lasting (how to run the tests, your preferences), and every chat on that repo starts with it. It's kept in Coder's storage (`memory/<repo>.md`), not in your repo, up to 25,000 characters.
- **Comment on the changes (20):** in **See changes**, tap a line, write a comment and press Add. It waits as a chip above the box and goes to Coder with your next message, naming the file and line.
- **Long commands in the background (21):** a command still running at its time limit is no longer killed. It keeps running, its output goes to a log, and Coder is told where to read it. The chat shows "running in the background".
- **Slash commands (25):** type `/` for a menu: /new, /repos, /changes, /pr, /stop, /effort, /model, /remove, /help. They run in the page and never use the AI.

Coder's tests: 23 of 23. Not live until "merge and deploy" and **deploy coder**.

## 2026-11-05 — delete old stuff, second press (run 2): Neon and the old app gone

- **Deleted:**
  - the old app Worker **isibi-app** (the queue was unhooked from it first);
  - the queue **site-builds**;
  - the **gofarther-sites** folder;
  - Supabase **media**;
  - **all 48 Neon databases**, each named in the log.
- **Already gone from the first press:** gofarther-front, the 101 site Workers, the KV stores, avatars and the branches. The warnings about these are only "not found".
- **Still emptying:** **113 storage buckets** (isibi-sites, gofarther-files and the gfs-… ones) still had files. Their 1-day expiry rules from the first press still stand. One more press after 04:00 UTC on Nov 6 deletes them.

## 2026-11-05 — Supabase cleaned: only sign-in left

On your "go", I deleted all 32 old tables and every old database function in Supabase. Afterwards: **0 tables, 0 functions left; 14 accounts kept**, untouched. Sign-in still works the same, because it lives in Supabase's own sign-in area, which nothing referenced.

Still left: the second press of **delete old stuff** (after 04:00 UTC on Nov 6) and Neon (press **list old stuff** first).

## 2026-11-05 — Chats: each one its own session, in a Claude-app sidebar

From the four layouts, you picked B in the Claude-app style ("yes like this").
- **Left side:** a rail with the agents (Coder, Gloopy), then Coder's column with **New chat**, **Repositories**, **Recents** (your chats), and your account at the bottom. The gear opens Sign out.
- **Each chat is its own session**, with its own history, branch and pull request. Two chats on the same repo are two pull requests. A chat's title is its first message.
- **Recents:** an orange dot means Coder is working there, and **#12** means it has a pull request. Hover a chat and tap × to remove it from the list (its branch and pull request stay on GitHub).
- **New chat** asks which repo. **See changes** now works for real: it reads what the pull request holds from GitHub, with no AI.
- **On a phone**, ☰ slides the sidebar in.
- The old top bar is gone, and the chat's own bar shows its title, repo, branch, pull request and See changes.
- Coder still has **one container**, so only one chat runs at a time.

Coder's tests: 19 of 19. Not live until "merge and deploy" and **deploy coder**.

## 2026-11-05 — Coder's chat: the Claude-app look (approved)

From your screenshot of the Claude app, you approved this look ("ok good"):
- your messages in a light grey bubble;
- each command as a quiet "Ran … ▸" line, and several in a row grouped as "Ran 3 commands ▾" in one box;
- a failed command marked "exit 1";
- Coder's answer as plain text;
- the model and effort ("Grok 4.7 · Medium") under the message box.

On the branch, not live yet. It goes out with the next "merge and deploy" and **deploy coder**, together with the removal of `ask` and `done`.

## 2026-11-05 — Coder's `done` tool removed too

On your word "delete the done", Coder has **one tool: `bash`**. It finishes the way a person would: it stops running commands and writes its answer in plain words. That answer gets the green ✓ in the chat and becomes the pull request's description, and the work goes to GitHub as before. Coder's tests: 18 of 18. Not live until "deploy coder" is pressed again.

## 2026-11-05 — Coder's `ask` tool removed

On your word "delete the ask", Coder now has two tools: **`bash`** (any Linux command) and **`done`** (finish, and the work goes to GitHub as a pull request). When a choice is open, it picks the sensible one and says which in its summary. If it truly can't go on without you, it says what it needs in its summary. The question buttons are gone from the chat. Coder's tests: 18 of 18. Not live until "deploy coder" is pressed again.

## 2026-11-05 — Coder is live at gofarther.dev; most of the old app is gone

- **delete old stuff (run 1):** deleted the sites Worker, 101 site Workers, the 2 builder containers, 2 KV stores, 152 branches, Supabase `avatars` and every file in `media`, and 1 bucket. The 112 site buckets still had files: each is set to empty within a day, and a second press deletes them. Its log did not confirm the old app Worker, the `site-builds` queue, or the `gofarther-sites` and `media` folders. The old app is gone, though: Coder could take its address.
- **deploy coder (run 3):** Coder now holds gofarther.dev, www and coder.gofarther.dev. Its single container is set.
- **gofarther.dev had no address record** after the old app was deleted. The new **fix gofarther.dev** button detached and re-attached the two addresses (run 2), and all three now answer.
- GitHub connected (your sign-in reached `?github=connected`).
- Left: the Supabase tables (your "go"), the second delete press tomorrow, and Neon (list, then delete).

## 2026-11-05 — The delete button, with every item named

From the **list old stuff** run, the **delete old stuff** button removes, by name:
- the old app Worker and the sites Worker;
- 101 site Workers and their folder;
- the 2 old builder containers, the `site-builds` queue and the 2 KV stores;
- the site storage buckets (`isibi-sites` and every `gfs-…`);
- the Supabase file storage (`media`, `avatars`);
- 152 old branches.

**Kept, on your word:** the Workers nutri, teacher-grade-api, isibi-ai and agent-builder-api, plus the `agent-runs` queue they may use, and the gofarther.app domain.

Neon is next: the list couldn't read it (my mistake, fixed). The Supabase tables wait for your "go".

Coder: a single container (`max_instances` 1).

## 2026-11-05 — Everything old removed from the branch; the delete button next

On your word "delete all the old stuff":

- **On the branch (done):** the old notes and preferences are replaced by these fresh files. The old traces are gone from Coder's files: comments about the website builder, the old sign-in name and an extra route. The deploy button no longer uses an old builder secret. Coder's token key now comes from Coder's own GitHub client secret, so it no longer depends on old secrets.
- **Outside (next, by buttons you press):** the old app and customer-site Workers, their storage, the Neon databases, the old Supabase tables, the old GitHub branches and the old secrets.

## 2026-11-05 — Coder so far

- GitHub App **gofarther-coder** registered. Coder's Worker is deployed at coder.gofarther.dev, switched on for your two accounts only.
- gofarther.dev will be Coder: a sign-in screen, then the tabs on the left (Coder, and the Gloopy agent "coming soon"), then Coder's chat.
- The chat uses style B: plain command lines, a green or red dot, and the output in grey. The model picker offers Grok 4.7 with Low, Medium or High effort.
- Not live yet: it needs "merge and deploy", then the delete button, then **deploy coder**.
