// careers/dual-audience /role — one vacancy, and the dual-audience change is
// that it names the CLIENT'S situation rather than the agency's culture. A
// candidate reading an agency's advert wants to know who they would actually
// work for and why the job is open; a jobs board's copy answers neither, which
// is why every engineering advert reads identically.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Badge } from "@/components/ui/badge";
import { BusyButton } from "@/components/ui/busy-button";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { JobCard } from "@/components/ui/job-card";
import { SuccessPanel } from "@/components/ui/success-panel";
import { Textarea } from "@/components/ui/textarea";
import { ROLES } from "./index";
export const Route = createFileRoute("/role")({ component: P });
const CHROME = {
  name: "Attercliffe Recruitment",
  tagline: "Engineering and manufacturing recruitment across South Yorkshire since 2004.",
  links: [{ label: "All roles", href: "#/#roles" }, { label: "For employers", href: "#/#hiring" }],
};
function P() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [about, setAbout] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-5xl px-6 py-12">
        <a className="text-sm text-muted-foreground underline underline-offset-4" href="#/#roles">← All 41 roles</a>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">CNC machinist, nights</h1>
          <Badge variant="secondary">£38–42k</Badge>
          <Badge variant="outline">Rotherham · permanent</Badge>
          <Badge variant="outline">Posted 1 Aug</Badge>
        </div>

        <div className="mt-8 grid gap-10 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <div className="prose prose-sm max-w-none text-foreground">
              <p>
                A 40-person subcontract machine shop off Sheffield Road, mostly aerospace and
                medical, running Mazak and Doosan. Twelve on days, six on nights. This is a
                permanent role and the client has held it open eleven weeks rather than take
                somebody who is not right, which tells you most of what you need to know about them.
              </p>
              <p><strong>Why it is open:</strong> the previous machinist moved to Derby to be nearer family after nine years. It is not a role somebody left in a hurry, and you can ask them — we will pass on the question.</p>
              <p><strong>The actual shift:</strong> 22:00 to 06:00, Monday to Thursday, four nights. Friday is not worked and is not owed. £38k on the base with a 33% night premium already inside the figure quoted.</p>
              <p><strong>You would be at home here if</strong> you can set as well as operate, you have run Mazatrol or Fanuc on multi-axis, and you are comfortable being the only machinist on the floor for two of the four nights.</p>
              <p><strong>What we told the client:</strong> £38k is at the bottom of the market for a setter-operator on nights in Rotherham, and we said so on the first visit. They moved the top of the band from £40k to £42k as a result, which is where that figure came from.</p>
            </div>

            {/* THE HONEST HALF. An agency advert that lists only the good parts
                gets somebody through an interview and out again in six weeks,
                which costs the candidate more than it costs anybody. */}
            <div className="mt-8 rounded-lg border border-border bg-muted/50 p-6">
              <p className="text-base font-medium">The parts that put people off, so you hear them now</p>
              <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-muted-foreground">
                <li>The shop is warm in summer. There is no air conditioning and there is not going to be.</li>
                <li>Nights means nights — there is no rotation onto days and nobody has ever been moved.</li>
                <li>The car park floods twice a winter. Everybody parks on the road when it rains.</li>
                <li>Overtime exists but is not guaranteed, and averaged about four hours a month last year.</li>
              </ul>
            </div>

            <section className="mt-10 rounded-xl border bg-muted/40 p-6">
              <h2 className="text-lg font-medium">Apply — five minutes, no portal, no CV needed yet</h2>
              {sent ? (
                <SuccessPanel className="mt-4" title="With us — a call within two working days"
                  description="From Michael, who has been in that shop. Your details go nowhere near the client until you have said yes to us doing it."
                  action={{ label: "Back to the roles", href: "#/#roles" }} />
              ) : (
                <div className="mt-4 grid gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormRow label="Your name" htmlFor="rl-name" required>
                      <Input id="rl-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
                    </FormRow>
                    <FormRow label="Mobile" htmlFor="rl-phone" required hint="We ring. It is faster and you can ask things back.">
                      <Input id="rl-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    </FormRow>
                  </div>
                  <FormRow label="What you have run" htmlFor="rl-about"
                    hint="Machines and controls is plenty. A CV can follow later and is not needed to have the conversation.">
                    <Textarea id="rl-about" rows={4}
                      placeholder="Mazak Integrex and a couple of the older VTCs, Mazatrol. Setting and operating, six years. Currently on days and would rather be on nights."
                      value={about} onChange={(e) => setAbout(e.target.value)} />
                  </FormRow>
                  <BusyButton disabled={!name || !phone} onClick={() => setSent(true)}>Send it</BusyButton>
                  <p className="text-sm text-muted-foreground">
                    Your details are not passed to the client — or to anybody else — until you have
                    been told who they are and said yes.
                  </p>
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-8">
            <div className="rounded-lg border border-border p-5">
              <p className="text-sm font-medium">Who you would be dealing with</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Michael Dacre, who ran a setting section for eleven years before this. He has stood
                on that shop floor and he will tell you what the extraction is like, because a
                recruiter who has not seen the place is guessing at your question.
              </p>
              <p className="mt-3 text-sm">
                <a className="font-medium underline underline-offset-4" href="tel:01142723300">0114 272 3300</a>
                <span className="text-muted-foreground"> · 07:30–17:30, and he answers it himself</span>
              </p>
            </div>

            {/* THE EMPLOYER DOOR, ON THE CANDIDATE PAGE. Both audiences arrive
                on role pages from search, and a hiring manager who lands here
                should not have to go back to the front to find the fee. */}
            <div className="rounded-lg border border-border bg-muted/50 p-5">
              <p className="text-sm font-medium">Hiring rather than looking?</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                18% of first-year salary, 15% exclusive, 12-week sliding rebate, 22 days median to
                an accepted offer. All of it is on the front page rather than in a first call.
              </p>
              <a className="mt-3 inline-block rounded-md border border-border px-4 py-2 text-sm font-medium" href="#/#hiring">
                What it costs to hire
              </a>
            </div>

            <div>
              <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Similar, and open</p>
              <div className="mt-3 space-y-3">
                {ROLES.filter((r) => r.team === "Engineering" || r.team === "Fabrication").slice(0, 3).map((r) => (
                  <JobCard key={r.title} {...r} href="#/role" />
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </SiteChrome>
  );
}
