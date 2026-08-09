// school — PARENTS-FIRST: the absence line, this week, and the next dates that
// affect a family. Not a prospectus.
//
// EVERY SCHOOL WEBSITE IS BUILT FOR PROSPECTIVE PARENTS AND USED BY CURRENT
// ONES. The traffic is overwhelmingly people who already chose the school and
// need one of four things: report an absence, find a term date, read the
// newsletter, or check what their child needs tomorrow. The rail is those four,
// and admissions is a page rather than the homepage.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AnnouncementBar } from "@/components/ui/announcement-bar";
import { TermDates } from "@/components/ui/term-dates";
import { ContactCard } from "@/components/ui/contact-card";
import { MediaGrid } from "@/components/ui/media-grid";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/")({ component: P });

const RAIL = [
  { href: "#absence", label: "Report an absence", note: "Before 09:15, every morning" },
  { href: "/term-dates", label: "Term dates", note: "Including every INSET day" },
  { href: "/news", label: "Newsletter and letters", note: "Every letter home, kept" },
  { href: "#week", label: "This week", note: "What each year group needs" },
  { href: "/admissions", label: "Admissions", note: "For families joining us" },
];

const WEEK = [
  { day: "Monday", what: "Year 4 swimming — kit, towel, no jewellery" },
  { day: "Tuesday", what: "Year 6 SATs breakfast club from 08:00, all welcome" },
  { day: "Wednesday", what: "Whole school photograph — full uniform, no PE kit" },
  { day: "Thursday", what: "Year 2 trip to Weston Park, packed lunch needed" },
  { day: "Friday", what: "Celebration assembly 09:15, parents welcome in the hall" },
];

function P() {
  return (
    <SiteChrome
      name="Bolsterstone Primary"
      tagline="A one-form entry village school for 4 to 11 year olds."
      links={[
        { label: "Term dates", href: "/term-dates" },
        { label: "News", href: "/news" },
        { label: "Admissions", href: "/admissions" },
      ]}
      action={{ label: "Report an absence", href: "tel:01142883014" }}
    >
      <AnnouncementBar href="/term-dates">
        Friday 5 September is an INSET day — school is closed to pupils. It is the only closure
        this half term and it is on the term dates page with the rest of the year.
      </AnnouncementBar>

      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 lg:grid-cols-[minmax(0,15rem)_1fr]">
        {/* THE PARENT'S RAIL. Four things, in the order they are actually used. */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">For parents</p>
          <nav className="mt-3 flex flex-col gap-1">
            {RAIL.map((r) => (
              <a key={r.href} href={r.href} className="rounded-md px-3 py-2 hover:bg-muted">
                <span className="block text-sm font-medium">{r.label}</span>
                <span className="block text-xs text-muted-foreground">{r.note}</span>
              </a>
            ))}
          </nav>
          <div className="mt-8">
            <ContactCard
              address="Sunny Bank, Bolsterstone, Sheffield S36 3ZW"
              phone="0114 288 3014"
              email="office@bolsterstone.sheffield.sch.uk"
            />
          </div>
        </aside>

        <main className="min-w-0">
          <section id="absence" className="rounded-xl border-2 border-foreground p-6">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Every morning before 09:15
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Reporting an absence</h1>
            <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
              Ring <a className="font-medium text-foreground underline underline-offset-4" href="tel:01142883014">0114 288 3014</a>{" "}
              and choose option 1, or email the office. Please say what is wrong rather than just
              "unwell" — we have to record a reason and it saves us ringing you back.
            </p>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Sickness or diarrhoea means 48 hours clear before returning. That is a UKHSA rule
              rather than ours and we cannot waive it.
            </p>
          </section>

          {/* PHOTOGRAPHS BELOW THE ABSENCE LINE, NEVER ABOVE IT. A school home
              page is read at 08:40 by a parent with a poorly child, and every
              school site in the country puts a carousel of smiling children
              above the one number that person needs. Underneath, the same
              pictures do real work: they answer what the building is like for
              a family thinking of moving here. */}
          <section className="mt-12">
            <MediaGrid
              columns={4}
              ratio="4/3"
              items={[
                { src: null, alt: "The Victorian frontage from the lane, gate open, two classrooms lit", caption: "1878, and a 2019 extension at the back. 94 children in four classes." },
                { src: null, alt: "A Year 3 classroom mid-morning, tables of four, work on the walls", caption: "Mixed Year 3 and 4. The classes are 24 and 23." },
                { src: null, alt: "The field and the wooded corner, den-building materials stacked", caption: "The field and the wood. Forest school is every Friday afternoon, all year." },
                { src: null, alt: "The hall laid for lunch, hot meals being served at the hatch", caption: "Hot meals cooked on site. Free for every child up to Year 2." },
              ]}
            />
          </section>

          <section className="mt-12" id="week">
            <SectionHeader
              eyebrow="This week"
              title="What each day needs"
              description="Week beginning 3 August. Updated on a Friday afternoon for the week ahead."
            />
            <ul className="mt-6 divide-y divide-border border-y border-border">
              {WEEK.map((w) => (
                <li key={w.day} className="grid gap-1 py-3.5 sm:grid-cols-[minmax(0,8rem)_1fr] sm:gap-6">
                  <p className="font-medium">{w.day}</p>
                  <p className="text-sm text-muted-foreground">{w.what}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-12">
            <SectionHeader
              eyebrow="The year"
              title="Term dates, with the closures inside them"
              description="An INSET day is a day school is shut and somebody has to arrange childcare. It belongs in the term, not on a separate list."
            />
            <div className="mt-8">
              <TermDates
                year="2026 to 2027"
                note="Set by the governors in the spring before, so they are fixed a full year ahead. The full list including next year is on the term dates page."
                terms={[
                  {
                    name: "Autumn term",
                    from: "Monday 1 September",
                    to: "Friday 18 December",
                    current: true,
                    closures: [
                      { when: "Monday 1 September", reason: "INSET day — staff training" },
                      { when: "Friday 5 September", reason: "INSET day — staff training" },
                      { when: "26 to 30 October", reason: "Half term" },
                      { when: "Monday 2 November", reason: "Occasional day" },
                    ],
                  },
                  {
                    name: "Spring term",
                    from: "Tuesday 5 January",
                    to: "Friday 26 March",
                    closures: [
                      { when: "Monday 4 January", reason: "INSET day — staff training" },
                      { when: "15 to 19 February", reason: "Half term" },
                    ],
                  },
                  {
                    name: "Summer term",
                    from: "Monday 12 April",
                    to: "Wednesday 21 July",
                    closures: [
                      { when: "Monday 3 May", reason: "Bank holiday" },
                      { when: "31 May to 4 June", reason: "Half term" },
                      { when: "Thursday 22 July", reason: "INSET day — staff training" },
                    ],
                  },
                ]}
              />
            </div>
            <a className="mt-5 inline-block text-sm underline underline-offset-4" href="/term-dates">
              Next year's dates as well
            </a>
          </section>

          <section className="mt-12">
            <SectionHeader title="What parents ask the office" />
            <div className="mt-6">
              <Faq
                items={[
                  {
                    question: "What time do the doors open?",
                    answer:
                      "08:45, and the register closes at 09:00. Breakfast club runs from 07:45 at £4 and after-school club until 17:45 at £9. Both can be booked on the morning.",
                  },
                  {
                    question: "Can I take my child out in term time?",
                    answer:
                      "We cannot authorise a holiday and the council can fine for it. Ask anyway — bereavements, family circumstances and one-off events are considered properly and often authorised.",
                  },
                  {
                    question: "Who do I speak to about how my child is getting on?",
                    answer:
                      "The class teacher first, always. Email the office and they will pass it on the same day; teachers ring back after 15:30 rather than at the door.",
                  },
                  {
                    question: "Is there a uniform shop?",
                    answer:
                      "Logo jumpers and cardigans from the office at £11. Everything else is supermarket grey and navy — deliberately, and it is in the uniform policy that it must stay that way.",
                  },
                ]}
              />
            </div>
          </section>
        </main>
      </div>
    </SiteChrome>
  );
}
