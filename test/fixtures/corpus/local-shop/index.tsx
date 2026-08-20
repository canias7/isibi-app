// local-shop — COUNTER-FIRST: what you can actually do here, with the hours
// for each, which are not the shop's hours. The post office counter shuts at
// 17:30 while the shop is open till 22:00 and nobody publishes that, which is
// the most wasted journey on any high street.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AnnouncementBar } from "@/components/ui/announcement-bar";
import { CounterServices } from "@/components/ui/counter-services";
import { Faq } from "@/components/ui/faq";
import { LocationCard } from "@/components/ui/location-card";
import { OpeningHours } from "@/components/ui/opening-hours";
import { SectionHeader } from "@/components/ui/section-header";
export const Route = createFileRoute("/")({ component: P });
export const SERVICES = [
  {
    what: "Post Office counter", hours: "09:00 – 17:30, Sat to 12:30",
    detail: "Everything a main branch does except foreign currency ordered on the day. Passport check-and-send, vehicle tax, banking for all the main banks.",
  },
  {
    what: "Parcel drop and collect — Evri, InPost, DPD", hours: "Until 21:00",
    detail: "Later than the counter, on purpose. Bring the QR code or the reference; we can print a label for 50p if your phone has died.",
  },
  { what: "National Lottery", hours: "Till 22:00 on draw nights", detail: "Draws, scratchcards and claims up to £500 over the counter." },
  { what: "PayPoint — gas, electric, phone top-ups" },
  {
    what: "Key cutting", hours: "Whenever Raj is in — most afternoons", price: "From £4.50",
    detail: "Yale and Chubb domestic. Not car keys, not fobs, and not the newer restricted-profile ones.",
  },
  {
    what: "Passport photos", price: "£8 for four",
    detail: "Digital code for online applications included, which is the bit that catches people out.",
  },
  { what: "Photocopying and printing", price: "20p mono, 60p colour" },
  {
    what: "Dry cleaning drop-off", stopped: true,
    detail: "Until March 2025. The firm in Deepcar stopped collecting and nobody else will come out this far.",
  },
];
function P() {
  return (
    <SiteChrome name="Bolsterstone Stores" tagline="The village shop and Post Office. Open at six, seven days."
      links={[{ label: "What we stock", href: "/shop" }, { label: "Find us", href: "#find-us" }]}
      action={{ label: "Ring 0114 288 3012", href: "tel:01142883012" }}>

      <AnnouncementBar>
        Post Office counter closed Wednesday 6 August — Sheila is on a course. The shop is open as
        normal and parcels are unaffected.
      </AnnouncementBar>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.15fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Village shop · Post Office · 06:00–22:00</p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">
                The counter shuts before we do
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Half past five for the Post Office, ten at night for everything else — which is
                worth knowing before you walk down with a parcel at seven. Every one of these has
                its own hours and they are all on this page.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="tel:01142883012">Ring and ask</a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="/shop">What we stock</a>
              </div>
              <p className="mt-8 max-w-lg text-sm leading-relaxed text-muted-foreground">
                We do not sell anything online and we are not going to. What this page is for is
                stopping you making a journey for something we cannot do today, which is the only
                useful thing a shop's website has ever done for anybody.
              </p>
            </div>
            {/* THE COUNTER, above everything, with the hours that DIFFER marked
                and the ones that do not left alone. */}
            <CounterServices services={SERVICES}
              note="Anything not listed, ring and ask — after twenty-two years there is not much we have not been asked, and we will tell you honestly if somewhere else does it better." />
          </div>
        </div>
      </section>

      <section id="find-us" className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
          <div>
            <SectionHeader eyebrow="The shop" title="Six in the morning until ten at night"
              description="Every day of the year except Christmas Day. The Post Office counter inside it keeps different hours, which is the whole point of the list above." />
            <OpeningHours className="mt-6" days={[
              { day: 1, label: "Monday", open: "06:00", close: "22:00" },
              { day: 2, label: "Tuesday", open: "06:00", close: "22:00" },
              { day: 3, label: "Wednesday", open: "06:00", close: "22:00" },
              { day: 4, label: "Thursday", open: "06:00", close: "22:00" },
              { day: 5, label: "Friday", open: "06:00", close: "22:00" },
              { day: 6, label: "Saturday", open: "06:00", close: "22:00" },
              { day: 0, label: "Sunday", open: "07:00", close: "21:00" },
            ]} />
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Papers are in by half five and the bread comes at seven. Boxing Day and New Year's Day
              we open at eight and shut at four, which is on the door a fortnight beforehand.
            </p>
            <LocationCard className="mt-6" name="Bolsterstone Stores"
              address="Sunny Bank Road, Bolsterstone, Sheffield, S36 3ZP"
              note="Opposite the church. Two spaces outside and more on the lane. Step-free through the main door; the counter has a lowered section at the left-hand end." />
          </div>
          <div>
            <SectionHeader eyebrow="Asked often" title="The things people ring about" />
            <Faq className="mt-6" items={[
              { question: "What time does the Post Office shut?", answer: "Half past five, and half twelve on a Saturday. The shop stays open until ten either way, which is why people arrive at seven with a parcel and are surprised. Parcel drop-off for Evri, InPost and DPD does run until nine." },
              { question: "Can I withdraw cash?", answer: "At the Post Office counter, from any of the main banks, up to £300 — and there is a free cash machine on the outside wall, which is the only one within four miles." },
              { question: "Do you still take dry cleaning?", answer: "No, and we stopped in March 2025 because the firm in Deepcar will not collect out here any more. We have not found anybody to replace them and we are not pretending otherwise." },
              { question: "Do you deliver?", answer: "Papers, and prescriptions from the surgery, to about forty houses in the village. Nothing else, and there is no charge for either." },
              { question: "Can I pay my energy bill here?", answer: "Yes — PayPoint, whenever the shop is open, including at nine at night. Cash or card." },
              { question: "Do you cut car keys?", answer: "No. Domestic Yale and Chubb only. Car keys need a machine that costs more than this shop earns in a year, and the place on Manchester Road does them." },
            ]} />
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
