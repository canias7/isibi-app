// optician /frames — lenses priced as SEPARATE OPTIONS, so a total can be
// worked out before committing.
//
// "FROM £99" IS THE STANDARD AND IT IS USELESS. The frame is a fraction of the
// bill; thinning, coating and a varifocal design are where the money goes, and
// every optician reveals them one at a time at the dispensing desk after the
// customer has already fallen for a frame. Listing them as priced options
// costs some upselling and produces a number somebody can decide on.
import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { OptionPricedList } from "@/components/ui/option-priced-list";
import { PriceList } from "@/components/ui/price-list";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/frames")({ component: P });

const FRAMES = [
  { name: "Own-brand acetate", description: "About forty shapes, made in Italy. Two-year frame guarantee", price: 89 },
  { name: "Own-brand titanium", description: "Light, hypoallergenic, bends rather than snaps", price: 129 },
  { name: "Designer", description: "Twelve names. Priced as they arrive and we do not mark them up further", price: null, meta: "£150 – £320" },
  { name: "Children's, on an NHS voucher", description: "Genuinely free, from the whole children's range, not a tray by the door", price: 0 },
  { name: "Reglazing your own frame", description: "If it is structurally sound. We will say honestly when it is not", price: 35, meta: "plus lenses" },
  { name: "Repairs and adjustments", description: "Any frame, bought anywhere, whenever you like", price: 0, meta: "free, always" },
];

function P() {
  const [opts, setOpts] = React.useState<string[]>(["thin", "ar"]);
  return (
    <SiteChrome
      name="Hillsborough Eyecare"
      tagline="Frames, and lenses priced so you can add them up."
      links={[
        { label: "Home", href: "/" },
        { label: "The eye test", href: "/eye-test" },
      ]}
      action={{ label: "Book an eye test", href: "/eye-test" }}
    >
      <div className="mx-auto max-w-5xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">Frames and lenses</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          The frame is the smaller half of the bill. Everything that goes into the lens is listed
          below as an option with a price on it, so you can work out the total before you fall in
          love with a frame rather than after.
        </p>

        <section className="mt-12">
          <SectionHeader eyebrow="Frames" title="Five ways to end up with a pair" />
          <div className="mt-6 max-w-2xl">
            <PriceList items={FRAMES} />
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Adjustments are free forever on anything, including frames bought online or on holiday.
            It takes two minutes and refusing to do it would be petty.
          </p>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="Lenses"
            title="Single vision, standard plastic, £45 — and then these"
            description="Tick what you want. Everything here is optional and the first two are the ones that genuinely matter for most prescriptions."
          />
          <div className="mt-8 max-w-2xl">
            {/* `delta`, in MINOR UNITS — the amount-input contract this
                component follows. And there is no `note` field: `label` is a
                ReactNode, so the honest sentence about each option goes inside
                it rather than being dropped. */}
            <OptionPricedList
              basePrice={4500}
              selected={opts}
              onChange={setOpts}
              options={[
                {
                  key: "thin", delta: 4000,
                  label: <><span className="font-medium">Thinned lenses (1.6 index)</span><span className="block text-sm text-muted-foreground">Worth it above about ±3.00. Below that you are paying for something nobody can see.</span></>,
                },
                {
                  key: "thinner", delta: 8500,
                  label: <><span className="font-medium">Very thin (1.67 index)</span><span className="block text-sm text-muted-foreground">Above ±5.00. Genuinely different at that strength and a waste of money below it.</span></>,
                },
                {
                  key: "ar", delta: 3000,
                  label: <><span className="font-medium">Anti-reflection coating</span><span className="block text-sm text-muted-foreground">The one upgrade we would recommend to nearly everybody. It is the difference at night.</span></>,
                },
                {
                  key: "photo", delta: 6500,
                  label: <><span className="font-medium">Reactions to sunlight</span><span className="block text-sm text-muted-foreground">Does not darken behind a windscreen. Worth knowing before buying it for driving.</span></>,
                },
                {
                  key: "vari", delta: 12000,
                  label: <><span className="font-medium">Varifocal, standard design</span><span className="block text-sm text-muted-foreground">Takes a fortnight to adapt to. If you cannot, we remake them as bifocals free.</span></>,
                },
                {
                  key: "varipro", delta: 21000,
                  label: <><span className="font-medium">Varifocal, wider corridor</span><span className="block text-sm text-muted-foreground">A real difference at a computer screen. Not a difference for reading a book.</span></>,
                },
                {
                  key: "blue", delta: 2500,
                  label: <><span className="font-medium">Blue-light filter</span><span className="block text-sm text-muted-foreground">The evidence for it is weak and we will say so. Some people like it anyway.</span></>,
                },
              ]}
            />
          </div>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            That is the whole list. There is no eighth option we mention only at the desk, and
            nobody here is paid commission on any of it.
          </p>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="What we will talk you out of"
            title="Three things, honestly"
            description="Said here rather than at the till, where it would look like a technique."
          />
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">Thinning a weak prescription</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Below about ±3.00 you are paying £40 for a difference nobody can see. It is the most
                commonly sold unnecessary upgrade in this trade.
              </p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">The dearest varifocal</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                It matters at a computer and much less for a book. If you read on paper, the £120
                design is the right one.
              </p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">Buying here at all</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                A simple single-vision pair is genuinely cheaper online. We will print the
                prescription and the pupil measurement and wish you luck.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader title="Frame and lens questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Is there a two-for-one?",
                  answer:
                    "No. A second pair is 30% off and that is the whole offer. Two-for-one exists by pricing the first pair as if it were two, and we would rather not.",
                },
                {
                  question: "What if I cannot get on with varifocals?",
                  answer:
                    "Come back within eight weeks and we remake them as bifocals or two separate pairs at no charge. About one person in twenty needs this and it is not a failure on anybody's part.",
                },
                {
                  question: "How long is the guarantee?",
                  answer: "Two years on the frame, one year on the lens coatings, and free adjustments forever. A scratched lens in the first year is replaced once, no argument.",
                },
                {
                  question: "Can you glaze a frame I bought elsewhere?",
                  answer:
                    "Usually, for £35 plus lenses. We check it will take a lens safely first — some very thin metal and some vintage frames will not, and we will not pretend otherwise to take the money.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="/">Booking and hours</a>
            {" · "}
            <a className="underline underline-offset-4" href="/eye-test">What a test involves</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
