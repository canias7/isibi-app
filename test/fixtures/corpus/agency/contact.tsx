// agency /contact — the destination the whole site points at. One
// form, the three facts that decide an answer (date, place, how they found
// us), and what happens after it is sent. Nothing else competes.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { BusyButton } from "@/components/ui/busy-button";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { Steps } from "@/components/ui/steps";
import { SuccessPanel } from "@/components/ui/success-panel";
import { Textarea } from "@/components/ui/textarea";
export const Route = createFileRoute("/contact")({ component: P });
const CHROME = {
  name: "Hale & Frost", tagline: "Weddings photographed like they felt.",
  links: [{ label: "The work", href: "/" }, { label: "A recent day", href: "/project" }],
  action: { label: "Start a project", href: "/contact" },
};
function P() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [when, setWhen] = useState("");
  const [where, setWhere] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-2xl px-6 py-14">
        <h1 className="text-3xl font-semibold tracking-tight">Start a project</h1>
        <p className="mt-2 text-muted-foreground">Date and place first — that answers whether we're free before anything else matters.</p>
        {sent ? (
          <SuccessPanel className="mt-8" title="Enquiry sent" description="You'll hear from Ren within a day — usually with a yes or a name we trust for your date." action={{ label: "Back to the work", href: "/" }} />
        ) : (
          <div className="mt-8 grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormRow label="The date" htmlFor="cq-when" hint="Rough is fine — 'next September' answers it." required>
                <Input id="cq-when" value={when} onChange={(e) => setWhen(e.target.value)} />
              </FormRow>
              <FormRow label="The place" htmlFor="cq-where" required>
                <Input id="cq-where" value={where} onChange={(e) => setWhere(e.target.value)} />
              </FormRow>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormRow label="Your name" htmlFor="cq-name" required>
                <Input id="cq-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
              </FormRow>
              <FormRow label="Email" htmlFor="cq-email" required>
                <Input id="cq-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </FormRow>
            </div>
            <FormRow label="Tell us anything" htmlFor="cq-notes" hint="Who's marrying, what the day looks like, what you don't want.">
              <Textarea id="cq-notes" rows={4} />
            </FormRow>
            <BusyButton disabled={!name || !email || !when || !where} onClick={() => setSent(true)}>Send the enquiry</BusyButton>
          </div>
        )}
        <div className="mt-12 border-t pt-8">
          <h2 className="text-sm font-medium text-muted-foreground">What happens next</h2>
          <Steps className="mt-4" items={[
            { title: "We answer within a day", description: "A real reply from one of us, not an autoresponder." },
            { title: "A call if the date's free", description: "Twenty minutes. You do most of the talking." },
            { title: "The date is held with a deposit", description: "£300, off the final balance. Nothing is booked until then." },
          ]} />
        </div>
      </div>
    </SiteChrome>
  );
}
