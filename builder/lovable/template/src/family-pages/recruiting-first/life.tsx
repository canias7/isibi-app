// recruiting-first /life — the culture proof, shown not claimed. The home
// page earns attention with the roles; this page spends it on evidence — the
// actual week, the actual room, benefits as a table of facts rather than a
// bulleted mood.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { DescriptionList } from "@/components/ui/description-list";
import { Gallery } from "@/components/ui/gallery";
import { Testimonial } from "@/components/ui/testimonial";
import { Timeline } from "@/components/ui/timeline";
export const Route = createFileRoute("/life")({ component: P });
const CHROME = {
  name: "Kelham Works", tagline: "A 14-person product studio by the river.",
  links: [{ label: "Open roles", href: "#/" }, { label: "The role", href: "#/role" }, { label: "Working here", href: "#/life" }],
};
function P() {
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">What working here is actually like</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">Culture pages are where studios lie to themselves, so this one sticks to things you could check in your first week.</p>
        <section className="mt-8">
          <h2 className="text-lg font-medium">A real week — Ana's, last week</h2>
          <Timeline className="mt-4" items={[
            { title: "Monday", description: "Pairing on the booking flow till 3, then planning. Home by 5:30." },
            { title: "Tuesday", description: "Deep work day — no meetings studio-wide, phones in the drawer by choice." },
            { title: "Wednesday", description: "Client review (20 min, on time), then shipping. Chips from the van." },
            { title: "Thursday", description: "Research calls with three users. The notes go to everyone." },
            { title: "Friday", description: "Studio day — Ana rebuilt the CI cache, two people learned the riso printer." },
          ]} />
        </section>
        <section className="mt-10">
          <h2 className="text-lg font-medium">The benefits, as facts</h2>
          <DescriptionList className="mt-3" items={[
            { label: "Hours", value: "38 in winter, 32 in summer (June–August, same pay)" },
            { label: "Holiday", value: "28 days + bank holidays; the studio closes between Christmas and New Year on top" },
            { label: "Where", value: "Kelham Island, or remote UK; office-first people get a desk that's theirs" },
            { label: "Kit", value: "Your pick, refreshed every three years, yours to keep at five" },
            { label: "Pension", value: "6% matched" },
            { label: "Parental leave", value: "6 months full pay, either parent, from day one" },
            { label: "Salary bands", value: "On the wiki, every role — where you land is set by the paid task" },
          ]} />
        </section>
        <section className="mt-10">
          <h2 className="text-lg font-medium">The room</h2>
          <Gallery className="mt-3" columns={3} items={[
            { src: null, alt: "The long bench, morning" },
            { src: null, alt: "The riso corner" },
            { src: null, alt: "Friday chips on the wall bench" },
          ]} />
        </section>
        <Testimonial className="mt-10" item={{ quote: "I took the pay cut to come here and un-took it within a year. The 32-hour summer is real — my allotment can confirm.", name: "Priya Chandra", role: "Engineer, year two" }} />
        <p className="mt-10 rounded-xl border bg-muted/40 p-4 text-sm">Sound like yours? <a className="font-medium underline underline-offset-4" href="#/">Three chairs are open</a> — the senior design one is <a className="font-medium underline underline-offset-4" href="#/role">described in full here</a>.</p>
      </div>
    </SiteChrome>
  );
}
