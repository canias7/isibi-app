// film /about — the runtime, the certificate, who made it, and what is in it.
//
// THE CONTENT NOTE IS SPECIFIC. "Contains themes some viewers may find
// upsetting" tells nobody anything. Naming the 1864 flood, the 240 dead and the
// two minutes of archive photographs lets a person decide, which is what a
// content note is for and almost never does.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { VideoEmbed } from "@/components/ui/video-embed";
import { SafeImage } from "@/components/ui/safe-image";
import { PressQuote } from "@/components/ui/press-quote";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/about")({ component: P });

const FACTS = [
  { k: "Runtime", v: "78 minutes" },
  { k: "Certificate", v: "PG (BBFC), 2026" },
  { k: "Language", v: "English, with optional English subtitles on every print" },
  { k: "Audio description", v: "On every DCP we distribute" },
  { k: "Aspect", v: "1.85:1" },
  { k: "Shot on", v: "Digital, three years, mostly in rain" },
  { k: "Director", v: "Nadia Ellinthorpe" },
  { k: "Producer", v: "Sam Okonjo" },
  { k: "Cinematographer", v: "Nadia Ellinthorpe" },
  { k: "Editor", v: "Priya Chandran" },
  { k: "Sound", v: "Recorded on location. No library effects and no reconstruction" },
  { k: "Funded by", v: "BFI Doc Society, Sheffield City Council, and 411 people" },
];

const WHO = [
  { who: "Eleanor Hartley", what: "Industrial archaeologist, Sheffield Hallam. Has surveyed most of the surviving weirs." },
  { who: "Jakob Voss", what: "Worked at the last operating grinding hull on the Loxley until it closed in 1986." },
  { who: "Ruth Marrow", what: "Ecologist. Talks about what came back — otters, dippers, and the trees nobody planted." },
  { who: "Margaret Firth", what: "Great-granddaughter of two people who died in the 1864 flood. Reads the list of names." },
  { who: "Eight walkers", what: "People who use the valleys now. Deliberately not experts, and the best thing in the film." },
];

function P() {
  return (
    <SiteChrome
      name="Ninety Works"
      tagline="78 minutes, PG, and exactly what is in it."
      links={[
        { label: "Home", href: "#/" },
        { label: "Screenings", href: "#/screenings" },
      ]}
      action={{ label: "Find a screening", href: "#/screenings" }}
    >
      <div className="mx-auto max-w-5xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">About the film</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Ninety water-powered works stood on the Don and the Loxley. This is about the gap between
          that and now, told by twelve people, with no voice-over and nothing reconstructed.
        </p>

        <section className="mt-12">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="The facts" title="Everything a listing needs" />
              <ul className="mt-6 divide-y divide-border border-y border-border text-sm">
                {FACTS.map((f) => (
                  <li key={f.k} className="grid gap-1 py-3 sm:grid-cols-[minmax(0,10rem)_1fr] sm:gap-4">
                    <span className="text-muted-foreground">{f.k}</span>
                    <span>{f.v}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <SafeImage
                src={null}
                alt="A weir on the Loxley in flood, filmed from the bank"
                ratio="4/3"
                fallbackSeed="ninety"
              />
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                The Loxley in February. About a third of the film was shot in weather that made the
                camera unusable within twenty minutes, which is the honest reason it took three
                years.
              </p>
              <div className="mt-6">
                <VideoEmbed url="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" title="Ninety Works — trailer" />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="Content note"
            title="Specifically, so you can decide"
            description="'Contains themes some viewers may find upsetting' tells nobody anything. Here is what is actually in it."
          />
          <div className="mt-8 max-w-3xl rounded-xl border-2 border-foreground p-6">
            <ul className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">The 1864 Sheffield flood.</span> The
                dam burst and 240 people died. It occupies about eleven minutes, includes a reading
                of some of the names, and is the emotional centre of the film.
              </li>
              <li>
                <span className="font-medium text-foreground">Archive photographs of the aftermath.</span>{" "}
                About two minutes. Ruined houses and bodies laid out in a school hall — the images
                are Victorian and indistinct, and they are still what they are.
              </li>
              <li>
                <span className="font-medium text-foreground">Industrial injury.</span> One
                interviewee describes losing two fingers at the grinding wheel, in his own words,
                for about ninety seconds. No images.
              </li>
              <li>
                <span className="font-medium text-foreground">Deep water, filmed close to.</span>{" "}
                Several long shots from the bank of water going over a weir. Nobody enters it.
              </li>
              <li>
                <span className="font-medium text-foreground">Nothing else.</span> No violence, no
                language, no flashing imagery, and no animals harmed or shown injured.
              </li>
            </ul>
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="Who talks in it"
            title="Twelve people, eight of them not experts"
            description="The walkers are the best thing in it, which was not the plan and became obvious in the edit."
          />
          <ul className="mt-8 divide-y divide-border border-y border-border">
            {WHO.map((w) => (
              <li key={w.who} className="grid gap-1 py-4 md:grid-cols-[minmax(0,13rem)_1fr] md:gap-6">
                <p className="font-medium">{w.who}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{w.what}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-14">
          <div className="grid items-start gap-10 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <SectionHeader title="Questions about the film" />
              <div className="mt-6">
                <Faq
                  items={[
                    {
                      question: "Is it a heritage film?",
                      answer:
                        "Nobody in it says the word. It is about what a landscape does when the purpose it was shaped for disappears, and the answer here is trees, otters and a lot of unexplained masonry.",
                    },
                    {
                      question: "Where can I walk the route?",
                      answer:
                        "The Five Weirs Walk covers the Don through the city and is surfaced and step-free throughout. The Loxley sections in the film are rougher and two are genuinely steep — there is a note in the press kit.",
                    },
                    {
                      question: "Who funded it?",
                      answer:
                        "BFI Doc Society, Sheffield City Council's culture fund, and 411 people who put in between £5 and £500. Everybody in that last group is in the credits and got a ticket.",
                    },
                    {
                      question: "Is there a book?",
                      answer:
                        "No, and there probably should be. Eleanor Hartley's survey of the weirs is published by the university press and is the thing to read next.",
                    },
                  ]}
                />
              </div>
            </div>
            <div className="space-y-5">
              <PressQuote quote="Quietly furious about what was allowed to rot." source="Sight and Sound" />
              <PressQuote quote="A film about weirs that is somehow about everything." source="Little White Lies" />
            </div>
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="#/">The trailer</a>
            {" · "}
            <a className="underline underline-offset-4" href="#/screenings">Where it is showing</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
