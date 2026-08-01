// time-sensitive — live state is the content: the clock leads, freshness is
// shown. A theatre's on-sale morning.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { BigNumber } from "@/components/ui/big-number";
import { Countdown } from "@/components/ui/countdown";
import { CtaBand } from "@/components/ui/cta-band";
import { DeadlineBar } from "@/components/ui/deadline-bar";
import { LiveBadge } from "@/components/ui/live-badge";
export const Route = createFileRoute("/")({ component: P });
function P() {
  return (
    <SiteChrome name="The Playhouse" tagline="Box office, but honest about the clock."
      links={[{ label: "On-sale board", href: "#/" }, { label: "Whole season", href: "#/season" }, { label: "Press night", href: "#/event" }]}>
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">Winter season on-sale</h1>
          <LiveBadge label="Selling now" />
        </div>
        {/* The clock IS the hero. Everything else is beneath it. */}
        <div className="mt-6 rounded-xl border bg-muted/40 p-6 text-center">
          <p className="text-sm uppercase tracking-wider text-muted-foreground">Member window closes in</p>
          <div className="mt-2 flex justify-center"><Countdown to="2026-08-15T12:00:00" /></div>
          <DeadlineBar className="mt-4" label="Member window" from={new Date("2026-08-15T08:00:00")} due={new Date("2026-08-15T12:00:00")} />
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <BigNumber value={412} label="Seats left" period="Winter season" />
          <BigNumber value={38} label="Gone in the last hour" period="and rising" />
          <BigNumber value={6} label="Shows nearly full" period="of 14" />
        </div>
        <div className="mt-10"><CtaBand title="General sale opens at noon" description="Members are in now. Everyone else, set an alarm — last season sold out by two." action={{ label: "Seats for press night", href: "#/event" }} /></div>
      </div>
    </SiteChrome>
  );
}
