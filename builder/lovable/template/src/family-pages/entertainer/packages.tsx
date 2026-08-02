// entertainer /packages — what you get for what, with the extras named and
// priced rather than "POA". A function band's whole reputation for being
// expensive comes from the four things that turn up on the invoice.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Faq } from "@/components/ui/faq";
import { PriceList } from "@/components/ui/price-list";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { VideoEmbed } from "@/components/ui/video-embed";
import { PACKAGES } from "./index";
export const Route = createFileRoute("/packages")({ component: P });
function P() {
  return (
    <SiteChrome name="The Larkin Set" tagline="Six-piece function band. Sheffield, Leeds, Manchester and anywhere within two hours."
      links={[{ label: "Home", href: "#/" }, { label: "Check a date", href: "#/book" }]}
      action={{ label: "Check my date", href: "#/book" }}>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="Packages" title="Six of them, and the extras are named"
          description="Everything below includes the PA, the lights, the engineer, the DJ, travel inside 60 miles and the paperwork your venue will ask for. The four things that are extra are listed underneath rather than added at the end." />

        <section className="mt-10 grid gap-10 lg:grid-cols-[1.2fr_1fr]">
          <PriceList items={PACKAGES} />
          <div>
            <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">The four extras, priced</h2>
            <PriceList className="mt-3" items={[
              { name: "Travel beyond 60 miles", price: 1.2, meta: "Per mile, one way", description: "Covers the van and two cars. Beyond 120 miles it becomes overnight and that is £320 for the six of us." },
              { name: "Overnight accommodation", price: 320, description: "Three twin rooms, only where the gig ends after midnight more than two hours away. We book it; you pay what it cost." },
              { name: "Extra hour of DJ", price: 200, meta: "Past midnight", description: "Only if the venue licence allows it. Ask them before you ask us." },
              { name: "Second learned song", price: 0, meta: "Free", description: "The first is free and so is the second. The third is £75, which is roughly what the rehearsal costs us." },
            ]} />
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              That is the complete list. No service charge, no booking fee, no per-musician
              surcharge and no VAT on top for private bookings — we are VAT registered and the
              corporate prices show it separately on the invoice.
            </p>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="What an evening actually looks like" title="The shape of the night"
            description="Almost every wedding runs like this, and knowing it helps you plan the speeches and the food around it rather than the other way round." />
          <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["17:30 — we arrive", "Seventy-five minutes to set up, ideally while you are eating. We come in the back if there is a back."],
              ["19:30 — sound check done", "Then we disappear. You will not see us again until we start, and the room stays yours."],
              ["20:30 — first dance, then set one", "Sixty minutes. It starts slow and it does not stay slow."],
              ["22:45 — set two, then DJ", "Sixty minutes, then DJ to midnight. Load-out takes forty and we are quiet about it."],
            ].map(([k, v]) => (
              <div key={k} className="border-t border-border pt-4">
                <p className="font-medium">{k}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{v}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="The smaller versions" title="Four-piece and the acoustic trio"
                description="For rooms that cannot take six, and for the ceremony." />
              <div className="mt-6">
                <VideoEmbed url="https://vimeo.com/76979871" title="The acoustic trio — ceremony and drinks" />
              </div>
              <ul className="mt-6 divide-y divide-border border-y border-border text-base">
                <li className="py-3">
                  <span className="font-medium">Four-piece — £1,150</span>
                  <span className="block text-sm text-muted-foreground">
                    Drums, bass, guitar, vocals. No horns. For a room under 5m × 3m or a limiter
                    under 90dB, and it is a genuinely different sound rather than a smaller one.
                  </span>
                </li>
                <li className="py-3">
                  <span className="font-medium">Acoustic trio — £450</span>
                  <span className="block text-sm text-muted-foreground">
                    Guitar, upright bass, vocal. Aisle, signing, and an hour of drinks. Books
                    alongside the evening or on its own.
                  </span>
                </li>
                <li className="py-3">
                  <span className="font-medium">DJ only — £400</span>
                  <span className="block text-sm text-muted-foreground">
                    Same PA and lights, five hours, our engineer running it. We do not sell this
                    often and we will usually suggest a specialist instead if it is a club night.
                  </span>
                </li>
              </ul>
            </div>
            <div>
              <SectionHeader eyebrow="Corporate" title="A different conversation, and a different invoice"
                description="Weekdays are more available and no more expensive. Everything is on 30 days and the paperwork goes to whoever you tell us." />
              <SafeImage className="mt-6" src={null} alt="A corporate night at Kelham Island" ratio="4/3" />
              <ul className="mt-6 divide-y divide-border border-y border-border text-base">
                <li className="py-3">Purchase orders accepted, 30 day terms, VAT invoice with the booking</li>
                <li className="py-3">Risk assessment, method statement and PAT certificates as standard, sent to facilities without being chased</li>
                <li className="py-3">Awards and dinners: we will play under the speeches and stop dead on a cue, which most bands will not</li>
                <li className="py-3">No branding, no announcements and no MC work unless you ask — and if you do, it is free</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="max-w-3xl">
            <SectionHeader eyebrow="Asked often" title="About the money" />
            <Faq className="mt-6" items={[
              { question: "What is the deposit?", answer: "£300, and it holds the date properly — we take nothing else until six weeks before. It is refundable up to twelve months out, half up to six months, and not after that, because by then we have turned other work down." },
              { question: "When do I pay the rest?", answer: "Six weeks before, by transfer. Never on the night, and never in cash to somebody in a suit at the bar." },
              { question: "Do you charge more for a Saturday?", answer: "No. Same price every day, which is unusual and is the reason a Friday in March is such good value — it is not cheaper, it is just available." },
              { question: "Is there VAT?", answer: "We are VAT registered. Private bookings show it included in the prices on this page; corporate invoices show it separately because you will reclaim it." },
              { question: "What if we have to move the date?", answer: "Once, free, to any date we have free within eighteen months. We moved forty weddings in 2020 and did not keep a penny of anybody's money." },
              { question: "Can we pay in instalments?", answer: "Yes, any split you like between the deposit and six weeks before. Just say — there is no arrangement fee and no interest, because that would be an absurd thing to charge for." },
            ]} />
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
