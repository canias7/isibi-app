// professional-body /register — find a member. The register is the body's real
// product: a client checking whether somebody is who they say they are. So the
// search is the page, and a LAPSED entry stays visible rather than vanishing.
import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Faq } from "@/components/ui/faq";
import { ResultCount } from "@/components/ui/result-count";
import { SearchFacets } from "@/components/ui/search-facets";
import { SearchInput } from "@/components/ui/search-input";
import { SectionHeader } from "@/components/ui/section-header";
import { cn } from "@/lib/utils";
export const Route = createFileRoute("/register")({ component: P });
type Entry = { name: string; grade: string; post: string; where: string; since: number; lapsed?: boolean };
const REGISTER: Entry[] = [
  { name: "Ayesha Iqbal", grade: "Member", post: "MCIBS", where: "Sheffield", since: 2014 },
  { name: "Daniel Okonkwo", grade: "Fellow", post: "FCIBS", where: "Leeds", since: 2003 },
  { name: "Ruth Pemberton", grade: "Member", post: "MCIBS", where: "Manchester", since: 2018 },
  { name: "Graham Vasey", grade: "Associate", post: "ACIBS", where: "Doncaster", since: 2021 },
  { name: "Yolanda Beck", grade: "Member", post: "MCIBS", where: "Sheffield", since: 2011 },
  { name: "Stephen Halliwell", grade: "Member", post: "MCIBS", where: "Chesterfield", since: 2009, lapsed: true },
  { name: "Priya Ramanathan", grade: "Fellow", post: "FCIBS", where: "Nottingham", since: 1999 },
  { name: "Marcus Ellery", grade: "Associate", post: "ACIBS", where: "Barnsley", since: 2023 },
];
function P() {
  const [q, setQ] = React.useState("");
  const [grades, setGrades] = React.useState<string[]>([]);
  const shown = REGISTER.filter((e) =>
    (!q || (e.name + e.where).toLowerCase().includes(q.toLowerCase())) &&
    (!grades.length || grades.includes(e.grade)));
  return (
    <SiteChrome name="Chartered Institute of Building Services" tagline="14,200 members. The register, the grades, and what each one actually asks of you."
      links={[{ label: "Home", href: "/" }, { label: "Apply", href: "/apply" }]}
      action={{ label: "Which grade am I?", href: "/#grades" }}>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="The register" title="Check somebody, in one search"
          description="This is what the institute is for. A client wants to know whether the person quoting them is who they say they are, and a register that is hard to search is a register that protects nobody." />

        <div className="mt-10 grid gap-10 lg:grid-cols-[240px_1fr]">
          <aside className="space-y-6">
            <SearchFacets title="Grade" selected={grades}
              onToggle={(v) => setGrades((s) => s.includes(v) ? s.filter((x) => x !== v) : [...s, v])}
              options={[
                { value: "Fellow", label: "Fellow", count: 2 },
                { value: "Member", label: "Member", count: 4 },
                { value: "Associate", label: "Associate", count: 2 },
              ]} />
            <div className="rounded-lg border border-border bg-muted/50 p-4">
              <p className="text-sm font-medium">Student and Affiliate are not listed</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Deliberately. Neither grade is assessed against anything, so publishing them as a
                register entry would let somebody present an unassessed subscription as a
                credential — which is the exact misuse this register exists to prevent.
              </p>
            </div>
          </aside>
          <div>
            <SearchInput value={q} onChange={setQ} placeholder="Name, or a town" />
            <ResultCount className="mt-4" total={shown.length} noun="member" filtered={shown.length !== REGISTER.length} />
            <ul className="mt-4 divide-y divide-border border-y border-border">
              {shown.map((e) => (
                <li key={e.name} className="flex flex-wrap items-baseline gap-x-6 gap-y-1 py-4">
                  <span className="min-w-0 flex-1">
                    <span className={cn("text-base", e.lapsed ? "text-muted-foreground" : "font-medium")}>
                      {e.name}
                      <span className="ml-2 text-sm font-normal text-muted-foreground">{e.post}</span>
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      {e.grade} since {e.since} · {e.where}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    {/* A LAPSED ENTRY STAYS VISIBLE. Deleting it means a client
                        checking somebody who let their membership go in March
                        finds nothing at all — which reads as "never a member"
                        and is a different and more forgiving answer. */}
                    <span className={e.lapsed ? "block text-sm font-medium" : "block text-sm text-muted-foreground"}>
                      {e.lapsed ? "Lapsed — not currently a member" : "In good standing"}
                    </span>
                    {e.lapsed && (
                      <span className="block text-sm text-muted-foreground">Subscription ended April 2025</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            {shown.length === 0 && (
              <p className="mt-4 text-base text-muted-foreground">
                Nobody by that name. A person may be a member under a different spelling, or they may
                not be a member at all — if somebody has told you they are and they are not here,
                that is worth an email to us.
              </p>
            )}
            <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              The register updates within a week of any committee decision and within 24 hours of a
              lapse or a removal. It shows grade, town and date of admission — never an address, a
              phone number or an employer, because a public register is a verification tool and not
              a directory to be scraped.
            </p>
          </div>
        </div>

        <section className="mt-14 border-t border-border pt-10">
          <div className="max-w-3xl">
            <SectionHeader eyebrow="Asked often" title="About the register" />
            <Faq className="mt-6" items={[
              { question: "Somebody says they are a member and they are not on here.", answer: "Then they are not one, or they are a Student or Affiliate — neither of which is assessed and neither of which entitles anybody to letters. Email us with the name and we will check and, if it warrants it, act." },
              { question: "Why do you still list lapsed members?", answer: "Because removing them answers a client's question with silence, and silence reads as 'never a member'. Lapsed is a different fact from never, and both of them are worth knowing." },
              { question: "Can I be removed from the register?", answer: "You can resign, and then you appear as lapsed for two years and then not at all. You cannot be a member and be unlisted — the register is the point of the membership." },
              { question: "Do you publish disciplinary findings?", answer: "Findings that result in removal or suspension, yes, for five years, with the date and the finding. Complaints that were not upheld are never published, and neither are the names of complainants." },
              { question: "Is there an API?", answer: "No, and there will not be one. A register that can be pulled in bulk becomes a marketing list within a month, and our members did not consent to that when they joined." },
              { question: "How do I report someone using the letters wrongly?", answer: "Email the name and where you saw it. It is usually somebody who lapsed and forgot rather than anybody dishonest, and it is nearly always fixed by one phone call." },
            ]} />
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}