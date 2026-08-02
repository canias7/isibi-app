// repair-shop /prices — every repair, by device. The picker filters it rather
// than the page listing everything at once, because a flat list of eighty
// prices across seven device families is a list nobody reads.
import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { BeforeAfter } from "@/components/ui/before-after";
import { DevicePicker } from "@/components/ui/device-picker";
import { Faq } from "@/components/ui/faq";
import { PriceList } from "@/components/ui/price-list";
import { SectionHeader } from "@/components/ui/section-header";
import { TrustStrip } from "@/components/ui/trust-strip";
import { MAKES } from "./index";
export const Route = createFileRoute("/prices")({ component: P });
const ALL: { make: string; items: { name: string; price: number | string; meta: string; description: string }[] }[] = [
  {
    make: "iPhone", items: [
      { name: "Screen, genuine part", price: 149, meta: "While you wait, 45 min", description: "Apple part. Keeps Face ID and True Tone." },
      { name: "Screen, aftermarket", price: 79, meta: "While you wait, 45 min", description: "Good copy. Keeps Face ID, slightly less bright, flags as unknown in settings." },
      { name: "Battery", price: 59, meta: "While you wait, 30 min", description: "Over 80% health and we will tell you not to bother." },
      { name: "Charge port", price: 65, meta: "Same day", description: "Half of these are lint. Cleaning is free." },
      { name: "Rear glass", price: 95, meta: "Two days", description: "Laser removal. Pro Max is dearer by size." },
      { name: "Camera", price: 85, meta: "Same day", description: "Rear main. Front is £65." },
      { name: "Water damage", price: 45, meta: "Diagnostic, 3–5 days", description: "The fee covers the clean and the assessment whether or not it comes back." },
    ],
  },
  {
    make: "Samsung", items: [
      { name: "Screen, genuine service pack", price: 189, meta: "Two to three days", description: "Includes frame and battery, which is why it is dearer than the iPhone equivalent." },
      { name: "Battery", price: 65, meta: "Same day", description: "Glued in since about 2018." },
      { name: "Charge port", price: 60, meta: "Same day", description: "Soldered on most models." },
      { name: "Rear glass", price: 70, meta: "Two days", description: "Heat and patience." },
      { name: "Z Flip / Fold inner screen", price: 320, meta: "Five days", description: "Ordered from Samsung. Honest answer: check your insurance first." },
      { name: "Water damage", price: 45, meta: "Diagnostic, 3–5 days", description: "Same terms as everything else." },
    ],
  },
  {
    make: "Google Pixel", items: [
      { name: "Screen", price: 139, meta: "Two to three days", description: "Pixel parts are the slowest thing we order." },
      { name: "Battery", price: 65, meta: "Same day", description: "Straightforward from the 6 onwards." },
      { name: "Charge port", price: 60, meta: "Same day", description: "Board-level on the 7 and later." },
      { name: "Rear glass", price: 70, meta: "Two days" , description: "Same job as the Samsung." },
    ],
  },
  {
    make: "iPad", items: [
      { name: "Screen, standard or Mini", price: 99, meta: "Two days", description: "Digitiser only." },
      { name: "Screen, Air or Pro", price: 245, meta: "Three to five days", description: "Bonded assembly. Worth checking against a replacement on older models." },
      { name: "Battery", price: 89, meta: "Three days", description: "Glued and awkward. Nobody does this while you wait." },
      { name: "Charge port", price: 75, meta: "Two days", description: "Soldered. Try a clean first." },
      { name: "Bent frame", price: 0, meta: "Quoted", description: "Usually not economic and we will say so plainly." },
    ],
  },
  {
    make: "MacBook", items: [
      { name: "Battery", price: 129, meta: "Two days", description: "Glued to the case since 2016. Includes the trackpad cable." },
      { name: "Keyboard", price: 0, meta: "Quoted", description: "Butterfly models 2016–2019 are a top-case job and expensive. Quoted before we start." },
      { name: "Screen", price: 0, meta: "Quoted, £280–£600", description: "Depends entirely on model. Always after a look." },
      { name: "Liquid damage", price: 60, meta: "Diagnostic, 5 days", description: "Board-level. The one thing that genuinely might not come back." },
      { name: "SSD upgrade", price: 0, meta: "Quoted", description: "Only possible on 2015 and earlier. Soldered after that, and we will not pretend otherwise." },
      { name: "Fan and repaste", price: 75, meta: "Same day", description: "For anything loud or throttling." },
    ],
  },
  {
    make: "Laptop, other", items: [
      { name: "Diagnostic", price: 30, meta: "Same day", description: "Waived if you go ahead." },
      { name: "Screen", price: 110, meta: "From, two days", description: "Most 15in panels land £110–£160 fitted." },
      { name: "Battery", price: 85, meta: "From, two days", description: "Ordered in unless it is common." },
      { name: "SSD upgrade and clone", price: 95, meta: "Same day", description: "1TB drive included, whole system cloned. Best thing you can do to an old laptop." },
      { name: "Keyboard", price: 70, meta: "From, two days", description: "Depends on whether it is a top-case job." },
      { name: "DC jack", price: 65, meta: "Two days", description: "Soldered. Common on anything four years old." },
      { name: "Won't turn on", price: 30, meta: "Diagnostic first", description: "Could be a reseat, could be a board. We find out and ring you." },
    ],
  },
  {
    make: "Games console", items: [
      { name: "HDMI port", price: 85, meta: "Three days", description: "Board-level soldering. The most common console job by a distance." },
      { name: "Full clean and repaste", price: 65, meta: "Same day", description: "For anything loud or shutting off." },
      { name: "Disc drive", price: 90, meta: "Three days", description: "PS5 drives are paired to the board." },
      { name: "Joy-Con drift", price: 35, meta: "While you wait", description: "Per pair, new sticks." },
      { name: "Switch charge port", price: 55, meta: "Two days", description: "Soldered." },
      { name: "Steam Deck fan or stick", price: 55, meta: "Two days", description: "Both common, both easy." },
    ],
  },
];
function P() {
  const [device, setDevice] = React.useState<{ make: string; model: string | null } | null>(null);
  const shown = device ? ALL.filter((a) => a.make === device.make) : ALL;
  return (
    <SiteChrome name="Neepsend Repair Co." tagline="Phone, tablet, laptop and console repairs in Kelham Island, Sheffield."
      links={[{ label: "Home", href: "#/" }, { label: "Track a repair", href: "#/track" }]}
      action={{ label: "Track a repair", href: "#/track" }}>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="Prices" title="Every repair we do, fitted, VAT in"
          description="Nothing is added at the counter and nothing is 'from' unless it says so. Pick a device to cut the list down, or read all of it." />

        <div className="mt-10 max-w-3xl">
          <DevicePicker makes={MAKES} value={device} onChange={setDevice} />
        </div>

        <div className="mt-12 space-y-14">
          {shown.map((a) => (
            <section key={a.make} className="border-t border-border pt-8">
              <h2 className="text-2xl font-semibold tracking-tight">{a.make}</h2>
              <div className="mt-4 max-w-3xl">
                <PriceList items={a.items.map((i) => ({ ...i, price: i.price === 0 ? "Quoted" : i.price }))} />
              </div>
            </section>
          ))}
        </div>

        <section className="mt-14 border-t border-border pt-10">
          <TrustStrip items={[
            { title: "12-month warranty", description: "On the part and the work" },
            { title: "No fix, no fee", description: "Except stated diagnostics" },
            { title: "Price is the price", description: "Nothing added at the counter" },
          ]} />
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="Genuine or aftermarket" title="The choice we make you make"
                description="Most shops fit whatever they have and say nothing. We would rather you picked, so here is the honest difference." />
              <ul className="mt-6 divide-y divide-border border-y border-border text-base">
                <li className="py-3"><span className="font-medium">Genuine</span> — the manufacturer's own part. Full brightness and colour, no warnings in settings, does not affect the maker's remaining warranty. Roughly twice the price.</li>
                <li className="py-3"><span className="font-medium">Aftermarket</span> — a good copy. Slightly dimmer, keeps Face ID and touch, permanently flags as an unknown part. Fine on a three-year-old phone.</li>
                <li className="py-3"><span className="font-medium">Both</span> — carry the same 12-month warranty from us, which is the part we actually control.</li>
                <li className="py-3"><span className="font-medium">What we will not do</span> — fit an aftermarket part and let you believe it was genuine. It is on the slip either way.</li>
              </ul>
            </div>
            <div>
              <SectionHeader eyebrow="A real one" title="Rear glass, iPhone 14 Pro" />
              <BeforeAfter className="mt-6" before={null} after={null}
                beforeLabel="Before" afterLabel="After" ratio="4/3" />
              <p className="mt-3 text-sm text-muted-foreground">
                Two days, £95, laser removal. Photographed with the customer's permission.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="max-w-3xl">
            <SectionHeader eyebrow="Asked often" title="About the prices" />
            <Faq className="mt-6" items={[
              { question: "Why is a Samsung screen dearer than an iPhone one?", answer: "Because Samsung only sells a service pack — screen, frame and battery together. There is no screen-only genuine part, so the job costs what it costs." },
              { question: "Why is there a diagnostic fee on liquid damage?", answer: "Because the ultrasonic clean and the board inspection take two hours whether or not the thing comes back on. Charging only for successes would mean charging the successes double." },
              { question: "Can you price it over the phone?", answer: "For anything on this list, yes, and the price is the price. For 'it fell in the bath' or 'it won't turn on', no — anybody who does is guessing." },
              { question: "Do you match other quotes?", answer: "We will tell you honestly if somebody is cheaper and whether we think their part is the same. Sometimes it is." },
              { question: "What if it breaks again?", answer: "Twelve months, part and labour, no quibbling. Physical damage to a new screen is not covered and we will be straight with you about which it is." },
            ]} />
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
