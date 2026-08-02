// wedding /travel — getting there and staying: trains, rooms, the shape of
// the day. The intimate register holds — this is the page guests actually
// open twice, the week before and in the taxi.
import { createFileRoute } from "@tanstack/react-router";
import { DescriptionList } from "@/components/ui/description-list";
import { LocationCard } from "@/components/ui/location-card";
import { Timeline } from "@/components/ui/timeline";
export const Route = createFileRoute("/travel")({ component: P });
function P() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <main className="mx-auto max-w-xl px-6 py-16">
        <p className="text-center text-xs uppercase tracking-widest text-muted-foreground">12 September 2026 · Wortley Hall</p>
        <h1 className="mt-3 text-center text-4xl font-semibold tracking-tight">Getting there</h1>
        <p className="mt-3 text-center text-sm text-muted-foreground"><a className="underline underline-offset-4" href="#/">← Back to the main page (and your RSVP)</a></p>
        <section className="mt-10">
          <h2 className="text-lg font-medium">The day, roughly</h2>
          <Timeline className="mt-4" items={[
            { title: "Doors — the south lawn", when: "12:30", description: "There's shade, and there's elderflower." },
            { title: "The ceremony", when: "13:00", description: "Twenty minutes. Loud singing encouraged, crying inevitable." },
            { title: "Dinner in the long hall", when: "16:00", description: "Seating plan by the door. Tell us allergies via the RSVP." },
            { title: "First dance, then everyone's", when: "19:30", description: "The band knows three slow songs and forty fast ones." },
            { title: "Carriages", when: "23:30", description: "Taxis pre-booked from the front steps — put your name down at the bar." },
          ]} />
        </section>
        <section className="mt-10">
          <LocationCard name="Wortley Hall" address="Halifax Road, Wortley, Sheffield S35 7DB" note="Twenty minutes from Sheffield station by taxi (~£28). Parking is free and nobody checks when you leave it till morning." />
        </section>
        <section className="mt-10">
          <h2 className="text-lg font-medium">Staying over</h2>
          <DescriptionList className="mt-3" items={[
            { label: "At the hall", value: "19 rooms, held under WEDDING-JO until 12 August — ring 0114 288 2100" },
            { label: "Ten minutes away", value: "The Wortley Arms — small, lovely, book the back rooms" },
            { label: "In town", value: "Anything near the station works; taxis run all night" },
            { label: "Morning after", value: "Bacon sandwiches at the hall from 9, everyone welcome, dress terribly" },
          ]} />
        </section>
        <p className="mt-10 border-t pt-6 text-center text-sm text-muted-foreground">Questions? Text June's sister Ha-eun — she is organised and we are not: 07700 900418.</p>
      </main>
    </div>
  );
}
