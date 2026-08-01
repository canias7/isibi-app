// institutional — SINGLE-SCROLL as a TASK LIST: the register of the civic
// web. The audience switch up top, then plain ruled lists of things to DO,
// dates as a table, no tinted bands and no persuasion — the reader came to
// finish a task, and the design's job is to get out of the way.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AnnouncementBar } from "@/components/ui/announcement-bar";
import { AudienceSwitch } from "@/components/ui/audience-switch";
import { EventCard } from "@/components/ui/event-card";
import { Faq } from "@/components/ui/faq";
export const Route = createFileRoute("/")({ component: P });
const TASKS: Record<string, { title: string; items: { label: string; note: string; href: string }[] }> = {
  prospective: { title: "Thinking of joining us", items: [
    { label: "Find your course", note: "38 A-levels and BTECs, honest entry lines", href: "#/courses" },
    { label: "Book an open evening", note: "Drop-in — no booking needed, next one 17 Sept", href: "#/visit" },
    { label: "How to apply", note: "Fifteen minutes online; closes 16 Jan", href: "#/apply" },
    { label: "Fees and support", note: "Free for 16–18; bursaries explained plainly", href: "#/apply" }] },
  current: { title: "You're here already", items: [
    { label: "Timetables", note: "This term's, by course code", href: "#events" },
    { label: "Pay for trips", note: "The October ones are up", href: "#events" },
    { label: "Library", note: "Open till 7 on teaching days", href: "#events" },
    { label: "Wellbeing drop-in", note: "Tuesdays and Thursdays, no appointment", href: "#events" }] },
  alumni: { title: "You were here once", items: [
    { label: "Transcripts", note: "Five working days, free", href: "#faq" },
    { label: "Alumni events", note: "The December reunion is booking", href: "#events" },
    { label: "Give back", note: "Mentoring beats money — an hour a term", href: "#faq" },
    { label: "Update your details", note: "Two minutes", href: "#faq" }] },
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
        <div className="mx-auto max-w-3xl px-6 py-12">
          <h1 className="text-3xl font-semibold tracking-tight">Rivelin College</h1>
          <p className="mt-2 text-muted-foreground">Sixth form · 1,400 students · two buses from Hillsborough every morning</p>

          <div className="mt-6">
            <AudienceSwitch value={who} onChange={setWho} label="I am"
              audiences={[
                { key: "prospective", label: "Future student" },
                { key: "current", label: "Current student" },
                { key: "alumni", label: "Alumni" }]} />
          </div>

          {/* The task register — a ruled list, not cards. */}
          <h2 className="mt-8 text-sm font-medium uppercase tracking-widest text-muted-foreground">{t.title}</h2>
          <ul className="mt-2 divide-y divide-border border-y border-border">
            {t.items.map((i) => (
              <li key={i.label}>
                <a href={i.href} className="group flex items-baseline justify-between gap-4 py-3.5">
                  <span>
                    <span className="font-medium group-hover:underline">{i.label}</span>
                    <span className="block text-sm text-muted-foreground">{i.note}</span>
                  </span>
                  <span aria-hidden="true" className="text-muted-foreground">→</span>
                </a>
              </li>
            ))}
          </ul>

          <section id="events" className="mt-12">
            <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Dates that matter</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <EventCard title="A-level results surgery" start="2026-08-13T09:00:00" venue="Room 14 — walk in" />
              <EventCard title="Open evening — all subjects" start="2026-09-17T18:00:00" venue="Main hall, then everywhere" />
              <EventCard title="Open morning — sciences" start="2026-10-03T10:00:00" venue="The labs, B block" />
              <EventCard title="Applications close for 2027" start="2027-01-16T17:00:00" venue="Online" />
            </div>
          </section>

          <section id="faq" className="mt-12 border-t border-border pt-8">
            <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Asked every September</h2>
            <Faq className="mt-3" items={[
              { question: "When are term dates published?", answer: "June, for the following year — in the calendar and the downloads." },
              { question: "Is there a bus from Hillsborough?", answer: "Two each morning — the 81 and our own minibus. Passes from reception." },
              { question: "Can I change subjects after enrolling?", answer: "In the first three weeks, usually yes — a conversation with your tutor, not a form." }]} />
          </section>
        </div>
      </SiteChrome>
    </div>
  );
}
