// repair-shop — DEVICE-FIRST: choose the device, because every question after
// it depends on the answer. Walk-in-and-wait versus leave-it-with-us is the
// fact people actually need and almost nobody publishes.
import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { DevicePicker } from "@/components/ui/device-picker";
import { Faq } from "@/components/ui/faq";
import { LocationCard } from "@/components/ui/location-card";
import { OpeningHours } from "@/components/ui/opening-hours";
import { PriceList } from "@/components/ui/price-list";
import { SectionHeader } from "@/components/ui/section-header";
import { TrustStrip } from "@/components/ui/trust-strip";
export const Route = createFileRoute("/")({ component: P });
export const MAKES = [
  { make: "iPhone", models: ["16 / 16 Plus", "16 Pro / Pro Max", "15 / 15 Plus", "15 Pro / Pro Max", "14 series", "13 series", "12 series", "11 / XR", "SE"] },
  { make: "Samsung", models: ["S25 series", "S24 series", "S23 series", "A55 / A54", "A35 / A34", "Z Flip", "Z Fold"] },
  { make: "Google Pixel", models: ["9 / 9 Pro", "8 / 8 Pro", "7 / 7 Pro", "6 / 6a"] },
  { make: "iPad", models: ["Pro 11in", "Pro 12.9in", "Air", "Standard", "Mini"] },
  { make: "MacBook", models: ["Air M2/M3", "Pro 14in", "Pro 16in", "Intel, 2016–2020"] },
  { make: "Laptop, other", models: ["Dell", "HP", "Lenovo", "Asus", "Acer", "Framework"] },
  { make: "Games console", models: ["PS5", "PS4", "Xbox Series X/S", "Switch", "Switch 2", "Steam Deck"] },
];
const PRICES: Record<string, { name: string; price: number; meta: string; description: string }[]> = {
  iPhone: [
    { name: "Screen, genuine part", price: 149, meta: "While you wait, 45 min", description: "Apple part, keeps Face ID and True Tone. The one we recommend for anything under three years old." },
    { name: "Screen, aftermarket", price: 79, meta: "While you wait, 45 min", description: "Good quality copy. Slightly less bright, keeps Face ID, and it will say 'unknown part' in settings forever." },
    { name: "Battery", price: 59, meta: "While you wait, 30 min", description: "Genuine cell. If yours is over 80% health we will tell you not to bother." },
    { name: "Charge port", price: 65, meta: "Same day", description: "Half the time it is just lint. We will clean it out and charge you nothing." },
    { name: "Rear glass", price: 95, meta: "Two days", description: "Laser removal. Priced by size, so a Pro Max is dearer." },
    { name: "Water damage", price: 45, meta: "Diagnostic, 3–5 days", description: "The £45 is for the ultrasonic clean and the assessment, whether or not it comes back. We say so up front." },
  ],
  Samsung: [
    { name: "Screen, genuine part", price: 189, meta: "Two to three days", description: "Samsung service pack, which includes the frame and the battery. Ordered in, so not while you wait." },
    { name: "Battery", price: 65, meta: "Same day", description: "Glued in on every model since about 2018, so it is an hour of work rather than ten minutes." },
    { name: "Charge port", price: 60, meta: "Same day", description: "Soldered on most models. Try a clean first — bring it in and we will look for free." },
    { name: "Rear glass", price: 70, meta: "Two days", description: "Heat and patience. Cheaper than the iPhone equivalent." },
    { name: "Water damage", price: 45, meta: "Diagnostic, 3–5 days", description: "Same as the iPhone: the fee is for the work, not for the result." },
  ],
  "Google Pixel": [
    { name: "Screen", price: 139, meta: "Two to three days", description: "Ordered in. Pixel parts are the slowest thing we buy and we would rather say so than promise a Tuesday." },
    { name: "Battery", price: 65, meta: "Same day", description: "Straightforward on the 6 onwards." },
    { name: "Charge port", price: 60, meta: "Same day", description: "Board-level on the 7 and later. Bring it in for a look first." },
  ],
  iPad: [
    { name: "Screen, standard", price: 99, meta: "Two days", description: "Digitiser only on the standard and Mini. Air and Pro are bonded, which is the dearer job below." },
    { name: "Screen, Air or Pro", price: 245, meta: "Three to five days", description: "Bonded assembly, ordered in. Honestly worth checking against a replacement on older models." },
    { name: "Battery", price: 89, meta: "Three days", description: "Glued and awkward. Nobody does this while you wait and anybody who says they will is guessing." },
    { name: "Charge port", price: 75, meta: "Two days", description: "Soldered. Try a clean first." },
  ],
  MacBook: [
    { name: "Battery", price: 129, meta: "Two days", description: "Glued to the case on every model since 2016. Includes the trackpad cable, which is the thing that usually gets damaged doing it." },
    { name: "Keyboard", price: 0, meta: "Quoted", description: "Depends entirely on the model. The 2016–2019 butterfly ones are a top-case job and it is expensive — we will tell you before we start." },
    { name: "Screen", price: 0, meta: "Quoted", description: "£280 to £600 depending on the model. Always quoted after a look." },
    { name: "Liquid damage", price: 60, meta: "Diagnostic, 5 days", description: "Board-level work and it is the one thing that genuinely might not come back. £60 covers the attempt." },
  ],
  "Laptop, other": [
    { name: "Diagnostic", price: 30, meta: "Same day", description: "Waived if you go ahead with the repair. Almost always tells us something a phone call cannot." },
    { name: "Screen", price: 110, meta: "From, two days", description: "Depends on the panel. Most 15in laptops land between £110 and £160 fitted." },
    { name: "Battery", price: 85, meta: "From, two days", description: "Ordered in unless it is a common model." },
    { name: "SSD upgrade and clone", price: 95, meta: "Same day", description: "Includes a 1TB drive and cloning your whole system over. The single best thing you can do to an old laptop." },
    { name: "Won't turn on", price: 30, meta: "Diagnostic first", description: "Could be £0 and a reseat, could be a board. We find out and then we ring you." },
  ],
  "Games console": [
    { name: "HDMI port", price: 85, meta: "Three days", description: "Board-level soldering. The most common PS5 and Xbox job by a distance." },
    { name: "Full clean and repaste", price: 65, meta: "Same day", description: "For anything loud or shutting off. Includes new thermal paste and pads." },
    { name: "Disc drive", price: 90, meta: "Three days", description: "PS5 drives are paired to the board, so it is a swap plus a re-pair." },
    { name: "Joy-Con drift", price: 35, meta: "While you wait", description: "Per pair. New sticks, not a calibration fudge." },
    { name: "Steam Deck fan or stick", price: 55, meta: "Two days", description: "Both are common and both are easy." },
  ],
};
function P() {
  const [device, setDevice] = React.useState<{ make: string; model: string | null } | null>(null);
  const list = device ? PRICES[device.make] : null;
  return (
    <SiteChrome name="Neepsend Repair Co." tagline="Phone, tablet, laptop and console repairs in Kelham Island, Sheffield."
      links={[{ label: "All prices", href: "/prices" }, { label: "Track a repair", href: "/track" }, { label: "Find us", href: "#find-us" }]}
      action={{ label: "Track a repair", href: "/track" }}>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Kelham Island · walk in · no appointment · 12-month warranty</p>
          <h1 className="mt-3 max-w-3xl text-5xl font-semibold tracking-tight text-balance">
            What is it, and what has it done?
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Pick the device and the prices below change to match it, including how long it takes and
            whether you can wait for it. Every price is fitted, VAT in, with nothing added at the
            counter.
          </p>
          <div className="mt-10 max-w-3xl">
            <DevicePicker makes={MAKES} value={device} onChange={setDevice} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        {list ? (
          <>
            <SectionHeader eyebrow={device?.model ?? device?.make} title={`${device?.make} — the common jobs`}
              description="Fitted price including VAT. 'While you wait' means exactly that: sit down, it takes the time it says, and you walk out with it." />
            <div className="mt-8 max-w-3xl">
              <PriceList items={list} />
            </div>
            <a className="mt-6 inline-block text-sm font-medium underline underline-offset-4" href="/prices">Every repair we do, for every device →</a>
          </>
        ) : (
          <div className="max-w-2xl">
            <SectionHeader eyebrow="Prices" title="Pick a device above"
              description="Every price on this site depends on what it is, so there is no useful list until you have said. If yours is not up there, ring — we do more than we can fit on a page." />
            <a className="mt-6 inline-block text-sm font-medium underline underline-offset-4" href="/prices">Or see everything at once →</a>
          </div>
        )}
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <TrustStrip items={[
            { title: "12-month warranty", description: "On the part and the work, no quibbling" },
            { title: "No fix, no fee", description: "Except the stated diagnostic on liquid damage" },
            { title: "Your data stays yours", description: "We do not need your passcode for most jobs" },
          ]} />
          <div className="mt-10 grid gap-10 lg:grid-cols-2">
            <div>
              <SectionHeader eyebrow="Turnaround" title="Wait, or leave it"
                description="The fact nobody publishes, and the one that decides whether you come on a lunch break or a Saturday." />
              <ul className="mt-6 divide-y divide-border border-y border-border text-base">
                <li className="py-3"><span className="font-medium">While you wait, 30–60 min</span> — iPhone screens and batteries, Joy-Con sticks, console cleans. Come any time we are open.</li>
                <li className="py-3"><span className="font-medium">Same day</span> — most charge ports, Samsung and Pixel batteries, laptop SSDs. In by 11, out by closing.</li>
                <li className="py-3"><span className="font-medium">Two to three days</span> — anything with a part to order: Samsung and Pixel screens, iPads, rear glass.</li>
                <li className="py-3"><span className="font-medium">Three to five days</span> — liquid damage and board-level work. We ring you before we do anything that costs more than the quote.</li>
              </ul>
            </div>
            <div>
              <SectionHeader eyebrow="Track it" title="Do not ring to ask if it is ready"
                description="Every repair gets a ticket number on the slip and in a text. Type it into the tracker and it tells you exactly where it is, including when it is waiting on a part." />
              <a className="mt-6 inline-block rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="/track">Track a repair</a>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                We text when it is ready as well. The tracker is for the day after you dropped it
                off, when nothing has happened yet and it is quietly bothering you.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="find-us" className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
          <div>
            <SectionHeader eyebrow="Find us" title="Alma Street" />
            <LocationCard className="mt-6" name="Neepsend Repair Co."
              address="Unit 2, Alma Street, Kelham Island, Sheffield, S3 8SA"
              note="Twelve minutes from the Cathedral tram stop. Two hours free parking on Russell Street. Step-free, and there is a bench because most people wait." />
            <OpeningHours className="mt-6" days={[
              { day: 1, label: "Monday", open: "09:30", close: "17:30" },
              { day: 2, label: "Tuesday", open: "09:30", close: "17:30" },
              { day: 3, label: "Wednesday", open: "09:30", close: "17:30" },
              { day: 4, label: "Thursday", open: "09:30", close: "19:00" },
              { day: 5, label: "Friday", open: "09:30", close: "17:30" },
              { day: 6, label: "Saturday", open: "10:00", close: "16:00" },
              { day: 0, label: "Sunday" },
            ]} />
          </div>
          <div>
            <SectionHeader eyebrow="Asked often" title="The counter questions" />
            <Faq className="mt-6" items={[
              { question: "Do you need my passcode?", answer: "Not for a screen or a battery — we test with the camera and the sensors. For anything software we do, and we would rather you changed it afterwards." },
              { question: "Will I lose my photos?", answer: "No, on a hardware repair nothing is wiped. Back it up anyway before you bring it in, because that is true of every repair shop on earth." },
              { question: "Does a screen repair void my warranty?", answer: "On an Apple device an aftermarket part ends Apple's cover for that part. A genuine part fitted by us does not, and we will explain which you are getting before we start." },
              { question: "Is it worth fixing?", answer: "Sometimes not, and we will say so. A £245 iPad Air screen on a 2019 model is usually a no, and we would rather tell you that than take the money." },
              { question: "Can you recover data from a dead one?", answer: "Often. It is a different job with its own price and it starts with a free look — bring it in rather than describing it on the phone." },
              { question: "Do you buy old devices?", answer: "Yes, working or not. Ask at the counter; it is usually more than a trade-in site offers and you get it that day." },
            ]} />
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
