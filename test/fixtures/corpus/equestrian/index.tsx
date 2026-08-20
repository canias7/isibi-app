// equestrian — IS-THERE-A-SPACE-FIRST, full-bleed hero. "Spaces available" is
// six months old on every yard's website in the country, so the count is a
// number and the packages state what they do NOT include — which is the field
// that ends up in a county Facebook group.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Faq } from "@/components/ui/faq";
import { LiveryPackages } from "@/components/ui/livery-packages";
import { LocationCard } from "@/components/ui/location-card";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { TestimonialGrid } from "@/components/ui/testimonial";
export const Route = createFileRoute("/")({ component: P });
export const PACKAGES = [
  {
    name: "DIY", price: 48, spaces: 2,
    includes: ["Stable, 12ft × 12ft, rubber matted", "Turnout as below", "Hay and straw storage in the barn", "Use of the arena and the horse walker", "Muck heap emptied by us"],
    excludes: ["All feeding, mucking out and turning out — that is you, twice a day", "Hay, haylage, bedding and hard feed", "Rugs on and off", "Holding for the farrier or the vet"],
    note: "The cheapest and the most demanding. Nobody has ever regretted DIY who lives within ten minutes and works locally; almost everybody who commutes to Leeds has.",
  },
  {
    name: "Part livery", price: 122, spaces: 1,
    includes: ["Everything in DIY", "Morning mucking out and turnout, seven days", "Hay and haylage fed", "Rugs changed morning and evening", "Bedding included — shavings"],
    excludes: ["Evening stable duties at weekends, which are yours", "Hard feed", "Holding for the farrier", "Clipping, £45, and it is worth every penny"],
    note: "What most working owners are actually on. The weekend evenings being yours is the part people forget when comparing us to a yard forty pounds dearer.",
  },
  {
    name: "Full livery", price: 186, spaces: 0, waiting: 3,
    includes: ["Everything, twice a day, seven days", "Hay, haylage, bedding and hard feed", "Rugs, turnout, bringing in", "Holding for the farrier and the vet", "Basic first aid and poulticing", "Exercise twice a week if wanted"],
    excludes: ["Shoeing, worming, dentistry and vet fees", "Schooling beyond hacking — £28 a session", "Box rest nursing, which is £30 a day extra and genuinely is a full-time job"],
    note: "Full for the last two years. Three waiting, and a space has come up twice in that time — both went to people on the list.",
  },
  {
    name: "Grass livery", price: 34, spaces: 4,
    includes: ["Field with a shelter, all year", "Water and daily field check", "Use of the arena", "Access to a stable in an emergency"],
    excludes: ["A stable of your own", "Any feeding or rugging", "Hay in winter — £6 a bale from us or bring your own"],
    note: "For natives, retirees and anything that lives out. Not suitable for a clipped or thin-skinned horse, and we will say so rather than take the money.",
  },
];
export const QUOTES = [
  { quote: "The turnout is what I came for. Seven hours minimum, all year, and in February that is the difference between a horse you can ride and one you cannot.", name: "Hannah Beswick", role: "Part livery, three years" },
  { quote: "They told me on the phone that grass livery was wrong for my thoroughbred, before I had booked a viewing. That is the only yard out of five that did.", name: "Ola Adeyemi", role: "Full livery" },
  { quote: "No drama, no cliques, and the yard rules are on a page rather than in somebody's head.", name: "Rachel Sowden", role: "DIY, six years" },
];
function P() {
  return (
    <SiteChrome name="Hollin Busk Livery" tagline="Twenty-two stables, forty acres, and an arena that drains. Above Deepcar."
      links={[{ label: "The yard", href: "/yard" }, { label: "Lessons", href: "/lessons" }, { label: "Find us", href: "#find-us" }]}
      action={{ label: "Is there a space?", href: "#livery" }}>

      <section>
        <SafeImage src={null} alt="The top field and the arena at Hollin Busk" ratio="21/9" />
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">22 stables · 40 acres · BHS approved</p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">
                Seven free today
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                A real number, updated the same day one changes. Ringing four yards to be told
                "sorry, we're full" is most of what looking for livery is, and it is entirely
                avoidable — the count is at the top of this page and so is the waiting list.
              </p>
              <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-4 text-sm sm:grid-cols-3">
                <div><dt className="text-muted-foreground">From</dt><dd className="mt-1 text-lg font-semibold tabular-nums">£34 a week</dd></div>
                <div><dt className="text-muted-foreground">Turnout</dt><dd className="mt-1 text-lg font-semibold">7 hrs, all year</dd></div>
                <div><dt className="text-muted-foreground">Arena</dt><dd className="mt-1 text-lg font-semibold tabular-nums">40 × 20m</dd></div>
              </dl>
              <div className="mt-7 flex flex-wrap gap-3">
                <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="/yard">See the yard</a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="tel:01142889940">Ring 0114 288 9940</a>
              </div>
            </div>
            {/* THE COUNT AND WHAT IS NOT INCLUDED, above everything else. */}
            <div id="livery">
              <LiveryPackages packages={PACKAGES}
                note="Weekly, invoiced monthly in arrears. One month's notice either way and no deposit. Every price includes the arena, the horse walker, the muck heap and the water — a yard charging separately for any of those is charging you twice." />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="Turnout" title="Seven hours a day, every day of the year"
          description="Which is the only claim on this page that other yards would dispute, so here is what it actually means rather than the word 'available'." />
        <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Hours", "Seven minimum, out at 08:00 and in at 15:00 in winter. In summer it is 07:00 to 19:00 and about half the yard is out overnight from May."],
            ["All year", "Including February. Forty acres across nine paddocks on a limestone hillside, so we rotate rather than close — the fields have never been shut in eleven years."],
            ["Groups of three or four", "Matched by temperament, not by owner. Individual turnout is available in two of the paddocks at no extra charge, for anything that needs it."],
            ["Six horses to the acre? No", "Twenty-two horses on forty acres, which is under one to the acre and is why the grazing survives a wet autumn. Ask every yard this number."],
          ].map(([k, v]) => (
            <div key={k} className="border-t border-border pt-4">
              <p className="font-medium">{k}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{v}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="find-us" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="Where" title="Above Deepcar, off Hollin Busk Lane" />
              <LocationCard className="mt-6" name="Hollin Busk Livery"
                address="Hollin Busk Lane, Deepcar, Sheffield, S36 2SG"
                note="Twelve minutes from junction 36. The lane takes a lorry as far as the yard gate and there is turning room for a 7.5t box. Hard standing for eight trailers, free, and nobody has ever had one interfered with." />
              <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
                Hacking is straight out of the gate onto the moor — about eleven miles of bridleway
                without touching a road, which is the reason most people here chose this yard over
                one nearer town. There is a hundred yards of quiet lane at the start and that is all.
              </p>
            </div>
            <div>
              <SectionHeader eyebrow="From the yard" title="Including the one that turned somebody away" />
              <TestimonialGrid className="mt-6" columns={1} items={QUOTES} />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="max-w-3xl">
          <SectionHeader eyebrow="Asked often" title="Before you come and look" />
          <Faq className="mt-6" items={[
            { question: "Can I come and see it?", answer: "Any day between ten and four, no appointment. Walk round on your own if you would rather — plenty do, and it tells you more than being shown round does." },
            { question: "Is there a waiting list for full livery?", answer: "Three at the moment. It has moved twice in two years and both spaces went to people on it. There is no charge to be on it and no obligation when your turn comes." },
            { question: "What is the notice period?", answer: "One month, either way, and no deposit. A yard asking for three months' notice is a yard that expects people to want to leave." },
            { question: "Can I use my own farrier and vet?", answer: "Yes, always, and most people do. We hold for you on full livery and for £8 on the other tiers if you cannot get here." },
            { question: "Are there yard rules?", answer: "Eleven of them, on the yard page, and two are enforced. They are written down rather than living in somebody's head, which is the single most common complaint about small yards." },
            { question: "Do you take stallions?", answer: "No. Twenty-two horses, shared turnout and a lot of teenagers on the yard — it is not the right place and pretending otherwise would be somebody's accident." },
          ]} />
        </div>
      </section>
    </SiteChrome>
  );
}
