// college /visit — open days and getting here. The two questions every
// visitor actually has: when can I come, and how do I physically get there.
// Everything else is the apply page's job.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { EventCard } from "@/components/ui/event-card";
import { Faq } from "@/components/ui/faq";
import { LocationCard } from "@/components/ui/location-card";
export const Route = createFileRoute("/visit")({ component: P });
const CHROME = {
  name: "Rivelin College", tagline: "A sixth-form college in the Rivelin valley.",
  links: [{ label: "Home", href: "/" }, { label: "Apply", href: "/apply" }],
  action: { label: "Apply", href: "/apply" },
};
function P() {
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Come and look round</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">Open evenings are drop-in — no booking, no name badge, leave when you've seen enough. Subject staff are in their own rooms all evening.</p>
        <section className="mt-8">
          <h2 className="text-lg font-medium">The next three</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <EventCard title="Open evening — all subjects" start="2026-09-17T18:00:00" venue="Main hall, then everywhere" />
            <EventCard title="Open morning — sciences" start="2026-10-03T10:00:00" venue="The labs, B block" />
            <EventCard title="Open evening — all subjects" start="2026-11-12T18:00:00" venue="Main hall, then everywhere" />
          </div>
        </section>
        <section className="mt-10 grid gap-6 sm:grid-cols-2">
          <LocationCard name="Rivelin College" address="Manchester Road, Sheffield S6 5FG" note="Buses 81 and 82 stop at the gate. Visitor parking through the second entrance." />
          <div className="self-start rounded-xl border bg-muted/40 p-5 text-sm">
            <h2 className="font-medium">On the evening</h2>
            <ul className="mt-3 grid gap-2 text-muted-foreground">
              <li>Talks at 6:15 and 7:15 — identical, pick either</li>
              <li>Current students lead the tours; ask them anything</li>
              <li>Admissions table in the hall for the awkward questions</li>
            </ul>
          </div>
        </section>
        <section className="mt-10">
          <Faq items={[
            { question: "Can we visit outside open evenings?", answer: "Yes — ring admissions and we'll walk you round in a normal teaching day, which honestly shows you more." },
            { question: "Is the site step-free?", answer: "All of it except the old observatory. Say if you need parking by the door and it's reserved." },
          ]} />
        </section>
      </div>
    </SiteChrome>
  );
}
