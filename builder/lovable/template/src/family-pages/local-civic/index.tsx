// local-civic — hours, address, documents; utility over polish, deliberately.
// A branch library.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AnnouncementBar } from "@/components/ui/announcement-bar";
import { FileList } from "@/components/ui/file-list";
import { LocationCard } from "@/components/ui/location-card";
import { OpenNow } from "@/components/ui/open-now";
import { OpeningHours, type DayHours } from "@/components/ui/opening-hours";
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
        links={[{ label: "Hours", href: "#hours" }, { label: "What's on", href: "#/events" }, { label: "Join", href: "#/join" }, { label: "Minutes", href: "#docs" }]}>
        <div className="mx-auto max-w-2xl px-6 py-10">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">Walkley Library</h1>
            <OpenNow hours={HOURS.filter((h) => h.open).map((h) => ({ day: h.day, open: h.open!, close: h.close! }))} />
          </div>
          <div id="hours" className="mt-6 grid gap-6 sm:grid-cols-2">
            <OpeningHours days={HOURS} />
            <LocationCard name="Walkley Library" address="South Road, Walkley, S6 3TD" note="Step-free from the South Road door. The 95 stops outside." />
          </div>
          <p className="mt-6 text-sm"><a className="font-medium underline underline-offset-4" href="#/events">What's on in August — rhyme time to the repair café →</a></p>
          {/* Documents as a first-class section — the family's tell. */}
          <section id="docs" className="mt-10">
            <h2 className="text-lg font-medium">Papers</h2>
            <FileList className="mt-3" files={[
              { name: "Trustees minutes — July 2026.pdf", size: 182_000, href: "#docs" },
              { name: "Annual accounts 2025.pdf", size: 940_000, href: "#docs" },
              { name: "Room hire form.pdf", size: 88_000, href: "#docs", meta: "£8/hr community rate" }]} />
          </section>
        </div>
      </SiteChrome>
    </div>
  );
}
