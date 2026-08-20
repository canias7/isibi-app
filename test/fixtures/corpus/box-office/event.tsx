// box-office /event — one night in full: its own countdown, the seats as
// they stand RIGHT NOW, the tiers with honest remaining counts. Freshness is
// shown, not implied — the viewer count and the last-updated line are load-
// bearing, because stale-looking data is this family's failure state.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Countdown } from "@/components/ui/countdown";
import { LiveBadge } from "@/components/ui/live-badge";
import { SeatMap, type Seat } from "@/components/ui/seat-map";
import { TicketTiers } from "@/components/ui/ticket-tiers";
import { ViewerCount } from "@/components/ui/viewer-count";
export const Route = createFileRoute("/event")({ component: P });
const CHROME = {
  name: "The Playhouse", tagline: "Box office, but honest about the clock.",
  links: [{ label: "On-sale board", href: "/" }, { label: "This show", href: "/event" }],
};
const SEATS: Seat[] = Array.from({ length: 40 }, (_, i) => {
  const row = Math.floor(i / 10), col = i % 10;
  return { id: `s${i}`, x: col, y: row, label: `${"ABCD"[row]}${col + 1}`, taken: [3, 4, 7, 11, 12, 13, 18, 21, 25, 26, 33].includes(i) };
});
function P() {
  const [picked, setPicked] = useState<string[]>([]);
  const [qty, setQty] = useState<Record<string, number>>({ stalls: 0, circle: 0 });
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-3xl px-6 py-12">
        <a className="text-sm text-muted-foreground underline underline-offset-4" href="/">← Everything on sale</a>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">An Inspector Calls — press night</h1>
          <LiveBadge label="Selling fast" />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span>Friday 19 September, 7:30pm</span>
          <ViewerCount count={57} verb="choosing seats now" />
        </div>
        <div className="mt-6 rounded-xl border bg-muted/40 p-4 text-center">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Held seats release in</p>
          <div className="mt-1 flex justify-center"><Countdown to="2026-09-19T19:30:00" /></div>
        </div>
        <section className="mt-8">
          <h2 className="text-lg font-medium">Pick your seats</h2>
          <p className="mt-1 text-xs text-muted-foreground">As of a minute ago — struck seats are gone.</p>
          <SeatMap className="mt-4" seats={SEATS} selected={picked}
            onSelect={(id) => setPicked((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id])}
            legend={<span className="text-xs text-muted-foreground">Stage this way up · A is the front row</span>} />
        </section>
        <section className="mt-8">
          <h2 className="text-lg font-medium">Or by tier</h2>
          <TicketTiers className="mt-4" quantities={qty} onQuantity={(k, n) => setQty({ ...qty, [k]: n })}
            onCheckout={() => {}} cta="Hold these for 8 minutes"
            tiers={[
              { key: "stalls", label: "Stalls", price: 32, note: "Rows A–H", remaining: 41 },
              { key: "circle", label: "Circle", price: 24, note: "First two rows overhang the stalls", remaining: 8 },
              { key: "restricted", label: "Restricted view", price: 12, note: "You'll miss the staircase scene", remaining: 0 },
            ]} />
        </section>
      </div>
    </SiteChrome>
  );
}
