// housing-association — REPORT-A-REPAIR-FIRST, as a bento grid of the four
// doors tenants actually come for.
//
// A SOCIAL LANDLORD'S SITE IS USED BY PEOPLE WITH A PROBLEM. Nobody browses
// one. The four things are: report a repair, pay rent, reach somebody out of
// hours, and complain — and the last of those is the one every landlord buries,
// which is precisely why ombudsman cases exist. It gets a tile the same size as
// the others.
//
// THE OUT-OF-HOURS NUMBER IS ON EVERY PAGE, because "no heating on a Sunday in
// January with a baby in the house" is the case this site exists for.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { BentoGrid } from "@/components/ui/bento-grid";
import { TriageBanner } from "@/components/ui/triage-banner";
import { ContactCard } from "@/components/ui/contact-card";
import { MediaGrid } from "@/components/ui/media-grid";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/")({ component: P });

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
      name="Loxley Valley Housing"
      tagline="1,840 homes across north-west Sheffield. A charitable community benefit society."
      links={[
        { label: "Repairs", href: "/repairs" },
        { label: "Rent and tenancy", href: "/tenancy" },
        { label: "Questions", href: "#questions" },
      ]}
      action={{ label: "Report a repair", href: "/repairs" }}
    >
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance">
            Four things, none of them more than a click away
          </h1>
          <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
            Nobody browses a landlord's website. You are here because something needs doing, so
            here are the four things people come for — including how to complain, which gets the
            same space as the rest.
          </p>

          <div className="mt-10">
            <BentoGrid
              items={[
                {
                  span: 2,
                  content: (
                    <Tile
                      title="Report a repair"
                      body="Online any hour, or 0114 288 6100 in office hours. Emergencies are attended within 4 hours, everything else within 20 working days — and both of those are promises we publish performance against."
                      href="/repairs"
                      cta="Report or track a repair"
                    />
                  ),
                },
                {
                  content: (
                    <Tile
                      title="Pay rent"
                      body="Direct debit, card, or at any PayPoint. Behind? Ring before it grows — nobody has ever been evicted by this association for arrears where an arrangement was being kept to."
                      href="/tenancy"
                      cta="Ways to pay, and help with arrears"
                    />
                  ),
                },
                {
                  content: (
                    <Tile
                      title="Out of hours"
                      body="0114 288 6199, every hour of every day, answered by a person in Sheffield rather than a call centre. Emergencies only — see the list below for what counts."
                      href="tel:01142886199"
                      cta="Ring the emergency line"
                    />
                  ),
                },
                {
                  span: 2,
                  content: (
                    <Tile
                      title="Complain"
                      body="Two stages, ten working days each, then the Housing Ombudsman — free, independent, and you can go to them directly at any point. We publish every complaint outcome in the annual report, including the ones we lost."
                      href="/tenancy"
                      cta="How to complain properly"
                    />
                  ),
                },
                {
                  content: (
                    <Tile
                      title="Something else"
                      body="Ending a tenancy, a mutual exchange, permission for a pet or a shed, adding somebody to a tenancy. All of it starts with the same phone number."
                      href="/tenancy"
                      cta="Tenancy matters"
                    />
                  ),
                },
              ]}
            />
          </div>
        </div>
      </section>

      {/* THE HOMES, AND A FINISHED REPAIR. A social landlord photographing
          only its new-build showpiece is telling its existing tenants that
          their block is not the part it is proud of. So: the 1960s block as
          well as the new terrace, and a completed damp job — because damp is
          the repair this sector is judged on and a photograph of one done
          properly is worth more than a policy page about it. */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <MediaGrid
            columns={4}
            ratio="4/3"
            items={[
              { src: null, alt: "The Wisewood low-rise blocks from the green, balconies and drying lines", caption: "Wisewood, 1964. 212 flats — the largest thing we own." },
              { src: null, alt: "New terraced houses on Loxley Road, brick and grey window frames", caption: "Loxley Road, finished 2024. Eighteen homes, all social rent." },
              { src: null, alt: "A bedroom wall after damp work — replastered, repainted, furniture back", caption: "A completed damp job. Two visits, eleven days, and the tenant stayed in." },
              { src: null, alt: "A van and two operatives outside a block, ladders on the roof rack", caption: "Nine of our own trades. About 70% of repairs never go to a contractor." },
            ]}
          />
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <SectionHeader
            eyebrow="Out of hours"
            title="What actually counts as an emergency"
            description="Written plainly, because the alternative is somebody deciding at eleven at night whether their situation is serious enough to ring. If in doubt, ring."
          />
          <div className="mt-8">
            <TriageBanner
              heading="If it is happening now"
              levels={[
                {
                  when: "You can smell gas",
                  action: "Ring the National Gas Emergency Service before anybody else",
                  tel: "0800 111 999",
                  note: "Open the windows, do not touch a switch, get everybody out. Then ring us.",
                },
                {
                  when: "No heating or hot water, October to April",
                  action: "Ring the emergency line",
                  tel: "0114 288 6199",
                  note: "Attended within 4 hours. Temporary heaters brought if the fix will take longer.",
                },
                {
                  when: "Water coming through a ceiling, or a burst pipe",
                  action: "Ring the emergency line",
                  tel: "0114 288 6199",
                  note: "The stopcock is usually under the kitchen sink. Turning it off is the useful thing to do while waiting.",
                },
                {
                  when: "A door or window that will not lock, or has been forced",
                  action: "Ring the emergency line — police first if it has just happened",
                  tel: "0114 288 6199",
                  note: "Boarded or made secure the same night, and properly repaired within five days.",
                },
                {
                  when: "A dripping tap, a broken cupboard, a blown light bulb",
                  action: "Report it online — this is not an emergency",
                  note: "Twenty working days. Ringing the emergency line for these is what makes it slower for the person with no heating.",
                },
              ]}
            />
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <SectionHeader
            eyebrow="How we are doing"
            title="Published quarterly, including the bad quarters"
            description="Required by the regulator's tenant satisfaction measures, and we would publish them anyway."
          />
          <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-4xl font-semibold tabular-nums">94%</p>
              <p className="mt-1 text-sm text-muted-foreground">Emergency repairs inside 4 hours</p>
            </div>
            <div>
              <p className="text-4xl font-semibold tabular-nums">81%</p>
              <p className="mt-1 text-sm text-muted-foreground">Routine repairs inside 20 days</p>
            </div>
            <div>
              <p className="text-4xl font-semibold tabular-nums">11 days</p>
              <p className="mt-1 text-sm text-muted-foreground">Average complaint response, stage one</p>
            </div>
            <div>
              <p className="text-4xl font-semibold tabular-nums">100%</p>
              <p className="mt-1 text-sm text-muted-foreground">Homes with a valid gas safety certificate</p>
            </div>
          </div>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            The 81% is below our own target of 90% and has been for three quarters. It is a
            contractor capacity problem, we have said so to the board in public, and the plan is in
            the last annual report.
          </p>
        </div>
      </section>

      <section id="questions">
        <div className="mx-auto max-w-3xl px-6 py-14">
          <div className="grid items-start gap-10 md:grid-cols-[1.2fr_1fr]">
            <div>
              <SectionHeader title="What tenants ask" />
              <div className="mt-6">
                <Faq
                  items={[
                    {
                      question: "Can I decorate, or put up a shed?",
                      answer:
                        "Decorate freely. A shed, a fence, a satellite dish or a new kitchen needs written permission, which is a form and about ten days. It is almost always granted and doing it without asking can be charged for.",
                    },
                    {
                      question: "Can I keep a pet?",
                      answer:
                        "One dog or two cats in a house with a garden, with permission. Flats are more restricted and it depends on the block. Assistance dogs are never refused anywhere.",
                    },
                    {
                      question: "How do I swap homes with another tenant?",
                      answer:
                        "A mutual exchange, through HomeSwapper — free for our tenants. We have to approve it and can only refuse on specific legal grounds, which we would have to put in writing.",
                    },
                    {
                      question: "Who is responsible for what?",
                      answer:
                        "We do the structure, the roof, the heating, the wiring and anything we installed. You do bulbs, batteries, plugs, internal decoration and blocked sinks caused by use. The tenancy agreement lists it and the repairs page repeats it.",
                    },
                  ]}
                />
              </div>
            </div>
            <ContactCard
              address="Rivelin Works, Holme Lane, Sheffield S6 4JQ"
              phone="0114 288 6100"
              email="hello@loxleyvalleyhousing.org.uk"
              mapUrl="https://www.openstreetmap.org/search?query=Holme%20Lane%20Sheffield"
            />
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
