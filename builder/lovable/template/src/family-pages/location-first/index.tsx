// location-first — the locator is load-bearing; nearest-to-you is the first
// answer. A gym chain: the locator up top, what every gym shares, the
// membership pitch, and proof — because "which one is nearest" is question
// one and "is it any good" is question two.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CtaBand } from "@/components/ui/cta-band";
import { FeatureGrid } from "@/components/ui/feature-grid";
import { OpenNow } from "@/components/ui/open-now";
import { SectionHeader } from "@/components/ui/section-header";
import { StatsBand } from "@/components/ui/stats-band";
import { StoreLocator } from "@/components/ui/store-locator";
import { Testimonial } from "@/components/ui/testimonial";
export const Route = createFileRoute("/")({ component: P });
const HOURS = [
  { day: 1, open: "06:00", close: "22:00" }, { day: 2, open: "06:00", close: "22:00" },
  { day: 3, open: "06:00", close: "22:00" }, { day: 4, open: "06:00", close: "22:00" },
  { day: 5, open: "06:00", close: "22:00" }, { day: 6, open: "08:00", close: "20:00" }, { day: 0, open: "08:00", close: "20:00" },
];
function P() {
  return (
    <SiteChrome name="Forge Gyms" tagline="Four gyms, one membership, no contracts."
      links={[{ label: "Find a gym", href: "#find" }, { label: "Kelham", href: "#/location" }, { label: "Memberships", href: "#/memberships" }]}
      action={{ label: "Join — £24.99", href: "#/memberships" }}>

      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Four gyms across the city</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight">Which Forge is nearest?</h1>
              <p className="mt-3 max-w-md text-lg text-muted-foreground">One membership works at all four, every hour we're open, no contract anywhere.</p>
            </div>
            <OpenNow hours={HOURS} />
          </div>
          {/* The locator IS the page. Everything else hangs off which one you pick. */}
          <div id="find" className="mt-6 rounded-xl border bg-card p-2 shadow-sm">
            <StoreLocator onDirections={() => {}} stores={[
              { id: 1, name: "Forge Kelham", address: "Alma Street, S3 8SA", distance: "0.4 mi", open: true, hoursNote: "Till 10 · strength-led — see its page" },
              { id: 2, name: "Forge Heeley", address: "Broadfield Road, S8 0XQ", distance: "1.8 mi", open: true, hoursNote: "Till 10 · biggest class timetable" },
              { id: 3, name: "Forge Hillsborough", address: "Langsett Road, S6 2LW", distance: "2.3 mi", open: false, hoursNote: "Opens 6am · pool" },
              { id: 4, name: "Forge Crystal Peaks", address: "Ochre Dike Lane, S20 7HB", distance: "6.1 mi", open: true, phone: "0114 399 0400" }]} />
          </div>
          <p className="mt-3 text-sm"><a className="font-medium underline underline-offset-4" href="#/location">Kelham's own page — today's classes and how to join →</a></p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-14">
        <SectionHeader eyebrow="Every Forge" title="What all four share" />
        <FeatureGrid className="mt-8" columns={3} items={[
          { title: "24 lifting platforms", description: "Across the four — no queue for a rack after six anywhere." },
          { title: "Classes included", description: "Every class, every gym, in every membership. No class packs." },
          { title: "Door code entry", description: "Your card opens all four from 6am. Staffed hours till close." },
          { title: "No contracts", description: "Cancel at any desk, effective end of month. No retention call." },
          { title: "Freeze a month", description: "Holiday, injury, exams — one tap at the desk." },
          { title: "Guests on Sundays", description: "Bring someone on the Anytime plan. They'll join anyway." },
        ]} />
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-12">
          <StatsBand items={[
            { value: "4", label: "Gyms, one membership" },
            { value: "6,200", label: "Members" },
            { value: "£24.99", label: "Anytime, monthly" },
            { value: "0", label: "Joining fees, ever" }]} />
          <Testimonial className="mt-10" item={{ quote: "I lift at Kelham, swim at Hillsborough, and cancel my old chain's guilt-money membership from the sauna.", name: "Danny F", role: "Member, year three" }} />
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-14">
        <CtaBand title="£24.99 everywhere, or £17.99 off-peak" description="Join in two minutes at any desk — bring nothing." action={{ label: "Compare the plans", href: "#/memberships" }} />
      </section>
    </SiteChrome>
  );
}
