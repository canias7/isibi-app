// removals — QUOTE-FIRST: the calculator is the hero, and the survey booking is
// what it converts into. This trade's whole friction is that nobody publishes a
// number, so a range on the page is the entire competitive position.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Faq } from "@/components/ui/faq";
import { PriceList } from "@/components/ui/price-list";
import { QuoteCalculator } from "@/components/ui/quote-calculator";
import { SectionHeader } from "@/components/ui/section-header";
import { ServiceArea } from "@/components/ui/service-area";
import { Steps } from "@/components/ui/steps";
import { Testimonial } from "@/components/ui/testimonial";
import { TrustStrip } from "@/components/ui/trust-strip";
export const Route = createFileRoute("/")({ component: P });
function P() {
  return (
    <SiteChrome name="Bramall & Sons Removals" tagline="A family removals firm in Sheffield since 1978."
      links={[{ label: "Full quote", href: "/quote" }, { label: "Moving day", href: "/moving-day" }, { label: "Areas", href: "#areas" }]}
      action={{ label: "Get a price", href: "#calculator" }}>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Sheffield · family-run since 1978 · BAR members</p>
          <h1 className="mt-3 max-w-3xl text-5xl font-semibold tracking-tight text-balance">
            A number on the page, before you ring anybody
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Everybody in this trade asks for your phone number and quotes on the call. We would
            rather give you a range now — it will be within about ten percent, and a twenty-minute
            survey turns it into a fixed price.
          </p>
          <div id="calculator" className="mt-10">
            <QuoteCalculator onBookSurvey={() => {}} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <TrustStrip items={[
          { title: "Fixed price after the survey", description: "Not an estimate that moves on the day" },
          { title: "£50,000 goods in transit", description: "Included, not an upsell" },
          { title: "Our own crew", description: "No subcontractors, no agency staff" },
        ]} />
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid gap-12 lg:grid-cols-2">
            <div>
              <SectionHeader eyebrow="Included" title="What is in the price"
                description="All of it, on every job, without asking." />
              <PriceList className="mt-6" items={[
                { name: "Two crew and a Luton", price: 0, meta: "Included", description: "Three crew above three bedrooms, at no extra cost — it is faster and it costs us less in hours." },
                { name: "Dismantling and rebuilding", price: 0, meta: "Included", description: "Beds, wardrobes, flat-pack. We bring the tools and we put it back together at the other end." },
                { name: "Blankets, straps and covers", price: 0, meta: "Included", description: "Mattress bags, sofa covers, floor protection and door guards at both ends." },
                { name: "Goods in transit insurance", price: 0, meta: "Included", description: "£50,000. Higher cover is available and costs about £30." },
              ]} />
            </div>
            <div>
              <SectionHeader eyebrow="Not included" title="What costs extra, and how much"
                description="Written down so it is never a conversation on the day." />
              <PriceList className="mt-6" items={[
                { name: "Packing service", price: 60, meta: "Per room", description: "Two extra people the day before, with boxes and paper. Most people pack the kitchen themselves and let us do the rest." },
                { name: "Boxes, if you pack", price: 45, meta: "Typical 3-bed", description: "Delivered a fortnight before and collected free afterwards. Unused ones are refunded." },
                { name: "Piano, safe or pool table", price: 180, meta: "From", description: "Specialist gear and usually a fourth person. An upright is £180; a grand needs a look first." },
                { name: "Storage between dates", price: 22, meta: "Per week", description: "In our own warehouse, in wheeled containers. Common when a chain slips and nobody plans for it." },
                { name: "Waiting time", price: 45, meta: "Per hour, after the first", description: "Only when a completion runs late. The first hour is free because it usually does." },
                { name: "Parking suspension", price: 0, meta: "At cost", description: "We apply to the council and pass on exactly what they charge. Usually £45 in Sheffield." },
              ]} />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="The survey" title="Twenty minutes, and then the price is fixed"
          description="Either somebody comes round or we do it over a video call, which is quicker and works just as well for most houses." />
        <Steps className="mt-8" items={[
          { title: "Book a slot", description: "Evenings and Saturdays included. It is free, and there is no obligation at the end of it." },
          { title: "We walk round", description: "Every room, the loft, the shed and the garage. Say what is coming and what is going to the tip." },
          { title: "You get a fixed price", description: "In writing, within a day, valid for three months. It does not move unless what is moving does." },
        ]} />
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <Testimonial item={{ quote: "The calculator said £780 to £940 and the survey came back at £850. First firm that told us anything before asking for a phone number.", name: "Simone", role: "Crookes to Dore" }} />
          <Testimonial item={{ quote: "Completion was four hours late and they sat outside without a word about it. The first hour was free and the rest was on the sheet from day one.", name: "Adeel", role: "Hillsborough to Chesterfield" }} />
          <Testimonial item={{ quote: "They put the beds back together and hung the curtain poles. Nobody asked them to and nobody charged us for it.", name: "Jan", role: "Walkley to Bakewell" }} />
        </div>
      </section>

      <section id="areas" className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="Where we go" title="Anywhere, from here"
                description="Sheffield and the whole of South Yorkshire and North Derbyshire as a day job. Further afield is a two-day move and priced the same way." />
              <ServiceArea className="mt-6" placeholder="Your postcode"
                areas={["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "S10", "S11", "S12", "S13", "S14", "S17", "S18", "S20", "S21", "S25", "S26", "S35", "S36", "S40", "S41", "S42", "S43", "S60", "S61", "S62", "S63", "S64", "S65", "S66", "S70", "S71", "S72", "S73", "S74", "S75", "DE4", "DE45", "SK13", "SK17"]}
                note="Outside these we still come — it is a mileage charge rather than a refusal, and the calculator has already included it." />
            </div>
            <div>
              <SectionHeader eyebrow="Asked often" title="Before you book" />
              <Faq className="mt-6" items={[
                { question: "How accurate is the calculator?", answer: "Within about ten percent for an ordinary house move. It gets it wrong on lofts full of things and on houses with a lot of stairs, which is what the survey is for." },
                { question: "How far ahead should I book?", answer: "Six weeks for a Friday at the end of a month, which is when half the country moves. A Tuesday in the middle of a month is often available inside a fortnight and costs less." },
                { question: "What if my completion falls through?", answer: "Move the date once for nothing, at any notice, including on the morning. It happens to about one move in eight and charging for it would be charging for the housing market." },
                { question: "Do you take the old furniture away?", answer: "Yes, to the tip or to a charity, and we will tell you which is possible. Charged at the tip fee plus an hour." },
                { question: "Are you actually insured?", answer: "£50,000 goods in transit and £2m public liability, and we are BAR members, which means an ombudsman you can go to if we are wrong. Ask any firm for both certificates — plenty cannot produce them." },
              ]} />
            </div>
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
