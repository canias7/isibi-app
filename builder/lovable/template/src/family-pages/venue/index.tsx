// venue — CAPACITY-FIRST: how many it holds, what it costs, and whether the
// date is free. The date box sits in the hero and on every page, because it is
// the only thing anybody came for and it is behind a contact form everywhere
// else on the internet.
import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CapacityTable } from "@/components/ui/capacity-table";
import { DateEnquiry, type DateStatus } from "@/components/ui/date-enquiry";
import { Faq } from "@/components/ui/faq";
import { Gallery } from "@/components/ui/gallery";
import { LocationCard } from "@/components/ui/location-card";
import { PriceList } from "@/components/ui/price-list";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { StatsBand } from "@/components/ui/stats-band";
export const Route = createFileRoute("/")({ component: P });
// A real site reads this out of its own diary. Here it stands in for that
// lookup so the three answers can all be seen: a Saturday in season is taken,
// a midweek date is free, and anything far out is genuinely unknown.
const TAKEN = new Set(["2026-08-15", "2026-08-22", "2026-09-05", "2026-09-12"]);
function P() {
  const [status, setStatus] = React.useState<DateStatus | null>(null);
  const check = ({ date }: { date: string }) => {
    if (TAKEN.has(date)) return setStatus("taken");
    setStatus(date > "2027-06-30" ? "ask" : "free");
  };
  return (
    <SiteChrome name="Thrybergh Barn" tagline="A stone threshing barn for hire, ten minutes from Rotherham."
      links={[{ label: "The spaces", href: "/spaces" }, { label: "Enquire", href: "/enquire" }, { label: "Find us", href: "#find-us" }]}
      action={{ label: "Check a date", href: "/enquire" }}>

      <section className="border-b border-border">
        {/* minmax(0,…) on BOTH tracks. A bare `1fr` is `minmax(auto, 1fr)`, so
            the image column's intrinsic aspect-ratio box becomes its minimum
            and it pushes the text column down to about 350px — the copy, the
            stats and the form all squeezed while the picture takes two thirds.
            Same failure as a `w-full` child inside an auto grid track. */}
        <div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div className="order-2 px-6 py-14 lg:order-1 lg:px-12">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Grade II listed · 1804 · exclusive hire, one event a day</p>
            <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">Thrybergh Barn</h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
              Two hundred standing, a hundred and twenty at round tables, and nobody else on site
              while you have it. Bring your own caterer, your own bar and your own music — we hire
              you the building and then get out of the way.
            </p>
            <StatsBand className="mt-8" items={[
              { value: 200, label: "Standing" },
              { value: 120, label: "Seated" },
              { value: "3am", label: "Music until" },
              { value: 42, label: "Parking" },
            ]} />
            <div className="mt-8">
              <DateEnquiry status={status} minGuests={40} maxGuests={200}
                alternatives={["2026-08-14", "2026-08-16", "2026-08-29"]}
                onCheck={check} onEnquire={() => {}} />
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <SafeImage src={null} alt="The barn at dusk, doors open" ratio="4/3" className="h-full" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SectionHeader eyebrow="The spaces" title="What each room holds, and in what shape"
            description="A single capacity figure is right for one arrangement and wrong for the other five. These are the real numbers, checked against the fire certificate." />
          <a className="text-sm font-medium underline underline-offset-4" href="/spaces">Each room in full →</a>
        </div>
        <CapacityTable className="mt-8" caption="Maximum in each layout" rooms={[
          {
            name: "The threshing floor", size: "18m × 11m · 198m²",
            note: "Original flags, oak trusses, step-free from the yard",
            capacities: { Standing: 200, "Seated, rounds": 120, "Seated, long": 140, Theatre: 160, Cabaret: 90 },
          },
          {
            name: "The hayloft", size: "14m × 8m · 112m²",
            note: "First floor, lift and stairs, low beams at the north end",
            capacities: { Standing: 110, "Seated, rounds": 60, "Seated, long": 72, Theatre: 90 },
          },
          {
            name: "The granary", size: "9m × 6m · 54m²",
            note: "Own entrance and bar. Used as a green room or a crèche",
            capacities: { Standing: 50, "Seated, long": 28, Boardroom: 18 },
          },
          {
            name: "The walled yard", size: "24m × 16m",
            note: "Covered at one end. Marquee anchors already set",
            capacities: { Standing: 250, "Seated, long": 120 },
          },
        ]} />
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <SectionHeader eyebrow="Hire" title="What it costs, all in"
            description="One figure for the building. There is no per-head charge, no corkage and no compulsory anything — every venue that quotes low and then adds those knows exactly what it is doing." />
          <div className="mt-8 grid gap-x-12 gap-y-8 lg:grid-cols-2">
            <PriceList items={[
              { name: "Saturday, whole site", price: 4200, meta: "May–September", description: "Noon until 1am, with the yard, both barns and the granary. Setup from 9am the day before if nothing is booked." },
              { name: "Saturday, whole site", price: 3100, meta: "October–April", description: "Same hours. The threshing floor is heated; the yard is not." },
              { name: "Friday or Sunday", price: 2600, meta: "Any season", description: "The date most people should be asking about and almost nobody does." },
              { name: "Midweek, whole site", price: 1750, description: "Monday to Thursday. Popular with conferences and with anybody paying for it themselves." },
            ]} />
            <PriceList items={[
              { name: "The granary alone", price: 450, meta: "Per day", description: "Meetings, workshops, small wakes. Own entrance, so the rest of the site can be in use." },
              { name: "Extra day for setup", price: 600, description: "Only if the day before is already booked by somebody else. Otherwise it is free." },
              { name: "Late licence to 3am", price: 400, description: "We hold the licence; this is the cost of the extra staffing, not a markup." },
              { name: "Cleaning", price: 0, meta: "Included", description: "Included in every hire. You do not have to be here at 2am with a mop, whatever your last venue said." },
            ]} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="The place" title="Eighteen photographs, none of them staged"
          description="Taken on ordinary days at ordinary events. If a venue only shows you a styled shoot, ask why." />
        <Gallery className="mt-8" columns={4} items={[
          { src: null, alt: "The threshing floor, laid for 120" },
          { src: null, alt: "Oak trusses from the hayloft" },
          { src: null, alt: "The walled yard in July" },
          { src: null, alt: "The granary bar" },
          { src: null, alt: "Ceremony on the threshing floor" },
          { src: null, alt: "Long tables, harvest style" },
          { src: null, alt: "The yard at night" },
          { src: null, alt: "Conference layout, theatre style" },
        ]} />
      </section>

      <section id="find-us" className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <SectionHeader eyebrow="Find us" title="Doncaster Road" />
              <LocationCard className="mt-6" name="Thrybergh Barn"
                address="Home Farm, Doncaster Road, Thrybergh, Rotherham, S65 4NU"
                note="Twelve minutes from the M1 J34 and eight from Rotherham station. Forty-two spaces on hardstanding, plus a field for overflow." />
              <Faq className="mt-8" items={[
                { question: "Can we bring our own caterer?", answer: "Yes, anybody you like. There is a full prep kitchen and we ask only that they carry public liability insurance and a level 2 food hygiene certificate." },
                { question: "Is there corkage?", answer: "None. Bring your own drink or run a paid bar and keep the takings — it is your event." },
                { question: "How late can music go on?", answer: "Midnight as standard, 3am with the late licence. There is a limiter on the sound system and no neighbour within four hundred metres." },
                { question: "Do you take provisional dates?", answer: "For fourteen days, free, no deposit. If somebody else asks for the same date we ring you first and you get 48 hours to decide." },
              ]} />
            </div>
            <SafeImage src={null} alt="The barn from Doncaster Road" ratio="4/3" />
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
