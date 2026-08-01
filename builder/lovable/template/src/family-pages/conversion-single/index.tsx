// conversion-single — one page, one action; every band re-earns the same
// button and nothing links away. A benefit gig: the night, the clock, the
// numbers so far, the tiers, the evening's shape, who's behind it, and the
// button again. A funnel with no exits.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AgendaList } from "@/components/ui/agenda-list";
import { Countdown } from "@/components/ui/countdown";
import { CtaBand } from "@/components/ui/cta-band";
import { Faq } from "@/components/ui/faq";
import { SectionHeader } from "@/components/ui/section-header";
import { StatsBand } from "@/components/ui/stats-band";
import { Testimonial } from "@/components/ui/testimonial";
import { TicketTiers } from "@/components/ui/ticket-tiers";
export const Route = createFileRoute("/")({ component: P });
function P() {
  const [qty, setQty] = useState<Record<string, number>>({ standard: 0, generous: 0, roof: 0 });
  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <span className="font-semibold tracking-tight">A Night for the Archer</span>
          <a className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" href="#tickets">Get tickets</a>
        </div>
      </header>

      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">One night · Saturday 19 September · The Archer, Attercliffe</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance">Four bands, one room, every pound to the roof</h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">The Archer has hosted first gigs for forty years. January's storm took half the roof; this night puts it back.</p>
          <div className="mt-6 flex justify-center"><Countdown to="2026-09-19T19:30:00" /></div>
          <a className="mt-6 inline-block rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground" href="#tickets">Get tickets</a>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-12">
        <StatsBand items={[
          { value: "£11,340", label: "Raised so far" },
          { value: "£15,000", label: "The roof costs" },
          { value: "214", label: "Tickets gone" },
          { value: "86", label: "Left" }]} />
      </section>

      <section id="tickets" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-2xl px-6 py-14">
          <SectionHeader eyebrow="Tickets" title="Pick your price" description="Same room, same night, same bands — the difference is the roof." />
          <TicketTiers className="mt-6" quantities={qty} onQuantity={(k, n) => setQty({ ...qty, [k]: n })}
            onCheckout={() => {}} cta="Get tickets"
            tiers={[
              { key: "standard", label: "Standard", price: 15, note: "In you come", remaining: 61 },
              { key: "generous", label: "Generous", price: 30, note: "A ticket and a tile with your name on it", remaining: 25 },
              { key: "roof", label: "Roof patron", price: 100, note: "Both of the above, side of stage", remaining: 0 },
            ]} />
        </div>
      </section>

      <section className="mx-auto max-w-2xl px-6 py-14">
        <SectionHeader eyebrow="The night" title="Doors at half seven" />
        <AgendaList className="mt-6" items={[
          { id: 1, at: "2026-09-19T19:30:00", title: "Doors, and the raffle opens", meta: "Prizes from every shop on the parade" },
          { id: 2, at: "2026-09-19T20:00:00", title: "Dead Wax", meta: "45 min" },
          { id: 3, at: "2026-09-19T21:00:00", title: "The Redgates", meta: "45 min" },
          { id: 4, at: "2026-09-19T22:15:00", title: "Secret headliner", meta: "You know them. We can't say." },
        ]} />
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-2xl px-6 py-14">
          <Testimonial item={{ quote: "My first gig was at the Archer in '89. My daughter's was there in 2019. That's what the roof is for.", name: "Col Braithwaite", role: "Organiser" }} />
          <Faq className="mt-8" items={[
            { question: "Can't come but want to help?", answer: "The Generous tier works without attending — the tile still goes up with your name." },
            { question: "Where does the money actually go?", answer: "Straight to the roofing contractor's quote, published on the door. Anything over buys the PA the room has deserved for a decade." },
          ]} />
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-14">
        <CtaBand title="86 tickets left" description="When they're gone, the roof waits another year." action={{ label: "Get tickets", href: "#tickets" }} />
      </section>

      <footer className="border-t px-6 py-6 text-center text-xs text-muted-foreground">A Night for the Archer · the venue's own fundraiser · registered CIC 0114887</footer>
    </div>
  );
}
