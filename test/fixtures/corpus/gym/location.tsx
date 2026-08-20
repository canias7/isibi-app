// gym /location — one branch's own page. The chain answers "which
// one"; this page answers everything after: is it open, what's on today,
// where exactly, how to join THIS gym.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Button } from "@/components/ui/button";
import { DaySchedule } from "@/components/ui/day-schedule";
import { LocationCard } from "@/components/ui/location-card";
import { OpenNow } from "@/components/ui/open-now";
import { OpeningHours, type DayHours } from "@/components/ui/opening-hours";
export const Route = createFileRoute("/location")({ component: P });
const CHROME = {
  name: "Forge Gyms", tagline: "Four gyms, one membership, no contracts.",
  links: [{ label: "All gyms", href: "/" }, { label: "Join", href: "#join" }],
  action: { label: "Join — £24.99", href: "#join" },
};
const HOURS: DayHours[] = [
  { day: 1, label: "Monday", open: "06:00", close: "22:00" },
  { day: 2, label: "Tuesday", open: "06:00", close: "22:00" },
  { day: 3, label: "Wednesday", open: "06:00", close: "22:00" },
  { day: 4, label: "Thursday", open: "06:00", close: "22:00" },
  { day: 5, label: "Friday", open: "06:00", close: "22:00" },
  { day: 6, label: "Saturday", open: "08:00", close: "20:00" },
  { day: 0, label: "Sunday", open: "08:00", close: "20:00" },
];
function P() {
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-3xl px-6 py-12">
        <a className="text-sm text-muted-foreground underline underline-offset-4" href="/">← All four gyms</a>
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">Forge Kelham</h1>
          <OpenNow hours={HOURS.filter((h) => h.open).map((h) => ({ day: h.day, open: h.open!, close: h.close! }))} />
        </div>
        <p className="mt-2 max-w-xl text-muted-foreground">The first one, in the old wire works. Strength-led: three lifting platforms, no queue for a rack after six.</p>
        <div className="mt-8 grid gap-8 sm:grid-cols-2">
          <section>
            <h2 className="text-lg font-medium">Today at Kelham</h2>
            <DaySchedule className="mt-3" items={[
              { at: "06:30", title: "Open gym", meta: "No classes before work — deliberate" },
              { at: "12:15", title: "Lunch lift club", meta: "45 min, coached, free" },
              { at: "17:30", title: "Beginners' barbell", meta: "Book at the desk" },
              { at: "19:00", title: "Open gym till 10", meta: "Quietest after 8:30" },
            ]} />
          </section>
          <div className="grid gap-6 self-start">
            <LocationCard name="Forge Kelham" address="Alma Street, Sheffield S3 8SA" note="Door code on your membership card. Bike racks inside the gate." />
            <div className="max-w-sm"><OpeningHours days={HOURS} /></div>
          </div>
        </div>
        <section id="join" className="mt-10 rounded-xl border bg-muted/40 p-6 text-center">
          <h2 className="text-xl font-semibold tracking-tight">Join at Kelham</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">£24.99 a month, works at all four gyms, cancel whenever. Sign up takes two minutes at the desk — bring nothing.</p>
          <Button className="mt-4" asChild><a href="/">Find your nearest first</a></Button>
        </section>
      </div>
    </SiteChrome>
  );
}
