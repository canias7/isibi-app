// school /admissions — what the oversubscription criteria actually MEAN, in
// order, with the distance that got in last year.
//
// EVERY SCHOOL PUBLISHES THE CRITERIA AND NONE PUBLISHES THE CUT-OFF. "Priority
// 5: distance from the school" is not information; "the furthest child admitted
// last year lived 1.4 miles away" is. A family choosing a house on the strength
// of a catchment deserves the number, and the school has it.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { InspectionRating } from "@/components/ui/inspection-rating";
import { ContactCard } from "@/components/ui/contact-card";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/admissions")({ component: P });

const CRITERIA = [
  { n: "1", what: "Children in care, or previously in care", detail: "Including any child adopted from care, here and overseas. This is a legal requirement at every school in England." },
  { n: "2", what: "Children with an EHC plan naming this school", detail: "Admitted regardless of the number on roll. They are not counted against the 30 places." },
  { n: "3", what: "Exceptional medical or social need", detail: "Needs written evidence from a doctor or social worker saying why THIS school specifically. Two or three applications a year and usually one is upheld." },
  { n: "4", what: "A sibling already at the school in September", detail: "The most common route in. A sibling leaving in July does not count, which catches people out." },
  { n: "5", what: "Distance, measured door to door by the council", detail: "Straight line, not walking route. Last September the furthest child admitted lived 1.4 miles away; the year before it was 2.1." },
];

const DATES = [
  { when: "Now to 15 January", what: "Apply through Sheffield City Council, not through us. We cannot take an application directly and one sent to us is not an application." },
  { when: "16 April", what: "Offers go out by email in the evening. Do not ring us that day — we find out at the same moment you do." },
  { when: "By 30 April", what: "Accept or decline. Declining does not affect an appeal or a waiting-list position." },
  { when: "May onwards", what: "Waiting list runs on the same criteria, reordered each time somebody joins it. It is not first come, first served." },
  { when: "June", what: "Appeals heard by an independent panel. We do not sit on it and cannot influence it." },
];

function P() {
  return (
    <SiteChrome
      name="Bolsterstone Primary"
      tagline="Thirty places a year. The criteria, and the distance that got in."
      links={[
        { label: "Home", href: "/" },
        { label: "Term dates", href: "/term-dates" },
        { label: "News", href: "/news" },
      ]}
      action={{ label: "Book a visit", href: "#visit" }}
    >
      <div className="mx-auto max-w-4xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">Admissions</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Thirty places in Reception each September. We were oversubscribed in three of the last
          five years, and below is what that actually meant rather than only what the policy says.
        </p>

        <section className="mt-12">
          <SectionHeader
            eyebrow="If there are more than thirty"
            title="The criteria, in order"
            description="They are applied strictly in this sequence. Nobody at the school has any discretion over any of it, which is worth knowing before ringing to make a case."
          />
          <ol className="mt-6 divide-y divide-border border-y border-border">
            {CRITERIA.map((c) => (
              <li key={c.n} className="flex gap-5 py-5">
                <span className="w-6 shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">{c.n}</span>
                <div className="min-w-0">
                  <p className="font-medium">{c.what}</p>
                  <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{c.detail}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            That 1.4 mile figure is the single most useful number on this page and almost no school
            publishes it. It moves every year and it is not a catchment boundary — it is simply
            where the thirtieth child happened to live.
          </p>
        </section>

        <section className="mt-14">
          <SectionHeader eyebrow="When" title="The year, and who to send things to" />
          <ul className="mt-6 divide-y divide-border border-y border-border">
            {DATES.map((d) => (
              <li key={d.when} className="grid gap-1 py-4 md:grid-cols-[minmax(0,13rem)_1fr] md:gap-8">
                <p className="font-medium tabular-nums">{d.when}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{d.what}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="The inspection"
            title="What Ofsted said, and the link to read it yourself"
            description="Published in full rather than summarised into the one adjective we liked."
          />
          <div className="mt-8">
            <InspectionRating
              body="Ofsted"
              rating="Good"
              when="March 2024"
              reportUrl="https://reports.ofsted.gov.uk"
              domains={[
                { name: "Quality of education", rating: "Good" },
                { name: "Behaviour and attitudes", rating: "Outstanding" },
                { name: "Personal development", rating: "Good" },
                { name: "Leadership and management", rating: "Good" },
                { name: "Early years", rating: "Outstanding" },
              ]}
              note="The report asks us to improve the consistency of feedback in writing across key stage 2. It is a fair point, it is our current priority, and it is in the September newsletter."
            />
          </div>
        </section>

        <section className="mt-14" id="visit">
          <div className="grid items-start gap-10 md:grid-cols-2">
            <div>
              <SectionHeader eyebrow="Come and look" title="Any Tuesday morning in the autumn term" />
              <p className="mt-5 max-w-lg leading-relaxed text-muted-foreground">
                09:30, about forty minutes, with the head. During the school day and in the
                classrooms rather than an evening in an empty hall — you learn more from a Tuesday
                than from anything on this website.
              </p>
              <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Ring the office to say you are coming. No need to book weeks ahead and nobody is
                turned away for turning up.
              </p>
            </div>
            <ContactCard
              address="Sunny Bank, Bolsterstone, Sheffield S36 3ZW"
              phone="0114 288 3014"
              email="office@bolsterstone.sheffield.sch.uk"
              mapUrl="https://www.openstreetmap.org/search?query=Bolsterstone%20Sheffield"
            />
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader title="Admissions questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Does living in the village guarantee a place?",
                  answer:
                    "No, and there is no catchment area in the formal sense. Distance is the fifth criterion and in a sibling-heavy year it has reached under a mile. Most village children get in; it is not a guarantee.",
                },
                {
                  question: "Is it worth going on the waiting list?",
                  answer:
                    "Yes. It is reordered by the criteria every time somebody joins, so a family moving closer in June goes above one that joined in April. Two or three places usually come up before September.",
                },
                {
                  question: "Do you take children mid-year?",
                  answer:
                    "Whenever there is space in the year group, which there often is above Reception. Ring the office — in-year admissions come to us directly rather than through the council.",
                },
                {
                  question: "Is an appeal worth making?",
                  answer:
                    "For Reception, rarely — infant class size law caps it at 30 and a panel can only allow an appeal on very narrow grounds. Above Year 2 the panel has real discretion and appeals do succeed.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="/">The parent page</a>
            {" · "}
            <a className="underline underline-offset-4" href="/term-dates">Term dates</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
