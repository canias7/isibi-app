// location-first — the locator is load-bearing; nearest-to-you is the first
// answer. A gym chain.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { LocationCard } from "@/components/ui/location-card";
import { OpenNow } from "@/components/ui/open-now";
import { StoreLocator } from "@/components/ui/store-locator";
export const Route = createFileRoute("/")({ component: P });
function P() {
  return (
    <SiteChrome name="Forge Gyms" tagline="Four gyms, one membership, no contracts."
      links={[{ label: "Find a gym", href: "#find" }, { label: "Join", href: "#find" }]}
      action={{ label: "Join — £24.99", href: "#find" }}>
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">Which Forge is nearest?</h1>
          <OpenNow hours={[{ day: 1, open: "06:00", close: "22:00" }, { day: 2, open: "06:00", close: "22:00" },
            { day: 3, open: "06:00", close: "22:00" }, { day: 4, open: "06:00", close: "22:00" },
            { day: 5, open: "06:00", close: "22:00" }, { day: 6, open: "08:00", close: "20:00" }, { day: 0, open: "08:00", close: "20:00" }]} />
        </div>
        {/* The locator IS the page. Everything else hangs off which one you pick. */}
        <div id="find" className="mt-6">
          <StoreLocator onDirections={() => {}} stores={[
            { id: 1, name: "Forge Kelham", address: "Alma Street, S3 8SA", distance: "0.4 mi", open: true, hoursNote: "Till 10" },
            { id: 2, name: "Forge Heeley", address: "Broadfield Road, S8 0XQ", distance: "1.8 mi", open: true, hoursNote: "Till 10" },
            { id: 3, name: "Forge Hillsborough", address: "Langsett Road, S6 2LW", distance: "2.3 mi", open: false, hoursNote: "Opens 6am" },
            { id: 4, name: "Forge Crystal Peaks", address: "Ochre Dike Lane, S20 7HB", distance: "6.1 mi", open: true, phone: "0114 399 0400" }]} />
        </div>
        <p className="mt-4 text-sm"><a className="underline underline-offset-4" href="#/location">Kelham's own page — today's classes and how to join →</a></p>
        <LocationCard className="mt-8" name="Head office" address="Unit 3, Alma Street, Sheffield S3 8SA" note="Every membership works at every gym, always." />
      </div>
    </SiteChrome>
  );
}
