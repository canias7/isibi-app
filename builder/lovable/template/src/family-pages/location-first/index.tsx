// location-first — SPLIT-SCREEN structure: the locator IS the left half,
// persistent, and everything else scrolls beside it. Which-one-is-nearest
// stays answerable at every scroll position — that is the family's whole
// question, so it never leaves the screen.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { FeatureGrid } from "@/components/ui/feature-grid";
import { OpenNow } from "@/components/ui/open-now";
import { PricingTable } from "@/components/ui/pricing-table";
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
      links={[{ label: "Kelham", href: "#/location" }, { label: "Memberships", href: "#/memberships" }]}
      action={{ label: "Join — £24.99", href: "#/memberships" }}>

      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-10 md:grid-cols-2">
        {/* LEFT — pinned: the question this site exists to answer. */}
        <div className="self-start md:sticky md:top-20">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">Which Forge is nearest?</h1>
            <OpenNow hours={HOURS} />
          </div>
          <div className="mt-4 rounded-xl border bg-card p-2 shadow-sm">
            <StoreLocator onDirections={() => {}} stores={[
              { id: 1, name: "Forge Kelham", address: "Alma Street, S3 8SA", distance: "0.4 mi", open: true, hoursNote: "Till 10 · strength-led" },
              { id: 2, name: "Forge Heeley", address: "Broadfield Road, S8 0XQ", distance: "1.8 mi", open: true, hoursNote: "Till 10 · biggest timetable" },
              { id: 3, name: "Forge Hillsborough", address: "Langsett Road, S6 2LW", distance: "2.3 mi", open: false, hoursNote: "Opens 6am · pool" },
              { id: 4, name: "Forge Crystal Peaks", address: "Ochre Dike Lane, S20 7HB", distance: "6.1 mi", open: true, phone: "0114 399 0400" }]} />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">One membership works at all four — every plan, every hour. <a className="font-medium underline underline-offset-4" href="#/location">Kelham's own page →</a></p>
        </div>

        {/* RIGHT — everything else, scrolling past the pinned answer. */}
        <div className="grid gap-10">
          <StatsBand items={[
            { value: "4", label: "Gyms, one card" },
            { value: "6,200", label: "Members" },
            { value: "0", label: "Contracts or joining fees" }]} />
          <div>
            <h2 className="text-lg font-medium">What all four share</h2>
            <FeatureGrid className="mt-4" columns={2} items={[
              { title: "24 lifting platforms", description: "No queue for a rack after six, anywhere." },
              { title: "Classes included", description: "Every class, every gym, every plan." },
              { title: "Door code from 6am", description: "Your card opens all four." },
              { title: "Freeze a month", description: "Holiday, injury, exams — one tap." },
            ]} />
          </div>
          <Testimonial item={{ quote: "I lift at Kelham, swim at Hillsborough, and cancelled my old chain's guilt-money membership from the sauna.", name: "Danny F", role: "Member, year three" }} />
          <div>
            <h2 className="text-lg font-medium">The two plans</h2>
            <PricingTable className="mt-4" tiers={[
              { name: "Off-peak", price: "£17.99", period: "month", features: ["Weekdays 9–4 + weekends", "All four gyms"], action: { label: "Join off-peak", href: "#/memberships" } },
              { name: "Anytime", price: "£24.99", period: "month", featured: true, features: ["Every hour we're open", "Guests on Sundays"], action: { label: "Join anytime", href: "#/memberships" } }]} />
            <p className="mt-3 text-sm"><a className="font-medium underline underline-offset-4" href="#/memberships">The fine print, as a table →</a></p>
          </div>
        </div>
      </div>
    </SiteChrome>
  );
}
