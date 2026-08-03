// broadband /switching — the two moves that actually happen: changing provider
// at the same address, and taking the service to a new one. Both are about
// DATES and an overlap, and both are where people get charged twice.
//
// The exit fee your OLD provider will charge is the thing nobody's switching
// page mentions, because it makes the switch look worse. It is the first
// number here.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { ContractEnd } from "@/components/ui/contract-end";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/switching")({ component: P });

const STEPS = [
  {
    n: "1",
    what: "Find out what leaving costs you",
    detail:
      "Ring your current provider and ask for the exit fee and the contract end date. They must tell you both. If the fee is more than a couple of months of savings, wait — we will hold the price you were quoted for ninety days.",
  },
  {
    n: "2",
    what: "Book the install with us",
    detail:
      "Two hours, somebody over sixteen at home. We give you a named engineer and a four-hour window, not a day.",
  },
  {
    n: "3",
    what: "Keep the old line running until ours works",
    detail:
      "Overlap by a week deliberately. Paying twice for seven days is far better than a house with no connection because a cutover slipped, which is the single most common way this goes wrong.",
  },
  {
    n: "4",
    what: "Cancel the old one yourself",
    detail:
      "We do not do it for you and we will not pretend to. A provider can only be cancelled by its own customer, and any company telling you otherwise is arranging for you to be billed.",
  },
];

function P() {
  return (
    <SiteChrome
      name="Ewden Fibre"
      tagline="Switching, or moving house. Both come down to dates."
      links={[
        { label: "Check an address", href: "#/" },
        { label: "Packages", href: "#/packages" },
      ]}
      action={{ label: "Check my address", href: "#/" }}
    >
      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <div className="grid items-start gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight text-balance">
                The number your current provider would rather you did not check
              </h1>
              <p className="mt-5 max-w-lg leading-relaxed text-muted-foreground">
                Most people switching are still inside a contract and do not know it. Before
                anything else, find out what leaving costs — it is often nothing, and when it is
                not, waiting two months is the right answer and we will say so.
              </p>
              <p className="mt-4 max-w-lg leading-relaxed text-muted-foreground">
                Here is what one of ours looks like when it is coming to an end, so you know what
                you are asking them for.
              </p>
            </div>
            {/* A worked example of the thing they have to go and ask about,
                so the phone call has a shape. */}
            <ContractEnd
              endsOn="2026-11-14"
              daysLeft={103}
              currentPrice={44}
              rollingPrice={54}
              exitFee={0}
            />
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <SectionHeader
            eyebrow="Same address, different provider"
            title="Four steps, in this order"
            description="Step three is the one people skip and the one that costs them a week without a connection."
          />
          <ol className="mt-8 divide-y divide-border border-y border-border">
            {STEPS.map((s) => (
              <li key={s.n} className="flex gap-5 py-5">
                <span className="w-6 shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">{s.n}</span>
                <div className="min-w-0">
                  <p className="font-medium">{s.what}</p>
                  <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{s.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <SectionHeader
            eyebrow="Moving house"
            title="Inside the valley, and outside it"
            description="One of these is easy and one of them is a cancellation. We would rather say which."
          />
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">Moving within the network</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                The service moves with you and the contract carries on. One engineer visit at the
                new place, no new contract term, no fee. Give us three weeks if you can.
              </p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">Moving out of the area</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                We cannot follow you and we do not charge you for leaving. Send the completion date
                and the contract ends on it, whatever term is left. That is written into it.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-3xl px-6 py-14">
          <SectionHeader title="Switching questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Will I lose service between providers?",
                  answer:
                    "Not if you overlap. Keep the old line live until ours is tested and working, then cancel. A week of paying twice is the cheapest insurance in this whole process.",
                },
                {
                  question: "Can I keep my email address?",
                  answer:
                    "If it ends in your old provider's domain, no — that address belongs to them and it goes when the account does. Move to something independent first; it is the one part of switching that is genuinely a chore.",
                },
                {
                  question: "My street is not on the network. What now?",
                  answer:
                    "Tell us anyway. Streets are dug in the order of how many people have asked, and that list is the whole plan. Four streets are on this network because enough people registered interest.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="#/">Check your address</a>
            {" · "}
            <a className="underline underline-offset-4" href="#/packages">See every package</a>
          </p>
        </div>
      </section>
    </SiteChrome>
  );
}
