// garage — VEHICLE-FIRST: the registration box is the hero, because every price
// and every slot after it depends on which car turned up. A garage is chosen on
// trust and turnaround, so both are stated before any marketing.
import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CtaBand } from "@/components/ui/cta-band";
import { LocationCard } from "@/components/ui/location-card";
import { OpeningHours, type DayHours } from "@/components/ui/opening-hours";
import { PriceList } from "@/components/ui/price-list";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { StatsBand } from "@/components/ui/stats-band";
import { Testimonial } from "@/components/ui/testimonial";
import { TrustStrip } from "@/components/ui/trust-strip";
import { VehicleLookup } from "@/components/ui/vehicle-lookup";
export const Route = createFileRoute("/")({ component: P });
const HOURS: DayHours[] = [
  { day: 1, label: "Monday", open: "08:00", close: "17:30" },
  { day: 2, label: "Tuesday", open: "08:00", close: "17:30" },
  { day: 3, label: "Wednesday", open: "08:00", close: "17:30" },
  { day: 4, label: "Thursday", open: "08:00", close: "17:30" },
  { day: 5, label: "Friday", open: "08:00", close: "17:30" },
  { day: 6, label: "Saturday", open: "08:30", close: "12:30" },
  { day: 0, label: "Sunday", open: null, close: null },
];
function P() {
  const navigate = useNavigate();
  const [state, setState] = useState<"idle" | "looking" | "found" | "unknown">("idle");
  return (
    <SiteChrome name="Hillfoot Motors" tagline="MOT, servicing and repairs on Little London Road."
      links={[{ label: "Prices", href: "/services" }, { label: "Book", href: "/book" }, { label: "Find us", href: "#find-us" }]}
      action={{ label: "Book an MOT", href: "/book" }}>

      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Little London Road · DVSA approved · family run since 1991</p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">Tell us the plate and we'll tell you the price</h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                No estimate that changes on collection. If we find something while it's up, you get a phone
                call and a number before anybody touches it.
              </p>
              <div className="mt-8 max-w-md rounded-xl border border-border bg-background p-5 shadow-sm">
                <VehicleLookup
                  state={state} manualHref="/book"
                  onLookup={() => setState("found")} onReset={() => setState("idle")}
                  vehicle={{ make: "Ford", model: "Focus 1.0 EcoBoost", year: 2019, fuel: "Petrol", mot: "14 March" }} />
                {state === "found" && (
                  <a className="mt-4 inline-block rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="/book">
                    Book its MOT — £54.85
                  </a>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <SafeImage src={null} alt="Ramp one, mid-service" ratio="1/1" />
              <SafeImage src={null} alt="The MOT bay" ratio="1/1" />
              <SafeImage src={null} alt="The waiting room, which has a kettle" ratio="1/1" />
              <SafeImage src={null} alt="Little London Road frontage" ratio="1/1" />
            </div>
          </div>
          <div className="mt-14 border-t border-border pt-10">
            <StatsBand items={[
              { value: "£54.85", label: "MOT — the statutory maximum, not more" },
              { value: "45 min", label: "MOT while you wait" },
              { value: "34 yrs", label: "Same family, same road" },
              { value: "4.8", label: "Google, 610 reviews" },
            ]} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <TrustStrip items={[
          { title: "We ring before we spend", description: "Nothing extra happens without a number and a yes" },
          { title: "Old parts kept", description: "In a box, on the passenger seat, if you want to see them" },
          { title: "Courtesy car, free", description: "Two of them, booked with the job" },
        ]} />
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SectionHeader eyebrow="Prices" title="What the common jobs cost"
              description="Parts on top, quoted before we start. These are what most cars pay." />
            <a className="text-sm font-medium underline underline-offset-4" href="/services">Every job priced →</a>
          </div>
          <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
            <PriceList items={[
              { name: "MOT", description: "The statutory maximum — nobody may charge more", price: 54.85, meta: "45 min, wait if you like" },
              { name: "Interim service", description: "Oil, filter, 32 checks", price: 129, meta: "2 hrs" },
              { name: "Full service", description: "Everything on the interim, plus plugs, air and cabin filters", price: 229, meta: "half a day" },
              { name: "Brake pads, front", description: "Fitted, per axle", price: 145, meta: "1.5 hrs" },
              { name: "Diagnostic", description: "Plugged in and read, refunded if we do the repair", price: 45, meta: "1 hr" },
            ]} action={{ label: "Book", onSelect: () => { navigate({ to: "/book" }); } }} />
            <div className="space-y-6">
              <SafeImage src={null} alt="The diagnostic reader on a bench" ratio="4/3" />
              <div className="rounded-lg border border-border p-5 text-sm leading-relaxed text-muted-foreground">
                <p className="font-medium text-foreground">Failed the MOT?</p>
                <p className="mt-2">
                  The retest is free within ten working days if we do the work. If we don't, it's £27.
                  We'll tell you which is cheaper for you, including when that's somewhere else.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader eyebrow="What people say" title="Mostly about the phone call" />
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          <Testimonial item={{ quote: "Rang me from under the car to say the exhaust would last another year. Could have sold me one and I'd never have known.", name: "Fiona McArdle", role: "Nether Edge" }} />
          <Testimonial item={{ quote: "Quoted £480, came in at £430 because a part was cheaper than they thought. Who does that?", name: "Dan Osei", role: "Heeley" }} />
          <Testimonial item={{ quote: "Waited for the MOT with a brew and a paper. Done in forty minutes flat.", name: "Ray Whittle", role: "Sharrow" }} />
        </div>
      </section>

      <section id="find-us" className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-10 lg:grid-cols-3">
            <div>
              <SectionHeader eyebrow="Find us" title="Little London Road" />
              <LocationCard className="mt-6" name="Hillfoot Motors" address="46 Little London Road, Sheffield, S8 0UJ"
                note="Under the railway bridge, second on the left. Parking on the forecourt while you drop off." />
            </div>
            <div>
              <h3 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">Opening hours</h3>
              <OpeningHours className="mt-5" days={HOURS} />
            </div>
            <SafeImage src={null} alt="The forecourt from the road" ratio="4/5" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <CtaBand title="Book it in" description="Tell us the registration and what it's doing. We'll tell you the price and the day."
          action={{ label: "Book a slot", href: "/book" }} />
      </section>
    </SiteChrome>
  );
}
