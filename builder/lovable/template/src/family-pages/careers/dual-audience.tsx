// careers/dual-audience — STAFFING. The roles-first family has one reader: a
// candidate. A recruitment agency has two, and they want opposite things — a
// candidate wants the roles, an employer wants to know what a placement costs
// and how fast it happens. So the page splits at the top into two entry paths
// of EQUAL weight, and neither is the secondary one.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { FilterBar } from "@/components/ui/filter-bar";
import { JobCard } from "@/components/ui/job-card";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { StatsBand } from "@/components/ui/stats-band";
import { Steps } from "@/components/ui/steps";
export const Route = createFileRoute("/dual-audience")({ component: P });
export const ROLES = [
  { title: "CNC machinist, nights", team: "Engineering", location: "Rotherham", type: "Permanent", salary: "£38–42k", postedAt: "2026-08-01", tags: ["Mazak", "Nights"] },
  { title: "Maintenance electrician", team: "Engineering", location: "Sheffield S9", type: "Permanent", salary: "£41k + call-out", postedAt: "2026-07-31", tags: ["18th edition", "Shift"] },
  { title: "Production planner", team: "Operations", location: "Chesterfield", type: "Permanent", salary: "£34–38k", postedAt: "2026-07-30", tags: ["SAP"] },
  { title: "Welder/fabricator, coded", team: "Fabrication", location: "Barnsley", type: "Temp to perm", salary: "£19.50/hr", postedAt: "2026-07-29", tags: ["MIG", "Coded"] },
  { title: "Quality inspector", team: "Quality", location: "Sheffield S35", type: "Permanent", salary: "£32–35k", postedAt: "2026-07-28", tags: ["CMM", "AS9100"] },
  { title: "Warehouse team leader", team: "Logistics", location: "Doncaster", type: "Permanent", salary: "£31k", postedAt: "2026-07-24", tags: ["Counterbalance"] },
];
function P() {
  return (
    <SiteChrome name="Attercliffe Recruitment" tagline="Engineering and manufacturing recruitment across South Yorkshire since 2004."
      links={[{ label: "One role", href: "#/role" }, { label: "About us", href: "#/life" }]}>

      {/* TWO DOORS, SAME SIZE. The whole variant. A staffing site that leads
          with "find your next role" and puts employers in the footer is a
          staffing site earning from one side of a two-sided business. */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Since 2004 · 41 live roles · REC member</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight text-balance">
            Two things happen here, and they are not the same thing
          </h1>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="flex flex-col rounded-xl border border-border p-7">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">If you are looking for work</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">41 roles, with the salary on every one</h2>
              <p className="mt-3 flex-1 text-base leading-relaxed text-muted-foreground">
                No "competitive", no "DOE", and no roles that turn out not to exist. We will not
                send your CV anywhere without asking you first, which is a low bar that most of
                this industry fails to clear.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="#roles">See the 41 roles</a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#/role">What an application is like</a>
              </div>
            </div>

            <div className="flex flex-col rounded-xl border border-border p-7">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">If you are hiring</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">18% of first year, and 22 days to placement</h2>
              <p className="mt-3 flex-1 text-base leading-relaxed text-muted-foreground">
                Published, because you are going to ask in the first thirty seconds of the call and
                there is no version of this where hiding it helps you. Twelve-week rebate, and we
                do not put four agencies' CVs of the same person in front of you.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="#hiring">What it costs</a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#/life">How we work</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="roles" className="mx-auto max-w-6xl px-6 py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeader eyebrow="For candidates" title="Six of the forty-one, newest first"
            description="Every one is a real vacancy with a real client behind it. We do not advertise roles we have not been instructed on, which is why this list is shorter than some." />
          <FilterBar filters={[{ key: "perm", label: "Permanent" }, { key: "sy", label: "South Yorkshire" }]} onRemove={() => {}} onClear={() => {}} />
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ROLES.map((r) => <JobCard key={r.title} {...r} href="#/role" />)}
        </div>
        <div className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <h3 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">What we will not do with your CV</h3>
            <ul className="mt-3 divide-y divide-border border-y border-border text-base">
              <li className="py-3">Send it anywhere without naming the company and asking you first</li>
              <li className="py-3">Put you forward for something you have said you do not want, to make up a shortlist</li>
              <li className="py-3">Ring your current employer for a reference before you have an offer</li>
              <li className="py-3">Keep it on file for years — we ask every twelve months whether to hold it, and delete it if you do not answer</li>
              <li className="py-3">Advertise a role at £38k and then tell you the client will only pay £33k</li>
            </ul>
          </div>
          <SafeImage src={null} alt="The office on Attercliffe Road" ratio="4/3" />
        </div>
      </section>

      <section id="hiring" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <SectionHeader eyebrow="For employers" title="The fee, the rebate and the timescale"
            description="All three on the page. Every agency has these numbers and almost none publish them, which is why the first call is thirty minutes of dancing." />
          <StatsBand className="mt-8" items={[
            { value: "18%", label: "Of first-year salary, permanent" },
            { value: "22 days", label: "Median instruction to accepted offer" },
            { value: "12 weeks", label: "Rebate, sliding, in writing" },
            { value: "1 in 3", label: "Roles we decline to take on" },
          ]} />
          <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_1fr]">
            <div>
              <h3 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">What the 18% buys</h3>
              <ul className="mt-3 divide-y divide-border border-y border-border text-base">
                <li className="py-3">
                  <span className="font-medium">Three to five people, not fifteen</span>
                  <span className="block text-sm text-muted-foreground">Screened by somebody who has been in a machine shop. A long list is an agency moving the sifting onto you.</span>
                </li>
                <li className="py-3">
                  <span className="font-medium">Exclusivity is optional and cheaper</span>
                  <span className="block text-sm text-muted-foreground">15% if we are the only agency on it. Not because we want the lock-in — because four agencies on one role means four of us ringing the same fifty people.</span>
                </li>
                <li className="py-3">
                  <span className="font-medium">A sliding rebate, written down</span>
                  <span className="block text-sm text-muted-foreground">100% inside 4 weeks, 50% to 8, 25% to 12. Most agencies offer a replacement rather than money, which is not the same thing.</span>
                </li>
                <li className="py-3">
                  <span className="font-medium">Temp-to-perm with no transfer fee after 12 weeks</span>
                  <span className="block text-sm text-muted-foreground">£19.50 an hour all-in on the welder above. The transfer fee is the charge that catches people and ours stops.</span>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">How it goes</h3>
              <Steps className="mt-3" items={[
                { title: "A visit, not a call", description: "We come and stand on the floor. It is the only way to describe a job to somebody honestly, and it is why one role in three we then decline." },
                { title: "Three to five, in a week", description: "With a written note on each saying why, including the reservations." },
                { title: "You interview, we stay out of it", description: "No coaching the candidate on what to say. If the fit is wrong we would rather find out at the interview than at week six." },
              ]} />
              <div className="mt-8 rounded-lg border border-border bg-card p-5">
                <p className="text-base font-medium">Why we turn down a third of the roles we are offered</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  Usually the salary. If a job is advertised at £5k under what the market is paying,
                  we can spend six weeks failing to fill it and bill you nothing, or we can say so on
                  the first visit. The second is better for both of us and it is why our 22 days is
                  22 rather than 60.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
