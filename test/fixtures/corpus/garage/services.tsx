// garage /services — every job priced. The list a garage usually keeps behind a
// phone call, published, which is the whole opening.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Faq } from "@/components/ui/faq";
import { PriceList } from "@/components/ui/price-list";
import { SectionHeader } from "@/components/ui/section-header";
import { TrustStrip } from "@/components/ui/trust-strip";
export const Route = createFileRoute("/services")({ component: P });
function P() {
  const navigate = useNavigate();
  return (
    <SiteChrome name="Hillfoot Motors" tagline="MOT, servicing and repairs on Little London Road."
      links={[{ label: "Home", href: "/" }, { label: "Book", href: "/book" }]}
      action={{ label: "Book a slot", href: "/book" }}>
      <div className="mx-auto max-w-5xl px-6 py-14">
        <SectionHeader eyebrow="Prices" title="Everything, with a number on it"
          description="Labour is £62 an hour and parts are quoted before we start. Nothing here is an estimate that grows." />
        <div className="mt-10 space-y-12">
          <section>
            <h2 className="text-xl font-semibold tracking-tight">Testing and servicing</h2>
            <PriceList className="mt-4" items={[
              { name: "MOT (class 4)", description: "The statutory maximum — nobody may charge more", price: 54.85, meta: "45 min" },
              { name: "MOT retest", description: "Free within ten working days if we do the work", price: 27, meta: "20 min" },
              { name: "Interim service", description: "Oil, filter, 32 checks", price: 129, meta: "2 hrs" },
              { name: "Full service", description: "Plugs, air and cabin filters on top", price: 229, meta: "half a day" },
              { name: "Cambelt", description: "Belt, tensioner and water pump — the sensible way to do it", price: 495, meta: "full day" },
            ]} action={{ label: "Book", onSelect: () => { navigate({ to: "/book" }); } }} />
          </section>
          <section>
            <h2 className="text-xl font-semibold tracking-tight">Repairs</h2>
            <PriceList className="mt-4" items={[
              { name: "Brake pads, per axle", price: 145, meta: "1.5 hrs" },
              { name: "Pads and discs, per axle", price: 285, meta: "2 hrs" },
              { name: "Clutch", description: "Most front-wheel-drive hatchbacks", price: 720, meta: "full day" },
              { name: "Exhaust — back box", price: 185, meta: "1 hr" },
              { name: "Diagnostic", description: "Refunded against the repair if we do it", price: 45, meta: "1 hr" },
              { name: "Air-con regas", price: 89, meta: "1 hr" },
            ]} action={{ label: "Book", onSelect: () => { navigate({ to: "/book" }); } }} />
          </section>
          <section>
            <h2 className="text-xl font-semibold tracking-tight">Tyres and the rest</h2>
            <PriceList className="mt-4" items={[
              { name: "Tyre, fitted and balanced", description: "From — depends entirely on the size", price: 62, meta: "30 min" },
              { name: "Four-wheel alignment", price: 65, meta: "1 hr" },
              { name: "Battery, fitted", price: 115, meta: "30 min" },
              { name: "Wiper blades, pair", description: "Fitted while you wait, no labour", price: 24, meta: "5 min" },
            ]} />
          </section>
        </div>
        <div className="mt-12 border-t border-border pt-10">
          <TrustStrip items={[
            { title: "£62 an hour", description: "Charged in fifteen-minute blocks, not rounded up" },
            { title: "Parts quoted first", description: "Genuine or aftermarket — your call, both priced" },
            { title: "No diagnostic fee if we fix it", description: "The £45 comes off the bill" },
          ]} />
        </div>
        <div className="mt-12 border-t border-border pt-10">
          <SectionHeader eyebrow="Asked often" title="The questions that come up" />
          <Faq className="mt-6" items={[
            { question: "Can I supply my own parts?", answer: "Yes, and we'll fit them at the usual labour rate. We can't warranty a part we didn't buy, and we'll say so on the invoice rather than in small print." },
            { question: "Will an MOT failure cost me a fortune?", answer: "Not necessarily. We'll tell you what's a fail, what's an advisory, and which advisories can honestly wait a year." },
            { question: "Do you do warranty servicing?", answer: "Yes. Servicing here does not affect a manufacturer warranty — that's been the law since 2003 and main dealers still imply otherwise." },
          ]} />
        </div>
      </div>
    </SiteChrome>
  );
}
