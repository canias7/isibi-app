// escape-room /rooms — each room in full, and WHO IT SUITS.
//
// Difficulty labels are useless without a reference point. "Hard" compared to
// what? The escape rate is the honest number, and pairing it with "this is your
// third room, not your first" tells somebody far more than four padlock icons.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { DaySchedule } from "@/components/ui/day-schedule";
import { RatingSummary } from "@/components/ui/rating-summary";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/rooms")({ component: P });

const ROOMS = [
  {
    name: "Cutlery Patent 1913",
    shot: "The cutler's bench in daylight — files, a vice, a half-finished handle",
    shot2: "The patent drawings pinned above the bench, 1913 dates visible",
    rate: "67%",
    mins: 45,
    who: "Your first room, or anybody you are trying to convince",
    theme: "A cutler's workshop the night before a patent hearing. Bright, warm, nothing hidden in the dark.",
    detail: "Four locks, one genuinely clever mechanism, and nothing that requires crawling or reaching above your head. It is 45 minutes rather than 60 because it does not need more.",
    access: "Step-free throughout, wide doorway, everything reachable seated.",
  },
  {
    name: "The Flood",
    shot: "The dam keeper's desk at 11pm, oil lamp burning, the ledger open",
    shot2: "Water marks up the plaster, a stopped clock at 12 minutes past midnight",
    rate: "48%",
    mins: 60,
    who: "Your first or second. The best all-round room here",
    theme: "Bradfield, the night of 11 March 1864, when the dam went. Somewhat dark and genuinely a bit sad.",
    detail: "The one people talk about afterwards. Two parallel threads that have to come together, which is why it works better with four than two.",
    access: "Step-free. One low cupboard that can be searched from a seated position.",
  },
  {
    name: "The Grinding Hull",
    shot: "The grinding trough by one bulb, water still running on the stone",
    shot2: "The crawl — a low brick arch with the next room lit beyond it",
    rate: "31%",
    mins: 60,
    who: "Your third or fourth room. Physical and dark",
    theme: "A water-powered grinding shop, 1890s. Dark in two sections and there is a crawl.",
    detail: "The most hands-on room — things to turn, lift and carry. Too many locks for two people to get through in the hour, which is what the 31% is made of.",
    access: "Not accessible. A crawl through a low space and a step up onto a platform. We would rather say so.",
  },
  {
    name: "The Nightwatchman",
    shot: "The watchman's hut, four minutes to midnight, keys on the hook",
    shot2: "The board of forty numbered keys, three of them missing",
    rate: "12%",
    mins: 75,
    who: "Only if you have done about ten of these",
    theme: "1932, and somebody has been coming into the works at night. Cold, quiet, and a bit unpleasant.",
    detail: "Built to be beaten by about one group in eight. Non-linear, no hand-holding, and three puzzles that need somebody to have seen the type before. Do not bring four beginners.",
    access: "Not accessible — a staircase with no alternative route.",
  },
];

function P() {
  return (
    <SiteChrome
      name="Neepsend Lock-In"
      tagline="Four rooms, with the escape rate and who each one is for."
      links={[
        { label: "Tonight", href: "/" },
        { label: "Book", href: "/book" },
      ]}
      action={{ label: "Book a slot", href: "/book" }}
    >
      <div className="mx-auto max-w-5xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">The rooms</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          "Hard" compared to what? The escape rate is the only honest measure and we publish all
          four, including the one that makes us look bad.
        </p>

        <section className="mt-12 space-y-8">
          {ROOMS.map((r) => (
            <article key={r.name} className="overflow-hidden rounded-xl border border-border">
              {/* TWO PICTURES, NOT ONE. The wide shot answers "is it built or
                  is it a shed"; the detail answers "how dark is it, really" —
                  which is the question behind almost every phone call and the
                  one a difficulty rating cannot touch. */}
              <div className="grid gap-px bg-border sm:grid-cols-[1.6fr_1fr]">
                <SafeImage src={null} alt={r.shot} ratio="16/9" className="rounded-none" />
                <SafeImage src={null} alt={r.shot2} ratio="16/9" className="rounded-none" />
              </div>
              <div className="p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="text-xl font-semibold">{r.name}</h2>
                <p className="text-sm tabular-nums text-muted-foreground">{r.rate} escape · {r.mins} minutes</p>
              </div>
              <p className="mt-1 text-sm font-medium">{r.who}</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2 md:gap-8">
                <p className="text-sm leading-relaxed text-muted-foreground">{r.theme}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{r.detail}</p>
              </div>
              <p className="mt-4 text-sm leading-relaxed">
                <span className="font-medium">Access. </span>
                <span className="text-muted-foreground">{r.access}</span>
              </p>
              </div>
            </article>
          ))}
        </section>

        <section className="mt-14">
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader
                eyebrow="A typical evening"
                title="Four rooms running in parallel"
                description="Two groups can do different rooms at the same time and compare afterwards, which is what most parties of eight actually want."
              />
              <div className="mt-6">
                <DaySchedule
                  date="Thursday 6 August"
                  items={[
                    { at: "17:00", title: "Cutlery Patent 1913", meta: "Free · 45 min" },
                    { at: "17:00", title: "The Flood", meta: "Booked, 5 players" },
                    { at: "18:15", title: "The Grinding Hull", meta: "Booked, 6 players" },
                    { at: "18:15", title: "The Flood", meta: "Booked, 4 players" },
                    { at: "19:30", title: "The Nightwatchman", meta: "Booked, 6 players" },
                    { at: "20:45", title: "The Flood", meta: "Free · 60 min" },
                    { at: "20:45", title: "Cutlery Patent 1913", meta: "Free · 45 min" },
                    { at: "22:00", title: "The Grinding Hull", meta: "Free · last slot" },
                  ]}
                />
              </div>
            </div>
            <div>
              <SectionHeader eyebrow="What people say" title="412 reviews, all of them" />
              <div className="mt-6">
                <RatingSummary average={4.7} total={412} distribution={[4, 6, 22, 71, 309]} />
              </div>
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                We do not filter these and we do not ask people to leave one only when they escape.
                A good proportion of the five stars are from groups who did not get out, which is
                the most useful thing in the whole set.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader title="Room questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Which should we do first?",
                  answer:
                    "The Flood if there are four or more of you, Cutlery Patent if there are two or three. Do not start with the Nightwatchman — it is built to beat people and it is a poor introduction.",
                },
                {
                  question: "Can we do two in one evening?",
                  answer:
                    "Yes, and about a fifth of bookings are. Two hours forty-five for two 60-minute rooms with a break. The second is always better because everybody has learnt how to search.",
                },
                {
                  question: "Do the rooms change?",
                  answer:
                    "Slowly. We replace one every eighteen months or so — the Grinding Hull is the newest and something will replace Cutlery Patent next year. Returning groups are told what is new.",
                },
                {
                  question: "Are there spoilers online?",
                  answer:
                    "Some, and we would rather you did not. It is an hour of your life and the whole value is not knowing. Nobody who has read a walkthrough has ever said they were glad.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="/">Tonight's slots</a>
            {" · "}
            <a className="underline underline-offset-4" href="/book">Booking and the rules</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
