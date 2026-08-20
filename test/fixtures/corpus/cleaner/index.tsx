// cleaner — RECURRING-FIRST: priced per visit and sold as a standing slot. The
// three frequencies sit side by side because a customer comparing them can see
// that a monthly visit costs more per hour, which is true and which a toggle
// would let the page hide.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { BeforeAfter } from "@/components/ui/before-after";
import { Faq } from "@/components/ui/faq";
import { FrequencyPicker } from "@/components/ui/frequency-picker";
import { SectionHeader } from "@/components/ui/section-header";
import { ServiceArea } from "@/components/ui/service-area";
import { TeamGrid } from "@/components/ui/team-grid";
import { Testimonial } from "@/components/ui/testimonial";
import { TrustStrip } from "@/components/ui/trust-strip";
export const Route = createFileRoute("/")({ component: P });
export const OPTIONS = [
  { label: "Every week", perYear: 52, pricePerVisit: 48, duration: "2 hours", suggested: true, note: "The same person, the same day, the same time." },
  { label: "Every two weeks", perYear: 26, pricePerVisit: 56, duration: "2.5 hours", note: "The most common. Half an hour longer because a fortnight shows." },
  { label: "Once a month", perYear: 12, pricePerVisit: 78, duration: "3.5 hours", note: "Works for smaller places. A month is a long time in a kitchen." },
  { label: "One-off", perYear: 0, pricePerVisit: 145, duration: "5 hours", note: "End of tenancy, after a party, before the in-laws." },
];
function P() {
  return (
    <SiteChrome name="Rivelin Home Clean" tagline="Domestic cleaning in west Sheffield. Eleven cleaners, all employed."
      links={[{ label: "Book", href: "/book" }, { label: "Where we go", href: "/areas" }, { label: "Prices", href: "#prices" }]}
      action={{ label: "Book a clean", href: "/book" }}>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Walkley, Crookes, Hillsborough, Broomhill · since 2014</p>
          <h1 className="mt-3 max-w-3xl text-5xl font-semibold tracking-tight text-balance">
            The same person, the same day, every week
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            A standing slot rather than a job you have to book each time. Our cleaners are employed,
            not self-employed — they are paid £14.20 an hour, they get holiday pay, and they are the
            reason people stay with us for years rather than months.
          </p>
          <div id="prices" className="mt-10">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">A typical three-bedroom house</p>
            <FrequencyPicker className="mt-3" options={OPTIONS} onBook={() => {}} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <TrustStrip items={[
          { title: "Employed, not self-employed", description: "£14.20 an hour, holiday pay, sick pay" },
          { title: "£2m public liability", description: "And every cleaner DBS checked" },
          { title: "No contract", description: "A week's notice, cancel by text" },
        ]} />
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <SectionHeader eyebrow="What a visit is" title="Down to the detail, so nobody has to ask"
            description="This is the list the cleaner works from. Anything not on it, say so and it goes on yours — the list is per household, not per company." />
          <div className="mt-8 grid gap-x-12 gap-y-8 md:grid-cols-2 lg:grid-cols-3">
            {[
              ["Kitchen", ["Worktops, splashback and sink", "Hob and the front of the oven", "Outside of every cupboard and appliance", "Floor washed, not just swept", "Bins emptied and the bin itself wiped"]],
              ["Bathrooms", ["Bath, shower, screen and tiles", "Loo, inside and out and behind", "Basin, taps and mirror", "Floor washed", "Towels straightened, not folded into swans"]],
              ["Bedrooms", ["Dusted, including the tops of things", "Beds made, or stripped if you leave clean sheets out", "Floors hoovered, under the bed included", "Mirrors and glass"]],
              ["Living rooms", ["Dusted and polished", "Hoovered, including under cushions", "Skirtings and sills", "TV screen and the shelf it sits on"]],
              ["Everywhere", ["Cobwebs", "Light switches and door handles", "Stairs and bannister", "Front and back door glass"]],
              ["Every third visit", ["Inside the fridge", "Inside the oven", "Inside the windows", "Skirting boards washed rather than dusted"]],
            ].map(([room, list]) => (
              <div key={room as string} className="border-t border-border pt-5">
                <h3 className="font-medium">{room as string}</h3>
                <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                  {(list as string[]).map((l) => <li key={l}>{l}</li>)}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-8 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Not included anywhere: anything outside, anything above head height on a ladder,
            handling other people's laundry, and clearing up after a pet or a person who is unwell.
            Ask about any of them and we will usually say yes — we just will not pretend they are
            in the price.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
          <div>
            <SectionHeader eyebrow="An ordinary Tuesday" title="Two hours, one house" />
            <BeforeAfter className="mt-6" before={null} after={null}
              beforeLabel="Before" afterLabel="After" ratio="4/3" />
            <p className="mt-3 text-sm text-muted-foreground">
              A real kitchen belonging to a real customer, photographed with their permission and
              not tidied first.
            </p>
          </div>
          <div>
            <SectionHeader eyebrow="Where we go" title="West Sheffield, and not much further"
              description="We stay small on purpose. A cleaner who spends forty minutes driving is a cleaner doing three houses a day instead of four, and that comes out of somebody's wage." />
            <ServiceArea className="mt-6" placeholder="Your postcode"
              areas={["S6", "S10", "S11", "S3", "S35"]}
              note="Just outside? Ring anyway — if it is on the way to somebody we already visit, the answer is usually yes." />
            <a className="mt-6 inline-block text-sm font-medium underline underline-offset-4" href="/areas">The streets we actually cover →</a>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <SectionHeader eyebrow="Who comes" title="Eleven people, all employed by us"
            description="You get the same one every visit and you meet them before you commit. If it is not a fit, say so — nobody is offended and we will send somebody else." />
          <TeamGrid className="mt-8" items={[
            { name: "Marta Kowalczyk", role: "With us since 2015" },
            { name: "Dawn Ellis", role: "With us since 2016" },
            { name: "Fatima Ahmed", role: "With us since 2019" },
            { name: "Joel Whitcombe", role: "With us since 2021" },
            { name: "Iulia Pavel", role: "With us since 2022" },
            { name: "Chrissy Rowe", role: "Supervisor, since 2014" },
          ]} />
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <Testimonial item={{ quote: "Marta has been coming on Tuesdays for six years. She has a key, she knows where everything goes, and I have never once had to leave a note.", name: "Helen", role: "Crookes, weekly" }} />
            <Testimonial item={{ quote: "They put the three prices next to each other on the site, which is how I noticed monthly was actually worse value. Went fortnightly instead.", name: "Sam", role: "Walkley, fortnightly" }} />
            <Testimonial item={{ quote: "Cancelled for four weeks when we were away. One text, no argument, no charge, and the same slot when we came back.", name: "Nadine", role: "Broomhill, weekly" }} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="max-w-3xl">
          <SectionHeader eyebrow="Asked often" title="The questions people email" />
          <Faq className="mt-6" items={[
            { question: "Do I need to be in?", answer: "No. Most customers give us a key, which we hold in a safe with a code rather than an address on the fob. Plenty use a key safe instead." },
            { question: "Do you bring your own things?", answer: "Everything except the hoover, which is yours because carrying eleven hoovers round Sheffield is silly. If you would rather we used your products, leave them out." },
            { question: "What if I want to skip a week?", answer: "Text by the Friday before. No charge, and your slot is still yours." },
            { question: "What if something gets broken?", answer: "We tell you before you find it, and we replace it. That is what the £2m public liability is for and it is why we have never argued about a mug." },
            { question: "Why are you dearer than a self-employed cleaner?", answer: "Because our cleaners are employed on £14.20 an hour with holiday and sick pay, and because there is cover when somebody is ill. Both of those cost money and neither is optional for us." },
            { question: "Can I have the same person every time?", answer: "Yes, that is the default and it is the whole point. When they are on holiday we tell you who is coming instead, by name, the week before." },
          ]} />
        </div>
      </section>
    </SiteChrome>
  );
}
