// local-civic /events — what is on this month, listed plainly with dates and
// rooms. Utility over polish holds here too: a parent wants the time, the
// room, and whether to book — nothing needs a picture.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { EventCard } from "@/components/ui/event-card";
import { Faq } from "@/components/ui/faq";
export const Route = createFileRoute("/events")({ component: P });
const CHROME = {
  name: "Walkley Library", tagline: "Volunteer-run since 2014. Everyone welcome, no card needed to sit.",
  links: [{ label: "Hours & papers", href: "#/" }, { label: "What's on", href: "#/events" }],
};
function P() {
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">What's on in August</h1>
        <p className="mt-2 text-muted-foreground">Everything is free unless it says otherwise. "Book" means tell the desk — a name on paper, nothing more.</p>
        <div className="mt-6 grid gap-5">
          {[
            { title: "Rhyme time (under-5s)", start: "2026-08-04T10:30:00", venue: "Children's corner", note: "Every Tuesday. No booking, come late, leave early." },
            { title: "Repair café", start: "2026-08-08T10:00:00", venue: "Main room", note: "Bring the broken thing and its screws. Toasters welcome, microwaves not." },
            { title: "Local history: Walkley's cinemas", start: "2026-08-13T19:00:00", venue: "Main room", note: "Book at the desk — 40 chairs, it fills." },
            { title: "Trustees' meeting — open to all", start: "2026-08-20T18:30:00", venue: "Back room", note: "Minutes go up on the papers page after." },
            { title: "Summer reading challenge finale", start: "2026-08-29T10:30:00", venue: "Everywhere", note: "Medals, squash, and a very patient dragon costume." },
          ].map((e) => (
            <div key={e.title}>
              <EventCard title={e.title} start={e.start} venue={e.venue} />
              <p className="mt-1.5 pl-1 text-sm text-muted-foreground">{e.note}</p>
            </div>
          ))}
        </div>
        <section className="mt-10">
          <Faq items={[
            { question: "Can we run something here?", answer: "Probably yes — the room hire form is on the papers page, £8 an hour community rate, and the trustees say yes to most things with a public benefit." },
            { question: "Do events run when the library is closed?", answer: "Evening events do — the door opens fifteen minutes before. The Wednesday closure is staffing, not the building." },
          ]} />
        </section>
        <p className="mt-8 border-t pt-6 text-sm text-muted-foreground">Hours, the address and the papers live on <a className="font-medium underline underline-offset-4" href="#/">the front page</a>.</p>
      </div>
    </SiteChrome>
  );
}
