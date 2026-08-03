// memorial — REGULATIONS-AND-CHOOSING, and the six-month wait stated early.
//
// NOBODY IS TOLD THE GROUND HAS TO SETTLE. A family who has just buried
// somebody wants the memorial now, and the answer is six to twelve months
// before anything can be fixed to it. Hearing that from a mason months later
// feels like an excuse; hearing it at the start is simply how it is.
//
// AND THE CEMETERY'S RULES CONSTRAIN EVERYTHING. Height, material, whether a
// kerb is allowed, whether the stone may be black — all decided by the burial
// authority and not by the family or by us. Leading with that prevents somebody
// falling in love with something they cannot have.
//
// EDITORIAL, quiet, one measure. A grid of headstone thumbnails is the wrong
// register for this entirely.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { ComplianceChecklist } from "@/components/ui/compliance-checklist";
import { ArrangementSteps } from "@/components/ui/arrangement-steps";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/")({ component: P });

function P() {
  return (
    <SiteChrome
      name="Hartley & Vane Memorials"
      tagline="Memorial masons in Sheffield since 1911. BRAMM registered."
      links={[
        { label: "The work", href: "#/memorials" },
        { label: "Guidance", href: "#/guidance" },
        { label: "Questions", href: "#questions" },
      ]}
      action={{ label: "Talk to us", href: "tel:01142551104" }}
    >
      <section className="border-b border-border">
        <div className="mx-auto max-w-4xl px-6 py-20">
          <h1 className="text-5xl font-semibold leading-[1.06] tracking-tight text-balance">
            There is no hurry, and that is not us putting you off
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            A new grave has to settle before anything can be fixed to it — six months at least,
            usually nearer a year, and longer on heavy ground. Every mason knows this and most
            families are told it far too late, by which time it sounds like an excuse.
          </p>
          <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
            So: nothing needs deciding this month. Come and talk when you want to, and if that is
            next spring then next spring is the right time.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="tel:01142551104">
              Ring 0114 255 1104
            </a>
            <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#/memorials">
              See the work
            </a>
          </div>
        </div>
      </section>

      {/* THE REGULATIONS, BEFORE THE CATALOGUE. */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <SectionHeader
            eyebrow="What the cemetery allows"
            title="This is decided before anything else, and not by us"
            description="Each burial authority sets its own rules and they differ street to street. Falling in love with something the cemetery will not permit is the one thing worth avoiding."
          />
          <div className="mt-10">
            <ComplianceChecklist
              items={[
                { id: "1", label: "Maximum height 1,067mm above ground", state: "done", reason: "City Road Cemetery, lawn sections. Older sections allow taller.", by: "Sheffield City Council Bereavement Services" },
                { id: "2", label: "Width no more than 914mm", state: "done", by: "Sheffield City Council Bereavement Services" },
                { id: "3", label: "Kerbs and surrounds", state: "not-applicable", reason: "Not permitted in any lawn section opened after 1975. Permitted in the older sections and in most churchyards." },
                { id: "4", label: "Polished black granite", state: "todo", reason: "Permitted at City Road. Refused at Bolsterstone churchyard, which requires local stone or unpolished granite.", evidence: "Check with the incumbent before ordering — we will do it." },
                { id: "5", label: "Foundation on a concrete beam", state: "done", reason: "Required by the authority and installed by us. It is what stops a stone leaning in ten years.", by: "BRAMM-registered fixer" },
                { id: "6", label: "Permit application before any work", state: "todo", reason: "£142 at Sheffield, four to six weeks. We apply and it is at cost.", evidence: "Signed by the grave owner — which may not be the person arranging it." },
                { id: "7", label: "Photographs and glass items", state: "not-applicable", reason: "Ceramic photographs are permitted; glass, solar lights and windmills are removed by the grounds staff without notice." },
              ]}
            />
          </div>
          <p className="mt-8 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            These are City Road's. Bolsterstone, Loxley chapel and every parish churchyard have
            their own, and some of them are much stricter. Tell us where and we will find out
            before you choose anything.
          </p>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <SectionHeader
            eyebrow="How it goes"
            title="Six months of it, and most of the waiting is not ours"
            description="Written out so nobody has to ring and ask where it has got to."
          />
          <div className="mt-10">
            <ArrangementSteps
              nothingLabel="Nothing you need to do"
              steps={[
                {
                  title: "The ground settles",
                  what: "Six months minimum after a burial, and we will not fix to a grave before it whatever anybody asks. A stone set on unsettled ground leans, and putting it right costs more than doing it once.",
                  when: "Six to twelve months",
                },
                {
                  title: "We meet, here or at your house",
                  what: "An hour or so. Stone, shape, wording, and what the cemetery permits. No deposit and nothing signed.",
                  youDo: "Bring the deed of grant if you can find it. If you cannot, we will get a copy.",
                  when: "Whenever you are ready",
                },
                {
                  title: "A drawing, to scale",
                  what: "The exact stone with the exact wording, laid out. Almost everybody changes something at this point and that is what it is for.",
                  youDo: "Read it slowly. Check the dates and the spellings against a document rather than from memory.",
                  when: "Two weeks",
                },
                {
                  title: "The permit application",
                  what: "Signed by the registered grave owner and lodged with the authority. Four to six weeks at Sheffield, longer in a churchyard where a faculty is needed.",
                  when: "Four to six weeks",
                },
                {
                  title: "Cutting and lettering",
                  what: "The stone is sawn, dressed and lettered by hand here on Abbeydale Road. You are welcome to come and watch and several families do.",
                  when: "Eight to ten weeks",
                },
                {
                  title: "Fixing",
                  what: "On a concrete beam, to BRAMM standard, and photographed before we leave. We write to you when it is in rather than leaving you to find it.",
                  youDo: "Nothing. Come whenever you are ready to.",
                  when: "One day",
                },
              ]}
            />
          </div>
        </div>
      </section>

      <section id="questions">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <SectionHeader title="What families ask" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "How much does a memorial cost?",
                  answer:
                    "Between about £900 for a small granite tablet and £3,500 for a full headstone with a base and a kerbed surround where one is allowed. The lettering is priced per letter and the permit is at cost. Everything is on the memorials page.",
                },
                {
                  question: "Can we pay in instalments?",
                  answer: "Over twelve months, interest free, and nothing starts until you are ready. A third of families do it this way and nobody is ever chased.",
                },
                {
                  question: "The funeral director offered to arrange it.",
                  answer:
                    "They can, and they will add a commission — usually 15 to 25%. It is entirely your choice and you are free to come to a mason directly. We would rather you knew that than found out afterwards.",
                },
                {
                  question: "Do we have to decide anything now?",
                  answer:
                    "No. Nothing at all. The ground will not be ready for months and there is no version of this that is improved by hurrying. Ring when you want to and not before.",
                },
              ]}
            />
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
