// campsite /book — free nights and the arrival window, in that order. The gate
// is what strands people, so the window sits beside the calendar rather than in
// a confirmation email nobody reads until they are already on the lane.
import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AvailabilityCalendar } from "@/components/ui/availability-calendar";
import { BusyButton } from "@/components/ui/busy-button";
import { Faq } from "@/components/ui/faq";
import { FormRow } from "@/components/ui/form-row";
import { HouseRules } from "@/components/ui/house-rules";
import { Input } from "@/components/ui/input";
import { PitchTypes } from "@/components/ui/pitch-types";
import { RateCard } from "@/components/ui/rate-card";
import { SectionHeader } from "@/components/ui/section-header";
import { SuccessPanel } from "@/components/ui/success-panel";
import { Textarea } from "@/components/ui/textarea";
import { PITCHES } from "./index";
export const Route = createFileRoute("/book")({ component: P });
const NIGHTS = [
  { date: "2026-08-01", rate: 32 }, { date: "2026-08-02", rate: 27 },
  { date: "2026-08-03", rate: 27 }, { date: "2026-08-04", rate: 27 },
  { date: "2026-08-05", rate: 27 }, { date: "2026-08-06", rate: 27 },
  { date: "2026-08-07", rate: 32 }, { date: "2026-08-08", rate: 32 },
  { date: "2026-08-09", rate: 27 }, { date: "2026-08-10", rate: 27 },
  { date: "2026-08-11", rate: 27 }, { date: "2026-08-12", rate: 27 },
  { date: "2026-08-13", rate: 27 }, { date: "2026-08-14", taken: true },
  { date: "2026-08-15", taken: true }, { date: "2026-08-16", rate: 27 },
  { date: "2026-08-17", rate: 27 }, { date: "2026-08-18", rate: 27 },
  { date: "2026-08-19", rate: 27 }, { date: "2026-08-20", rate: 27 },
  { date: "2026-08-21", rate: 32, minNights: 2 }, { date: "2026-08-22", rate: 32, minNights: 2 },
  { date: "2026-08-23", rate: 27 }, { date: "2026-08-24", rate: 27 },
  { date: "2026-08-25", rate: 27 }, { date: "2026-08-26", rate: 27 },
  { date: "2026-08-27", rate: 27 }, { date: "2026-08-28", taken: true },
  { date: "2026-08-29", taken: true }, { date: "2026-08-30", taken: true },
  { date: "2026-08-31", rate: 27 },
];
function P() {
  const [month, setMonth] = React.useState("2026-08");
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [unit, setUnit] = React.useState("");
  const [sent, setSent] = React.useState(false);
  return (
    <SiteChrome name="Ewden Beck Camping" tagline="Forty-eight pitches on the river, four miles above Stocksbridge."
      links={[{ label: "Home", href: "/" }, { label: "The site", href: "/site" }]}
      action={{ label: "Ring 0114 288 4471", href: "tel:01142884471" }}>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="Book a pitch" title="Free nights, and when the gate shuts"
          description="Both on one page, because one of them is what people plan around and the other is what catches them out at half past ten at night." />

        <section className="mt-10 grid gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Which nights</h2>
            <AvailabilityCalendar className="mt-3" nights={NIGHTS} month={month} onMonth={setMonth}
              now={new Date(2026, 7, 2)}
              priceNote="The price on each night is a grass pitch with electric for two adults. Hardstanding is £5 more and no-electric is £6 less." />
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Struck through means the whole site is full, not one pitch type. The August bank
              holiday goes by about April and we do not hold anything back to release later.
            </p>

            {/* THE WINDOW BESIDE THE CALENDAR, not in the confirmation email.
                Somebody choosing a Friday needs to know now that a Friday
                arrival after eight needs a phone call. */}
            <HouseRules className="mt-8" rules={[]}
              arrive="13:00 – 20:00" leave="11:00"
              lateNote="Later than eight? Ring before you set off and the barrier code goes on the answerphone. The gate is locked at ten every night and there is genuinely no way in without it — no night porter, no keypad, nobody to wake up." />
          </div>
          <div>
            <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">And which pitch</h2>
            <PitchTypes className="mt-3" pitches={PITCHES} heading=""
              note="Tell us the length of your outfit, not the model. We will put you somewhere it fits rather than somewhere it nearly fits." />
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="The extras" title="All of them, and there are six"
            description="No booking fee, no card fee, no cleaning charge and no deposit on anything except the fire pit." />
          <div className="mt-8 max-w-3xl">
            <RateCard label="Extra" unit="night" rates={[
              { period: "Extra adult", units: 1, price: 6 },
              { period: "Child, 5–15", units: 1, price: 4, note: "Under 5s are free and always have been" },
              { period: "Dog", units: 1, price: 3, note: "Two per pitch" },
              { period: "Second car", units: 1, price: 5, note: "In the overflow by the barn, not on the pitch" },
              { period: "Awning on a hardstanding", units: 1, price: 0, note: "Free — it is your pitch and it fits" },
              { period: "Fire pit hire", units: 1, price: 8, note: "For the whole stay, not per night. Wood £6 a net" },
            ]} note="Everything is per night unless it says otherwise. We take payment on arrival, card or cash, and nothing is charged when you book." />
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="Ask for the nights" title="It is a phone call, really" />
              {sent ? (
                <SuccessPanel className="mt-6" title="With us — we'll ring back today"
                  description="Nothing is held until we have spoken. If it is urgent, the phone is faster and somebody is usually in the barn." />
              ) : (
                <div className="mt-6 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormRow label="Your name" htmlFor="c-name" required>
                      <Input id="c-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
                    </FormRow>
                    <FormRow label="Phone" htmlFor="c-phone" required>
                      <Input id="c-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    </FormRow>
                  </div>
                  <FormRow label="What you are bringing, and how long it is" htmlFor="c-unit" required
                    hint="The length in metres matters more than anything else on this form.">
                    <Textarea id="c-unit" rows={5}
                      placeholder={"7.4m Bailey caravan plus an awning.\n2 adults, 2 children (9 and 6), one dog.\n17th to 21st August, hardstanding if there is one."}
                      value={unit} onChange={(e) => setUnit(e.target.value)} />
                  </FormRow>
                  <BusyButton disabled={!name || !phone || !unit} onClick={() => setSent(true)}>
                    Ask about these nights
                  </BusyButton>
                </div>
              )}
            </div>
            <div>
              <SectionHeader eyebrow="Asked often" title="About booking" />
              <Faq className="mt-6" items={[
                { question: "Do you take a deposit?", answer: "No. We hold the pitch on a phone number and you pay when you arrive. About one booking in twenty does not turn up and it has never been worth taking money off the other nineteen to fix that." },
                { question: "Can I pick my pitch?", answer: "You can pick the type. The exact pitch we allocate on the morning, because fitting forty-eight outfits of different lengths together is a jigsaw and we are better at it than a booking form is." },
                { question: "What if the weather is awful?", answer: "Cancel the morning of, no charge, no argument. We would rather have the pitch back than have somebody sat in a wet field regretting it." },
                { question: "Is there a minimum stay?", answer: "Two nights on bank holidays and the last two weekends of August. Otherwise one night is fine and it costs the same per night as five." },
                { question: "Can we arrive on Sunday and stay till Friday?", answer: "Yes, and midweek is the best time to be here — the site is a third full and you can hear the beck." },
                { question: "Do you take groups?", answer: "Up to three pitches together, yes. More than that, no, and not stag or hen groups at all — it is a small valley and sound carries a very long way up it." },
              ]} />
            </div>
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
