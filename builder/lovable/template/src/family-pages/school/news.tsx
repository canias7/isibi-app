// school /news — the newsletter AND every letter home, kept and findable.
//
// A LETTER HOME IS LOST WITHIN A DAY. It goes in a bag, the bag goes under a
// coat, and the trip that needed a reply by Friday is missed. Every school
// emails them and almost none keeps them anywhere a parent can go back to. An
// archive by date, with the ones that need a reply marked, is the single most
// useful page a primary school can publish.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AnnouncementBar } from "@/components/ui/announcement-bar";
import { CommitteeList } from "@/components/ui/committee-list";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/news")({ component: P });

const LETTERS = [
  { on: "31 July", what: "September newsletter — staffing, class lists and the first-week timings", needs: null },
  { on: "24 July", what: "Year 2 Weston Park trip — consent and £4 contribution", needs: "Reply by 8 August" },
  { on: "18 July", what: "Whole-school photograph, Wednesday 5 August", needs: null },
  { on: "11 July", what: "Year 4 swimming, autumn block — kit list and medical form", needs: "Reply by 22 August" },
  { on: "4 July", what: "Uniform: what has changed and what has not", needs: null },
  { on: "27 June", what: "Sports day, and the wet-weather arrangement", needs: null },
  { on: "20 June", what: "Free school meals — how to check whether you qualify", needs: null },
  { on: "13 June", what: "Governor vacancy: one parent governor, four-year term", needs: "Nominations by 30 September" },
];

function P() {
  return (
    <SiteChrome
      name="Bolsterstone Primary"
      tagline="Every letter home, kept where you can find it again."
      links={[
        { label: "Home", href: "#/" },
        { label: "Term dates", href: "#/term-dates" },
        { label: "Admissions", href: "#/admissions" },
      ]}
      action={{ label: "Report an absence", href: "tel:01142883014" }}
    >
      <AnnouncementBar>
        Two letters are waiting on a reply: the Year 2 trip by 8 August and swimming by 22 August.
        Both are at the top of the list below.
      </AnnouncementBar>

      <div className="mx-auto max-w-4xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">Newsletter and letters</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Everything sent home, in date order, kept for two years. The ones needing a reply are
          marked — because the letter itself is in a bag under a coat and has been since Tuesday.
        </p>

        <section className="mt-12">
          <SectionHeader eyebrow="Sent home" title="This term and last" />
          <ul className="mt-6 divide-y divide-border border-y border-border">
            {LETTERS.map((l) => (
              <li key={l.on} className="grid gap-1 py-4 md:grid-cols-[minmax(0,7rem)_1fr] md:gap-6">
                <p className="text-sm tabular-nums text-muted-foreground">{l.on}</p>
                <div className="min-w-0">
                  <p className="font-medium">{l.what}</p>
                  {l.needs && (
                    <p className="mt-1 inline-block rounded bg-foreground px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-background">
                      {l.needs}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Anything older than two years is taken down. Ask the office if you need something from
            further back and they will find it.
          </p>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="Who decides things"
            title="The governing body"
            description="Twelve people, mostly volunteers, meeting six times a year. Contact is by role rather than by name, so a governor's inbox does not follow them out of the post."
          />
          <div className="mt-8">
            <CommitteeList
              posts={[
                { id: "chair", role: "Chair of governors", holder: "Ruth Ellinthorpe", contact: "chair@bolsterstone.sheffield.sch.uk", termEnds: "September 2028", trustee: true, about: "Chairs the full board and the pay committee. The route for anything a complaint has not resolved." },
                { id: "vice", role: "Vice chair", holder: "Sam Okonjo", termEnds: "September 2027", trustee: true, about: "Also chairs finance. A retired head from Barnsley." },
                { id: "head", role: "Headteacher", holder: "Priya Chandran", contact: "head@bolsterstone.sheffield.sch.uk", trustee: true, about: "Governor by virtue of the post." },
                { id: "parent1", role: "Parent governor", holder: "Dan Halliwell", termEnds: "September 2026", trustee: true, about: "Elected by parents. Safeguarding link governor." },
                { id: "parent2", role: "Parent governor", holder: "Vacant", termEnds: "—", trustee: true, about: "One vacancy. Nominations by 30 September; any parent or carer may stand and it needs about six hours a term." },
                { id: "staff", role: "Staff governor", holder: "Ellie Marsden", termEnds: "March 2027", trustee: true, about: "Elected by the staff. Year 3 teacher." },
                { id: "clerk", role: "Clerk to the governors", holder: "Angela Firth", contact: "clerk@bolsterstone.sheffield.sch.uk", about: "Not a governor. Minutes, agendas and the person to ask for papers." },
              ]}
            />
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader title="Questions about letters" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "I did not get an email.",
                  answer:
                    "Check junk first — school domains land there often. If it is genuinely missing, the office will check the address on file; a mistyped one is the usual cause and it takes a minute to fix.",
                },
                {
                  question: "Can I reply by email instead of a paper slip?",
                  answer:
                    "Yes, always. Email the office with your child's name and class and it is recorded the same way. We would rather that than a slip that never comes back.",
                },
                {
                  question: "How do I become a parent governor?",
                  answer:
                    "Email the clerk. Any parent or carer can stand, there is no requirement to have any particular background, and it is about six hours a term. Elections are in October when there is more than one nomination.",
                },
                {
                  question: "Where are the minutes of governor meetings?",
                  answer: "Published after approval at the following meeting, so roughly a term behind. Ask the clerk for anything not yet up — they are public documents.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="#/">The parent page</a>
            {" · "}
            <a className="underline underline-offset-4" href="#/term-dates">Term dates</a>
            {" · "}
            <a className="underline underline-offset-4" href="#/admissions">Admissions</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
