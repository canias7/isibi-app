// institutional — audience-split navigation: several unrelated journeys share
// one homepage, and the switch up top rearranges the page for whoever
// answered. Tasks over marketing; notices and dates are first-class.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AnnouncementBar } from "@/components/ui/announcement-bar";
import { AudienceSwitch } from "@/components/ui/audience-switch";
import { EventCard } from "@/components/ui/event-card";
import { Faq } from "@/components/ui/faq";
import { SectionHeader } from "@/components/ui/section-header";
import { StatsBand } from "@/components/ui/stats-band";
export const Route = createFileRoute("/")({ component: P });
const TASKS: Record<string, { title: string; items: { label: string; href: string }[] }> = {
  prospective: { title: "Thinking of joining us", items: [
    { label: "Book an open evening", href: "#/visit" }, { label: "Find your course", href: "#/courses" },
    { label: "Fees and support", href: "#/apply" }, { label: "How to apply", href: "#/apply" }] },
  current: { title: "You're here already", items: [
    { label: "Timetables", href: "#events" }, { label: "Library", href: "#events" },
    { label: "Pay for trips", href: "#events" }, { label: "Wellbeing drop-in", href: "#events" }] },
  alumni: { title: "You were here once", items: [
    { label: "Transcripts", href: "#faq" }, { label: "Alumni events", href: "#events" },
    { label: "Give back", href: "#faq" }, { label: "Update your details", href: "#faq" }] },
};
function P() {
  const [who, setWho] = useState("prospective");
  const t = TASKS[who];
  return (
    <div className="min-h-svh bg-background text-foreground">
      <AnnouncementBar href="#events">Results day: Thursday 13 August, doors 8:30 — walk-in advice all morning.</AnnouncementBar>
      <SiteChrome name="Rivelin College" tagline="A sixth-form college in the Rivelin valley."
        links={[{ label: "Courses", href: "#/courses" }, { label: "Visit us", href: "#/visit" }, { label: "Term dates", href: "#events" }]}
        action={{ label: "Apply", href: "#/apply" }}>

        <section className="border-b border-border bg-muted/40">
          <div className="mx-auto max-w-4xl px-6 py-14">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Sixth form · 1,400 students · Rivelin valley</p>
            <h1 className="mt-2 max-w-2xl text-4xl font-semibold tracking-tight text-balance">One college, three front doors</h1>
            {/* The audience switch IS the hero — the page rearranges for the answer. */}
            <div className="mt-6">
              <AudienceSwitch value={who} onChange={setWho} label="I am"
                audiences={[
                  { key: "prospective", label: "Future student" },
                  { key: "current", label: "Current student" },
                  { key: "alumni", label: "Alumni" }]} />
            </div>
            <div className="mt-6 rounded-xl border bg-card p-6 shadow-sm">
              <h2 className="text-lg font-medium">{t.title}</h2>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {t.items.map((i) => <li key={i.label}><a href={i.href} className="text-sm underline-offset-4 hover:underline">{i.label} →</a></li>)}
              </ul>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-6 py-12">
          <StatsBand items={[
            { value: "38", label: "A-levels and BTECs" },
            { value: "62%", label: "A*–B last summer" },
            { value: "94%", label: "First-choice destinations" },
            { value: "2", label: "Buses from Hillsborough each morning" }]} />
        </section>

        <section id="events" className="border-y border-border bg-muted/40">
          <div className="mx-auto max-w-4xl px-6 py-14">
            <SectionHeader eyebrow="This term" title="Dates that matter" />
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <EventCard title="A-level results surgery" start="2026-08-13T09:00:00" venue="Room 14 — walk in" />
              <EventCard title="Open evening — all subjects" start="2026-09-17T18:00:00" venue="Main hall, then everywhere" />
              <EventCard title="Open morning — sciences" start="2026-10-03T10:00:00" venue="The labs, B block" />
              <EventCard title="Applications close for 2027" start="2027-01-16T17:00:00" venue="Online" />
            </div>
            <p className="mt-4 text-sm"><a className="font-medium underline underline-offset-4" href="#/visit">Everything about visiting →</a></p>
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-2xl px-6 py-14">
          <SectionHeader eyebrow="Quick answers" title="Asked every September" />
          <Faq className="mt-6" items={[
            { question: "When are term dates published?", answer: "June, for the following year — in the calendar and the downloads." },
            { question: "Is there a bus from Hillsborough?", answer: "Two each morning — the 81 and our own minibus. Passes from reception." },
            { question: "Can I change subjects after enrolling?", answer: "In the first three weeks, usually yes — it's a conversation with your tutor, not a form." }]} />
        </section>
      </SiteChrome>
    </div>
  );
}
