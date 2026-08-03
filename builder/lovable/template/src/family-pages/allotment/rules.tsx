// allotment /rules — the tenancy, in the words a tenancy is never written in.
//
// AN ALLOTMENT TENANCY IS A LEGAL DOCUMENT NOBODY READS, and the two rules
// people actually get caught by — cultivation and bonfires — are clauses 4 and
// 11 of a PDF. Printed plainly, with which are LEASE conditions the committee
// cannot bend and which are the association's own preferences, somebody can
// tell the difference between "we ask" and "you will lose the plot".
//
// AND THE COMMITTEE IS PUBLISHED WITH ITS VACANCIES. Three empty posts on a
// page is the only recruitment advert an association like this ever runs, and
// leaving them off makes a struggling committee look like a full one.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { HouseRules } from "@/components/ui/house-rules";
import { CommitteeList } from "@/components/ui/committee-list";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/rules")({ component: P });

function P() {
  return (
    <SiteChrome
      name="Hollin Busk Allotments"
      tagline="The tenancy in plain words, and who to ask when it is not clear."
      links={[
        { label: "The wait", href: "#/" },
        { label: "The plots", href: "#/plots" },
      ]}
      action={{ label: "Join the waiting list", href: "#/" }}
    >
      <div className="mx-auto max-w-4xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">The rules</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          The tenancy agreement is four pages of legal English and we will post you one. This is the
          same thing in the words people actually use, with the difference marked between what the
          parish lease requires of us and what the association merely asks.
        </p>

        <section className="mt-12">
          <SectionHeader
            eyebrow="The one that ends tenancies"
            title="Three quarters cultivated, inspected twice a year"
            description="June and September. It is the only rule anybody has ever lost a plot over here, and it happens three or four times a year."
          />
          <div className="mt-8 grid gap-6 md:grid-cols-4">
            <div className="rounded-xl border border-border p-5">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">First</p>
              <p className="mt-2 text-sm leading-relaxed">
                A quiet word, in person, from whoever inspected. Usually that is the whole of it.
              </p>
            </div>
            <div className="rounded-xl border border-border p-5">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Then</p>
              <p className="mt-2 text-sm leading-relaxed">
                A letter, and three months to put it right. Tell us if something has happened — we
                have held plots for a year for illness and a bereavement.
              </p>
            </div>
            <div className="rounded-xl border border-border p-5">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Then</p>
              <p className="mt-2 text-sm leading-relaxed">
                A second letter and a date. At this point somebody will offer to help you clear it,
                and several people have taken that up.
              </p>
            </div>
            <div className="rounded-xl border border-border p-5">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Only then</p>
              <p className="mt-2 text-sm leading-relaxed">
                Notice to quit, 28 days, and you take your shed and your tools. We have never done
                this without two conversations first.
              </p>
            </div>
          </div>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            "Three quarters cultivated" means growing something, including green manure or a covered
            resting bed. A neat plot under weed fabric for a season counts. A waist-high jungle of
            bramble and willowherb does not, and that is the only judgement anybody makes.
          </p>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="Everything else"
            title="Firm and asked-for, marked apart"
            description="The firm ones are in the parish council's lease and the committee cannot bend them however reasonable your case is. The rest are ours and are open to a conversation."
          />
          <div className="mt-8">
            <HouseRules
              heading="On the site"
              rules={[
                { what: "No bonfires between April and September", at: "Oct–Mar only, after 16:00", firm: true, detail: "Complaints from Hollin Busk Lane are what nearly cost us the site in 2018. Outside those months, and never on a still day when it hangs. Compost or take it to Blackstock Road instead." },
                { what: "No hosepipes or sprinklers", firm: true, detail: "Watering cans from the troughs. It is a lease condition about the mains supply, not the committee's preference, and it is the one we get asked to bend most." },
                { what: "Sheds up to 8ft by 6ft, one per plot", firm: true, detail: "Anything bigger needs the parish council rather than us, which takes about two months. Greenhouses up to 8ft by 10ft, polycarbonate not glass." },
                { what: "Nothing sold from the plot", firm: true, detail: "It is a statutory allotment, so produce is for you, your family and giving away. A stall at the village show is fine; a weekly box scheme is not." },
                { what: "Hens yes, cockerels no, bees by agreement", firm: true, detail: "Up to six hens with a fox-proof run and somebody who can shut them in every night. Bees need the committee and your neighbours to agree, and two plots have them." },
                { what: "Dogs on a lead, and not left tied up", detail: "Everybody's dog is welcome on the paths. Nobody wants to garden next to one barking on a rope for three hours." },
                { what: "Keep the path beside your plot clear", detail: "Half the width is yours. It is the commonest small friction here and it is always solved by one person with a strimmer." },
                { what: "No carpet, tyres or plasterboard", detail: "Carpet was normal here for thirty years and it breaks down into plastic threads that never leave. There is a skip in October for what is already down." },
                { what: "Shut the gate and reset the code", detail: "Three break-ins in six years, all through a gate somebody propped open in July." },
                { what: "Come to the AGM if you can", at: "Second Tuesday in November", detail: "The Royal Oak, 19:30, about an hour. It sets the rent and elects the committee, and about thirty of a hundred and twelve members come." },
              ]}
            />
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="Who to ask"
            title="The committee, and the three posts nobody has taken"
            description="Elected at the AGM for two years. Every address here goes to the role rather than to somebody's own inbox."
          />
          <div className="mt-8 grid items-start gap-10 lg:grid-cols-[1.2fr_1fr]">
            <CommitteeList
              posts={[
                { id: "sec", role: "Secretary", holder: "Ray Hollingworth", contact: "secretary@hollinbuskallotments.org.uk", termEnds: "AGM 2027", trustee: true, about: "The waiting list, the tenancies, and the person to ring about anything at all." },
                { id: "chair", role: "Chair", holder: "Anne Mottram", contact: "chair@hollinbuskallotments.org.uk", termEnds: "AGM 2026", trustee: true },
                { id: "treas", role: "Treasurer", holder: "Peter Gill", contact: "treasurer@hollinbuskallotments.org.uk", termEnds: "AGM 2026", trustee: true, about: "Rent in October, and the hardship arrangement — ask him, it is used by about a dozen people and it is nobody else's business." },
                { id: "hut", role: "Trading hut", holder: "Sylvia Beard", contact: "hut@hollinbuskallotments.org.uk", termEnds: "AGM 2027", about: "Open Saturdays 10 till 12. Seed, compost, canes and netting at roughly two thirds of shop price." },
                { id: "site", role: "Site warden", contact: "secretary@hollinbuskallotments.org.uk", about: "Walks the site monthly, checks the troughs and the gate, does the June and September inspections. About two hours a month." },
                { id: "shows", role: "Show secretary", contact: "secretary@hollinbuskallotments.org.uk", about: "Runs the August show. It is one busy fortnight a year and it is the best day here." },
                { id: "water", role: "Water and paths", contact: "secretary@hollinbuskallotments.org.uk", about: "Turns the supply on in March and off in October, and organises the two work days." },
              ]}
            />
            <div>
              <div className="rounded-xl border border-border p-6">
                <p className="text-sm font-medium">If a rule affects you badly, say so</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  The firm ones we genuinely cannot move — they are in the parish council's lease
                  and we would lose the site. Everything else is a decision seven people made in a
                  pub and can unmake. Email the secretary or come to the AGM.
                </p>
              </div>
              <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
                A dispute between two plot-holders goes to the chair, in writing, and the committee
                answers within a month. It has happened four times in ten years and three of them
                were about a hedge.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader title="Questions about the rules" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Can I go organic — or not?",
                  answer:
                    "Entirely your choice. Most people here use no sprays and nobody is asked to. Glyphosate is allowed on paths and not on a windy day, and two plots would rather it was banned outright, which is an AGM conversation.",
                },
                {
                  question: "What happens to my shed if I give the plot up?",
                  answer:
                    "Sell it to whoever takes the plot, which is what usually happens and £30 is the going rate, or take it away. If you leave it and nobody wants it, clearing it costs the association about £80 and we would rather you did not.",
                },
                {
                  question: "Can my partner take over the plot if something happens to me?",
                  answer:
                    "Not automatically — the tenancy is one name and the plot goes back on the list. In practice the committee has never refused a partner or a family member who was already working it, and we would sort it out kindly.",
                },
                {
                  question: "Am I insured?",
                  answer:
                    "The association holds public liability for the site. Your shed, your tools and your greenhouse are yours to insure and most people do not. There is no cover for anything you do to yourself with a rotavator.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="#/">The wait, and joining the list</a>
            {" · "}
            <a className="underline underline-offset-4" href="#/plots">Plot sizes and site conditions</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
