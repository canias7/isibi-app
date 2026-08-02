// cleaner /areas — the streets and postcodes actually covered. Naming the real
// boundary is more useful than "Sheffield and surrounding areas", which is what
// every one of these sites says and which answers nobody's question.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CtaBand } from "@/components/ui/cta-band";
import { ContactForm } from "@/components/ui/contact-form";
import { Faq } from "@/components/ui/faq";
import { SectionHeader } from "@/components/ui/section-header";
import { ServiceArea } from "@/components/ui/service-area";
export const Route = createFileRoute("/areas")({ component: P });
const PATCHES = [
  { name: "Walkley and Crookes", codes: "S6, S10", detail: "Where we started and still about half of what we do. Slots here come up most often.", days: "Every weekday" },
  { name: "Hillsborough and Wadsley", codes: "S6", detail: "Down to the Rivelin and up as far as Wadsley Bridge. Not past Oughtibridge.", days: "Monday, Tuesday, Thursday" },
  { name: "Broomhill and Crosspool", codes: "S10", detail: "Including Lydgate, Sandygate and as far as the Sportsman.", days: "Wednesday, Thursday, Friday" },
  { name: "Nether Green and Ranmoor", codes: "S10, S11", detail: "Down to Endcliffe Park. Fulwood is the western edge and we do not go past it.", days: "Tuesday, Wednesday" },
  { name: "Kelham and the city centre", codes: "S3", detail: "Flats and apartments mostly. Parking has to be sorted before the first visit.", days: "Monday, Friday" },
  { name: "Grenoside and Chapeltown", codes: "S35", detail: "The newest patch and the thinnest. One cleaner covers it, so slots are limited.", days: "Thursday only" },
];
function P() {
  return (
    <SiteChrome name="Rivelin Home Clean" tagline="Domestic cleaning in west Sheffield. Eleven cleaners, all employed."
      links={[{ label: "Home", href: "#/" }, { label: "Book", href: "#/book" }]}
      action={{ label: "Book a clean", href: "#/book" }}>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="Where we go" title="Six patches, and an honest edge"
          description="Everybody's website says 'Sheffield and surrounding areas', which answers nothing. This is the actual boundary, and where it is thin we say so." />

        <div className="mt-10 max-w-xl">
          <ServiceArea placeholder="Your postcode — try S6 or S10"
            areas={["S6", "S10", "S11", "S3", "S35"]}
            note="If it says no, ring anyway. Anything on the route between two houses we already do is usually a yes." />
        </div>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="The patches" title="And which days each one runs" />
          <ul className="mt-8 divide-y divide-border border-y border-border">
            {PATCHES.map((p) => (
              <li key={p.name} className="grid gap-x-8 gap-y-2 py-5 lg:grid-cols-[1.1fr_7rem_1.5fr_11rem]">
                <span className="text-lg font-medium">{p.name}</span>
                <span className="text-base tabular-nums text-muted-foreground">{p.codes}</span>
                <span className="text-sm leading-relaxed text-muted-foreground">{p.detail}</span>
                <span className="text-sm">{p.days}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <SectionHeader eyebrow="Why so small" title="A cleaner who drives is a cleaner not cleaning"
                description="This is the reason we turn work down, and it is worth saying plainly." />
              <div className="mt-6 space-y-4 text-base leading-relaxed text-muted-foreground">
                <p>
                  Forty minutes of driving between houses is forty minutes somebody is paid for and
                  nobody's house gets cleaner. Spread over a day it is the difference between four
                  houses and three, and that difference comes out of a wage.
                </p>
                <p>
                  So we cover a patch you can cross in fifteen minutes and we say no to the rest.
                  It is why our cleaners stay — the average here is over five years, against about
                  eight months across the industry.
                </p>
                <p>
                  If you are just outside, ring. The honest answer is sometimes yes, and it depends
                  entirely on whether you are on the way to somebody we already visit.
                </p>
              </div>
              <Faq className="mt-8" items={[
                { question: "I am in S8 / S17 / S20 — will you come?", answer: "No, and we would rather say so than take the job and be late every week. Ring us anyway and we will give you the name of somebody good who does cover it." },
                { question: "What about a second home or a holiday let?", answer: "Yes, inside the patch, and changeover cleans are priced as one-offs. Tell us the changeover day rather than a time — those never run to time." },
                { question: "Do you charge more further out?", answer: "No. Every price on this site is the same in every patch, which is only possible because the patch is small." },
                { question: "Can I be on a waiting list?", answer: "Yes, and it is a real one rather than a mailing list. Grenoside is the longest at about two months; Walkley is usually a fortnight." },
              ]} />
            </div>
            <div>
              <SectionHeader eyebrow="Not sure" title="Ask and we will tell you straight"
                description="Give us the postcode and the street. You will get a yes or a no rather than a sales call." />
              <ContactForm className="mt-6" askPhone onSubmit={() => {}} />
            </div>
          </div>
        </section>

        <section className="mt-14">
          <CtaBand title="Inside the patch?"
            description="Prices are on the page and the first visit is preceded by a free ten minutes so you can meet whoever would be coming."
            action={{ label: "See the prices", href: "#/book" }} />
        </section>
      </div>
    </SiteChrome>
  );
}
