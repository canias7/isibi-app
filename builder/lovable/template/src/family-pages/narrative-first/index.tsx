// narrative-first — one person is the product: portrait, story, then proof.
// A musician: the portrait band leads, the story runs as a timeline, the
// proof is dates and press, and the one ask closes. Never five asks.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CtaBand } from "@/components/ui/cta-band";
import { Gallery } from "@/components/ui/gallery";
import { Quote } from "@/components/ui/quote";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { SocialLinks } from "@/components/ui/social-links";
import { Timeline } from "@/components/ui/timeline";
import { TourDates } from "@/components/ui/tour-dates";
export const Route = createFileRoute("/")({ component: P });
function P() {
  return (
    <SiteChrome name="Elsie Marrow" tagline="Songs about rivers and shift work."
      links={[{ label: "Dates", href: "#dates" }, { label: "The story", href: "#story" }, { label: "Music", href: "#/music" }, { label: "Press kit", href: "#/press" }]}
      action={{ label: "Book me", href: "#dates" }}>

      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto grid max-w-4xl items-center gap-10 px-6 py-16 sm:grid-cols-[220px_1fr]">
          <SafeImage src={null} alt="Elsie, back room of the Greystones" ratio="1/1" className="rounded-full" />
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Folk from the Don valley</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">Elsie Marrow</h1>
            <p className="mt-3 max-w-md text-lg text-muted-foreground">Five strings, one loop pedal, true stories only. Debut album "Marrow" out in October.</p>
            <SocialLinks className="mt-4" links={[{ network: "instagram", href: "#story" }, { network: "youtube", href: "#story" }, { network: "spotify", href: "#story" }]} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-2xl px-6 py-12">
        <Quote cite="Now Then Magazine">The best songwriter this city has produced since the arena was a car park.</Quote>
      </section>

      <section id="story" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-2xl px-6 py-14">
          <SectionHeader eyebrow="The story" title="So far" />
          <Timeline className="mt-6" items={[
            { title: "First open mic, the Red Deer", when: "2019", description: "Three songs, two about the night shift." },
            { title: "\"Five Weirs\" EP", when: "2022", description: "Recorded in a canal-side lockup in three days. The tape hiss stays." },
            { title: "Radio 6 first play", when: "2024", description: "\"Where has she been\" — on air, mid-song." },
            { title: "\"Marrow\" — the album", when: "2026", description: "Eleven songs, recorded live at Yellow Arch. The tour below is it." }]} />
          <p className="mt-5 text-sm"><a className="font-medium underline underline-offset-4" href="#/music">Hear both records →</a></p>
        </div>
      </section>

      <section id="dates" className="mx-auto max-w-2xl px-6 py-14">
        <SectionHeader eyebrow="On soon" title="The Marrow tour" description="Four rooms picked for their sound, not their size." />
        <TourDates className="mt-5" dates={[
          { key: "leeds", date: "2026-10-02", city: "Leeds", venue: "Brudenell", status: "few", href: "#dates" },
          { key: "shef", date: "2026-10-03", city: "Sheffield", venue: "The Leadmill", status: "soldout" },
          { key: "manc", date: "2026-10-09", city: "Manchester", venue: "The Deaf Institute", href: "#dates" },
          { key: "glas", date: "2026-10-11", city: "Glasgow", venue: "Hug & Pint", href: "#dates" }]} />
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <SectionHeader eyebrow="Off stage" title="The work behind the songs" />
          <Gallery className="mt-8" columns={3} items={[
            { src: null, alt: "The loop pedal board, gaffer-taped" },
            { src: null, alt: "Greystones, sold out, March" },
            { src: null, alt: "The writing hut above Rivelin" }]} />
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-14">
        <CtaBand title="Book me for a room like yours" description="Solo with the pedal, or with the band for the big nights. Press kit has everything a promoter needs." action={{ label: "The press kit", href: "#/press" }} />
      </section>
    </SiteChrome>
  );
}
