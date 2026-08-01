// feed-first — SINGLE-SCROLL as a pure STREAM: one narrow column, newest at
// the top, entries divided by rules, the capture riding mid-feed. No hero,
// no bands, no marketing sections — a feed is a spine, and furniture on a
// spine is what stops it feeling live.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { EmailCapture } from "@/components/ui/email-capture";
import { EpisodeRow } from "@/components/ui/episode-row";
import { TagList } from "@/components/ui/tag-list";
export const Route = createFileRoute("/")({ component: P });
const EPS = [
  { number: 41, title: "The last crucible steelworks", seconds: 2860, publishedAt: "2026-07-28", description: "Forgemasters, and what a 10,000-ton press actually does." },
  { number: 40, title: "Park Hill, flat by flat", seconds: 3140, publishedAt: "2026-07-14", description: "Sixty years of the streets in the sky, with three people who never left." },
  { number: 39, title: "The Full Monty at thirty", seconds: 2410, publishedAt: "2026-06-30", description: "Locations, extras, and the job centre that is now a climbing wall." },
  { number: 38, title: "Warp, and the bleep years", seconds: 3020, publishedAt: "2026-06-16", description: "How a record shop back room rewired dance music." },
  { number: 37, title: "Bramall Lane in ninety minutes", seconds: 2760, publishedAt: "2026-06-02", description: "A ground older than the clubs that play in it." },
];
function P() {
  const [playing, setPlaying] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  return (
    <SiteChrome name="Made in Sheffield" tagline="A podcast about this city, fortnightly."
      links={[{ label: "All 41", href: "#/archive" }, { label: "About", href: "#/about" }]}>
      <div className="mx-auto max-w-2xl px-6 py-10">
        <p className="text-sm text-muted-foreground">Stories that only happened here, told by people who were there. Fortnightly since 2025 — <a className="font-medium underline underline-offset-4" href="#/about">who makes it →</a></p>
        <div className="mt-4"><TagList items={["Steel", "Housing", "Music", "Football", "Food"]} active={null} onSelect={() => {}} /></div>

        <p className="mt-8 text-xs font-medium uppercase tracking-widest text-muted-foreground">Latest</p>
        <div className="flex flex-col divide-y divide-border border-y border-border mt-2">
          {EPS.slice(0, 2).map((e) => (
            <EpisodeRow key={e.number} {...e} href="#/episode" playing={playing === e.number}
              onPlay={() => setPlaying(playing === e.number ? null : e.number)} />
          ))}
        </div>

        <div className="my-8">
          <EmailCapture title="One email, every other Tuesday" blurb="The new episode and the one photo that didn't fit."
            note="No lists sold, leave with one click." done={done} onSubmit={() => setDone(true)} />
        </div>

        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Earlier</p>
        <div className="flex flex-col divide-y divide-border border-y border-border mt-2">
          {EPS.slice(2).map((e) => (
            <EpisodeRow key={e.number} {...e} href="#/episode" playing={playing === e.number}
              onPlay={() => setPlaying(playing === e.number ? null : e.number)} />
          ))}
        </div>

        <p className="mt-8 text-sm"><a className="font-medium underline underline-offset-4" href="#/archive">All forty-one episodes, filterable →</a></p>
      </div>
    </SiteChrome>
  );
}
