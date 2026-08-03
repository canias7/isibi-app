// podcast/single-column-capture /episode — one issue in full. The base family's
// entry page carries a player and show notes; a newsletter issue is just
// writing, so the divergence is not what is ON the page but what SURROUNDS it:
// this is the page most readers arrive on from a link somebody sent them, so it
// has to do the whole subscribe job again for a person who has never seen the
// front page and never will.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AuthorByline } from "@/components/ui/author-byline";
import { EmailCapture } from "@/components/ui/email-capture";
import { PostMeta } from "@/components/ui/post-meta";
import { Prose } from "@/components/ui/prose";
import { ReadingTime } from "@/components/ui/reading-time";
import { SectionHeader } from "@/components/ui/section-header";
import { ShareButtons } from "@/components/ui/share-buttons";
import { SpecList, SpecRow } from "@/components/ui/spec-row";
import { TagList } from "@/components/ui/tag-list";
import { ISSUES } from "./index";
export const Route = createFileRoute("/episode")({ component: P });
function P() {
  const [done, setDone] = useState(false);
  const issue = ISSUES[0];
  return (
    <SiteChrome name="Kerbside" tagline="A weekly letter about how British towns actually work."
      links={[{ label: "Subscribe", href: "#/" }, { label: "All 148", href: "#/archive" }, { label: "Who writes it", href: "#/about" }]}
      action={{ label: "Subscribe", href: "#subscribe" }}>

      <article className="mx-auto max-w-2xl px-6 py-12">
        <p className="text-sm tabular-nums text-muted-foreground">Issue №{issue.no}</p>
        <h1 className="mt-2 text-4xl font-semibold leading-tight tracking-tight text-balance">{issue.title}</h1>
        <div className="mt-4">
          <PostMeta date={issue.date} category={issue.topic} readingTime={<ReadingTime words={issue.words} />} />
        </div>
        <div className="mt-4">
          <AuthorByline name="Rosalind Achebe" role="Writes Kerbside. Nine years a local government reporter before that." />
        </div>

        <Prose className="mt-8">
          <p>
            Leicester City Council installed an ANPR camera on the A47 bus lane at Humberstone Road
            in March 2024. The scheme cost £2.1m across eleven sites. By the end of that May it had
            issued 41,300 penalty charge notices and recovered its whole capital cost, which the
            council's own eleven-week report describes, on page 4, as evidence the scheme is
            working, and on page 9 as evidence that compliance is improving.
          </p>
          <p>
            Both cannot be true in the way the report means them, and the interesting part is that
            neither is quite false.
          </p>
          <h2>What a bus lane fine is for</h2>
          <p>
            A penalty charge notice is legally a deterrent and practically a price. £70, halved to
            £35 if you pay inside fourteen days, which about 88% of people do. For a driver who
            uses that junction twice a week, £35 occasionally is cheaper than four minutes twice a
            week, and a substantial minority of drivers have plainly done that arithmetic.
          </p>
          <p>
            You can see them in the data. 2,140 of the 41,300 notices went to 620 vehicles. One
            vehicle received 31. A deterrent that 620 people have priced in is not a deterrent for
            those 620 — it is a toll, collected without anybody deciding to introduce one.
          </p>
          <h2>The bit the report gets right</h2>
          <p>
            For everybody else it worked, and it worked fast. First-week notices were 6,900 and
            week-eleven notices were 1,840, a 73% fall with no change to the signage. Bus journey
            times on the corridor improved by 2 minutes 40 seconds in the morning peak, which for a
            route carrying 4,100 passengers a day is about 180 passenger-hours a day.
          </p>
          <p>
            That is a genuinely good outcome and it is buried under a number — the £2.1m recovery —
            that makes people angry and tells them nothing about whether the road works better.
          </p>
          <h2>What I would ask my own council</h2>
          <p>
            Three questions, all answerable from data every authority already holds, and none of
            which appeared in Leicester's report until I asked:
          </p>
          <ul>
            <li>How many notices went to repeat vehicles, and what is the distribution?</li>
            <li>What happened to bus journey times, separately from what happened to revenue?</li>
            <li>Is the signage compliant with the 2022 statutory guidance at every site, and who checked?</li>
          </ul>
          <p>
            The third one matters more than it sounds. Two of the eleven Leicester sites had
            signage that did not meet the guidance, and every notice issued at those two was
            cancelled — 3,100 of them, at a cost the report does not put a figure on.
          </p>
        </Prose>

        <div className="mt-10 border-t border-border pt-6">
          <SectionHeader eyebrow="The documents" title="Everything above, checkable" />
          <div className="mt-5">
            <SpecList>
              <SpecRow label="Leicester CC eleven-week report" value="PDF, 22pp" note="Committee papers, 12 June 2024. Pages 4 and 9 are the two claims" highlight />
              <SpecRow label="PCN data by vehicle" value="FOI 2026/4471" note="Answered in 19 working days. The repeat-vehicle distribution is table 3" highlight />
              <SpecRow label="Bus journey times" value="Open data" note="First Leicester AVL feed, published monthly, no request needed" />
              <SpecRow label="Signage guidance" value="DfT, 2022" note="Traffic Signs Manual chapter 3. The relevant part is §13.4" />
              <SpecRow label="Cancelled notices" value="FOI 2026/4488" note="The 3,100 figure. The cost of cancelling them was refused as not held" />
            </SpecList>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Every issue ends with this. If a link is dead, reply to the email and I will find it —
            that has happened four times in 148 issues and twice it was the council's fault.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
          <TagList items={["Transport", "Bus lanes", "Enforcement", "Leicester", "FOI"]} />
          <ShareButtons title={issue.title} />
        </div>

        {/* THE WHOLE SUBSCRIBE JOB, AGAIN. Most people reading this arrived
            from a link somebody sent them and will never see the front page.
            A tasteful "read more issues" link would waste the one moment they
            have actually read fourteen hundred words and liked them. */}
        <section id="subscribe" className="mt-12 rounded-lg border border-foreground p-6">
          <p className="text-lg font-semibold">You have just read a whole issue</p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            That is what arrives on a Thursday, at about seven, once a week. Free, no paid tier, no
            sponsor, and one click to leave whenever you like.
          </p>
          <div className="mt-5">
            <EmailCapture id="subscribe-issue" cta="Subscribe" done={done}
              doneMessage="Check your inbox — one confirmation link and nothing else."
              onSubmit={() => setDone(true)}
              note="11,400 people get it. No welcome sequence and no second list." />
          </div>
        </section>

        <nav className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6 text-sm">
          <a className="font-medium underline underline-offset-4" href="#/archive">← №147, who owns the high street</a>
          <a className="font-medium underline underline-offset-4" href="#/archive">All 148 issues</a>
        </nav>
      </article>
    </SiteChrome>
  );
}
