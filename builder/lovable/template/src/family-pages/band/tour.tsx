// band /tour — every date, past and future, with the on-sale times and the
// venue's age policy.
//
// THE AGE POLICY IS THE VENUE'S AND IT VARIES PER DATE. A fifteen-year-old
// travelling to a show that turns out to be 18+ is the worst thing a tour page
// can cause, and it is entirely preventable — the band knows, the page just has
// to say.
//
// PAST DATES ARE KEPT, because a tour history is what a promoter in a new city
// asks for, and it is what tells a fan whether this band comes round often.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { TourDates } from "@/components/ui/tour-dates";
import { TicketTiers } from "@/components/ui/ticket-tiers";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/tour")({ component: P });

const UPCOMING = [
  { key: "1", date: "2026-09-12", city: "Sheffield", venue: "The Leadmill · 14+ with an adult", status: "few" as const, href: "#tickets" },
  { key: "2", date: "2026-09-13", city: "Manchester", venue: "Band on the Wall · 14+ with an adult", status: "soldout" as const },
  { key: "3", date: "2026-09-19", city: "Leeds", venue: "Brudenell Social Club · 14+ with an adult", status: "onsale" as const, href: "#tickets" },
  { key: "4", date: "2026-09-20", city: "Newcastle", venue: "The Cluny · 18+", status: "onsale" as const, href: "#tickets" },
  { key: "5", date: "2026-09-26", city: "Glasgow", venue: "King Tut's · 18+", status: "few" as const, href: "#tickets" },
  { key: "6", date: "2026-10-03", city: "Bristol", venue: "The Louisiana · cancelled by the venue", status: "cancelled" as const },
  { key: "7", date: "2026-10-10", city: "London", venue: "The Windmill, Brixton · 18+", status: "onsale" as const, href: "#tickets" },
  { key: "8", date: "2026-11-21", city: "Hebden Bridge", venue: "The Trades Club · all ages", status: "onsale" as const, href: "#tickets" },
];

const PAST = [
  { key: "p1", date: "2026-05-24", city: "Sheffield", venue: "Sidney & Matilda", status: "soldout" as const },
  { key: "p2", date: "2026-04-18", city: "Leeds", venue: "Hyde Park Book Club", status: "soldout" as const },
  { key: "p3", date: "2026-03-08", city: "Nottingham", venue: "The Bodega", status: "onsale" as const },
  { key: "p4", date: "2026-02-14", city: "Sheffield", venue: "The Greystones", status: "soldout" as const },
  { key: "p5", date: "2025-11-30", city: "Bakewell", venue: "The Medway Centre", status: "onsale" as const },
];

function P() {
  return (
    <SiteChrome
      name="The Long Room"
      tagline="Every date, the age policy, and what a ticket costs."
      links={[
        { label: "Home", href: "/" },
        { label: "Listen", href: "/listen" },
      ]}
      action={{ label: "Listen first", href: "/listen" }}
    >
      <div className="mx-auto max-w-5xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">Tour</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Every date carries the venue's age policy, because it varies and it is the venue's rule
          rather than ours. Somebody of fifteen travelling to Newcastle for an 18+ room is the worst
          thing this page could cause.
        </p>

        <section className="mt-12">
          <SectionHeader eyebrow="Autumn 2026" title="Eight dates" />
          <div className="mt-8">
            <TourDates dates={UPCOMING} cta="Tickets" />
          </div>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Manchester sold out in nine days. Bristol was cancelled by the venue — everybody who
            bought has been refunded automatically and we are looking for another room in the city.
          </p>
        </section>

        <section className="mt-14" id="tickets">
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader
                eyebrow="What a ticket costs"
                title="£14, and the fee is in it"
                description="The advertised price is the price you pay. We eat the booking fee rather than adding £3.20 at the last screen, which is a small amount of money and a large amount of goodwill."
              />
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Fifteen tickets a show are held back at £8 for anybody who genuinely cannot afford
                £14. No proof and no questions — email and they are yours. It is not charity, it is
                how a room ends up with the people who want to be in it.
              </p>
            </div>
            <TicketTiers
              tiers={[
                { key: "std", label: "Standing", price: 14, note: "Booking fee included. No fee added at checkout." },
                { key: "conc", label: "Supported ticket", price: 8, note: "No questions asked. Email hello@thelongroom.band.", remaining: 15 },
                { key: "bundle", label: "Ticket and the record", price: 22, note: "Collect on the night. Cheaper than either separately.", remaining: 40 },
                { key: "guest", label: "Guest list", price: 0, soldOut: true, note: "Full for Sheffield. There are twelve and they go to people who put us on." },
              ]}
              quantities={{ std: 2, conc: 0, bundle: 0, guest: 0 }}
              onQuantity={() => {}}
              cta="Get tickets"
              lowAt={20}
            />
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="Already played"
            title="The last year"
            description="Kept, because a promoter in a new city asks for exactly this and because it tells somebody whether we come round often."
          />
          <div className="mt-8">
            <TourDates dates={PAST} showPast cta="Past" />
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader title="Tour questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "What time are you on?",
                  answer:
                    "Doors 19:30, support 20:15, us at 21:00, off by 22:15. Every show, unless the venue has a club night after — Leeds and Glasgow both do, and we are on at 20:30 there.",
                },
                {
                  question: "Is there a support band?",
                  answer:
                    "Always, and we book them ourselves. Wire the North on the northern dates, and somebody local everywhere else. Turn up for them; that is most of the point of a small show.",
                },
                {
                  question: "Can I bring a camera?",
                  answer: "Anything you can carry, including a proper one. Film all of it if you like. We would only ask you not to hold a phone up for the whole set out of consideration for whoever is behind you.",
                },
                {
                  question: "Is the venue accessible?",
                  answer:
                    "It varies enormously and we cannot fix it. The Leadmill, Brudenell and the Trades Club are all step-free with accessible toilets. The Windmill and King Tut's are not. Email us and we will tell you honestly about any room on the list.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="/">The next date</a>
            {" · "}
            <a className="underline underline-offset-4" href="/listen">The records</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
