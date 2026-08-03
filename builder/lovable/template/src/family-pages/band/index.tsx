// band — TOUR-DATES-FIRST: the next date and the ticket link in the first
// screen.
//
// A BAND'S SITE HAS ONE JOB and it is not the biography. Somebody arriving has
// heard a song and wants to know when they can see it played; every band site
// opens with a moody photograph and puts the dates behind a menu. The photograph
// is here — it is the full-bleed hero — with the date written over it.
//
// A SOLD-OUT DATE STAYS LISTED AND SAYS SOLD OUT. Removing it makes a tour look
// half-booked and leaves a fan who was there wondering if they imagined it. It
// is also the strongest thing on the page.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { TourDates } from "@/components/ui/tour-dates";
import { AudioPlayer } from "@/components/ui/audio-player";
import { PressQuote } from "@/components/ui/press-quote";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/")({ component: P });

const DATES = [
  { key: "1", date: "2026-09-12", city: "Sheffield", venue: "The Leadmill", status: "few" as const, href: "#/tour" },
  { key: "2", date: "2026-09-13", city: "Manchester", venue: "Band on the Wall", status: "soldout" as const },
  { key: "3", date: "2026-09-19", city: "Leeds", venue: "Brudenell Social Club", status: "onsale" as const, href: "#/tour" },
  { key: "4", date: "2026-09-20", city: "Newcastle", venue: "The Cluny", status: "onsale" as const, href: "#/tour" },
  { key: "5", date: "2026-09-26", city: "Glasgow", venue: "King Tut's", status: "few" as const, href: "#/tour" },
  { key: "6", date: "2026-10-03", city: "Bristol", venue: "The Louisiana", status: "cancelled" as const },
];

function P() {
  return (
    <SiteChrome
      name="The Long Room"
      tagline="Four people from Sheffield. Second record out in September."
      links={[
        { label: "Tour", href: "#/tour" },
        { label: "Listen", href: "#/listen" },
        { label: "Questions", href: "#questions" },
      ]}
      action={{ label: "Get tickets", href: "#/tour" }}
    >
      {/* THE HERO IS THE NEXT DATE, over the photograph rather than beneath it. */}
      <section className="border-b border-border bg-muted/30">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Next · Saturday 12 September
          </p>
          <h1 className="mt-4 text-7xl font-semibold leading-[0.98] tracking-tight text-balance">
            The Leadmill,<br />Sheffield
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Doors at 19:30, on at 21:00, with Wire the North opening. Fewer than thirty tickets left
            and it will go — the last two Sheffield shows both sold out on the day.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a className="rounded-md bg-primary px-6 py-3 text-base font-medium text-primary-foreground" href="#/tour">
              Tickets, £14
            </a>
            <a className="rounded-md border border-border px-6 py-3 text-base font-medium" href="#/listen">
              Hear something first
            </a>
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <SectionHeader
            eyebrow="The tour"
            title="Six dates, and two of them you cannot get into"
            description="Sold out and cancelled both stay on the list. A tour that quietly deletes its full nights looks half-booked, and somebody checking wants exactly this answer."
          />
          <div className="mt-8">
            <TourDates dates={DATES} cta="Tickets" />
          </div>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Bristol was cancelled by the venue rather than by us and everybody who bought has been
            refunded automatically — no form, no email to send. We are trying to find another room
            in the city for October.{" "}
            <a className="underline underline-offset-4" href="#/tour">Every date, with on-sale times.</a>
          </p>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <div className="grid items-start gap-10 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <SectionHeader
                eyebrow="Listen"
                title="One song, the whole thing"
                description="Not a thirty-second clip. If it is not worth three and a half minutes of your time it is not worth £14 and a Saturday night."
              />
              <div className="mt-6">
                <AudioPlayer src="/audio/the-long-room-holme-lane.mp3" title="Holme Lane — from the second record" />
              </div>
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Recorded live in one room at Yellow Arch in Neepsend, three takes, second one used.
                The rest of the record is on the listen page along with where to buy it in a form
                that pays us more than streaming does.
              </p>
            </div>
            <div className="space-y-5">
              <PressQuote
                quote="Four people playing in a room, recorded like it. The most convincing British guitar record of the year so far."
                source="Uncut"
              />
              <PressQuote
                quote="Nothing here is trying to be bigger than it is, which is exactly why it works."
                source="The Quietus"
              />
              <PressQuote
                quote="Best live band in Sheffield and it is not close."
                source="Now Then"
              />
            </div>
          </div>
        </div>
      </section>

      <section id="questions">
        <div className="mx-auto max-w-3xl px-6 py-14">
          <SectionHeader title="What people message about" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Are the shows all-ages?",
                  answer:
                    "It depends entirely on the venue and we cannot change it. The Leadmill and Brudenell are 14+ with an adult; King Tut's and The Cluny are 18+. Each date on the tour page says which.",
                },
                {
                  question: "Will you come to my town?",
                  answer:
                    "If somebody asks. Genuinely — half this tour exists because a promoter or a person emailed. There is nowhere too small and we have played a village hall in Derbyshire twice.",
                },
                {
                  question: "Where does the money go if I buy the record from you?",
                  answer:
                    "About £8 of a £12 record, against roughly £0.003 a stream. We are not going to guilt anybody about streaming — it is how most people hear us — but that is the arithmetic if you were wondering.",
                },
                {
                  question: "Can we support you?",
                  answer:
                    "Send us something. We book our own openers on every headline show and we would rather it were a local band than an agent's suggestion. We listen to all of it, slowly.",
                },
              ]}
            />
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
