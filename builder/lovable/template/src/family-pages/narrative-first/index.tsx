// narrative-first — one person is the product; story, then proof, then one ask.
// A touring musician.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Gallery } from "@/components/ui/gallery";
import { Quote } from "@/components/ui/quote";
import { SafeImage } from "@/components/ui/safe-image";
import { SocialLinks } from "@/components/ui/social-links";
import { Timeline } from "@/components/ui/timeline";
import { TourDates } from "@/components/ui/tour-dates";
export const Route = createFileRoute("/")({ component: P });
function P() {
  return (
    <SiteChrome name="Elsie Marrow" tagline="Songs about rivers and shift work."
      links={[{ label: "Dates", href: "#dates" }, { label: "The story", href: "#story" }, { label: "Music", href: "#/music" }, { label: "Press kit", href: "#/press" }]}
      action={{ label: "Book me", href: "#dates" }}>
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="grid items-center gap-6 sm:grid-cols-[180px_1fr]">
          <SafeImage src={null} alt="Elsie, back room of the Greystones" ratio="1/1" className="rounded-full" />
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Elsie Marrow</h1>
            <p className="mt-2 text-muted-foreground">Folk from the Don valley — five strings, one loop pedal, true stories only.</p>
            <SocialLinks className="mt-3" links={[{ network: "instagram", href: "#story" }, { network: "youtube", href: "#story" }, { network: "spotify", href: "#story" }]} />
          </div>
        </div>
        <Quote className="mt-8" cite="Now Then Magazine">The best songwriter this city has produced since the arena was a car park.</Quote>
        <section id="story" className="mt-10">
          <h2 className="text-lg font-medium">So far</h2>
          <Timeline className="mt-4" items={[
            { title: "First open mic, the Red Deer", when: "2019", description: "Three songs, two about the night shift." },
            { title: "\"Five Weirs\" EP", when: "2022", description: "Recorded in a canal-side lockup in three days." },
            { title: "Radio 6 first play", when: "2024" },
            { title: "\"Marrow\" — the album", when: "2026", description: "Out in October. The tour below is it." }]} />
        </section>
        <section id="dates" className="mt-10">
          <h2 className="text-lg font-medium">On soon</h2>
          <TourDates className="mt-3" dates={[
            { key: "leeds", date: "2026-10-02", city: "Leeds", venue: "Brudenell", status: "few", href: "#dates" },
            { key: "shef", date: "2026-10-03", city: "Sheffield", venue: "The Leadmill", status: "soldout" },
            { key: "manc", date: "2026-10-09", city: "Manchester", venue: "The Deaf Institute", href: "#dates" },
            { key: "glas", date: "2026-10-11", city: "Glasgow", venue: "Hug & Pint", href: "#dates" }]} />
        </section>
        <section className="mt-10"><Gallery columns={3} items={[
          { src: null, alt: "The loop pedal board" }, { src: null, alt: "Greystones, sold out" }, { src: null, alt: "Writing hut, Rivelin" }]} /></section>
      </div>
    </SiteChrome>
  );
}
