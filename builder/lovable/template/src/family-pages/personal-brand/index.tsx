// personal-brand — EDITORIAL structure: one person told as a profile piece.
// Portrait offset against the standfirst, the story in a reading measure
// that never centers, dates and plates as offset spreads. A magazine
// profile, not a landing page.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Quote } from "@/components/ui/quote";
import { SafeImage } from "@/components/ui/safe-image";
import { SocialLinks } from "@/components/ui/social-links";
import { Timeline } from "@/components/ui/timeline";
import { TourDates } from "@/components/ui/tour-dates";
export const Route = createFileRoute("/")({ component: P });
function P() {
  return (
    <SiteChrome name="Elsie Marrow" tagline="Songs about rivers and shift work."
      links={[{ label: "Music", href: "#/music" }, { label: "Press kit", href: "#/press" }]}
      action={{ label: "Book me", href: "#dates" }}>

      <div className="mx-auto max-w-6xl px-6">
        {/* The profile spread: portrait right, standfirst left, off-axis. */}
        <div className="grid gap-10 py-16 md:grid-cols-12">
          <div className="md:col-span-6 md:self-end">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Folk from the Don valley</p>
            <h1 className="mt-3 text-5xl font-semibold tracking-tight">Elsie Marrow</h1>
            <p className="mt-4 max-w-md text-lg leading-relaxed text-muted-foreground">Five strings, one loop pedal, true stories only. The debut album "Marrow" — eleven songs recorded live in four days — is out in October.</p>
            <SocialLinks className="mt-5" links={[{ network: "instagram", href: "#dates" }, { network: "youtube", href: "#dates" }, { network: "spotify", href: "#dates" }]} />
          </div>
          <div className="md:col-span-5 md:col-start-8">
            <SafeImage src={null} alt="Elsie, back room of the Greystones" ratio="4/5" className="rounded-none" />
            <p className="mt-2 text-xs text-muted-foreground">The Greystones, March — photograph by Marta Ilic</p>
          </div>
        </div>

        <div className="grid gap-10 border-t border-border py-14 md:grid-cols-12">
          <div className="md:col-span-4">
            <Quote cite="Now Then Magazine">The best songwriter this city has produced since the arena was a car park.</Quote>
          </div>
          <div className="md:col-span-7 md:col-start-6">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">The story so far</p>
            <Timeline className="mt-5" items={[
              { title: "First open mic, the Red Deer", when: "2019", description: "Three songs, two about the night shift." },
              { title: "\"Five Weirs\" EP", when: "2022", description: "Recorded in a canal-side lockup in three days. The tape hiss stays." },
              { title: "Radio 6 first play", when: "2024", description: "\"Where has she been\" — on air, mid-song." },
              { title: "\"Marrow\", the album", when: "2026", description: "The tour below is it." }]} />
            <p className="mt-5 text-sm"><a className="font-medium underline underline-offset-4" href="#/music">Hear both records →</a></p>
          </div>
        </div>

        <div id="dates" className="grid gap-10 border-t border-border py-14 md:grid-cols-12">
          <div className="md:col-span-4">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">On soon</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">The Marrow tour</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Four rooms picked for their sound, not their size. Promoters: the press kit has everything.</p>
            <a className="mt-4 inline-block rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="#/press">The press kit</a>
          </div>
          <div className="md:col-span-7 md:col-start-6">
            <TourDates dates={[
              { key: "leeds", date: "2026-10-02", city: "Leeds", venue: "Brudenell", status: "few", href: "#dates" },
              { key: "shef", date: "2026-10-03", city: "Sheffield", venue: "The Leadmill", status: "soldout" },
              { key: "manc", date: "2026-10-09", city: "Manchester", venue: "The Deaf Institute", href: "#dates" },
              { key: "glas", date: "2026-10-11", city: "Glasgow", venue: "Hug & Pint", href: "#dates" }]} />
          </div>
        </div>

        <div className="grid gap-6 border-t border-border py-14 md:grid-cols-12">
          {[
            ["The loop pedal board, gaffer-taped", "md:col-span-4"],
            ["Greystones, sold out, March", "md:col-span-4 md:mt-10"],
            ["The writing hut above Rivelin", "md:col-span-4 md:-mt-6"],
          ].map(([alt, cls]) => (
            <div key={alt} className={cls}>
              <SafeImage src={null} alt={alt} ratio="1/1" className="rounded-none" />
            </div>
          ))}
        </div>
      </div>
    </SiteChrome>
  );
}
