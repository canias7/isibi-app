// podcast/single-column-capture /about — the family calls this "the page other
// media checks". For a newsletter the people checking it are not other media —
// they are readers deciding whether to hand over an address, and the two
// questions they have are who is this and what happens to my email.
//
// So the answer to the second one is not a link to a privacy policy. It is on
// the page, in a list, naming the company that holds the address.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { ContactCard } from "@/components/ui/contact-card";
import { Faq } from "@/components/ui/faq";
import { KeyPoints } from "@/components/ui/key-points";
import { PressQuote } from "@/components/ui/press-quote";
import { ProfileCard } from "@/components/ui/profile-card";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { SpecList, SpecRow } from "@/components/ui/spec-row";
import { StatsBand } from "@/components/ui/stats-band";
import { Timeline } from "@/components/ui/timeline";
export const Route = createFileRoute("/about")({ component: P });
function P() {
  return (
    <SiteChrome name="Kerbside" tagline="A weekly letter about how British towns actually work."
      links={[{ label: "Subscribe", href: "#/" }, { label: "One issue", href: "#/episode" }, { label: "All 148", href: "#/archive" }]}
      action={{ label: "Subscribe", href: "#/" }}>

      <div className="mx-auto max-w-3xl px-6 py-12">
        <SectionHeader eyebrow="About" title="One person, a lot of committee papers"
          description="Kerbside is written by Rosalind Achebe in Nottingham. There is no team, no company behind it and no plan for either." />

        <div className="mt-8 grid gap-8 sm:grid-cols-[200px_1fr] sm:items-start">
          <SafeImage src={null} alt="Rosalind Achebe" ratio="1/1" className="rounded-xl" />
          <div>
            <ProfileCard name="Rosalind Achebe" email="ros@kerbside.email"
              meta="Writes Kerbside. Nine years a local government reporter at the Nottingham Post and then the Local Democracy Reporting Service." />
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              I read the agendas and minutes of nine local authorities every week, plus the
              planning and licensing lists. Roughly one item in twenty contains something that
              would change how somebody feels about where they live, and almost none of it is
              reported anywhere, because the reporters who used to do it were made redundant
              between 2009 and 2016 and were not replaced.
            </p>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              This is not a campaign and I do not have a position on most of what I write about.
              Several issues have concluded that a thing residents were furious about is in fact
              fine, and those are the ones I am proudest of.
            </p>
          </div>
        </div>

        <StatsBand className="mt-10" items={[
          { value: "148", label: "Issues since March 2023" },
          { value: "9", label: "Councils read every week" },
          { value: "61", label: "FOI requests made" },
          { value: "1", label: "Person" },
        ]} />

        {/* WHAT HAPPENS TO THE ADDRESS, on the page, naming the company.
            The subscribe form above is asking for a two-year commitment to
            somebody's inbox; answering that with a link to a policy is not an
            answer, it is a place to put one. */}
        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="Your address" title="Who has it, what is done with it, and how to get rid of it"
            description="Written out rather than linked to, because the whole thing fits in six lines and a policy page is where this goes to be unread." />
          <div className="mt-6">
            <SpecList>
              <SpecRow label="Who holds it" value="Buttondown" note="A US mail provider. They are the only third party and they are named here rather than in a policy" highlight />
              <SpecRow label="What else is stored" value="Nothing" note="No name, no location, no employer. The form asks for an address because that is all there is" highlight />
              <SpecRow label="Tracking" value="Opens only" note="A one-pixel image. It is how I know the open rate is 62% and it is the only measurement there is" />
              <SpecRow label="Link tracking" value="None" note="Links go where they say. There is no redirector and no per-reader identifier in any URL" />
              <SpecRow label="Sold or shared" value="Never" note="There is no advertiser and no second list, so there is nobody to share it with" />
              <SpecRow label="Leaving" value="One click" note="At the bottom of every issue. No confirmation page and it takes effect immediately" />
              <SpecRow label="Deletion" value="Reply and ask" note="Unsubscribing suppresses; asking deletes. Same day, and I will confirm it" />
            </SpecList>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="Money" title="There is not any, and that is the arrangement" />
          <div className="mt-6">
            <KeyPoints title="Four things about how this is paid for" points={[
              "It is free and there is no paid tier. Charging would mean writing for the people who pay.",
              "No sponsors. Four have asked; one offered a sum I thought about for a whole evening, and they build roads.",
              "It costs me about £34 a month in mail sending and £61 a year in FOI-related printing.",
              "My income is freelance reporting elsewhere, which is listed below so you can see who pays me.",
            ]} />
          </div>
          <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
            I have written for the Guardian, the Local Democracy Reporting Service and the Bureau
            of Investigative Journalism in the last two years. If an issue touches something I have
            been paid to write about, it says so in the first paragraph — that has happened three
            times.
          </p>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="How it got here" title="Three years, and it very nearly stopped twice" />
          <div className="mt-6">
            <Timeline items={[
              { when: "March 2023", title: "Issue 1, to 40 people", description: "Mostly former colleagues. It was about a car park and it was far too long." },
              { when: "November 2023", title: "The section 106 issue", description: "Went round several council press offices and took it from 400 to 2,900 in a fortnight." },
              { when: "June 2024", title: "Nearly stopped", description: "Six weeks of no time and no money. Two hundred people replied to an issue asking whether it was worth continuing, which answered it." },
              { when: "February 2025", title: "First correction", description: "A figure wrong by a factor of ten. Corrected in the next issue at the top, which is now the policy." },
              { when: "January 2026", title: "10,000", description: "No launch, no announcement, and I only noticed a fortnight later." },
              { when: "Now", title: "148 issues, 11,400 readers", description: "Still Thursday, still one person, still no sponsor." },
            ]} />
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="Mentioned by" title="Which is the part other media checks" />
          <div className="mt-6 space-y-4">
            <PressQuote quote="The best thing written about English local government by anybody, and it is a newsletter run by one person out of a spare room in Nottingham."
              source="Private Eye, Rotten Boroughs, April 2026" />
            <PressQuote quote="Kerbside's section 106 work prompted freedom of information requests in at least eleven authorities."
              source="Local Government Chronicle, September 2025" />
          </div>
          <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
            Happy to be quoted, happy to send the underlying documents, and happy to say when I
            think a story is not there. Reply to any issue or use the address below — I answer
            everything, usually within a day.
          </p>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="grid gap-8 sm:grid-cols-2">
            <div>
              <SectionHeader eyebrow="Get in touch" title="One address, and I read it" />
              <div className="mt-5">
                <ContactCard email="ros@kerbside.email" address="Kerbside, 12 Alfreton Road, Nottingham NG7 3NL" />
              </div>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                A postal address because the mail rules require one and because it is the honest
                thing to publish. It is a mail-forwarding box rather than my house, for reasons
                that will be obvious to anybody who has written about a planning application.
              </p>
            </div>
            <div>
              <SectionHeader eyebrow="Pitching" title="Yes, and here is what works" />
              <div className="mt-5">
                <KeyPoints title="Before you send it" points={[
                  "A document beats a description. An agenda item number is perfect.",
                  "I cannot do anything with 'my council is terrible' and I get four of those a week.",
                  "Anonymity is fine and I have never broken it. Say so in the first line.",
                  "I will tell you if I think there is no story, which is most of the time and is not a brush-off.",
                ]} />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="Asked often" title="About the letter itself" />
          <Faq className="mt-6" items={[
            { question: "Why only nine councils?", answer: "Because it is the number one person can read properly every week. A tenth would mean skimming all ten, and skimming a committee agenda is exactly how the thing on page 94 gets missed." },
            { question: "Will you cover my area?", answer: "Probably not as a matter of routine, and yes if you send me something specific. About a third of issues are outside the nine, on a tip." },
            { question: "Do you make corrections?", answer: "At the top of the next issue, in full, naming what was wrong. Four in 148. The archive copy is corrected too, with a note saying it was — never silently." },
            { question: "Can I republish it?", answer: "Yes, in full, with a link, no permission needed. Local papers do this occasionally and it is entirely fine — the point is that people read it, not that they read it here." },
            { question: "Is there an RSS feed?", answer: "Yes, and it carries the whole text rather than a teaser. It is at /feed.xml and it will not be taken away." },
            { question: "Why is it called Kerbside?", answer: "It was going to be about bin collections and it took about four issues to stop being about bin collections. The name stayed because renaming a thing 11,400 people recognise is a bad trade." },
          ]} />
        </section>
      </div>
    </SiteChrome>
  );
}
