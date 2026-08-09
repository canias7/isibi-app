// franchise-sales /territories — which areas are free, taken or under offer,
// with the population each covers. The second question every prospect has, and
// no franchise site answers it before a phone call.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { BusyButton } from "@/components/ui/busy-button";
import { Faq } from "@/components/ui/faq";
import { SectionHeader } from "@/components/ui/section-header";
import { TerritoryList } from "@/components/ui/territory-list";
import { TERRITORIES } from "./index";
export const Route = createFileRoute("/territories")({ component: P });
function P() {
  return (
    <SiteChrome name="Fettle Mobile Servicing" tagline="Van-based bike and e-bike servicing. Nine territories, four still free."
      links={[{ label: "Home", href: "/" }, { label: "The process", href: "/process" }]}
      action={{ label: "Ring 0114 400 2210", href: "tel:01144002210" }}>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="Territories" title="Three free, and one of them is the big one"
          description="Published rather than held back for a phone call. If your town has gone, you should be able to find that out in four seconds instead of after a form, a brochure and three days of waiting." />

        <section className="mt-10 grid gap-12 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <TerritoryList territories={TERRITORIES}
              note="Populations are ONS mid-2024 estimates for the postcode sectors in each territory, not a marketing figure. Huddersfield is the largest free area in the network and it has been free since we drew it, because nobody has come from there." />
          </div>
          <div>
            <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">How a territory is drawn</h2>
            <ul className="mt-3 divide-y divide-border border-y border-border text-base">
              <li className="py-3.5">
                <span className="font-medium">By postcode sector, not by a circle on a map</span>
                <span className="block text-sm text-muted-foreground">
                  So the boundary is unambiguous and two franchisees can never both think a street
                  is theirs. The exact sector list is in the agreement.
                </span>
              </li>
              <li className="py-3.5">
                <span className="font-medium">Around 100,000 people</span>
                <span className="block text-sm text-muted-foreground">
                  Which is about four years of growth for one van. Huddersfield at 162,000 is
                  oversized and will be split when it opens — the second half stays with whoever
                  takes the first, at no extra fee, if they want it.
                </span>
              </li>
              <li className="py-3.5">
                <span className="font-medium">Exclusive, and that means exclusive</span>
                <span className="block text-sm text-muted-foreground">
                  Head office does not sell into your area, does not run national accounts through
                  it, and does not put a second van in. If a customer inside your sectors rings the
                  central number, the job is yours and so is the money.
                </span>
              </li>
              <li className="py-3.5">
                <span className="font-medium">You can work outside it, nobody can work inside it</span>
                <span className="block text-sm text-muted-foreground">
                  A job three miles over the line is fine and happens constantly. The protection is
                  on marketing and on leads, not on where the van is allowed to be.
                </span>
              </li>
            </ul>

            <div className="mt-8 rounded-lg border border-border bg-muted/50 p-5">
              <p className="text-base font-medium">Somewhere not on the list?</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                We will draw a new one anywhere in the north with the population to support it, and
                four of the nine started that way — somebody rang about their own town. The fee is
                the same and there is no premium for a virgin area.
              </p>
              <BusyButton className="mt-4" onClick={() => undefined}>Ask about an area</BusyButton>
            </div>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="Resales" title="One available, and here is why it is for sale"
            description="A franchisor who will not tell you why an existing business is being sold is telling you why an existing business is being sold." />
          <div className="mt-8 max-w-3xl rounded-lg border border-border p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <p className="text-lg font-semibold">Leeds East — established 2020</p>
              <p className="text-lg font-semibold tabular-nums">£74,000</p>
            </div>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              Turnover £147,000 last year, the best in the network, with a book of 900 customers and
              a second-hand van included. The franchisee is emigrating in April and has told
              everybody so — he will talk you through his own accounts, and we will not be in the
              room.
            </p>
            <dl className="mt-5 grid grid-cols-2 gap-x-8 gap-y-4 text-sm sm:grid-cols-4">
              <div><dt className="text-muted-foreground">Turnover</dt><dd className="mt-1 text-base font-semibold tabular-nums">£147,000</dd></div>
              <div><dt className="text-muted-foreground">Drawings</dt><dd className="mt-1 text-base font-semibold tabular-nums">£58,000</dd></div>
              <div><dt className="text-muted-foreground">Customers</dt><dd className="mt-1 text-base font-semibold tabular-nums">900</dd></div>
              <div><dt className="text-muted-foreground">Available</dt><dd className="mt-1 text-base font-semibold">April 2027</dd></div>
            </dl>
            <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
              A resale costs more than a new territory and starts earning immediately — £74,000
              against about £62,000 to open cold, and no six-month runway needed. Which is better
              depends entirely on whether you have the extra twelve thousand.
            </p>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="max-w-3xl">
            <SectionHeader eyebrow="Asked often" title="About territories" />
            <Faq className="mt-6" items={[
              { question: "What does 'under offer' actually mean?", answer: "Somebody is at second-meeting stage and has not signed. About a third do not complete, so it is worth registering an interest rather than crossing it off — we keep a list and ring in order." },
              { question: "Can I have two territories?", answer: "Not to start. After two years and if the first one is running properly, yes, and two franchisees have done it. Buying two at once is how people end up running neither." },
              { question: "What happens when I outgrow it?", answer: "A second van inside your own territory, which is yours to put on and yours to keep the income from. We do not charge a second franchise fee for it." },
              { question: "Is the territory mine forever?", answer: "For the five-year term and every renewal, provided you hit a minimum performance figure that is in the agreement and that every franchisee has cleared in year one." },
              { question: "Can I sell it?", answer: "Yes, at whatever price you agree. We approve the buyer on the same basis we would approve a new franchisee and we have never refused one. There is a 5% transfer fee." },
              { question: "Why is Huddersfield still free?", answer: "Because nobody from Huddersfield has enquired, and we do not place people in territories they do not live in. It is the largest free area we have and it will go to whoever asks first from there." },
            ]} />
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
