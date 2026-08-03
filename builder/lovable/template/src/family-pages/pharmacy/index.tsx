// pharmacy — PRESCRIPTIONS-AND-SERVICES-FIRST, as a bento of the four doors.
//
// WHEN THE PHARMACIST IS ACTUALLY ON THE PREMISES is the fact this page exists
// to give. A pharmacy can be open with the counter staffed and nobody able to
// hand over a prescription, and somebody making a journey for one deserves to
// know. No chain publishes it.
//
// THE URGENT ROUTE IS HERE because a pharmacy is where people go when the
// surgery is shut, and telling them what can and cannot be dealt with over
// this counter is more useful than a shelf of vitamins.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { BentoGrid } from "@/components/ui/bento-grid";
import { TriageBanner } from "@/components/ui/triage-banner";
import { OpeningHours } from "@/components/ui/opening-hours";
import { CounterServices } from "@/components/ui/counter-services";
import { MediaGrid } from "@/components/ui/media-grid";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/")({ component: P });

const HOURS = [
  { day: 1, label: "Monday", open: "08:30", close: "18:30" },
  { day: 2, label: "Tuesday", open: "08:30", close: "18:30" },
  { day: 3, label: "Wednesday", open: "08:30", close: "18:30" },
  { day: 4, label: "Thursday", open: "08:30", close: "18:30" },
  { day: 5, label: "Friday", open: "08:30", close: "18:30" },
  { day: 6, label: "Saturday", open: "09:00", close: "13:00" },
  { day: 0, label: "Sunday", open: null, close: null },
];

const COUNTER = [
  { what: "Dispensing NHS and private prescriptions", hours: "Whenever the pharmacist is in — see the panel", detail: "Most items in under ten minutes if we hold them. We will tell you honestly when it is a next-day item rather than ask you to wait." },
  { what: "Pharmacy First — seven conditions treated here", hours: "09:00 – 17:30, weekdays", price: "Free on the NHS", detail: "Earache, sore throat, sinusitis, impetigo, shingles, infected insect bites and urinary infections in women 16–64. We can supply antibiotics for these without a GP." },
  { what: "Blood pressure check", price: "Free", detail: "Over 40 and no appointment. Takes five minutes and about one in eight people we check is referred to a GP for something they had no idea about." },
  { what: "Emergency contraception", hours: "Whenever the pharmacist is in", price: "Free under 25, £28 otherwise", detail: "In the consultation room, no appointment, no questions beyond the clinical ones." },
  { what: "Flu and COVID vaccination", hours: "September to January", price: "Free if eligible, £18 otherwise" },
  { what: "Travel vaccinations", hours: "By appointment, Thursdays", detail: "Book six weeks before travelling. Some courses need three visits and people leave it far too late." },
  { what: "Sharps and unused medicine disposal", price: "Free", detail: "Bring anything back, including controlled drugs and somebody's whole cabinet after a bereavement. There is never a charge and never a question." },
  { what: "Delivery to the house", price: "Free within S6 and S35", detail: "Tuesday and Friday afternoons. Ask at the counter — it is not advertised and about a hundred households use it." },
];

function Tile({ title, body, href, cta }: { title: string; body: string; href: string; cta: string }) {
  return (
    <div className="flex h-full flex-col">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
      <a className="mt-4 inline-block text-sm font-medium underline underline-offset-4" href={href}>{cta}</a>
    </div>
  );
}

function P() {
  return (
    <SiteChrome
      name="Walkley Pharmacy"
      tagline="An independent pharmacy on South Road. Same family since 1961."
      links={[
        { label: "Services", href: "#/services" },
        { label: "Repeat prescriptions", href: "#/repeat" },
        { label: "Questions", href: "#questions" },
      ]}
      action={{ label: "Order a repeat", href: "#/repeat" }}
    >
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance">
            Four things people come in for
          </h1>
          <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
            And a great deal more that can be dealt with here than most people realise — seven
            conditions get treated over this counter, free, with no GP appointment at all.
          </p>

          <div className="mt-10">
            <BentoGrid
              items={[
                {
                  span: 2,
                  content: (
                    <Tile
                      title="Order a repeat prescription"
                      body="Online, at the counter, or ring 0114 234 1180. Allow two working days for the surgery and one for us. We will text you when it is ready rather than leave you guessing."
                      href="#/repeat"
                      cta="Order or check a repeat"
                    />
                  ),
                },
                {
                  tall: true,
                  content: (
                    <div className="flex h-full flex-col">
                      <h3 className="text-lg font-semibold">When the pharmacist is in</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        A prescription cannot be handed over without one, and no chain publishes
                        this. Currently: every hour we are open, and the counter never opens without
                        cover.
                      </p>
                      <div className="mt-4">
                        <OpeningHours days={HOURS} />
                      </div>
                    </div>
                  ),
                },
                {
                  content: (
                    <Tile
                      title="Pharmacy First"
                      body="Seven conditions treated here, free, no appointment — earache, sore throat, sinusitis, impetigo, shingles, infected bites, and UTIs in women 16 to 64."
                      href="#/services"
                      cta="What we can treat"
                    />
                  ),
                },
                {
                  content: (
                    <Tile
                      title="Vaccinations and checks"
                      body="Flu, COVID, travel courses and a free blood-pressure check for anybody over 40. The blood-pressure one takes five minutes and finds something surprisingly often."
                      href="#/services"
                      cta="All services"
                    />
                  ),
                },
                {
                  span: 2,
                  content: (
                    <Tile
                      title="Bring anything back"
                      body="Unused medicines, sharps, and the whole cabinet after a bereavement. Free, always, no questions and no forms. It is the safest thing you can do with them and it is what we are here for."
                      href="#/services"
                      cta="Disposal and everything else"
                    />
                  ),
                },
              ]}
            />
          </div>
        </div>
      </section>

      {/* THE CONSULTING ROOM, WHICH IS THE WHOLE CLAIM. "We have a private
          consultation room" is on every pharmacy's website and it can mean a
          curtained corner. A photograph of a door that shuts is the difference
          between somebody asking about a contraceptive or a mental health
          referral and somebody deciding not to at the counter, in a queue. */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <MediaGrid
            columns={3}
            ratio="4/3"
            items={[
              { src: null, alt: "The consultation room with the door open — a desk, two chairs, a sink", caption: "A room with a door that shuts. Not a curtain, not a corner." },
              { src: null, alt: "The dispensary from the counter, robot and shelving behind", caption: "Where your prescription actually is. Usually 20 minutes, never 'come back tomorrow'." },
              { src: null, alt: "The shop front on a wet evening, lit, open sign showing", caption: "Open until seven, and until one on Saturday. The rota is on the door." },
            ]}
          />
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <SectionHeader
            eyebrow="If the surgery is shut"
            title="What we can do, and what we cannot"
            description="A pharmacy is where people go at half past five on a Friday. Saying which of those journeys is worth making is the most useful thing on this page."
          />
          <div className="mt-8">
            <TriageBanner
              heading="Right now"
              levels={[
                { when: "Chest pain, difficulty breathing, a stroke, severe bleeding", action: "Call 999. Do not come here", tel: "999", note: "We have no equipment for any of this and the ambulance is faster than we are." },
                { when: "You have run out of an essential medicine and the surgery is shut", action: "Come in — we can often supply an emergency amount", note: "Bring the box or a repeat slip. Insulin, inhalers and epilepsy medicines especially: do not go without." },
                { when: "Earache, sore throat, shingles, a UTI, an infected bite", action: "Come in and ask for Pharmacy First", note: "Free, no appointment, and we can supply antibiotics where they are needed." },
                { when: "You are not sure how urgent it is", action: "Ring 111, any hour, free", tel: "111", note: "They can send you back to us if that is the right answer, and they often do." },
              ]}
            />
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <SectionHeader eyebrow="Everything" title="What you can actually do at this counter" />
          <div className="mt-8">
            <CounterServices
              services={COUNTER}
              heading="What you can do here"
              note="Anything marked free is free to you — the NHS pays us. There is no charge to ask about any of it and no obligation to buy anything."
            />
          </div>
        </div>
      </section>

      <section id="questions">
        <div className="mx-auto max-w-3xl px-6 py-14">
          <SectionHeader title="What people ask" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Can I speak to the pharmacist privately?",
                  answer:
                    "Always. There is a consultation room and you only have to say you would rather talk in there. Nobody will ask you why in front of a queue.",
                },
                {
                  question: "Do I have to pay for prescriptions?",
                  answer:
                    "£9.90 an item unless you are exempt — under 16, over 60, pregnant, on certain benefits, or with one of a list of conditions. If you pay for more than eleven items a year a prepayment certificate saves money and we will work it out with you.",
                },
                {
                  question: "Can you tell me if a medicine interacts with something?",
                  answer:
                    "Yes, and it is free, and it is one of the most useful things we do. Bring everything including supplements and anything bought over the counter.",
                },
                {
                  question: "Are you closing?",
                  answer:
                    "No. A lot of independents have and it is a fair question. We are not for sale, the family still owns it, and the NHS contract runs to 2031.",
                },
              ]}
            />
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
