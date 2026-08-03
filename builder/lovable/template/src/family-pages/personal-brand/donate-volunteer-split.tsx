// personal-brand/donate-volunteer-split — A CAMPAIGN. The base family ends on
// ONE ask, deliberately: a speaker, an author or a coach has a single thing
// they want and five buttons dilute it.
//
// A campaign is the one case where that rule is wrong, and it is wrong in a
// specific way. It runs on two currencies — money and hours — and the people
// who have one usually do not have the other. A single Donate button loses
// everybody with a free Saturday and no spare fifty pounds; a single Volunteer
// button loses everybody who works away and would happily give a hundred. So
// the two sit side by side, the same size, in the same row, and neither is
// styled as the real one.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CountdownRing } from "@/components/ui/countdown-ring";
import { DonationTiers } from "@/components/ui/donation-tiers";
import { Faq } from "@/components/ui/faq";
import { GoalGauge } from "@/components/ui/goal-gauge";
import { PressQuote } from "@/components/ui/press-quote";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { ShiftSignup } from "@/components/ui/shift-signup";
import { SocialLinks } from "@/components/ui/social-links";
import { StatsBand } from "@/components/ui/stats-band";
import { Timeline } from "@/components/ui/timeline";
export const Route = createFileRoute("/donate-volunteer-split")({ component: P });
function P() {
  const [taken, setTaken] = useState<string[]>([]);
  const toggle = (k: string) =>
    setTaken((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  return (
    <SiteChrome name="Save Cotton Mill Baths" tagline="A community bid for the 1904 baths on Bury New Road. Closed 2019. Not demolished yet."
      links={[{ label: "The press kit", href: "#/press" }, { label: "Where the money goes", href: "#/music" }]}
      action={{ label: "Give", href: "#give" }}>

      <section className="border-b border-border">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 lg:grid-cols-[1.15fr_1fr] lg:items-center">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Community asset transfer · decision 14 October
            </p>
            <h1 className="mt-3 text-5xl font-semibold leading-[1.05] tracking-tight text-balance">
              We have eleven weeks to raise £180,000 and prove four hundred people want it back.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
              The council will transfer the baths to a community trust if we can show the money for
              the roof and the volunteers to run it. Both, not either. The alternative on the table
              is fifty-four flats and the pool filled with concrete.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-6">
              <GoalGauge value={112400} goal={180000} label="Raised" unit="£" size={132} />
              <div className="text-sm leading-relaxed text-muted-foreground">
                <p className="text-base font-medium text-foreground">£112,400 from 1,340 people</p>
                <p className="mt-1">Median gift £25. The largest single one is £5,000 and the
                  smallest is £2, and both of them count on the same line at the meeting.</p>
              </div>
            </div>
          </div>
          <div>
            <SafeImage src={null} alt="The Cotton Mill Baths from Bury New Road, 1904 tilework above the door" ratio="4/3" />
            <p className="mt-2 text-xs text-muted-foreground">
              Grade II listed. The tiles are original and the roof is not.
            </p>
          </div>
        </div>
      </section>

      {/* THE TWO DOORS. Equal columns, equal heading weight, no "or" between
          them and no primary-versus-secondary styling. A campaign that makes
          one of these the real button and the other the polite alternative
          gets exactly the resource it asked for and none of the other. */}
      <section id="give" className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="max-w-3xl">
            <h2 className="text-3xl font-semibold tracking-tight text-balance">Two things we need, and they are not the same thing</h2>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              The bid fails on either one. £180,000 with no rota is a building nobody can open;
              four hundred volunteers with no roof fund is a very well-staffed ruin. Pick whichever
              you actually have — most people have one and not the other, and that is fine.
            </p>
          </div>

          <div className="mt-9 grid gap-8 lg:grid-cols-2">
            <div className="rounded-lg border border-border bg-background p-6">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">One of two</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight">Money</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                £67,600 to go by 14 October. Held by the trust, not by us — if the transfer is
                refused it is returned, and that is written into the constitution rather than
                promised on a website.
              </p>
              <div className="mt-6">
                <DonationTiers
                  oneOff={[
                    { amount: 10, buys: "One session for a child on the free swim scheme" },
                    { amount: 25, buys: "A square metre of the roof felt", suggested: true },
                    { amount: 60, buys: "One of the 1904 tiles, cleaned and refixed" },
                    { amount: 250, buys: "An hour of the structural engineer's time" },
                  ]}
                  monthly={[
                    { amount: 5, buys: "Keeps the meter on through the winter" },
                    { amount: 12, buys: "One child swimming free, every week", suggested: true },
                    { amount: 30, buys: "A quarter of the caretaker's hours" },
                  ]}
                  onGive={() => undefined}
                />
              </div>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Gift Aid adds 25% at no cost to you if you pay UK tax — £25 becomes £31.25. There is
                no card fee taken out of your gift; the trust pays it.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-background p-6">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Two of two</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight">Hours</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                We have to name 400 people willing to help run it. 268 so far. Taking a single
                four-hour shift counts you — you do not have to commit to a year, and nobody will
                ring you about becoming a trustee.
              </p>
              <ul className="mt-6 space-y-3">
                <ShiftSignup role="Door knocking, Sedgley ward" when="Saturday 16 August, 10:00 to 13:00"
                  where="Meet at the Baths steps" filled={9} needed={14}
                  requirements={["Outside whatever the weather", "About two miles of walking", "In pairs, always"]}
                  signedUp={taken.includes("door")}
                  onSignUp={() => toggle("door")} onWithdraw={() => toggle("door")} />
                <ShiftSignup role="Stall on the market" when="Every Saturday, 09:00 to 12:00"
                  where="Bury New Road, outside Greggs" filled={4} needed={4}
                  requirements={["Mostly standing", "Some lifting — the gazebo is heavy"]}
                  signedUp={taken.includes("stall")}
                  onSignUp={() => toggle("stall")} onWithdraw={() => toggle("stall")} />
                <ShiftSignup role="Phoning the 1,340 who have given" when="Tuesday evenings, 18:00 to 20:00"
                  where="From home, your own phone" filled={6} needed={20}
                  requirements={["Sitting down", "A script is provided", "No fundraising ask — this is a thank you"]}
                  loneWorking
                  signedUp={taken.includes("phone")}
                  onSignUp={() => toggle("phone")} onWithdraw={() => toggle("phone")} />
                <ShiftSignup role="Clearing the boiler room" when="Sunday 24 August, 09:00 to 15:00"
                  where="The Baths, side entrance" filled={11} needed={18}
                  requirements={["Heavy lifting", "Dusty and dark", "Steel toecaps needed and we have spares"]}
                  signedUp={taken.includes("boiler")}
                  onSignUp={() => toggle("boiler")} onWithdraw={() => toggle("boiler")} />
              </ul>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Withdrawing is one click and nobody minds. A shift you drop a week out gets filled;
                one you do not turn up to does not.
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-6 rounded-lg border border-border bg-background p-5">
            <CountdownRing to={new Date("2026-10-14T09:00:00Z")} label="Until the committee decides" />
            <div className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              <p className="text-base font-medium text-foreground">Both numbers are reported to the committee on 14 October</p>
              <p className="mt-1">
                Money raised and volunteers named, as two separate figures. There is no way to make
                up a shortfall in one with a surplus in the other, which is the whole reason this
                page has two halves rather than a button and a footnote.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <StatsBand items={[
          { value: "1,340", label: "People who have given" },
          { value: "268", label: "Volunteers named, of 400" },
          { value: "£180k", label: "The roof, surveyed twice" },
          { value: "2019", label: "Closed. Not demolished yet" },
        ]} />

        <section className="mt-14 grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <SectionHeader eyebrow="How it got here" title="Seven years, and it very nearly went in 2023" />
            <div className="mt-6">
              <Timeline items={[
                { when: "March 2019", title: "Closed with four days' notice", description: "A leak in the plant room. The council said temporary and the sign is still on the door." },
                { when: "November 2020", title: "Listed Grade II", description: "The tilework and the barrel roof. This is the only reason it is still standing — it stopped an outline demolition." },
                { when: "June 2023", title: "Sold to a developer, then unsold", description: "Fifty-four flats. The sale collapsed when the listing made the roof works uneconomic for them." },
                { when: "February 2026", title: "Community asset transfer opened", description: "The council agreed to consider a trust bid. We have until 14 October to make it." },
                { when: "May 2026", title: "Second survey, and the number went down", description: "£240,000 became £180,000 once the engineer got into the roof void. We published both surveys." },
                { when: "August 2026", title: "£112,400 and 268 people", description: "Where we are now, updated the day anything changes rather than weekly." },
              ]} />
            </div>
          </div>
          <div>
            <SectionHeader eyebrow="Said about it" title="By people who are not us" />
            <div className="mt-6 space-y-4">
              <PressQuote quote="The most detailed community bid the authority has received, and the only one to publish a survey it had paid for and did not like."
                source="Manchester Evening News, 4 June 2026" href="#/press" />
              <PressQuote quote="Cotton Mill is the last surviving Edwardian baths in the borough with its original tank intact. Nothing else comes close."
                source="Victorian Society, North West" href="#/press" />
              <PressQuote quote="I learned to swim there and so did my mum. Four hundred of us is not a hard number to find round here."
                source="Ayesha Kalim, Sedgley ward councillor" href="#/press" />
            </div>
            <div className="mt-8 rounded-lg border border-border p-5">
              <p className="text-base font-medium">Follow it rather than give</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Perfectly reasonable, and it helps — the committee counts the room on the night, and
                the meeting is public. We post when there is something to say and not otherwise.
              </p>
              <div className="mt-4">
                <SocialLinks links={[
                  { network: "Facebook", href: "#" },
                  { network: "Instagram", href: "#" },
                  { network: "Email", href: "#" },
                ]} />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="max-w-3xl">
            <SectionHeader eyebrow="Asked often" title="Mostly the sceptical ones, which are the fair ones" />
            <Faq className="mt-6" items={[
              { question: "What happens to my money if the bid fails?", answer: "Returned. It sits with the Cotton Mill Baths Trust, a CIO, and the constitution says it goes back to donors if the transfer is refused — it cannot be spent on anything else and it cannot be rolled into a second attempt without asking you." },
              { question: "Is £180,000 really the whole cost?", answer: "It is the roof, which is what makes the building weathertight and is the condition of the transfer. Reopening the pool is a further £1.1m and we have said so from the start. We publish both surveys, including the first one that said £240,000." },
              { question: "Why do you need volunteers as well as money?", answer: "The transfer is conditional on the trust demonstrating it can operate the building. Four hundred named people is the council's number, not ours. A funded building nobody can staff fails the same test as an unfunded one." },
              { question: "Do I have to volunteer regularly?", answer: "No. One four-hour shift counts you towards the four hundred and there is no expectation beyond it. About a fifth of the 268 have done exactly one thing." },
              { question: "Who is running this?", answer: "Nine trustees, all local, none paid, named on the press page with what each of them actually does. Two are ex-council and say so." },
              { question: "Is the pool safe to use if it reopens?", answer: "The tank was tested in May and holds. That is the one piece of good news in the survey and it is the reason a £1.1m reopening is credible rather than fantasy." },
            ]} />
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
