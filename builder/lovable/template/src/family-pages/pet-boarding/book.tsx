// pet-boarding /book — the dates and the requirements checklist, IN THAT ORDER.
// Picking nights first is what makes the deadlines real: "you are 19 days out,
// the jab needs 14" is a plan, and "vaccinations required" is a footnote.
import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AvailabilityCalendar } from "@/components/ui/availability-calendar";
import { BusyButton } from "@/components/ui/busy-button";
import { EntryRequirements } from "@/components/ui/entry-requirements";
import { Faq } from "@/components/ui/faq";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { RateCard } from "@/components/ui/rate-card";
import { SectionHeader } from "@/components/ui/section-header";
import { SuccessPanel } from "@/components/ui/success-panel";
import { Textarea } from "@/components/ui/textarea";
import { NIGHTS, RULES } from "./index";
export const Route = createFileRoute("/book")({ component: P });
function P() {
  const [month, setMonth] = React.useState("2026-08");
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [dates, setDates] = React.useState("");
  const [animal, setAnimal] = React.useState("");
  const [sent, setSent] = React.useState(false);
  return (
    <SiteChrome name="Ewden Lane Kennels & Cattery" tagline="Licensed boarding for 24 dogs and 18 cats, in the Don valley."
      links={[{ label: "Home", href: "#/" }, { label: "Where they stay", href: "#/stay" }]}
      action={{ label: "Ring 0114 288 6120", href: "tel:01142886120" }}>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="Book a stay" title="Dates first, then the checklist"
          description="In that order on purpose. Once you know the dates the deadlines become real numbers rather than a policy — nineteen days out is comfortable, nine is not." />

        <section className="mt-10 grid gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Which nights</h2>
            <AvailabilityCalendar className="mt-3" nights={NIGHTS} month={month} onMonth={setMonth}
              now={new Date(2026, 7, 2)}
              priceNote="The price on each night is for one medium dog. Cats and the other sizes are in the table below." />
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Struck through is full and the price on each night is what that night costs for one
              medium dog. Nothing is held until we have spoken — the form below starts that, it does
              not finish it.
            </p>

            <h2 className="mt-8 text-sm font-medium uppercase tracking-widest text-muted-foreground">The rest of the year, roughly</h2>
            <ul className="mt-3 divide-y divide-border border-y border-border text-base">
              <li className="py-3">
                <span className="font-medium">Christmas and New Year</span>
                <span className="block text-sm text-muted-foreground">Booked out by the end of September, every year. Three-night minimum, £6 a night more.</span>
              </li>
              <li className="py-3">
                <span className="font-medium">Easter fortnight</span>
                <span className="block text-sm text-muted-foreground">Usually full by February. Two-night minimum.</span>
              </li>
              <li className="py-3">
                <span className="font-medium">Mid-July to end of August</span>
                <span className="block text-sm text-muted-foreground">The middle two weeks go first. Odd nights come free when people's plans change — worth ringing in June.</span>
              </li>
              <li className="py-3">
                <span className="font-medium">Anything else</span>
                <span className="block text-sm text-muted-foreground">Usually free at a fortnight's notice, sometimes at two days'. Ring rather than assume.</span>
              </li>
            </ul>
          </div>
          <div>
            {/* THE FULL CHECKLIST, beside the calendar rather than behind a link.
                The deadline is the field: everybody knows a kennel wants
                vaccinations, almost nobody knows the booster has a fortnight's
                lead time and expires at twelve months. */}
            <EntryRequirements requirements={RULES}
              heading="What has to be in place"
              intro="All six, before the morning you arrive. The first two have a lead time and are the reason to read this in April rather than in July." />
            <div className="mt-6 rounded-lg border border-border bg-muted/50 p-5">
              <p className="text-base font-medium">If something is not going to be ready, say so now</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                We can usually work round a booster that falls due mid-stay, or a rescue dog with no
                history. We cannot work round finding out at eight in the morning on the day you fly.
                Ring and it will almost always be fine.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="What it will come to" title="The rates again, so you are not going back for them" />
          <div className="mt-8 max-w-3xl">
            <RateCard label="Who is staying" unit="night" bands={["Small", "Medium", "Large"]} rates={[
              { period: "One dog", units: 1, price: 24, more: [26, 30] },
              { period: "Two dogs sharing", units: 1, price: 40, more: [44, 50] },
              { period: "Three dogs sharing", units: 1, price: 54, more: [60, 68] },
              { period: "One cat", units: 1, price: 15, more: [15, 15] },
              { period: "Two cats sharing", units: 1, price: 25, more: [25, 25] },
              { period: "Collection or delivery, within 10 miles", units: 1, price: 18, more: [18, 18], note: "Each way, per journey rather than per animal" },
            ]} note="Peak weeks are £6 a night more and the calendar shows which they are. A 25% deposit holds the dates and it is refundable up to fourteen days before." />
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="Start it off" title="Tell us the dates and the dog" />
              {sent ? (
                <SuccessPanel className="mt-6" title="That's with us — we'll ring today"
                  description="Nothing is held yet. Marie or Tom will call, usually within the hour between eight and six, and the dates are yours once we've spoken." />
              ) : (
                <div className="mt-6 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormRow label="Your name" htmlFor="b-name" required>
                      <Input id="b-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
                    </FormRow>
                    <FormRow label="Phone" htmlFor="b-phone" required hint="We ring rather than email — four minutes instead of four days.">
                      <Input id="b-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    </FormRow>
                  </div>
                  <FormRow label="Nights you want" htmlFor="b-dates" required hint="Arrival and collection dates, or roughly if you are still deciding.">
                    <Input id="b-dates" placeholder="17–24 August" value={dates} onChange={(e) => setDates(e.target.value)} />
                  </FormRow>
                  <FormRow label="Who we would be looking after" htmlFor="b-animal" required
                    hint="Medication, nervousness, a bad experience somewhere else, what they eat. All of it helps and none of it puts us off.">
                    <Textarea id="b-animal" rows={5}
                      placeholder="Two labradors, 8 and 3, brother and sister. The older one is on Metacam twice a day."
                      value={animal} onChange={(e) => setAnimal(e.target.value)} />
                  </FormRow>
                  <BusyButton disabled={!name || !phone || !dates || !animal} onClick={() => setSent(true)}>
                    Ask about these dates
                  </BusyButton>
                  <p className="text-sm text-muted-foreground">
                    This starts a conversation. It does not hold a kennel and it does not take a
                    payment — nothing on this site does.
                  </p>
                </div>
              )}
            </div>
            <div>
              <SectionHeader eyebrow="Asked often" title="About booking" />
              <Faq className="mt-6" items={[
                { question: "Do I have to visit first?", answer: "For a first stay, yes — twenty minutes, any afternoon between two and four. It is as much for us as for you: we need to see the dog somewhere other than the day it is being left." },
                { question: "How much is the deposit?", answer: "25%, refundable up to fourteen days before. Inside fourteen days at peak we keep it, because that night will not go again." },
                { question: "Can I change the dates?", answer: "Once, free, up to a fortnight before, subject to space. After that we will do what we can and usually manage it." },
                { question: "What if I collect early?", answer: "The nights you booked are the nights you pay for at peak, and only the nights used off-peak. That difference is because a peak night we have turned somebody away for cannot be resold on the day." },
                { question: "Do you do one night?", answer: "Yes, off-peak. It is £24 and there is no minimum outside the peak weeks marked on the calendar." },
                { question: "How do I pay?", answer: "Card or bank transfer, balance on collection. No card details are held and there is no online payment on this site — you will not be asked for one anywhere." },
              ]} />
            </div>
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
