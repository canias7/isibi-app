// film — SCREENINGS-FIRST: the trailer, then where it is actually showing.
//
// AN INDEPENDENT FILM'S SITE IS A LIST OF LAURELS AND NO SHOWTIMES. The one
// thing a person who has just watched the trailer wants is somewhere near them
// to see it, and festival selections do not answer that. The dates go directly
// under the trailer with the Q&A ones marked, because a screening with the
// director in it is a different evening and people will travel for it.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { VideoEmbed } from "@/components/ui/video-embed";
import { TourDates } from "@/components/ui/tour-dates";
import { PressQuote } from "@/components/ui/press-quote";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/")({ component: P });

const NEXT = [
  { key: "1", date: "2026-08-14", city: "Sheffield", venue: "Showroom Cinema · Q&A with the director", status: "few" as const, href: "/screenings" },
  { key: "2", date: "2026-08-15", city: "Sheffield", venue: "Showroom Cinema", status: "onsale" as const, href: "/screenings" },
  { key: "3", date: "2026-08-21", city: "Leeds", venue: "Hyde Park Picture House · Q&A", status: "soldout" as const },
  { key: "4", date: "2026-08-28", city: "Manchester", venue: "HOME", status: "onsale" as const, href: "/screenings" },
  { key: "5", date: "2026-09-04", city: "Nottingham", venue: "Broadway", status: "onsale" as const, href: "/screenings" },
  { key: "6", date: "2026-09-11", city: "Hebden Bridge", venue: "Picture House · Q&A", status: "few" as const, href: "/screenings" },
];

function P() {
  return (
    <SiteChrome
      name="Ninety Works"
      tagline="A documentary about the water-powered valleys of Sheffield. 78 minutes."
      links={[
        { label: "Screenings", href: "/screenings" },
        { label: "About the film", href: "/about" },
        { label: "Questions", href: "#questions" },
      ]}
      action={{ label: "Find a screening", href: "#screenings" }}
    >
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            78 minutes · 2026 · Showing now in the north
          </p>
          <h1 className="mt-4 max-w-3xl text-6xl font-semibold leading-[1.02] tracking-tight text-balance">
            Ninety Works
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Ninety water-powered works stood on two Sheffield rivers. Almost all of them are gone
            and the weirs that fed them are still there. Filmed over three years, mostly in the rain.
          </p>

          <div className="mt-10">
            <VideoEmbed
              url="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"
              title="Ninety Works — trailer"
              ratio="16/9"
            />
          </div>
        </div>
      </section>

      {/* THE SCREENINGS, DIRECTLY UNDER THE TRAILER. Not behind a menu. */}
      <section className="border-b border-border" id="screenings">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <SectionHeader
            eyebrow="Where you can see it"
            title="Six dates, three of them with a Q&A"
            description="A screening with the director in it is a different evening and people travel for it, so it is marked on the date rather than mentioned in a footnote."
          />
          <div className="mt-8">
            <TourDates dates={NEXT} cta="Book" />
          </div>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Leeds sold out in four days and the Picture House has added nothing further — we asked.
            More dates are added most weeks and every one is on the screenings page, including the
            ones that have already happened.{" "}
            <a className="underline underline-offset-4" href="/screenings">Every date, and how to request one.</a>
          </p>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <div className="grid items-start gap-10 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <SectionHeader
                eyebrow="What it is"
                title="Not nostalgia, and not a heritage film"
                description="Nobody in it says the word 'heritage'. It is about what a river does when the thing it was for stops existing, which turns out to be trees, otters and a lot of unexplained masonry."
              />
              <p className="mt-5 max-w-lg leading-relaxed text-muted-foreground">
                Twelve people talk in it — two historians, an ecologist, a man who worked at the
                last grinding hull until 1986, and eight people who walk the valleys. No
                voice-over and no reconstruction.
              </p>
              <a className="mt-6 inline-block text-sm underline underline-offset-4" href="/about">
                The runtime, the certificate and who made it
              </a>
            </div>
            <div className="space-y-5">
              <PressQuote quote="The best British documentary about landscape since Arcadia. Quietly furious about what was allowed to rot." source="Sight and Sound" />
              <PressQuote quote="Seventy-eight minutes and I would have watched three hours." source="The Yorkshire Post" />
              <PressQuote quote="A film about weirs that is somehow about everything." source="Little White Lies" />
            </div>
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
                  question: "Will it be on streaming?",
                  answer:
                    "Eventually, and we do not know when or where. It is doing the cinema run first because a room full of people is what it was made for, and a distributor deal would take that decision out of our hands.",
                },
                {
                  question: "Can we screen it at our film society?",
                  answer:
                    "Yes, and gladly. There is a flat fee of £120 for a non-commercial screening including the DCP or a file, and it is waived entirely for schools, libraries and community groups. The screenings page has the form.",
                },
                {
                  question: "Is it suitable for children?",
                  answer:
                    "PG. There is nothing distressing in it and there is a lot of talking about the 1864 flood, in which 240 people died. A ten-year-old interested in rivers would be fine; a six-year-old would be bored.",
                },
                {
                  question: "Are the locations accessible?",
                  answer:
                    "The film is not a walking guide, but people ask, so: four of the six weirs are on level surfaced paths and two are not. There is a list on the about page with the honest description of each.",
                },
              ]}
            />
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
