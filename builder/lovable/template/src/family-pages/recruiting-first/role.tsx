// recruiting-first /role — one role in full: the actual work, the actual pay,
// and the apply form ON the page. Every extra click between "interested" and
// "applied" loses real candidates; the form lives here, not behind a portal.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Badge } from "@/components/ui/badge";
import { BusyButton } from "@/components/ui/busy-button";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { SuccessPanel } from "@/components/ui/success-panel";
import { Textarea } from "@/components/ui/textarea";
export const Route = createFileRoute("/role")({ component: P });
const CHROME = {
  name: "Kelham Works", tagline: "A 14-person product studio by the river.",
  links: [{ label: "All roles", href: "#/" }, { label: "How we hire", href: "#/" }],
};
function P() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [link, setLink] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-2xl px-6 py-12">
        <a className="text-sm text-muted-foreground underline underline-offset-4" href="#/">← All three roles</a>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">Senior product designer</h1>
          <Badge variant="secondary">£55–65k</Badge>
          <Badge variant="outline">Kelham Island · hybrid</Badge>
        </div>
        <div className="prose prose-sm mt-6 max-w-none text-foreground">
          <p>You'd be our third designer, working in pairs with engineers from the first sketch. Client work is two products at a time, never five; the studio says no a lot so the yeses get whole weeks.</p>
          <p><strong>The actual week:</strong> three days of design work, one of research or shipping support, Friday is yours for the studio. Summer is a 32-hour week and we mean it.</p>
          <p><strong>You'll be at home here if</strong> you show process without being asked, you've shipped design systems someone else maintains happily, and you'd rather improve a flow than decorate one.</p>
          <p><strong>Pay:</strong> the band is real — where you land in it is decided by the paid task, not negotiation stamina. Everyone's band is on the studio wiki.</p>
        </div>
        <section className="mt-10 rounded-xl border bg-muted/40 p-6">
          <h2 className="text-lg font-medium">Apply — ten minutes, no portal</h2>
          {sent ? (
            <SuccessPanel className="mt-4" title="Application in" description="Theo reads every one and replies inside a week, including the noes — that's a studio rule." action={{ label: "Back to the studio", href: "#/" }} />
          ) : (
            <div className="mt-4 grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormRow label="Your name" htmlFor="rl-name" required>
                  <Input id="rl-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
                </FormRow>
                <FormRow label="Email" htmlFor="rl-email" required>
                  <Input id="rl-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </FormRow>
              </div>
              <FormRow label="Your work — one link" htmlFor="rl-link" hint="Portfolio, case study, a thing you shipped. One is enough." required>
                <Input id="rl-link" type="url" inputMode="url" placeholder="https://" value={link} onChange={(e) => setLink(e.target.value)} />
              </FormRow>
              <FormRow label="The piece you're proudest of, and why" htmlFor="rl-why" hint="Three sentences beats three paragraphs.">
                <Textarea id="rl-why" rows={4} />
              </FormRow>
              <BusyButton disabled={!name || !email || !link} onClick={() => setSent(true)}>Send application</BusyButton>
              <p className="text-xs text-muted-foreground">No CV needed at this stage. Salary band is published above — we won't ask your current one.</p>
            </div>
          )}
        </section>
      </div>
    </SiteChrome>
  );
}
