// box-office — TERMINAL structure: monospace, hairline rules, no
// decoration. A box office as a departures board — the state IS the content,
// so the board is nothing but state, set in the type that says "this updates".
// Uppercase labels, tabular numbers, zero cards.
//
// Production stills sit BELOW all of that and outside the mono treatment
// (2026-08-02). The old note said "no imagery" and took it literally to the end
// of the page, which left a theatre selling tickets on a departures display
// alone — asking somebody to buy a seat at a show they have not seen a frame
// of. The board is unchanged and still comes first; nothing decorative gets
// between a visitor and the on-sale state they arrived for.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Countdown } from "@/components/ui/countdown";
import { DeadlineBar } from "@/components/ui/deadline-bar";
import { LiveBadge } from "@/components/ui/live-badge";
import { ViewerCount } from "@/components/ui/viewer-count";
import { SafeImage } from "@/components/ui/safe-image";
export const Route = createFileRoute("/")({ component: P });
const BOARD = [
  { show: "AN INSPECTOR CALLS — PRESS NIGHT", when: "FRI 19 SEP 19:30", state: "49 SEATS", hot: true, href: "#/event" },
  { show: "AN INSPECTOR CALLS", when: "20 SEP – 11 OCT", state: "SELLING", href: "#/event" },
  { show: "THE WINTER'S TALE", when: "24 OCT – 15 NOV", state: "SELLING", href: "#/season" },
  { show: "A CHRISTMAS CAROL", when: "5 DEC – 4 JAN", state: "WEEKENDS LOW", hot: true, href: "#/season" },
  { show: "NEW YEAR'S EVE GALA", when: "31 DEC 21:00", state: "RETURNS ONLY", href: "#/season" },
  { show: "SPRING SEASON", when: "ON SALE 1 OCT 10:00", state: "HOLD", href: "#/season" },
];
function P() {
  return (
    <SiteChrome name="The Playhouse" tagline="Box office, but honest about the clock."
      links={[{ label: "Whole season", href: "#/season" }, { label: "Press night", href: "#/event" }]}>
      <div className="mx-auto max-w-4xl px-6 py-10 font-mono">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border pb-3">
          <h1 className="text-sm font-medium uppercase tracking-widest">On-sale board — winter season</h1>
          <span className="flex items-center gap-3 text-xs uppercase text-muted-foreground">
            <LiveBadge label="Live" /> <ViewerCount count={214} verb="choosing seats" />
          </span>
        </div>

        <div className="border-b border-border py-5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Member window closes in</p>
          <div className="mt-2"><Countdown to="2026-08-15T12:00:00" /></div>
          <DeadlineBar className="mt-3" label="Member window" from={new Date("2026-08-15T08:00:00")} due={new Date("2026-08-15T12:00:00")} />
          <p className="mt-2 text-xs uppercase text-muted-foreground">General sale 12:00 — last season sold out by 14:00</p>
        </div>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-widest text-muted-foreground">
              <th className="py-2 pr-4 font-medium">Production</th>
              <th className="py-2 pr-4 font-medium">Dates</th>
              <th className="py-2 text-right font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {BOARD.map((r) => (
              <tr key={r.show} className="border-b border-border/60">
                <td className="py-3 pr-4"><a className="hover:underline" href={r.href}>{r.show}</a></td>
                <td className="py-3 pr-4 tabular-nums text-muted-foreground">{r.when}</td>
                <td className={"py-3 text-right tabular-nums " + (r.hot ? "font-semibold" : "text-muted-foreground")}>{r.state}{r.hot ? " ▲" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="grid gap-x-8 gap-y-2 border-b border-border py-4 text-xs uppercase tracking-wide text-muted-foreground sm:grid-cols-3">
          <span>412 seats left / season</span>
          <span>38 gone in the last hour ▲</span>
          <span>6 of 14 shows nearly full</span>
        </div>

        <p className="py-5 text-sm">→ <a className="font-medium underline underline-offset-4" href="#/event">Press night: pick seats now</a> · <a className="underline underline-offset-4" href="#/season">full season board</a></p>

        {/* Production stills, BELOW the board and outside the mono treatment.
            The board is this family's whole discipline and stays exactly as it
            was — but a theatre selling tickets on a departures display alone is
            asking somebody to buy a seat at a show they have not seen a frame
            of. Deliberately last, so nothing decorative gets between a visitor
            and the on-sale state they came for. */}
        <section className="border-t border-border py-8 font-sans">
          <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">In the season</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <SafeImage src={null} alt="An Inspector Calls — the Birlings' table" ratio="4/3" />
            <SafeImage src={null} alt="The Winter's Tale — the statue scene" ratio="4/3" />
            <SafeImage src={null} alt="A Christmas Carol — Marley's entrance" ratio="4/3" />
            <SafeImage src={null} alt="The auditorium, from the gods" ratio="4/3" />
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
