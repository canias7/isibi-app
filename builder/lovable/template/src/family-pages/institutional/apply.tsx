// institutional /apply — the prospective journey on its own page: the dates
// that govern everything, the steps in order, then the form. Tasks over
// marketing; a sixth-former's parent should finish this page knowing exactly
// what happens when.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { BusyButton } from "@/components/ui/busy-button";
import { DeadlineBar } from "@/components/ui/deadline-bar";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { Steps } from "@/components/ui/steps";
import { SuccessPanel } from "@/components/ui/success-panel";
export const Route = createFileRoute("/apply")({ component: P });
const CHROME = {
  name: "Rivelin College", tagline: "A sixth-form college in the Rivelin valley.",
  links: [{ label: "Home", href: "#/" }, { label: "Visit us", href: "#/visit" }],
  action: { label: "Apply", href: "#/apply" },
};
function P() {
  const [name, setName] = useState("");
  const [school, setSchool] = useState("");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Applying for 2027 entry</h1>
        <DeadlineBar className="mt-4" label="Applications close" from={new Date("2026-09-01T09:00:00")} due={new Date("2027-01-16T17:00:00")} />
        <section className="mt-8">
          <h2 className="text-lg font-medium">How it goes</h2>
          <Steps className="mt-4" items={[
            { title: "Apply online", description: "Fifteen minutes. Predicted grades are fine — we know they move." },
            { title: "A conversation, not an interview", description: "Twenty minutes with a subject tutor, February half-term onwards." },
            { title: "Your offer", description: "Within two weeks of the conversation. Enrolment is results day, in person." },
          ]} />
        </section>
        <section className="mt-10">
          <h2 className="text-lg font-medium">Start the application</h2>
          {sent ? (
            <SuccessPanel className="mt-4" title="Application started" description="We've emailed you a link to finish it — save the email; the link is your application." action={{ label: "Book an open evening too", href: "#/visit" }} />
          ) : (
            <div className="mt-4 grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormRow label="Your name" htmlFor="ap-name" required>
                  <Input id="ap-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
                </FormRow>
                <FormRow label="Current school" htmlFor="ap-school" required>
                  <Input id="ap-school" value={school} onChange={(e) => setSchool(e.target.value)} />
                </FormRow>
              </div>
              <FormRow label="Email" htmlFor="ap-email" hint="The application link goes here — use one you check." required>
                <Input id="ap-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </FormRow>
              <BusyButton disabled={!name || !school || !email} onClick={() => setSent(true)}>Send me the application link</BusyButton>
              <p className="text-xs text-muted-foreground">No account needed. Questions? Admissions answer the phone 9–4: 0114 232 1100.</p>
            </div>
          )}
        </section>
      </div>
    </SiteChrome>
  );
}
