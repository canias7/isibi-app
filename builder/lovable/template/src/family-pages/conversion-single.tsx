// conversion-single — one page, one action; every section answers an objection
// then repeats the button. A benefit gig.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AgendaList } from "@/components/ui/agenda-list";
import { Countdown } from "@/components/ui/countdown";
import { CtaBand } from "@/components/ui/cta-band";
import { StatsBand } from "@/components/ui/stats-band";
import { TicketTiers } from "@/components/ui/ticket-tiers";
export const Route = createFileRoute("/")({ component: P });
function P() {
  const [qty, setQty] = useState<Record<string, number>>({ standard: 0, generous: 0 });
  return (
    <SiteChrome name="A Night for the Archer" tagline="One night. The venue's roof fund.">
      <div className="mx-auto max-w-3xl px-6 py-14 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">A Night for the Archer</h1>
        <p className="mt-3 text-muted-foreground">Four bands, one room, 19 September. Every pound goes to the roof.</p>
        <div className="mt-6 flex justify-center"><Countdown to="2026-09-19T19:30:00" /></div>
        <div className="mt-10"><StatsBand items={[
          { value: "£11,340", label: "Raised so far" }, { value: "£15,000", label: "The roof costs" },
          { value: "214", label: "Tickets gone" }, { value: "86", label: "Left" }]} /></div>
        <section className="mt-10 text-left">
          <TicketTiers currency="GBP" quantities={qty} onQuantity={(k, n) => setQty({ ...qty, [k]: n })}
            onCheckout={() => {}} cta="Get tickets" tiers={[
            { key: "standard", label: "Standard", price: 15, note: "In you come" },
            { key: "generous", label: "Generous", price: 30, note: "A ticket and a tile with your name on it", remaining: 40 },
            { key: "patron", label: "Roof patron", price: 100, note: "Both of the above, side of stage", soldOut: true }]} />
        </section>
        <section className="mt-12 text-left">
          <h2 className="text-lg font-medium">The night</h2>
          <AgendaList className="mt-4" items={[
            { id: 1, at: "2026-09-19T19:30:00", title: "Doors, and the raffle opens" },
            { id: 2, at: "2026-09-19T20:00:00", title: "Dead Wax", meta: "45 min" },
            { id: 3, at: "2026-09-19T21:00:00", title: "The Redgates", meta: "45 min" },
            { id: 4, at: "2026-09-19T22:15:00", title: "Secret headliner", meta: "You know who" }]} />
        </section>
        <div className="mt-12"><CtaBand title="86 tickets left" description="When they're gone, the roof waits another year." action={{ label: "Get tickets", href: "#top" }} /></div>
      </div>
    </SiteChrome>
  );
}
