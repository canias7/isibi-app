// film /screenings — every date, past and future, plus how to request one.
//
// THE PAST RUN IS THE ASSET. A programmer at a cinema deciding whether to book
// an independent documentary wants to know it filled a room somewhere else, and
// a site that deletes finished dates has thrown away its only evidence. It is
// also what a funder asks for.
//
// AND THE REQUEST ROUTE IS A REAL PRICE, not "contact us". A film society
// treasurer needs a number to put to a committee.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { TourDates } from "@/components/ui/tour-dates";
import { TicketTiers } from "@/components/ui/ticket-tiers";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/screenings")({ component: P });

const UPCOMING = [
  { key: "1", date: "2026-08-14", city: "Sheffield", venue: "Showroom · Q&A with the director", status: "few" as const, href: "#tickets" },
  { key: "2", date: "2026-08-15", city: "Sheffield", venue: "Showroom", status: "onsale" as const, href: "#tickets" },
  { key: "3", date: "2026-08-21", city: "Leeds", venue: "Hyde Park Picture House · Q&A", status: "soldout" as const },
  { key: "4", date: "2026-08-28", city: "Manchester", venue: "HOME", status: "onsale" as const, href: "#tickets" },
  { key: "5", date: "2026-09-04", city: "Nottingham", venue: "Broadway", status: "onsale" as const, href: "#tickets" },
  { key: "6", date: "2026-09-11", city: "Hebden Bridge", venue: "Picture House · Q&A", status: "few" as const, href: "#tickets" },
  { key: "7", date: "2026-09-18", city: "Newcastle", venue: "Tyneside Cinema", status: "onsale" as const, href: "#tickets" },
  { key: "8", date: "2026-10-02", city: "Glasgow", venue: "Glasgow Film Theatre", status: "onsale" as const, href: "#tickets" },
];

const PAST = [
  { key: "p1", date: "2026-06-12", city: "Sheffield", venue: "Sheffield DocFest — world premiere", status: "soldout" as const },
  { key: "p2", date: "2026-06-14", city: "Sheffield", venue: "Sheffield DocFest — second screening added", status: "soldout" as const },
  { key: "p3", date: "2026-07-03", city: "Bradford", venue: "National Science and Media Museum", status: "soldout" as const },
  { key: "p4", date: "2026-07-19", city: "Kendal", venue: "Brewery Arts", status: "onsale" as const },
  { key: "p5", date: "2026-07-26", city: "Stocksbridge", venue: "The Venue — free community screening", status: "soldout" as const },
];

function P() {
  return (
    <SiteChrome
      name="Ninety Works"
      tagline="Every screening, and how to put one on yourself."
      links={[
        { label: "Home", href: "/" },
        { label: "About the film", href: "/about" },
      ]}
      action={{ label: "Request a screening", href: "#request" }}
    >
      <div className="mx-auto max-w-5xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">Screenings</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Eight dates booked and five already played. The past ones stay on the page because they
          are the evidence — a programmer deciding whether to book an independent documentary is
          asking whether it filled a room somewhere else.
        </p>

        <section className="mt-12">
          <SectionHeader eyebrow="Booked" title="August to October" />
          <div className="mt-8">
            <TourDates dates={UPCOMING} cta="Book" />
          </div>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Tickets are sold by each cinema at their own prices — we do not set them and we take
            nothing from them. The figures below are what a cinema typically charges.
          </p>
        </section>

        <section className="mt-14" id="tickets">
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader
                eyebrow="What it costs"
                title="The cinema's prices, not ours"
                description="Every venue on the list runs its own concessions and every one of them honours a Cinema Exhibitors' Association card. Ask at the box office rather than assuming."
              />
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                The Stocksbridge screening was free and always was going to be. The film is about
                that valley and charging the people in it to watch it would have been absurd.
              </p>
            </div>
            <TicketTiers
              tiers={[
                { key: "std", label: "Standard", price: 10.5, note: "Typical independent cinema price." },
                { key: "conc", label: "Concession", price: 8.5, note: "Student, over 60, unwaged, Universal Credit." },
                { key: "cea", label: "CEA card holder", price: 0, note: "A companion goes free at every venue on this list." },
                { key: "qa", label: "Q&A screening", price: 12.5, note: "Where the director is present. About 25 minutes longer.", remaining: 30 },
              ]}
              quantities={{ std: 2, conc: 0, cea: 0, qa: 0 }}
              onQuantity={() => {}}
              cta="Book at the cinema"
              lowAt={40}
            />
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="Already played"
            title="Five, and four of them sold out"
            description="Kept deliberately. It is what a cinema programmer and a funder both ask for, and deleting it throws away the only proof the film works in a room."
          />
          <div className="mt-8">
            <TourDates dates={PAST} showPast cta="Past" />
          </div>
        </section>

        <section className="mt-14" id="request">
          <SectionHeader
            eyebrow="Put one on yourself"
            title="£120, waived for schools, libraries and community groups"
            description="A real number rather than 'contact us for licensing', because a film society treasurer needs something to take to a committee."
          />
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">What you get</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                A DCP or a ProRes file, subtitles, a poster as a PDF, and the right to charge
                admission and keep all of it. We take nothing from the door.
              </p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">When it is free</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Schools, libraries, community centres, residents' groups and anything in the Don or
                Loxley valleys. No form and no means test — just say which you are.
              </p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">A Q&A</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Free within about two hours of Sheffield, travel at cost beyond that. Ask — we have
                said yes to a village hall with forty seats and would again.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader title="Screening questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Will it come to my town?",
                  answer:
                    "If a cinema books it or somebody puts one on. Email your local independent and copy us in — that is genuinely how four of the dates above happened.",
                },
                {
                  question: "Are the venues accessible?",
                  answer:
                    "Every cinema on this list is step-free with accessible seating and an infrared or induction loop. Captioned screenings are at the Showroom on the 15th and HOME on the 28th, marked in their own listings.",
                },
                {
                  question: "Is there an audio-described version?",
                  answer:
                    "Yes, and it is in every DCP we send out. Ask the venue to enable it — it is on the disc whether or not they advertise it, and some of them do not know.",
                },
                {
                  question: "Can I show it at work?",
                  answer:
                    "For a staff event with no admission charge, yes, under the community terms. For anything commercial or client-facing, that is the £120 licence and we will invoice properly.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="/">The trailer</a>
            {" · "}
            <a className="underline underline-offset-4" href="/about">About the film</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
