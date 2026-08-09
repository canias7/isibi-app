// parish-council /papers — agendas and minutes, with the DECISIONS pulled out
// and a name against each action. Minutes that narrate a conversation bury what
// was agreed, and the reader six months later wants only the second.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { DownloadCard } from "@/components/ui/download-card";
import { Faq } from "@/components/ui/faq";
import { MeetingPapers } from "@/components/ui/meeting-papers";
import { MinutesEntry } from "@/components/ui/minutes-entry";
import { SectionHeader } from "@/components/ui/section-header";
import { MEETINGS } from "./index";
export const Route = createFileRoute("/papers")({ component: P });
function P() {
  return (
    <SiteChrome name="Bolsterstone Parish Council" tagline="Eleven councillors, one clerk, and a precept of £34,000 a year."
      links={[{ label: "Home", href: "/" }, { label: "The council", href: "/council" }]}
      action={{ label: "Next meeting", href: "/#next" }}>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="Papers" title="Agendas, minutes, and what was actually decided"
          description="The decisions are pulled out below with a name and a date against each, because minutes that narrate a conversation bury what was agreed — and six months later the second is the only part anybody wants." />

        <section className="mt-10 grid gap-12 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <MeetingPapers meetings={MEETINGS} now={new Date(2026, 7, 2)}
              heading="Everything, newest first"
              note="Agendas go up at least three clear days before. Minutes go up within ten days and are marked draft until the following meeting approves them. Anything older than two years is in the archive — email the clerk and it comes back the same week." />

            <div className="mt-8 space-y-3">
              <DownloadCard name="Agenda — 11 August 2026.pdf" size={96_000}
                description="Published 5 August. Nine items, two of them planning" href="/papers" />
              <DownloadCard name="Draft minutes — 14 July 2026.pdf" size={128_000}
                description="Not yet approved. Approval is item 3 on 11 August" href="/papers" />
              <DownloadCard name="Minutes — 9 June 2026.pdf" size={124_000}
                description="Approved 14 July" href="/papers" />
              <DownloadCard name="Annual governance and accountability return 2025-26.pdf" size={310_000}
                description="Signed off. External auditor's certificate attached" href="/council" />
              <DownloadCard name="Register of members' interests.pdf" size={88_000}
                description="All eleven councillors, updated May 2026" href="/council" />
            </div>
          </div>

          <div>
            <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
              What was decided on 14 July
            </h2>
            <ul className="mt-4 space-y-5">
              <MinutesEntry item="Play area — the annual inspection report"
                discussion="The RoSPA report rates two items high risk: the swing frame bearings and the gate latch. Three quotes were tabled, ranging from £1,140 to £2,380."
                decision="Accept the middle quote from Peak Play at £1,620. Work to be done in the school holidays."
                actionBy="Cllr Ramsden" actionDueOn="2026-08-29" />
              <MinutesEntry item="Barn conversion at Hollin Busk — 26/03881/FUL"
                discussion="Six residents attended and five spoke against, mainly on the lane access. The council is a consultee and not the decision maker."
                decision="Object, on highway safety grounds only, and ask for a site visit by the city council's planning officer."
                actionBy="Angela Firth, clerk" actionDueOn="2026-07-28" />
              <MinutesEntry item="Verge cutting — the contractor has been cutting the wildflower strip"
                discussion="Raised in public participation by two residents. The strip was agreed in 2024 and the current contractor was not told."
                decision="Write to the contractor with a marked map, and add the strip to the specification when the contract is renewed in October."
                actionBy="Angela Firth, clerk" actionDueOn="2026-07-21" />
              <MinutesEntry item="Bus shelter on Sunny Bank Road — the roof"
                discussion="Third time this has come up. The quote from March has expired and the councillor holding it has since resigned."
                decision="No decision. Fresh quotes to September's meeting."
                actionBy="Cllr Whitworth" actionDueOn="2026-09-08" carriedForward />
              <MinutesEntry item="Grant application — Bolsterstone Cricket Club, £900 for nets"
                discussion="Within the grants budget, which stands at £4,000 with £1,350 already committed."
                decision="Approved in full. Cllr Naylor declared an interest as a club member and left the room for the vote."
                actionBy="Angela Firth, clerk" actionDueOn="2026-07-31" />
            </ul>
            <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
              Five items, five names, five dates. An item carried forward stays visible with the
              reason — the bus shelter has now been carried three times and it says so, because
              items that quietly drop off between meetings are how the same complaint gets raised
              four times by four different people.
            </p>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="max-w-3xl">
            <SectionHeader eyebrow="Asked often" title="About the papers" />
            <Faq className="mt-6" items={[
              { question: "Why are the minutes marked draft?", answer: "Because they are. Minutes are not the record until the following meeting approves them, which is six weeks later. Publishing them as approved before they are is a small thing that matters the one time somebody quotes them at a planning inquiry." },
              { question: "Can I see something older than two years?", answer: "Yes — email the clerk and it comes back the same week. It is not on the site because a parish council site full of 2011 minutes is a site nobody can find this month's on." },
              { question: "What if a decision was wrong?", answer: "Raise it in public participation at the next meeting and the council can rescind or amend. If it is a conduct matter rather than a decision, that goes to the city council's monitoring officer and there is a form on their site." },
              { question: "Can I get the papers by email?", answer: "Yes. The clerk keeps a list of about ninety residents and sends the agenda when it is published. It is the only thing that list is ever used for." },
              { question: "Are the accounts published?", answer: "In full, annually, in the AGAR above — income, expenditure, reserves and the auditor's certificate. There is also a statutory period each summer when any resident can inspect every invoice, and the dates are advertised on the noticeboard." },
              { question: "Why do some items have no name against them?", answer: "They should all have one. If you find an action with no name and no date, tell the clerk — it is a mistake rather than a policy, and it is the mistake that stops things happening." },
            ]} />
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
