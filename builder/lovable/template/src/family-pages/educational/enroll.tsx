// educational /enroll — joining: what the money buys, when cohorts start,
// one form. The curriculum sold the course on the home page; this page only
// has to not fumble the handover, so it answers cost, time and refund before
// asking for anything.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { BusyButton } from "@/components/ui/busy-button";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { RadioCards } from "@/components/ui/radio-cards";
import { Steps } from "@/components/ui/steps";
import { SuccessPanel } from "@/components/ui/success-panel";
export const Route = createFileRoute("/enroll")({ component: P });
const CHROME = {
  name: "The Proving Room", tagline: "Sourdough, taught slowly, online.",
  links: [{ label: "The course", href: "#/" }, { label: "This week", href: "#/lesson" }, { label: "Enroll", href: "#/enroll" }],
  action: { label: "Enroll — £79", href: "#/enroll" },
};
function P() {
  const [cohort, setCohort] = useState("sep");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Join the next cohort</h1>
        <p className="mt-2 text-muted-foreground">£79, once — no subscription, yours forever including every future update. If week one doesn't get your starter alive, the refund is automatic and we post you ours anyway.</p>
        <section className="mt-8">
          <h2 className="text-sm font-medium text-muted-foreground">What the £79 is</h2>
          <Steps className="mt-3" items={[
            { title: "The six weeks", description: "29 lessons, 3 hours a week, paced by your starter not a calendar." },
            { title: "Your tutor", description: "A real baker comments on your weekly photo. Usually within a day." },
            { title: "Forever", description: "Keep the course, the community and every update. No renewal exists." },
          ]} />
        </section>
        {done ? (
          <SuccessPanel className="mt-8" title="You're in — September cohort" description="Week one lands in your inbox on the 7th. Until then: buy nothing, the flour list is in the welcome email and it's shorter than you fear." action={{ label: "Peek at a lesson now", href: "#/lesson" }} />
        ) : (
          <div className="mt-8 grid gap-4">
            <h2 className="text-sm font-medium text-muted-foreground">Pick your start</h2>
            <RadioCards columns={2} value={cohort} onChange={setCohort} options={[
              { value: "sep", label: "7 September", description: "412 enrolled so far" },
              { value: "oct", label: "19 October", description: "The autumn-baking one" },
            ]} />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormRow label="Your name" htmlFor="en-name" required>
                <Input id="en-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
              </FormRow>
              <FormRow label="Email" htmlFor="en-email" hint="Lessons arrive here. Check it's one you open." required>
                <Input id="en-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </FormRow>
            </div>
            <BusyButton disabled={!name || !email} onClick={() => setDone(true)}>Enroll — £79</BusyButton>
            <p className="text-xs text-muted-foreground">Payment is on the next screen. The price has been £79 since 2024 and waiting for a sale wastes good baking weather.</p>
          </div>
        )}
      </div>
    </SiteChrome>
  );
}
