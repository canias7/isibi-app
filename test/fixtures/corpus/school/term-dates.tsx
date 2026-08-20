// school /term-dates — two full years, because a parent booking a holiday in
// January is booking for the following August.
//
// A SCHOOL THAT PUBLISHES ONE YEAR IS THE REASON PEOPLE BOOK IN TERM TIME.
// Dates are set by governors a year ahead and there is no reason to withhold
// them; the second table costs nothing and prevents the fine.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { TermDates } from "@/components/ui/term-dates";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/term-dates")({ component: P });

function P() {
  return (
    <SiteChrome
      name="Bolsterstone Primary"
      tagline="Two years of dates, with every closure inside its term."
      links={[
        { label: "Home", href: "/" },
        { label: "News", href: "/news" },
        { label: "Admissions", href: "/admissions" },
      ]}
      action={{ label: "Report an absence", href: "tel:01142883014" }}
    >
      <div className="mx-auto max-w-4xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">Term dates</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Two years, because somebody booking in January is booking for the following August. The
          INSET days are inside each term rather than on a separate list, since they are days
          school is shut and somebody has to arrange a Tuesday.
        </p>

        <section className="mt-12">
          <TermDates
            year="2026 to 2027"
            note="Agreed by the governing body in March 2026 and fixed. Any change would be announced by letter and would only ever be an addition, never a term starting earlier."
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
        </section>

        <section className="mt-14">
          <TermDates
            year="2027 to 2028"
            note="Provisional until the governors confirm them in March 2027. The half terms and the bank holidays will not move; the INSET days might."
            terms={[
              {
                name: "Autumn term",
                from: "Wednesday 1 September",
                to: "Friday 17 December",
                closures: [
                  { when: "Monday 30 and Tuesday 31 August", reason: "INSET days — provisional" },
                  { when: "25 to 29 October", reason: "Half term" },
                ],
              },
              {
                name: "Spring term",
                from: "Tuesday 4 January",
                to: "Friday 31 March",
                closures: [
                  { when: "Monday 3 January", reason: "INSET day — provisional" },
                  { when: "14 to 18 February", reason: "Half term" },
                ],
              },
              {
                name: "Summer term",
                from: "Monday 17 April",
                to: "Friday 21 July",
                closures: [
                  { when: "Monday 1 May", reason: "Bank holiday" },
                  { when: "29 May to 2 June", reason: "Half term" },
                ],
              },
            ]}
          />
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="Why there are INSET days at all"
            title="Five a year, and they are statutory"
            description="Every school in England has five days for staff training, set by the governors. They are not extra holiday and they cannot be removed."
          />
          <p className="mt-5 max-w-2xl leading-relaxed text-muted-foreground">
            We put two at the start of September and one at the end of July, which means the days
            fall next to a holiday rather than in the middle of a working week. Two are held back
            for training that has to happen in term time.
          </p>
        </section>

        <section className="mt-14">
          <SectionHeader title="Date questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Are these the same as the council's dates?",
                  answer:
                    "The terms and half terms are. The INSET days are ours and differ from other Sheffield schools, which matters if you have children at two of them — check both.",
                },
                {
                  question: "When is the last day of the summer term?",
                  answer: "Wednesday 21 July 2027, and school finishes at the normal time. We do not do a half-day finish; it causes more childcare problems than it solves.",
                },
                {
                  question: "Can I have a printable version?",
                  answer: "This page prints on one sheet in black and white, deliberately. It is designed to go on a fridge.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="/">Back to the parent page</a>
            {" · "}
            <a className="underline underline-offset-4" href="/news">Letters home</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
