// feed-first — reverse-chronological; the newest thing on top, nav secondary.
// A podcast: a compact masthead says what this is, then the stream IS the
// page. The subscribe capture rides mid-feed, the archive and about are one
// tap away, never in the way.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { EmailCapture } from "@/components/ui/email-capture";
import { EpisodeRow } from "@/components/ui/episode-row";
import { SectionHeader } from "@/components/ui/section-header";
import { StatsBand } from "@/components/ui/stats-band";
import { TagList } from "@/components/ui/tag-list";
import { Testimonial } from "@/components/ui/testimonial";
export const Route = createFileRoute("/")({ component: P });
const EPS = [
  { number: 41, title: "The last crucible steelworks", seconds: 2860, publishedAt: "2026-07-28", description: "Forgemasters, and what a 10,000-ton press actually does." },
  { number: 40, title: "Park Hill, flat by flat", seconds: 3140, publishedAt: "2026-07-14", description: "Sixty years of the streets in the sky, with three people who never left." },
  { number: 39, title: "The Full Monty at thirty", seconds: 2410, publishedAt: "2026-06-30", description: "Locations, extras, and the job centre that is now a climbing wall." },
  { number: 38, title: "Warp, and the bleep years", seconds: 3020, publishedAt: "2026-06-16", description: "How a record shop back room rewired dance music." },
];
function P() {
  const [playing, setPlaying] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  return (
    <SiteChrome name="Made in Sheffield" tagline="A podcast about this city, fortnightly."
      links={[{ label: "Episodes", href: "#eps" }, { label: "All 41", href: "#/archive" }, { label: "About", href: "#/about" }]}>

      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-2xl px-6 py-12">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">A podcast about this city · fortnightly since 2025</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Stories that only happened here, told by people who were there</h1>
          <div className="mt-5"><TagList items={["Steel", "Housing", "Music", "Football", "Food"]} active={null} onSelect={() => {}} /></div>
        </div>
      </section>

      <section id="eps" className="mx-auto max-w-2xl px-6 py-10">
        <div className="flex flex-col divide-y divide-border">
          {EPS.slice(0, 2).map((e) => (
            <EpisodeRow key={e.number} {...e} href="#/episode" playing={playing === e.number}
              onPlay={() => setPlaying(playing === e.number ? null : e.number)} />
          ))}
        </div>
        <div className="my-8 rounded-xl border bg-muted/40 p-6">
          <EmailCapture title="One email, every other Tuesday" blurb="The new episode and the one photo that didn't fit."
            note="No lists sold, leave with one click." done={done} onSubmit={() => setDone(true)} />
        </div>
        <div className="flex flex-col divide-y divide-border">
          {EPS.slice(2).map((e) => (
            <EpisodeRow key={e.number} {...e} href="#/episode" playing={playing === e.number}
              onPlay={() => setPlaying(playing === e.number ? null : e.number)} />
          ))}
        </div>
        <p className="mt-6 text-sm"><a className="font-medium underline underline-offset-4" href="#/archive">Browse all forty-one episodes →</a></p>
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-2xl px-6 py-12">
          <StatsBand items={[
            { value: "41", label: "Episodes" },
            { value: "18k", label: "Listens a month" },
            { value: "74%", label: "From S postcodes" }]} />
          <Testimonial className="mt-8" item={{ quote: "The Park Hill episode should be on the national curriculum for this city.", name: "Now Then Magazine", role: "Podcasts of the year" }} />
        </div>
      </section>

      <section className="mx-auto max-w-2xl px-6 py-12">
        <SectionHeader eyebrow="Who makes it" title="Two of us, a spare room, decent microphones" description="Sam asks the questions and does the edit; Jess finds the people and checks the facts. Pitches welcome — first-hand wins every time." />
        <p className="mt-4 text-sm"><a className="font-medium underline underline-offset-4" href="#/about">How it's made, sponsorship, and how to pitch →</a></p>
      </section>
    </SiteChrome>
  );
}
