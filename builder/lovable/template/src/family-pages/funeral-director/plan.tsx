// funeral-director /plan — the other reader. Somebody sitting at a kitchen
// table with a cup of tea, in no distress and in no hurry, deciding something
// for a family who will be in both. The tone changes completely and it should.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { ArrangementSteps } from "@/components/ui/arrangement-steps";
import { ContactForm } from "@/components/ui/contact-form";
import { Faq } from "@/components/ui/faq";
import { PriceList } from "@/components/ui/price-list";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
export const Route = createFileRoute("/plan")({ component: P });
function P() {
  return (
    <SiteChrome name="Hartley & Vane" tagline="An independent funeral director in Walkley, Sheffield, since 1954."
      links={[{ label: "Home", href: "#/" }, { label: "What it costs", href: "#/costs" }]}
      action={{ label: "Call 0114 234 1954", href: "tel:01142341954" }}>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="Planning ahead" title="The decisions, made while it is easy"
          description="Two things happen when you write it down. The price is fixed at today's, which matters. And every decision your family would be making in the worst week of their lives is already made, which matters more." />

        <div className="mt-10 grid gap-12 lg:grid-cols-[1.15fr_1fr]">
          <div className="space-y-5 text-base leading-relaxed text-muted-foreground">
            <p>
              People come to this for two reasons. Some are well and simply organised. Some have had
              a diagnosis and want to take one thing off the family's list. The conversation is the
              same either way and there is no hurry in either.
            </p>
            <p>
              You do not have to pay anything to write a plan down. We will keep your wishes on file
              at no charge, indefinitely, and there is no obligation on you or on your family to use
              us. Plenty of people do exactly that and it still helps enormously.
            </p>
            <p>
              If you do want to pay in advance, the money goes into a trust that is not ours and
              cannot be reached by us — that is what makes it safe, and it is why we will explain
              how it is held before we explain what it costs.
            </p>
          </div>
          <SafeImage src={null} alt="The room where we sit down with people" ratio="4/3" />
        </div>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="How it goes" title="Four conversations, none of them long" />
          <ArrangementSteps className="mt-10" nothingLabel="Nothing at this stage" steps={[
            {
              title: "You ring, or write, and we come to you",
              when: "Whenever suits — there is no wrong month",
              what: "An hour at your kitchen table or here, whichever you would rather. No paperwork comes out on the first visit and nobody signs anything.",
              youDo: "Think about whether you want anybody else there. Some people bring a daughter; some deliberately do not.",
            },
            {
              title: "We write down what you want",
              what: "Burial or cremation, where, what music, who speaks, what you want to be wearing, whether there are flowers, and the things you would rather did not happen. It can be four lines or forty.",
              youDo: "Say the awkward things. 'No hymns', 'do not let my brother speak', 'I want it to be short' — those are the ones families are most grateful to have in writing.",
            },
            {
              title: "You decide about paying",
              when: "Not on the same day",
              what: "Three options: leave it unfunded and your family pays at the time, fix the price now with a single payment into trust, or pay it monthly. We will set out what each one really costs including the interest.",
              youDo: "Take the figures away and think. If somebody pushes you to sign on the day, at any firm, that is the moment to walk out.",
            },
            {
              title: "It sits on file until it is needed",
              what: "We hold a copy, you hold a copy, and we would suggest one other person knows it exists. You can change any of it at any time, in a phone call, for nothing.",
              youDo: null,
            },
          ]} />
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="If you do pay ahead" title="What a fixed plan costs"
            description="Our fee and the coffin are fixed for good at these prices. The crematorium's own fee cannot be fixed by anybody — no funeral director controls it — so it is held at today's figure and any shortfall is settled at the time. Anyone promising otherwise is promising something they cannot deliver." />
          <PriceList className="mt-6" items={[
            { name: "Direct cremation plan", price: 1595, meta: "Fixed", description: "The unattended cremation, with the crematorium fee held at today's £1,042 and reviewed against theirs at the time." },
            { name: "Simple funeral plan", price: 3250, meta: "Fixed", description: "Service at a time you choose, hearse, bearers, veneered coffin, and the crematorium fee held." },
            { name: "Full funeral plan", price: 4295, meta: "Fixed", description: "As above with a limousine, orders of service, a newspaper notice and flowers." },
            { name: "Wishes on file", price: 0, meta: "No charge, ever", description: "Everything written down and held, with no money involved and no obligation on anybody. About a third of the plans we hold are these." },
          ]} />
          <p className="mt-4 text-sm text-muted-foreground">
            Monthly payment is available over one to ten years through the plan provider. Over ten
            years you will pay meaningfully more than the single-payment price and we will show you
            the exact difference in writing before you decide.
          </p>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <SectionHeader eyebrow="Asked often" title="The things people want to check" />
              <Faq className="mt-6" items={[
                { question: "What happens if you go out of business?", answer: "The money is not held by us. It sits in an independent trust regulated by the Financial Conduct Authority, and if this firm ceased trading the trust would pay another director to carry out your plan." },
                { question: "What if I move away?", answer: "The plan transfers. It is worth its value with any director in the country, though a firm elsewhere may charge more or less than we do and the difference is settled then." },
                { question: "Can I change my mind?", answer: "Yes. Cancel within thirty days and you get everything back. After that there is a cancellation fee set by the provider, which we will show you before you sign." },
                { question: "Does it affect benefits or care fees?", answer: "A pre-paid funeral plan is generally disregarded in a local authority financial assessment, which is one reason people arrange them. Take advice on your own circumstances — we are not financial advisers and will not pretend to be." },
                { question: "Should I put my wishes in my will instead?", answer: "By all means do both, but the will is usually not read until after the funeral. That is the single most common reason wishes are missed." },
              ]} />
            </div>
            <div>
              <SectionHeader eyebrow="Start it" title="Ask for a visit or a phone call"
                description="John or Ellen will ring you back. Nobody from here will call you again afterwards unless you ask us to — no follow-ups and no letters." />
              <ContactForm className="mt-6" askPhone onSubmit={() => {}} />
            </div>
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
