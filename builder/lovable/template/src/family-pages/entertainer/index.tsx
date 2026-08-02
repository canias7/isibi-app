// entertainer — SEE-IT-THEN-CHECK-THE-DATE: the act playing, with the date box
// beside it. Nobody books an act they have not seen, and nobody watches a clip
// after filling in a form — so the order is the whole design.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { DateEnquiry } from "@/components/ui/date-enquiry";
import { Faq } from "@/components/ui/faq";
import { Gallery } from "@/components/ui/gallery";
import { PriceList } from "@/components/ui/price-list";
import { SectionHeader } from "@/components/ui/section-header";
import { TestimonialGrid } from "@/components/ui/testimonial";
import { VideoEmbed } from "@/components/ui/video-embed";
export const Route = createFileRoute("/")({ component: P });
export const PACKAGES = [
  { name: "The evening", price: 1450, description: "Two 60-minute sets, DJ between and after until midnight. What almost every wedding books.", meta: "Most booked" },
  { name: "The long evening", price: 1650, description: "Two 60-minute sets and DJ through to 1am, where the venue allows it.", meta: "Add an hour" },
  { name: "Ceremony and drinks", price: 450, description: "Acoustic trio from the band — aisle, signing, and an hour of drinks reception.", meta: "Add-on" },
  { name: "The whole day", price: 1950, description: "Ceremony, drinks, both sets and the DJ. One booking, one arrival, one set of parking.", meta: "Saves £250" },
  { name: "Corporate, two sets", price: 1650, description: "Same band, weekday or weekend, invoice on 30 days.", meta: "VAT registered" },
  { name: "Function or party, one set", price: 950, description: "Ninety minutes as one set, plus playlist through the PA either side.", meta: "Under 100 guests" },
];
export const QUOTES = [
  { quote: "They played the first dance we asked for even though it is a horrible song, and they played it properly. The floor did not empty once between nine and midnight.", name: "Hannah & Joe", role: "Hazlewood Castle, June" },
  { quote: "Set up while we were eating without anyone noticing they were there, which sounds like a small thing and is not.", name: "Marcus Bell", role: "Best man, Wortley Hall" },
  { quote: "Our venue has a 96dB limiter and half the bands we asked said it would not work. This lot had already played there and knew exactly what to do about it.", name: "Priya Sandhu", role: "Bride, Tankersley Manor" },
  { quote: "Booked them for a company do expecting a wedding band doing corporate. Got a proper gig. Three people asked me for the name before ten o'clock.", name: "Deborah Fenwick", role: "Events, Sheffield Forgemasters" },
];
function P() {
  return (
    <SiteChrome name="The Larkin Set" tagline="Six-piece function band. Sheffield, Leeds, Manchester and anywhere within two hours."
      links={[{ label: "Packages", href: "#/packages" }, { label: "Check a date", href: "#/book" }, { label: "Asked often", href: "#faq" }]}
      action={{ label: "Check my date", href: "#/book" }}>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid items-start gap-12 lg:grid-cols-[1.25fr_1fr]">
            <div>
              {/* THE ACT, PLAYING, FIRST. Nobody books a band they have not
                  heard, and a form above the video gets neither. */}
              <VideoEmbed url="https://www.youtube.com/watch?v=aqz-KE-bpKQ" title="The Larkin Set — live at Wortley Hall, 2026" />
              <h1 className="mt-8 text-5xl font-semibold tracking-tight text-balance">
                Thirty seconds is enough to know
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
                It is one take from the middle of a real wedding, not a showreel cut to a click
                track. Six of us, live, no backing tracks on anything — and if that is what you
                want, the date box is right there rather than three pages away.
              </p>
              <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-4 text-sm sm:grid-cols-4">
                <div><dt className="text-muted-foreground">From</dt><dd className="mt-1 text-lg font-semibold tabular-nums">£950</dd></div>
                <div><dt className="text-muted-foreground">Six-piece</dt><dd className="mt-1 text-lg font-semibold">Live</dd></div>
                <div><dt className="text-muted-foreground">Set-up</dt><dd className="mt-1 text-lg font-semibold">75 min</dd></div>
                <div><dt className="text-muted-foreground">Since</dt><dd className="mt-1 text-lg font-semibold">2011</dd></div>
              </dl>
            </div>
            <div>
              <DateEnquiry heading="Is your date free?" status="free" defaultDate="2026-09-19" defaultGuests={110}
                minGuests={20} maxGuests={400} now={new Date(2026, 7, 2)} />
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                The diary is live and it is the real one. A Saturday in June or September usually
                goes eighteen months out; a Friday in March is often free at six weeks.
              </p>
              <div className="mt-6 rounded-lg border border-border bg-muted/50 p-5">
                <p className="text-base font-medium">If the date is taken</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  We will say so rather than putting you on a list. There are three other bands in
                  the city we would happily send you to and we will name them, because a wedding
                  with no band is worse than a wedding with somebody else's.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="What it costs" title="The prices, on the front page"
          description="Rather than 'contact us for a bespoke quotation', which means the number depends on how the venue sounds when you say it. Everything here includes PA, lights, travel inside 60 miles and public liability." />
        <div className="mt-8 grid gap-10 lg:grid-cols-[1.2fr_1fr]">
          <PriceList items={PACKAGES} />
          <div>
            <h3 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Included, not extra</h3>
            <ul className="mt-3 divide-y divide-border border-y border-border text-base">
              <li className="py-3">Full PA and stage lighting, and an engineer who is one of the six</li>
              <li className="py-3">DJ between and after the sets, from your list or ours</li>
              <li className="py-3">First dance learned, whatever it is, at no charge</li>
              <li className="py-3">Travel and parking within 60 miles of Sheffield</li>
              <li className="py-3">£10m public liability and PAT certificates, sent to your venue directly</li>
              <li className="py-3">Two site visits if the venue is one we have not played</li>
            </ul>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Extras are on <a className="underline underline-offset-4" href="#/packages">the packages page</a>{" "}
              and there are four of them. There is no service charge, no admin fee and no
              per-musician surcharge — the number in the list is the number on the invoice.
            </p>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <SectionHeader eyebrow="Where we have played" title="About ninety a year, mostly within an hour" />
          <Gallery className="mt-8" columns={4} items={[
            { src: null, alt: "The band at Wortley Hall" },
            { src: null, alt: "Setting up at Hazlewood Castle" },
            { src: null, alt: "A full floor at Tankersley Manor" },
            { src: null, alt: "The horn section" },
            { src: null, alt: "A marquee in Derbyshire" },
            { src: null, alt: "The acoustic trio at a ceremony" },
            { src: null, alt: "Corporate night at Kelham Island" },
            { src: null, alt: "Load-out at one in the morning" },
          ]} />
          <div className="mt-12">
            <SectionHeader eyebrow="What people said afterwards" title="Including the awkward ones" />
            <TestimonialGrid className="mt-8" items={QUOTES} />
          </div>
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-6xl px-6 py-14">
        <div className="max-w-3xl">
          <SectionHeader eyebrow="Asked often" title="Before you enquire" />
          <Faq className="mt-6" items={[
            { question: "How much space do you need?", answer: "5m by 3m for the six of us, and 4m by 2.5m at a squeeze with the horns standing in front. Below that we can do a four-piece version and we will tell you rather than turn up and find out." },
            { question: "What about power?", answer: "Two separate 13A sockets on different circuits, within 15m. Marquees need a genny of at least 10kVA and it wants to be a silent one, because a diesel engine forty feet away is audible in every speech." },
            { question: "Does your venue have a sound limiter?", answer: "Plenty do and we have played most of them. Tell us the number — under 90dB we bring the electronic kit and it genuinely still works; under 85dB nobody should book a live band, including us, and we will say so." },
            { question: "How long do you need to set up?", answer: "Seventy-five minutes with access to the room, and it needs to be while people are eating or outside, not while they are in it. Load-out is forty minutes." },
            { question: "Can we choose the songs?", answer: "First dance is yours and free. Beyond that, a do-not-play list is more useful than a request list, and we will learn one extra song for nothing if it matters to you." },
            { question: "What if somebody is ill?", answer: "We have deps for every position who know the set, and in fourteen years we have never failed to turn up. If we could not, you would get the deposit back and three phone numbers the same day." },
          ]} />
        </div>
      </section>
    </SiteChrome>
  );
}
