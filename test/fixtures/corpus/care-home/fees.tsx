// care-home /fees — the whole thing, including the top-up conversation nobody
// has until it is too late. This is the page the family exists for: the sector
// makes people ring six homes to ask what things cost, in the worst week of
// their lives.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { ContactForm } from "@/components/ui/contact-form";
import { Faq } from "@/components/ui/faq";
import { PriceList } from "@/components/ui/price-list";
import { SectionHeader } from "@/components/ui/section-header";
import { Steps } from "@/components/ui/steps";
export const Route = createFileRoute("/fees")({ component: P });
function P() {
  return (
    <SiteChrome name="Rivelin Lodge" tagline="A 34-bed residential and dementia care home in Walkley, Sheffield."
      links={[{ label: "Home", href: "/" }, { label: "The rooms", href: "/rooms" }]}
      action={{ label: "Arrange a visit", href: "/" }}>

      <div className="mx-auto max-w-5xl px-6 py-14">
        <SectionHeader eyebrow="Fees" title="What it costs, and what happens when the money runs down"
          description="The whole thing on one page, including the parts homes usually leave until the contract. Reviewed once a year in April, and never mid-year." />

        <section className="mt-12">
          <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">The weekly fee, by room</h2>
          <PriceList className="mt-4" items={[
            { name: "Shared room", price: 1180, meta: "Per week", description: "Two beds, shared en-suite. Two of them." },
            { name: "Standard single", price: 1240, meta: "Per week", description: "12m², en-suite shower. Twelve of them and the most common." },
            { name: "Front room, first floor", price: 1380, meta: "Per week", description: "15m², bay window, valley view. Nine of them." },
            { name: "Dementia floor", price: 1395, meta: "Per week", description: "13m², secure unit with its own lounge and a 1:4 daytime ratio." },
            { name: "Garden room", price: 1450, meta: "Per week", description: "18m², own door to the lawn. Six, with a waiting list." },
          ]} />
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">What the fee includes</h2>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground">
            All of this, with nothing itemised on a bill afterwards.
          </p>
          <div className="mt-4 grid gap-x-12 gap-y-8 lg:grid-cols-2">
            <PriceList items={[
              { name: "All personal care", price: 0, meta: "Included", description: "Whatever somebody needs, however that changes. The fee does not go up because care needs do." },
              { name: "All meals and drinks", price: 0, meta: "Included", description: "Three cooked meals, snacks, and a kitchen open through the night." },
              { name: "Laundry", price: 0, meta: "Included", description: "Named, washed and ironed here." },
              { name: "Activities and outings", price: 0, meta: "Included", description: "Including the minibus and entry to anywhere it goes." },
            ]} />
            <PriceList items={[
              { name: "GP and district nurse", price: 0, meta: "Included", description: "The practice visits weekly and comes out when called." },
              { name: "Incontinence products", price: 0, meta: "Included", description: "Some homes charge for these. We never have." },
              { name: "TV licence and wifi", price: 0, meta: "Included", description: "Covered by the home's licence." },
              { name: "End of life care", price: 0, meta: "Included", description: "Nobody moves out at the end and the fee does not change." },
            ]} />
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">What is charged on top</h2>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground">
            The complete list — four things. They are billed monthly, itemised, and you can decline
            any of them.
          </p>
          <PriceList className="mt-4" items={[
            { name: "Hairdressing", price: 22, meta: "Per visit", description: "Fridays. Cut and set; a perm is £38. Entirely optional." },
            { name: "Chiropody", price: 32, meta: "Per visit", description: "Every six weeks. NHS podiatry is free where somebody qualifies and we will tell you if they do." },
            { name: "Newspaper", price: 4.5, meta: "Per week", description: "Delivered daily if wanted." },
            { name: "Named toiletries", price: 0, meta: "At cost", description: "We provide everything as standard. This is only if somebody wants a particular brand." },
          ]} />
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="rounded-xl border border-border bg-muted/50 p-6 sm:p-8">
            <h2 className="text-2xl font-semibold tracking-tight">If the money runs down</h2>
            <div className="mt-4 space-y-4 text-base leading-relaxed text-muted-foreground">
              <p>
                This is the conversation most homes have in year three and we would rather have it
                now, because it changes which home you choose.
              </p>
              <p>
                Above £23,250 in savings somebody funds themselves. Below it the council
                contributes, and Sheffield's residential rate is currently <span className="font-medium text-foreground">£764 a week</span> —
                which is £476 short of our standard single.
              </p>
              <p>
                That gap is a third-party top-up, paid by a relative, and it is the thing that
                catches families out. On our standard single it is <span className="font-medium text-foreground">£476 a week</span>.
              </p>
              <p>
                <span className="font-medium text-foreground">What we do about it:</span> nobody has ever been asked to
                leave Rivelin Lodge for money. Where a top-up cannot be found we have taken the
                council rate and absorbed the difference — that is four residents at the moment. We
                will not promise it in a contract because no home honestly can, and we will tell you
                our record instead.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="How it works" title="From the first visit to moving in" />
              <Steps className="mt-6" columns={1} items={[
                { title: "Come and look", description: "No appointment. Stay for lunch. Ask the residents." },
                { title: "A needs assessment", description: "Free, an hour, at home or in hospital. It decides whether we are the right home — sometimes the answer is no." },
                { title: "Two-week trial", description: "At the weekly fee, no obligation, notice on either side. About a third of people do this." },
              ]} />
              <h3 className="mt-10 text-sm font-medium uppercase tracking-widest text-muted-foreground">The contract terms</h3>
              <ul className="mt-3 divide-y divide-border border-y border-border text-base">
                <li className="py-3">Four weeks' notice either way, and none in the trial fortnight</li>
                <li className="py-3">Fees reviewed each April, never mid-year, with three months' warning</li>
                <li className="py-3">One month held on a room while somebody is in hospital, at half fee</li>
                <li className="py-3">On a death, charging stops the day the room is cleared, and we do not hurry anybody</li>
                <li className="py-3">No deposit and no administration fee</li>
              </ul>
            </div>
            <div>
              <SectionHeader eyebrow="Ask" title="Whatever the question is about money"
                description="Denise answers these herself. Nothing is a silly question and none of it commits you to anything." />
              <ContactForm className="mt-6" askPhone onSubmit={() => {}} />
              <Faq className="mt-8" items={[
                { question: "Do we have to sell the house?", answer: "Not necessarily and not immediately. A deferred payment agreement with the council lets the fee come out of the estate later. Get proper advice — we are not financial advisers and will not pretend to be." },
                { question: "What is Continuing Healthcare?", answer: "NHS funding that covers the whole fee where somebody's needs are primarily health rather than social. It is hard to get, worth applying for, and we will support the application." },
                { question: "Is Attendance Allowance counted?", answer: "It is paid to the resident and helps with the fee. It stops after 28 days if the council is funding, which surprises people." },
                { question: "Do fees rise every year?", answer: "In April, in line with staff costs, which is the honest driver. Last three years: 6.1%, 4.8%, 3.9%. We publish it rather than being asked." },
              ]} />
            </div>
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
