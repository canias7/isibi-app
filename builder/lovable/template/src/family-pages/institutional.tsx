// institutional — "audience-split navigation". The landed audience-switch leads.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AudienceSwitch } from "@/components/ui/audience-switch";
import { EventCard } from "@/components/ui/event-card";
import { Faq } from "@/components/ui/faq";
export const Route = createFileRoute("/")({ component: P });
const TASKS: Record<string, { title: string; items: string[] }> = {
  prospective: { title: "Thinking of joining us", items: ["Book an open day", "Course finder", "Fees and support", "How to apply"] },
  current: { title: "You're here already", items: ["Timetables", "Library", "Pay accommodation", "Wellbeing"] },
  alumni: { title: "You were here once", items: ["Transcripts", "Alumni events", "Give back", "Update your details"] },
};
function P() {
  const [who, setWho] = useState("prospective");
  const t = TASKS[who];
  return (
    <SiteChrome name="Rivelin College" tagline="A sixth-form college in the Rivelin valley."
      links={[{ label: "Term dates", href: "#events" }, { label: "Questions", href: "#faq" }]}
      action={{ label: "Apply", href: "#apply" }}>
      <div className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Rivelin College</h1>
        <div className="mt-6">
          <AudienceSwitch value={who} onChange={setWho} label="I am"
            audiences={[
              { key: "prospective", label: "Future student" },
              { key: "current", label: "Current student" },
              { key: "alumni", label: "Alumni" }]} />
        </div>
        <section className="mt-8 rounded-xl border bg-muted/40 p-6">
          <h2 className="text-lg font-medium">{t.title}</h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {t.items.map((i) => <li key={i}><a href="#apply" className="text-sm underline-offset-4 hover:underline">{i}</a></li>)}
          </ul>
        </section>
        <section id="events" className="mt-10">
          <h2 className="text-lg font-medium">This term</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <EventCard title="Open evening" start="2026-09-17T18:00:00" venue="Main hall" />
            <EventCard title="A-level results surgery" start="2026-08-13T09:00:00" venue="Room 14" />
          </div>
        </section>
        <section id="faq" className="mt-10">
          <Faq items={[
            { question: "When are term dates published?", answer: "June, for the following year — in the calendar and the downloads." },
            { question: "Is there a bus from Hillsborough?", answer: "Two each morning — the 81 and our own minibus. Passes from reception." }]} />
        </section>
      </div>
    </SiteChrome>
  );
}
