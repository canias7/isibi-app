// conversion-single — FULL-BLEED-HERO structure: an edge-to-edge opening,
// then ONE centered measure for everything after it. A poster, then a
// funnel — the narrow column is the point; there is nowhere to look but
// down, and nothing at the bottom but the button.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AgendaList } from "@/components/ui/agenda-list";
import { Countdown } from "@/components/ui/countdown";
import { Faq } from "@/components/ui/faq";
import { SafeImage } from "@/components/ui/safe-image";
import { StatsBand } from "@/components/ui/stats-band";
import { Testimonial } from "@/components/ui/testimonial";
import { TicketTiers } from "@/components/ui/ticket-tiers";
export const Route = createFileRoute("/")({ component: P });
function P() {
  const [qty, setQty] = useState<Record<string, number>>({ standard: 0, generous: 0, roof: 0 });
  return (
    <div className="min-h-svh bg-background text-foreground">
      {/* The poster: full-bleed, the name over it, one button. */}
      <div className="relative">
        <SafeImage src={null} alt="The Archer's stage under the tarpaulin, lit anyway" ratio="16/7" className="rounded-none" />
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-t from-background via-background/40 to-transparent px-6 text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Saturday 19 September · The Archer, Attercliffe</p>
          <h1 className="mt-3 max-w-2xl text-5xl font-semibold tracking-tight text-balance">Four bands, one room, every pound to the roof</h1>
          <div className="mt-5"><Countdown to="2026-09-19T19:30:00" /></div>
          <a className="mt-6 rounded-md bg-primary px-8 py-3 text-sm font-medium text-primary-foreground" href="#tickets">Get tickets</a>
        </div>
      </div>

      {/* One centered measure from here to the end. */}
      <main className="mx-auto max-w-xl px-6">
        <p className="py-10 text-center text-lg leading-relaxed text-muted-foreground">The Archer has hosted first gigs for forty years. January's storm took half the roof; this night puts it back.</p>

        <StatsBand items={[
          { value: "£11,340", label: "Raised" },
          { value: "£15,000", label: "The roof" },
          { value: "86", label: "Tickets left" }]} />

        <section id="tickets" className="mt-12">
          <h2 className="text-center text-2xl font-semibold tracking-tight">Pick your price</h2>
          <p className="mt-1 text-center text-sm text-muted-foreground">Same room, same bands — the difference is the roof.</p>
          <TicketTiers className="mt-6" quantities={qty} onQuantity={(k, n) => setQty({ ...qty, [k]: n })}
            onCheckout={() => {}} cta="Get tickets"
            tiers={[
              { key: "standard", label: "Standard", price: 15, note: "In you come", remaining: 61 },
              { key: "generous", label: "Generous", price: 30, note: "A ticket and a tile with your name on it", remaining: 25 },
              { key: "roof", label: "Roof patron", price: 100, note: "Both of the above, side of stage", remaining: 0 },
            ]} />
        </section>

        <section className="mt-12">
          <h2 className="text-center text-2xl font-semibold tracking-tight">The night</h2>
          <AgendaList className="mt-6" items={[
            { id: 1, at: "2026-09-19T19:30:00", title: "Doors, and the raffle opens", meta: "Prizes from every shop on the parade" },
            { id: 2, at: "2026-09-19T20:00:00", title: "Dead Wax", meta: "45 min" },
            { id: 3, at: "2026-09-19T21:00:00", title: "The Redgates", meta: "45 min" },
            { id: 4, at: "2026-09-19T22:15:00", title: "Secret headliner", meta: "You know them. We can't say." },
          ]} />
        </section>

        <Testimonial className="mt-12" item={{ quote: "My first gig was at the Archer in '89. My daughter's was there in 2019. That's what the roof is for.", name: "Col Braithwaite", role: "Organiser" }} />

        <Faq className="mt-12" items={[
          { question: "Can't come but want to help?", answer: "The Generous tier works without attending — the tile still goes up with your name." },
          { question: "Where does the money actually go?", answer: "Straight to the roofer's quote, published on the door. Anything over buys the PA the room deserved a decade ago." },
        ]} />

        <div className="py-14 text-center">
          <p className="text-2xl font-semibold tracking-tight">86 tickets left</p>
          <p className="mt-1 text-sm text-muted-foreground">When they're gone, the roof waits another year.</p>
          <a className="mt-5 inline-block rounded-md bg-primary px-8 py-3 text-sm font-medium text-primary-foreground" href="#tickets">Get tickets</a>
        </div>
      </main>
      <footer className="border-t px-6 py-6 text-center text-xs text-muted-foreground">A Night for the Archer · the venue's own fundraiser · registered CIC 0114887</footer>
    </div>
  );
}
