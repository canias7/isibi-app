// manufacturer /quote — the RFQ as its own page: part, quantity, the schedule
// pasted whole, and who calls back. A buyer sending an RFQ wants an owner
// for it, not a ticket number — the named person is the conversion detail.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { BusyButton } from "@/components/ui/busy-button";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { ProfileCard } from "@/components/ui/profile-card";
import { SuccessPanel } from "@/components/ui/success-panel";
import { Textarea } from "@/components/ui/textarea";
export const Route = createFileRoute("/quote")({ component: P });
const CHROME = {
  name: "Attercliffe Fastenings", tagline: "Cold-forged fasteners since 1953. BS EN ISO 898-1.",
  links: [{ label: "Home", href: "/" }, { label: "The 12.9 line", href: "/product" }],
  action: { label: "Request quote", href: "/quote" },
};
function P() {
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [schedule, setSchedule] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Request a quote</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">Sent before 10, priced by lunchtime. Sent after, first thing tomorrow. Those are the only two answers.</p>
        {sent ? (
          <SuccessPanel className="mt-8" title="Schedule received" description="Marie has it. The quote comes back on your letterhead line by line, certs included, from quotes@attercliffe.co." action={{ label: "Back to the catalogue", href: "/" }} />
        ) : (
          <div className="mt-8 grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormRow label="Company" htmlFor="q-co" required>
                <Input id="q-co" autoComplete="organization" value={company} onChange={(e) => setCompany(e.target.value)} />
              </FormRow>
              <FormRow label="Email for the quote" htmlFor="q-em" required>
                <Input id="q-em" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </FormRow>
            </div>
            <FormRow label="Your schedule" htmlFor="q-sched" hint="Paste it as it is — sizes, grades, quantities, finishes. Spreadsheet rows welcome." required>
              <Textarea id="q-sched" rows={8} className="font-mono text-sm" placeholder={"M12 x 60  8.8  zinc  2,000\nM16 x 80  12.9  plain  500"} value={schedule} onChange={(e) => setSchedule(e.target.value)} />
            </FormRow>
            <BusyButton disabled={!company || !email || !schedule} onClick={() => setSent(true)}>Send for pricing</BusyButton>
          </div>
        )}
        <section className="mt-12 border-t pt-8">
          <h2 className="text-sm font-medium text-muted-foreground">Who prices it</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <ProfileCard name="Marie Kowalczyk" meta="Trade counter & quotes — 28 years in" avatar={null} />
            <ProfileCard name="Stu Bennett" meta="Anything forged to order" avatar={null} />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Rather talk it through? <a className="font-medium underline underline-offset-4" href="tel:+441142441953">0114 244 1953</a>, trade counter hours 7:30–4:30.</p>
        </section>
      </div>
    </SiteChrome>
  );
}
