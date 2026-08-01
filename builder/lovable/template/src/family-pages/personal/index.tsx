// personal — intimate scale: one column, one voice, one ask. A wedding. The
// richness this family can take is warmth and completeness, not furniture —
// the story fuller, the details guests actually need, and the RSVP once.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Countdown } from "@/components/ui/countdown";
import { Gallery } from "@/components/ui/gallery";
import { Quote } from "@/components/ui/quote";
import { RsvpButtons, type Rsvp } from "@/components/ui/rsvp-buttons";
import { SafeImage } from "@/components/ui/safe-image";
import { Timeline } from "@/components/ui/timeline";
export const Route = createFileRoute("/")({ component: P });
function P() {
  const [rsvp, setRsvp] = useState<Rsvp | null>(null);
  return (
    <div className="min-h-svh bg-background text-foreground">
      <main className="mx-auto max-w-xl px-6 py-16">
        <div className="text-center">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">12 September 2026 · Wortley Hall</p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight">June &amp; Omar</h1>
          <p className="mt-3 text-muted-foreground">are getting married, and you're invited</p>
          <div className="mt-5 flex justify-center"><Countdown to="2026-09-12T13:00:00" /></div>
        </div>

        <SafeImage className="mt-10" src={null} alt="Us, halfway up Win Hill, the day of the question" ratio="3/2" />

        <section className="mt-12">
          <h2 className="text-lg font-medium">How we got here</h2>
          <Timeline className="mt-4" items={[
            { title: "The 52 bus", when: "2019", description: "June had headphones in. Omar asked anyway. She says the song wasn't even good." },
            { title: "The allotment", when: "2022", description: "Half a plot, then the whole thing, then two. The rhubarb is invited." },
            { title: "The question", when: "2025", description: "At the top of Win Hill, in horizontal rain. She said obviously." },
            { title: "The day itself", when: "12 Sept", description: "One o'clock, the south lawn, then dancing until they make us stop." }]} />
        </section>

        <Quote className="mt-12">No gifts expected, no dress code beyond "you'll be dancing", and no speeches longer than a song. We promise.</Quote>

        <section className="mt-12 rounded-xl border bg-muted/40 p-6 text-center">
          <h2 className="text-lg font-medium">Will you come?</h2>
          <p className="mt-1 text-sm text-muted-foreground">One click is your whole RSVP — change it any time before August.</p>
          <div className="mt-4 flex justify-center">
            <RsvpButtons value={rsvp} onChange={setRsvp} counts={{ yes: 68, maybe: 9, no: 4 }} />
          </div>
          {rsvp === "yes" && <p className="mt-3 text-sm text-muted-foreground">Wonderful. Dietary things and the day's shape are on the travel page.</p>}
        </section>

        <p className="mt-8 text-center text-sm"><a className="font-medium underline underline-offset-4" href="#/travel">Getting there, staying over →</a> · <a className="font-medium underline underline-offset-4" href="#/registry">gifts, if you must →</a></p>

        <section className="mt-12">
          <h2 className="text-lg font-medium">A few of us</h2>
          <Gallery className="mt-4" columns={3} items={[
            { src: null, alt: "Us, Win Hill, soaked" },
            { src: null, alt: "The allotment in June — the month and the person" },
            { src: null, alt: "Wortley Hall, where you'll be" },
            { src: null, alt: "The rhubarb, thriving" },
            { src: null, alt: "First photo together, 2019" },
            { src: null, alt: "The ring, eventually dry" }]} />
        </section>
      </main>
    </div>
  );
}
