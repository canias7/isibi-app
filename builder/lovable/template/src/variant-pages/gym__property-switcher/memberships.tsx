// gym/property-switcher /memberships — the plans page becomes RATES, and the
// chain's "one price everywhere" pitch inverts. A gym group's whole argument is
// that every branch costs the same; a hotel group's is the opposite — four
// different buildings, four different prices — so the honest version is a
// comparison table that lets somebody read across, plus the direct saving.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { ComparisonTable } from "@/components/ui/comparison-table";
import { DirectSaving } from "@/components/ui/direct-saving";
import { Faq } from "@/components/ui/faq";
import { RateCard } from "@/components/ui/rate-card";
import { SectionHeader } from "@/components/ui/section-header";
import { StatsBand } from "@/components/ui/stats-band";
import { HOUSES } from "./index";
export const Route = createFileRoute("/memberships")({ component: P });
function P() {
  return (
    <SiteChrome name="Four Houses" tagline="Four hotels in Yorkshire. One booking, one card, four completely different places."
      links={[{ label: "All four", href: "#/" }, { label: "One house", href: "#/location" }]}
      action={{ label: "Ring 01947 600 210", href: "tel:01947600210" }}>

      <div className="mx-auto max-w-6xl px-6 py-12">
        <SectionHeader eyebrow="Rates" title="Four buildings, four prices, and the differences stated"
          description="A gym chain's pitch is that every branch costs the same. Ours is the opposite: these are four different places and pretending they are interchangeable would send people to the wrong one." />

        <section className="mt-10 grid gap-10 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <RateCard label="House" unit="night" bands={["Cheapest room", "Typical", "Best room"]}
              caption="Per night, two people, breakfast included" rates={[
                { period: "The Works, Sheffield", units: 1, price: 110, more: [130, 210], note: "City, forty rooms, a lift, and a bar until one" },
                { period: "The Mill, Hebden Bridge", units: 1, price: 125, more: [145, 195], note: "Step-free throughout. The only one a wheelchair gets round unaided" },
                { period: "The Quay, Whitby", units: 1, price: 145, more: [165, 220], note: "Harbour rooms are the £165 ones. No lift, no parking" },
                { period: "The Wharfe, Wharfedale", units: 1, price: 165, more: [185, 245], note: "Dearest and the one people rebook. Eighteen rooms only" },
              ]}
              note="Breakfast, parking where there is any, and VAT are all in these figures. There is no resort fee, no cleaning fee and no charge for a cot — three things a hotel group is expected to add and we do not." />

            <div className="mt-10">
              <SectionHeader eyebrow="Read across" title="What each one actually has"
                description="The row people get wrong is the lift. Two of the four cannot have one and never will — they are listed buildings — so if it matters, this table is the page." />
              {/* A TICK AND A DASH, not colour. Somebody choosing on
                  accessibility is reading this on a phone and may not see a
                  green circle at all. */}
              <ComparisonTable className="mt-6"
                columns={HOUSES.map((h) => h.name)}
                rows={[
                  { feature: "Lift to every floor", values: [false, false, true, true] },
                  { feature: "Step-free entrance", values: [true, false, true, true] },
                  { feature: "Accessible room", values: [false, false, true, true] },
                  { feature: "Parking at the hotel", values: [true, false, true, true] },
                  { feature: "Dogs in some rooms", values: [true, true, true, false] },
                  { feature: "Bar open to non-residents", values: [true, true, true, true] },
                  { feature: "Kitchen seven days", values: [true, true, true, true] },
                  { feature: "Room that sleeps four", values: [true, false, true, false] },
                  { feature: "Within ten minutes of a station", values: [false, true, true, true] },
                ]} />
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                In column order: The Wharfe, The Quay, The Mill, The Works. Two of them cannot have a
                lift — both are listed and the answer is not going to change — so The Mill and The
                Works are the two to look at if stairs are a problem.
              </p>
            </div>
          </div>

          <div>
            <DirectSaving platform="Booking.com" platformPrice={194} ourPrice={165}
              checked="29 July" nights="The Wharfe, Fell room, two people, Friday 21 August, one night"
              instead="What direct always buys is the room we would actually put you in rather than the one an algorithm allocates, and a phone call to a person who has stood in it." />

            <div className="mt-8">
              <StatsBand items={[
                { value: "£110", label: "Cheapest room in the group" },
                { value: "15%", label: "Typical direct saving" },
                { value: "113", label: "Rooms across the four" },
              ]} />
            </div>

            <div className="mt-8 rounded-lg border border-border p-5">
              <p className="text-base font-medium">The card, and what it is not</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Ten nights across any of the four gets you an eleventh free, at any of the four. That
                is the whole scheme — no tiers, no points that expire, no app, and no email unless
                you ask for one. It exists because people who like one of these usually try the
                others, and it should not cost them more to do that.
              </p>
            </div>

            <div className="mt-8 rounded-lg border border-border bg-muted/50 p-5">
              <p className="text-base font-medium">If we are full, we will send you to the others first</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                And if all four are full, we will name two hotels that are not ours. A group that
                lets somebody give up rather than pointing them somewhere is a group optimising for
                the wrong month.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="max-w-3xl">
            <SectionHeader eyebrow="Asked often" title="About booking across the four" />
            <Faq className="mt-6" items={[
              { question: "Can I book two houses in one go?", answer: "Yes, and people touring the dales do it constantly. One booking, one payment, and we will tell you the drive between them honestly — Whitby to Hebden Bridge is two and a half hours and looks like ninety minutes on a map." },
              { question: "Is the cheapest one the worst?", answer: "No. The Works is cheapest because it is a city hotel with forty rooms and single-glazed windows onto Alma Street, not because it is worse. The Mill is cheaper than The Wharfe and is newer, quieter and more accessible." },
              { question: "Why is direct cheaper?", answer: "The platform takes about fifteen per cent and we would rather you had it. The comparison on this page is dated for that reason — if it is lower there today, tell us and we will match it." },
              { question: "What is included in the rate?", answer: "Breakfast, VAT, and parking where the building has any. There is no resort fee, no cleaning fee, no early check-in fee and no charge for a cot." },
              { question: "Can I cancel?", answer: "Free up to 48 hours before at all four. Inside that we ask for the first night if we cannot re-let it, and in February we usually can." },
              { question: "Do you do a group rate?", answer: "The Mill takes groups over eight and the other three do not — thirty-one rooms and a lift is what makes that possible. Ring rather than book online for anything over four rooms." },
            ]} />
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
