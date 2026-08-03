// accountant/booking-hybrid — A VETERINARY PRACTICE. The trust-first family
// puts credentials before any pitch and it is right: nobody books an accountant
// off a slot picker.
//
// A vet is both at once. The trust question is real and it is currently the
// live one in this trade — the CMA spent two years on whether people are told
// who owns their practice and what things cost — but the visitor ALSO needs an
// appointment on Thursday, and a page that makes them read four credentials
// first is a page they leave for one that has a button.
//
// So the slot picker exists and it comes SECOND: registration, the vets by
// name, and who owns us, and then the booking. The one thing that jumps the
// queue is the emergency number, because somebody whose dog has just eaten
// something is not reading about the CMA.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AvailabilityGrid } from "@/components/ui/availability-grid";
import { Faq } from "@/components/ui/faq";
import { OpenNow } from "@/components/ui/open-now";
import { PractitionerCard } from "@/components/ui/practitioner-card";
import { PriceList } from "@/components/ui/price-list";
import { SectionHeader } from "@/components/ui/section-header";
import { SpecList, SpecRow } from "@/components/ui/spec-row";
import { StatsBand } from "@/components/ui/stats-band";
import { Testimonial } from "@/components/ui/testimonial";
import { TrustStrip } from "@/components/ui/trust-strip";
import { VerifiedBadge } from "@/components/ui/verified-badge";
export const Route = createFileRoute("/booking-hybrid")({ component: P });
export const HOURS = [
  { day: 1, open: "08:30", close: "18:30" }, { day: 2, open: "08:30", close: "18:30" },
  { day: 3, open: "08:30", close: "18:30" }, { day: 4, open: "08:30", close: "19:30" },
  { day: 5, open: "08:30", close: "18:30" }, { day: 6, open: "09:00", close: "13:00" },
];
function P() {
  return (
    <SiteChrome name="Marsh Lane Veterinary" tagline="Independent, RCVS accredited, and owned by the two vets who work here. Louth, Lincolnshire."
      links={[{ label: "What we do and what it costs", href: "#/services" }, { label: "Book or ring", href: "#/contact" }, { label: "The practice", href: "#/about" }]}
      action={{ label: "Book an appointment", href: "#book" }}>

      {/* THE ONE THING THAT JUMPS THE QUEUE. Somebody whose dog has eaten
          something at nine at night is not reading about ownership structures,
          and burying this under the trust section would be the whole page
          getting its own argument wrong. */}
      <div className="border-b-2 border-foreground bg-muted/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <p className="text-sm leading-relaxed">
            <span className="font-semibold">Emergency, out of hours?</span>{" "}
            Ring <a className="font-semibold underline underline-offset-4" href="tel:01507602118">01507 602 118</a> —
            it goes to a vet, not a service, every night and every weekend.
          </p>
          <OpenNow hours={HOURS} />
        </div>
      </div>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Practice since 1994 · RCVS Practice Standards accredited
              </p>
              <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-tight text-balance">
                Two vets, who own the practice, and who will still own it next year.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
                Six independent practices in this county have been bought by corporate groups since
                2019. We are not one of them, we have not been approached in a way we took
                seriously, and if that ever changes we will tell every registered client before it
                completes rather than after.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <VerifiedBadge label="RCVS accredited" title="Royal College of Veterinary Surgeons Practice Standards Scheme, Small Animal General Practice, reinspected 2025" />
                <VerifiedBadge label="Independently owned" title="Owned by Prisha Nandra MRCVS and Callum Tait MRCVS. No group, no investor, no franchise" />
                <VerifiedBadge label="Prices published" title="Every routine price is on the services page, in full, including what happens when it goes over" />
              </div>
            </div>
            <div>
              <SpecList>
                <SpecRow label="Registered with" value="RCVS" note="Both vets. Numbers on the about page, and both are checkable on the public register" highlight />
                <SpecRow label="Owned by" value="The two vets here" note="Not a group. This is the question the CMA spent two years on and most sites do not answer it" highlight />
                <SpecRow label="Out of hours" value="Us, on a rota" note="Not an outsourced service forty minutes away. One of us is on call every night" highlight />
                <SpecRow label="Prices" value="All published" note="Consultation, vaccination, neutering, dental — and what an estimate means" />
                <SpecRow label="Complaints" value="In writing, 5 days" note="And the RCVS route stated, rather than hidden at the bottom of a policy" />
                <SpecRow label="Insurance" value="Direct claims, most insurers" note="We do the paperwork. You pay the excess rather than the whole bill and wait" />
              </SpecList>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 py-12">
        <StatsBand items={[
          { value: "1994", label: "Same practice, same building" },
          { value: "2", label: "Vets, both of them owners" },
          { value: "£42", label: "A consultation, published and not moved since 2024" },
          { value: "24/7", label: "On call, by us, from here" },
        ]} />

        <section className="mt-14">
          <SectionHeader eyebrow="Who you will see" title="Both of them, by name, with their register number"
            description="A practice that names its vets is a practice where you see the same one twice, which for a chronic condition is most of the value of a vet." />
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <PractitionerCard
              name="Prisha Nandra" role="Veterinary surgeon and co-owner" letters="BVetMed MRCVS"
              register="RCVS" registerNumber="7041882" registerUrl="#/about"
              treats={["Dogs", "Cats", "Rabbits", "Small furries"]}
              languages={["English", "Hindi"]}
              note="Here since 2011, an owner since 2016. Certificate in small animal medicine. Runs the diabetic and thyroid clinics."
              accepting />
            <PractitionerCard
              name="Callum Tait" role="Veterinary surgeon and co-owner" letters="BVMS MRCVS"
              register="RCVS" registerNumber="7118440" registerUrl="#/about"
              treats={["Dogs", "Cats", "Sheep", "Cattle"]}
              languages={["English"]}
              note="Here since 2016, an owner since 2019. Does the farm work, which is why Tuesdays and Thursdays are mornings only."
              accepting />
          </div>
        </section>

        {/* AND ONLY NOW THE SLOT PICKER. Everything above it is what the base
            family would have put on the whole page; everything below is what a
            booking-first family would have led with. The order is the variant. */}
        <section id="book" className="mt-14 border-t border-border pt-10">
          <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="Now that you know who we are" title="Thursday 6 August"
                description="Routine appointments only. Anything urgent, ring — we keep four slots a day back for the same day and they are not on this grid, because a grid cannot tell how worried you are." />
              <div className="mt-6">
                <AvailabilityGrid
                  slots={["09:00", "09:20", "09:40", "10:00", "10:20", "10:40", "11:00", "11:20",
                    "14:00", "14:20", "14:40", "15:00", "15:20", "15:40", "16:00", "16:20",
                    "16:40", "17:00", "17:20", "17:40", "18:00", "18:20", "18:40", "19:00"]}
                  taken={["09:00", "09:20", "10:00", "10:40", "11:00", "14:20", "15:00", "15:20",
                    "16:00", "16:40", "17:00", "17:20", "18:20"]} />
              </div>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Twenty minutes, which is longer than most and is deliberate — a ten-minute
                consultation is where things get missed. Thursday runs to half past seven for people
                who work.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="#/contact">Book the time you picked</a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium tabular-nums" href="tel:01507602118">Or ring 01507 602 118</a>
              </div>
            </div>

            <div>
              <SectionHeader eyebrow="What it costs" title="Published, and it is the same price on a Saturday"
                description="Every routine price is here and the rest are on the services page. An estimate for anything surgical is written, itemised, and we ring before it goes 10% over rather than after." />
              <div className="mt-6">
                <PriceList items={[
                  { name: "Consultation", price: 42, meta: "20 min", description: "Same price evenings and Saturdays. No out-of-hours uplift during opening hours" },
                  { name: "Follow-up consultation", price: 28, meta: "within 14 days", description: "For the same problem. Charging full price twice for one illness is a habit we do not have" },
                  { name: "Vaccination, dog, annual", price: 54, meta: "incl. consultation", description: "Not consultation plus vaccine as two lines" },
                  { name: "Vaccination, cat, annual", price: 51, meta: "incl. consultation" },
                  { name: "Neutering, cat", price: 98, meta: "male · female £142", description: "Includes pre-op check, anaesthetic, pain relief and the post-op check" },
                  { name: "Dental, from", price: 240, meta: "estimate written first", description: "Depends entirely on extractions. We ring from theatre before doing more than the estimate" },
                  { name: "Out of hours, own client", price: 130, meta: "call-out", description: "Plus treatment. A commercial service is usually £180 to £250 for the call alone" },
                  { name: "Euthanasia, at home", price: 95, meta: "any time", description: "Including out of hours, and we do not charge a call-out on top of it" },
                ]} />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <TrustStrip items={[
            { title: "RCVS Practice Standards", description: "Small Animal General Practice, accredited, reinspected 2025. Voluntary, and about half of UK practices are not in it" },
            { title: "Direct insurance claims", description: "Most insurers. You pay the excess and we wait for the rest, rather than you paying £1,400 and waiting eight weeks" },
            { title: "No consultation fee to discuss cost", description: "Ring and ask what something will be. Nobody has ever been charged for that conversation" },
          ]} />
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="Said by clients" title="Two, and the second one is about money" />
              <div className="mt-6 space-y-5">
                <Testimonial item={{
                  quote: "Bramble has been diabetic for four years and Prisha has seen her every single time. I have never once had to explain the history to somebody new, and when you are managing a chronic thing that is worth more than anything else on this page.",
                  name: "Hazel Wraithwick", role: "Client since 2019",
                }} />
                <Testimonial item={{
                  quote: "Callum rang me from theatre to say the dental was going to need three extractions rather than one and it would be £310 rather than £240. Nobody has ever rung me about a bill before it happened.",
                  name: "Devon Aitcheson", role: "Client since 2022",
                }} />
              </div>
            </div>
            <div>
              <SectionHeader eyebrow="Asked often" title="Mostly about cost and ownership" />
              <Faq className="mt-6" items={[
                { question: "Are you owned by a corporate group?", answer: "No. Prisha and Callum own the practice between them and there is no group, investor or franchise behind it. Six independents in Lincolnshire have been bought since 2019 and the ownership is frequently not obvious from the name over the door — which is exactly what the CMA's review was about." },
                { question: "Why does it matter who owns you?", answer: "Because ownership decides whether a price is set here or at a head office, whether referrals go to the group's own hospital, and whether a ten-minute consultation becomes the target. We are not saying corporate practices are bad vets. We are saying you should be able to find out, in one click, and mostly you cannot." },
                { question: "Will I see the same vet?", answer: "Almost always, and you can ask for one by name at no extra cost. There are two of us, so the worst case is the other one, who will have read the notes." },
                { question: "What happens out of hours?", answer: "One of us is on call, from here, every night and every weekend. Not an outsourced service in Lincoln forty minutes away — that is what most practices this size now use and it is the single biggest difference between us and them." },
                { question: "Do you do payment plans?", answer: "Yes, for anything over £300, interest free, agreed before the treatment rather than after the bill. Ask — it is not a special favour and about one client in nine is on one." },
                { question: "Can I get a price before I come in?", answer: "Ring and ask, and there is no charge for asking. Routine prices are on this page and the services page; anything surgical gets a written itemised estimate before we book it." },
                { question: "Do you see farm animals?", answer: "Callum does — cattle and sheep, on farm, Tuesday and Thursday mornings. Not horses, and the nearest equine practice is in Horncastle." },
              ]} />
            </div>
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
