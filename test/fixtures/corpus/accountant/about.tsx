// accountant /about — the firm itself: history, regulation, how it charges.
// This is the page trust is checked against — the registration numbers a
// cautious client actually looks up live here, stated so they can be.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AwardBadge } from "@/components/ui/award-badge";
import { Timeline } from "@/components/ui/timeline";
import { TrustStrip } from "@/components/ui/trust-strip";
export const Route = createFileRoute("/about")({ component: P });
const CHROME = {
  name: "Hartley & Voss", tagline: "Chartered accountants, est. 1987.",
  links: [{ label: "Home", href: "/" }, { label: "What we do", href: "/services" }, { label: "The firm", href: "/about" }, { label: "Contact", href: "/contact" }],
  action: { label: "Free consultation", href: "/contact" },
};
function P() {
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">The firm, since 1987</h1>
        <div className="prose prose-sm mt-4 max-w-none text-foreground">
          <p>Margaret Hartley opened the practice above a print shop on Division Street with one filing cabinet and a rule that still holds: a partner does the work, and the client can always ring the person whose name is on it. Her daughter Eleanor took over in 2014; Jakob joined as the second partner in 2018.</p>
          <p>We stay two partners on purpose. Growth would mean juniors on your file, and the whole point of this firm is that there aren't any.</p>
        </div>
        <section className="mt-8">
          <h2 className="text-lg font-medium">Thirty-seven years, briefly</h2>
          <Timeline className="mt-4" items={[
            { title: "Opened on Division Street", when: "1987", description: "One cabinet, forty clients by Christmas." },
            { title: "Moved to Paradise Square", when: "1996", description: "Same square ever since." },
            { title: "Eleanor becomes senior partner", when: "2014" },
            { title: "Jakob joins — tax becomes a specialism", when: "2018" },
            { title: "Fixed monthly fees for every client", when: "2021", description: "Time-sheets abolished. Nobody misses them." },
          ]} />
        </section>
        <section className="mt-8">
          <h2 className="text-lg font-medium">Check us, please</h2>
          <TrustStrip className="mt-3" items={[
            { title: "ICAEW firm C008841312", description: "Verifiable on the ICAEW register" },
            { title: "Registered auditors — no", description: "We refer audits out; saying so saves a meeting" },
            { title: "PI insurance £2m", description: "Hiscox, renewed each May, certificate on request" }]} />
          <div className="mt-4 flex flex-wrap gap-2">
            <AwardBadge title="Yorkshire Accountancy Awards — Small Firm" year="2023" issuer="Shortlisted" />
            <AwardBadge title="ICAEW Practice Assurance" year="2026" issuer="Passed, as every year" />
          </div>
        </section>
        <section className="mt-8 rounded-xl border bg-muted/40 p-5 text-sm">
          <h2 className="font-medium">How we charge, in one paragraph</h2>
          <p className="mt-2 text-muted-foreground">A fixed monthly fee, agreed in writing before any work starts, reviewed once a year at the annual meeting. Phone calls and emails are included — billing for questions teaches clients not to ask them, which is how expensive mistakes incubate. <a className="font-medium underline underline-offset-4" href="/services">The starting figures are public.</a></p>
        </section>
      </div>
    </SiteChrome>
  );
}
