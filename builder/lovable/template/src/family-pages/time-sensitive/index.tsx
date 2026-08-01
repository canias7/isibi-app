// time-sensitive — live state IS the content: the clock leads, freshness is
// visible, stale-looking data is the failure. A theatre's on-sale morning:
// the countdown band, the live numbers, what's moving, and the board.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { BigNumber } from "@/components/ui/big-number";
import { Countdown } from "@/components/ui/countdown";
import { CtaBand } from "@/components/ui/cta-band";
import { DeadlineBar } from "@/components/ui/deadline-bar";
import { LiveBadge } from "@/components/ui/live-badge";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusDot } from "@/components/ui/status-dot";
import { ViewerCount } from "@/components/ui/viewer-count";
export const Route = createFileRoute("/")({ component: P });
function P() {
  return (
    <SiteChrome name="The Playhouse" tagline="Box office, but honest about the clock."
      links={[{ label: "On-sale board", href: "#board" }, { label: "Whole season", href: "#/season" }, { label: "Press night", href: "#/event" }]}>

      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Winter season · on sale now</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight">The on-sale morning, live</h1>
            </div>
            <div className="flex items-center gap-3">
              <LiveBadge label="Selling now" />
              <ViewerCount count={214} verb="choosing seats" />
            </div>
          </div>
          {/* The clock IS the hero. Everything else is beneath it. */}
          <div className="mt-6 rounded-xl border bg-card p-6 text-center shadow-sm">
            <p className="text-sm uppercase tracking-wider text-muted-foreground">Member window closes in</p>
            <div className="mt-2 flex justify-center"><Countdown to="2026-08-15T12:00:00" /></div>
            <DeadlineBar className="mt-4" label="Member window" from={new Date("2026-08-15T08:00:00")} due={new Date("2026-08-15T12:00:00")} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-12">
        <div className="grid gap-4 sm:grid-cols-3">
          <BigNumber value={412} label="Seats left" period="Winter season" />
          <BigNumber value={38} label="Gone in the last hour" period="and rising" />
          <BigNumber value={6} label="Shows nearly full" period="of 14" />
        </div>
      </section>

      <section id="board" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-3xl px-6 py-14">
          <SectionHeader eyebrow="Moving right now" title="The board, top of the hour" />
          <ul className="mt-6 divide-y divide-border rounded-xl border bg-card px-4">
            <li className="flex flex-wrap items-center justify-between gap-2 py-3">
              <a className="font-medium hover:underline" href="#/event">An Inspector Calls — press night</a>
              <LiveBadge label="49 seats" />
            </li>
            <li className="flex flex-wrap items-center justify-between gap-2 py-3">
              <a className="font-medium hover:underline" href="#/event">A Christmas Carol — weekends</a>
              <LiveBadge label="Nearly gone" />
            </li>
            <li className="flex flex-wrap items-center justify-between gap-2 py-3">
              <a className="font-medium hover:underline" href="#/season">The Winter's Tale</a>
              <StatusDot state="on" label="Good availability" />
            </li>
            <li className="flex flex-wrap items-center justify-between gap-2 py-3">
              <a className="font-medium hover:underline" href="#/season">New Year's Eve gala</a>
              <StatusDot state="off" label="Returns only" />
            </li>
          </ul>
          <p className="mt-4 text-sm"><a className="font-medium underline underline-offset-4" href="#/season">The whole season, every state →</a></p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-14">
        <CtaBand title="General sale opens at noon" description="Members are in now. Last season sold out by two o'clock." action={{ label: "Seats for press night", href: "#/event" }} />
      </section>
    </SiteChrome>
  );
}
