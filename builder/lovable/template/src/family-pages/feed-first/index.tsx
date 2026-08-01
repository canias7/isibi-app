// feed-first — reverse-chronological; the newest thing on top, nav secondary.
// A podcast: episodes with inline play, subscribe as the one capture.
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
];
function P() {
  const [playing, setPlaying] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  return (
    <SiteChrome name="Made in Sheffield" tagline="A podcast about this city, fortnightly."
      links={[{ label: "Episodes", href: "#eps" }, { label: "All 41", href: "#/archive" }, { label: "About", href: "#/about" }, { label: "Subscribe", href: "#sub" }]}>
      <div className="mx-auto max-w-2xl px-6 py-12">
        {/* The newest episode IS the top of the page. No hero above the feed. */}
        <TagList items={["Steel", "Housing", "Music", "Football"]} active={null} onSelect={() => {}} />
        <div id="eps" className="mt-6 flex flex-col divide-y divide-border">
          {EPS.map((e) => (
            <EpisodeRow key={e.number} {...e} href="#/episode" playing={playing === e.number}
              onPlay={() => setPlaying(playing === e.number ? null : e.number)} />
          ))}
        </div>
        <p className="mt-5 text-sm"><a className="underline underline-offset-4" href="#/archive">Browse all forty-one episodes →</a></p>
        <div id="sub" className="mt-12">
          <EmailCapture title="One email, every other Tuesday" blurb="The new episode and the one photo that didn't fit."
            note="No lists sold, leave with one click." done={done} onSubmit={() => setDone(true)} />
        </div>
      </div>
    </SiteChrome>
  );
}
