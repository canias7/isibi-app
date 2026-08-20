// care-home — the place, the fees and the visit. A family ringing round six
// homes is asking three questions, and every site in the sector answers none of
// them without a phone call: what is it like, what does it cost, can we come.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { ContactForm } from "@/components/ui/contact-form";
import { Faq } from "@/components/ui/faq";
import { Gallery } from "@/components/ui/gallery";
import { InspectionRating } from "@/components/ui/inspection-rating";
import { LocationCard } from "@/components/ui/location-card";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { TeamGrid } from "@/components/ui/team-grid";
import { Testimonial } from "@/components/ui/testimonial";
export const Route = createFileRoute("/")({ component: P });
export const RATING = {
  body: "CQC",
  rating: "Good",
  when: "March 2025",
  reportUrl: "#",
  domains: [
    { name: "Safe", rating: "Good" },
    { name: "Effective", rating: "Good" },
    { name: "Caring", rating: "Outstanding" },
    { name: "Responsive", rating: "Good" },
    { name: "Well-led", rating: "Requires improvement" },
  ],
  note: "Well-led was rated Requires improvement over our record-keeping. The action plan is in the report and we were re-inspected in June — we are waiting on that one.",
};
function P() {
  return (
    <SiteChrome name="Rivelin Lodge" tagline="A 34-bed residential and dementia care home in Walkley, Sheffield."
      links={[{ label: "The rooms", href: "/rooms" }, { label: "Fees", href: "/fees" }, { label: "Visit", href: "#visit" }]}
      action={{ label: "Arrange a visit", href: "#visit" }}>

      <section>
        <SafeImage src={null} alt="Rivelin Lodge from the garden" ratio="21/9" />
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid items-start gap-12 lg:grid-cols-[1.15fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">34 beds · residential and dementia · family-run since 1988</p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">Rivelin Lodge</h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                A large Victorian house above the Rivelin valley, run by the same family for
                thirty-seven years. Thirty-four people live here, twelve of them on the dementia
                floor, and eleven of the staff have been here over a decade.
              </p>
              {/* THE FEE, ON THE HOMEPAGE. The sector's whole habit is to make
                  families ring for it, and ringing six homes to ask what things
                  cost is the worst week of somebody's year. */}
              <div className="mt-8 rounded-xl border border-border bg-muted/50 p-6">
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">What it costs</p>
                <p className="mt-2 text-4xl font-semibold tracking-tight tabular-nums">£1,180–£1,450</p>
                <p className="mt-1 text-base">a week, all in</p>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Depending on the room. That figure includes everything except hairdressing,
                  chiropody and the newspaper — and those are £8, £22 and £4.50, which are also on
                  the fees page rather than in a letter later.
                </p>
                <a className="mt-4 inline-block text-sm font-medium underline underline-offset-4" href="/fees">Every fee, in full →</a>
              </div>
              <div className="mt-7 flex flex-wrap gap-3">
                <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="#visit">Come and look round</a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="/rooms">See the rooms</a>
              </div>
            </div>
            <InspectionRating {...RATING} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="A day here" title="What actually happens between breakfast and bed"
          description="Not a philosophy — a Tuesday. Nobody is woken to a schedule and nobody is put to bed at seven because the shift changes." />
        <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Mornings", "People get up when they wake up. Breakfast runs from seven to half ten and it is cooked, not a trolley."],
            ["The middle of the day", "Lunch at half twelve at tables of four. The garden door is open from April and the minibus goes out twice a week."],
            ["Afternoons", "Whatever is on — singing on Tuesday, the dog on Thursday, the hairdresser on Friday. None of it is compulsory and plenty of people read instead."],
            ["Evenings", "Tea at five, and after that it is the sitting room, the telly or your own room. There is no set bedtime and the night staff make toast at two in the morning."],
          ].map(([k, v]) => (
            <div key={k} className="border-t border-border pt-4">
              <p className="font-medium">{k}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{v}</p>
            </div>
          ))}
        </div>
        <Gallery className="mt-10" columns={4} items={[
          { src: null, alt: "The main sitting room" },
          { src: null, alt: "The dining room laid for lunch" },
          { src: null, alt: "A ground-floor bedroom" },
          { src: null, alt: "The garden in June" },
          { src: null, alt: "The dementia floor's own lounge" },
          { src: null, alt: "The kitchen" },
          { src: null, alt: "The hairdressing room" },
          { src: null, alt: "The view down the valley" },
        ]} />
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <SectionHeader eyebrow="Who works here" title="Eleven of them have been here over ten years"
            description="Staff turnover was 9% last year against a sector average nearer 30%. It is the single most useful number about any care home and almost nobody publishes it." />
          <TeamGrid className="mt-8" items={[
            { name: "Denise Hartley", role: "Manager, here 22 years" },
            { name: "Sam Okonjo", role: "Deputy manager, RGN" },
            { name: "Bev Slack", role: "Head of care, here 16 years" },
            { name: "Iwona Malecka", role: "Dementia lead" },
            { name: "Terry Dunn", role: "Chef, here 11 years" },
            { name: "Grace Amankwah", role: "Activities" },
          ]} />
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <Testimonial item={{ quote: "The fees were on the website. After ringing five homes and being told somebody would call back, that alone was why we came.", name: "Alison", role: "Daughter, resident since 2024" }} />
            <Testimonial item={{ quote: "They rang me when Dad had a fall before I could have found out any other way, and they told me what they had got wrong about it.", name: "Rob", role: "Son" }} />
            <Testimonial item={{ quote: "Mum has been here four years and the same three carers have looked after her the whole time. That is the thing that matters.", name: "Yasmin", role: "Daughter" }} />
          </div>
        </div>
      </section>

      <section id="visit" className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
          <div>
            <SectionHeader eyebrow="Come and look" title="Any day, and you do not need an appointment"
              description="Walk in between ten and six and somebody will show you round. We would rather you came unannounced on an ordinary Wednesday than to a tidied Saturday." />
            <div className="mt-6 space-y-4 text-base leading-relaxed text-muted-foreground">
              <p>
                Bring whoever is deciding. Stay for lunch if you want to — we will feed you, and the
                food is the fastest way to judge a home.
              </p>
              <p>
                Ask the residents rather than us. Nobody will steer you away from anyone and you can
                talk to anybody who wants to talk to you.
              </p>
              <p>
                A trial stay of two weeks is possible, at the weekly fee, with no obligation
                afterwards. About a third of people do it.
              </p>
            </div>
            <LocationCard className="mt-8" name="Rivelin Lodge"
              address="140 Rivelin Valley Road, Walkley, Sheffield, S6 5FF"
              note="Level access at the side entrance, parking for eight, and the 31 stops at the end of the drive." />
          </div>
          <div>
            <SectionHeader eyebrow="Or ask first" title="Whatever the question is"
              description="Denise reads these herself and answers the same day. There is no enquiry team and nobody will ring you repeatedly." />
            <ContactForm className="mt-6" askPhone onSubmit={() => {}} />
            <Faq className="mt-8" items={[
              { question: "Do you take council-funded residents?", answer: "Yes, and eleven of our residents are. Sheffield's rate does not cover our fee, so there is usually a third-party top-up — the figures are on the fees page rather than in a conversation." },
              { question: "What happens if someone's needs change?", answer: "We are registered for residential and dementia care, not nursing. If somebody needs nursing we say so early and help find the right place rather than waiting for a crisis." },
              { question: "Can we visit whenever?", answer: "Any hour. There are no visiting times and there never have been, including through the pandemic where the law allowed it." },
              { question: "Can they bring their own furniture?", answer: "Encouraged. Most rooms have the resident's own chair, pictures and bedding, and several have their own bed." },
            ]} />
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
