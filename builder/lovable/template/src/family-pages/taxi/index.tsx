// taxi — FARE-FIRST: two addresses and a fixed price, answered on the page.
// The whole trade runs on not saying, so saying is the entire position. The
// 24-hour number leads the header because half of this is somebody standing in
// the rain.
import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { FareQuote } from "@/components/ui/fare-quote";
import { Faq } from "@/components/ui/faq";
import { PriceList } from "@/components/ui/price-list";
import { SectionHeader } from "@/components/ui/section-header";
import { ServiceArea } from "@/components/ui/service-area";
import { Testimonial } from "@/components/ui/testimonial";
import { TrustStrip } from "@/components/ui/trust-strip";
export const Route = createFileRoute("/")({ component: P });
export const AIRPORTS = [
  { name: "Manchester Airport", price: 95, meta: "1h 10m", description: "Fixed. Includes an hour's free waiting on the way back and the drop-off charge." },
  { name: "Leeds Bradford", price: 78, meta: "1h", description: "Fixed, both ways. Drop-off charge included." },
  { name: "East Midlands", price: 88, meta: "1h 15m", description: "Fixed. The one people are quoted £140 for by an app on a Friday." },
  { name: "Doncaster Sheffield", price: 55, meta: "40m", description: "Fixed." },
  { name: "Birmingham", price: 165, meta: "2h", description: "Fixed. Cheaper than the train for three or more." },
  { name: "Heathrow", price: 320, meta: "3h 30m", description: "Fixed, and it needs a day's notice." },
];
function P() {
  const [fare, setFare] = React.useState<number | null>(null);
  return (
    <SiteChrome name="Hallam Cars" tagline="Private hire in Sheffield, 24 hours, licensed by the council."
      links={[{ label: "Fixed fares", href: "/fares" }, { label: "Accounts", href: "/account" }]}
      action={{ label: "0114 266 2626", href: "tel:01142662626" }}>

      <section className="border-b border-border">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="px-6 py-14 lg:px-12">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Licensed by Sheffield City Council · 24 hours · 61 cars</p>
            <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">
              A price before you ring
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
              Every other firm asks for your number and quotes on the call. Put the two addresses in
              and the price appears here — fixed, including waiting time and luggage, and it does
              not move because it is raining.
            </p>
            <TrustStrip className="mt-8" items={[
              { title: "Fixed, not metered", description: "The quote is what you pay" },
              { title: "No surge, ever", description: "Same price at 3am on New Year's Eve" },
              { title: "DBS-checked drivers", description: "Council licensed, badge on display" },
            ]} />
            <p className="mt-8 text-sm text-muted-foreground">
              No app to download and no account to make. Ring{" "}
              <a href="tel:01142662626" className="font-medium text-foreground underline underline-offset-4">0114 266 2626</a>{" "}
              at any hour and a person in Sheffield answers.
            </p>
          </div>
          <div className="border-t border-border px-6 py-14 lg:border-l lg:border-t-0 lg:px-12">
            <FareQuote
              fare={fare}
              includes={["Up to 15 minutes' waiting", "Two cases and two bags", "Card or cash"]}
              lines={fare ? [
                { label: "Journey, 4.2 miles", value: 11 },
                { label: "Night tariff, 11pm–6am", value: 3 },
              ] : undefined}
              onQuote={() => setFare(14)} onBook={() => {}} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SectionHeader eyebrow="Fixed fares" title="The places everybody goes"
            description="Quoted, agreed and written down. An airport run is where people get caught worst, so it is the one we publish first." />
          <a className="text-sm font-medium underline underline-offset-4" href="/fares">Every fixed fare →</a>
        </div>
        <div className="mt-8 max-w-3xl">
          <PriceList items={AIRPORTS} />
        </div>
        <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
          Airport fares are per car, not per person, and cover up to four people with cases. A
          six-seater is £20 more and needs booking rather than ringing on the day.
        </p>
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="Where we go" title="Sheffield, and out from it"
                description="Anywhere inside the city on the meter or a fixed price, whichever you prefer. Long distance is always fixed." />
              <ServiceArea className="mt-6" placeholder="Your postcode"
                areas={["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "S10", "S11", "S12", "S13", "S14", "S17", "S20", "S35", "S36"]}
                note="Outside the S postcodes we still come — it becomes a fixed price rather than a meter, quoted before you get in." />
            </div>
            <div className="space-y-4 self-start">
              <Testimonial item={{ quote: "£95 to Manchester, quoted on the website at eleven at night, and £95 was what I paid. The app wanted £186 for the same run.", name: "Yusuf", role: "Crookes" }} />
              <Testimonial item={{ quote: "Booked the 4am airport run three weeks ahead. He was outside at ten to and rang rather than sitting there beeping.", name: "Margaret", role: "Totley" }} />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="max-w-3xl">
          <SectionHeader eyebrow="Asked often" title="The things people check" />
          <Faq className="mt-6" items={[
            { question: "Is the price really fixed?", answer: "Yes, including if the traffic is bad. The only thing that changes it is you changing the journey — an extra stop is £3, and we will tell you before we set off." },
            { question: "Do you charge more at night?", answer: "There is a night tariff between 11pm and 6am, and it is on the quote as its own line before you book. There is no surge pricing and there never has been." },
            { question: "Can I pay by card?", answer: "Every car. Card, contactless, phone, or cash. No card surcharge." },
            { question: "How far ahead can I book?", answer: "Any distance. Airport runs before 6am are worth booking the week before, because there are only so many drivers who want them." },
            { question: "Wheelchair accessible?", answer: "Four cars in the fleet, and they need booking rather than ringing on the day. Say when you book and the fare is the same." },
            { question: "What if the flight is delayed?", answer: "We watch the flight number. An hour's waiting is included and after that it is £15 an hour — and we will still be there." },
          ]} />
        </div>
      </section>
    </SiteChrome>
  );
}
