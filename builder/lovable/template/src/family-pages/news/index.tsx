// news — BENTO: a lead, then secondaries, then sections. This differs from
// `podcast` because a newsroom EDITS: the page has to show a judgement about
// what matters most today, and a stream cannot.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { EmailCapture } from "@/components/ui/email-capture";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { StoryLead } from "@/components/ui/story-lead";
import { TagList } from "@/components/ui/tag-list";
import { useState } from "react";
export const Route = createFileRoute("/")({ component: P });
const SECONDARIES = [
  { kicker: "Transport", headline: "Supertram closures start Monday and run for nine weeks", when: "4 hours ago", byline: "Ada Mensah" },
  { kicker: "Housing", headline: "Park Hill's fourth phase finally has a completion date", when: "Yesterday", byline: "Tom Brackley" },
  { kicker: "Business", headline: "Two more Division Street units go to hospitality", when: "Yesterday", byline: "Ruth Oyelaran" },
];
const LATEST = [
  ["Council", "Budget consultation opens with a £41m gap to close", "6 hours ago"],
  ["Schools", "Three primaries to share a single head from September", "8 hours ago"],
  ["Sport", "United hold on at Bramall Lane, and it was not pretty", "Yesterday"],
  ["Environment", "The Don is cleaner than at any point since 1970, says survey", "Yesterday"],
  ["Health", "Walk-in centre hours cut again, this time on Sundays", "2 days ago"],
  ["Culture", "The Playhouse announces a winter season and a price freeze", "2 days ago"],
];
function P() {
  const [done, setDone] = useState(false);
  return (
    <SiteChrome name="The Sheffield Wire" tagline="Local reporting, four journalists, no owner in London."
      links={[{ label: "Council", href: "#/section" }, { label: "Housing", href: "#/section" }, { label: "Sport", href: "#/section" }, { label: "About", href: "#about" }]}
      action={{ label: "Subscribe — £6/month", href: "#subscribe" }}>

      <div className="mx-auto max-w-6xl px-6 py-10">
        <TagList items={["Council", "Housing", "Transport", "Schools", "Sport", "Culture"]} active={null} onSelect={() => {}} />
      </div>

      <section className="border-y border-border">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="grid gap-12 lg:grid-cols-[1.6fr_1fr]">
            <StoryLead
              kicker="Planning" href="#/story"
              headline="Council approves the Attercliffe scheme after four years of objections"
              standfirst="Nine hundred homes, a school and a tram extension — and the eleven conditions that got it over the line."
              byline="Sam Okonkwo" when="2 hours ago"
              imageAlt="The Attercliffe site seen from the tram bridge" />
            <div className="space-y-6">
              {SECONDARIES.map((s) => (
                <article key={s.headline} className="border-t border-border pt-5 first:border-t-0 first:pt-0">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{s.kicker}</p>
                  <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-balance">
                    <a className="hover:underline" href="#/story">{s.headline}</a>
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{s.byline}</span> · {s.when}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <SectionHeader eyebrow="Latest" title="Everything else today" />
            <ul className="mt-6 divide-y divide-border border-y border-border">
              {LATEST.map(([sec, head, when]) => (
                <li key={head}>
                  <a href="#/story" className="group flex flex-wrap items-baseline gap-x-4 gap-y-1 py-4">
                    {/* min-w-fit: a fixed 96px column keeps the headlines aligned, and
                        "ENVIRONMENT" at this tracking needs 103 — it painted seven
                        pixels of itself into the headline beside it. Now short
                        sections still sit at 96 and only the long one nudges. */}
                    <span className="w-24 min-w-fit shrink-0 text-xs font-medium uppercase tracking-widest text-muted-foreground">{sec}</span>
                    <span className="min-w-0 flex-1 text-base font-medium group-hover:underline">{head}</span>
                    <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{when}</span>
                  </a>
                </li>
              ))}
            </ul>
            <a className="mt-6 inline-block text-sm font-medium underline underline-offset-4" href="#/section">Everything filed under Council →</a>
          </div>
          <aside className="space-y-8">
            <div id="subscribe">
              <EmailCapture title="The morning briefing" blurb="What happened yesterday and what is on today, by seven."
                note="Free. The reporting is what costs £6." done={done} onSubmit={() => setDone(true)} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Most read this week</p>
              <ol className="mt-3 space-y-3">
                {["What the £41m gap actually means for your bins",
                  "We asked every councillor about the tram. Nine answered.",
                  "The Attercliffe conditions, in plain English",
                  "Where the potholes are, mapped"].map((t, i) => (
                  <li key={t} className="flex gap-3 border-t border-border pt-3 first:border-t-0 first:pt-0">
                    <span className="text-sm tabular-nums text-muted-foreground">{i + 1}</span>
                    <a className="text-sm font-medium hover:underline" href="#/story">{t}</a>
                  </li>
                ))}
              </ol>
            </div>
            <div id="about" className="rounded-lg border border-border bg-muted/40 p-5">
              <p className="text-sm font-medium">Four journalists, no owner in London</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Funded by 2,100 subscribers at £6 a month. No advertising, no proprietor, and the accounts
                are published every January.
              </p>
              <SafeImage className="mt-4" src={null} alt="The four of us, in the office above the chip shop" ratio="16/9" />
            </div>
          </aside>
        </div>
      </section>
    </SiteChrome>
  );
}
