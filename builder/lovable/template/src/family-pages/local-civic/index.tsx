// local-civic — hours, address, contact, documents; utility over polish,
// deliberately. A branch library: the live answer up top, what's on this
// week, the papers as a first-class list, and how to join. Nothing here
// needs to impress; everything needs to be findable.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AnnouncementBar } from "@/components/ui/announcement-bar";
import { EventCard } from "@/components/ui/event-card";
import { FileList } from "@/components/ui/file-list";
import { LocationCard } from "@/components/ui/location-card";
import { OpenNow } from "@/components/ui/open-now";
import { OpeningHours, type DayHours } from "@/components/ui/opening-hours";
import { SectionHeader } from "@/components/ui/section-header";
export const Route = createFileRoute("/")({ component: P });
const HOURS: DayHours[] = [
  { day: 1, label: "Monday", open: "10:00", close: "17:00" },
  { day: 2, label: "Tuesday", open: "10:00", close: "17:00" },
  { day: 3, label: "Wednesday", open: null, close: null },
  { day: 4, label: "Thursday", open: "10:00", close: "19:00" },
  { day: 5, label: "Friday", open: "10:00", close: "17:00" },
  { day: 6, label: "Saturday", open: "09:30", close: "13:00" },
  { day: 0, label: "Sunday", open: null, close: null },
];
function P() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <AnnouncementBar href="#docs">Boiler works 11–15 August — we're open, but wear a jumper.</AnnouncementBar>
      <SiteChrome name="Walkley Library" tagline="Volunteer-run since 2014. Everyone welcome, no card needed to sit."
        links={[{ label: "Hours", href: "#hours" }, { label: "What's on", href: "#/events" }, { label: "Join", href: "#/join" }, { label: "Papers", href: "#docs" }]}>

        <section className="border-b border-border bg-muted/40">
          <div className="mx-auto max-w-3xl px-6 py-12">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">South Road, Walkley · community-run</p>
                <h1 className="mt-2 text-4xl font-semibold tracking-tight">Walkley Library</h1>
                <p className="mt-3 max-w-md text-lg text-muted-foreground">Books, warmth, printing at cost, and a dragon costume of local renown. Run by forty volunteers since the council couldn't.</p>
              </div>
              <OpenNow hours={HOURS.filter((h) => h.open).map((h) => ({ day: h.day, open: h.open!, close: h.close! }))} />
            </div>
          </div>
        </section>

        <section id="hours" className="mx-auto grid max-w-4xl gap-8 px-6 py-12 sm:grid-cols-2">
          <div>
            <SectionHeader eyebrow="When" title="Open five days" description="Wednesday is a staffing gap, not a rule — volunteer and it opens." />
            <div className="mt-5 max-w-sm"><OpeningHours days={HOURS} /></div>
          </div>
          <LocationCard className="self-start" name="Walkley Library" address="South Road, Walkley, S6 3TD" note="Step-free from the South Road door. The 95 stops outside." />
        </section>

        <section className="border-y border-border bg-muted/40">
          <div className="mx-auto max-w-3xl px-6 py-12">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <SectionHeader eyebrow="This week" title="On at the library" />
              <a className="text-sm font-medium underline underline-offset-4" href="#/events">The whole month →</a>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <EventCard title="Rhyme time (under-5s)" start="2026-08-04T10:30:00" venue="Children's corner" />
              <EventCard title="Repair café" start="2026-08-08T10:00:00" venue="Main room" />
            </div>
          </div>
        </section>

        {/* Documents as a first-class section — the family's tell. */}
        <section id="docs" className="mx-auto max-w-3xl px-6 py-12">
          <SectionHeader eyebrow="Papers" title="The public record" description="Minutes, accounts and forms — published here before anyone has to ask." />
          <FileList className="mt-5" files={[
            { name: "Trustees minutes — July 2026.pdf", size: 182000, href: "#docs" },
            { name: "Annual accounts 2025.pdf", size: 940000, href: "#docs" },
            { name: "Room hire form.pdf", size: 88000, href: "#docs", meta: "£8/hr community rate" },
            { name: "Volunteer welcome pack.pdf", size: 412000, href: "#docs" }]} />
        </section>

        <section className="border-t border-border bg-muted/40">
          <div className="mx-auto max-w-3xl px-6 py-12 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">A card takes five minutes</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Free, any age, no S6 requirement — and you don't need one just to sit and be warm.</p>
            <a className="mt-5 inline-block rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="#/join">Get a card</a>
          </div>
        </section>
      </SiteChrome>
    </div>
  );
}
