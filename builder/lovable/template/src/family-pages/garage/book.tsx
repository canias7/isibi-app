// garage /book — the slot and the work, arriving with the vehicle already known.
// The reg is asked once, on the home page, and carried here.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AvailabilityGrid } from "@/components/ui/availability-grid";
import { PriceList } from "@/components/ui/price-list";
import { SectionHeader } from "@/components/ui/section-header";
import { TrustStrip } from "@/components/ui/trust-strip";
import { VehicleLookup } from "@/components/ui/vehicle-lookup";
export const Route = createFileRoute("/book")({ component: P });
function P() {
  const [state, setState] = useState<"idle" | "looking" | "found" | "unknown">("idle");
  const [slot, setSlot] = useState<string | null>(null);
  return (
    <SiteChrome name="Hillfoot Motors" tagline="MOT, servicing and repairs on Little London Road."
      links={[{ label: "Home", href: "#/" }, { label: "Prices", href: "#/services" }]}
      action={{ label: "0114 255 8890", href: "tel:+441142558890" }}>
      <div className="mx-auto max-w-5xl px-6 py-14">
        <SectionHeader eyebrow="Booking" title="Which car, which job, which day"
          description="Three questions in that order, because the first one decides the other two." />
        <div className="mt-10 grid gap-10 lg:grid-cols-[1.3fr_1fr]">
          <div className="space-y-8">
            <div className="rounded-xl border border-border p-5">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">1 · The vehicle</p>
              <div className="mt-4">
                <VehicleLookup state={state} onLookup={() => setState("found")} onReset={() => setState("idle")}
                  vehicle={{ make: "Ford", model: "Focus 1.0 EcoBoost", year: 2019, fuel: "Petrol", mot: "14 March" }} />
              </div>
            </div>
            <div className="rounded-xl border border-border p-5">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">2 · The work</p>
              <PriceList className="mt-4" items={[
                { name: "MOT", price: 54.85, meta: "45 min" },
                { name: "MOT + interim service", description: "The usual pairing", price: 175, meta: "half a day" },
                { name: "Full service", price: 229, meta: "half a day" },
                { name: "Something's wrong — have a look", description: "Diagnostic, refunded against the repair", price: 45, meta: "1 hr" },
              ]} />
            </div>
            <div className="rounded-xl border border-border p-5">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">3 · The day</p>
              <AvailabilityGrid className="mt-4"
                slots={["Mon 08:30", "Mon 11:00", "Tue 08:30", "Tue 13:30", "Wed 08:30", "Wed 11:00", "Thu 13:30", "Fri 08:30"]}
                taken={["Mon 11:00", "Wed 08:30"]} value={slot} onSelect={setSlot} />
              <p className="mt-3 text-sm text-muted-foreground">
                {slot ? `Holding ${slot}. Bring the V5 if you have it — not essential.` : "Morning slots are the ones you can wait for."}
              </p>
            </div>
          </div>
          <aside className="space-y-6">
            <TrustStrip columns={1} items={[
              { title: "Courtesy car", description: "Free, two available, ask when you book" },
              { title: "We ring first", description: "Nothing extra without a number and a yes" },
              { title: "Free retest", description: "Within ten working days if we do the work" },
            ]} />
            <div className="rounded-lg border border-border bg-muted/40 p-5 text-sm leading-relaxed text-muted-foreground">
              <p className="font-medium text-foreground">Would rather ring?</p>
              <p className="mt-2">
                <a className="font-medium text-foreground underline underline-offset-4" href="tel:+441142558890">0114 255 8890</a> —
                Julie picks up, and she has the diary in front of her.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </SiteChrome>
  );
}
