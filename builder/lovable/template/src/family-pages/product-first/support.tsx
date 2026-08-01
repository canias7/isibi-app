// product-first /support — help that actually helps: the fixes that solve
// most tickets, THEN the human. App stores require a support URL, so every
// mobile app ships this page whether its maker planned to or not — better to
// plan it.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { BusyButton } from "@/components/ui/busy-button";
import { Faq } from "@/components/ui/faq";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { SearchInput } from "@/components/ui/search-input";
import { SuccessPanel } from "@/components/ui/success-panel";
import { Textarea } from "@/components/ui/textarea";
export const Route = createFileRoute("/support")({ component: P });
const CHROME = {
  name: "Snicket", tagline: "Walking routes that prefer the alleys.",
  links: [{ label: "The app", href: "#/" }, { label: "Pricing", href: "#/pricing" }, { label: "Support", href: "#/support" }],
  action: { label: "Download", href: "#/" },
};
function P() {
  const [q, setQ] = useState("");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Support</h1>
        <p className="mt-2 text-muted-foreground">Nine answers below solve most of the inbox. If yours isn't there, the form reaches a person who walks.</p>
        <div className="mt-6"><SearchInput value={q} onChange={setQ} placeholder="Search the answers — 'offline', 'battery', 'refund'…" /></div>
        <section className="mt-6">
          <Faq items={[
            { question: "Offline maps won't download", answer: "It needs Wi-Fi by default — that's a setting, not a fault. Settings → Downloads → allow mobile data, or find Wi-Fi; a city is 80–300 MB." },
            { question: "The route ignores my quiet preference", answer: "Quiet-first routing is a Wanderer feature — Free shows the scores but routes by distance. If you ARE subscribed, force-quit once; the flag occasionally sticks after a restore." },
            { question: "Battery drain", answer: "Screen-off with voice is ~4%/hour. If you're seeing worse, disable 'Live compass' — on some Androids it holds the sensor awake." },
            { question: "Restore my subscription on a new phone", answer: "Settings → Restore purchases, signed into the same store account. No Snicket account exists to lose." },
            { question: "Refunds", answer: "Purchases go through the stores, so refunds do too — but email us first; if it's our bug we'll say so in the request." },
            { question: "Export my walks", answer: "Every walk exports as GPX from its detail page. Your data is yours; there's no lock-in by design." },
          ]} />
        </section>
        <section className="mt-10 rounded-xl border bg-muted/40 p-6">
          <h2 className="text-lg font-medium">Still stuck?</h2>
          {sent ? (
            <SuccessPanel className="mt-4" title="Ticket in" description="A person replies within one working day — include your phone model if it's a maps or battery thing." action={{ label: "Back to the app", href: "#/" }} />
          ) : (
            <div className="mt-4 grid gap-4">
              <FormRow label="Email" htmlFor="sp-em" required>
                <Input id="sp-em" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </FormRow>
              <FormRow label="What's happening" htmlFor="sp-what" hint="Phone model helps. 'It crashes when…' beats 'it doesn't work'." required>
                <Textarea id="sp-what" rows={4} />
              </FormRow>
              <BusyButton disabled={!email} onClick={() => setSent(true)}>Send it</BusyButton>
            </div>
          )}
        </section>
      </div>
    </SiteChrome>
  );
}
