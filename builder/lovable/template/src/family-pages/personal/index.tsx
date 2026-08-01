// personal — intimate scale: one column, one story, one ask. A wedding.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Countdown } from "@/components/ui/countdown";
import { Gallery } from "@/components/ui/gallery";
import { RsvpButtons, type Rsvp } from "@/components/ui/rsvp-buttons";
import { Timeline } from "@/components/ui/timeline";
export const Route = createFileRoute("/")({ component: P });
function P() {
  const [rsvp, setRsvp] = useState<Rsvp | null>(null);
  return (
    <div className="min-h-svh bg-background text-foreground">
      <main className="mx-auto max-w-xl px-6 py-16 text-center">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">12 September 2026 · Wortley Hall</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">June &amp; Omar</h1>
        <div className="mt-4 flex justify-center"><Countdown to="2026-09-12T13:00:00" /></div>
        <section className="mt-10 text-left">
          <h2 className="text-lg font-medium">How we got here</h2>
          <Timeline className="mt-4" items={[
            { title: "The 52 bus", when: "2019", description: "June had headphones. Omar asked anyway." },
            { title: "The allotment", when: "2022", description: "Half a plot, then the whole thing, then two." },
            { title: "The question", when: "2025", description: "At the top of Win Hill, in horizontal rain." }]} />
        </section>
        <section className="mt-10">
          <h2 className="text-lg font-medium">Will you come?</h2>
          <p className="mt-1 text-sm text-muted-foreground">One click is your whole RSVP — change it any time before August.</p>
          <div className="mt-4 flex justify-center">
            <RsvpButtons value={rsvp} onChange={setRsvp} counts={{ yes: 68, maybe: 9, no: 4 }} />
          </div>
        </section>
        <p className="mt-8 text-sm"><a className="font-medium underline underline-offset-4" href="#/travel">Getting there, staying over, the shape of the day →</a></p>
        <section className="mt-10"><Gallery columns={3} items={[
          { src: null, alt: "Us, Win Hill" }, { src: null, alt: "The allotment in June" }, { src: null, alt: "The hall" }]} /></section>
      </main>
    </div>
  );
}
