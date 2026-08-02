// salon — the slot picker is the hero; everything else supports the
// appointment. A nail studio, laid out in BANDS: hero with the live answer,
// today's chairs up top, then prices, the work, the people, kind words, and
// find-us — the booking action re-earned after every section.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AvailabilityGrid } from "@/components/ui/availability-grid";
import { CtaBand } from "@/components/ui/cta-band";
import { Gallery } from "@/components/ui/gallery";
import { LocationCard } from "@/components/ui/location-card";
import { OpenNow } from "@/components/ui/open-now";
import { OpeningHours, type DayHours } from "@/components/ui/opening-hours";
import { PriceList } from "@/components/ui/price-list";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { StatsBand } from "@/components/ui/stats-band";
import { TeamGrid } from "@/components/ui/team-grid";
import { Testimonial } from "@/components/ui/testimonial";
import { TrustStrip } from "@/components/ui/trust-strip";
export const Route = createFileRoute("/")({ component: P });
const HOURS: DayHours[] = [
  { day: 1, label: "Monday", open: null, close: null },
  { day: 2, label: "Tuesday", open: "10:00", close: "18:00" },
  { day: 3, label: "Wednesday", open: "10:00", close: "18:00" },
  { day: 4, label: "Thursday", open: "10:00", close: "20:00" },
  { day: 5, label: "Friday", open: "10:00", close: "20:00" },
  { day: 6, label: "Saturday", open: "09:00", close: "17:00" },
  { day: 0, label: "Sunday", open: null, close: null },
];
function P() {
  const [slot, setSlot] = useState<string | null>(null);
  return (
    <SiteChrome name="Tenfold Nails" tagline="Ten chairs on Ecclesall Road."
      links={[{ label: "Prices", href: "#prices" }, { label: "The work", href: "#/work" }, { label: "The team", href: "#team" }, { label: "Find us", href: "#find-us" }]}
      action={{ label: "Book now", href: "#/book" }}>

      {/* Hero: the promise, the live answer, the two ways in — and the WORK,
          which for a nail studio is the entire sales pitch. The first version
          had no picture on it at all, which is the one thing a customer is
          actually shopping for. */}
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Ecclesall Road · Sheffield</p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">Nails done properly, ten chairs deep</h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                BIAB, gel and proper hand-painted art. Walk-ins most weekdays; Saturdays book out by Thursday.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="#/book">Book a chair</a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#/work">See the work</a>
                <OpenNow hours={HOURS.filter((h) => h.open).map((h) => ({ day: h.day, open: h.open!, close: h.close! }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <SafeImage src={null} alt="BIAB, milky pink" ratio="1/1" />
              <SafeImage src={null} alt="Hand-painted florals over gel" ratio="1/1" />
              <SafeImage src={null} alt="Tortoiseshell, short and round" ratio="1/1" />
              <SafeImage src={null} alt="Chrome, done on Saturday" ratio="1/1" />
            </div>
          </div>
          <div className="mt-14 border-t border-border pt-10">
            <StatsBand items={[
              { value: "10", label: "Chairs, so the wait is rarely the story" },
              { value: "4.9", label: "On Google, 312 reviews" },
              { value: "3 wk", label: "What most people rebook at" },
              { value: "£22", label: "Shape and paint, start to finish" },
            ]} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <TrustStrip items={[
          { title: "4.9 on Google", description: "Three hundred reviews, mostly about the art" },
          { title: "BIAB specialists", description: "Two of the four of us do nothing else" },
          { title: "Ten chairs", description: "The wait is rarely the story here" },
        ]} />
      </section>

      {/* The booking surface itself — the family's hero object, high on the page. */}
      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader eyebrow="Today" title="Today's chairs" description="Pick a time; we hold it for ten minutes while you choose a finish." />
          <div className="mt-8 grid gap-8 lg:grid-cols-[1.35fr_1fr]">
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <AvailabilityGrid
                slots={["10:00", "10:45", "11:30", "12:15", "14:00", "14:45", "15:30", "16:15"]}
                taken={["10:45", "14:00"]} value={slot} onSelect={setSlot} />
              <p className="mt-4 text-sm text-muted-foreground">{slot ? `Holding ${slot} — finish up on the booking page.` : "Tap a time to hold it."}</p>
              {slot && <a className="mt-2 inline-block text-sm font-medium underline underline-offset-4" href="#/book">Continue to book {slot} →</a>}
            </div>
            <SafeImage src={null} alt="The row of chairs, Saturday morning" ratio="4/3" />
          </div>
        </div>
      </section>

      <section id="prices" className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader eyebrow="The price list" title="What it costs" description="Every set includes cuticle work and a proper base. Art is priced by time on the day." />
        <PriceList className="mt-8" items={[
          { name: "Shape and paint", description: "The classic — tidy, colour, done", price: 22, meta: "30 min" },
          { name: "Gel, full set", description: "Two weeks of shine, no chips", price: 34, meta: "50 min" },
          { name: "BIAB overlay", description: "Strength under the colour — our most-booked", price: 38, meta: "60 min" },
          { name: "Hand-painted art", description: "From simple lines to the full Matisse", price: 12, meta: "on top" },
          { name: "Removal and tidy", description: "Whatever's on, off properly", price: 14, meta: "25 min" },
        ]} action={{ label: "Book", onSelect: () => { location.hash = "#/book"; } }} />
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SectionHeader eyebrow="The work" title="Recent sets" />
            <a className="text-sm font-medium underline underline-offset-4" href="#/work">The whole gallery →</a>
          </div>
          <Gallery className="mt-8" columns={3} items={[
            { alt: "BIAB, milky pink — Mei", caption: "BIAB, milky pink — Mei" },
            { alt: "Hand-painted florals over gel", caption: "Florals, hand-painted over gel" },
            { alt: "Tortoiseshell, short and round", caption: "Tortoiseshell, short and round" },
            { alt: "Chrome over a navy base", caption: "Chrome over navy — Sofia" },
            { alt: "A french, done properly", caption: "A french, done properly" },
            { alt: "Dahlias painted from a photograph", caption: "Dahlias, from a customer's photo" },
          ]} />
        </div>
      </section>

      <section id="team" className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader eyebrow="Who's on" title="Pick your chair" description="Ask for whoever did you last — it's on your booking either way." />
        <TeamGrid className="mt-8" items={[
          { name: "Mei Lin", role: "Owner — BIAB and art" },
          { name: "Sofia Petrov", role: "Gel and chrome" },
          { name: "Amber Quinn", role: "Classic manicure" },
          { name: "Jade Nakamura", role: "Saturdays" },
        ]} />
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader eyebrow="Kind words" title="From the chairs" />
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <Testimonial item={{ quote: "Mei painted my gran's dahlias from a photo. I cried in the chair, ruined nothing — they were dry.", name: "Leah Okon", role: "BIAB, every three weeks" }} />
            <Testimonial item={{ quote: "Booked at 11, seen at 11. The ten chairs thing is real.", name: "Ferne Whitely", role: "Walk-in convert" }} />
          </div>
        </div>
      </section>

      <section id="find-us" className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:grid-cols-2">
        <div>
          <SectionHeader eyebrow="Find us" title="On Ecclesall Road" />
          <div className="mt-6 max-w-sm"><OpeningHours days={HOURS} /></div>
        </div>
        <LocationCard className="self-start" name="Tenfold Nails" address="312 Ecclesall Road, Sheffield S11 8PE" note="Between the bakery and the bike shop. The 81 and 82 stop outside." />
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand title="A chair is usually free today" description="Book in thirty seconds — we confirm by text." action={{ label: "Book now", href: "#/book" }} />
      </section>
    </SiteChrome>
  );
}
