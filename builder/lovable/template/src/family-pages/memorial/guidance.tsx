// memorial /guidance — inscriptions, permits, and adding to a memorial later.
//
// LEAVE ROOM. The single most common regret in this trade is a stone lettered
// to its edges, so that when the second person dies there is nowhere to put
// them and the family faces a new memorial or a cramped addition. It costs
// nothing to plan for and almost nobody thinks of it in the first month.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { ComplianceChecklist } from "@/components/ui/compliance-checklist";
import { ArrangementSteps } from "@/components/ui/arrangement-steps";
import { PriceList } from "@/components/ui/price-list";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/guidance")({ component: P });

const WORDING = [
  { what: "Check every date against a document", why: "Not from memory and not from another family member. A wrong date cut into granite is permanent, and correcting one means a new stone." },
  { what: "Decide on the name as it will be read", why: "Full name, or the name everybody used? Both are right. It is worth five minutes of disagreement now rather than fifty years of a stone that says Margaret when she was Peggy." },
  { what: "Leave room for whoever comes next", why: "The commonest regret we see. A stone lettered edge to edge has nowhere for a second inscription and the family ends up with a cramped addition or a new memorial." },
  { what: "Read it aloud, slowly, twice", why: "Everybody proofreads by eye and everybody misses the thing they expect to see. Reading it out finds it." },
  { what: "Somebody outside the family should read it too", why: "We do, and we ask. It is the last check before a chisel touches anything." },
];

const LATER = [
  { name: "Additional inscription, in situ", description: "Cut in the cemetery over one day where there is room and access", price: 480 },
  { name: "Additional inscription, stone removed", description: "Where it must come back to the workshop. Includes taking it out and refixing", price: 690 },
  { name: "Cleaning an old stone", description: "By hand and water. Never a pressure washer — it destroys sandstone", price: 210 },
  { name: "Re-lettering and re-gilding", description: "Recutting worn letters and gilding them. Often transforms a stone", price: 390 },
  { name: "Straightening a leaning memorial", description: "Usually a failed foundation. Includes a new concrete beam", price: 540 },
  { name: "Permit for an additional inscription", description: "Sheffield City Council, four to six weeks", price: 68, meta: "at cost" },
];

function P() {
  return (
    <SiteChrome
      name="Hartley & Vane Memorials"
      tagline="Wording, permits, and adding to a memorial years later."
      links={[
        { label: "Start here", href: "#/" },
        { label: "The work", href: "#/memorials" },
      ]}
      action={{ label: "Talk to us", href: "tel:01142551104" }}
    >
      <div className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="text-5xl font-semibold tracking-tight text-balance">Guidance</h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Three things: getting the wording right, the permit, and what happens when somebody has
          to be added years later. The third is the one nobody plans for and the one that causes
          the most difficulty.
        </p>

        <section className="mt-14">
          <SectionHeader
            eyebrow="The wording"
            title="Five things, and the third is the one people wish they had done"
            description="An inscription is permanent in a way almost nothing else in modern life is. It is worth being slow about."
          />
          <ul className="mt-10 divide-y divide-border border-y border-border">
            {WORDING.map((w) => (
              <li key={w.what} className="grid gap-2 py-5 md:grid-cols-[minmax(0,19rem)_1fr] md:gap-8">
                <p className="font-medium">{w.what}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{w.why}</p>
              </li>
            ))}
          </ul>
          <p className="mt-8 max-w-2xl leading-relaxed text-muted-foreground">
            There is no rule about what an inscription may say beyond the cemetery's own — which is
            usually only about length and about anything that could offend. Nicknames, a line of a
            song, a joke somebody would have wanted: all of it has been cut here and none of it has
            ever been refused by anybody.
          </p>
        </section>

        <section className="mt-16">
          <SectionHeader
            eyebrow="Adding somebody later"
            title="Usually done in the cemetery, in a day"
            description="The stone rarely needs to come away. Where it does, it goes to the workshop and back within three weeks."
          />
          <div className="mt-10">
            <ArrangementSteps
              nothingLabel="Nothing you need to do"
              steps={[
                {
                  title: "Check the deed",
                  what: "The application has to be signed by the registered grave owner, who may have died. Transferring it is a form and about a fortnight, and it is the step that surprises people.",
                  youDo: "Find the deed of grant if you can. If you cannot, the authority holds a copy.",
                  when: "Two weeks if a transfer is needed",
                },
                {
                  title: "We look at the stone",
                  what: "Whether there is room, whether it matches, and whether it can be cut in place. Free, and we go to the cemetery ourselves rather than working from a photograph.",
                  when: "Within a week",
                },
                {
                  title: "The permit",
                  what: "£68 at Sheffield for an additional inscription, four to six weeks. Shorter than for a new memorial but still not quick.",
                  when: "Four to six weeks",
                },
                {
                  title: "Cutting",
                  what: "One day in the cemetery, in a small tent. You are welcome to be there and some people find it valuable; most would rather not and that is equally fine.",
                  when: "One day",
                },
              ]}
            />
          </div>
        </section>

        <section className="mt-16">
          <div className="grid gap-14 lg:grid-cols-[1fr_1.1fr]">
            <div className="lg:pt-6">
              <SectionHeader
                eyebrow="Looking after one"
                title="Six things we do to existing memorials"
                description="Half our work is on stones somebody else cut, some of them a hundred and thirty years ago."
              />
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Never use a pressure washer or a chemical cleaner on sandstone. It takes the face
                off and the damage is not reversible — it is the most common thing a well-meaning
                family does and it is the one thing we cannot undo.
              </p>
            </div>
            <PriceList items={LATER} />
          </div>
        </section>

        <section className="mt-16">
          <SectionHeader
            eyebrow="The permit"
            title="What the authority is actually checking"
            description="Not taste. Dimensions, materials, the foundation and who signed it — and one of those catches almost everybody."
          />
          <div className="mt-10">
            <ComplianceChecklist
              items={[
                { id: "1", label: "Signed by the registered grave owner", state: "todo", reason: "Not the next of kin, not the person paying — the name on the deed of grant, who may themselves have died.", evidence: "A transfer is a form and about a fortnight. Start it early." },
                { id: "2", label: "Dimensions within the section's limits", state: "done", by: "Checked by us before drawing anything" },
                { id: "3", label: "Material permitted in that section", state: "done", reason: "Polished black granite is refused in several churchyards and permitted at City Road." },
                { id: "4", label: "Foundation to BRAMM standard", state: "done", reason: "A concrete beam rather than a spike. Required, and it is what stops a stone leaning.", by: "BRAMM-registered fixer, licence 4417" },
                { id: "5", label: "Fixed by a registered mason", state: "done", reason: "Sheffield will not permit a memorial fixed by anybody without a licence, including the family." },
                { id: "6", label: "Inscription wording approved", state: "not-applicable", reason: "Sheffield does not vet wording. Some churchyards do, and a faculty may be needed — we will tell you which applies." },
              ]}
            />
          </div>
        </section>

        <section className="mt-16">
          <SectionHeader title="Guidance questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Can I fix a memorial myself?",
                  answer:
                    "Not in a Sheffield cemetery, and not in most churchyards. Only a registered mason may, and it is a safety rule after a number of accidents involving falling stones. It is not a restrictive practice.",
                },
                {
                  question: "The grave owner has died. What now?",
                  answer:
                    "The deed transfers to whoever is entitled under the estate, by a form and a fortnight. Start it before anything else — it is the step that delays more memorials than any other.",
                },
                {
                  question: "Can we scatter ashes on an existing grave?",
                  answer:
                    "With the authority's permission and the grave owner's, usually yes. It is a separate application from anything to do with the memorial and Bereavement Services handle it directly.",
                },
                {
                  question: "What if we cannot afford it yet?",
                  answer:
                    "Then wait. A grave without a memorial is not a failure and nobody is judging it. When you are ready we will be here, and the twelve-month payment plan starts whenever you say.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="#/">The regulations and the timescale</a>
            {" · "}
            <a className="underline underline-offset-4" href="#/memorials">The work and the stone</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
