// news /story — one article, read properly. max-w-prose on the body, because a
// news column at 6xl is unreadable and every newsroom knows it.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Figure } from "@/components/ui/figure";
import { SafeImage } from "@/components/ui/safe-image";
export const Route = createFileRoute("/story")({ component: P });
function P() {
  return (
    <SiteChrome name="The Sheffield Wire" tagline="Local reporting, four journalists, no owner in London."
      links={[{ label: "Home", href: "/" }, { label: "Council", href: "/section" }]}
      action={{ label: "Subscribe — £6/month", href: "/" }}>
      <article className="mx-auto max-w-3xl px-6 py-14">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Planning</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Council approves the Attercliffe scheme after four years of objections
        </h1>
        <p className="mt-5 text-xl leading-relaxed text-muted-foreground">
          Nine hundred homes, a school and a tram extension — and the eleven conditions that got it over
          the line at half past nine last night.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 border-y border-border py-4 text-sm">
          <span className="font-medium">Sam Okonkwo</span>
          <span className="text-muted-foreground">Reporter</span>
          <span className="text-muted-foreground">· 2 hours ago · 6 min read</span>
        </div>
        <SafeImage className="mt-8" src={null} alt="The Attercliffe site seen from the tram bridge" ratio="16/9" />
        <p className="mt-2 text-sm text-muted-foreground">
          The site from the tram bridge. Everything east of the crane is in the outline permission.
        </p>
        <div className="mt-10 space-y-6 text-lg leading-relaxed">
          <p>
            Planning committee sat for four hours on Tuesday evening and approved the outline application by
            seven votes to four, with one abstention, ending a process that began with a scoping opinion in
            the spring of 2022.
          </p>
          <p>
            The permission covers 900 homes across eleven blocks, a two-form-entry primary, and — the part
            that took the longest — a commitment to fund the tram extension as far as the site's northern
            boundary rather than to the boundary of the neighbouring development.
          </p>
          <Figure src={null} alt="The eleven conditions, projected in the committee room"
            caption="The eleven conditions, projected in the committee room at 21:14."
            credit="Sam Okonkwo" ratio="4/3" />
          <p>
            Objectors, of whom 340 wrote in, focused on two things: the loss of the informal green space at
            the eastern edge, and the sequencing of the tram works against occupation of the first blocks.
            Both are now conditions rather than promises, which is the material change from the version
            refused in November.
          </p>
          <p>
            Councillor Weaver, who moved approval, said the committee had "run out of ways to improve it
            without losing it altogether". Councillor Okpara, voting against, said the affordable
            proportion had "gone from 30% to 18% in four years and nobody has explained where it went".
          </p>
          <p>
            The developer has twelve months to submit reserved matters. On the current programme, the first
            residents move in during 2029 and the tram extension opens the year after — although the tram
            works themselves are subject to a separate funding decision that has not yet been taken.
          </p>
        </div>
        <div className="mt-12 border-t border-border pt-8">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Next</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            <a className="hover:underline" href="/section">The eleven conditions, in plain English</a>
          </h2>
        </div>
      </article>
    </SiteChrome>
  );
}
