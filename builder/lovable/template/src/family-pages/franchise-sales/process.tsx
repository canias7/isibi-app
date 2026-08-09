// franchise-sales /process — enquiry to opening, with how long each step
// REALLY takes. Every franchisor's timeline says "up to 12 weeks" and the mean
// is nineteen; publishing the real one is the cheapest trust you can buy.
import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { BusyButton } from "@/components/ui/busy-button";
import { DownloadCard } from "@/components/ui/download-card";
import { Faq } from "@/components/ui/faq";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { InvestmentTable } from "@/components/ui/investment-table";
import { SectionHeader } from "@/components/ui/section-header";
import { SuccessPanel } from "@/components/ui/success-panel";
import { Textarea } from "@/components/ui/textarea";
import { Timeline } from "@/components/ui/timeline";
import { COSTS, EXCLUDES } from "./index";
export const Route = createFileRoute("/process")({ component: P });
function P() {
  const [name, setName] = React.useState("");
  const [area, setArea] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [detail, setDetail] = React.useState("");
  const [sent, setSent] = React.useState(false);
  return (
    <SiteChrome name="Fettle Mobile Servicing" tagline="Van-based bike and e-bike servicing. Nine territories, four still free."
      links={[{ label: "Home", href: "/" }, { label: "Territories", href: "/territories" }]}
      action={{ label: "Ring 0114 400 2210", href: "tel:01144002210" }}>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="The process" title="Nineteen weeks, not twelve"
          description="Twelve is what the brochure of every franchise in the country says. Nineteen is the mean of the five we have actually done, and the two that took longest were both waiting on lending." />

        <section className="mt-10 grid gap-12 lg:grid-cols-[1fr_1fr]">
          <div>
            <Timeline items={[
              { title: "You ring, or send the form", when: "Day 1", description: "A twenty-minute call, and about half of them end with us saying this is not for you. That is not a screening technique; it is that most people who enquire want a job rather than a business." },
              { title: "Discovery day, at a franchisee's", when: "Week 2", description: "A full day out on the van with somebody already doing it, not a presentation at head office. You see the good hours and the wet ones. Nobody from head office comes." },
              { title: "You get the numbers", when: "Week 3", description: "All five franchisees' actual accounts, unredacted, and their phone numbers. Take them to your own accountant — we will pay for two hours of their time." },
              { title: "Second meeting, and the agreement", when: "Week 5", description: "You come with questions rather than us with slides. The full agreement goes to you here, not at signing, and we expect you to have a solicitor read it." },
              { title: "Funding", when: "Weeks 6–14", description: "The long bit, and the one that varies. Two banks know the model and will decide in a fortnight; anybody else takes six weeks or more. This is where nineteen weeks comes from." },
              { title: "Training", when: "Weeks 15–17", description: "Three weeks. Two on the mechanical side at the workshop in Rotherham, one on the business — quoting, routing, the accounts, and the bit nobody teaches, which is saying no to a job." },
              { title: "Van, kit and launch", when: "Weeks 17–19", description: "Sign-writing takes ten days and is the usual hold-up. Launch marketing starts a fortnight before you do, so there is work in the diary on day one." },
              { title: "First day out", when: "Week 19", description: "Somebody from head office is with you for the first three days and on the phone for the first three months. Then a call every Tuesday, forever." },
            ]} />
          </div>
          <div>
            <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">What we look for</h2>
            <ul className="mt-3 divide-y divide-border border-y border-border text-base">
              <li className="py-3.5">
                <span className="font-medium">You live in the territory</span>
                <span className="block text-sm text-muted-foreground">Not near it. This is a local business and the people who do well are the ones already known at the school gate.</span>
              </li>
              <li className="py-3.5">
                <span className="font-medium">You can fund it without borrowing the working capital</span>
                <span className="block text-sm text-muted-foreground">Borrow the van, borrow the fee — but the six months of runway needs to be money you already have, or the first bad month becomes the last one.</span>
              </li>
              <li className="py-3.5">
                <span className="font-medium">You want to do the job, not manage somebody doing it</span>
                <span className="block text-sm text-muted-foreground">Year one is you in the van, five days a week. Anybody planning to employ a mechanic from the start has misunderstood the model and we will say so.</span>
              </li>
              <li className="py-3.5">
                <span className="font-medium">You are all right with people</span>
                <span className="block text-sm text-muted-foreground">Mechanical skill we can teach in a fortnight. Standing on a driveway explaining why a repair costs £90, we cannot.</span>
              </li>
            </ul>

            <div className="mt-8 space-y-3">
              <DownloadCard name="Franchise prospectus.pdf" size={2_400_000}
                description="The whole thing, including the figures on this site" href="/" />
              <DownloadCard name="Sample franchise agreement.pdf" size={480_000}
                description="The real one. Read it before the second meeting, not at signing" href="/" />
              <DownloadCard name="Five-year network accounts.xlsx" size={92_000}
                description="Every van, every year, unaveraged" href="/" />
            </div>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="The money, again" title="Because this is the page people arrive on second"
            description="The same table as the front page, so nobody has to go back for it before talking to a bank." />
          <div className="mt-8 max-w-3xl">
            <InvestmentTable lines={COSTS} excludes={EXCLUDES} fundablePercent={70} />
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="Start it" title="A phone call within two working days" />
              {sent ? (
                <SuccessPanel className="mt-6" title="Got it — expect a call this week"
                  description="Twenty minutes, no presentation, and it may well end with us saying this is not for you. That is a fine outcome and it costs you an afternoon rather than a year." />
              ) : (
                <div className="mt-6 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormRow label="Your name" htmlFor="f-name" required>
                      <Input id="f-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
                    </FormRow>
                    <FormRow label="Where you live" htmlFor="f-area" required
                      hint="A postcode is enough. It decides whether there is a territory at all.">
                      <Input id="f-area" autoComplete="postal-code" value={area} onChange={(e) => setArea(e.target.value)} />
                    </FormRow>
                  </div>
                  <FormRow label="Email" htmlFor="f-em" required>
                    <Input id="f-em" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </FormRow>
                  <FormRow label="Anything you want to say first" htmlFor="f-detail"
                    hint="Including 'I have £30,000, not £62,000' — that is a useful thing to open with and it does not end the conversation.">
                    <Textarea id="f-detail" rows={5}
                      placeholder={"Currently a mechanic at a shop in Huddersfield, want my own thing.\nCan raise about £25k myself, would need to borrow the rest.\nCould start after Christmas."}
                      value={detail} onChange={(e) => setDetail(e.target.value)} />
                  </FormRow>
                  <BusyButton disabled={!name || !area || !email} onClick={() => setSent(true)}>
                    Ask for the call
                  </BusyButton>
                  <p className="text-sm text-muted-foreground">
                    No brochure download gate, no drip campaign, and your details go nowhere except
                    to the two people who will ring you.
                  </p>
                </div>
              )}
            </div>
            <div>
              <SectionHeader eyebrow="Asked often" title="About the process" />
              <Faq className="mt-6" items={[
                { question: "Do I need mechanical experience?", answer: "No. Two of the five had none and one was a paramedic. Three weeks of training and a Cytech qualification covers it, and the trade side is much easier to teach than the customer side." },
                { question: "What if the bank says no?", answer: "It is the commonest reason a process stops and it stops about one in three. We will introduce you to two lenders who know the model; neither pays us anything and neither is obliged to say yes." },
                { question: "Can I speak to a franchisee who struggled?", answer: "Yes, and we will give you his number rather than choosing who you speak to. His first winter was bad enough that he nearly handed it back, and he is now the second-best van in the network." },
                { question: "Is there a cooling-off period?", answer: "Fourteen days from signing, full refund of the fee, no questions. It is in the agreement and nobody has used it." },
                { question: "What does head office actually do?", answer: "National marketing, the buying group, the software, the training, and answering the phone. Around 8% of turnover buys that. If it ever stops being worth it, the exit terms are in the agreement and they are not punitive." },
                { question: "How many franchisees have left?", answer: "None since 2019. That is five of five, and it is a small enough number that you should not treat it as a statistic — ring all five and ask them yourself." },
              ]} />
            </div>
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
