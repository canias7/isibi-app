// translation /rates — every pair and document type, including the certifying
// surcharges.
//
// THE MINIMUM CHARGE IS THE THING THAT SURPRISES PEOPLE. A birth certificate is
// about 120 words and at £0.11 that is £13.20, which does not cover reading the
// email. Every firm has a minimum and almost none publishes it, so the quote
// comes back at four times what the customer calculated.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { RateCard } from "@/components/ui/rate-card";
import { PriceList } from "@/components/ui/price-list";
import { TurnaroundNote } from "@/components/ui/turnaround-note";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/rates")({ component: P });

const DOCS = [
  { name: "Birth, marriage or death certificate", description: "About 120 words. The minimum charge applies", price: 45, meta: "each" },
  { name: "Driving licence", description: "Both sides. Minimum charge", price: 45, meta: "each" },
  { name: "Degree certificate", description: "Minimum charge", price: 45, meta: "each" },
  { name: "Academic transcript", description: "Priced per word. Typically 900 to 2,000 words", price: null, meta: "£100 – £220" },
  { name: "Bank statements", description: "Per page, because they are mostly figures", price: 22, meta: "a page" },
  { name: "Medical records", description: "Per word. Handwriting adds £0.04", price: null, meta: "per word" },
  { name: "Contract or legal document", description: "Per word, and always by the legally qualified translator", price: null, meta: "per word + 20%" },
  { name: "Certification statement", description: "Signed and stamped. What UKVI, the DVLA and universities want", price: 25 },
  { name: "Notarisation", description: "By a notary public, for overseas use. Adds three working days", price: 90 },
  { name: "Apostille", description: "FCDO legalisation on top of notarisation. About ten working days", price: 45 },
  { name: "Extra certified hard copy", description: "Posted, signed and stamped", price: 12 },
  { name: "Same-day", description: "On top of the per-word rate, subject to capacity", price: 0.06, meta: "a word" },
];

function P() {
  return (
    <SiteChrome
      name="Attercliffe Language Services"
      tagline="Every rate, and the minimum charge stated."
      links={[
        { label: "Pairs", href: "/" },
        { label: "Send a document", href: "/quote" },
      ]}
      action={{ label: "Get a quote", href: "/quote" }}
    >
      <div className="mx-auto max-w-4xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight">Rates</h1>
        <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
          Per source word, counted before we start. The minimum charge is £45 and it is at the top
          of this page rather than at the bottom — a birth certificate is 120 words and everybody
          who multiplies that by eleven pence gets a shock.
        </p>

        <section className="mt-10">
          <div className="rounded-xl border-2 border-foreground p-6">
            <p className="font-medium">Minimum charge: £45</p>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Any job under about 400 words. It covers reading the file, the translation, a second
              pair of eyes, the certification and the post. Every firm in this trade has one and
              almost none of them prints it.
            </p>
          </div>
        </section>

        <section className="mt-12">
          <SectionHeader
            eyebrow="By volume"
            title="Where the rate falls, and where it does not"
            description="Long documents are cheaper per word because the terminology is established after the first few thousand. Nothing else moves the rate."
          />
          <div className="mt-6">
            <RateCard
              label="Translation, per 1,000 words"
              unit="1,000 words"
              currency="GBP"
              caption="Polish, Slovak, Czech and Romanian. Urdu, Arabic and Farsi are about 15% higher; Tigrinya about 40%."
              note="There is no rush surcharge hidden in here — same-day is a separate line and it is £0.06 a word, stated."
              rates={[
                { period: "Up to 1,000 words", units: 1, price: 110, note: "Or the £45 minimum, whichever is more." },
                { period: "1,000 to 5,000", units: 1, price: 105 },
                { period: "5,000 to 20,000", units: 1, price: 98, note: "A glossary is agreed with you at this size, which is where consistency starts to matter." },
                { period: "Over 20,000", units: 1, price: 92, note: "Quoted properly, with a named project manager and a schedule." },
              ]}
            />
          </div>
        </section>

        <section className="mt-12">
          <div className="grid items-start gap-10 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <SectionHeader
                eyebrow="By document"
                title="Twelve lines, and the certifying surcharges"
                description="Certification is £25 and it is what almost everybody needs. Notarisation and an apostille are for overseas use and are far more often sold than required."
              />
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Before paying for notarisation, ring whoever is receiving the document and ask them
                what they will accept. About half the people who arrive asking for it do not need
                it, and it is £90 plus three days.
              </p>
              <div className="mt-6">
                <TurnaroundNote
                  from={3}
                  to={5}
                  unit="working days"
                  busyNote="Add three working days for notarisation and about ten for an apostille. Neither is under our control."
                />
              </div>
            </div>
            <PriceList items={DOCS} />
          </div>
        </section>

        <section className="mt-12">
          <SectionHeader
            eyebrow="Interpreting"
            title="Priced by the hour with a two-hour minimum"
            description="Because a one-hour booking costs an interpreter a whole morning once travel is counted, and pretending otherwise means either a bad rate or a cancelled booking."
          />
          <div className="mt-6 max-w-2xl">
            <PriceList
              items={[
                { name: "In person, Sheffield", description: "Two-hour minimum, then hourly", price: 58, meta: "an hour" },
                { name: "In person, beyond Sheffield", description: "Plus travel at 45p a mile and travel time at half rate", price: 58, meta: "an hour" },
                { name: "Telephone or video", description: "One-hour minimum. Far cheaper and right for a lot of appointments", price: 42, meta: "an hour" },
                { name: "BSL, in person", description: "RBSLI registered. Two-hour minimum", price: 65, meta: "an hour" },
                { name: "Court or tribunal", description: "NRPSI registered, Polish only. Half-day minimum", price: 240, meta: "half day" },
                { name: "Cancellation, under 24 hours", description: "The interpreter has turned down other work", price: 0, meta: "full fee" },
              ]}
            />
          </div>
        </section>

        <section className="mt-12">
          <SectionHeader title="Rate questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Why is Tigrinya so much more?",
                  answer:
                    "There are very few qualified translators in the UK and demand from asylum casework is high. It is a market rate rather than a markup, and we will tell you if somebody can do it cheaper.",
                },
                {
                  question: "Do you charge VAT?",
                  answer: "We are VAT registered, so yes, 20% on top of every figure here. Prices are shown excluding it because most of our clients are businesses that reclaim it.",
                },
                {
                  question: "Is there a discount for repeat work?",
                  answer:
                    "For anything over 20,000 words a year, yes, and it is a proper account rate rather than a loyalty gesture. Ring and ask rather than waiting to be offered it.",
                },
                {
                  question: "What if I only need part of a document?",
                  answer:
                    "That is fine and it is cheaper. An extract translation is certified as an extract, which is honest and is accepted by most authorities. Tell us which sections.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="/">The pairs and certifications</a>
            {" · "}
            <a className="underline underline-offset-4" href="/quote">Send a document</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
