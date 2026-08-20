// parish-council — NEXT-MEETING-FIRST, editorial. A resident wants to know
// whether they can turn up and speak on Tuesday, and every council site answers
// with a welcome message. The agenda's publication STATE is the information —
// three clear days is the statutory notice and "not out yet" is an answer.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AnnouncementBar } from "@/components/ui/announcement-bar";
import { Faq } from "@/components/ui/faq";
import { LocationCard } from "@/components/ui/location-card";
import { MeetingPapers } from "@/components/ui/meeting-papers";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
export const Route = createFileRoute("/")({ component: P });
export const MEETINGS = [
  { date: "2026-09-08", kind: "Full council", time: "19:30", where: "Village hall, main room" },
  { date: "2026-08-18", kind: "Planning committee", time: "19:00", where: "Village hall, committee room",
    note: "Two applications: the barn conversion at Hollin Busk and the tree works at the green" },
  // Genuinely late, and shown as late. A council that is behind is a council
  // residents should be able to see is behind, and softening it takes the
  // clerk's side over theirs.
  { date: "2026-08-05", kind: "Allotments working group", time: "18:30", where: "The site hut",
    note: "Agenda held up by the water bill query. It will be up on Monday and the meeting will run late rather than not at all" },
  { date: "2026-08-11", kind: "Full council", time: "19:30", where: "Village hall, main room",
    agendaHref: "/papers" },
  { date: "2026-07-14", kind: "Full council", time: "19:30", where: "Village hall, main room",
    agendaHref: "/papers", minutesHref: "/papers", minutesDraft: true },
  { date: "2026-06-09", kind: "Full council", time: "19:30", where: "Village hall, main room",
    agendaHref: "/papers", minutesHref: "/papers" },
  { date: "2026-05-12", kind: "Annual parish meeting", time: "19:00", where: "Village hall, main room",
    agendaHref: "/papers", minutesHref: "/papers",
    note: "The one meeting of the year that belongs to residents rather than to the council" },
];
function P() {
  return (
    <SiteChrome name="Bolsterstone Parish Council" tagline="Eleven councillors, one clerk, and a precept of £34,000 a year."
      links={[{ label: "Papers", href: "/papers" }, { label: "The council", href: "/council" }, { label: "Speaking", href: "#speaking" }]}
      action={{ label: "Next meeting", href: "#next" }}>

      <AnnouncementBar>
        Two councillor vacancies. Co-option at the September meeting — no election needed, and
        anybody on the register can put themselves forward.
      </AnnouncementBar>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid items-start gap-12 lg:grid-cols-[1.15fr_1fr]">
            <div id="next">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Second Tuesday of the month · 19:30 · village hall</p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">
                Next meeting: Tuesday 11 August
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
                Agenda is out. Anybody may come, and the first fifteen minutes are yours — you do
                not need to book, be on a list, or have been before. Sit anywhere; the front two
                rows are councillors and the rest is the public.
              </p>
              <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-4 text-sm sm:grid-cols-4">
                <div><dt className="text-muted-foreground">Starts</dt><dd className="mt-1 text-lg font-semibold tabular-nums">19:30</dd></div>
                <div><dt className="text-muted-foreground">Public time</dt><dd className="mt-1 text-lg font-semibold">First 15 min</dd></div>
                <div><dt className="text-muted-foreground">Usually ends</dt><dd className="mt-1 text-lg font-semibold tabular-nums">21:15</dd></div>
                <div><dt className="text-muted-foreground">Vacancies</dt><dd className="mt-1 text-lg font-semibold tabular-nums">2</dd></div>
              </dl>
              <div className="mt-7 flex flex-wrap gap-3">
                <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="/papers">Read the agenda</a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#speaking">How to speak</a>
              </div>
              <div className="mt-10">
                <SafeImage src={null} alt="The village hall on Sunny Bank Road" ratio="21/9" />
              </div>
            </div>
            {/* THE PUBLICATION STATE, not just the dates. A bare date is a
                save-the-date for a meeting nobody can prepare for. */}
            <MeetingPapers meetings={MEETINGS} now={new Date(2026, 7, 2)}
              heading="Meetings and papers"
              note="An agenda must be published three clear days before a meeting — that excludes the day it goes up and the day of the meeting. If one is late, this page says so rather than quietly waiting, because the person it costs is the resident who wanted to speak." />
          </div>
        </div>
      </section>

      <section id="speaking" className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
          <div>
            <SectionHeader eyebrow="Speaking" title="Fifteen minutes, and nobody will stop you"
              description="Public participation is at the start, before the formal business. It is the part most people do not know exists and it is the whole reason the meeting is in public." />
            <ol className="mt-6 divide-y divide-border border-y border-border text-base">
              <li className="py-3.5">
                <span className="font-medium">Turn up. That is the whole process.</span>
                <span className="block text-sm text-muted-foreground">
                  No booking, no form, no notice. Tell the clerk on the way in if you would like to
                  speak, or just put your hand up when the chair asks.
                </span>
              </li>
              <li className="py-3.5">
                <span className="font-medium">About three minutes each</span>
                <span className="block text-sm text-muted-foreground">
                  Not a rule so much as what fifteen minutes divides into. If four people want to
                  speak about the same thing, the chair will usually take all four.
                </span>
              </li>
              <li className="py-3.5">
                <span className="font-medium">You can raise anything</span>
                <span className="block text-sm text-muted-foreground">
                  It does not have to be on the agenda. What the council cannot do is DECIDE
                  something that is not on the agenda — that is the law, not a brush-off, and it
                  means your point goes on next month's.
                </span>
              </li>
              <li className="py-3.5">
                <span className="font-medium">You will get an answer, in the minutes</span>
                <span className="block text-sm text-muted-foreground">
                  With a name against it and a date. An action with neither is what minutes are
                  full of everywhere and what nothing ever comes of.
                </span>
              </li>
              <li className="py-3.5">
                <span className="font-medium">Or write to the clerk instead</span>
                <span className="block text-sm text-muted-foreground">
                  Anything received four days before goes on the agenda as an item, which is more
                  effective than speaking and about a tenth as daunting.
                </span>
              </li>
            </ol>
          </div>
          <div>
            <SectionHeader eyebrow="What we actually do" title="And, more usefully, what we do not"
              description="Half the correspondence a parish council gets is about things it has no power over, and every month of that is a month somebody waited for nothing." />
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Ours</p>
                <ul className="mt-2 space-y-1.5 text-sm leading-relaxed">
                  <li>The green, the benches, the noticeboards and the bus shelter</li>
                  <li>The play area and its annual inspection</li>
                  <li>The allotments and their waiting list</li>
                  <li>Grass cutting on the verges, six times a year</li>
                  <li>Grants to village groups, £4,000 a year</li>
                  <li>Commenting on planning applications — a consultee, not a decider</li>
                  <li>The Christmas lights, the defibrillator and the flagpole</li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Sheffield City Council's</p>
                <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-muted-foreground">
                  <li>Potholes, road surfaces, gritting and street lights</li>
                  <li>Bin collections and fly-tipping</li>
                  <li>Deciding planning applications</li>
                  <li>Schools, social care and libraries</li>
                  <li>Council tax — we set only the £34,000 precept inside it</li>
                  <li>Parking, speed limits and anything with a road sign</li>
                </ul>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  We will pass anything on and chase it, and we do, weekly. But telling somebody
                  where a decision actually sits is worth more than taking a note.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="Asked often" title="About the meetings" />
              <Faq className="mt-6" items={[
                { question: "Can anyone attend?", answer: "Anyone at all — you do not have to live here. The only part that is ever closed is a confidential item on staffing or a legal matter, which happens perhaps twice a year and is minuted as having happened." },
                { question: "Can I record it?", answer: "Yes. Filming, recording and live-streaming a council meeting is a statutory right and you do not need permission. We would rather you told the chair so nobody is startled, but you are not obliged to." },
                { question: "Why can't you decide something I raise on the night?", answer: "Because a decision on an item not on the published agenda is unlawful — the notice period exists so residents know what will be decided before it is. Raise it and it goes on next month's agenda." },
                { question: "Where are the minutes?", answer: "On the papers page, usually within ten days, marked DRAFT until the following meeting approves them. Draft minutes are the honest label for six weeks and calling them anything else is a small lie that matters the one time somebody quotes them." },
                { question: "Do councillors get paid?", answer: "No. Not a penny, and there is no allowance. The clerk is paid — 12 hours a week at the national scale — and that is the only salary the council pays." },
                { question: "How do I become a councillor?", answer: "Two vacancies at the moment, filled by co-option in September: write to the clerk saying why, come and talk for five minutes, and the council votes. You need to be on the electoral register and live or work within three miles." },
              ]} />
            </div>
            <div>
              <SectionHeader eyebrow="Where" title="The village hall, Sunny Bank Road" />
              <LocationCard className="mt-6" name="Bolsterstone Village Hall"
                address="Sunny Bank Road, Bolsterstone, Sheffield, S36 3ZP"
                note="Step-free from the car park at the side. A hearing loop in the main room — ask the clerk to switch it on, it is not on by default. Parking for about twenty, and on the lane after that." />
              <div className="mt-8 rounded-lg border border-border bg-card p-5">
                <p className="text-base font-medium">The clerk</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  Angela Firth, twelve hours a week, Tuesday and Thursday mornings.
                  clerk@bolsterstone-pc.gov.uk is the address for everything — agenda items,
                  complaints, allotments, and questions about any of the above. She replies within
                  two working days and she is the only person here who is paid to.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
