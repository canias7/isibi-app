// brewery /visit — taproom hours, tours, and finding a blue door under a
// viaduct, which is harder than it sounds.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { EventCard } from "@/components/ui/event-card";
import { Faq } from "@/components/ui/faq";
import { LocationCard } from "@/components/ui/location-card";
import { OpeningHours, type DayHours } from "@/components/ui/opening-hours";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
export const Route = createFileRoute("/visit")({ component: P });
const HOURS: DayHours[] = [
  { day: 1, label: "Monday", open: null, close: null },
  { day: 2, label: "Tuesday", open: null, close: null },
  { day: 3, label: "Wednesday", open: "16:00", close: "22:00" },
  { day: 4, label: "Thursday", open: "16:00", close: "22:00" },
  { day: 5, label: "Friday", open: "15:00", close: "23:00" },
  { day: 6, label: "Saturday", open: "12:00", close: "23:00" },
  { day: 0, label: "Sunday", open: "12:00", close: "20:00" },
];
function P() {
  return (
    <SiteChrome name="Six Weirs" tagline="A brewery and taproom under the arches at Kelham."
      links={[{ label: "Home", href: "/" }, { label: "The range", href: "/range" }]}
      action={{ label: "What's pouring", href: "/" }}>
      <div className="mx-auto max-w-5xl px-6 py-14">
        <SectionHeader eyebrow="The taproom" title="Coming to the arch"
          description="Wednesday to Sunday. Closed Monday and Tuesday because somebody has to brew." />
        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-8">
            <div>
              <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">Hours</h2>
              <OpeningHours className="mt-4" days={HOURS} />
            </div>
            <LocationCard name="Six Weirs" address="Arch 14, Alma Street, Kelham Island, Sheffield, S3 8SA"
              note="The blue door under the viaduct — not the green one, which is a joinery. Tram to Shalesmoor, five minutes." />
          </div>
          <SafeImage src={null} alt="The blue door, which is the one you want" ratio="4/5" />
        </div>
        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="Tours" title="Six people, ninety minutes" />
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <EventCard title="Brewery tour & tasting" start="2026-08-09T14:00:00" venue="£18 — six places" />
            <EventCard title="Brewery tour & tasting" start="2026-08-23T14:00:00" venue="£18 — six places" />
          </div>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            You will be shown a mash tun and given four thirds. It is not a slick operation and the tour is
            given by whoever brewed that morning, which is most of the appeal.
          </p>
        </section>
        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="Asked often" title="Before you set off" />
          <Faq className="mt-6" items={[
            { question: "Is it accessible?", answer: "Level access through the blue door, and the bar is at two heights. The toilet is accessible; the cellar is not and never will be, because it is a Victorian arch." },
            { question: "Can I bring children?", answer: "Until seven, yes. There are board games behind the bar and no highchairs, which we know is a gap." },
            { question: "Do you do food?", answer: "No, and we would rather not pretend. There is a pizza place two arches down and you are welcome to bring it in." },
            { question: "Can I book a table?", answer: "No tables are bookable — it is benches and first come. For groups over ten, ring and we will tell you honestly whether you will get in." },
            { question: "Dogs?", answer: "Yes. There is a water bowl by the door and most of them know it." },
          ]} />
        </section>
      </div>
    </SiteChrome>
  );
}
