// home-care /arrange — the assessment, and how funding works. Two audiences on
// one page: somebody paying themselves, who wants to know the rate, and
// somebody about to discover the council will not cover it.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { ContactForm } from "@/components/ui/contact-form";
import { Faq } from "@/components/ui/faq";
import { InspectionRating } from "@/components/ui/inspection-rating";
import { RateCard } from "@/components/ui/rate-card";
import { SectionHeader } from "@/components/ui/section-header";
import { Steps } from "@/components/ui/steps";
import { TrustStrip } from "@/components/ui/trust-strip";
import { RATING, RATES } from "./index";
export const Route = createFileRoute("/arrange")({ component: P });
function P() {
  return (
    <SiteChrome name="Loxley Home Care" tagline="Care at home in west Sheffield. Employed carers, CQC Good."
      links={[{ label: "Home", href: "/" }, { label: "What we do", href: "/services" }]}
      action={{ label: "Ring 0114 234 5511", href: "tel:01142345511" }}>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="Arrange it" title="A free assessment, and an honest answer"
          description="An hour at the kitchen table, no charge and no obligation, and about one in seven ends with us saying somebody needs more than we can give at home." />

        <TrustStrip className="mt-10" items={[
          { title: "Free assessment", description: "An hour, at home, no obligation" },
          { title: "Usually within a week", description: "Same day on a hospital discharge" },
          { title: "A week's notice to stop", description: "No contract and no minimum term" },
        ]} />

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="How it goes" title="Four steps, and you can stop at any of them" />
          <Steps className="mt-8" items={[
            { title: "A phone call", description: "Ten minutes. What is happening, what has changed, and whether we cover the postcode. We will tell you straight away if we are wrong for it." },
            { title: "The assessment", description: "An hour at home, free. Angela or Foday, whoever it will be. Bring anybody who should be part of it, including the person themselves — they are not furniture." },
            { title: "A written plan and a price", description: "What each call is, how long, what it costs a week. In writing before anybody commits, and yours to take to another agency and compare." },
            { title: "You meet the carers", description: "Before the first visit, named, in your own home. If it is not a fit we change them and nobody is offended." },
          ]} />
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="grid gap-12 lg:grid-cols-[1.15fr_1fr]">
            <div>
              <SectionHeader eyebrow="Paying" title="Three ways it gets paid for, and one of them surprises everybody" />
              <div className="mt-6 space-y-6">
                <div className="border-t border-border pt-5">
                  <h3 className="text-xl font-medium tracking-tight">Paying yourself</h3>
                  <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                    Above £23,250 in savings, this is you. Invoiced monthly in arrears for the
                    visits actually made — a cancelled call inside 24 hours is not charged, and one
                    cancelled at the door is.
                  </p>
                </div>
                <div className="border-t border-border pt-5">
                  <h3 className="text-xl font-medium tracking-tight">The council</h3>
                  <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                    Ring adult social care for a Care Act assessment — it is free and it is a legal
                    right regardless of savings. Sheffield currently pays{" "}
                    <span className="font-medium text-foreground">£21.60 an hour</span>, which is
                    £7.40 short of our rate. That gap is the thing nobody mentions until the care
                    plan arrives.
                  </p>
                  <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                    A direct payment lets you take the council's money and choose your own agency,
                    topping up the difference. About a fifth of our clients do exactly that.
                  </p>
                </div>
                <div className="border-t border-border pt-5">
                  <h3 className="text-xl font-medium tracking-tight">NHS Continuing Healthcare</h3>
                  <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                    Covers the whole cost where somebody's needs are primarily health rather than
                    social. It is hard to get, it is worth applying for, and we will sit in on the
                    assessment and write what we see. Nobody should attempt one alone.
                  </p>
                </div>
              </div>
              <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
                Also worth claiming and routinely missed: Attendance Allowance (not means-tested,
                £73.90 or £110.40 a week), and a council tax reduction where somebody is severely
                mentally impaired. Neither has anything to do with us and both are money.
              </p>
            </div>
            <div>
              <SectionHeader eyebrow="The rates again" title="So you have them here" />
              <RateCard className="mt-6" label="Visit length" unit="hour" bands={["Weekday", "Weekend", "Bank holiday"]} rates={RATES} />
              <InspectionRating className="mt-8" {...RATING} />
            </div>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="Start" title="Tell us what is happening"
                description="Angela reads these. She will ring back the same day, and if we are the wrong agency she will say so and give you two names." />
              <ContactForm className="mt-6" askPhone onSubmit={() => {}} />
            </div>
            <div>
              <SectionHeader eyebrow="Asked often" title="About arranging it" />
              <Faq className="mt-6" items={[
                { question: "How quickly can care start?", answer: "Usually within a week. Same day for a hospital discharge — ring us from the ward and we will do the assessment there." },
                { question: "Is the assessment really free?", answer: "Yes, and there is nothing to sign at the end of it. We do about two hundred a year and a good number end with us recommending somebody else." },
                { question: "What if they refuse care?", answer: "Very common, and the answer is almost never to push. We start with something that is not personal care — a sitting call, or shopping — and the rest follows once there is a relationship." },
                { question: "Can we start with one call and see?", answer: "That is what most people do. One morning call, then add as it is needed. Starting big is how a package gets resented." },
                { question: "What notice to stop?", answer: "A week, and none at all in the first fortnight. If somebody goes into hospital we pause and charge nothing." },
                { question: "Do you charge for travel?", answer: "No. Our carers are paid for their travel time and we absorb it — that is what the tight patch is for." },
              ]} />
            </div>
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
