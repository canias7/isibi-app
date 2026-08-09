// facility — SLOT-FIRST: what is free right now, before anything about the
// building. A leisure centre's visitor is asking "can I get on today" and every
// one of these sites answers "we exist".
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { FacilityStatus } from "@/components/ui/facility-status";
import { Faq } from "@/components/ui/faq";
import { LocationCard } from "@/components/ui/location-card";
import { OpeningHours } from "@/components/ui/opening-hours";
import { RateCard } from "@/components/ui/rate-card";
import { SectionHeader } from "@/components/ui/section-header";
export const Route = createFileRoute("/")({ component: P });
export const NOW = [
  { name: "Swimming pool", state: "closed" as const, reason: "School lessons until 15:30", nextFree: "15:30" },
  { name: "Lane swimming", state: "busy" as const, detail: "All 6 lanes taken", nextFree: "15:30" },
  { name: "Squash courts", state: "free" as const, detail: "2 of 3 free" },
  { name: "Badminton", state: "free" as const, detail: "4 of 6 courts free" },
  { name: "Gym", state: "busy" as const, detail: "Near capacity", nextFree: "14:00" },
  { name: "Climbing wall", state: "free" as const, detail: "Quiet" },
  { name: "Sports hall", state: "closed" as const, reason: "Netball league, all evening" },
  { name: "Table tennis", state: "free" as const, detail: "Both tables" },
];
function P() {
  return (
    <SiteChrome name="Hillsborough Leisure" tagline="Pool, courts, gym and a climbing wall, on Penistone Road."
      links={[{ label: "Book a slot", href: "/book" }, { label: "Membership", href: "/membership" }, { label: "Find us", href: "#find-us" }]}
      action={{ label: "Book a slot", href: "/book" }}>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Penistone Road · open 06:30–22:00 · no membership needed</p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">
                Can you get on today?
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                That is the only question anybody has, so it is answered here rather than after a
                phone call. Turn up and pay, or book a court ahead — both work and neither needs a
                membership.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="/book">Book a slot</a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="/membership">Is joining worth it?</a>
              </div>
            </div>
            {/* THE WHOLE FAMILY, in one component and above everything else. */}
            <FacilityStatus activities={NOW} updated="Updated 13:42" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="What it costs" title="Pay when you come, and it depends on when"
          description="Off-peak is before four on weekdays and it is genuinely half empty then. Peak is evenings and weekends." />
        <div className="mt-8 max-w-3xl">
          <RateCard label="Activity" unit="visit" bands={["Off-peak", "Peak"]} caption="Pay as you go"
            rates={[
              { period: "Swim", units: 1, price: 4.2, more: [5.6] },
              { period: "Gym", units: 1, price: 5.5, more: [7.2] },
              { period: "Badminton court, per hour", units: 1, price: 9, more: [13], note: "Per court, up to four people" },
              { period: "Squash court, per 40 min", units: 1, price: 7.5, more: [10.5] },
              { period: "Climbing, day pass", units: 1, price: 8.5, more: [11], note: "Includes shoe hire" },
              { period: "Sports hall, per hour", units: 1, price: 32, more: [46], note: "Whole hall. Half is two thirds of it" },
            ]}
            note="Under-16s are half price at every time. Over-60s pay off-peak rates whenever they come, including Saturday afternoon." />
        </div>
        <p className="mt-6 max-w-2xl text-sm text-muted-foreground">
          There is no joining fee and no contract on any of this. If you come more than about eight
          times a month, membership is cheaper — the arithmetic is on{" "}
          <a className="underline underline-offset-4" href="/membership">the membership page</a>{" "}
          and it will tell you honestly when it is not.
        </p>
      </section>

      <section id="find-us" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="When" title="Open seven days" />
              <OpeningHours className="mt-6" days={[
                { day: 1, label: "Monday", open: "06:30", close: "22:00" },
                { day: 2, label: "Tuesday", open: "06:30", close: "22:00" },
                { day: 3, label: "Wednesday", open: "06:30", close: "22:00" },
                { day: 4, label: "Thursday", open: "06:30", close: "22:00" },
                { day: 5, label: "Friday", open: "06:30", close: "21:00" },
                { day: 6, label: "Saturday", open: "08:00", close: "18:00" },
                { day: 0, label: "Sunday", open: "08:00", close: "16:00" },
              ]} />
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                The pool has school lessons most weekday mornings and afternoons — that is why the
                board above says closed rather than busy. Lane swimming from half three every day.
              </p>
            </div>
            <div>
              <LocationCard name="Hillsborough Leisure Centre"
                address="Penistone Road, Hillsborough, Sheffield, S6 2DE"
                note="Level access throughout, a pool hoist and a changing places toilet. Two hours free parking; the tram stops at Leppings Lane, four minutes away." />
              <Faq className="mt-8" items={[
                { question: "Do I have to book?", answer: "Only for courts and the sports hall. Swimming, the gym and the climbing wall are turn-up-and-pay, and the board on this page tells you whether that is a good idea right now." },
                { question: "How accurate is the board?", answer: "It reads the barrier counts and the booking system every ten minutes. It is right about closures always and right about 'busy' most of the time." },
                { question: "Can I come once?", answer: "Yes, and plenty of people do. No membership, no joining fee, and no sales conversation at the desk." },
                { question: "Is there a family swim?", answer: "Weekends 10–12 and every school holiday afternoon. Under-8s need an adult in the water, one adult to two children." },
                { question: "What do I need for climbing?", answer: "Nothing. Shoes are in the price and a twenty-minute induction is free — book it on the slot page rather than turning up for it." },
              ]} />
            </div>
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
