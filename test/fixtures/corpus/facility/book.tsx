// facility /book — the slot grid, peak against off-peak, and what to bring.
// The status board repeats at the top because "is it free now" and "book me a
// court on Thursday" are the same visitor forty seconds apart.
import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AvailabilityGrid } from "@/components/ui/availability-grid";
import { FacilityStatus } from "@/components/ui/facility-status";
import { Faq } from "@/components/ui/faq";
import { RateCard } from "@/components/ui/rate-card";
import { SectionHeader } from "@/components/ui/section-header";
import { WeekStrip } from "@/components/ui/week-strip";
import { NOW } from "./index";
export const Route = createFileRoute("/book")({ component: P });
const SLOTS = ["07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00",
  "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00"];
const TAKEN = ["07:00", "12:00", "17:00", "18:00", "19:00", "20:00"];
function P() {
  const [day, setDay] = React.useState<string | null>("2026-08-06");
  const [slot, setSlot] = React.useState<string | null>(null);
  return (
    <SiteChrome name="Hillsborough Leisure" tagline="Pool, courts, gym and a climbing wall, on Penistone Road."
      links={[{ label: "Home", href: "/" }, { label: "Membership", href: "/membership" }]}
      action={{ label: "Ring 0114 273 4444", href: "tel:01142734444" }}>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="Book a slot" title="Courts and the hall only"
          description="Swimming, the gym and the climbing wall are turn-up-and-pay — booking them would just put a step in front of something you can walk into." />

        <section className="mt-10 grid gap-10 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Which day</h2>
            <WeekStrip className="mt-3" start={new Date(2026, 7, 3)} value={day} onSelect={setDay}
              disabled={["2026-08-09"]} />
            <p className="mt-2 text-sm text-muted-foreground">
              Sunday is club hire all day, which is why it is struck through rather than missing.
            </p>

            <h2 className="mt-8 text-sm font-medium uppercase tracking-widest text-muted-foreground">Badminton, court 1</h2>
            <AvailabilityGrid className="mt-3" slots={SLOTS} taken={TAKEN} value={slot} onSelect={setSlot} />
            <p className="mt-3 text-sm text-muted-foreground">
              Struck through is taken. Evenings go about a fortnight ahead and mornings almost never
              do — a nine o'clock court is nearly always free on the day.
            </p>

            {slot && (
              <div className="mt-6 rounded-lg border border-border p-5">
                <p className="text-base font-semibold">{slot}, one hour, court 1</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {Number(slot.slice(0, 2)) < 16 ? "Off-peak — £9 for the court" : "Peak — £13 for the court"},
                  up to four people. Pay at the desk when you arrive; nothing is taken now.
                </p>
                <a className="mt-4 inline-block rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="/">
                  Hold this court
                </a>
              </div>
            )}
          </div>
          <div>
            <FacilityStatus activities={NOW} updated="Updated 13:42" heading="Meanwhile, right now" />
            <h2 className="mt-8 text-sm font-medium uppercase tracking-widest text-muted-foreground">Bring</h2>
            <ul className="mt-3 divide-y divide-border border-y border-border text-base">
              <li className="py-3">Non-marking trainers for the courts — the desk will turn you away otherwise, and does</li>
              <li className="py-3">Rackets if you have them. Ours are £2 each and they are fine, not good</li>
              <li className="py-3">A pound for the locker, refunded</li>
              <li className="py-3">Nothing for climbing — shoes are in the price</li>
            </ul>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="Prices" title="Peak and off-peak, side by side"
            description="Off-peak is before 4pm on weekdays. Everything else is peak, including all day Saturday and Sunday." />
          <div className="mt-8 max-w-3xl">
            <RateCard label="Activity" unit="visit" bands={["Off-peak", "Peak"]} rates={[
              { period: "Badminton court, per hour", units: 1, price: 9, more: [13] },
              { period: "Squash court, per 40 min", units: 1, price: 7.5, more: [10.5] },
              { period: "Table tennis, per hour", units: 1, price: 5, more: [7] },
              { period: "Sports hall, per hour", units: 1, price: 32, more: [46] },
              { period: "Half hall, per hour", units: 1, price: 21, more: [30] },
              { period: "Block of ten court hours", units: 10, price: 76, more: [110], note: "Bought up front, used any time within a year" },
            ]} note="Court prices are per court and not per person. Four people on a badminton court off-peak is £2.25 each." />
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="max-w-3xl">
            <SectionHeader eyebrow="Asked often" title="About booking" />
            <Faq className="mt-6" items={[
              { question: "How far ahead can I book?", answer: "Fourteen days for everybody, twenty-eight for members. That is most of what the membership buys on the courts side." },
              { question: "Do I pay now?", answer: "No. Booking holds the court and you pay at the desk when you arrive. Turn up twice without cancelling and we stop letting you hold them, which is fair on the people who wanted it." },
              { question: "Can I cancel?", answer: "Up to two hours before, free, on the phone or online. Inside two hours it is charged, because nobody else can take it by then." },
              { question: "What if I am late?", answer: "The court is held fifteen minutes and then it goes. The hour runs from when you booked it either way." },
              { question: "Can I book the same slot every week?", answer: "Yes — a standing booking, and there is no premium for it. Most of the Tuesday evening courts are standing bookings, which is why they look permanently taken." },
            ]} />
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
