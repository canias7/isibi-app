// church /visit — the first visit, answered properly. Every question here is
// one somebody is too embarrassed to ask a stranger.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Faq } from "@/components/ui/faq";
import { LocationCard } from "@/components/ui/location-card";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { ServiceTimes } from "@/components/ui/service-times";
export const Route = createFileRoute("/visit")({ component: P });
const STEPS = [
  ["Getting in", "The South Road gate is step-free and the one most people use. The Fir Street door has three steps."],
  ["Where to sit", "Anywhere. The back half is where visitors usually sit and there is no reserved seating."],
  ["What you get handed", "An order of service and a hymn book. Large print is at the back — take one, nobody is counting."],
  ["The hour itself", "Singing, readings, about ten minutes of talking, communion, more singing. Roughly an hour."],
  ["Communion", "Come up for it, come up for a blessing with your hands down, or stay in your seat. All three are normal."],
  ["Afterwards", "Coffee in the hall. You are entirely allowed to leave instead, and plenty do."],
];
function P() {
  return (
    <SiteChrome name="St Chad's, Walkley" tagline="A parish church on South Road since 1868."
      links={[{ label: "Home", href: "#/" }, { label: "In the week", href: "#/groups" }]}
      action={{ label: "Service times", href: "#times" }}>
      <div className="mx-auto max-w-5xl px-6 py-14">
        <SectionHeader eyebrow="First visit" title="What happens, step by step"
          description="Nothing here assumes you have done this before, because most people reading it have not." />
        <div className="mt-10 grid gap-12 lg:grid-cols-[1.3fr_1fr]">
          <ol className="space-y-6">
            {STEPS.map(([t, d], i) => (
              <li key={t} className="border-t border-border pt-5">
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Step {i + 1}</p>
                <h2 className="mt-1 text-lg font-medium">{t}</h2>
                <p className="mt-1 text-base leading-relaxed text-muted-foreground">{d}</p>
              </li>
            ))}
          </ol>
          <aside className="space-y-8">
            <SafeImage src={null} alt="The South Road gate, which is the step-free one" ratio="4/3" />
            <LocationCard name="St Chad's, Walkley" address="South Road, Walkley, Sheffield, S6 3TD"
              note="Hearing loop throughout. Accessible toilet in the hall." />
          </aside>
        </div>
        <section id="times" className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="Times" title="This week" />
          <div className="mt-6 max-w-2xl">
            <ServiceTimes heading="" meetings={[
              { day: "Sunday", time: "08:30", what: "Said communion", where: "Lady chapel" },
              { day: "Sunday", time: "10:30", what: "Parish communion", where: "Main church", note: "Sunday 14th: one joint service at 10:30" },
              { day: "Wednesday", time: "10:00", what: "Midweek communion", where: "Lady chapel" },
            ]} />
          </div>
        </section>
        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="Still wondering" title="The rest of it" />
          <Faq className="mt-6" items={[
            { question: "Can I come and just look at the building?", answer: "Yes — it is open Wednesday and Saturday mornings and there is usually somebody about who will leave you alone unless you want otherwise." },
            { question: "Will anyone try to sign me up to anything?", answer: "No. You may be offered a coffee." },
            { question: "What about children?", answer: "They are not expected to be quiet. There is a corner with books and a box of quiet toys." },
          ]} />
        </section>
      </div>
    </SiteChrome>
  );
}
