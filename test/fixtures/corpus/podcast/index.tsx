// podcast — the STREAM is the page: newest at the top, entries divided by
// rules, nothing between an arrival and the person reading it.
//
// REVISED 2026-08-02, and the note this replaces was wrong in a specific way
// worth keeping. It said "no hero, no bands, no marketing sections — a feed is
// a spine", and took that as far as a 2xl column of list rows with NO ARTWORK
// ANYWHERE. But a show is bought on its cover before a word of a description is
// read; a feed with no cover is an RSS reader, not a programme's home. The
// spine is still the spine — the episodes are unchanged and still the first
// thing under the fold — it now has a masthead above it and a column beside it.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { EmailCapture } from "@/components/ui/email-capture";
import { EpisodeRow } from "@/components/ui/episode-row";
import { SafeImage } from "@/components/ui/safe-image";
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
      links={[{ label: "All 41", href: "/archive" }, { label: "About", href: "/about" }]}>
      {/* The show, at the size a show is sold at. A podcast is bought on its
          COVER before a word of a description is read, and the first version of
          this page had no artwork anywhere — 2xl of list rows and nothing else,
          which is an RSS reader rather than a programme's home. */}
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-14">
          {/* An explicit track, not `auto`. `w-full` inside an `auto` column
              resolves against a track sized by its own content, so the artwork
              measured zero and the hero rendered with no cover on it at all —
              which is the exact thing this section was added to fix. */}
          <div className="grid items-center gap-10 md:grid-cols-[260px_1fr]">
            <SafeImage src={null} alt="Made in Sheffield — the show artwork" ratio="1/1" />
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Fortnightly since 2025 · 41 episodes</p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">Made in Sheffield</h1>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
                Stories that only happened here, told by people who were there.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="/episode">Play the latest</a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="/about">Who makes it</a>
              </div>
              <div className="mt-6"><TagList items={["Steel", "Housing", "Music", "Football", "Food"]} active={null} onSelect={() => {}} /></div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-12 lg:grid-cols-[1.6fr_1fr]">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Latest</p>
            <div className="mt-2 flex flex-col divide-y divide-border border-y border-border">
              {EPS.slice(0, 2).map((e) => (
                <EpisodeRow key={e.number} {...e} href="/episode" playing={playing === e.number}
                  onPlay={() => setPlaying(playing === e.number ? null : e.number)} />
              ))}
            </div>

            <p className="mt-10 text-xs font-medium uppercase tracking-widest text-muted-foreground">Earlier</p>
            <div className="mt-2 flex flex-col divide-y divide-border border-y border-border">
              {EPS.slice(2).map((e) => (
                <EpisodeRow key={e.number} {...e} href="/episode" playing={playing === e.number}
                  onPlay={() => setPlaying(playing === e.number ? null : e.number)} />
              ))}
            </div>
            <p className="mt-6 text-sm"><a className="font-medium underline underline-offset-4" href="/archive">All forty-one episodes, filterable →</a></p>
          </div>

          <aside className="flex flex-col gap-8">
            <EmailCapture title="One email, every other Tuesday" blurb="The new episode and the one photo that didn't fit."
              note="No lists sold, leave with one click." done={done} onSubmit={() => setDone(true)} />
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">The photo that didn't fit</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <SafeImage src={null} alt="The 10,000-ton press at Forgemasters" ratio="1/1" />
                <SafeImage src={null} alt="Park Hill, from the deck" ratio="1/1" />
                <SafeImage src={null} alt="The Warp back room, 1991" ratio="1/1" />
                <SafeImage src={null} alt="Bramall Lane, empty" ratio="1/1" />
              </div>
            </div>
            <div className="rounded-lg border border-border p-5">
              <p className="text-sm font-medium">Where to listen</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Apple, Spotify, Pocket Casts, or the plain RSS feed — the whole back catalogue is on all four,
                free, no account.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </SiteChrome>
  );
}
