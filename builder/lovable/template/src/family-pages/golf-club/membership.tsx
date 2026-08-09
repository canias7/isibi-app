// golf-club /membership — every category with its joining fee, its waiting
// list and whether it carries a vote.
//
// THE WAITING LIST IS THE FACT NOBODY PUBLISHES. A club that says "applications
// welcome" and then tells you it is four years is wasting your afternoon, and a
// club with no wait at all is embarrassed to say so when saying so is the
// selling point. Both go in the row.
//
// AND WHETHER A CATEGORY VOTES. Members'-owned clubs have historically sold
// cheaper categories that quietly carried no say in the club's future, which is
// exactly the sort of thing somebody deserves to know before paying.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { MembershipTierRow } from "@/components/ui/membership-tier-row";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/membership")({ component: P });

function P() {
  return (
    <SiteChrome
      name="Wharncliffe Crags Golf Club"
      tagline="Seven categories, with the waiting list and the vote stated."
      links={[
        { label: "Home", href: "/" },
        { label: "Visitors", href: "/visitors" },
      ]}
      action={{ label: "Book a tee time", href: "/" }}
    >
      <div className="mx-auto max-w-4xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">Membership</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Seven categories. Two have a waiting list and five do not, and each row says which along
          with whether it carries a vote at the AGM — because this is a members' club and that is
          not a detail.
        </p>

        <ul className="mt-12 space-y-4">
          <MembershipTierRow
            name="Full"
            forWhom="Unrestricted play, seven days"
            price={940}
            joiningFee={250}
            grants={["Play any day", "Enter every competition", "Hold a handicap", "Book seven days ahead", "Four guest rounds a year at £18"]}
            canVote
            waitingList
          />
          <MembershipTierRow
            name="Five-day"
            forWhom="Monday to Friday"
            price={690}
            joiningFee={250}
            grants={["Play weekdays", "Midweek competitions", "Hold a handicap", "Weekend play at £20 green fee"]}
            canVote
          />
          <MembershipTierRow
            name="Intermediate, 22 to 30"
            forWhom="The years people leave the game and never come back"
            price={430}
            joiningFee={0}
            grants={["Everything a full member has", "Rises in steps to full at 31", "No joining fee at any point"]}
            canVote
          />
          <MembershipTierRow
            name="Student"
            forWhom="In full-time education, any age"
            price={190}
            joiningFee={0}
            grants={["Play any day", "Every competition", "Free coaching block in the winter"]}
            canVote
          />
          <MembershipTierRow
            name="Junior, under 18"
            forWhom="With an adult until a handicap is held"
            price={95}
            joiningFee={0}
            grants={["Play any day", "Junior organiser's coaching, free", "Full use of the clubhouse except the bar"]}
          />
          <MembershipTierRow
            name="Country"
            forWhom="Living more than 40 miles away"
            price={340}
            joiningFee={0}
            grants={["Twelve rounds a year", "Handicap held here", "Additional rounds at member green fee"]}
          />
          <MembershipTierRow
            name="Social"
            forWhom="The clubhouse, not the course"
            price={60}
            grants={["Clubhouse, bar and events", "Guest at any social function"]}
            closed
          />
        </ul>

        <section className="mt-14">
          <SectionHeader
            eyebrow="The waiting lists"
            title="Full is fourteen months. Everything else is now."
            description="Published as a real number rather than as 'applications are welcome'. It moves — about thirty places come up a year — and we will tell you where you are whenever you ask."
          />
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">Full — about 14 months</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Capped at 550 by the constitution. Joining the list costs nothing and you can play
                as a visitor meanwhile — several people on it play here more than some members do.
              </p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">Five-day — currently none</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Join this week if you want. A five-day member can play at weekends for a £20 green
                fee, which for most people works out cheaper than full.
              </p>
            </div>
          </div>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Social membership is closed and has been since 2022 — the clubhouse is open to anybody
            without one, so it stopped meaning anything. The row stays because forty people still
            hold it and nothing changes for them.
          </p>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="What the subscription actually pays for"
            title="Published every March, in full"
            description="A members' club that will not show its accounts to its members is not one."
          />
          <ul className="mt-6 divide-y divide-border border-y border-border text-sm">
            <li className="flex justify-between gap-4 py-3"><span>Greenkeeping — four staff, machinery, materials</span><span className="tabular-nums text-muted-foreground">61%</span></li>
            <li className="flex justify-between gap-4 py-3"><span>Clubhouse, insurance and utilities</span><span className="tabular-nums text-muted-foreground">18%</span></li>
            <li className="flex justify-between gap-4 py-3"><span>Office and professional's retainer</span><span className="tabular-nums text-muted-foreground">11%</span></li>
            <li className="flex justify-between gap-4 py-3"><span>England Golf and county affiliation</span><span className="tabular-nums text-muted-foreground">4%</span></li>
            <li className="flex justify-between gap-4 py-3"><span>To the course reserve fund</span><span className="tabular-nums text-muted-foreground">6%</span></li>
          </ul>
        </section>

        <section className="mt-14">
          <SectionHeader title="Membership questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Can I pay monthly?",
                  answer: "Direct debit over ten months at no extra cost, and about two thirds of members do. It is not a finance arrangement and there is no interest.",
                },
                {
                  question: "Do I need a proposer and seconder?",
                  answer:
                    "No. That requirement went in 2019 along with needing a member to sign in a visitor. If you have never met anybody here, come and play twice as a visitor and then apply.",
                },
                {
                  question: "What if I join and cannot play for a year?",
                  answer:
                    "Illness or injury of more than three months gets the subscription frozen and extended, on a doctor's note. It has never been refused and the committee does not debate it.",
                },
                {
                  question: "Is there a joining fee on every category?",
                  answer:
                    "Only on Full and Five-day, £250, payable over the first year if you would rather. Everything else is nothing — the categories aimed at young players and at people moving into the game deliberately have no barrier.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="/">Tee times and the course</a>
            {" · "}
            <a className="underline underline-offset-4" href="/visitors">Playing as a visitor</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
