// time-sensitive /season — the whole board. Every show on sale at once, each
// row carrying its own urgency state — selling / low / sold out / not yet —
// because on this family's pages the STATE is the content and a list without
// states is just a brochure.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { LiveBadge } from "@/components/ui/live-badge";
import { RefreshPill } from "@/components/ui/refresh-pill";
import { StatusDot } from "@/components/ui/status-dot";
import { TimeUntil } from "@/components/ui/time-until";
export const Route = createFileRoute("/season")({ component: P });
const CHROME = {
  name: "The Playhouse", tagline: "Box office, but honest about the clock.",
  links: [{ label: "On-sale board", href: "#/" }, { label: "Whole season", href: "#/season" }],
};
const SHOWS = [
  { title: "An Inspector Calls — press night", when: "Fri 19 Sep, 7:30", state: "low", left: "49 seats", href: "#/event" },
  { title: "An Inspector Calls", when: "20 Sep – 11 Oct", state: "selling", left: "Good availability", href: "#/event" },
  { title: "The Winter's Tale", when: "24 Oct – 15 Nov", state: "selling", left: "Good availability", href: "#/event" },
  { title: "A Christmas Carol", when: "5 Dec – 4 Jan", state: "low", left: "Weekends nearly gone", href: "#/event" },
  { title: "New Year's Eve gala", when: "31 Dec, 9:00", state: "soldout", left: "Returns only", href: "#/event" },
  { title: "Spring season announcement", when: "On sale 1 Oct, 10:00", state: "soon", left: null, href: "#/event" },
];
function P() {
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">The whole season</h1>
          <RefreshPill count={2} noun="returned seat" onShow={() => {}} atTop />
        </div>
        <p className="mt-2 text-muted-foreground">Availability is live from the box office. "Low" means under a tenth of the house.</p>
        <ul className="mt-6 divide-y divide-border">
          {SHOWS.map((s) => (
            <li key={s.title} className="flex flex-wrap items-center gap-3 py-4">
              <div className="min-w-0 flex-1">
                <a href={s.href} className="font-medium hover:underline">{s.title}</a>
                <p className="mt-0.5 text-sm text-muted-foreground">{s.when}</p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                {s.state === "selling" && <StatusDot state="on" label={s.left ?? "On sale"} />}
                {s.state === "low" && <LiveBadge label={s.left ?? "Selling fast"} />}
                {s.state === "soldout" && <StatusDot state="off" label="Sold out — returns only" />}
                {s.state === "soon" && <span className="text-muted-foreground">On sale in <TimeUntil date="2026-10-01T10:00:00" /></span>}
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-8 rounded-xl border bg-muted/40 p-4 text-sm">Returns go back on sale the moment they arrive, with no queue and no fee — the board above updates itself. The pill up top appears when returns land, so the impatient can stop refreshing — which on this site is everyone.</p>
      </div>
    </SiteChrome>
  );
}
